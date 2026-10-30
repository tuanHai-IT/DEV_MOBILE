package com.example.recyclingshareapp.model;

/**
 * Tương tác trên tin đăng và bài viết: thích, bình luận, theo dõi, thông báo.
 */
public final class Interaction {
    public String id; // mã tương tác
    public String userId; // người thực hiện
    public String type; // LIKE, COMMENT, SAVE, FOLLOW, NOTIFICATION, ...
    public String listingId; // tin đăng được tương tác
    public String contentId; // bài viết được tương tác
    public String targetUserId; // người nhận, dùng khi theo dõi hoặc kết bạn
    public String parentCommentId; // bình luận cha khi trả lời
    public Long likeCount; // số lượt thích của bình luận
    public String body; // nội dung bình luận
    public String readAt; // thời điểm đã đọc thông báo
    public String createdAt; // thời điểm tạo
}
