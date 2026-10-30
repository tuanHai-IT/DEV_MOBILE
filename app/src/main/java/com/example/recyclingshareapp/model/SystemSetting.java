package com.example.recyclingshareapp.model;

/**
 * Cấu hình hệ thống và thông tin hiển thị theo vai trò.
 */
public final class SystemSetting {
    public String id; // mã bản ghi cấu hình
    public String key; // tên khóa, không trùng
    public String valueJson; // giá trị lưu dạng JSON
    public String updatedBy; // người sửa gần nhất
    public String updatedAt; // thời điểm sửa gần nhất
}
