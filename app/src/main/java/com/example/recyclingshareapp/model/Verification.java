package com.example.recyclingshareapp.model;

/**
 * Hồ sơ xác minh dùng chung cho cả người mua và người bán.
 */
public final class Verification {
    public String id; // mã hồ sơ
    public String userId; // tài khoản được xác minh
    public String status; // PENDING, VERIFIED, REJECTED hoặc EXPIRED
    public String submittedAt; // thời điểm nộp
    public String reviewerId; // người duyệt
    public String reviewedAt; // thời điểm duyệt
    public String expiresAt; // thời điểm hết hạn, nếu có
    public String reason; // lý do từ chối hoặc ghi chú duyệt
}
