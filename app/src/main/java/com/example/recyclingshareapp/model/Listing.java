package com.example.recyclingshareapp.model;

/**
 * Tin đăng bán đồ cũ.
 * Loại COMMUNITY được giữ để tương thích với dữ liệu cũ.
 */
public final class Listing {
    public String id; // mã tin đăng
    public String sellerId; // người đăng bán
    public String kind; // SALE hoặc COMMUNITY
    public String title; // tiêu đề tin
    public String description; // mô tả đồ cần bán hoặc cho
    public String status; // PENDING, APPROVED, REJECTED, HIDDEN hoặc SOLD
    public String city; // khu vực giao dịch
    public Double latitude; // vĩ độ, có thể bỏ trống
    public Double longitude; // kinh độ, có thể bỏ trống
    public String tagsJson; // danh sách thẻ, lưu dạng JSON
    public String createdAt; // thời điểm đăng
    public String moderatorId; // người duyệt tin
    public String moderationReason; // lý do duyệt hoặc từ chối
}
