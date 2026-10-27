package com.example.recyclingshareapp.model;

/** Đơn mua bán; một người bán mỗi đơn. Generated from docs/domain-model.json; amounts are integer VND. */
public final class Order {
    public String id;
    public String buyerId;
    public String sellerId;
    public String addressId;
    public String deliverySnapshot;
    public String status;
    public long subtotalVnd;
    public long shippingVnd;
    public long totalVnd;
    public String createdAt;
    public String completedAt;
}
