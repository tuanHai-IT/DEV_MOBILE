package com.example.recyclingshareapp.model;

/**
 * Bài chia sẻ, mẹo, ảnh quét và các nội dung cộng đồng khác.
 */
public final class ContentEntry {
    public String id; // mã nội dung
    public String authorId; // người đăng
    public String parentId; // nội dung cha, nếu có
    public String kind; // loại bài: POST, TIP, SCAN, ARTICLE, ...
    public String title; // tiêu đề
    public String body; // nội dung chính
    public String status; // DRAFT, PUBLISHED, HIDDEN, PRIVATE hoặc ARCHIVED
    public String startsAt; // thời điểm bắt đầu, dùng cho sự kiện
    public String endsAt; // thời điểm kết thúc
    public long pointsCost; // điểm cần để đổi thưởng, 0 nếu không phải phần thưởng
    public String metadataJson; // dữ liệu phụ theo từng loại bài
}
