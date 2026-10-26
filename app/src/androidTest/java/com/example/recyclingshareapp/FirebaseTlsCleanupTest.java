package com.example.recyclingshareapp;

import android.content.Context;
import android.os.NetworkOnMainThreadException;
import android.os.StrictMode;
import android.util.Base64;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import com.example.recyclingshareapp.data.remote.FirebaseBackendClient;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.reflect.Field;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.Certificate;
import java.security.cert.CertificateFactory;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLServerSocket;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.TrustManagerFactory;
import javax.net.ssl.X509TrustManager;

import okhttp3.ConnectionPool;
import okhttp3.OkHttpClient;

import static org.junit.Assert.*;

/** Real keep-alive TLS sockets, isolated on device loopback; no Firebase/cloud accounts or requests. */
@RunWith(AndroidJUnit4.class)
public class FirebaseTlsCleanupTest {
    private TlsFixture server;
    private FirebaseBackendClient client;

    @Before public void startIsolatedTlsFixture() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        if (android.os.Build.VERSION.SDK_INT >= 37) {
            InstrumentationRegistry.getInstrumentation().getUiAutomation().grantRuntimePermission(
                    context.getPackageName(), "android.permission.ACCESS_LOCAL_NETWORK");
        }
        server = new TlsFixture();
        client = new FirebaseBackendClient(context, server.origin() + "/v1", "fixture-key");
        // Only this test instance trusts the fixture certificate. Production TLS/hostname checks stay intact.
        OkHttpClient transport = transport();
        setField("http", transport.newBuilder().sslSocketFactory(server.tls.getSocketFactory(), server.trust).build());
        setField("identityBase", server.origin() + "/auth/");
    }

    @After public void closeFixture() throws Exception {
        if (client != null) client.close();
        if (server != null) server.close();
    }

    @Test public void signOutWithIdleTlsClearsSessionImmediatelyAndCanSignInAgain() throws Exception {
        signIn();
        OkHttpClient oldTransport = transport();
        assertTrue(client.isSignedIn());
        assertIdleTls(oldTransport.connectionPool());

        assertNull("Sign-out must never close TLS sockets on the main thread", onStrictMain(() -> {
            client.signOut();
            assertFalse("Session must clear synchronously", client.isSignedIn());
            assertNull(client.currentSession());
        }));
        OkHttpClient nextTransport = transport();
        assertNotSame("A new login must not share a pool being retired", oldTransport.connectionPool(), nextTransport.connectionPool());
        assertNotSame(oldTransport.dispatcher(), nextTransport.dispatcher());

        // Start immediately: delayed retirement must not cancel or poison the next account's requests.
        signIn();
        assertTrue(client.isSignedIn());
        assertEquals("fixture-user", client.currentSession().uid);
        awaitEmptyPool(oldTransport.connectionPool());
        assertIdleTls(nextTransport.connectionPool());
    }

    @Test public void closeWithIdleTlsIsSafeOnMainThreadAndIdempotent() throws Exception {
        signIn();
        OkHttpClient retired = transport();
        assertIdleTls(retired.connectionPool());
        assertNull("Closing a screen must never perform TLS shutdown on UI", onStrictMain(() -> {
            client.close();
            client.close();
            client.signOut();
            assertFalse(client.isSignedIn());
            assertNull(client.currentSession());
        }));
        awaitEmptyPool(retired.connectionPool());
        awaitShutdown(retired.dispatcher().executorService());
    }

    @Test public void fixtureReproducesTheOldSynchronousTlsEvictionCrash() throws Exception {
        signIn();
        OkHttpClient oldTransport = transport();
        assertIdleTls(oldTransport.connectionPool());
        Throwable failure = onStrictMain(() -> oldTransport.connectionPool().evictAll());
        assertTrue("The regression fixture must exercise a real TLS close_notify network write; got " + failure,
                failure instanceof NetworkOnMainThreadException);
    }

    private void signIn() throws Exception {
        CountDownLatch complete = new CountDownLatch(1);
        AtomicReference<FirebaseBackendClient.BackendException> failure = new AtomicReference<>();
        client.signIn("fixture@example.invalid", "fixture-password", new FirebaseBackendClient.Callback<FirebaseBackendClient.SessionInfo>() {
            @Override public void onSuccess(FirebaseBackendClient.SessionInfo value) { complete.countDown(); }
            @Override public void onError(FirebaseBackendClient.BackendException error) { failure.set(error); complete.countDown(); }
        });
        assertTrue("Local TLS fixture timed out", complete.await(15, TimeUnit.SECONDS));
        if (failure.get() != null) throw failure.get();
    }

    private static Throwable onStrictMain(Runnable operation) {
        AtomicReference<Throwable> failure = new AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            StrictMode.ThreadPolicy previous = StrictMode.getThreadPolicy();
            StrictMode.setThreadPolicy(new StrictMode.ThreadPolicy.Builder(previous).detectNetwork().penaltyDeathOnNetwork().build());
            try { operation.run(); }
            catch (Throwable error) { failure.set(error); }
            finally { StrictMode.setThreadPolicy(previous); }
        });
        return failure.get();
    }

    private static void assertIdleTls(ConnectionPool pool) {
        assertEquals("The response must leave a real keep-alive TLS socket idle", 1, pool.idleConnectionCount());
    }

    private static void awaitEmptyPool(ConnectionPool pool) throws Exception {
        long deadline = android.os.SystemClock.elapsedRealtime() + 5000;
        while (pool.connectionCount() != 0 && android.os.SystemClock.elapsedRealtime() < deadline) Thread.sleep(20);
        assertEquals("Retired TLS connections must be released off main", 0, pool.connectionCount());
    }

    private static void awaitShutdown(java.util.concurrent.ExecutorService executor) throws Exception {
        long deadline = android.os.SystemClock.elapsedRealtime() + 5000;
        while (!executor.isShutdown() && android.os.SystemClock.elapsedRealtime() < deadline) Thread.sleep(20);
        assertTrue("The retired dispatcher must be released", executor.isShutdown());
    }

    private OkHttpClient transport() throws Exception {
        Field field = FirebaseBackendClient.class.getDeclaredField("http");
        field.setAccessible(true);
        return (OkHttpClient) field.get(client);
    }

    private void setField(String name, Object value) throws Exception {
        Field field = FirebaseBackendClient.class.getDeclaredField(name);
        field.setAccessible(true);
        field.set(client, value);
    }

    private static final class TlsFixture implements AutoCloseable {
        // Public, disposable test credentials; the certificate is valid 2020-2085 for localhost/127.0.0.1 only.
        private static final String CERTIFICATE = "MIIDaDCCAlCgAwIBAgIJAPtZJ3lQPPt9MA0GCSqGSIb3DQEBDAUAMFMxCzAJBgNVBAYTAlZOMRkwFwYDVQQKExBFY29TaGFyZSBGaXh0dXJlMRUwEwYDVQQLEwxBbmRyb2lkIFRlc3QxEjAQBgNVBAMTCWxvY2FsaG9zdDAgFw0xOTEyMzExNzAwMDBaGA8yMDg1MDkxNTE3MDAwMFowUzELMAkGA1UEBhMCVk4xGTAXBgNVBAoTEEVjb1NoYXJlIEZpeHR1cmUxFTATBgNVBAsTDEFuZHJvaWQgVGVzdDESMBAGA1UEAxMJbG9jYWxob3N0MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAprUiWo4+KNTjcuBPF5usiv5WZYxxGVC4L1v/Af+b6w9GEVOLCy6cl4Bxlk1+a9Svmcevgq7fcaXv8GhecruoZb1IiKfBlApyEurTgclidlAMvanZhC2t3U/AnPuGcLTjqsse94vYywcHtTVmDs0cSAswI75hHxE3y/MDImJMzoyQPLPU3cfcGRChY/XxFdDptMi+ucIkeQ4SttcEUQ0k20qXxTuwj8QDjZmFVkNQf3zf8voXikRh2zqTSgYasa2uEFSV07bIz6xWj7L1R76SpAnUb6lIxd5+3vduSeb+C1kazebCnF4zflNGzzWh/KR7OHS1tgFCB7AD+NqCydCkiQIDAQABoz0wOzAdBgNVHQ4EFgQUMOGOQkb9/o+HxBXFPWq9eW+hcxQwGgYDVR0RBBMwEYIJbG9jYWxob3N0hwR/AAABMA0GCSqGSIb3DQEBDAUAA4IBAQCSJDsN9/VIh2HMWySR8O3Y3v20Y8VSlxcNWTY0S+Tu7gkyqHQ+Qq72hzMqoH1tkEFooY7T9TrrdGlY9OHZGwH0RYlRH7p5PgIVTSQT8nNW2t1zELArL+KmMwNMI3bfro6njzZu2EhrqB96eu0pqW/3XxhsoFlw2is/WKlCk+T7tEAAQDy/WPisrSRi7iC7XVblDBRDexlDO20QWhxcVeesl1BGGbsxW7EwZUypnoK8G5/z5QMepQs2IczzE64bdJl24C86Kkn68f7wKJLt715zk4yqUuwO5OG2kK1iLEDNYw42ioe7RoBQAGHbPplAbOkywlqRrR2844mBGy4AYsHz";
        private static final String PRIVATE_KEY = "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCmtSJajj4o1ONy4E8Xm6yK/lZljHEZULgvW/8B/5vrD0YRU4sLLpyXgHGWTX5r1K+Zx6+Crt9xpe/waF5yu6hlvUiIp8GUCnIS6tOByWJ2UAy9qdmELa3dT8Cc+4ZwtOOqyx73i9jLBwe1NWYOzRxICzAjvmEfETfL8wMiYkzOjJA8s9Tdx9wZEKFj9fEV0Om0yL65wiR5DhK21wRRDSTbSpfFO7CPxAONmYVWQ1B/fN/y+heKRGHbOpNKBhqxra4QVJXTtsjPrFaPsvVHvpKkCdRvqUjF3n7e925J5v4LWRrN5sKcXjN+U0bPNaH8pHs4dLW2AUIHsAP42oLJ0KSJAgMBAAECggEAAxVsUW6nTSZN+RE+Fhg70Q9HsUwJIgnSR5PJymnMSRHaSHlqNwtctThrvkPh8/Qf1blOwInQ6b3JhWg+Bs/vlO0zMKe78hIrSywJyRejOrMvOL/R8LFCUaR3MitjA9+NHnR9XS2HYoI9zpVsDteusp4pXNN/7kN2MjxR9iWv5ccTQJDSNpyyVR5/iz1jynlx2PFU2fzP9uJFfPDv5Tnnajr5uGzhTDn019bT/5UHjY3uCC7fH0YRqxG04MhCjjSb/29NCQKMmneecpoUovznq62mWeAlkt8nAYagErxTUFxeDY0KUxuwwQrPpps2yM4ETyCucI9xwme/qLN8z4vtIQKBgQDFIcpJuL1O6RiEqWiNHJJ7oJ6kXWo9EUCFB+g34urAmlFoLM95hIu8iw+aU3FEtQvrYjm01Ny0yz90y7kVDuglf6GNjwI8VjHDRQg+zpPTB3pGhrJXJ7HkVpFVqo6fBKSzE7Lz8EqmSxPMBYsGZrmyO2yOCe82NAkhvKh4sw12KQKBgQDYfXpL8FXnj5etXnqcWTxVs5QLZSQeWoHen5SaofzxIXlAcmVF6hHt8tQIKUuvWmV4a1SztIELfw2EpphhuwAniaQilWMk19OHZ0vENiRyzQPyYYCz63KTSJohJBbGjoetAQ7EdP0Ykqh4nUDq40OrlsdMza1Cdm7cm3+orZXHYQKBgHItwyP2G7gD7M6R7Numy/VNL/XVoX4javJihQ8xoHTULQigw78HlYQsK2pgoD+CeZfpebEShY82FdgJU3ct/ioSBbmfNlVKO2J1rnPqZNabAyisRcmTVUcDGQS8WAUkxFxwsXr3F9W/sITARSj9ANuJ7bNLb8E+XHes9QuL8eUZAoGAbl05dXEmOhBH4MgjdYVAbuhHdq+vBBJb1qQ/27zs9/h6mdI3srarQUTjtu1mehR5WjRNT/ebOcMhnxhW4qu0XnOay06g5m1olsSgKXz4g9XkRzJRrGdBV7hRase9HKgYnqfFYX3KcTaC0EpKh/Qn0VfiblMEGrfJuIlFQTaM/sECgYEAir1NdRF7uveDwYLB39yOMkKyqwG1jv+6aTMYEB0dQ6iMC665krNrmmYY79dn76bqxBdkRN6q5+xkMRuEHjL9b7ryuRblzkOxRhEp/8NRqeUgtGxZ5C3WJorm9Hyx6RelqXQGLVGKTqfsK1PHoym0Fn/oNq0qzIA0WfYqWJERyk0=";
        private static final byte[] BODY = ("{\"localId\":\"fixture-user\",\"email\":\"fixture@example.invalid\","
                + "\"idToken\":\"fixture-token\",\"refreshToken\":\"fixture-refresh\",\"expiresIn\":\"3600\"}").getBytes(StandardCharsets.UTF_8);
        final SSLContext tls;
        final X509TrustManager trust;
        final SSLServerSocket listener;
        final List<SSLSocket> sockets = new CopyOnWriteArrayList<>();
        final ExecutorService workers = Executors.newCachedThreadPool(task -> {
            Thread thread = new Thread(task, "fixture-tls-server");
            thread.setDaemon(true);
            return thread;
        });
        volatile boolean closed;

        TlsFixture() throws Exception {
            Certificate certificate = CertificateFactory.getInstance("X.509").generateCertificate(
                    new ByteArrayInputStream(Base64.decode(CERTIFICATE, Base64.DEFAULT)));
            PrivateKey key = KeyFactory.getInstance("RSA").generatePrivate(
                    new PKCS8EncodedKeySpec(Base64.decode(PRIVATE_KEY, Base64.DEFAULT)));
            KeyStore store = KeyStore.getInstance(KeyStore.getDefaultType());
            store.load(null, null);
            store.setKeyEntry("fixture", key, new char[0], new Certificate[]{certificate});
            KeyManagerFactory keys = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
            keys.init(store, new char[0]);
            KeyStore trusted = KeyStore.getInstance(KeyStore.getDefaultType());
            trusted.load(null, null);
            trusted.setCertificateEntry("fixture", certificate);
            TrustManagerFactory trusts = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
            trusts.init(trusted);
            trust = (X509TrustManager) trusts.getTrustManagers()[0];
            tls = SSLContext.getInstance("TLS");
            tls.init(keys.getKeyManagers(), trusts.getTrustManagers(), null);
            listener = (SSLServerSocket) tls.getServerSocketFactory().createServerSocket();
            listener.bind(new InetSocketAddress("127.0.0.1", 0));
            workers.execute(() -> {
                while (!closed) {
                    try {
                        SSLSocket socket = (SSLSocket) listener.accept();
                        sockets.add(socket);
                        workers.execute(() -> serve(socket));
                    } catch (IOException ignored) { if (!closed) throw new AssertionError("TLS fixture accept failed", ignored); }
                }
            });
        }

        String origin() { return "https://127.0.0.1:" + listener.getLocalPort(); }

        private void serve(SSLSocket socket) {
            try (SSLSocket connection = socket) {
                connection.setSoTimeout(15000);
                connection.startHandshake();
                InputStream input = connection.getInputStream();
                OutputStream output = connection.getOutputStream();
                while (!closed && readLine(input) != null) {
                    int contentLength = 0;
                    String header;
                    while ((header = readLine(input)) != null && !header.isEmpty()) {
                        int separator = header.indexOf(':');
                        if (separator > 0 && "Content-Length".equalsIgnoreCase(header.substring(0, separator))) {
                            contentLength = Integer.parseInt(header.substring(separator + 1).trim());
                        }
                    }
                    for (int count = 0; count < contentLength; count++) if (input.read() == -1) throw new IOException("Truncated body");
                    output.write(("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: " + BODY.length
                            + "\r\nConnection: keep-alive\r\n\r\n").getBytes(StandardCharsets.US_ASCII));
                    output.write(BODY);
                    output.flush();
                }
            } catch (IOException ignored) {
                // A client cancellation/eviction deliberately ends its fixture connection.
            } finally { sockets.remove(socket); }
        }

        private static String readLine(InputStream input) throws IOException {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            int value;
            while ((value = input.read()) != -1) {
                if (value == '\n') return bytes.toString("US-ASCII").replace("\r", "");
                bytes.write(value);
                if (bytes.size() > 8192) throw new IOException("Fixture header too long");
            }
            return bytes.size() == 0 ? null : bytes.toString("US-ASCII");
        }

        @Override public void close() throws Exception {
            closed = true;
            listener.close();
            for (SSLSocket socket : sockets) socket.close();
            workers.shutdownNow();
            assertTrue("TLS fixture workers must stop", workers.awaitTermination(5, TimeUnit.SECONDS));
        }
    }
}
