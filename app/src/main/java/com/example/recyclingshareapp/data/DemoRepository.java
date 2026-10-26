package com.example.recyclingshareapp.data;
import android.content.Context;
import android.content.SharedPreferences;

/** Local, synthetic data only. No identity documents or payment credentials are persisted. */
public final class DemoRepository {
    private final SharedPreferences state;
    public DemoRepository(Context context) { state = context.getSharedPreferences("ecoshare_demo_v1", Context.MODE_PRIVATE); }
    public String get(String key, String fallback) { return state.getString(key, fallback); }
    public void put(String key, String value) { state.edit().putString(key, value).apply(); }
    public String verification() { return get("verification", "UNVERIFIED"); }
    public int greenPoints() {
        try { return Math.max(0,Integer.parseInt(get("green_points","0"))); }
        catch (NumberFormatException invalidDemoData) { return 0; }
    }
    public String orderStatus() { return get("order_status", "NONE"); }
    public boolean loggedIn() { return "yes".equals(get("logged_in", "no")); }
    public void login(boolean verified) {
        state.edit().clear().putString("logged_in", "yes").putString("verification", verified ? "VERIFIED" : "UNVERIFIED").apply();
    }
    public void verifyTrading() { TradeRules.requireVerified(verification(), get("seller_verification", "VERIFIED"), "buyer-demo", "seller-demo"); }
    public void createOrder(String delivery) {
        verifyTrading();
        if (!"NONE".equals(orderStatus()) && !"CANCELLED".equals(orderStatus())) throw new IllegalStateException("Đang có đơn mẫu. Mở đơn hiện tại để tiếp tục.");
        state.edit().putString("order_status", "PENDING_PAYMENT").putString("order_id", "ECO-" + System.currentTimeMillis())
                .putString("delivery", delivery).putString("payment_status", "UNPAID").putString("reviewed", "no").apply();
    }
    public void simulatePayment(String provider, String result) {
        verifyTrading(); String next = TradeRules.paymentResult(orderStatus(), result);
        state.edit().putString("order_status", next).putString("payment_provider", provider)
                .putString("payment_status", "success".equals(result) ? "SUCCEEDED" : "failed".equals(result) ? "FAILED" : "PENDING").apply();
    }
    public void ship() { TradeRules.requireStatus(orderStatus(), "PAID"); put("order_status", "SHIPPED"); }
    public void complete() {
        TradeRules.requireStatus(orderStatus(), "SHIPPED");
        state.edit().putString("order_status", "COMPLETED").putString("green_points", String.valueOf(greenPoints()+10)).apply();
    }
    public void cancel() {
        TradeRules.requireStatus(orderStatus(), "PENDING_PAYMENT");
        if ("PENDING".equals(get("payment_status", ""))) throw new IllegalStateException("Cổng đang xử lý. Cần đối soát trước khi hủy đơn.");
        put("order_status", "CANCELLED");
    }
    public void dispute(String reason) {
        if (!"PAID".equals(orderStatus()) && !"SHIPPED".equals(orderStatus()) && !"COMPLETED".equals(orderStatus())) throw new IllegalStateException("Chỉ khiếu nại đơn đã thanh toán.");
        state.edit().putString("order_status", "DISPUTED").putString("report", reason).putString("report_state", "OPEN").apply();
    }
}
