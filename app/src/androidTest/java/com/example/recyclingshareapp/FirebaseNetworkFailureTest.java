package com.example.recyclingshareapp;

import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.example.recyclingshareapp.data.remote.FirebaseBackendClient;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import okhttp3.HttpUrl;
import okhttp3.OkHttpClient;
import static org.junit.Assert.*;

/** Actual sockets on device loopback, with no Firebase credentials or cloud requests. */
@RunWith(AndroidJUnit4.class)
public class FirebaseNetworkFailureTest {
    private FirebaseBackendClient client;
    private Fixture server;
    private Context context;

    @Before public void allowLocalFixture() {
        context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        if (android.os.Build.VERSION.SDK_INT >= 37) {
            InstrumentationRegistry.getInstrumentation().getUiAutomation().grantRuntimePermission(
                    context.getPackageName(), "android.permission.ACCESS_LOCAL_NETWORK");
        }
    }

    @After public void closeFixture() throws Exception {
        if (client != null) client.close();
        if (server != null) server.close();
    }

    @Test public void stoppedLocalBackendHasActionableFailure() throws Exception {
        int port;
        try (ServerSocket unused = new ServerSocket(0, 1, java.net.InetAddress.getByName("127.0.0.1"))) {
            port = unused.getLocalPort();
        }
        createClient(port);
        FirebaseBackendClient.BackendException error = publicFailure();
        assertEquals(0, error.httpStatus);
        assertEquals("LOCAL_BACKEND_UNAVAILABLE", error.code);
        assertNotNull(error.getCause());
    }

    @Test public void slowServerIsReportedAsTimeout() throws Exception {
        server = new Fixture(Mode.HANG);
        createClient(server.port());
        Field field = FirebaseBackendClient.class.getDeclaredField("http");
        field.setAccessible(true);
        OkHttpClient transport = (OkHttpClient) field.get(client);
        field.set(client, transport.newBuilder().readTimeout(250, TimeUnit.MILLISECONDS).build());
        assertEquals("NETWORK_TIMEOUT", publicFailure().code);
        assertEquals(1, server.requests.get());
    }

    @Test public void interruptedResponseKeepsItsTransportCause() throws Exception {
        server = new Fixture(Mode.EOF);
        createClient(server.port());
        FirebaseBackendClient.BackendException error = publicFailure();
        assertEquals("NETWORK_INTERRUPTED", error.code);
        assertNotNull(error.getCause());
        assertEquals("Even repeated EOF must stop after one recovery", 2, server.requests.get());
    }

    @Test public void getRecoversOnceWithFreshConnectionAfterEofBeforeHeaders() throws Exception {
        server = new Fixture(Mode.RECOVER);
        createClient(server.port());
        CountDownLatch complete = new CountDownLatch(1);
        AtomicReference<JSONObject> result = new AtomicReference<>();
        AtomicReference<FirebaseBackendClient.BackendException> failure = new AtomicReference<>();
        client.getPublic("/posts", new FirebaseBackendClient.Callback<JSONObject>() {
            @Override public void onSuccess(JSONObject value) { result.set(value); complete.countDown(); }
            @Override public void onError(FirebaseBackendClient.BackendException error) { failure.set(error); complete.countDown(); }
        });
        assertTrue(complete.await(10, TimeUnit.SECONDS));
        assertNull(failure.get());
        assertEquals("recovered", result.get().getString("source"));
        assertEquals(2, server.requests.get());
        assertEquals("Recovery must use a fresh socket", 2, server.operationConnections.get());
    }

    @Test public void postWithAmbiguousOutcomeIsNeverReplayed() throws Exception {
        server = new Fixture(Mode.EOF);
        createClient(server.port());
        signIn();
        CountDownLatch complete = new CountDownLatch(1);
        AtomicReference<FirebaseBackendClient.BackendException> failure = new AtomicReference<>();
        client.request("POST", "/posts", new JSONObject().put("body", "fixture"), null, new FirebaseBackendClient.Callback<JSONObject>() {
            @Override public void onSuccess(JSONObject value) { complete.countDown(); }
            @Override public void onError(FirebaseBackendClient.BackendException error) { failure.set(error); complete.countDown(); }
        });
        assertTrue(complete.await(10, TimeUnit.SECONDS));
        assertNotNull(failure.get());
        assertEquals("NETWORK_INTERRUPTED", failure.get().code);
        assertEquals("A write may have reached the server already", 1, server.requests.get());
    }

    @Test public void signOutDuringFailedReadPreventsReplayAndOldCallback() throws Exception {
        server = new Fixture(Mode.HOLD_EOF);
        createClient(server.port());
        CountDownLatch callback = new CountDownLatch(1);
        client.getPublic("/posts", new FirebaseBackendClient.Callback<JSONObject>() {
            @Override public void onSuccess(JSONObject value) { callback.countDown(); }
            @Override public void onError(FirebaseBackendClient.BackendException error) { callback.countDown(); }
        });
        assertTrue(server.operationStarted.await(5, TimeUnit.SECONDS));
        client.signOut();
        server.releaseEof.countDown();
        assertFalse("An old account's callback must stay suppressed", callback.await(700, TimeUnit.MILLISECONDS));
        assertEquals("An invalidated generation must not repeat a read", 1, server.requests.get());
    }

    @Test public void httpFailureIsPreservedAndNeverRetriedAsConnectionFailure() throws Exception {
        server = new Fixture(Mode.HTTP_ERROR);
        createClient(server.port());
        FirebaseBackendClient.BackendException error = publicFailure();
        assertEquals(503, error.httpStatus);
        assertEquals("TEMPORARILY_UNAVAILABLE", error.code);
        assertEquals(1, server.requests.get());
    }

    @Test public void diagnosticMetadataExcludesQueriesAndDocumentIdentifiers() throws Exception {
        Method route = FirebaseBackendClient.class.getDeclaredMethod("diagnosticRoute", HttpUrl.class);
        route.setAccessible(true);
        HttpUrl url = HttpUrl.get("http://127.0.0.1:5002/v1/posts/private-document-id/comments?key=private-key&email=secret");
        assertEquals("/v1/posts/:id/comments", route.invoke(null, url));
        HttpUrl storage = HttpUrl.get("https://storage.googleapis.com/private-bucket/private-file.jpg?token=private-token");
        assertEquals("/media", route.invoke(null, storage));
    }

    private void createClient(int port) {
        String origin = "http://127.0.0.1:" + port;
        client = new FirebaseBackendClient(context, origin + "/v1", "demo-key", origin);
    }

    private FirebaseBackendClient.BackendException publicFailure() throws Exception {
        CountDownLatch complete = new CountDownLatch(1);
        AtomicReference<FirebaseBackendClient.BackendException> failure = new AtomicReference<>();
        AtomicReference<JSONObject> success = new AtomicReference<>();
        client.getPublic("/posts", new FirebaseBackendClient.Callback<JSONObject>() {
            @Override public void onSuccess(JSONObject value) { success.set(value); complete.countDown(); }
            @Override public void onError(FirebaseBackendClient.BackendException error) { failure.set(error); complete.countDown(); }
        });
        assertTrue("Loopback operation timed out", complete.await(10, TimeUnit.SECONDS));
        assertNull("Fixture must fail rather than return data", success.get());
        assertNotNull(failure.get());
        return failure.get();
    }

    private void signIn() throws Exception {
        CountDownLatch complete = new CountDownLatch(1);
        AtomicReference<FirebaseBackendClient.BackendException> failure = new AtomicReference<>();
        client.signIn("fixture@example.invalid", "fixture-password", new FirebaseBackendClient.Callback<FirebaseBackendClient.SessionInfo>() {
            @Override public void onSuccess(FirebaseBackendClient.SessionInfo value) { complete.countDown(); }
            @Override public void onError(FirebaseBackendClient.BackendException error) { failure.set(error); complete.countDown(); }
        });
        assertTrue(complete.await(10, TimeUnit.SECONDS));
        assertNull(failure.get());
    }

    private enum Mode { HANG, EOF, HTTP_ERROR, RECOVER, HOLD_EOF }

    private static final class Fixture implements AutoCloseable {
        final ServerSocket listener = new ServerSocket();
        final AtomicInteger requests = new AtomicInteger();
        final AtomicInteger operationConnections = new AtomicInteger();
        final List<Socket> sockets = new CopyOnWriteArrayList<>();
        final CountDownLatch shutdown = new CountDownLatch(1);
        final CountDownLatch operationStarted = new CountDownLatch(1);
        final CountDownLatch releaseEof = new CountDownLatch(1);
        final ExecutorService workers = Executors.newCachedThreadPool();
        final Mode mode;

        Fixture(Mode mode) throws IOException {
            this.mode = mode;
            listener.bind(new InetSocketAddress("127.0.0.1", 0));
            workers.execute(() -> {
                while (!listener.isClosed()) {
                    try {
                        Socket socket = listener.accept();
                        sockets.add(socket);
                        workers.execute(() -> serve(socket));
                    } catch (IOException error) {
                        if (!listener.isClosed()) throw new AssertionError("Fixture accept failed", error);
                    }
                }
            });
        }

        int port() { return listener.getLocalPort(); }

        private void serve(Socket socket) {
            try (Socket connection = socket) {
                InputStream input = connection.getInputStream();
                String request = readLine(input);
                if (request == null) return;
                String line;
                int contentLength = 0;
                while ((line = readLine(input)) != null && !line.isEmpty()) {
                    int separator = line.indexOf(':');
                    if (separator > 0 && "Content-Length".equalsIgnoreCase(line.substring(0, separator))) {
                        contentLength = Integer.parseInt(line.substring(separator + 1).trim());
                    }
                }
                for (int count = 0; count < contentLength; count++) if (input.read() == -1) throw new IOException("Truncated fixture request");
                if (request.contains("/identitytoolkit.googleapis.com/")) {
                    respond(connection, 200, "{\"localId\":\"fixture-user\",\"email\":\"fixture@example.invalid\",\"idToken\":\"fixture-token\",\"refreshToken\":\"fixture-refresh\",\"expiresIn\":\"3600\"}");
                    return;
                }
                operationConnections.incrementAndGet();
                int attempt = requests.incrementAndGet();
                operationStarted.countDown();
                if (mode == Mode.HANG) { shutdown.await(10, TimeUnit.SECONDS); return; }
                if (mode == Mode.HOLD_EOF) { releaseEof.await(10, TimeUnit.SECONDS); return; }
                if (mode == Mode.EOF) return;
                if (mode == Mode.RECOVER) {
                    if (attempt == 1) return;
                    respond(connection, 200, "{\"source\":\"recovered\"}");
                } else {
                    respond(connection, 503, "{\"error\":{\"code\":\"TEMPORARILY_UNAVAILABLE\",\"message\":\"Fixture unavailable\"}}");
                }
            } catch (IOException | InterruptedException ignored) {
                // Test timeout/cleanup deliberately terminates fixture connections.
            } finally { sockets.remove(socket); }
        }

        private static void respond(Socket connection, int status, String json) throws IOException {
            byte[] body = json.getBytes(StandardCharsets.UTF_8);
            connection.getOutputStream().write(("HTTP/1.1 " + status + " Fixture\r\nContent-Type: application/json\r\nContent-Length: "
                    + body.length + "\r\nConnection: close\r\n\r\n").getBytes(StandardCharsets.US_ASCII));
            connection.getOutputStream().write(body);
            connection.getOutputStream().flush();
        }

        private static String readLine(InputStream input) throws IOException {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            int value;
            while ((value = input.read()) != -1) {
                if (value == '\n') return bytes.toString("US-ASCII").replace("\r", "");
                bytes.write(value);
                if (bytes.size() > 8192) throw new IOException("Fixture header too large");
            }
            return null;
        }

        @Override public void close() throws Exception {
            shutdown.countDown();
            releaseEof.countDown();
            listener.close();
            for (Socket socket : sockets) socket.close();
            workers.shutdownNow();
            assertTrue(workers.awaitTermination(5, TimeUnit.SECONDS));
        }
    }
}
