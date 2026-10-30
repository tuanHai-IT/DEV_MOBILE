package com.example.recyclingshareapp.model;

/**
 * Đánh giá sau khi đơn đã hoàn tất.
 * Mỗi người chỉ đánh giá một lần trên một đơn.
 */
public final class Review {
    public String id; // mã đánh giá
    public String orderId; // đơn được đánh giá
    public String authorId; // người viết đánh giá
    public String targetUserId; // người được đánh giá
    public long rating; // số sao từ 1 đến 5
    public String body; // nhận xét
    public String createdAt; // thời điểm gửi
}
