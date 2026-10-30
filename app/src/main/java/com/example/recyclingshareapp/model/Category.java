package com.example.recyclingshareapp.model;

/**
 * Danh mục dùng để phân loại sản phẩm tái chế.
 */
public final class Category {
    public String id; // mã danh mục
    public String name; // tên danh mục, không trùng
    public String description; // mô tả ngắn
    public long active; // 1 khi danh mục đang được bán
}
