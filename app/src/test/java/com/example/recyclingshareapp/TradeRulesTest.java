package com.example.recyclingshareapp;
import com.example.recyclingshareapp.data.TradeRules;
import org.junit.Test;
import static org.junit.Assert.*;
public class TradeRulesTest {
    @Test public void bothPartiesMustBeVerified() {
        for (String status : new String[]{"UNVERIFIED", "PENDING", "REJECTED", "EXPIRED"}) {
            assertThrows(IllegalStateException.class, () -> TradeRules.requireVerified(status, "VERIFIED", "b", "s"));
            assertThrows(IllegalStateException.class, () -> TradeRules.requireVerified("VERIFIED", status, "b", "s"));
        }
        TradeRules.requireVerified("VERIFIED", "VERIFIED", "b", "s");
        assertThrows(IllegalStateException.class, () -> TradeRules.requireVerified("VERIFIED", "VERIFIED", "same", "same"));
    }
    @Test public void paymentCannotReviveCancelledOrders() {
        assertEquals("PAID", TradeRules.paymentResult("PENDING_PAYMENT", "success"));
        assertEquals("PENDING_PAYMENT", TradeRules.paymentResult("PENDING_PAYMENT", "pending"));
        assertEquals("PENDING_PAYMENT", TradeRules.paymentResult("PENDING_PAYMENT", "failed"));
        assertThrows(IllegalStateException.class, () -> TradeRules.paymentResult("CANCELLED", "success"));
        assertThrows(IllegalStateException.class, () -> TradeRules.paymentResult("PAID", "success"));
    }
}
