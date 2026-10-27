package com.example.recyclingshareapp.model;

/** Bài chia sẻ, mẹo hay, SCAN và nội dung cộng đồng. Generated from docs/domain-model.json; amounts are integer VND. */
public final class ContentEntry {
    public String id;
    public String authorId;
    public String parentId;
    public String kind;
    public String title;
    public String body;
    public String status;
    public String startsAt;
    public String endsAt;
    public long pointsCost;
    public String metadataJson;
}
