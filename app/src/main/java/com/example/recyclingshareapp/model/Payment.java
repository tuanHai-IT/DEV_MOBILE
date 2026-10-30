package com.example.recyclingshareapp.model;

/**
 * Một lần thanh toán hoặc hoàn tiền qua MoMo hay VNPay.
 * Số tiền là số nguyên VND.
 */
public final class Payment {
    public String id; // mã giao dịch nội bộ
    public String orderId; // đơn được thanh toán
    public String parentPaymentId; // giao dịch gốc khi đây là khoản hoàn
    public String kind; // CHARGE hoặc REFUND
    public String provider; // MOMO hoặc VNPAY
    public String providerRef; // mã giao dịch phía cổng
    public String idempotencyKey; // khóa chống tạo trùng giao dịch
    public long amountVnd; // số tiền, VND
    public String currency; // luôn là VND
    public String status; // PENDING, SUCCEEDED, FAILED hoặc CANCELLED
    public String createdAt; // thời điểm tạo
    public String confirmedAt; // thời điểm cổng xác nhận
}
