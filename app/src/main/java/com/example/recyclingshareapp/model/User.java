package com.example.recyclingshareapp.model;

/**
 * Tài khoản người dùng, gồm vai trò và trạng thái hoạt động.
 * Vai trò gồm MEMBER, COLLECTOR, MODERATOR và ADMIN.
 */
public final class User {
    public String id; // mã tài khoản
    public String displayName; // tên hiển thị
    public String email; // email đăng nhập, không trùng
    public String role; // vai trò trong hệ thống
    public String status; // ACTIVE hoặc SUSPENDED
    public String phone; // số điện thoại
    public String bio; // giới thiệu ngắn
    public String city; // thành phố sinh hoạt
    public String avatarKey; // khóa ảnh đại diện
    public String coverKey; // khóa ảnh bìa
    public String createdAt; // thời điểm tạo tài khoản
}
