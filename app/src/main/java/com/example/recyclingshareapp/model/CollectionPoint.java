package com.example.recyclingshareapp.model;

/**
 * Điểm thu gom và đơn vị phụ trách.
 */
public final class CollectionPoint {
    public String id; // mã điểm thu gom
    public String managerId; // người quản lý điểm
    public String name; // tên điểm
    public String address; // địa chỉ hiển thị
    public double latitude; // vĩ độ, từ -90 đến 90
    public double longitude; // kinh độ, từ -180 đến 180
    public String materials; // loại vật liệu nhận
    public String openingHours; // giờ mở cửa
    public String status; // ACTIVE hoặc INACTIVE
}
