package com.example.recyclingshareapp.model;

/**
 * Địa chỉ giao nhận gắn với một tài khoản.
 * Một người dùng có thể lưu nhiều địa chỉ và chọn một địa chỉ mặc định.
 */
public final class Address {
    public String id; // mã địa chỉ
    public String userId; // chủ địa chỉ
    public String recipient; // tên người nhận hàng
    public String phone; // số điện thoại liên hệ
    public String line; // số nhà và tên đường
    public String city; // tỉnh hoặc thành phố
    public long isDefault; // 1 khi đây là địa chỉ mặc định
}
