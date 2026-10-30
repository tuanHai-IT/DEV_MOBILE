package com.example.recyclingshareapp.model;

/**
 * Ảnh, video hoặc tài liệu đính kèm.
 * Mỗi tệp chỉ gắn với một đối tượng: tin, tin nhắn, bài viết, báo cáo hoặc hồ sơ xác minh.
 */
public final class MediaAsset {
    public String id; // mã tệp
    public String uploaderId; // người tải lên
    public String storageKey; // khóa lưu trên kho tệp
    public String mimeType; // kiểu nội dung
    public String visibility; // PUBLIC hoặc PRIVATE
    public String listingId; // tin đăng đính kèm
    public String messageId; // tin nhắn đính kèm
    public String contentId; // bài viết đính kèm
    public String reportId; // báo cáo đính kèm
    public String verificationId; // hồ sơ xác minh đính kèm
}
