package com.example.recyclingshareapp.model;

/**
 * Một tin nhắn trong hội thoại.
 * Có thể kèm một bài viết hoặc mẹo để chia sẻ nhanh.
 */
public final class Message {
    public String id; // mã tin nhắn
    public String conversationId; // hội thoại chứa tin
    public String senderId; // người gửi
    public String body; // nội dung chữ
    public String contentId; // bài được đính kèm, nếu có
    public String contentKind; // POST hoặc TIP khi có đính kèm
    public String sentAt; // thời điểm gửi
    public String readAt; // thời điểm người nhận đã đọc
}
