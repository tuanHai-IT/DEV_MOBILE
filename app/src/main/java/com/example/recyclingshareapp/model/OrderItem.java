package com.example.recyclingshareapp.model;

/**
 * Dòng hàng trong đơn.
 * Giá và tên được chốt tại thời điểm mua, không đổi theo tin đăng sau đó.
 */
public final class OrderItem {
    public String id; // mã dòng hàng
    public String orderId; // đơn chứa dòng này
    public String listingItemId; // sản phẩm gốc trong tin đăng
    public String titleSnapshot; // tên sản phẩm tại lúc mua
    public long quantity; // số lượng
    public long unitPriceVnd; // đơn giá đã chốt, VND
}
