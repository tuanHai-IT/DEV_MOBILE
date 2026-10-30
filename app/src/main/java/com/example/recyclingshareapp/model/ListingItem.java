package com.example.recyclingshareapp.model;

/**
 * Một sản phẩm nằm trong tin đăng.
 * Giá lưu bằng số nguyên VND.
 */
public final class ListingItem {
    public String id; // mã sản phẩm
    public String listingId; // tin đăng chứa sản phẩm
    public String categoryId; // danh mục vật liệu
    public String name; // tên sản phẩm
    public String material; // chất liệu
    public String condition; // tình trạng đồ
    public long priceVnd; // đơn giá, đơn vị VND
    public long stock; // số lượng còn bán
    public String unit; // đơn vị tính
}
