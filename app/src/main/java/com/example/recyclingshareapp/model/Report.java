package com.example.recyclingshareapp.model;

/**
 * Báo cáo vi phạm hoặc tranh chấp.
 * Mỗi báo cáo chỉ nhắm một đối tượng: tin, bài viết, người dùng hoặc đơn hàng.
 */
public final class Report {
    public String id; // mã báo cáo
    public String reporterId; // người gửi báo cáo
    public String listingId; // tin bị báo cáo
    public String contentId; // bài viết bị báo cáo
    public String targetUserId; // người bị báo cáo
    public String orderId; // đơn đang tranh chấp
    public String reason; // nội dung tố cáo
    public String status; // OPEN, IN_REVIEW, RESOLVED hoặc DISMISSED
    public String resolverId; // người xử lý
    public String resolution; // kết luận xử lý
    public String createdAt; // thời điểm gửi
}
