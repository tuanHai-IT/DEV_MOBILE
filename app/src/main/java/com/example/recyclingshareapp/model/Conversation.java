package com.example.recyclingshareapp.model;

/**
 * Hội thoại giữa đúng hai thành viên, có thể gắn với một đơn hàng.
 */
public final class Conversation {
    public String id; // mã hội thoại
    public String memberAId; // thành viên thứ nhất
    public String memberBId; // thành viên thứ hai
    public String orderId; // đơn hàng liên quan, nếu có
    public String createdAt; // thời điểm mở hội thoại
}
