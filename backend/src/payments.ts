/**
 * Thanh toán MoMo và VNPay: tạo phiên, kiểm tra chữ ký, cập nhật đơn và hoàn tiền.
 * Chú thích không đổi thuật toán ký hay trạng thái giao dịch.
 */
import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import type { Router, Request } from "express";
import {
  actor,
  assertActiveVerified,
  assertTransactionRole,
  asyncRoute,
  audit,
  docData,
  fail,
  requireThat,
  sha,
} from "./core.js";
import type { Actor, Context } from "./core.js";

/** Official protocol references (checked 2026-10-18):
 * https://developers.momo.vn/v3/docs/payment/api/wallet/onetime/
 * https://developers.momo.vn/v3/docs/payment/api/payment-api/query/
 * https://developers.momo.vn/v3/docs/payment/api/payment-api/refund/
 * https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html
 * https://sandbox.vnpayment.vn/apis/docs/truy-van-hoan-tien/querydr&refund.html
 * Browser return URLs never settle payments; only authenticated provider messages do.
 */
type RecordData = Record<string, any>;
export type PaymentProvider = "MOMO" | "VNPAY" | "EMULATOR";
export type FinancialStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
export interface PaymentResult {
  status: "PENDING" | "SUCCEEDED" | "FAILED";
  amount_vnd: number;
  provider_transaction_id: string;
  provider_code: string;
  merchant_id: string;
  provider: PaymentProvider;
  requires_review?: boolean;
}
interface Configuration {
  provider: PaymentProvider;
  merchant: string;
  secret: string;
  accessKey: string;
  returnUrl: string;
  ipnUrl: string;
  baseUrl: string;
}
const SYSTEM_ACTOR: Actor = {
  uid: "payment-gateway",
  role: "ADMIN",
  status: "ACTIVE",
};
const PRIVATE_FIELDS = new Set([
  "_request_hash",
  "_create_lease_until",
  "_create_date",
  "_request_ip",
]);

// Id chỉ gồm chữ, số, gạch dưới và gạch ngang.
function safeId(value: unknown): string {
  requireThat(
    typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value),
    400,
    "INVALID_ID",
    "Invalid payment or order identifier.",
  );
  return value;
}

// Số tiền phải là số nguyên VND lớn hơn 0.
export function parseVnd(value: unknown): number {
  requireThat(
    (typeof value === "number" && Number.isSafeInteger(value)) ||
      (typeof value === "string" && /^(0|[1-9][0-9]{0,12})$/.test(value)),
    400,
    "INVALID_AMOUNT",
    "Payment amount must be an integer.",
  );
  const amount = Number(value);
  requireThat(
    Number.isSafeInteger(amount) && amount > 0 && amount <= 1_000_000_000,
    400,
    "INVALID_AMOUNT",
    "Payment amount is outside the supported range.",
  );
  return amount;
}

// Đưa giá trị về chuỗi trước khi ghép dữ liệu ký.
function scalar(value: unknown): string {
  requireThat(
    typeof value === "string" ||
      (typeof value === "number" && Number.isSafeInteger(value)),
    400,
    "INVALID_CALLBACK",
    "Provider payload contains an invalid field.",
  );
  return String(value);
}

// So sánh chữ ký theo thời gian cố định để tránh lộ từng ký tự.
function equalSignature(actual: unknown, expected: string): boolean {
  if (
    typeof actual !== "string" ||
    !/^[0-9a-f]+$/i.test(actual) ||
    actual.length !== expected.length
  )
    return false;
  return timingSafeEqual(
    Buffer.from(actual.toLowerCase(), "hex"),
    Buffer.from(expected, "hex"),
  );
}

const hmac = (
  algorithm: "sha256" | "sha512",
  secret: string,
  value: string,
): string => createHmac(algorithm, secret).update(value, "utf8").digest("hex");

// VNPay uses application/x-www-form-urlencoded encoding (space -> '+') and sorted keys.
// Ghép tham số VNPay theo thứ tự khóa, bỏ chữ ký cũ.
export function canonicalVnpay(data: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const key of Object.keys(data).sort()) {
    if (
      !key.startsWith("vnp_") ||
      key === "vnp_SecureHash" ||
      key === "vnp_SecureHashType"
    )
      continue;
    if (data[key] === "" || data[key] === undefined || data[key] === null)
      continue;
    params.append(key, scalar(data[key]));
  }
  return params.toString();
}

// Ký chuỗi VNPay bằng HMAC-SHA512.
export function signVnpay(
  data: Record<string, unknown>,
  secret: string,
): string {
  return hmac("sha512", secret, canonicalVnpay(data));
}

// Đối chiếu chữ ký VNPay gửi về với chữ ký tự tính.
export function verifyVnpay(
  data: Record<string, unknown>,
  secret: string,
): boolean {
  return equalSignature(data.vnp_SecureHash, signVnpay(data, secret));
}

// Ký thông điệp MoMo theo danh sách trường quy định.
export function signMomo(
  data: Record<string, unknown>,
  keys: readonly string[],
  secret: string,
): string {
  return hmac(
    "sha256",
    secret,
    keys.map((key) => `${key}=${scalar(data[key])}`).join("&"),
  );
}

const MOMO_CREATE = [
  "accessKey",
  "amount",
  "extraData",
  "ipnUrl",
  "orderId",
  "orderInfo",
  "partnerCode",
  "redirectUrl",
  "requestId",
  "requestType",
] as const;
const MOMO_CREATE_RESPONSE = [
  "accessKey",
  "amount",
  "message",
  "orderId",
  "partnerCode",
  "payUrl",
  "requestId",
  "responseTime",
  "resultCode",
] as const;
const MOMO_NOTIFICATION = [
  "accessKey",
  "amount",
  "extraData",
  "message",
  "orderId",
  "orderInfo",
  "orderType",
  "partnerCode",
  "payType",
  "requestId",
  "responseTime",
  "resultCode",
  "transId",
] as const;
const MOMO_QUERY = [
  "accessKey",
  "orderId",
  "partnerCode",
  "requestId",
] as const;
const MOMO_REFUND = [
  "accessKey",
  "amount",
  "description",
  "orderId",
  "partnerCode",
  "requestId",
  "transId",
] as const;

// Kiểm tra chữ ký IPN của MoMo trước khi tin kết quả.
export function verifyMomoNotification(
  data: Record<string, unknown>,
  accessKey: string,
  secret: string,
): boolean {
  return equalSignature(
    data.signature,
    signMomo({ ...data, accessKey }, MOMO_NOTIFICATION, secret),
  );
}

/** A signed success may correct an earlier failure; nothing can downgrade a confirmed charge. */
// Suy trạng thái tài chính kế tiếp từ kết quả cổng thanh toán.
export function nextFinancialStatus(
  current: FinancialStatus,
  incoming: PaymentResult["status"],
): FinancialStatus {
  if (current === "SUCCEEDED" || incoming === "SUCCEEDED") return "SUCCEEDED";
  if (current === "FAILED" || current === "CANCELLED") return current;
  return incoming;
}

// Các trường cần cập nhật trên đơn sau khi thu tiền thành công.
export function chargedOrderPatch(
  order: RecordData,
  paymentId: string,
  eligible: boolean,
  now: string,
): RecordData {
  const normal =
    order.status === "PENDING_PAYMENT" &&
    order._reservation_state === "HELD" &&
    order._active_payment_id === paymentId &&
    typeof order.expires_at === "string" &&
    order.expires_at > now &&
    eligible;
  return {
    status: normal ? "PAID" : "DISPUTED",
    ...(normal ? { _reservation_state: "CONSUMED" } : {}),
    _paid_payment_id: order._paid_payment_id || paymentId,
    paid_at: order.paid_at || now,
    updated_at: now,
    ...(!normal ? { _payment_review_reason: "CHARGE_REQUIRES_REVIEW" } : {}),
  };
}

// Bỏ các trường nội bộ trước khi trả giao dịch cho client.
function publicPayment(data: RecordData): RecordData {
  return Object.fromEntries(
    Object.entries(data).filter(
      ([key]) => !key.startsWith("_") && !PRIVATE_FIELDS.has(key),
    ),
  );
}

// URL callback và redirect bắt buộc dùng HTTPS.
function requireHttps(value: string | undefined, name: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value || "");
  } catch {
    fail(503, "PAYMENT_NOT_CONFIGURED", `${name} must be configured.`);
  }
  requireThat(
    parsed!.protocol === "https:" &&
      !parsed!.username &&
      !parsed!.password &&
      !parsed!.hash,
    503,
    "PAYMENT_NOT_CONFIGURED",
    `${name} must be an HTTPS URL.`,
  );
  return parsed!.toString();
}

// Đọc khóa cổng thanh toán từ cấu hình môi trường.
function configuration(provider: PaymentProvider, ctx: Context): Configuration {
  if (provider === "EMULATOR") {
    requireThat(
      ctx.emulator,
      403,
      "EMULATOR_ONLY",
      "Simulated payment is available only in the Firebase Emulator.",
    );
    return {
      provider,
      merchant: "firebase-emulator",
      secret: "",
      accessKey: "",
      returnUrl: "",
      ipnUrl: "",
      baseUrl: "",
    };
  }
  const enabled = (process.env.ENABLED_PAYMENT_PROVIDERS || "")
    .split(",")
    .map((value) => value.trim());
  requireThat(
    enabled.includes(provider),
    503,
    "PAYMENT_PROVIDER_DISABLED",
    "This payment provider is not enabled on the backend.",
  );
  const mode = process.env.PAYMENT_MODE || "sandbox";
  requireThat(
    mode === "sandbox" || mode === "production",
    503,
    "PAYMENT_NOT_CONFIGURED",
    "PAYMENT_MODE must be sandbox or production.",
  );
  const returnUrl = requireHttps(
    process.env.PAYMENT_RETURN_URL,
    "PAYMENT_RETURN_URL",
  );
  if (provider === "MOMO") {
    const merchant = process.env.MOMO_PARTNER_CODE || "";
    const secret = process.env.MOMO_SECRET_KEY || "";
    const accessKey = process.env.MOMO_ACCESS_KEY || "";
    requireThat(
      merchant && secret && accessKey,
      503,
      "PAYMENT_NOT_CONFIGURED",
      "MoMo merchant credentials are missing.",
    );
    const ipnBase = requireHttps(
      process.env.PAYMENT_IPN_BASE_URL,
      "PAYMENT_IPN_BASE_URL",
    ).replace(/\/$/, "");
    requireThat(
      !new URL(ipnBase).search,
      503,
      "PAYMENT_NOT_CONFIGURED",
      "PAYMENT_IPN_BASE_URL must not contain a query string.",
    );
    return {
      provider,
      merchant,
      secret,
      accessKey,
      returnUrl,
      ipnUrl: `${ipnBase}/payments/momo/ipn`,
      baseUrl:
        mode === "production"
          ? "https://payment.momo.vn"
          : "https://test-payment.momo.vn",
    };
  }
  const merchant = process.env.VNPAY_TMN_CODE || "";
  const secret = process.env.VNPAY_HASH_SECRET || "";
  requireThat(
    merchant && secret,
    503,
    "PAYMENT_NOT_CONFIGURED",
    "VNPay merchant credentials are missing.",
  );
  return {
    provider,
    merchant,
    secret,
    accessKey: "",
    returnUrl,
    ipnUrl: "",
    baseUrl:
      mode === "production"
        ? "https://pay.vnpay.vn"
        : "https://sandbox.vnpayment.vn",
  };
}

// URL máy chủ dùng khi cổng gọi lại kết quả thanh toán.
function callbackConfiguration(
  provider: "MOMO" | "VNPAY",
): Pick<Configuration, "merchant" | "secret" | "accessKey"> {
  // Callbacks remain usable when a redirect URL is changed or temporarily missing.
  const merchant =
    process.env[provider === "MOMO" ? "MOMO_PARTNER_CODE" : "VNPAY_TMN_CODE"] ||
    "";
  const secret =
    process.env[
      provider === "MOMO" ? "MOMO_SECRET_KEY" : "VNPAY_HASH_SECRET"
    ] || "";
  const accessKey = process.env.MOMO_ACCESS_KEY || "";
  requireThat(
    merchant && secret && (provider !== "MOMO" || accessKey),
    503,
    "PAYMENT_NOT_CONFIGURED",
    "Provider callback credentials are missing.",
  );
  return { merchant, secret, accessKey };
}

// Đổi mốc thời gian sang ngày theo lịch Việt Nam cho VNPay.
function vietnamDate(iso: string): string {
  return new Date(Date.parse(iso) + 7 * 60 * 60 * 1000)
    .toISOString()
    .replace(/[-:T]/g, "")
    .slice(0, 14);
}

// Gọi API cổng thanh toán và đọc phản hồi JSON.
async function providerPost(
  url: string,
  body: RecordData,
): Promise<RecordData> {
  let response: globalThis.Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(31_000),
      redirect: "error",
    });
  } catch {
    fail(
      502,
      "PAYMENT_PROVIDER_UNCERTAIN",
      "Provider response is unavailable. Reconcile this payment before trying another payment.",
    );
  }
  requireThat(
    response!.ok,
    502,
    "PAYMENT_PROVIDER_UNCERTAIN",
    "Provider did not confirm this request. Reconcile the payment.",
  );
  let data: unknown;
  try {
    data = await response!.json();
  } catch {
    fail(
      502,
      "PAYMENT_PROVIDER_UNCERTAIN",
      "Provider returned an unreadable response.",
    );
  }
  requireThat(
    data && typeof data === "object" && !Array.isArray(data),
    502,
    "PAYMENT_PROVIDER_UNCERTAIN",
    "Provider response is invalid.",
  );
  return data as RecordData;
}

// Tạo phiên thanh toán mới trên MoMo hoặc VNPay.
async function createGatewaySession(
  payment: RecordData,
  config: Configuration,
): Promise<string> {
  if (config.provider === "EMULATOR")
    return `emulator://payments/${payment.id}`;
  if (config.provider === "VNPAY") {
    const params = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: config.merchant,
      vnp_Amount: String(payment.amount_vnd * 100),
      vnp_CurrCode: "VND",
      vnp_TxnRef: payment.id,
      vnp_OrderInfo: `Thanh toan EcoShare ${payment.order_id}`,
      vnp_OrderType: "other",
      vnp_Locale: "vn",
      vnp_ReturnUrl: config.returnUrl,
      vnp_IpAddr: payment._request_ip,
      vnp_CreateDate: payment._create_date,
      vnp_ExpireDate: vietnamDate(payment.expires_at),
    };
    return `${config.baseUrl}/paymentv2/vpcpay.html?${canonicalVnpay(params)}&vnp_SecureHash=${signVnpay(params, config.secret)}`;
  }
  const body: RecordData = {
    partnerCode: config.merchant,
    requestId: payment.id,
    amount: payment.amount_vnd,
    orderId: payment.id,
    orderInfo: `Thanh toan EcoShare ${payment.order_id}`,
    redirectUrl: config.returnUrl,
    ipnUrl: config.ipnUrl,
    requestType: "captureWallet",
    extraData: "",
    lang: "vi",
    autoCapture: true,
  };
  body.signature = signMomo(
    { ...body, accessKey: config.accessKey },
    MOMO_CREATE,
    config.secret,
  );
  const result = await providerPost(
    `${config.baseUrl}/v2/gateway/api/create`,
    body,
  );
  requireThat(
    result.partnerCode === config.merchant &&
      result.orderId === payment.id &&
      result.requestId === payment.id &&
      Number(result.amount) === payment.amount_vnd,
    502,
    "PROVIDER_RESPONSE_MISMATCH",
    "Provider returned a different payment reference.",
  );
  // Verify the documented create-response signature when supplied. Settlement always requires IPN/query.
  if (result.signature)
    requireThat(
      equalSignature(
        result.signature,
        signMomo(
          { ...result, accessKey: config.accessKey },
          MOMO_CREATE_RESPONSE,
          config.secret,
        ),
      ),
      502,
      "INVALID_PROVIDER_SIGNATURE",
      "Provider response signature is invalid.",
    );
  requireThat(
    result.resultCode === 0 && typeof result.payUrl === "string",
    502,
    "PAYMENT_PROVIDER_UNCERTAIN",
    "Provider did not return a checkout URL. Reconcile the payment.",
  );
  let parsed: URL;
  try {
    parsed = new URL(result.payUrl);
  } catch {
    fail(502, "INVALID_PROVIDER_URL", "Provider checkout URL is invalid.");
  }
  requireThat(
    parsed!.protocol === "https:" &&
      !parsed!.username &&
      !parsed!.password &&
      (parsed!.hostname === "payment.momo.vn" ||
        parsed!.hostname === "test-payment.momo.vn"),
    502,
    "INVALID_PROVIDER_URL",
    "Provider checkout URL is invalid.",
  );
  return result.payUrl;
}

/** Caller must already have verified the provider signature (or be the emulator-only admin route). */
// Ghi kết quả cổng vào giao dịch và đơn, chỉ một lần thành công.
export async function applyPaymentResult(
  ctx: Context,
  paymentId: string,
  result: PaymentResult,
): Promise<RecordData> {
  return ctx.db.runTransaction(async (tx) => {
    const paymentRef = ctx.db.collection("payments").doc(safeId(paymentId));
    const paymentSnapshot = await tx.get(paymentRef);
    requireThat(
      paymentSnapshot.exists,
      404,
      "PAYMENT_NOT_FOUND",
      "Payment does not exist.",
    );
    const payment = docData(paymentSnapshot);
    requireThat(
      payment.provider === result.provider &&
        payment.merchant_id === result.merchant_id &&
        payment.amount_vnd === parseVnd(result.amount_vnd),
      400,
      "PAYMENT_MISMATCH",
      "Provider payment reference, merchant or amount does not match.",
    );
    requireThat(
      result.status !== "SUCCEEDED" ||
        /^[a-zA-Z0-9_.:-]{1,128}$/.test(result.provider_transaction_id),
      400,
      "INVALID_PROVIDER_TRANSACTION",
      "Successful payment requires a provider transaction identifier.",
    );
    if (payment.status === "SUCCEEDED") {
      requireThat(
        result.status !== "SUCCEEDED" ||
          payment.provider_transaction_id === result.provider_transaction_id,
        409,
        "PROVIDER_TRANSACTION_CONFLICT",
        "Payment has another confirmed provider transaction.",
      );
      return payment;
    }
    const orderRef = ctx.db.collection("orders").doc(payment.order_id);
    const orderSnapshot = await tx.get(orderRef);
    requireThat(
      orderSnapshot.exists,
      409,
      "ORDER_NOT_FOUND",
      "Payment order does not exist.",
    );
    const order = docData(orderSnapshot);
    let eligible = false;
    let refundReads: {
      remainingCharge: boolean;
      ledger: RecordData | null;
      reversalExists: boolean;
      user: RecordData | null;
    } | null = null;
    let releaseInventory: {
      valid: boolean;
      items: {
        id: string;
        stock: number;
        reserved: number;
        quantity: number;
      }[];
    } | null = null;
    if (result.status === "SUCCEEDED" && payment.kind === "CHARGE") {
      try {
        await assertActiveVerified(tx, ctx, order.buyer_id);
        await assertActiveVerified(tx, ctx, order.seller_id);
        eligible = true;
      } catch (error) {
        const status = (error as { status?: number }).status;
        if (!status || status >= 500) throw error;
        // A revoked verification must never erase a real payment received by the merchant.
      }
    }
    if (result.status === "SUCCEEDED" && payment.kind === "REFUND") {
      const finance = await tx.get(
        ctx.db.collection("payments").where("order_id", "==", payment.order_id),
      );
      const records = finance.docs.map(docData);
      const refunded = new Set(
        records
          .filter((row) => row.kind === "REFUND" && row.status === "SUCCEEDED")
          .map((row) => row.parent_payment_id),
      );
      refunded.add(payment.parent_payment_id);
      const remainingCharge = records.some(
        (row) =>
          row.kind === "CHARGE" &&
          row.status === "SUCCEEDED" &&
          !refunded.has(row.id),
      );
      const originalLedger = await tx.get(
        ctx.db
          .collection("green_ledger")
          .doc(sha(`completed:${order.id}:${order.buyer_id}`)),
      );
      const reversalLedger = await tx.get(
        ctx.db
          .collection("green_ledger")
          .doc(sha(`refund:${order.id}:${order.buyer_id}`)),
      );
      const buyer =
        originalLedger.exists && !reversalLedger.exists
          ? await tx.get(ctx.db.collection("users").doc(order.buyer_id))
          : null;
      refundReads = {
        remainingCharge,
        ledger: originalLedger.exists ? docData(originalLedger) : null,
        reversalExists: reversalLedger.exists,
        user: buyer?.exists ? docData(buyer) : null,
      };
      if (
        !remainingCharge &&
        !order.shipped_at &&
        !order.completed_at &&
        !["SHIPPED", "COMPLETED"].includes(order.status) &&
        !order._inventory_released &&
        ["HELD", "CONSUMED"].includes(order._reservation_state)
      ) {
        const orderItems = await tx.get(
          ctx.db.collection("order_items").where("order_id", "==", order.id),
        );
        const stocks = await Promise.all(
          orderItems.docs.map((row) =>
            tx.get(
              ctx.db
                .collection("listing_items")
                .doc(row.data().listing_item_id),
            ),
          ),
        );
        const items = orderItems.docs.map((row, index) => ({
          id: row.data().listing_item_id as string,
          stock: stocks[index].data()?.stock,
          reserved: stocks[index].data()?._reserved,
          quantity: row.data().quantity,
        }));
        const valid =
          items.length > 0 &&
          items.every(
            (item) =>
              Number.isSafeInteger(item.quantity) &&
              item.quantity > 0 &&
              Number.isSafeInteger(item.stock) &&
              item.stock >= 0 &&
              Number.isSafeInteger(item.reserved) &&
              item.reserved >= item.quantity &&
              Number.isSafeInteger(item.stock + item.quantity),
          );
        releaseInventory = { valid, items };
      }
    }
    // Deterministic ownership of a provider transaction prevents replay across Payment records.
    const receiptRef =
      result.status === "SUCCEEDED"
        ? ctx.db
            .collection("system_settings")
            .doc(
              `receipt_${sha(`${result.provider}:${result.merchant_id}:${result.provider_transaction_id}:${payment.kind}`)}`,
            )
        : null;
    const receipt = receiptRef ? await tx.get(receiptRef) : null;
    requireThat(
      !receipt?.exists || receipt.data()?.payment_id === paymentId,
      409,
      "PROVIDER_TRANSACTION_REPLAY",
      "Provider transaction is already assigned to another payment.",
    );
    const now = ctx.now();
    const status = nextFinancialStatus(
      payment.status as FinancialStatus,
      result.status,
    );
    const patch: RecordData = {
      status,
      updated_at: now,
      provider_code: result.provider_code,
      _gateway_state: status === "PENDING" ? "PENDING" : "CONFIRMED",
    };
    if (result.provider_transaction_id)
      patch.provider_transaction_id = result.provider_transaction_id;
    if (status === "SUCCEEDED") {
      patch.confirmed_at = now;
      if (payment.kind === "REFUND") {
        const inventoryPatch: RecordData = {};
        if (releaseInventory?.valid) {
          for (const item of releaseInventory.items)
            tx.update(ctx.db.collection("listing_items").doc(item.id), {
              stock: item.stock + item.quantity,
              _reserved: item.reserved - item.quantity,
            });
          inventoryPatch._inventory_released = true;
          inventoryPatch._reservation_state = "RELEASED";
        } else if (releaseInventory)
          inventoryPatch._inventory_review_required = true;
        tx.update(orderRef, {
          status: refundReads!.remainingCharge ? "DISPUTED" : "REFUNDED",
          ...(!refundReads!.remainingCharge ? { refunded_at: now } : {}),
          ...inventoryPatch,
          updated_at: now,
        });
        if (
          refundReads!.ledger &&
          !refundReads!.reversalExists &&
          refundReads!.user
        ) {
          const amount = Number(refundReads!.ledger.points);
          const balance = Number(refundReads!.user.points_balance || 0);
          if (
            Number.isSafeInteger(amount) &&
            amount > 0 &&
            Number.isSafeInteger(balance) &&
            Number.isSafeInteger(balance - amount)
          ) {
            const dedupe = `refund:${order.id}:${order.buyer_id}`;
            tx.create(ctx.db.collection("green_ledger").doc(sha(dedupe)), {
              id: sha(dedupe),
              user_id: order.buyer_id,
              order_id: order.id,
              points: -amount,
              reason: "ORDER_REFUNDED",
              dedupe_key: dedupe,
              created_at: now,
            });
            tx.update(ctx.db.collection("users").doc(order.buyer_id), {
              points_balance: balance - amount,
            });
          } else patch._ledger_review_required = true;
        }
      } else {
        tx.update(
          orderRef,
          chargedOrderPatch(
            order,
            paymentId,
            eligible && !result.requires_review,
            now,
          ),
        );
      }
      if (receiptRef && !receipt?.exists)
        tx.create(receiptRef, {
          kind: "PAYMENT_RECEIPT",
          payment_id: paymentId,
          created_at: now,
        });
    } else if (
      status === "FAILED" &&
      payment.kind === "REFUND" &&
      order.status === "REFUND_PENDING"
    ) {
      tx.update(orderRef, { status: "DISPUTED", updated_at: now });
    }
    tx.update(paymentRef, patch);
    audit(
      tx,
      ctx,
      SYSTEM_ACTOR,
      `PAYMENT_${status}`,
      "Payment",
      paymentId,
      `Verified ${result.provider} result ${result.provider_code}`,
    );
    return { ...payment, ...patch };
  });
}

// Lấy địa chỉ IP của client gửi yêu cầu thanh toán.
function clientIp(req: Request): string {
  const ip = (req.ip || "").replace(/^::ffff:/, "");
  return isIP(ip) ? ip : "127.0.0.1";
}

// Chỉ chấp nhận nhà cung cấp MOMO hoặc VNPAY.
function providerValue(value: unknown, ctx: Context): PaymentProvider {
  requireThat(
    value === "MOMO" ||
      value === "VNPAY" ||
      (ctx.emulator && value === "EMULATOR"),
    400,
    "INVALID_PROVIDER",
    "Choose MOMO or VNPAY (EMULATOR is local only).",
  );
  return value as PaymentProvider;
}

// Mở hoặc lấy lại phiên thanh toán cho một đơn.
async function paymentSession(
  ctx: Context,
  req: Request,
  member: Actor,
): Promise<RecordData> {
  const orderId = safeId(req.params.id);
  requireThat(
    req.body &&
      typeof req.body === "object" &&
      !Array.isArray(req.body) &&
      Object.keys(req.body).length === 1 &&
      "provider" in req.body,
    400,
    "INVALID_BODY",
    "Payment checkout accepts only the provider field.",
  );
  const provider = providerValue(req.body?.provider, ctx);
  const config = configuration(provider, ctx); // Fail closed before creating any database record.
  const key = req.header("Idempotency-Key");
  requireThat(
    typeof key === "string" && /^[a-zA-Z0-9_.:-]{8,128}$/.test(key),
    400,
    "IDEMPOTENCY_KEY_REQUIRED",
    "Supply an Idempotency-Key of 8–128 safe characters.",
  );
  const paymentId = `p${sha(`${member.uid}:${orderId}:${key}`).slice(0, 40)}`;
  const requestHash = sha(
    JSON.stringify({ buyer: member.uid, order: orderId, provider }),
  );
  const paymentRef = ctx.db.collection("payments").doc(paymentId);
  const payment = await ctx.db.runTransaction(async (tx) => {
    const orderRef = ctx.db.collection("orders").doc(orderId);
    const [orderSnapshot, existingSnapshot] = await Promise.all([
      tx.get(orderRef),
      tx.get(paymentRef),
    ]);
    requireThat(
      orderSnapshot.exists,
      404,
      "ORDER_NOT_FOUND",
      "Order does not exist.",
    );
    const order = docData(orderSnapshot);
    requireThat(
      order.buyer_id === member.uid,
      403,
      "BUYER_ONLY",
      "Only this order buyer may start checkout.",
    );
    if (existingSnapshot.exists) {
      const existing = docData(existingSnapshot);
      requireThat(
        existing._request_hash === requestHash,
        409,
        "IDEMPOTENCY_CONFLICT",
        "This key was used for another payment request.",
      );
      if (existing.pay_url || existing.status !== "PENDING") return existing;
      requireThat(
        existing.merchant_id === config.merchant,
        503,
        "PAYMENT_MERCHANT_CHANGED",
        "The payment merchant configuration has changed. Reconcile the original payment.",
      );
      requireThat(
        !existing._create_lease_until ||
          existing._create_lease_until <= ctx.now(),
        409,
        "PAYMENT_SESSION_BUSY",
        "Checkout is being created. Query this order payment list shortly.",
      );
    }
    requireThat(
      order.status === "PENDING_PAYMENT" &&
        order._reservation_state === "HELD" &&
        typeof order.expires_at === "string" &&
        order.expires_at > ctx.now(),
      409,
      "ORDER_NOT_PAYABLE",
      "Order reservation has expired or the order cannot be paid.",
    );
    const activeId = order._active_payment_id;
    if (activeId && activeId !== paymentId) {
      const active = await tx.get(ctx.db.collection("payments").doc(activeId));
      requireThat(
        active.exists &&
          ["FAILED", "CANCELLED"].includes(active.data()?.status),
        409,
        "PAYMENT_ALREADY_PENDING",
        "An earlier payment must be reconciled before another attempt.",
      );
    }
    await assertActiveVerified(tx, ctx, order.buyer_id);
    await assertActiveVerified(tx, ctx, order.seller_id);
    const amount = parseVnd(order.total_vnd);
    if (provider === "MOMO")
      requireThat(
        amount >= 1000 && amount <= 50_000_000,
        400,
        "PROVIDER_AMOUNT_LIMIT",
        "MoMo supports payments from 1,000 to 50,000,000 VND.",
      );
    const now = ctx.now();
    const data: RecordData = existingSnapshot.exists
      ? docData(existingSnapshot)
      : {
          id: paymentId,
          order_id: orderId,
          user_id: member.uid,
          kind: "CHARGE",
          parent_payment_id: null,
          provider,
          merchant_id: config.merchant,
          amount_vnd: amount,
          currency: "VND",
          status: "PENDING",
          provider_reference: paymentId,
          provider_transaction_id: null,
          pay_url: null,
          created_at: now,
          expires_at: order.expires_at,
          _request_hash: requestHash,
          _member_ids: [order.buyer_id, order.seller_id],
          _create_date: vietnamDate(now),
          _request_ip: clientIp(req),
        };
    data.updated_at = now;
    data._gateway_state = "CREATING";
    data._create_lease_until = new Date(Date.parse(now) + 36_000).toISOString();
    if (existingSnapshot.exists)
      tx.update(paymentRef, {
        _gateway_state: data._gateway_state,
        _create_lease_until: data._create_lease_until,
        updated_at: now,
      });
    else tx.create(paymentRef, data);
    tx.update(orderRef, { _active_payment_id: paymentId, updated_at: now });
    audit(
      tx,
      ctx,
      member,
      "CREATE_PAYMENT_SESSION",
      "Payment",
      paymentId,
      `Checkout ${provider}`,
    );
    return data;
  });
  if (payment.pay_url || payment.status !== "PENDING")
    return publicPayment(payment);
  try {
    const payUrl = await createGatewaySession(payment, config);
    return await ctx.db.runTransaction(async (tx) => {
      const snapshot = await tx.get(paymentRef);
      const current = docData(snapshot);
      const patch = {
        pay_url: payUrl,
        _create_lease_until: null,
        _gateway_state:
          current.status === "PENDING" ? "PENDING" : current._gateway_state,
        updated_at: ctx.now(),
      };
      tx.update(paymentRef, patch);
      return publicPayment({ ...current, ...patch });
    });
  } catch (error) {
    // Unknown outcome stays pending. A timeout must not free a reservation or permit another charge.
    await ctx.db.runTransaction(async (tx) => {
      const current = docData(await tx.get(paymentRef));
      tx.update(paymentRef, {
        _gateway_state:
          current.status === "PENDING" ? "UNKNOWN" : current._gateway_state,
        _create_lease_until: null,
        updated_at: ctx.now(),
      });
    });
    throw error;
  }
}

// Hỏi lại cổng khi kết quả cục bộ chưa chốt.
async function queryProvider(
  payment: RecordData,
  config: Configuration,
): Promise<PaymentResult> {
  requireThat(
    payment.merchant_id === config.merchant,
    503,
    "PAYMENT_MERCHANT_CHANGED",
    "Use the original merchant configuration to reconcile this payment.",
  );
  if (config.provider === "EMULATOR")
    return {
      status:
        payment.status === "SUCCEEDED"
          ? "SUCCEEDED"
          : payment.status === "FAILED"
            ? "FAILED"
            : "PENDING",
      amount_vnd: payment.amount_vnd,
      provider_transaction_id: payment.provider_transaction_id || "",
      provider_code: "EMULATOR_QUERY",
      merchant_id: config.merchant,
      provider: "EMULATOR",
    };
  if (config.provider === "MOMO") {
    const requestId = randomUUID();
    const body: RecordData = {
      partnerCode: config.merchant,
      requestId,
      orderId: payment.id,
      lang: "vi",
    };
    body.signature = signMomo(
      { ...body, accessKey: config.accessKey },
      MOMO_QUERY,
      config.secret,
    );
    const data = await providerPost(
      `${config.baseUrl}/v2/gateway/api/${payment.kind === "REFUND" ? "refund/query" : "query"}`,
      body,
    );
    requireThat(
      data.partnerCode === config.merchant &&
        data.orderId === payment.id &&
        data.requestId === requestId,
      502,
      "PROVIDER_RESPONSE_MISMATCH",
      "Provider query reference does not match.",
    );
    // These official query endpoints return no response signature; authenticated TLS from a fixed
    // provider host + signed request + matching unique reference bind the server-to-server reply.
    if (payment.kind === "REFUND") {
      const entry =
        data.resultCode === 0 && Array.isArray(data.refundTrans)
          ? data.refundTrans.find(
              (item: RecordData) =>
                item.orderId === payment.id &&
                Number(item.amount) === payment.amount_vnd &&
                item.resultCode === 0,
            )
          : null;
      return {
        provider: "MOMO",
        merchant_id: config.merchant,
        amount_vnd: payment.amount_vnd,
        status: entry ? "SUCCEEDED" : "PENDING",
        provider_transaction_id: entry ? scalar(entry.transId) : "",
        provider_code: scalar(data.resultCode),
      };
    }
    requireThat(
      parseVnd(data.amount) === payment.amount_vnd,
      502,
      "PROVIDER_RESPONSE_MISMATCH",
      "Provider query amount does not match.",
    );
    const code = Number(data.resultCode);
    // Only documented terminal declines permit another attempt; unfamiliar/processing codes stay pending.
    const failed = [
      1001, 1002, 1003, 1004, 1005, 1006, 1007, 1017, 1026, 1080, 2001, 2007,
    ].includes(code);
    return {
      provider: "MOMO",
      merchant_id: config.merchant,
      amount_vnd: payment.amount_vnd,
      status: code === 0 ? "SUCCEEDED" : failed ? "FAILED" : "PENDING",
      provider_transaction_id:
        data.transId === undefined ? "" : scalar(data.transId),
      provider_code: scalar(data.resultCode),
    };
  }
  requireThat(
    payment.kind === "CHARGE",
    503,
    "REFUND_PROVIDER_UNAVAILABLE",
    "VNPay refunds require merchant onboarding before enabling this adapter.",
  );
  const body: RecordData = {
    vnp_RequestId: randomUUID().replace(/-/g, ""),
    vnp_Version: "2.1.0",
    vnp_Command: "querydr",
    vnp_TmnCode: config.merchant,
    vnp_TxnRef: payment.id,
    vnp_TransactionDate: payment._create_date,
    vnp_CreateDate: vietnamDate(new Date().toISOString()),
    vnp_IpAddr: payment._request_ip || "127.0.0.1",
    vnp_OrderInfo: `Query EcoShare ${payment.id}`,
  };
  const keys = [
    "vnp_RequestId",
    "vnp_Version",
    "vnp_Command",
    "vnp_TmnCode",
    "vnp_TxnRef",
    "vnp_TransactionDate",
    "vnp_CreateDate",
    "vnp_IpAddr",
    "vnp_OrderInfo",
  ];
  body.vnp_SecureHash = hmac(
    "sha512",
    config.secret,
    keys.map((key) => scalar(body[key])).join("|"),
  );
  const data = await providerPost(
    `${config.baseUrl}/merchant_webapi/api/transaction`,
    body,
  );
  const responseKeys = [
    "vnp_ResponseId",
    "vnp_Command",
    "vnp_ResponseCode",
    "vnp_Message",
    "vnp_TmnCode",
    "vnp_TxnRef",
    "vnp_Amount",
    "vnp_BankCode",
    "vnp_PayDate",
    "vnp_TransactionNo",
    "vnp_TransactionType",
    "vnp_TransactionStatus",
    "vnp_OrderInfo",
    "vnp_PromotionCode",
    "vnp_PromotionAmount",
  ];
  requireThat(
    equalSignature(
      data.vnp_SecureHash,
      hmac(
        "sha512",
        config.secret,
        responseKeys
          .map((key) => (data[key] === undefined ? "" : scalar(data[key])))
          .join("|"),
      ),
    ),
    502,
    "INVALID_PROVIDER_SIGNATURE",
    "VNPay query signature is invalid.",
  );
  requireThat(
    data.vnp_TmnCode === config.merchant &&
      data.vnp_TxnRef === payment.id &&
      data.vnp_Command === "querydr" &&
      data.vnp_TransactionType === "01" &&
      data.vnp_ResponseCode === "00" &&
      String(data.vnp_Amount) === String(payment.amount_vnd * 100),
    502,
    "PROVIDER_RESPONSE_MISMATCH",
    "VNPay query reference or amount does not match.",
  );
  const status = scalar(data.vnp_TransactionStatus);
  return {
    provider: "VNPAY",
    merchant_id: config.merchant,
    amount_vnd: payment.amount_vnd,
    status: ["00", "07", "10", "20"].includes(status)
      ? "SUCCEEDED"
      : ["02", "08", "11"].includes(status)
        ? "FAILED"
        : "PENDING",
    requires_review: status === "07",
    provider_transaction_id: scalar(data.vnp_TransactionNo),
    provider_code: status,
  };
}

// Tạo giao dịch hoàn tiền gắn với lần thu thành công.
async function createRefund(
  ctx: Context,
  chargeId: string,
  admin: Actor,
  reason: string,
): Promise<RecordData> {
  const chargeRef = ctx.db.collection("payments").doc(safeId(chargeId));
  const initial = await chargeRef.get();
  requireThat(
    initial.exists,
    404,
    "PAYMENT_NOT_FOUND",
    "Payment does not exist.",
  );
  const charge = docData(initial);
  requireThat(
    charge.kind === "CHARGE" && charge.status === "SUCCEEDED",
    409,
    "CHARGE_NOT_REFUNDABLE",
    "Only a confirmed charge can be refunded.",
  );
  const config = configuration(charge.provider, ctx);
  requireThat(
    charge.merchant_id === config.merchant,
    503,
    "PAYMENT_MERCHANT_CHANGED",
    "Use the original merchant configuration to refund this charge.",
  );
  requireThat(
    charge.provider !== "VNPAY",
    503,
    "REFUND_PROVIDER_UNAVAILABLE",
    "VNPay refunds require merchant onboarding before enabling this adapter.",
  );
  const refundId = `r${sha(chargeId).slice(0, 40)}`;
  const refundRef = ctx.db.collection("payments").doc(refundId);
  const refund: RecordData = await ctx.db.runTransaction(async (tx) => {
    await assertTransactionRole(tx, ctx, admin, ["ADMIN"]);
    const [chargeSnapshot, refundSnapshot] = await Promise.all([
      tx.get(chargeRef),
      tx.get(refundRef),
    ]);
    const currentCharge = docData(chargeSnapshot);
    requireThat(
      currentCharge.kind === "CHARGE" && currentCharge.status === "SUCCEEDED",
      409,
      "CHARGE_NOT_REFUNDABLE",
      "Charge is not confirmed.",
    );
    if (refundSnapshot.exists) {
      const existing = docData(refundSnapshot);
      if (
        existing.status !== "PENDING" ||
        (existing._create_lease_until &&
          existing._create_lease_until > ctx.now())
      )
        return { ...existing, _dispatch: false };
      tx.update(refundRef, {
        _create_lease_until: new Date(
          Date.parse(ctx.now()) + 36_000,
        ).toISOString(),
      });
      return { ...existing, _dispatch: true };
    }
    const orderRef = ctx.db.collection("orders").doc(currentCharge.order_id);
    const orderSnapshot = await tx.get(orderRef);
    requireThat(
      orderSnapshot.exists,
      409,
      "ORDER_NOT_FOUND",
      "Order does not exist.",
    );
    const order = docData(orderSnapshot);
    requireThat(
      order.status !== "REFUNDED",
      409,
      "ORDER_ALREADY_REFUNDED",
      "Order has already been refunded.",
    );
    const now = ctx.now();
    const data = {
      id: refundId,
      order_id: currentCharge.order_id,
      user_id: currentCharge.user_id,
      kind: "REFUND",
      parent_payment_id: chargeId,
      provider: currentCharge.provider,
      merchant_id: currentCharge.merchant_id,
      amount_vnd: currentCharge.amount_vnd,
      currency: "VND",
      status: "PENDING",
      provider_reference: refundId,
      provider_transaction_id: null,
      created_at: now,
      updated_at: now,
      reason,
      _member_ids: currentCharge._member_ids,
      _gateway_state: "CREATING",
      _create_lease_until: new Date(Date.parse(now) + 36_000).toISOString(),
    };
    tx.create(refundRef, data);
    tx.update(chargeRef, { _refund_payment_id: refundId });
    tx.update(orderRef, { status: "REFUND_PENDING", updated_at: now });
    audit(tx, ctx, admin, "REQUEST_FULL_REFUND", "Payment", refundId, reason);
    return { ...data, _dispatch: true };
  });
  if (!refund._dispatch || config.provider === "EMULATOR")
    return publicPayment(refund);
  const body: RecordData = {
    partnerCode: config.merchant,
    orderId: refundId,
    requestId: refundId,
    amount: charge.amount_vnd,
    transId: charge.provider_transaction_id,
    lang: "vi",
    description: "EcoShare full refund",
  };
  body.signature = signMomo(
    { ...body, accessKey: config.accessKey },
    MOMO_REFUND,
    config.secret,
  );
  try {
    const data = await providerPost(
      `${config.baseUrl}/v2/gateway/api/refund`,
      body,
    );
    requireThat(
      data.partnerCode === config.merchant &&
        data.orderId === refundId &&
        data.requestId === refundId &&
        Number(data.amount) === charge.amount_vnd,
      502,
      "PROVIDER_RESPONSE_MISMATCH",
      "Refund response reference or amount does not match.",
    );
    // The submit response only acknowledges the request. Reconcile queries confirm the refund.
    await refundRef.update({
      _gateway_state: "AWAITING_RECONCILIATION",
      _create_lease_until: null,
      provider_code: scalar(data.resultCode),
      updated_at: ctx.now(),
    });
  } catch (error) {
    await refundRef.update({
      _gateway_state: "UNKNOWN",
      _create_lease_until: null,
      updated_at: ctx.now(),
    });
    throw error;
  }
  return publicPayment(docData(await refundRef.get()));
}

// Gắn route tạo thanh toán, callback và hoàn tiền.
export function registerPaymentRoutes(router: Router, ctx: Context): void {
  router.post(
    "/orders/:id/payment-sessions",
    asyncRoute(async (req, res) => {
      const member = actor(res);
      res.status(201).json({ data: await paymentSession(ctx, req, member) });
    }),
  );

  router.get(
    "/orders/:id/payments",
    asyncRoute(async (req, res) => {
      const member = actor(res);
      const orderId = safeId(req.params.id);
      const order = await ctx.db.collection("orders").doc(orderId).get();
      requireThat(
        order.exists,
        404,
        "ORDER_NOT_FOUND",
        "Order does not exist.",
      );
      requireThat(
        member.role === "ADMIN" ||
          [order.data()?.buyer_id, order.data()?.seller_id].includes(
            member.uid,
          ),
        403,
        "FORBIDDEN",
        "Payment details belong to this order participants.",
      );
      const payments = await ctx.db
        .collection("payments")
        .where("order_id", "==", orderId)
        .limit(50)
        .get();
      res.json({
        data: payments.docs.map((snapshot) => publicPayment(docData(snapshot))),
      });
    }),
  );

  router.post(
    "/payments/momo/ipn",
    asyncRoute(async (req, res) => {
      const config = callbackConfiguration("MOMO");
      const data = req.body;
      requireThat(
        data && typeof data === "object" && !Array.isArray(data),
        400,
        "INVALID_CALLBACK",
        "Invalid callback payload.",
      );
      requireThat(
        verifyMomoNotification(data, config.accessKey, config.secret),
        400,
        "INVALID_PROVIDER_SIGNATURE",
        "MoMo signature is invalid.",
      );
      requireThat(
        data.partnerCode === config.merchant &&
          data.requestId === data.orderId &&
          data.orderType === "momo_wallet",
        400,
        "PAYMENT_MISMATCH",
        "MoMo callback merchant or reference does not match.",
      );
      const code = Number(data.resultCode);
      requireThat(
        Number.isInteger(code),
        400,
        "INVALID_CALLBACK",
        "MoMo result code is invalid.",
      );
      const failed = [
        1001, 1002, 1003, 1004, 1005, 1006, 1007, 1017, 1026, 1080, 2001, 2007,
      ].includes(code);
      await applyPaymentResult(ctx, safeId(data.orderId), {
        provider: "MOMO",
        merchant_id: config.merchant,
        amount_vnd: parseVnd(data.amount),
        status: code === 0 ? "SUCCEEDED" : failed ? "FAILED" : "PENDING",
        provider_transaction_id: scalar(data.transId),
        provider_code: String(code),
      });
      res.status(204).end();
    }),
  );

  router.get(
    "/payments/vnpay/ipn",
    asyncRoute(async (req, res) => {
      const config = callbackConfiguration("VNPAY");
      const data: RecordData = {};
      for (const [key, value] of Object.entries(req.query)) {
        if (key.startsWith("vnp_")) data[key] = scalar(value); // Reject arrays and duplicated query keys.
      }
      if (!verifyVnpay(data, config.secret)) {
        res.json({ RspCode: "97", Message: "Invalid signature" });
        return;
      }
      if (
        data.vnp_TmnCode !== config.merchant ||
        (data.vnp_CurrCode && data.vnp_CurrCode !== "VND")
      ) {
        res.json({ RspCode: "97", Message: "Invalid merchant or currency" });
        return;
      }
      const rawAmount = data.vnp_Amount;
      requireThat(
        typeof rawAmount === "string" &&
          /^[1-9][0-9]{0,13}$/.test(rawAmount) &&
          Number.isSafeInteger(Number(rawAmount)) &&
          Number(rawAmount) % 100 === 0,
        400,
        "INVALID_AMOUNT",
        "Invalid VNPay amount.",
      );
      const code = scalar(data.vnp_ResponseCode);
      const status = scalar(data.vnp_TransactionStatus);
      const charged =
        (code === "00" && status === "00") || code === "07" || status === "07";
      await applyPaymentResult(ctx, safeId(data.vnp_TxnRef), {
        provider: "VNPAY",
        merchant_id: config.merchant,
        amount_vnd: parseVnd(Number(rawAmount) / 100),
        status: charged
          ? "SUCCEEDED"
          : ["02", "08", "11"].includes(status)
            ? "FAILED"
            : "PENDING",
        requires_review: code === "07" || status === "07",
        provider_transaction_id: scalar(data.vnp_TransactionNo),
        provider_code: `${code}:${status}`,
      });
      res.json({ RspCode: "00", Message: "Confirmed" });
    }),
  );

  router.post(
    "/admin/payments/:id/refund",
    asyncRoute(async (req, res) => {
      const admin = actor(res, ["ADMIN"]);
      const reason = req.body?.reason;
      requireThat(
        typeof reason === "string" &&
          reason.trim().length >= 10 &&
          reason.length <= 500,
        400,
        "REFUND_REASON_REQUIRED",
        "Provide a refund reason of 10–500 characters.",
      );
      requireThat(
        req.body?.amount_vnd === undefined,
        400,
        "FULL_REFUND_ONLY",
        "This endpoint refunds the complete confirmed charge; do not supply an amount.",
      );
      res
        .status(202)
        .json({
          data: await createRefund(
            ctx,
            safeId(req.params.id),
            admin,
            reason.trim(),
          ),
        });
    }),
  );

  router.post(
    "/admin/payments/:id/reconcile",
    asyncRoute(async (req, res) => {
      actor(res, ["ADMIN"]);
      const id = safeId(req.params.id);
      const snapshot = await ctx.db.collection("payments").doc(id).get();
      requireThat(
        snapshot.exists,
        404,
        "PAYMENT_NOT_FOUND",
        "Payment does not exist.",
      );
      const payment = docData(snapshot);
      const config = configuration(payment.provider, ctx);
      const result = await queryProvider(payment, config);
      res.json({
        data: publicPayment(await applyPaymentResult(ctx, id, result)),
      });
    }),
  );

  if (ctx.emulator)
    router.post(
      "/emulator/payments/:id/result",
      asyncRoute(async (req, res) => {
        actor(res, ["ADMIN"]);
        const id = safeId(req.params.id);
        const snapshot = await ctx.db.collection("payments").doc(id).get();
        requireThat(
          snapshot.exists,
          404,
          "PAYMENT_NOT_FOUND",
          "Payment does not exist.",
        );
        const payment = docData(snapshot);
        requireThat(
          payment.provider === "EMULATOR",
          403,
          "EMULATOR_ONLY",
          "This route can only settle EMULATOR payments.",
        );
        const status = req.body?.status;
        requireThat(
          status === "SUCCEEDED" || status === "FAILED" || status === "PENDING",
          400,
          "INVALID_STATUS",
          "Choose SUCCEEDED, FAILED or PENDING.",
        );
        res.json({
          data: publicPayment(
            await applyPaymentResult(ctx, id, {
              provider: "EMULATOR",
              merchant_id: "firebase-emulator",
              amount_vnd: payment.amount_vnd,
              status,
              provider_transaction_id: `emu_${id}`,
              provider_code: `EMULATOR_${status}`,
            }),
          ),
        });
      }),
    );
}
