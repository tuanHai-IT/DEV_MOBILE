package com.example.recyclingshareapp.model;

/**
 * Nhật ký thao tác của quản trị viên.
 * Bản ghi chỉ được thêm mới, không cập nhật và không xóa.
 */
public final class AuditLog {
    public String id; // mã nhật ký
    public String actorId; // người thực hiện thao tác
    public String action; // hành động đã ghi
    public String entityType; // loại đối tượng bị tác động
    public String entityId; // mã đối tượng bị tác động
    public String reason; // lý do thao tác
    public String createdAt; // thời điểm ghi nhận
}
