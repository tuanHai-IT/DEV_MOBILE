import { readFile } from "node:fs/promises";
import { FieldValue } from "firebase-admin/firestore";
import { requireThat, sha, type Context } from "../src/core.js";

/** A repeatable, non-overwriting local fixture. Never creates users or content in a live project. */
export async function seedSocialDemo(ctx: Context): Promise<void> {
  requireThat(ctx.emulator && (process.env.GCLOUD_PROJECT ?? "").startsWith("demo-"), 400, "EMULATOR_ONLY", "Mẫu cộng đồng chỉ dành cho Emulator.");
  const now = ctx.now(), ago = (minutes: number) => new Date(Date.parse(now) - minutes * 60_000).toISOString();
  const rows: Record<string, Record<string, unknown>> = {};
  function content(id: string, kind: "POST" | "TIP" | "SCAN", author: string, title: string, body: string,
    materials: string[], weight: number | null, tags: string[], minutes: number) {
    rows[`content_entries/${id}`] = {id, kind, author_id: author, parent_id: null, title, body,
      materials, weight_kg: weight, tags, status: kind === "SCAN" ? "PRIVATE" : "PUBLISHED",
      like_count: 0, saved_count: 0, comment_count: 0, starts_at: null, ends_at: null, points_cost: 0,
      metadata_json: "{}", created_at: ago(minutes), updated_at: ago(minutes), _social: true, _seed: "social-v1"};
  }
  content("demo-post-planters", "POST", "demo-seller", "Một góc vườn từ những chiếc lon cũ",
    "Cuối tuần mình làm sạch lon thiếc, đục lỗ thoát nước và sơn lại để làm chậu treo. Vài vật dụng cũ đã thành một góc xanh mới. Bạn đã thử tái sử dụng lon ở nhà chưa?",
    ["Kim loại"], 1.5, ["DIY", "VườnXanh", "TáiSửDụng"], 30);
  content("demo-post-glass", "POST", "demo-buyer", "Chiếc chai thủy tinh có cuộc sống mới",
    "Mình giữ lại chai thủy tinh, rửa sạch rồi quấn thêm dây đay để làm lọ hoa. Một món trang trí nhỏ, không cần mua thêm bình mới. Mời mọi người góp ý cho góc nhà của mình!",
    ["Thủy tinh"], 0.8, ["Decor", "SốngXanh"], 90);
  content("demo-post-corks", "POST", "demo-seller", "Chuông gió từ nút chai",
    "Những nút chai cũ được xâu thành chuông gió cùng vài hạt trang trí còn dư. Mình dùng một lát gỗ nhỏ làm khung. Ai có thêm ý tưởng tái sử dụng nút chai thì bình luận nhé!",
    ["Gỗ", "Hỗn hợp"], 0.4, ["Handmade", "Upcycle"], 180);
  content("demo-tip-clean", "TIP", "demo-admin", "Làm sạch chai trước khi tái chế",
    "Đổ hết chất lỏng còn lại, súc nhẹ chai và để ráo. Tách vật liệu khác nhau nếu điểm thu gom yêu cầu. Không cho pin hay vật sắc nhọn vào cùng túi chai lọ.",
    ["Nhựa", "Thủy tinh"], null, ["PhânLoại", "MẹoHay"], 200);
  content("demo-tip-planters", "TIP", "demo-seller", "Tái sử dụng lon làm chậu cây",
    "Làm sạch lon và kiểm tra cạnh sắc. Nhờ người lớn làm phẳng mép, đục lỗ thoát nước rồi thêm đất. Chọn cây nhỏ và treo lon ở nơi chắc chắn, có ánh sáng phù hợp.",
    ["Kim loại"], null, ["DIY", "ChậuCây"], 250);
  content("demo-scan-bottle", "SCAN", "demo-buyer", "Ảnh SCAN thử nghiệm",
    "Ảnh đã được lưu trong Firebase Storage; bản ghi và quyền sở hữu nằm trong Firestore. Chỉ chủ ảnh và quản trị viên có quyền xem.",
    [], null, [], 10);
  for (const [id, itemId, title, body, material, price, stock, reserved] of [
    ["demo-planters", "demo-planters-item", "Bộ chậu treo từ lon tái sử dụng", "Ba chậu treo làm từ lon đã được xử lý cạnh, có lỗ thoát nước. Không kèm cây.", "Kim loại", 90000, 5, 0],
    ["demo-glass", "demo-glass-item", "Lọ hoa thủy tinh quấn dây đay", "Chai thủy tinh tái sử dụng đã làm sạch; phù hợp cắm hoa khô. Không kèm hoa.", "Thủy tinh", 35000, 7, 1],
    ["demo-corks", "demo-corks-item", "Chuông gió nút chai thủ công", "Đồ trang trí handmade từ nút chai và dây còn dư, dùng trong nhà.", "Gỗ", 60000, 4, 0],
  ] as const) {
    rows[`listings/${id}`] = {id, seller_id: "demo-seller", kind: "SALE", title, description: body,
      city: "TP.HCM", status: "APPROVED", tags_json: '["tái sử dụng","mẫu emulator"]', latitude: null, longitude: null,
      created_at: ago(300), updated_at: ago(300), moderator_id: "demo-admin", moderation_reason: "Dữ liệu kiểm thử Emulator", _seed: "social-v1"};
    rows[`listing_items/${itemId}`] = {id: itemId, listing_id: id, category_id: "reuse", name: title,
      material, condition: "GOOD", price_vnd: price, stock, _reserved: reserved, unit: "cái"};
  }
  const delivery = JSON.stringify({recipient: "Người mua mẫu", phone: "0900000000", line: "123 Đường Mẫu", city: "TP.HCM"});
  for (const [id, item, title, amount, status] of [
    ["demo-order-completed", "demo-corks-item", "Chuông gió nút chai thủ công", 60000, "COMPLETED"],
    ["demo-order-paid", "demo-glass-item", "Lọ hoa thủy tinh quấn dây đay", 35000, "PAID"],
  ] as const) {
    rows[`orders/${id}`] = {id, buyer_id: "demo-buyer", seller_id: "demo-seller", _member_ids: ["demo-buyer", "demo-seller"],
      address_id: "demo-buyer-home", delivery_snapshot: delivery, status, subtotal_vnd: amount, shipping_vnd: 0, total_vnd: amount,
      created_at: ago(400), completed_at: status === "COMPLETED" ? ago(300) : null, expires_at: ago(380),
      _reservation_state: "CONSUMED", _active_payment_id: `${id}-payment`, _points_awarded: status === "COMPLETED" ? 10 : 0,
      _request_hash: sha(id), _seed: "social-v1"};
    rows[`order_items/${id}-item`] = {id: `${id}-item`, order_id: id, listing_item_id: item, title_snapshot: title,
      quantity: 1, unit_price_vnd: amount, _member_ids: ["demo-buyer", "demo-seller"]};
    rows[`payments/${id}-payment`] = {id: `${id}-payment`, order_id: id, user_id: "demo-buyer", provider: "EMULATOR", kind: "CHARGE",
      amount_vnd: amount, currency: "VND", parent_payment_id: null, status: "SUCCEEDED", merchant_id: "firebase-emulator",
      provider_reference: `${id}-payment`, provider_transaction_id: `fixture-${id}`, pay_url: null,
      created_at: ago(399), updated_at: ago(399), paid_at: ago(399), _member_ids: ["demo-buyer", "demo-seller"], _seed: "social-v1"};
  }
  const friendId = sha("friend:demo-buyer:demo-seller");
  rows[`interactions/${friendId}`] = {id: friendId, type: "FRIEND_REQUEST", user_id: "demo-seller", target_user_id: "demo-buyer",
    _member_ids: ["demo-buyer", "demo-seller"], status: "PENDING", content_id: null, listing_id: null, body: null,
    created_at: ago(15), updated_at: ago(15), _social: true};
  rows["interactions/demo-notification-friend"] = {id: "demo-notification-friend", type: "NOTIFICATION", subtype: "FRIEND_REQUEST",
    user_id: "demo-buyer", target_user_id: "demo-seller", content_id: null, listing_id: null,
    body: "Người bán mẫu đã gửi lời mời kết bạn.", read_at: null, created_at: ago(15), _social: true};
  for (const [path, data] of Object.entries(rows)) {
    const ref = ctx.db.doc(path);
    await ctx.db.runTransaction(async (tx) => {if (!(await tx.get(ref)).exists) tx.create(ref, data);});
  }
  // The completed order fixture awards points exactly once, including repeat seed runs.
  const ledgerId = sha("completed:demo-order-completed:demo-buyer");
  await ctx.db.runTransaction(async (tx) => {
    const ref = ctx.db.collection("green_ledger").doc(ledgerId), previous = await tx.get(ref);
    const buyerRef = ctx.db.collection("users").doc("demo-buyer"), buyer = await tx.get(buyerRef);
    if (!previous.exists && buyer.exists) {
      tx.create(ref, {id: ledgerId, user_id: "demo-buyer", order_id: "demo-order-completed", points: 10,
        reason: "ORDER_COMPLETED", dedupe_key: "completed:demo-order-completed:demo-buyer", created_at: ago(300)});
      tx.update(buyerRef, {points_balance: FieldValue.increment(10)});
    }
  });
  // These bytes are fixture assets kept locally, then uploaded into Storage. The
  // app fetches them through the real media API and never hardcodes their URLs.
  for (const [id, kind, parentId, owner, filename] of [
    ["demo-photo-planters", "CONTENT", "demo-post-planters", "demo-seller", "reuse-plants.jpg"],
    ["demo-photo-glass", "CONTENT", "demo-post-glass", "demo-buyer", "reuse-glass.jpg"],
    ["demo-photo-corks", "CONTENT", "demo-post-corks", "demo-seller", "reuse-corks.jpg"],
    ["demo-photo-tip", "CONTENT", "demo-tip-planters", "demo-seller", "reuse-plants.jpg"],
    ["demo-photo-tip-clean", "CONTENT", "demo-tip-clean", "demo-admin", "reuse-glass.jpg"],
    ["demo-photo-scan", "SCAN", "demo-scan-bottle", "demo-buyer", "reuse-glass.jpg"],
    ["demo-photo-market-planters", "LISTING", "demo-planters", "demo-seller", "reuse-plants.jpg"],
    ["demo-photo-market-glass", "LISTING", "demo-glass", "demo-seller", "reuse-glass.jpg"],
    ["demo-photo-market-corks", "LISTING", "demo-corks", "demo-seller", "reuse-corks.jpg"],
  ] as const) {
    const ref = ctx.db.collection("media_assets").doc(id);
    if ((await ref.get()).exists) continue;
    const bytes = await readFile(new URL(`../../fixtures/${filename}`, import.meta.url));
    requireThat(bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255, 500, "INVALID_FIXTURE", "Ảnh mẫu không phải JPEG.");
    const storageKey = `uploads/${owner}/${id}/original`;
    await ctx.bucket.file(storageKey).save(bytes, {resumable: false, metadata: {
      contentType: "image/jpeg", cacheControl: "private, no-store", metadata: {},
    }});
    await ref.create({id, uploader_id: owner, storage_key: storageKey, mime_type: "image/jpeg", visibility: kind === "SCAN" ? "PRIVATE" : "PUBLIC",
      listing_id: kind === "LISTING" ? parentId : null, content_id: kind !== "LISTING" ? parentId : null,
      message_id: null, report_id: null, verification_id: null, _parent_type: kind, _parent_id: parentId,
      _status: "READY", _max_bytes: 10 * 1024 * 1024, size_bytes: bytes.length, created_at: now, completed_at: now, _seed: "social-v1"});
  }
  console.log("Đã bổ sung 3 bài chia sẻ, 2 mẹo, 3 bài bán hàng, 2 đơn, 1 SCAN riêng tư và ảnh Storage. Chỉ tạo bản ghi còn thiếu; giữ nguyên nội dung đã sửa trên Admin.");
}
