import { z } from "zod";
import { requireThat } from "./core.js";

const holder = z.string().trim().min(2).max(100);
const bankAccount = z.object({
  method: z.literal("BANK"),
  bank_name: z.string().trim().min(2).max(100),
  account_number: z.string().trim().regex(/^[0-9]{6,30}$/),
  account_holder: holder,
}).strict();
const momoAccount = z.object({
  method: z.literal("MOMO"),
  phone: z.string().trim()
    .regex(/^(?:0[0-9]{9}|\+?84[0-9]{9})$/)
    .transform((value) => value.startsWith("0") ? value : `0${value.replace(/^\+?84/, "")}`),
  account_holder: holder,
}).strict();

/** This records a seller declaration; it does not verify account ownership. */
export const payoutAccountSchema = z.discriminatedUnion("method", [bankAccount, momoAccount]);
const savedSchema = z.discriminatedUnion("method", [
  bankAccount.extend({ updated_at: z.string().datetime({ offset: true }) }),
  momoAccount.extend({ updated_at: z.string().datetime({ offset: true }) }),
]);

export function savedPayoutAccount(value: unknown) {
  const parsed = savedSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function payoutAccountReady(value: unknown): boolean {
  return savedPayoutAccount(value) !== null;
}

export function requirePayoutAccount(user: Record<string, unknown>): void {
  requireThat(
    payoutAccountReady(user._payout_account),
    403,
    "PAYOUT_ACCOUNT_REQUIRED",
    "Vui lòng khai báo tài khoản nhận tiền ngân hàng hoặc MoMo trước khi đăng bán.",
  );
}

/** Private payout details stay out of all general administrator user responses. */
export function userWithoutPayoutAccount(user: Record<string, any>) {
  return Object.fromEntries(Object.entries(user).filter(([key]) => key !== "_payout_account"));
}
