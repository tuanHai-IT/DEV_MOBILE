package com.example.recyclingshareapp.data;

/** Client demo guards. The production server must enforce the same invariants. */
public final class TradeRules {
    private TradeRules() { }
    public static void requireVerified(String buyerStatus, String sellerStatus, String buyer, String seller) {
        if (buyer.equals(seller)) throw new IllegalStateException("Không thể mua sản phẩm của chính mình.");
        if (!"VERIFIED".equals(buyerStatus) || !"VERIFIED".equals(sellerStatus))
            throw new IllegalStateException("Cả người mua và người bán phải được xác minh trước khi giao dịch.");
    }
    public static String paymentResult(String orderStatus, String result) {
        requireStatus(orderStatus, "PENDING_PAYMENT");
        if ("success".equals(result)) return "PAID";
        if ("failed".equals(result) || "pending".equals(result)) return "PENDING_PAYMENT";
        throw new IllegalArgumentException("Kết quả thanh toán không hợp lệ.");
    }
    public static void requireStatus(String actual, String expected) {
        if (!expected.equals(actual)) throw new IllegalStateException("Không thể thực hiện với trạng thái: " + actual);
    }
}
