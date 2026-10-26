package com.example.recyclingshareapp.data.remote;

import android.content.Context;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

import java.lang.reflect.Field;
import java.net.ConnectException;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.atomic.AtomicBoolean;

import okhttp3.Interceptor;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Protocol;
import okhttp3.Response;
import okhttp3.ResponseBody;

import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class OfflineSnapshotTest {
    private Context context;
    private String base;
    private FirebaseBackendClient first, second;

    @Before public void setUp() {
        context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        base = "http://127.0.0.1:" + (20000 + Math.floorMod(System.nanoTime(), 30000)) + "/v1";
        first = createClient();
    }

    @After public void tearDown() {
        if (first != null) first.close();
        if (second != null) second.close();
    }

    @Test public void viewedPageAndImageOpenOfflineAfterClientRestart() throws Exception {
        byte[] photo = "public-photo".getBytes(StandardCharsets.UTF_8);
        intercept(first, chain -> {
            String path = chain.request().url().encodedPath();
            if (path.contains("accounts:signInWithPassword")) return json(chain, 200, auth("user-one"));
            if (path.endsWith("/posts")) return json(chain, 200,
                    "{\"items\":[{\"id\":\"post-one\",\"kind\":\"POST\",\"status\":\"PUBLISHED\",\"liked\":true,\"saved\":true,\"body\":\"Đã xem\",\"media\":[{\"id\":\"photo-one\"}]}],\"next_cursor\":\"post-one\"}");
            if (path.endsWith("/posts/post-one/comments")) return json(chain, 200,
                    "{\"items\":[{\"id\":\"comment-one\",\"body\":\"Bình luận đã xem\"}],\"next_cursor\":null}");
            if (path.endsWith("/posts/post-one")) return json(chain, 200,
                    "{\"id\":\"post-one\",\"kind\":\"POST\",\"status\":\"PUBLISHED\",\"body\":\"Chi tiết đã xem\",\"media\":[{\"id\":\"photo-one\"}]}");
            if (path.endsWith("/tips")) return json(chain, 200,
                    "{\"items\":[{\"id\":\"tip-one\",\"kind\":\"TIP\",\"status\":\"PUBLISHED\",\"body\":\"Mẹo đã xem\"}],\"next_cursor\":null}");
            if (path.endsWith("/listings")) return json(chain, 200,
                    "{\"items\":[{\"id\":\"listing-one\",\"status\":\"APPROVED\",\"title\":\"Chợ đồ cũ\"}],\"next_cursor\":null}");
            if (path.endsWith("/listings/listing-one")) return json(chain, 200,
                    "{\"id\":\"listing-one\",\"status\":\"APPROVED\",\"title\":\"Món đồ đã xem\",\"items\":[{\"id\":\"item-one\",\"name\":\"Bình thủy tinh\"}]}");
            if (path.endsWith("/media/photo-one/download")) return new Response.Builder()
                    .request(chain.request()).protocol(Protocol.HTTP_1_1).code(200).message("OK")
                    .body(ResponseBody.create(photo, MediaType.get("image/jpeg"))).build();
            throw new AssertionError("Unexpected route: " + path);
        });
        signIn(first);
        assertEquals("post-one", read(first, "/posts?limit=3").optJSONArray("items").optJSONObject(0).optString("id"));
        assertEquals("Chi tiết đã xem", read(first, "/posts/post-one").optString("body"));
        assertEquals("comment-one", read(first, "/posts/post-one/comments").optJSONArray("items").optJSONObject(0).optString("id"));
        assertEquals("tip-one", read(first, "/tips?limit=3").optJSONArray("items").optJSONObject(0).optString("id"));
        assertEquals("listing-one", read(first, "/listings?limit=3").optJSONArray("items").optJSONObject(0).optString("id"));
        assertEquals("Món đồ đã xem", read(first, "/listings/listing-one").optString("title"));
        assertArrayEquals(photo, image(first, "photo-one"));
        awaitDisk("/posts?limit=3", "photo-one");
        awaitDisk("/posts/post-one", null);
        awaitDisk("/posts/post-one/comments", null);
        awaitDisk("/tips?limit=3", null);
        awaitDisk("/listings?limit=3", null);
        awaitDisk("/listings/listing-one", null);
        first.close();

        second = createClient();
        intercept(second, chain -> { throw new ConnectException("offline fixture"); });
        JSONObject cached = readPublic(second, "/posts?limit=3");
        JSONObject row = cached.optJSONArray("items").optJSONObject(0);
        assertEquals("Đã xem", row.optString("body"));
        assertFalse("A public snapshot must not retain this account's LIKE", row.has("liked"));
        assertFalse("A public snapshot must not retain this account's SAVE", row.has("saved"));
        assertEquals("Chi tiết đã xem", readPublic(second, "/posts/post-one").optString("body"));
        assertEquals("Bình luận đã xem", readPublic(second, "/posts/post-one/comments")
                .optJSONArray("items").optJSONObject(0).optString("body"));
        assertEquals("Mẹo đã xem", readPublic(second, "/tips?limit=3")
                .optJSONArray("items").optJSONObject(0).optString("body"));
        assertEquals("Chợ đồ cũ", readPublic(second, "/listings?limit=3")
                .optJSONArray("items").optJSONObject(0).optString("title"));
        assertEquals("Bình thủy tinh", readPublic(second, "/listings/listing-one")
                .optJSONArray("items").optJSONObject(0).optString("name"));
        assertArrayEquals(photo, image(second, "photo-one"));
    }

    @Test public void forbiddenResponseNeverUsesOfflineSnapshot() throws Exception {
        intercept(first, chain -> json(chain, 200,
                "{\"items\":[{\"id\":\"post-one\",\"kind\":\"POST\",\"status\":\"PUBLISHED\"}],\"next_cursor\":null}"));
        readPublic(first, "/posts?limit=3");
        awaitDisk("/posts?limit=3", null);
        first.close();

        second = createClient();
        intercept(second, chain -> json(chain, 403, "{\"error\":{\"code\":\"FORBIDDEN\",\"message\":\"Denied\"}}"));
        AtomicReference<FirebaseBackendClient.BackendException> failure = new AtomicReference<>();
        CountDownLatch done = new CountDownLatch(1);
        second.getPublic("/posts?limit=3", new FirebaseBackendClient.Callback<JSONObject>() {
            @Override public void onSuccess(JSONObject value) { done.countDown(); }
            @Override public void onError(FirebaseBackendClient.BackendException error) { failure.set(error); done.countDown(); }
        });
        assertTrue(done.await(5, TimeUnit.SECONDS));
        assertNotNull("A server denial must not be replaced by cached data", failure.get());
        assertEquals(403, failure.get().httpStatus);
    }

    @Test public void privateConversationOnlySurvivesNetworkFailureInSameSession() throws Exception {
        AtomicBoolean offline = new AtomicBoolean(false);
        AtomicReference<String> authUid = new AtomicReference<>("user-one");
        intercept(first, chain -> {
            if (chain.request().url().encodedPath().contains("accounts:signInWithPassword"))
                return json(chain, 200, auth(authUid.get()));
            if (offline.get()) throw new ConnectException("offline fixture");
            return json(chain, 200, "{\"items\":[{\"id\":\"private-chat\",\"title\":\"Chỉ user-one\"}],\"next_cursor\":null}");
        });
        signIn(first);
        assertEquals("private-chat", read(first, "/conversations?limit=3")
                .optJSONArray("items").optJSONObject(0).optString("id"));
        OfflineSnapshotStore store = new OfflineSnapshotStore(context);
        try { assertNull(store.page(base + "/", "/conversations?limit=3")); }
        finally { store.close(); }

        offline.set(true);
        CountDownLatch failedWrite = new CountDownLatch(1);
        first.request("POST", "/conversations", new JSONObject().put("member_id", "other"), null,
                new FirebaseBackendClient.Callback<JSONObject>() {
                    @Override public void onSuccess(JSONObject value) { failedWrite.countDown(); }
                    @Override public void onError(FirebaseBackendClient.BackendException error) { failedWrite.countDown(); }
                });
        assertTrue(failedWrite.await(5, TimeUnit.SECONDS));
        assertEquals("private-chat", read(first, "/conversations?limit=3")
                .optJSONArray("items").optJSONObject(0).optString("id"));

        first.signOut();
        authUid.set("user-two");
        signIn(first);
        CountDownLatch denied = new CountDownLatch(1);
        AtomicReference<JSONObject> leaked = new AtomicReference<>();
        first.request("GET", "/conversations?limit=3", null, null, new FirebaseBackendClient.Callback<JSONObject>() {
            @Override public void onSuccess(JSONObject value) { leaked.set(value); denied.countDown(); }
            @Override public void onError(FirebaseBackendClient.BackendException error) { denied.countDown(); }
        });
        assertTrue(denied.await(5, TimeUnit.SECONDS));
        assertNull("Private chat from the previous UID must never appear", leaked.get());
    }

    private FirebaseBackendClient createClient() {
        return new FirebaseBackendClient(context, base, "demo-key", base.substring(0, base.length() - 3));
    }

    private void awaitDisk(String route, String mediaId) throws Exception {
        OfflineSnapshotStore store = new OfflineSnapshotStore(context);
        try {
            for (int i = 0; i < 40; i++) {
                if (store.page(base + "/", route) != null
                        && (mediaId == null || store.image(base + "/", mediaId) != null)) return;
                Thread.sleep(50);
            }
            fail("Public snapshot was not committed to SQLite");
        } finally { store.close(); }
    }

    private static void signIn(FirebaseBackendClient client) throws Exception {
        CountDownLatch done = new CountDownLatch(1);
        AtomicReference<Exception> failure = new AtomicReference<>();
        client.signIn("test@example.invalid", "fixture-password", new FirebaseBackendClient.Callback<FirebaseBackendClient.SessionInfo>() {
            @Override public void onSuccess(FirebaseBackendClient.SessionInfo value) { done.countDown(); }
            @Override public void onError(FirebaseBackendClient.BackendException error) { failure.set(error); done.countDown(); }
        });
        assertTrue(done.await(5, TimeUnit.SECONDS));
        assertNull(failure.get());
    }

    private static JSONObject read(FirebaseBackendClient client, String route) throws Exception {
        return awaitJson(callback -> client.request("GET", route, null, null, callback));
    }

    private static JSONObject readPublic(FirebaseBackendClient client, String route) throws Exception {
        return awaitJson(callback -> client.getPublic(route, callback));
    }

    private interface JsonRequest { void run(FirebaseBackendClient.Callback<JSONObject> callback); }

    private static JSONObject awaitJson(JsonRequest request) throws Exception {
        CountDownLatch done = new CountDownLatch(1);
        AtomicReference<JSONObject> value = new AtomicReference<>();
        AtomicReference<Exception> failure = new AtomicReference<>();
        request.run(new FirebaseBackendClient.Callback<JSONObject>() {
            @Override public void onSuccess(JSONObject response) { value.set(response); done.countDown(); }
            @Override public void onError(FirebaseBackendClient.BackendException error) { failure.set(error); done.countDown(); }
        });
        assertTrue(done.await(8, TimeUnit.SECONDS));
        assertNull(failure.get());
        return value.get();
    }

    private static byte[] image(FirebaseBackendClient client, String id) throws Exception {
        CountDownLatch done = new CountDownLatch(1);
        AtomicReference<byte[]> value = new AtomicReference<>();
        AtomicReference<Exception> failure = new AtomicReference<>();
        client.downloadMedia(id, new FirebaseBackendClient.Callback<byte[]>() {
            @Override public void onSuccess(byte[] response) { value.set(response); done.countDown(); }
            @Override public void onError(FirebaseBackendClient.BackendException error) { failure.set(error); done.countDown(); }
        });
        assertTrue(done.await(8, TimeUnit.SECONDS));
        assertNull(failure.get());
        return value.get();
    }

    private static void intercept(FirebaseBackendClient client, Interceptor interceptor) throws Exception {
        Field field = FirebaseBackendClient.class.getDeclaredField("http");
        field.setAccessible(true);
        OkHttpClient original = (OkHttpClient) field.get(client);
        field.set(client, original.newBuilder().addInterceptor(interceptor).build());
    }

    private static String auth(String uid) {
        return "{\"localId\":\"" + uid + "\",\"email\":\"test@example.invalid\",\"idToken\":\"token\",\"refreshToken\":\"refresh\",\"expiresIn\":\"3600\"}";
    }

    private static Response json(Interceptor.Chain chain, int code, String body) {
        return new Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(code)
                .message(code == 200 ? "OK" : "Forbidden")
                .body(ResponseBody.create(body, MediaType.get("application/json"))).build();
    }
}
