package com.example.recyclingshareapp;

import android.content.Context;
import android.os.Looper;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import com.example.recyclingshareapp.data.remote.FirebaseBackendClient;

import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

import java.lang.reflect.Field;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import okhttp3.Interceptor;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Protocol;
import okhttp3.Response;
import okhttp3.ResponseBody;

import static org.junit.Assert.*;

/** Isolated intercepted transport: no cloud account, backend process, or external writes. */
@RunWith(AndroidJUnit4.class)
public class FirebasePrefetchCacheTest {
    private FirebaseBackendClient client;

    @Before public void createClient() {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        client = new FirebaseBackendClient(context, "http://127.0.0.1:9112/v1", "demo-key", "http://127.0.0.1:9112");
    }

    @After public void closeClient() { client.close(); }

    @Test public void slowScreenReadDoesNotBlockAnotherScreenOrUserAction() throws Exception {
        CountDownLatch started = new CountDownLatch(1), release = new CountDownLatch(1);
        intercept(chain -> {
            if (chain.request().url().encodedPath().endsWith("/stories")) {
                started.countDown(); awaitFixture(release);
                return response(chain, "{\"items\":[]}");
            }
            return authOrMutation(chain);
        });
        signIn();
        CountDownLatch slow = new CountDownLatch(1), screen = new CountDownLatch(1), action = new CountDownLatch(1);
        try {
            client.request("GET", "/stories?limit=12", null, null, signal(slow));
            assertTrue(started.await(5, TimeUnit.SECONDS));
            client.request("GET", "/tips?limit=3", null, null, signal(screen));
            assertTrue("Another screen should finish while stories are still waiting", screen.await(2, TimeUnit.SECONDS));
            client.request("POST", "/posts/post-one/likes", new JSONObject(), null, signal(action));
            assertTrue("A like should not wait for an unrelated screen read", action.await(2, TimeUnit.SECONDS));
            assertEquals("The slow read should remain in flight", 1, slow.getCount());
        } finally { release.countDown(); }
        assertTrue(slow.await(5, TimeUnit.SECONDS));
    }

    @Test public void parallelReadsShareOneTokenRefresh() throws Exception {
        AtomicInteger refreshes = new AtomicInteger();
        CountDownLatch refreshing = new CountDownLatch(1), release = new CountDownLatch(1);
        intercept(chain -> {
            String path = chain.request().url().encodedPath();
            if (path.contains("accounts:signInWithPassword"))
                return response(chain, authBody("uid-one").replace("\"3600\"", "\"1\""));
            if (path.endsWith("/token")) {
                refreshes.incrementAndGet(); refreshing.countDown(); awaitFixture(release);
                return response(chain, "{\"user_id\":\"uid-one\",\"id_token\":\"fresh-token\","
                        + "\"refresh_token\":\"fresh-refresh\",\"expires_in\":\"3600\"}");
            }
            return response(chain, "{\"items\":[]}");
        });
        signIn();
        CountDownLatch both = new CountDownLatch(2);
        try {
            client.request("GET", "/tips?limit=3", null, null, signal(both));
            assertTrue(refreshing.await(5, TimeUnit.SECONDS));
            client.request("GET", "/listings?limit=3", null, null, signal(both));
        } finally { release.countDown(); }
        assertTrue(both.await(5, TimeUnit.SECONDS));
        assertEquals("Concurrent screens must reuse the newly refreshed session", 1, refreshes.get());
    }

    @Test public void firstPostsPrefetchCoalescesForegroundAndKeepsDetachedSnapshots() throws Exception {
        AtomicInteger reads = new AtomicInteger();
        CountDownLatch started = new CountDownLatch(1), release = new CountDownLatch(1);
        intercept(chain -> {
            if (chain.request().url().encodedPath().endsWith("/posts")) {
                reads.incrementAndGet(); started.countDown(); awaitFixture(release);
                return response(chain, "{\"items\":[{\"id\":\"post-one\"}],\"next_cursor\":null}");
            }
            return authOrMutation(chain);
        });
        signIn();
        client.prefetchFirstPosts();
        assertTrue(started.await(5, TimeUnit.SECONDS));

        CountDownLatch both = new CountDownLatch(2);
        AtomicBoolean callbacksOnMain = new AtomicBoolean(true);
        FirebaseBackendClient.Callback<JSONObject> observer = new FirebaseBackendClient.Callback<JSONObject>() {
            @Override public void onSuccess(JSONObject value) {
                callbacksOnMain.compareAndSet(true, Looper.myLooper() == Looper.getMainLooper());
                assertEquals("post-one", value.optJSONArray("items").optJSONObject(0).optString("id"));
                both.countDown();
            }
            @Override public void onError(FirebaseBackendClient.BackendException error) { fail(error.code); both.countDown(); }
        };
        client.request("GET", "/posts?limit=" + FirebaseBackendClient.FIRST_PAGE_SIZE, null, null, observer);
        client.request("GET", "/posts?limit=" + FirebaseBackendClient.FIRST_PAGE_SIZE, null, null, observer);
        release.countDown();
        assertTrue(both.await(5, TimeUnit.SECONDS));
        assertTrue(callbacksOnMain.get());
        assertEquals("Prefetch and both consumers must share one GET", 1, reads.get());

        JSONObject snapshot = client.cachedJson("/posts?limit=" + FirebaseBackendClient.FIRST_PAGE_SIZE);
        assertNotNull(snapshot);
        snapshot.optJSONArray("items").optJSONObject(0).put("id", "changed-locally");
        assertEquals("post-one", client.cachedJson("/posts?limit=" + FirebaseBackendClient.FIRST_PAGE_SIZE).optJSONArray("items").optJSONObject(0).optString("id"));
        awaitGet("/posts?limit=" + FirebaseBackendClient.FIRST_PAGE_SIZE);
        assertEquals("Warm first page must not hit transport again", 1, reads.get());
    }

    @Test public void freshReadBypassesWarmCacheForRemoteEdits() throws Exception {
        AtomicInteger reads = new AtomicInteger();
        AtomicReference<String> remoteBody = new AtomicReference<>("before admin edit");
        intercept(chain -> {
            if (chain.request().url().encodedPath().endsWith("/posts")) {
                reads.incrementAndGet();
                return response(chain, "{\"items\":[{\"id\":\"post-one\",\"body\":\""
                        + remoteBody.get() + "\"}],\"next_cursor\":null}");
            }
            return authOrMutation(chain);
        });
        signIn();
        awaitGet("/posts?limit=3");
        remoteBody.set("after admin edit");
        awaitGet("/posts?limit=3");
        assertEquals("Ordinary navigation should reuse the warm cache", 1, reads.get());

        CountDownLatch refreshed = new CountDownLatch(1);
        AtomicReference<JSONObject> latest = new AtomicReference<>();
        client.requestFresh("/posts?limit=3", new FirebaseBackendClient.Callback<JSONObject>() {
            @Override public void onSuccess(JSONObject value) { latest.set(value); refreshed.countDown(); }
            @Override public void onError(FirebaseBackendClient.BackendException error) { fail(error.code); refreshed.countDown(); }
        });
        assertTrue(refreshed.await(5, TimeUnit.SECONDS));
        assertEquals(2, reads.get());
        assertEquals("after admin edit", latest.get().getJSONArray("items").getJSONObject(0).getString("body"));
        assertEquals("after admin edit", client.cachedJson("/posts?limit=3")
                .getJSONArray("items").getJSONObject(0).getString("body"));
    }

    @Test public void profileRefreshReadsNewEcoPointsDespiteWarmCache() throws Exception {
        AtomicInteger reads = new AtomicInteger();
        AtomicInteger points = new AtomicInteger(100);
        intercept(chain -> {
            if (chain.request().url().encodedPath().endsWith("/me")) {
                reads.incrementAndGet();
                return response(chain, "{\"id\":\"uid-one\",\"points_balance\":" + points.get() + "}");
            }
            return authOrMutation(chain);
        });
        signIn();
        CountDownLatch first = new CountDownLatch(1), second = new CountDownLatch(1);
        AtomicReference<JSONObject> latest = new AtomicReference<>();
        client.getMe(new FirebaseBackendClient.Callback<JSONObject>() {
            @Override public void onSuccess(JSONObject value) { latest.set(value); first.countDown(); }
            @Override public void onError(FirebaseBackendClient.BackendException error) { fail(error.code); first.countDown(); }
        });
        assertTrue(first.await(5, TimeUnit.SECONDS));
        assertEquals(100, latest.get().optInt("points_balance"));
        points.set(125);
        client.getMe(new FirebaseBackendClient.Callback<JSONObject>() {
            @Override public void onSuccess(JSONObject value) { latest.set(value); second.countDown(); }
            @Override public void onError(FirebaseBackendClient.BackendException error) { fail(error.code); second.countDown(); }
        });
        assertTrue(second.await(5, TimeUnit.SECONDS));
        assertEquals(125, latest.get().optInt("points_balance"));
        assertEquals(2, reads.get());
    }

    @Test public void mutationInvalidatesInFlightPageAndPreventsStaleRecache() throws Exception {
        AtomicInteger reads = new AtomicInteger();
        CountDownLatch started = new CountDownLatch(1), release = new CountDownLatch(1);
        CountDownLatch refreshStarted = new CountDownLatch(1), releaseRefresh = new CountDownLatch(1);
        intercept(chain -> {
            if (chain.request().url().encodedPath().endsWith("/posts") && "GET".equals(chain.request().method())) {
                int read = reads.incrementAndGet();
                if (read == 1) {
                    started.countDown(); awaitFixture(release);
                } else {
                    refreshStarted.countDown(); awaitFixture(releaseRefresh);
                }
                return response(chain, "{\"items\":[{\"id\":\"" + (read == 1 ? "stale" : "fresh") + "\"}],\"next_cursor\":null}");
            }
            return authOrMutation(chain);
        });
        signIn();
        CountDownLatch oldRead = new CountDownLatch(1), wrote = new CountDownLatch(1);
        client.request("GET", "/posts?limit=3", null, null, signal(oldRead));
        assertTrue(started.await(5, TimeUnit.SECONDS));
        client.request("PATCH", "/posts/post-one", new JSONObject().put("body", "edited"), null, signal(wrote));
        release.countDown();
        assertTrue(wrote.await(5, TimeUnit.SECONDS));
        assertTrue(refreshStarted.await(5, TimeUnit.SECONDS));
        assertEquals("Older result must not reach screen before replacement", 1, oldRead.getCount());
        assertNull("A read begun before a write must not repopulate the cache", client.cachedJson("/posts?limit=3"));
        releaseRefresh.countDown();
        assertTrue(oldRead.await(5, TimeUnit.SECONDS));
        assertEquals("fresh", client.cachedJson("/posts?limit=3").optJSONArray("items").optJSONObject(0).optString("id"));
        assertEquals(2, reads.get());
    }

    @Test public void signOutDropsOldCallbacksAndNextAccountFetchesAgain() throws Exception {
        AtomicInteger reads = new AtomicInteger();
        AtomicInteger auths = new AtomicInteger();
        CountDownLatch started = new CountDownLatch(1), release = new CountDownLatch(1), oldCallback = new CountDownLatch(1);
        intercept(chain -> {
            if (chain.request().url().encodedPath().endsWith("/posts")) {
                if (reads.incrementAndGet() == 1) {
                    started.countDown(); awaitFixture(release);
                }
                return response(chain, "{\"items\":[{\"id\":\"post-one\"}],\"next_cursor\":null}");
            }
            if (chain.request().url().encodedPath().contains("accounts:signInWithPassword")) {
                int n = auths.incrementAndGet();
                return response(chain, authBody("uid-" + n));
            }
            return response(chain, "{}");
        });
        signIn();
        client.request("GET", "/posts?limit=3", null, null, signal(oldCallback));
        assertTrue(started.await(5, TimeUnit.SECONDS));
        client.signOut();
        assertNull(client.cachedJson("/posts?limit=3"));
        release.countDown();
        signIn();
        awaitGet("/posts?limit=3");
        assertEquals(2, reads.get());
        assertEquals(2, auths.get());
        assertFalse("Old account callback must be discarded", oldCallback.await(250, TimeUnit.MILLISECONDS));
    }

    @Test public void mediaDownloadCoalescesCachesAndClearsOnSignOut() throws Exception {
        AtomicInteger reads = new AtomicInteger();
        CountDownLatch started = new CountDownLatch(1), release = new CountDownLatch(1);
        byte[] expected = "private-photo".getBytes(StandardCharsets.UTF_8);
        intercept(chain -> {
            if (chain.request().url().encodedPath().endsWith("/media/media-one/download")) {
                reads.incrementAndGet(); started.countDown(); awaitFixture(release);
                return new Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(200)
                        .message("OK").body(ResponseBody.create(expected, MediaType.get("image/jpeg"))).build();
            }
            return authOrMutation(chain);
        });
        signIn();
        CountDownLatch both = new CountDownLatch(2);
        AtomicReference<byte[]> first = new AtomicReference<>();
        client.downloadMedia("media-one", mediaSignal(both, first));
        assertTrue(started.await(5, TimeUnit.SECONDS));
        client.downloadMedia("media-one", mediaSignal(both, new AtomicReference<>()));
        release.countDown();
        assertTrue(both.await(5, TimeUnit.SECONDS));
        assertEquals(1, reads.get());
        first.get()[0] = '!';
        CountDownLatch warm = new CountDownLatch(1);
        AtomicReference<byte[]> warmBytes = new AtomicReference<>();
        client.downloadMedia("media-one", mediaSignal(warm, warmBytes));
        assertTrue(warm.await(5, TimeUnit.SECONDS));
        assertArrayEquals(expected, warmBytes.get());
        assertEquals(1, reads.get());
        client.signOut();
        signIn();
        CountDownLatch again = new CountDownLatch(1);
        client.downloadMedia("media-one", mediaSignal(again, new AtomicReference<>()));
        assertTrue(again.await(5, TimeUnit.SECONDS));
        assertEquals(2, reads.get());
    }

    private FirebaseBackendClient.Callback<byte[]> mediaSignal(CountDownLatch latch, AtomicReference<byte[]> result) {
        return new FirebaseBackendClient.Callback<byte[]>() {
            @Override public void onSuccess(byte[] value) { result.set(value); latch.countDown(); }
            @Override public void onError(FirebaseBackendClient.BackendException error) { fail(error.code); latch.countDown(); }
        };
    }

    private FirebaseBackendClient.Callback<JSONObject> signal(CountDownLatch latch) {
        return new FirebaseBackendClient.Callback<JSONObject>() {
            @Override public void onSuccess(JSONObject value) { latch.countDown(); }
            @Override public void onError(FirebaseBackendClient.BackendException error) { fail(error.code); latch.countDown(); }
        };
    }

    private void awaitGet(String path) throws Exception {
        CountDownLatch ready = new CountDownLatch(1);
        client.request("GET", path, null, null, signal(ready));
        assertTrue(ready.await(5, TimeUnit.SECONDS));
    }

    private void signIn() throws Exception {
        CountDownLatch ready = new CountDownLatch(1);
        AtomicReference<FirebaseBackendClient.BackendException> failure = new AtomicReference<>();
        client.signIn("fixture@example.invalid", "fixture-password", new FirebaseBackendClient.Callback<FirebaseBackendClient.SessionInfo>() {
            @Override public void onSuccess(FirebaseBackendClient.SessionInfo value) { ready.countDown(); }
            @Override public void onError(FirebaseBackendClient.BackendException error) { failure.set(error); ready.countDown(); }
        });
        assertTrue(ready.await(5, TimeUnit.SECONDS));
        assertNull(failure.get());
    }

    private Response authOrMutation(Interceptor.Chain chain) {
        if (chain.request().url().encodedPath().contains("accounts:signInWithPassword"))
            return response(chain, authBody("uid-one"));
        return response(chain, "{}");
    }

    private static String authBody(String uid) {
        return "{\"localId\":\"" + uid + "\",\"email\":\"fixture@example.invalid\",\"idToken\":\"fixture-token\","
                + "\"refreshToken\":\"fixture-refresh\",\"expiresIn\":\"3600\"}";
    }

    private static Response response(Interceptor.Chain chain, String json) {
        return new Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(200)
                .message("OK").body(ResponseBody.create(json, MediaType.get("application/json"))).build();
    }

    private void intercept(Interceptor interceptor) throws Exception {
        Field field = FirebaseBackendClient.class.getDeclaredField("http");
        field.setAccessible(true);
        OkHttpClient original = (OkHttpClient) field.get(client);
        field.set(client, original.newBuilder().addInterceptor(interceptor).build());
    }

    private static void awaitFixture(CountDownLatch latch) throws IOException {
        try {
            if (!latch.await(5, TimeUnit.SECONDS)) throw new IOException("Fixture timed out");
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new IOException("Fixture interrupted", error);
        }
    }
}
