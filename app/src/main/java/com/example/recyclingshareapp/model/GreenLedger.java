package com.example.recyclingshareapp.model;

/**
 * Sổ điểm xanh của người dùng.
 * Khóa chống trùng giúp một việc không bị cộng điểm hai lần.
 */
public final class GreenLedger {
    public String id; // mã dòng điểm
    public String userId; // người được cộng hoặc trừ điểm
    public String orderId; // đơn hàng liên quan, nếu có
    public String contentId; // nội dung liên quan, nếu có
    public long points; // số điểm, khác 0
    public String reason; // lý do thay đổi điểm
    public String dedupeKey; // khóa chống cộng trùng
    public String createdAt; // thời điểm ghi sổ
}
