package com.example.recyclingshareapp.model;

/** Tin bán đồ cũ; COMMUNITY giữ tương thích. Generated from docs/domain-model.json; amounts are integer VND. */
public final class Listing {
    public String id;
    public String sellerId;
    public String kind;
    public String title;
    public String description;
    public String status;
    public String city;
    public Double latitude;
    public Double longitude;
    public String tagsJson;
    public String createdAt;
    public String moderatorId;
    public String moderationReason;
}
