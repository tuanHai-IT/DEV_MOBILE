package com.example.recyclingshareapp.model;

/** Chốt giá & số lượng tại lúc mua. Generated from docs/domain-model.json; amounts are integer VND. */
public final class OrderItem {
    public String id;
    public String orderId;
    public String listingItemId;
    public String titleSnapshot;
    public long quantity;
    public long unitPriceVnd;
}
