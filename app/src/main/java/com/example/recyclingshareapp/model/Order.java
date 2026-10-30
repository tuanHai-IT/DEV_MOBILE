package com.example.recyclingshareapp.model;

/**
 * Đơn mua bán giữa một người mua và một người bán.
 * Tổng tiền bằng tạm tính cộng phí vận chuyển, tính bằng VND.
 */
public final class Order {
    public String id; // mã đơn
    public String buyerId; // người mua
    public String sellerId; // người bán
    public String addressId; // địa chỉ giao hàng đã chọn
    public String deliverySnapshot; // bản sao địa chỉ tại lúc đặt
    public String status; // PENDING_PAYMENT, PAID, SHIPPED, COMPLETED, ...
    public long subtotalVnd; // tạm tính, VND
    public long shippingVnd; // phí vận chuyển, VND
    public long totalVnd; // tổng thanh toán, VND
    public String createdAt; // thời điểm tạo đơn
    public String completedAt; // thời điểm hoàn tất
}
