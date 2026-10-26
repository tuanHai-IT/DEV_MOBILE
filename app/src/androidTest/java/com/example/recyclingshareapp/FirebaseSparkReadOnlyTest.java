package com.example.recyclingshareapp;

import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.example.recyclingshareapp.data.remote.FirebaseBackendClient;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Assume;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

/** Explicit opt-in, read-only cloud checks. Never signs in or writes to the cloud database. */
@RunWith(AndroidJUnit4.class)
public class FirebaseSparkReadOnlyTest {
    @Test public void publicCloudFeedsKeepLoadingAfterIdleConnections() throws Exception {
        Assume.assumeTrue("Requires the local Spark backend; only public reads are performed",
                "true".equals(InstrumentationRegistry.getArguments().getString("ecoshareCloudReadOnly")));
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        if (android.os.Build.VERSION.SDK_INT >= 37) {
            InstrumentationRegistry.getInstrumentation().getUiAutomation().grantRuntimePermission(
                    context.getPackageName(), "android.permission.ACCESS_LOCAL_NETWORK");
        }
        try (FirebaseBackendClient client = FirebaseBackendClient.forSparkLocal(context)) {
            assertTrue(client.isSparkLocal());
            // The debug app may already have a persisted login. Public checks never
            // send credentials; the optional /me check only reads that user's profile.
            boolean sessionWasRestored = client.isSignedIn();
            if (sessionWasRestored) {
                JSONObject profile = readProfile(client);
                assertTrue("A saved login must still load its own profile", profile.has("id"));
            }
            JSONObject health = read(client, "/health");
            assertEquals("recycling-share-app", health.getString("project_id"));
            assertFalse(health.getBoolean("emulator"));
            for (int round = 0; round < 3; round++) {
                if (round > 0) Thread.sleep(6500);
                for (String path : new String[]{"/tips", "/posts"}) {
                    JSONArray entries = read(client, path).getJSONArray("items");
                    for (int i = 0; i < entries.length(); i++) {
                        assertEquals(path.equals("/tips") ? "TIP" : "POST", entries.getJSONObject(i).getString("kind"));
                    }
                    System.out.println("Spark public read round=" + round + " route=" + path + " items=" + entries.length());
                }
            }
            assertEquals("Read-only cloud checks must not change the app session",
                    sessionWasRestored, client.isSignedIn());
        }
    }

    private JSONObject read(FirebaseBackendClient client, String path) throws Exception {
        CountDownLatch complete = new CountDownLatch(1);
        AtomicReference<JSONObject> result = new AtomicReference<>();
        AtomicReference<FirebaseBackendClient.BackendException> failure = new AtomicReference<>();
        client.getPublic(path, new FirebaseBackendClient.Callback<JSONObject>() {
            @Override public void onSuccess(JSONObject value) { result.set(value); complete.countDown(); }
            @Override public void onError(FirebaseBackendClient.BackendException error) { failure.set(error); complete.countDown(); }
        });
        assertTrue("Public Spark read timed out", complete.await(50, TimeUnit.SECONDS));
        if (failure.get() != null) throw failure.get();
        return result.get();
    }

    private JSONObject readProfile(FirebaseBackendClient client) throws Exception {
        CountDownLatch complete = new CountDownLatch(1);
        AtomicReference<JSONObject> result = new AtomicReference<>();
        AtomicReference<FirebaseBackendClient.BackendException> failure = new AtomicReference<>();
        client.getMe(new FirebaseBackendClient.Callback<JSONObject>() {
            @Override public void onSuccess(JSONObject value) { result.set(value); complete.countDown(); }
            @Override public void onError(FirebaseBackendClient.BackendException error) { failure.set(error); complete.countDown(); }
        });
        assertTrue("Saved account profile request timed out", complete.await(50, TimeUnit.SECONDS));
        if (failure.get() != null) throw failure.get();
        return result.get();
    }
}
