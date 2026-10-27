package com.example.recyclingshareapp.model;

/** Nhật ký thao tác quản trị. Generated from docs/domain-model.json; amounts are integer VND. */
public final class AuditLog {
    public String id;
    public String actorId;
    public String action;
    public String entityType;
    public String entityId;
    public String reason;
    public String createdAt;
}
