package com.example.recyclingshareapp.model;

/** Tương tác, kết bạn, lịch sử và thông báo. Generated from docs/domain-model.json; amounts are integer VND. */
public final class Interaction {
    public String id;
    public String userId;
    public String type;
    public String listingId;
    public String contentId;
    public String targetUserId;
    public String parentCommentId;
    public Long likeCount;
    public String body;
    public String readAt;
    public String createdAt;
}
