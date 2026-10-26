package com.example.recyclingshareapp.data.remote;

import android.content.Context;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import com.example.recyclingshareapp.MainActivity;
import com.example.recyclingshareapp.R;
import com.example.recyclingshareapp.ui.CommunityFragment;

import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

import java.lang.reflect.Field;
import java.net.ConnectException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import okhttp3.Interceptor;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Protocol;
import okhttp3.Response;
import okhttp3.ResponseBody;

import static org.junit.Assert.*;

/** Public snapshots remain in SQLite after sign-out and private routes still require authentication. */
@RunWith(AndroidJUnit4.class)
public class OfflineGuestUiTest {
    private static final String POST_PATH = "/posts?limit=3";
    private static final String TIP_PATH = "/tips?limit=3";
    private static final String POST_ID = "offline-guest-post";
    private static final String DETAIL_PATH = "/posts/" + POST_ID;
    private static final String COMMENTS_PATH = DETAIL_PATH + "/comments";
    private static final String POST_BODY = "Bài viết đã xem khi có mạng";
    private static final String DETAIL_BODY = "Chi tiết bài viết đã xem khi có mạng";
    private static final String COMMENT_BODY = "Bình luận đã xem khi có mạng";
    private static final String TIP_BODY = "Mẹo đã xem khi có mạng";

    private Context context;
    private String scope;
    private String oldPost;
    private String oldTip;
    private String oldDetail;
    private String oldComments;

    @Before public void setUp() throws Exception {
        context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        if (android.os.Build.VERSION.SDK_INT >= 37) {
            InstrumentationRegistry.getInstrumentation().getUiAutomation().grantRuntimePermission(
                    context.getPackageName(), "android.permission.ACCESS_LOCAL_NETWORK");
        }
        BackendSession.useMode(context, BackendSession.Mode.EMULATOR);
        FirebaseBackendClient online = BackendSession.get(context);
        scope = scope(online);
        try (OfflineSnapshotStore store = new OfflineSnapshotStore(context)) {
            oldPost = store.page(scope, POST_PATH);
            oldTip = store.page(scope, TIP_PATH);
            oldDetail = store.page(scope, DETAIL_PATH);
            oldComments = store.page(scope, COMMENTS_PATH);
        }
        intercept(online, chain -> {
            String path = chain.request().url().encodedPath();
            if (path.contains("accounts:signInWithPassword")) return json(chain,
                    "{\"localId\":\"offline-guest-account\",\"email\":\"offline@example.test\","
                            + "\"idToken\":\"test-token\",\"refreshToken\":\"test-refresh\",\"expiresIn\":\"3600\"}");
            if (path.endsWith("/posts")) return json(chain,
                    "{\"items\":[{\"id\":\"" + POST_ID + "\",\"kind\":\"POST\","
                            + "\"status\":\"PUBLISHED\",\"body\":\"" + POST_BODY + "\","
                            + "\"liked\":true,\"saved\":true,\"author\":{\"display_name\":\"Người thử\"}}],"
                            + "\"next_cursor\":null}");
            if (path.endsWith("/tips")) return json(chain,
                    "{\"items\":[{\"id\":\"offline-guest-tip\",\"kind\":\"TIP\","
                            + "\"status\":\"PUBLISHED\",\"body\":\"" + TIP_BODY + "\","
                            + "\"author\":{\"display_name\":\"Người thử\"}}],\"next_cursor\":null}");
            if (path.endsWith("/posts/" + POST_ID)) return json(chain,
                    "{\"id\":\"" + POST_ID + "\",\"kind\":\"POST\",\"status\":\"PUBLISHED\","
                            + "\"body\":\"" + DETAIL_BODY + "\",\"author\":{\"display_name\":\"Người thử\"}}");
            if (path.endsWith("/posts/" + POST_ID + "/comments")) return json(chain,
                    "{\"items\":[{\"id\":\"offline-comment\",\"body\":\"" + COMMENT_BODY + "\","
                            + "\"author\":{\"display_name\":\"Người bình luận\"}}],\"next_cursor\":null}");
            throw new AssertionError("Unexpected online fixture request: " + path);
        });
        OfflineGuestUiTest.<FirebaseBackendClient.SessionInfo>await(
                callback -> online.signIn("offline@example.test", "fixture-password", callback));
        assertTrue(BackendSession.isSignedIn());
        assertEquals(POST_ID, OfflineGuestUiTest.<JSONObject>await(
                callback -> online.request("GET", POST_PATH, null, null, callback))
                .getJSONArray("items").getJSONObject(0).getString("id"));
        assertEquals(TIP_BODY, OfflineGuestUiTest.<JSONObject>await(
                callback -> online.request("GET", TIP_PATH, null, null, callback))
                .getJSONArray("items").getJSONObject(0).getString("body"));
        assertEquals(DETAIL_BODY, OfflineGuestUiTest.<JSONObject>await(
                callback -> online.request("GET", DETAIL_PATH, null, null, callback)).getString("body"));
        assertEquals(COMMENT_BODY, OfflineGuestUiTest.<JSONObject>await(
                callback -> online.request("GET", COMMENTS_PATH, null, null, callback))
                .getJSONArray("items").getJSONObject(0).getString("body"));
        awaitSqliteSnapshots();

        BackendSession.signOut();
        // Recreate the client as a new process would; the only surviving data is SQLite.
        // Switching through cloud mode retires the mock-intercepted client so its online
        // fixture cannot answer the subsequent offline read.
        BackendSession.useMode(context, BackendSession.Mode.CLOUD_FUNCTIONS);
        BackendSession.useMode(context, BackendSession.Mode.EMULATOR);
        CommunityFragment.clearPagedSnapshots();
        FirebaseBackendClient offline = BackendSession.get(context);
        intercept(offline, chain -> { throw new ConnectException("offline fixture"); });
        assertFalse(BackendSession.isSignedIn());
    }

    @After public void tearDown() {
        BackendSession.signOut();
        BackendSession.useMode(context, BackendSession.Mode.EMULATOR);
        CommunityFragment.clearPagedSnapshots();
        if (scope == null) return;
        try (OfflineSnapshotStore store = new OfflineSnapshotStore(context)) {
            if (oldPost != null) store.putPage(scope, POST_PATH, oldPost);
            else store.getWritableDatabase().delete("pages", "scope=? AND route=?", new String[]{scope, POST_PATH});
            if (oldTip != null) store.putPage(scope, TIP_PATH, oldTip);
            else store.getWritableDatabase().delete("pages", "scope=? AND route=?", new String[]{scope, TIP_PATH});
            if (oldDetail != null) store.putPage(scope, DETAIL_PATH, oldDetail);
            else store.getWritableDatabase().delete("pages", "scope=? AND route=?", new String[]{scope, DETAIL_PATH});
            if (oldComments != null) store.putPage(scope, COMMENTS_PATH, oldComments);
            else store.getWritableDatabase().delete("pages", "scope=? AND route=?", new String[]{scope, COMMENTS_PATH});
        }
    }

    @Test public void viewedPublicFeedsStayCachedAndPrivateDataRequiresLogin() throws Exception {
        FirebaseBackendClient offline = BackendSession.get(context);
        JSONObject cached = await(callback -> offline.getPublic(POST_PATH, callback));
        JSONObject publicPost = cached.getJSONArray("items").getJSONObject(0);
        assertEquals(POST_BODY, publicPost.getString("body"));
        assertFalse("Account-specific LIKE must not survive logout", publicPost.has("liked"));
        assertFalse("Account-specific SAVE must not survive logout", publicPost.has("saved"));

        AtomicReference<FirebaseBackendClient.BackendException> privateError = new AtomicReference<>();
        CountDownLatch privateDone = new CountDownLatch(1);
        offline.request("GET", "/orders?limit=3", null, null, new FirebaseBackendClient.Callback<JSONObject>() {
            @Override public void onSuccess(JSONObject value) { privateDone.countDown(); }
            @Override public void onError(FirebaseBackendClient.BackendException error) {
                privateError.set(error);
                privateDone.countDown();
            }
        });
        assertTrue(privateDone.await(8, TimeUnit.SECONDS));
        assertNotNull("Private data must require a new login", privateError.get());
        assertEquals(401, privateError.get().httpStatus);

        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            waitFor(scenario, activity -> activity.findViewById(R.id.login_email) != null);
            scenario.onActivity(activity -> {
                assertFalse(BackendSession.isSignedIn());
                assertFalse("The removed public-content card must stay out of the login screen",
                        visibleText(activity.findViewById(R.id.screen_container)).contains("Xem nội dung công khai"));
            });
        }
    }

    private void awaitSqliteSnapshots() throws Exception {
        for (int i = 0; i < 40; i++) {
            try (OfflineSnapshotStore store = new OfflineSnapshotStore(context)) {
                if (store.page(scope, POST_PATH) != null && store.page(scope, TIP_PATH) != null
                        && store.page(scope, DETAIL_PATH) != null && store.page(scope, COMMENTS_PATH) != null) return;
            }
            Thread.sleep(50);
        }
        fail("Viewed public feeds were not written to SQLite");
    }

    private static String scope(FirebaseBackendClient client) throws Exception {
        Field field = FirebaseBackendClient.class.getDeclaredField("offlineScope");
        field.setAccessible(true);
        return (String) field.get(client);
    }

    private static void intercept(FirebaseBackendClient client, Interceptor interceptor) throws Exception {
        Field field = FirebaseBackendClient.class.getDeclaredField("http");
        field.setAccessible(true);
        OkHttpClient original = (OkHttpClient) field.get(client);
        field.set(client, original.newBuilder().addInterceptor(interceptor).build());
    }

    private static Response json(Interceptor.Chain chain, String body) {
        return new Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(200).message("OK")
                .body(ResponseBody.create(body, MediaType.get("application/json"))).build();
    }

    private interface Request<T> { void start(FirebaseBackendClient.Callback<T> callback); }

    private static <T> T await(Request<T> request) throws Exception {
        CountDownLatch done = new CountDownLatch(1);
        AtomicReference<T> value = new AtomicReference<>();
        AtomicReference<Exception> failure = new AtomicReference<>();
        request.start(new FirebaseBackendClient.Callback<T>() {
            @Override public void onSuccess(T response) { value.set(response); done.countDown(); }
            @Override public void onError(FirebaseBackendClient.BackendException error) { failure.set(error); done.countDown(); }
        });
        assertTrue("Fixture request timed out", done.await(8, TimeUnit.SECONDS));
        if (failure.get() != null) throw failure.get();
        return value.get();
    }

    private interface ActivityCheck { boolean matches(MainActivity activity); }

    private static void waitFor(ActivityScenario<MainActivity> scenario, ActivityCheck check) throws Exception {
        long deadline = android.os.SystemClock.elapsedRealtime() + 15_000L;
        while (android.os.SystemClock.elapsedRealtime() < deadline) {
            java.util.concurrent.atomic.AtomicBoolean matched = new java.util.concurrent.atomic.AtomicBoolean();
            scenario.onActivity(activity -> matched.set(check.matches(activity)));
            if (matched.get()) return;
            Thread.sleep(100);
        }
        fail("Expected offline guest UI did not appear");
    }

    private static String visibleText(View view) {
        if (view == null || view.getVisibility() != View.VISIBLE) return "";
        StringBuilder result = new StringBuilder();
        if (view instanceof TextView) result.append(((TextView) view).getText()).append('\n');
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) result.append(visibleText(group.getChildAt(i)));
        }
        return result.toString();
    }
}
