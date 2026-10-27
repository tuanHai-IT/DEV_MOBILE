package com.example.recyclingshareapp.model;

/** Đánh giá sau đơn hoàn tất. Generated from docs/domain-model.json; amounts are integer VND. */
public final class Review {
    public String id;
    public String orderId;
    public String authorId;
    public String targetUserId;
    public long rating;
    public String body;
    public String createdAt;
}
