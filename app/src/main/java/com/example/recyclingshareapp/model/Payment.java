package com.example.recyclingshareapp.model;

/** Lần thanh toán/hoàn tiền qua cổng. Generated from docs/domain-model.json; amounts are integer VND. */
public final class Payment {
    public String id;
    public String orderId;
    public String parentPaymentId;
    public String kind;
    public String provider;
    public String providerRef;
    public String idempotencyKey;
    public long amountVnd;
    public String currency;
    public String status;
    public String createdAt;
    public String confirmedAt;
}
