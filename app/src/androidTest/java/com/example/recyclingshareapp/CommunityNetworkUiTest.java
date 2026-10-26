package com.example.recyclingshareapp;

import android.widget.TextView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.example.recyclingshareapp.data.remote.BackendSession;
import com.example.recyclingshareapp.data.remote.FirebaseBackendClient;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.IOException;
import java.lang.reflect.Field;
import java.net.SocketTimeoutException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import okhttp3.Interceptor;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Protocol;
import okhttp3.Response;
import okhttp3.ResponseBody;
import static com.example.recyclingshareapp.CommunityTestSupport.*;
import static org.junit.Assert.*;

/** Real native error/retry behavior; Auth and non-fixture requests stay on the demo emulators. */
@RunWith(AndroidJUnit4.class)
public class CommunityNetworkUiTest {
    private CommunityTestSupport server;
    private Field httpField;
    private OkHttpClient originalHttp;

    @Before public void connect() throws Exception {
        server = new CommunityTestSupport();
        server.login("buyer@ecoshare.test");
        // Timeout UI requires an unseen page; a previous test's public SQLite
        // snapshot would correctly turn this timeout into an offline success.
        java.lang.reflect.Method clear = FirebaseBackendClient.class.getDeclaredMethod("invalidatePublicSnapshots");
        clear.setAccessible(true);
        clear.invoke(server.api);
        httpField = FirebaseBackendClient.class.getDeclaredField("http");
        httpField.setAccessible(true);
        originalHttp = (OkHttpClient) httpField.get(server.api);
    }

    @After public void restoreTransport() throws Exception {
        if (server == null) return;
        // newBuilder shares the pool/dispatcher. Restore ownership instead of closing either twice.
        if (originalHttp != null) httpField.set(server.api, originalHttp);
        BackendSession.signOut();
    }

    @Test public void inlineTimeoutExplainsFailureAndTapRetriesCurrentScreen() throws Exception {
        AtomicInteger tipsAttempts = new AtomicInteger();
        String body = "Mẹo kiểm thử: tái sử dụng lọ thủy tinh sau khi rửa sạch.";
        String tipJson = new JSONObject().put("items", new JSONArray().put(new JSONObject()
                .put("id", "network-ui-tip").put("kind", "TIP").put("body", body)
                .put("created_at", "2026-10-19T00:00:00.000Z")
                .put("author", new JSONObject().put("display_name", "Kiểm thử mạng"))
                .put("media", new JSONArray()))).toString();
        inject(chain -> {
            if (chain.request().url().encodedPath().endsWith("/tips")) {
                if (tipsAttempts.incrementAndGet() == 1) throw new SocketTimeoutException("fixture timeout");
                return jsonResponse(chain, tipJson);
            }
            return chain.proceed(chain.request());
        });
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> activity.openCommunity("explore", null, false));
            waitFor(scenario, activity -> visibleText(CommunityTestSupport.screenView(activity, R.id.community_body))
                    .contains("Máy chủ phản hồi chậm"));
            scenario.onActivity(activity -> {
                TextView notice = CommunityTestSupport.screenView(activity, R.id.community_body).findViewWithTag("loading");
                assertNotNull("The failure must remain available inline", notice);
                assertTrue(notice.isShown());
                assertTrue(notice.getText().toString().contains("Chạm để thử lại"));
                assertEquals("A timeout must wait for an explicit retry", 1, tipsAttempts.get());
                assertTrue(notice.performClick());
            });
            waitFor(scenario, activity -> visibleText(CommunityTestSupport.screenView(activity, R.id.community_body)).contains(body));
            scenario.onActivity(activity -> {
                assertEquals(2, tipsAttempts.get());
                assertNull(CommunityTestSupport.screenView(activity, R.id.community_body).findViewWithTag("loading"));
                assertFalse(visibleText(CommunityTestSupport.screenView(activity, R.id.community_body)).contains("Chưa tải được dữ liệu"));
                assertNotNull(CommunityTestSupport.screenView(activity, R.id.community_body).findViewWithTag("post:network-ui-tip"));
            });
        }
    }

    @Test public void lateFailureFromOldTabCannotReplaceCurrentMarketLoading() throws Exception {
        CountDownLatch tipsStarted = new CountDownLatch(1);
        CountDownLatch releaseTips = new CountDownLatch(1);
        CountDownLatch marketStarted = new CountDownLatch(1);
        CountDownLatch releaseMarket = new CountDownLatch(1);
        AtomicInteger tipsAttempts = new AtomicInteger();
        AtomicInteger marketAttempts = new AtomicInteger();
        inject(chain -> {
            String path = chain.request().url().encodedPath();
            if (path.endsWith("/tips")) {
                tipsAttempts.incrementAndGet();
                tipsStarted.countDown();
                awaitRelease(releaseTips);
                throw new SocketTimeoutException("old tips fixture timeout");
            }
            if (path.endsWith("/listings")) {
                marketAttempts.incrementAndGet();
                marketStarted.countDown();
                awaitRelease(releaseMarket);
                return jsonResponse(chain, "{\"items\":[]}");
            }
            return chain.proceed(chain.request());
        });
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            try {
                scenario.onActivity(activity -> activity.openCommunity("explore", null, false));
                assertTrue("Tips request did not start", tipsStarted.await(15, TimeUnit.SECONDS));
                scenario.onActivity(activity -> {
                    TextView tab = exactText(CommunityTestSupport.screenView(activity, R.id.community_body), "🧳 Trao đổi");
                    assertNotNull(tab);
                    tab.performClick();
                });
                // The worker is serial: queue the new tab before letting the old tab fail.
                releaseTips.countDown();
                assertTrue("Market request did not start", marketStarted.await(15, TimeUnit.SECONDS));
                InstrumentationRegistry.getInstrumentation().waitForIdleSync();
                scenario.onActivity(activity -> {
                    String current = visibleText(CommunityTestSupport.screenView(activity, R.id.community_body));
                    assertTrue("The new tab must retain its own loading state", current.contains("Đang tải…"));
                    assertFalse(current.contains("Chưa tải được dữ liệu"));
                    assertFalse(current.contains("Máy chủ phản hồi chậm"));
                    assertFalse("An obsolete failure must not create a snackbar", visibleText(activity.getWindow()
                            .getDecorView()).contains("Máy chủ phản hồi chậm"));
                });
                releaseMarket.countDown();
                waitFor(scenario, activity -> visibleText(CommunityTestSupport.screenView(activity, R.id.community_body))
                        .contains("Chưa có nội dung đã xuất bản."));
                scenario.onActivity(activity -> {
                    assertNull(CommunityTestSupport.screenView(activity, R.id.community_body).findViewWithTag("loading"));
                    assertFalse(visibleText(CommunityTestSupport.screenView(activity, R.id.community_body)).contains("Chưa tải được dữ liệu"));
                });
                assertEquals(1, tipsAttempts.get());
                assertEquals(1, marketAttempts.get());
            } finally {
                releaseTips.countDown();
                releaseMarket.countDown();
            }
        }
    }

    private void inject(Interceptor interceptor) throws IllegalAccessException {
        httpField.set(server.api, originalHttp.newBuilder().addInterceptor(interceptor).build());
    }

    private static Response jsonResponse(Interceptor.Chain chain, String json) {
        return new Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1)
                .code(200).message("OK").body(ResponseBody.create(json, MediaType.get("application/json"))).build();
    }

    private static void awaitRelease(CountDownLatch release) throws IOException {
        try {
            if (!release.await(20, TimeUnit.SECONDS)) throw new IOException("UI fixture release timed out");
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new IOException("UI fixture interrupted", error);
        }
    }
}
