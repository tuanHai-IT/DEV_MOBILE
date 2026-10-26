package com.example.recyclingshareapp;

import android.os.Looper;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.example.recyclingshareapp.data.remote.BackendSession;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

/** Profile updates are local observer behavior; this test never opens a backend connection. */
@RunWith(AndroidJUnit4.class)
public class BackendSessionProfileTest {
    @After public void clear() { BackendSession.signOut(); }

    @Test public void pointsObserversReceiveDetachedMainThreadSnapshotsAndSignOutClearsBalance() throws Exception {
        CountDownLatch updated = new CountDownLatch(1), cleared = new CountDownLatch(1);
        AtomicReference<JSONObject> received = new AtomicReference<>();
        AtomicBoolean onMain = new AtomicBoolean(true);
        BackendSession.ProfileListener listener = value -> {
            onMain.compareAndSet(true, Looper.myLooper() == Looper.getMainLooper());
            received.set(value);
            if (value != null && value.optLong("points_balance") == 1240) updated.countDown();
            if (value == null || value.length() == 0) cleared.countDown();
        };
        BackendSession.addProfileListener(listener);
        try {
            Thread writer = new Thread(() -> {
                try { BackendSession.setProfile(new JSONObject().put("id", "member-one").put("points_balance", 1240)); }
                catch (Exception error) { throw new AssertionError(error); }
            });
            writer.start();
            writer.join(5_000L);
            assertFalse("Profile writer should finish", writer.isAlive());
            assertTrue("Profile listener should receive points", updated.await(5, TimeUnit.SECONDS));
            assertTrue("Listener must run on the main thread", onMain.get());
            assertEquals(1240, BackendSession.profile().optLong("points_balance"));

            received.get().put("points_balance", 999);
            assertEquals("The banner cannot mutate session data", 1240, BackendSession.profile().optLong("points_balance"));

            BackendSession.signOut();
            assertTrue("Sign out should clear the visible points", cleared.await(5, TimeUnit.SECONDS));
            assertEquals(0, BackendSession.profile().length());
            assertTrue(onMain.get());
        } finally {
            BackendSession.removeProfileListener(listener);
            InstrumentationRegistry.getInstrumentation().waitForIdleSync();
        }
    }
}
