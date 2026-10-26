package com.example.recyclingshareapp.data.remote;

import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.system.ErrnoException;
import android.system.OsConstants;
import android.util.Log;

import org.json.JSONException;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.EOFException;
import java.io.InputStream;
import java.net.ConnectException;
import java.net.SocketException;
import java.net.SocketTimeoutException;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.HashSet;
import java.util.ArrayList;
import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeUnit;

import okhttp3.Call;
import okhttp3.ConnectionPool;
import okhttp3.Dispatcher;
import okhttp3.EventListener;
import okhttp3.FormBody;
import okhttp3.HttpUrl;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.ResponseBody;
import javax.net.ssl.SSLException;

/**
 * Firebase email/password authentication and EcoShare JSON API transport.
 * Tokens stay in memory; callbacks run on the main thread. Close this client when its owner is destroyed.
 */
public final class FirebaseBackendClient implements AutoCloseable {
    public static final int FIRST_PAGE_SIZE = 6;
    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");
    private static final int MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
    private static final int MAX_CACHED_JSON_CHARS = 64 * 1024;
    private static final int MAX_JSON_CACHE_CHARS = 256 * 1024;
    private static final int MAX_JSON_CACHE_ENTRIES = 30;
    private static final int MAX_HISTORY_CACHE_CHARS = 512 * 1024;
    private static final int MAX_MEDIA_CACHE_BYTES = 6 * 1024 * 1024;
    private static final int MAX_CACHED_MEDIA_BYTES = 768 * 1024;
    private static final String NETWORK_LOG_TAG = "EcoShareNetwork";
    // One process-wide daemon avoids leaving one cleanup executor behind for every screen/client.
    // Cancelling a call or evicting an idle socket can write TLS close_notify, so both belong off UI.
    private static final ExecutorService HTTP_CLEANUP = Executors.newSingleThreadExecutor(task -> {
        Thread thread = new Thread(task, "ecoshare-http-cleanup");
        thread.setDaemon(true);
        return thread;
    });
    private final URI apiBase;
    private final String apiKey;
    private final String identityBase;
    private final String tokenBase;
    private final boolean sparkLocal;
    private final boolean inlineEmulator;
    private OkHttpClient http;
    private final Handler main = new Handler(Looper.getMainLooper());
    // Auth and writes remain ordered; a slow screen read must not hold up another
    // screen, a comment or a like. Keep read concurrency bounded on mobile.
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final ExecutorService readWorker = Executors.newFixedThreadPool(3);
    // Foreground requests never wait behind a queue of speculative screen loads.
    private final ExecutorService prefetchWorker = Executors.newSingleThreadExecutor();
    private final ExecutorService mediaWorker = Executors.newFixedThreadPool(2);
    private final ExecutorService cacheWorker = Executors.newSingleThreadExecutor();
    private final OfflineSnapshotStore offlineStore;
    private final SessionVault sessionVault;
    private final String offlineScope;
    private final Object sessionLock = new Object();
    private final Object refreshLock = new Object();
    private volatile Session session;
    private final Set<Call> activeCalls = new HashSet<>();
    private final LinkedHashMap<String, CachedJson> jsonCache = new LinkedHashMap<>(16, .75f, true);
    private final LinkedHashMap<String, CachedJson> historyJson = new LinkedHashMap<>(16, .75f, true);
    private final Map<String, PendingJson> pendingJson = new HashMap<>();
    private final Map<String, ArrayList<Callback<JSONObject>>> delayedJsonReads = new HashMap<>();
    private int activeMutations;
    private final LinkedHashMap<String, CachedMedia> mediaCache = new LinkedHashMap<>(16, .75f, true);
    private final Map<String, PendingMedia> pendingMedia = new HashMap<>();
    private final ArrayDeque<String> mediaPrefetchQueue = new ArrayDeque<>();
    private final Set<String> mediaPrefetchSeen = new HashSet<>();
    private final Set<String> publicMediaIds = new HashSet<>();
    private final Set<String> publicContentIds = new HashSet<>();
    private final Set<String> publicListingIds = new HashSet<>();
    private boolean mediaPrefetchActive;
    private int cachedJsonChars;
    private int historyJsonChars;
    private int cachedMediaBytes;
    private volatile long cacheRevision;
    private volatile int generation;
    private volatile boolean closed;

    public interface Callback<T> {
        void onSuccess(T value);
        void onError(BackendException error);
    }

    public static final class BackendException extends Exception {
        public final int httpStatus;
        public final String code;
        public BackendException(int httpStatus, String code, String message) {
            super(message);
            this.httpStatus = httpStatus;
            this.code = code;
        }
    }

    public static final class SessionInfo {
        public final String uid;
        public final String email;
        private SessionInfo(String uid, String email) { this.uid = uid; this.email = email; }
    }

    private static final class Session {
        final String uid, email, idToken, refreshToken;
        final long expiresAtElapsed;
        Session(String uid, String email, String idToken, String refreshToken, long lifetimeSeconds) {
            this.uid = uid; this.email = email; this.idToken = idToken; this.refreshToken = refreshToken;
            this.expiresAtElapsed = SystemClock.elapsedRealtime() + lifetimeSeconds * 1000L;
        }
        SessionInfo info() { return new SessionInfo(uid, email); }
    }

    private static final class CachedJson {
        final String raw, uid;
        final long expiresAt, revision;
        CachedJson(String raw, String uid, long expiresAt, long revision) {
            this.raw = raw; this.uid = uid; this.expiresAt = expiresAt; this.revision = revision;
        }
    }

    private static final class PendingJson {
        final String key, uid;
        final long revision;
        final int generation;
        volatile boolean offlineResult;
        String staleRaw;
        final ArrayList<Callback<JSONObject>> listeners = new ArrayList<>();
        PendingJson(String key, String uid, long revision, int generation) {
            this.key = key; this.uid = uid; this.revision = revision; this.generation = generation;
        }
    }

    private static final class CachedMedia {
        final byte[] bytes;
        final String uid;
        final long expiresAt;
        CachedMedia(byte[] bytes, String uid, long expiresAt) {
            this.bytes = bytes; this.uid = uid; this.expiresAt = expiresAt;
        }
    }

    private static final class PendingMedia {
        final String uid;
        final int generation;
        final ArrayList<Callback<byte[]>> listeners = new ArrayList<>();
        PendingMedia(String uid, int generation) { this.uid = uid; this.generation = generation; }
    }

    /** Uses resources generated from app/google-services.json; does not perform a network request. */
    public static FirebaseBackendClient fromGoogleServices(Context context) {
        String projectId = googleServicesValue(context, "project_id");
        if (!projectId.matches("[a-z][a-z0-9-]{4,28}[a-z0-9]")) {
            throw new IllegalStateException("Invalid Firebase project_id in Google Services configuration");
        }
        String apiKey = googleServicesValue(context, "google_api_key");
        return new FirebaseBackendClient(context,
                "https://asia-southeast1-" + projectId + ".cloudfunctions.net/api/v1", apiKey);
    }

    /** Explicit debug opt-in: local Node backend, real Firebase Auth and the pinned Firestore project. */
    public static FirebaseBackendClient forSparkLocal(Context context) {
        boolean debug = (context.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        String projectId = googleServicesValue(context, "project_id");
        String base = BackendEndpointPolicy.validateSparkLocalBase("http://10.0.2.2:5002/v1", debug, projectId).toString();
        return new FirebaseBackendClient(context, base, googleServicesValue(context, "google_api_key"), null, true);
    }

    /** Separate debug fixture server: Firestore inline media with demo Auth, never cloud credentials. */
    public static FirebaseBackendClient forInlineEmulator(Context context) {
        if ((context.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) == 0)
            throw new IllegalArgumentException("Inline media emulator is only available in debug builds");
        return new FirebaseBackendClient(context,"http://10.0.2.2:5003/v1","demo-key","http://10.0.2.2:9099",false,true);
    }

    private static String googleServicesValue(Context context, String name) {
        int resource = context.getResources().getIdentifier(name, "string", context.getPackageName());
        if (resource == 0 || context.getString(resource).trim().isEmpty()) {
            throw new IllegalStateException("Missing Firebase configuration: add app/google-services.json and sync Gradle");
        }
        return context.getString(resource).trim();
    }

    /** Production: apiBase is the deployed HTTPS API URL and webApiKey is the Firebase client API key. */
    public FirebaseBackendClient(Context context, String apiBase, String webApiKey) {
        this(context, apiBase, webApiKey, null);
    }

    /** Debug emulator: authEmulatorOrigin is http://10.0.2.2:9099 or http://127.0.0.1:9099. */
    public FirebaseBackendClient(Context context, String apiBase, String webApiKey, String authEmulatorOrigin) {
        this(context, apiBase, webApiKey, authEmulatorOrigin, false);
    }

    private FirebaseBackendClient(Context context, String apiBase, String webApiKey, String authEmulatorOrigin, boolean sparkLocal) {
        this(context,apiBase,webApiKey,authEmulatorOrigin,sparkLocal,false);
    }

    private FirebaseBackendClient(Context context, String apiBase, String webApiKey, String authEmulatorOrigin, boolean sparkLocal, boolean inlineEmulator) {
        boolean debuggable = (context.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        this.apiBase = BackendEndpointPolicy.validateBase(apiBase, debuggable);
        this.offlineScope = this.apiBase.toString();
        this.offlineStore = new OfflineSnapshotStore(context);
        this.sessionVault = new SessionVault(context);
        this.sparkLocal = sparkLocal;
        this.inlineEmulator = inlineEmulator;
        if (inlineEmulator && (!debuggable || sparkLocal || !"http://10.0.2.2:5003/v1/".equals(this.apiBase.toString())
                || !"demo-key".equals(webApiKey) || !"http://10.0.2.2:9099".equals(authEmulatorOrigin))) {
            throw new IllegalArgumentException("Inline emulator requires the isolated local demo server and Auth Emulator");
        }
        if (sparkLocal) {
            BackendEndpointPolicy.validateSparkLocalBase(apiBase, debuggable, googleServicesValue(context, "project_id"));
            if (authEmulatorOrigin != null) throw new IllegalArgumentException("Spark mode uses real Firebase Authentication");
        }
        if (webApiKey == null || !webApiKey.matches("[A-Za-z0-9_-]{1,512}")) {
            throw new IllegalArgumentException("Provide the Firebase Web API key; use demo-key only with Auth Emulator");
        }
        this.apiKey = webApiKey;
        if (authEmulatorOrigin == null) {
            if ("http".equals(this.apiBase.getScheme()) && !sparkLocal) throw new IllegalArgumentException("A local API must use Auth Emulator or the explicit Spark debug factory");
            identityBase = "https://identitytoolkit.googleapis.com/v1/";
            tokenBase = "https://securetoken.googleapis.com/v1/";
        } else {
            URI auth = BackendEndpointPolicy.validateBase(authEmulatorOrigin, debuggable);
            boolean local = "10.0.2.2".equals(auth.getHost()) || "127.0.0.1".equals(auth.getHost());
            if (!debuggable || !local || !"http".equals(auth.getScheme()) || !"/".equals(auth.getPath())
                    || !auth.getHost().equals(this.apiBase.getHost()) || !"http".equals(this.apiBase.getScheme())) {
                throw new IllegalArgumentException("Auth Emulator and API must both use the same local debug host");
            }
            identityBase = auth + "identitytoolkit.googleapis.com/v1/";
            tokenBase = auth + "securetoken.googleapis.com/v1/";
        }
        http = new OkHttpClient.Builder().connectTimeout(15, TimeUnit.SECONDS).readTimeout(30, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS).callTimeout(45, TimeUnit.SECONDS)
                .followRedirects(false).followSslRedirects(false).retryOnConnectionFailure(false)
                .eventListenerFactory(call -> debuggable ? networkDiagnostics(call.request()) : EventListener.NONE).build();
        restoreSessionFromVault();
    }

    public boolean isSignedIn() { return session != null && !closed; }
    public boolean isSparkLocal() { return sparkLocal; }
    public SessionInfo currentSession() { Session current = session; return current == null ? null : current.info(); }
    JSONObject cachedOwnProfile() { Session current = session; return current == null ? null : sessionVault.readProfile(current.uid); }
    void saveOwnProfile(JSONObject value) {
        Session current = session;
        if (current == null || value == null || closed) return;
        String uid = current.uid, raw = value.toString();
        int version = generation;
        try {
            cacheWorker.execute(() -> {
                if (closed || generation != version || session == null || !uid.equals(session.uid)) return;
                try { sessionVault.writeProfile(uid, new JSONObject(raw)); }
                catch (JSONException ignored) { }
            });
        } catch (RejectedExecutionException ignored) { }
    }

    public void signUp(String email, String password, Callback<SessionInfo> callback) {
        authenticate("accounts:signUp", email, password, callback);
    }
    public void signIn(String email, String password, Callback<SessionInfo> callback) {
        authenticate("accounts:signInWithPassword", email, password, callback);
    }
    /** Exchange the Google Credential Manager ID token for this project's Firebase session. */
    public void signInWithGoogleIdToken(String googleIdToken, Callback<SessionInfo> callback) {
        execute(version -> {
            if (googleIdToken == null || googleIdToken.length() > 8192
                    || !googleIdToken.matches("[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+")) {
                throw new BackendException(400, "INVALID_GOOGLE_TOKEN", "Không nhận được thông tin đăng nhập Google hợp lệ.");
            }
            JSONObject body = new JSONObject()
                    .put("postBody", "id_token=" + googleIdToken + "&providerId=google.com")
                    .put("requestUri", "http://localhost")
                    .put("returnSecureToken", true);
            JSONObject result = send(authUrl(identityBase, "accounts:signInWithIdp"), "POST",
                    RequestBody.create(body.toString(), JSON), null, null, version);
            Session next = new Session(result.getString("localId"), result.optString("email", ""),
                    result.getString("idToken"), result.getString("refreshToken"), lifetime(result.getString("expiresIn")));
            install(next, version);
            return next.info();
        }, callback);
    }
    private void authenticate(String action, String email, String password, Callback<SessionInfo> callback) {
        execute(version -> {
            if (email == null || email.trim().isEmpty() || email.length() > 254 || password == null || password.isEmpty() || password.length() > 4096) {
                throw new BackendException(400, "INVALID_CREDENTIALS", "Vui lòng nhập email và mật khẩu hợp lệ.");
            }
            JSONObject body = new JSONObject().put("email", email.trim()).put("password", password).put("returnSecureToken", true);
            JSONObject result = send(authUrl(identityBase, action), "POST", RequestBody.create(body.toString(), JSON), null, null, version);
            Session next = new Session(result.getString("localId"), result.optString("email", email.trim()), result.getString("idToken"),
                    result.getString("refreshToken"), lifetime(result.getString("expiresIn")));
            install(next, version);
            return next.info();
        }, callback);
    }

    public void refreshSession(Callback<SessionInfo> callback) {
        execute(version -> refresh(requireSession(), version).info(), callback);
    }

    public void getMe(Callback<JSONObject> callback) { requestFresh("/me", callback); }

    public void resetPassword(String email, Callback<JSONObject> callback) {
        execute(version -> send(authUrl(identityBase, "accounts:sendOobCode"), "POST",
                RequestBody.create(new JSONObject().put("requestType", "PASSWORD_RESET").put("email", email.trim()).toString(), JSON),
                null, null, version), callback);
    }

    /** Uploads to the one-time server slot, then finalizes the Firestore media record. */
    public void uploadMedia(String parentKind, String parentId, String mime, byte[] bytes, Callback<JSONObject> callback) {
        if (bytes == null || bytes.length == 0 || bytes.length > 10 * 1024 * 1024) throw new IllegalArgumentException("Ảnh phải nhỏ hơn 10 MB");
        if (!java.util.Arrays.asList("image/jpeg", "image/png", "image/webp", "video/mp4", "application/pdf").contains(mime)) throw new IllegalArgumentException("Định dạng ảnh hoặc video chưa được hỗ trợ");
        invalidateCachedJson();
        final byte[] copied = bytes.clone();
        execute(version -> {
            Session current = freshSession(version);
            JSONObject ticket = send(apiUrl("/media"), "POST", RequestBody.create(new JSONObject().put("parent_kind", parentKind)
                    .put("parent_id", parentId).put("content_type", mime).toString(), JSON), current.idToken, null, version);
            String mode = ticket.optString("upload_mode", "STORAGE");
            if ("FIRESTORE".equals(mode)) {
                if (!sparkLocal && !inlineEmulator) throw new BackendException(502, "UNEXPECTED_UPLOAD_MODE", "Kho ảnh không khớp với chế độ kết nối đã chọn.");
                String mediaId = ticket.getString("id");
                int maximum = ticket.getInt("max_bytes");
                if (maximum < 1 || maximum > 384 * 1024) throw new BackendException(502, "INVALID_UPLOAD_SLOT", "Giới hạn ảnh từ máy chủ không hợp lệ.");
                if (copied.length > maximum) throw new BackendException(400, "MEDIA_TOO_LARGE", "Tệp cần nhỏ hơn 384 KB để lưu trực tiếp trên gói miễn phí Firebase.");
                HttpUrl target = HttpUrl.get(BackendEndpointPolicy.firestoreUploadPath(apiBase, mediaId, ticket.getString("upload_path")).toString());
                send(target, "PUT", RequestBody.create(copied, MediaType.get(mime)), current.idToken, null, version);
                return send(apiUrl("/media/" + mediaId + "/complete"), "POST", RequestBody.create("{}", JSON), current.idToken, null, version);
            }
            if (!"STORAGE".equals(mode) || sparkLocal || inlineEmulator) throw new BackendException(502, "UNEXPECTED_UPLOAD_MODE", "Kho ảnh không khớp với chế độ kết nối đã chọn.");
            String bucket = ticket.getString("bucket"), key = ticket.getString("storage_key"), mediaId = ticket.getString("id");
            if (!bucket.matches("[a-zA-Z0-9._-]{3,222}") || !key.startsWith("uploads/" + current.uid + "/")) throw new BackendException(502, "INVALID_UPLOAD_SLOT", "Phiên tải ảnh không hợp lệ.");
            HttpUrl.Builder upload = "http".equals(apiBase.getScheme())
                    ? new HttpUrl.Builder().scheme("http").host(apiBase.getHost()).port(9199)
                    : new HttpUrl.Builder().scheme("https").host("firebasestorage.googleapis.com");
            HttpUrl target = upload.addPathSegment("v0").addPathSegment("b").addPathSegment(bucket).addPathSegment("o")
                    .addQueryParameter("name", key).build();
            RequestBody multipart = storageMultipart(
                    new JSONObject().put("name", key).put("contentType", mime).toString(), mime, copied);
            Request uploadRequest = new Request.Builder().url(target).post(multipart).header("Authorization", "Firebase " + current.idToken)
                    .header("X-Goog-Upload-Protocol", "multipart").build();
            Call call = newCall(uploadRequest, version);
            try (Response response = call.execute()) {
                if (!response.isSuccessful()) throw new BackendException(response.code(), "UPLOAD_FAILED", "Chưa tải được ảnh lên Firebase Storage (" + response.code() + ").");
            } catch (IOException | SecurityException error) {
                throw transportFailure(error, target);
            } finally { finished(call); }
            return send(apiUrl("/media/" + mediaId + "/complete"), "POST", RequestBody.create("{}", JSON), current.idToken, null, version);
        }, new Callback<JSONObject>() {
            @Override public void onSuccess(JSONObject value) { invalidatePublicSnapshots(); callback.onSuccess(value); }
            @Override public void onError(BackendException error) { invalidateCachedJson(); callback.onError(error); }
        });
    }

    private static RequestBody storageMultipart(String metadata, String mime, byte[] bytes) {
        String boundary = "ecoshare-" + java.util.UUID.randomUUID();
        // Firebase Storage Emulator expects Content-Type as each part's only header.
        // OkHttp MultipartBody adds a per-part Content-Length which it misreads as file bytes.
        byte[] prefix = ("--" + boundary + "\r\nContent-Type: application/json; charset=utf-8\r\n\r\n"
                + metadata + "\r\n--" + boundary + "\r\nContent-Type: " + mime + "\r\n\r\n")
                .getBytes(java.nio.charset.StandardCharsets.UTF_8);
        byte[] suffix = ("\r\n--" + boundary + "--\r\n").getBytes(java.nio.charset.StandardCharsets.UTF_8);
        return new RequestBody() {
            @Override public MediaType contentType() { return MediaType.get("multipart/related; boundary=" + boundary); }
            @Override public long contentLength() { return (long) prefix.length + bytes.length + suffix.length; }
            @Override public void writeTo(okio.BufferedSink sink) throws IOException {
                sink.write(prefix); sink.write(bytes); sink.write(suffix);
            }
        };
    }

    /** Private files always pass through the API; never attach the Firebase token to a signed URL. */
    public void downloadMedia(String id, Callback<byte[]> callback) {
        if (id == null || !id.matches("[A-Za-z0-9_-]{1,128}")) throw new IllegalArgumentException("Invalid media identifier");
        if (callback == null) throw new IllegalArgumentException("Callback required");
        final PendingMedia pending;
        synchronized (sessionLock) {
            Session current = session;
            if (current == null || closed) {
                if (closed) throw new IllegalStateException("Client is closed");
                int version = generation;
                mediaWorker.execute(() -> {
                    byte[] offline = readOfflineImage(id);
                    if (offline != null) main.post(() -> {
                        if (!closed && generation == version && session == null) callback.onSuccess(offline);
                    });
                    else downloadMediaFresh(id, new Callback<byte[]>() {
                        @Override public void onSuccess(byte[] bytes) {
                            savePublicImage(id, bytes, version);
                            callback.onSuccess(bytes);
                        }
                        @Override public void onError(BackendException error) { callback.onError(error); }
                    });
                });
                return;
            }
            CachedMedia cached = mediaCache.get(id);
            if (cached != null && current.uid.equals(cached.uid) && cached.expiresAt > SystemClock.elapsedRealtime()) {
                int version = generation;
                String uid = current.uid;
                byte[] bytes = cached.bytes.clone();
                main.post(() -> {
                    if (!closed && generation == version && session != null && uid.equals(session.uid)) callback.onSuccess(bytes);
                });
                return;
            }
            if (cached != null) removeCachedMediaLocked(id);
            PendingMedia existing = pendingMedia.get(id);
            if (existing != null && existing.generation == generation && existing.uid.equals(current.uid)) {
                existing.listeners.add(callback);
                return;
            }
            pending = new PendingMedia(current.uid, generation);
            pending.listeners.add(callback);
            pendingMedia.put(id, pending);
        }
        downloadMediaFresh(id, new Callback<byte[]>() {
            @Override public void onSuccess(byte[] bytes) {
                savePublicImage(id, bytes, pending.generation);
                finishCachedMedia(id, pending, bytes, null);
            }
            @Override public void onError(BackendException error) {
                if (!offlineFailure(error)) { finishCachedMedia(id, pending, null, error); return; }
                try {
                    mediaWorker.execute(() -> {
                        byte[] bytes = readOfflineImage(id);
                        main.post(() -> finishCachedMedia(id, pending, bytes, bytes == null ? error : null));
                    });
                } catch (RejectedExecutionException ignored) { finishCachedMedia(id, pending, null, error); }
            }
        });
    }

    private void finishCachedMedia(String id, PendingMedia pending, byte[] bytes, BackendException error) {
        final ArrayList<Callback<byte[]>> listeners;
        synchronized (sessionLock) {
            if (pendingMedia.get(id) != pending) return;
            pendingMedia.remove(id);
            if (closed || generation != pending.generation || session == null || !pending.uid.equals(session.uid)) return;
            listeners = new ArrayList<>(pending.listeners);
            if (bytes != null && bytes.length <= MAX_CACHED_MEDIA_BYTES) {
                CachedMedia previous = mediaCache.put(id, new CachedMedia(bytes.clone(), pending.uid,
                        SystemClock.elapsedRealtime() + 5 * 60_000L));
                if (previous != null) cachedMediaBytes -= previous.bytes.length;
                cachedMediaBytes += bytes.length;
                while (cachedMediaBytes > MAX_MEDIA_CACHE_BYTES) {
                    Map.Entry<String, CachedMedia> oldest = mediaCache.entrySet().iterator().next();
                    removeCachedMediaLocked(oldest.getKey());
                }
            }
        }
        for (Callback<byte[]> listener : listeners) {
            if (closed || generation != pending.generation || session == null || !pending.uid.equals(session.uid)) break;
            if (error != null) listener.onError(error);
            else listener.onSuccess(bytes.clone());
        }
    }

    private void removeCachedMediaLocked(String id) {
        CachedMedia previous = mediaCache.remove(id);
        if (previous != null) cachedMediaBytes -= previous.bytes.length;
    }

    private void clearMediaLocked() {
        mediaCache.clear();
        pendingMedia.clear();
        mediaPrefetchQueue.clear();
        mediaPrefetchSeen.clear();
        mediaPrefetchActive = false;
        publicMediaIds.clear();
        publicContentIds.clear();
        publicListingIds.clear();
        cachedMediaBytes = 0;
    }

    private byte[] readOfflineImage(String id) {
        try {
            Future<byte[]> result = cacheWorker.submit(() -> offlineStore.image(offlineScope, id));
            return result.get();
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            return null;
        } catch (Exception error) {
            return null;
        }
    }

    private void savePublicImage(String id, byte[] bytes, int version) {
        if (bytes == null || bytes.length > MAX_CACHED_MEDIA_BYTES) return;
        synchronized (sessionLock) {
            if (closed || generation != version || !publicMediaIds.contains(id)) return;
        }
        byte[] copy = bytes.clone();
        try {
            cacheWorker.execute(() -> {
                synchronized (sessionLock) {
                    if (closed || generation != version) return;
                }
                offlineStore.putImage(offlineScope, id, copy);
            });
        } catch (RejectedExecutionException ignored) { }
    }

    private void downloadMediaFresh(String id, Callback<byte[]> callback) {
        executeOn(mediaWorker, version -> {
            Session current = session == null ? null : freshSession(version);
            Request.Builder builder = new Request.Builder().url(apiUrl("/media/" + id + "/download"));
            if (current != null) builder.header("Authorization", "Bearer " + current.idToken);
            Request request = builder.build();
            Object payload = executeResponse(request, version, response -> {
                if (!response.isSuccessful()) throw new BackendException(response.code(), "MEDIA_UNAVAILABLE", "Không tải được ảnh hoặc bạn không có quyền xem.");
                ResponseBody body = response.body();
                if (body == null) throw new BackendException(502, "EMPTY_MEDIA", "Ảnh chưa sẵn sàng.");
                if (body.contentType() != null && body.contentType().toString().startsWith("application/json")) return new JSONObject(readBounded(body)).getString("url");
                else return readBytes(body, 10 * 1024 * 1024);
            });
            if (payload instanceof byte[]) return (byte[]) payload;
            HttpUrl signed = HttpUrl.get((String) payload);
            if (!"https".equals(signed.scheme()) || !("storage.googleapis.com".equals(signed.host()) || signed.host().endsWith(".storage.googleapis.com"))) throw new BackendException(502, "INVALID_MEDIA_URL", "Đường dẫn ảnh không hợp lệ.");
            return executeResponse(new Request.Builder().url(signed).get().build(), version, response -> {
                if (!response.isSuccessful() || response.body() == null) throw new BackendException(response.code(), "MEDIA_UNAVAILABLE", "Ảnh tạm thời chưa tải được.");
                return readBytes(response.body(), 10 * 1024 * 1024);
            });
        }, callback);
    }

    private Session freshSession(int version) throws BackendException, IOException, JSONException {
        Session current = requireSession();
        return current.expiresAtElapsed <= SystemClock.elapsedRealtime() + 60_000L ? refresh(current, version) : current;
    }

    private static byte[] readBytes(ResponseBody body, int limit) throws IOException, BackendException {
        if (body.contentLength() > limit) throw new BackendException(502, "MEDIA_TOO_LARGE", "Ảnh quá lớn.");
        try (InputStream input = body.byteStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192]; int count, total = 0;
            while ((count = input.read(buffer)) != -1) { total += count; if (total > limit) throw new BackendException(502, "MEDIA_TOO_LARGE", "Ảnh quá lớn."); output.write(buffer, 0, count); }
            return output.toByteArray();
        }
    }

    /** Use the same idempotency key for retries of a create-order/payment/message request. */
    public void request(String method, String path, JSONObject body, String idempotencyKey, Callback<JSONObject> callback) {
        if (callback == null) throw new IllegalArgumentException("Callback required");
        if ("GET".equalsIgnoreCase(method) && body == null && cacheableJsonPath(path) && isSignedIn()) {
            requestCachedJson(path, readWorker, callback);
            return;
        }
        boolean mutation = method != null && !"GET".equalsIgnoreCase(method);
        if (mutation) {
            synchronized (sessionLock) {
                activeMutations++;
                invalidateCachedJsonLocked();
            }
        }
        final String copiedBody = body == null ? null : body.toString();
        executeOn(mutation ? worker : readWorker, version -> {
            HttpUrl url = apiUrl(path);
            String verb = checkedMethod(method);
            RequestBody requestBody = jsonBody(verb, copiedBody);
            Session current = requireSession();
            if (current.expiresAtElapsed <= SystemClock.elapsedRealtime() + 60_000L) current = refresh(current, version);
            try { return send(url, verb, requestBody, current.idToken, idempotencyKey, version); }
            catch (BackendException error) {
                if (error.httpStatus != 401) throw error;
                current = refresh(current, version);
                return send(url, verb, requestBody, current.idToken, idempotencyKey, version);
            }
        }, mutation ? new Callback<JSONObject>() {
            @Override public void onSuccess(JSONObject value) {
                // A read started while this write ran must not become the next screen's cache.
                finishMutation(true);
                callback.onSuccess(value);
            }
            @Override public void onError(BackendException error) {
                finishMutation(false);
                callback.onError(error);
            }
        } : callback);
    }

    /** Read through the network even when a short-lived UI cache entry exists. Offline snapshots still apply. */
    public void requestFresh(String path, Callback<JSONObject> callback) {
        if (callback == null) throw new IllegalArgumentException("Callback required");
        if (cacheableJsonPath(path) && isSignedIn()) requestCachedJson(path, readWorker, callback, true);
        else request("GET", path, null, null, callback);
    }

    /** Detached, short-lived snapshot for drawing a first page without a loading placeholder. */
    public JSONObject cachedJson(String path) {
        final String raw;
        synchronized (sessionLock) {
            CachedJson entry = jsonCache.get(path);
            Session current = session;
            if (closed || current == null || entry == null || !current.uid.equals(entry.uid)
                    || entry.revision != cacheRevision || entry.expiresAt <= SystemClock.elapsedRealtime()) {
                // Keep an expired entry until a network attempt finishes: it can still
                // serve this same signed-in user when the device goes offline.
                if (entry != null && (current == null || !current.uid.equals(entry.uid) || entry.revision != cacheRevision))
                    removeCachedJsonLocked(path);
                return null;
            }
            raw = entry.raw;
        }
        try { return new JSONObject(raw); }
        catch (JSONException impossible) { return null; }
    }

    /** Start the home first page as soon as Auth succeeds, concurrently with the /me request. */
    public void prefetchFirstPosts() {
        prefetchJson("/posts?limit=" + FIRST_PAGE_SIZE, new Callback<JSONObject>() {
            @Override public void onSuccess(JSONObject value) { prefetchFirstImages(value); }
            @Override public void onError(BackendException error) { }
        });
    }

    /** Warm nearby screens serially; the foreground worker remains available for user actions. */
    public void prefetchRemainingScreens() {
        Session current = session;
        if (current == null || closed) return;
        String uid = current.uid;
        if (!uid.matches("[A-Za-z0-9_-]{1,128}")) return;
        String pageLimit = "&limit=" + FIRST_PAGE_SIZE;
        String[] paths = { "/tips?limit=" + FIRST_PAGE_SIZE, "/challenges?limit=" + FIRST_PAGE_SIZE,
                "/listings?limit=" + FIRST_PAGE_SIZE, "/stories?limit=12", "/notifications?limit=" + FIRST_PAGE_SIZE,
                "/friends?tab=requests&q=" + pageLimit, "/posts?author_id=" + uid + pageLimit,
                "/conversations?limit=" + FIRST_PAGE_SIZE };
        prefetchSequence(paths, 0, generation, uid);
    }

    private void prefetchSequence(String[] paths, int index, int version, String uid) {
        if (index >= paths.length || closed || generation != version || session == null || !uid.equals(session.uid)) return;
        prefetchJson(paths[index], new Callback<JSONObject>() {
            @Override public void onSuccess(JSONObject value) {
                if (paths[index].startsWith("/tips?")) prefetchFirstImages(value);
                prefetchSequence(paths, index + 1, version, uid);
            }
            @Override public void onError(BackendException error) { prefetchSequence(paths, index + 1, version, uid); }
        });
    }

    private void prefetchFirstImages(JSONObject page) {
        JSONArray entries = page.optJSONArray("items");
        if (entries == null) return;
        synchronized (sessionLock) {
            for (int i = 0; i < Math.min(entries.length(), 3); i++) {
                JSONObject item = entries.optJSONObject(i);
                JSONArray media = item == null ? null : item.optJSONArray("media");
                JSONObject first = media == null ? null : media.optJSONObject(0);
                String id = first == null ? "" : first.optString("id", "");
                if (id.matches("[A-Za-z0-9_-]{1,128}") && mediaPrefetchSeen.add(id)) mediaPrefetchQueue.addLast(id);
            }
        }
        nextMediaPrefetch();
    }

    private void nextMediaPrefetch() {
        final String id;
        synchronized (sessionLock) {
            if (mediaPrefetchActive || closed || session == null) return;
            id = mediaPrefetchQueue.pollFirst();
            if (id == null) return;
            mediaPrefetchActive = true;
        }
        downloadMedia(id, new Callback<byte[]>() {
            @Override public void onSuccess(byte[] bytes) { finishMediaPrefetch(); }
            @Override public void onError(BackendException error) { finishMediaPrefetch(); }
        });
    }

    private void finishMediaPrefetch() {
        synchronized (sessionLock) { mediaPrefetchActive = false; }
        nextMediaPrefetch();
    }

    private void prefetchJson(String path, Callback<JSONObject> callback) {
        Callback<JSONObject> next = callback == null ? new Callback<JSONObject>() {
            @Override public void onSuccess(JSONObject value) { }
            @Override public void onError(BackendException error) { }
        } : callback;
        if (!closed && isSignedIn()) requestCachedJson(path, prefetchWorker, next);
    }

    private static boolean cacheableJsonPath(String path) {
        if (path == null) return false;
        if (publicOfflineJsonPath(path)) return true;
        if (path.length() <= 512 && (path.equals("/me") || path.startsWith("/me/")
                || path.equals("/notifications") || path.startsWith("/notifications?")
                || path.equals("/friends") || path.startsWith("/friends?")
                || path.equals("/orders") || path.startsWith("/orders/") || path.startsWith("/orders?")
                || path.equals("/scans") || path.startsWith("/scans/") || path.startsWith("/scans?")
                || path.equals("/conversations") || path.startsWith("/conversations?")
                || path.startsWith("/conversations/") || path.equals("/message-requests") || path.startsWith("/message-requests?")
                || path.equals("/challenges") || path.startsWith("/challenges?"))) return true;
        if (path.matches("/(posts|tips|listings)\\?limit=(3|6)")) return true;
        if (path.matches("/notifications\\?limit=(3|6)")) return true;
        if (path.matches("/friends\\?tab=(requests|friends|suggestions)&q=&limit=(3|6)")) return true;
        return path.matches("/(posts|tips)\\?author_id=[A-Za-z0-9_-]{1,128}&limit=(3|6)");
    }

    private static boolean publicOfflineJsonPath(String path) {
        if (path == null || path.length() > 512) return false;
        String id = "[A-Za-z0-9_-]{1,128}";
        String cursor = "(&cursor=" + id + ")?";
        return path.matches("/(posts|tips|listings|challenges)\\?limit=[1-9][0-9]?" + cursor)
                || path.matches("/explore/search\\?q=[A-Za-z0-9%+_.~-]{1,450}&limit=[1-9][0-9]{0,2}")
                || path.matches("/challenges\\?limit=[1-9][0-9]?" + cursor)
                || path.matches("/(posts|tips)\\?author_id=" + id + "&limit=[1-9][0-9]?" + cursor)
                || path.matches("/(posts|tips|listings)/" + id)
                || path.matches("/(posts|tips)/" + id + "/comments(\\?cursor=" + id + ")?")
                || path.matches("/media\\?parent_kind=LISTING&parent_id=" + id);
    }

    private static boolean offlineFailure(BackendException error) {
        if (error.httpStatus == 502 || error.httpStatus == 503 || error.httpStatus == 504) return true;
        return error.httpStatus == 0 && (error.code.startsWith("NETWORK_")
                || "SERVER_UNAVAILABLE".equals(error.code) || "LOCAL_BACKEND_UNAVAILABLE".equals(error.code)
                || "SECURE_CONNECTION_FAILED".equals(error.code) || "LOCAL_NETWORK_PERMISSION_REQUIRED".equals(error.code));
    }

    private String readOfflinePage(String path) {
        if (!publicOfflineJsonPath(path)) return null;
        try {
            Future<String> result = cacheWorker.submit(() -> offlineStore.page(offlineScope, path));
            return result.get();
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            return null;
        } catch (Exception error) {
            return null;
        }
    }

    /** Only published content is durable; reaction flags are specific to the online account. */
    private String publicSnapshot(String path, JSONObject value, int version) {
        if (!publicOfflineJsonPath(path) || value == null) return null;
        String expectedStatus = path.startsWith("/listings") ? "APPROVED" : "PUBLISHED";
        boolean comments = path.matches("/(posts|tips)/[A-Za-z0-9_-]{1,128}/comments(\\?.*)?");
        boolean listingMedia = path.startsWith("/media?parent_kind=LISTING&parent_id=");
        boolean listingDetail = path.matches("/listings/[A-Za-z0-9_-]{1,128}");
        String parentId = "";
        if (comments) parentId = path.split("/")[2];
        else if (listingMedia) parentId = path.substring(path.indexOf("parent_id=") + 10);
        synchronized (sessionLock) {
            if (closed || generation != version) return null;
            if (comments && !publicContentIds.contains(parentId)) return null;
            if (listingMedia && !publicListingIds.contains(parentId)) return null;
        }
        try {
            JSONObject clean = new JSONObject(value.toString());
            JSONArray rows = clean.optJSONArray("items");
            if (listingDetail) {
                if (!"APPROVED".equals(clean.optString("status"))) return null;
            } else if (rows != null) {
                for (int i = 0; i < rows.length(); i++) {
                    JSONObject row = rows.optJSONObject(i);
                    String rowStatus = row == null ? "" : ("LISTING".equals(row.optString("kind")) ? "APPROVED" : expectedStatus);
                    if (row == null || (!comments && !listingMedia && !rowStatus.equals(row.optString("status")))) return null;
                    row.remove("liked");
                    row.remove("saved");
                    row.remove("completed");
                }
            } else if (!comments && !listingMedia && !expectedStatus.equals(clean.optString("status"))) return null;
            clean.remove("liked");
            clean.remove("saved");
            synchronized (sessionLock) {
                if (closed || generation != version) return null;
                if (rows == null || listingDetail) rememberPublicContent(path, clean);
                else for (int i = 0; i < rows.length(); i++) rememberPublicContent(path, rows.optJSONObject(i));
            }
            return clean.toString();
        } catch (JSONException error) {
            return null;
        }
    }

    /** Called with sessionLock held. */
    private void rememberPublicContent(String path, JSONObject row) {
        if (row == null) return;
        String id = row.optString("id", "");
        if (path.startsWith("/posts") || path.startsWith("/tips")) {
            if (!path.contains("/comments") && id.matches("[A-Za-z0-9_-]{1,128}")) publicContentIds.add(id);
        } else if (path.startsWith("/listings") && id.matches("[A-Za-z0-9_-]{1,128}")) publicListingIds.add(id);
        if (path.startsWith("/media?")) {
            if (id.matches("[A-Za-z0-9_-]{1,128}")) publicMediaIds.add(id);
        } else {
            JSONArray media = row.optJSONArray("media");
            if (media != null) for (int i = 0; i < media.length(); i++) {
                JSONObject image = media.optJSONObject(i);
                String mediaId = image == null ? "" : image.optString("id", "");
                if (mediaId.matches("[A-Za-z0-9_-]{1,128}")) publicMediaIds.add(mediaId);
            }
        }
    }

    private void savePublicPage(String path, JSONObject value, int version, long revision) {
        String raw = publicSnapshot(path, value, version);
        if (raw == null || raw.length() > MAX_CACHED_JSON_CHARS) return;
        try {
            cacheWorker.execute(() -> {
                synchronized (sessionLock) {
                    if (closed || generation != version || cacheRevision != revision) return;
                }
                offlineStore.putPage(offlineScope, path, raw);
            });
        } catch (RejectedExecutionException ignored) { }
    }

    private void requestCachedJson(String path, ExecutorService executor, Callback<JSONObject> callback) {
        requestCachedJson(path, executor, callback, false);
    }

    private void requestCachedJson(String path, ExecutorService executor, Callback<JSONObject> callback, boolean fresh) {
        if (callback == null) throw new IllegalArgumentException("Callback required");
        final PendingJson pending;
        synchronized (sessionLock) {
            Session current = session;
            if (closed || current == null) {
                executeOn(executor, version -> { throw new BackendException(401, "SIGN_IN_REQUIRED", "Vui lòng đăng nhập trước."); }, callback);
                return;
            }
            if (activeMutations > 0) {
                delayedJsonReads.computeIfAbsent(path, ignored -> new ArrayList<>()).add(callback);
                return;
            }
            CachedJson entry = jsonCache.get(path);
            if (!fresh && entry != null && current.uid.equals(entry.uid) && entry.revision == cacheRevision
                    && entry.expiresAt > SystemClock.elapsedRealtime()) {
                int version = generation;
                long revision = cacheRevision;
                String uid = current.uid, raw = entry.raw;
                main.post(() -> {
                    if (!closed && generation == version && session != null && uid.equals(session.uid)) {
                        if (cacheRevision != revision) requestCachedJson(path, readWorker, callback, fresh);
                        else {
                            try { callback.onSuccess(new JSONObject(raw)); }
                            catch (JSONException impossible) { callback.onError(new BackendException(502, "INVALID_SERVER_RESPONSE", "Dữ liệu bộ nhớ đệm không hợp lệ.")); }
                        }
                    }
                });
                return;
            }
            String staleRaw = entry != null && current.uid.equals(entry.uid) && entry.revision == cacheRevision
                    ? entry.raw : null;
            if (staleRaw == null) {
                CachedJson historical = historyJson.get(path);
                if (historical != null && current.uid.equals(historical.uid)) staleRaw = historical.raw;
            }
            if (entry != null && staleRaw == null) removeCachedJsonLocked(path);
            String key = cacheRevision + "|" + path;
            PendingJson existing = pendingJson.get(key);
            if (existing != null && existing.generation == generation && existing.uid.equals(current.uid)) {
                existing.listeners.add(callback);
                return;
            }
            pending = new PendingJson(key, current.uid, cacheRevision, generation);
            pending.staleRaw = staleRaw;
            pending.listeners.add(callback);
            pendingJson.put(key, pending);
        }
        executeOn(executor, version -> {
            if (version != pending.generation) throw new BackendException(0, "CANCELLED", "Thao tác đã hủy.");
            HttpUrl url = apiUrl(path);
            try {
                Session current = freshSession(version);
                try { return send(url, "GET", null, current.idToken, null, version); }
                catch (BackendException error) {
                    if (error.httpStatus != 401) throw error;
                    current = refresh(current, version);
                    return send(url, "GET", null, current.idToken, null, version);
                }
            } catch (BackendException error) {
                if (offlineFailure(error)) {
                    String raw = pending.staleRaw != null ? pending.staleRaw : readOfflinePage(path);
                    if (raw != null) {
                        try {
                            JSONObject snapshot = new JSONObject(raw);
                            pending.offlineResult = true;
                            return snapshot;
                        } catch (JSONException ignored) { }
                    }
                }
                throw error;
            }
        }, new Callback<JSONObject>() {
            @Override public void onSuccess(JSONObject value) { finishCachedJson(path, pending, value, null); }
            @Override public void onError(BackendException error) { finishCachedJson(path, pending, null, error); }
        });
    }

    private void finishCachedJson(String path, PendingJson pending, JSONObject value, BackendException error) {
        final ArrayList<Callback<JSONObject>> listeners;
        final String raw = value == null ? null : value.toString();
        final boolean stale;
        synchronized (sessionLock) {
            if (pendingJson.get(pending.key) != pending) return;
            pendingJson.remove(pending.key);
            if (closed || generation != pending.generation || session == null || !pending.uid.equals(session.uid)) return;
            listeners = new ArrayList<>(pending.listeners);
            stale = pending.revision != cacheRevision;
            if (!stale && raw != null && raw.length() <= MAX_CACHED_JSON_CHARS) {
                long ttl = pending.offlineResult ? 5_000L
                        : path.startsWith("/notifications") || path.startsWith("/friends") ? 20_000L : 60_000L;
                CachedJson previous = jsonCache.put(path, new CachedJson(raw, pending.uid,
                        SystemClock.elapsedRealtime() + ttl, cacheRevision));
                if (previous != null) cachedJsonChars -= previous.raw.length();
                cachedJsonChars += raw.length();
                trimCachedJsonLocked();
                if (!pending.offlineResult) {
                    CachedJson previousHistory = historyJson.put(path,
                            new CachedJson(raw, pending.uid, Long.MAX_VALUE, cacheRevision));
                    if (previousHistory != null) historyJsonChars -= previousHistory.raw.length();
                    historyJsonChars += raw.length();
                    while (historyJson.size() > MAX_JSON_CACHE_ENTRIES || historyJsonChars > MAX_HISTORY_CACHE_CHARS) {
                        Map.Entry<String, CachedJson> oldest = historyJson.entrySet().iterator().next();
                        historyJsonChars -= oldest.getValue().raw.length();
                        historyJson.remove(oldest.getKey());
                    }
                }
            }
        }
        if (!stale && value != null) {
            if (pending.offlineResult) publicSnapshot(path, value, pending.generation);
            else savePublicPage(path, value, pending.generation, pending.revision);
        }
        if (stale) {
            // A write overtook this read. Rejoin a new read after that write instead of
            // painting its older response or leaving a foreground loading state unresolved.
            for (Callback<JSONObject> listener : listeners) requestCachedJson(path, readWorker, listener);
            return;
        }
        for (Callback<JSONObject> listener : listeners) {
            if (closed || generation != pending.generation || session == null || !pending.uid.equals(session.uid)) break;
            if (error != null) listener.onError(error);
            else {
                try { listener.onSuccess(new JSONObject(raw)); }
                catch (JSONException impossible) { listener.onError(new BackendException(502, "INVALID_SERVER_RESPONSE", "Dữ liệu máy chủ không hợp lệ.")); }
            }
        }
    }

    private void invalidateCachedJson() {
        synchronized (sessionLock) { invalidateCachedJsonLocked(); }
    }

    private void invalidatePublicSnapshots() {
        synchronized (sessionLock) {
            invalidateCachedJsonLocked();
            clearHistoryLocked();
            try { cacheWorker.execute(() -> offlineStore.clearPages(offlineScope)); }
            catch (RejectedExecutionException ignored) { }
        }
    }

    private void finishMutation(boolean succeeded) {
        final Map<String, ArrayList<Callback<JSONObject>>> delayed;
        synchronized (sessionLock) {
            if (activeMutations > 0) activeMutations--;
            if (succeeded) {
                invalidateCachedJsonLocked();
                clearHistoryLocked();
                // A successful write can hide or edit a previously viewed public row.
                // Queue deletion ahead of the next offline lookup; a failed write keeps snapshots.
                try { cacheWorker.execute(() -> offlineStore.clearPages(offlineScope)); }
                catch (RejectedExecutionException ignored) { }
            }
            if (closed || session == null) {
                delayedJsonReads.clear();
                return;
            }
            if (activeMutations != 0 || delayedJsonReads.isEmpty()) return;
            delayed = new HashMap<>(delayedJsonReads);
            delayedJsonReads.clear();
        }
        for (Map.Entry<String, ArrayList<Callback<JSONObject>>> entry : delayed.entrySet()) {
            for (Callback<JSONObject> listener : entry.getValue()) requestCachedJson(entry.getKey(), readWorker, listener);
        }
    }

    private void invalidateCachedJsonLocked() {
        cacheRevision++;
        jsonCache.clear();
        cachedJsonChars = 0;
    }

    private void clearHistoryLocked() {
        historyJson.clear();
        historyJsonChars = 0;
    }

    private void removeCachedJsonLocked(String path) {
        CachedJson previous = jsonCache.remove(path);
        if (previous != null) cachedJsonChars -= previous.raw.length();
    }

    private void trimCachedJsonLocked() {
        while (jsonCache.size() > MAX_JSON_CACHE_ENTRIES || cachedJsonChars > MAX_JSON_CACHE_CHARS) {
            Map.Entry<String, CachedJson> oldest = jsonCache.entrySet().iterator().next();
            removeCachedJsonLocked(oldest.getKey());
        }
    }

    /** Only GET is exposed without authentication, for public listings, content and collection points. */
    public void getPublic(String path, Callback<JSONObject> callback) {
        executeOn(readWorker, version -> {
            try {
                JSONObject value = send(apiUrl(path), "GET", null, null, null, version);
                savePublicPage(path, value, version, cacheRevision);
                return value;
            } catch (BackendException error) {
                if (offlineFailure(error)) {
                    String raw = readOfflinePage(path);
                    if (raw != null) {
                        try {
                            JSONObject snapshot = new JSONObject(raw);
                            String sanitized = publicSnapshot(path, snapshot, version);
                            if (sanitized != null) return new JSONObject(sanitized);
                        } catch (JSONException ignored) { }
                    }
                }
                throw error;
            }
        }, callback);
    }

    public void signOut() {
        final OkHttpClient retired;
        final Call[] calls;
        synchronized (sessionLock) {
            if (closed) return;
            generation++;
            session = null;
            sessionVault.clear();
            invalidateCachedJsonLocked();
            clearHistoryLocked();
            pendingJson.clear();
            delayedJsonReads.clear();
            activeMutations = 0;
            clearMediaLocked();
            retired = http;
            calls = activeCalls.toArray(new Call[0]);
            activeCalls.clear();
            // A delayed cleanup must never cancel the next login or reuse an interrupted TLS socket.
            // Keep all TLS/timeout policies while giving the next session independent transport state.
            http = retired.newBuilder().connectionPool(new ConnectionPool()).dispatcher(new Dispatcher()).build();
        }
        retire(retired, calls);
    }

    @Override public void close() {
        final OkHttpClient retired;
        final Call[] calls;
        synchronized (sessionLock) {
            if (closed) return;
            closed = true;
            generation++;
            session = null;
            invalidateCachedJsonLocked();
            clearHistoryLocked();
            pendingJson.clear();
            delayedJsonReads.clear();
            activeMutations = 0;
            clearMediaLocked();
            retired = http;
            calls = activeCalls.toArray(new Call[0]);
            activeCalls.clear();
        }
        worker.shutdownNow();
        readWorker.shutdownNow();
        prefetchWorker.shutdownNow();
        mediaWorker.shutdownNow();
        cacheWorker.shutdown();
        main.removeCallbacksAndMessages(null);
        retire(retired, calls);
    }

    private static void retire(OkHttpClient retired, Call[] calls) {
        HTTP_CLEANUP.execute(() -> {
            try {
                for (Call call : calls) call.cancel();
                retired.dispatcher().cancelAll();
                retired.connectionPool().evictAll();
            } finally {
                retired.dispatcher().executorService().shutdown();
            }
        });
    }

    private Call newCall(Request request, int version) throws BackendException {
        return newCall(request, version, false);
    }

    private Call newCall(Request request, int version, boolean freshConnection) throws BackendException {
        synchronized (sessionLock) {
            if (closed || generation != version) throw new BackendException(0, "CANCELLED", "Thao tác đã hủy.");
            // Recovery uses an independent, non-retaining pool, keeping all TLS/timeout policies.
            // Its socket closes on the worker when the response is released; no UI cleanup work.
            OkHttpClient transport = freshConnection
                    ? http.newBuilder().connectionPool(new ConnectionPool(0, 1, TimeUnit.SECONDS)).build() : http;
            Call call = transport.newCall(request);
            activeCalls.add(call);
            return call;
        }
    }

    private void finished(Call call) {
        synchronized (sessionLock) { activeCalls.remove(call); }
    }

    private Session requireSession() throws BackendException {
        Session current = session;
        if (current == null) throw new BackendException(401, "SIGN_IN_REQUIRED", "Vui lòng đăng nhập trước.");
        return current;
    }

    private Session refresh(Session previous, int version) throws BackendException, IOException, JSONException {
        // Foreground reads, media and prefetch can all encounter the same expired
        // token. Only one of them should exchange the refresh token with Firebase.
        synchronized (refreshLock) {
            synchronized (sessionLock) {
                if (closed || generation != version || session == null || !previous.uid.equals(session.uid))
                    throw new BackendException(0, "CANCELLED", "Thao tác đã hủy.");
                if (session != previous) return session;
            }
            return refreshOnce(previous, version);
        }
    }

    private Session refreshOnce(Session previous, int version) throws BackendException, IOException, JSONException {
        RequestBody body = new FormBody.Builder().add("grant_type", "refresh_token").add("refresh_token", previous.refreshToken).build();
        JSONObject result;
        try { result = send(authUrl(tokenBase, "token"), "POST", body, null, null, version); }
        catch (BackendException error) {
            if (error.httpStatus == 400 || error.httpStatus == 401 || error.httpStatus == 403) {
                synchronized (sessionLock) { if (session == previous) { session = null; sessionVault.clear(); } }
            }
            throw error;
        }
        String nextUid = result.getString("user_id");
        if (!previous.uid.equals(nextUid)) throw new BackendException(502, "INVALID_AUTH_RESPONSE", "Phiên đăng nhập không hợp lệ.");
        Session next = new Session(nextUid, previous.email, result.getString("id_token"), result.getString("refresh_token"), lifetime(result.getString("expires_in")));
        install(next, version);
        return next;
    }

    private void install(Session next, int version) throws BackendException {
        synchronized (sessionLock) {
            if (closed || generation != version) throw new BackendException(0, "CANCELLED", "Thao tác đã hủy.");
            if (session == null || !session.uid.equals(next.uid)) {
                invalidateCachedJsonLocked();
                clearHistoryLocked();
                pendingJson.clear();
                delayedJsonReads.clear();
                activeMutations = 0;
                clearMediaLocked();
            }
            session = next;
        }
        // Keystore encryption can take several frames. Do not hold the lock used
        // by screen reads while credentials are being persisted on this worker.
        synchronized (sessionVault) {
            if (closed || generation != version || session != next) return;
            sessionVault.write(next.uid, next.email, next.idToken, next.refreshToken,
                    System.currentTimeMillis() + Math.max(1L, (next.expiresAtElapsed - SystemClock.elapsedRealtime())));
        }
    }

    private void restoreSessionFromVault() {
        org.json.JSONObject saved = sessionVault.read();
        if (saved == null) return;
        try {
            String uid = saved.getString("uid"), idToken = saved.getString("id_token"), refreshToken = saved.getString("refresh_token");
            long remainingMs = saved.optLong("expires_at", 0L) - System.currentTimeMillis();
            long remainingSeconds = Math.max(1L, Math.min(86400L, remainingMs / 1000L));
            Session restored = new Session(uid, saved.optString("email", ""), idToken, refreshToken, remainingSeconds);
            synchronized (sessionLock) { session = restored; }
        } catch (org.json.JSONException | IllegalArgumentException error) {
            sessionVault.clear();
        }
    }

    private static long lifetime(String value) throws BackendException {
        try {
            long seconds = Long.parseLong(value);
            if (seconds < 1 || seconds > 86400) throw new NumberFormatException();
            return seconds;
        } catch (NumberFormatException error) { throw new BackendException(502, "INVALID_AUTH_RESPONSE", "Thời hạn phiên đăng nhập không hợp lệ."); }
    }
    private HttpUrl authUrl(String base, String action) { return HttpUrl.get(base + action).newBuilder().addQueryParameter("key", apiKey).build(); }
    private HttpUrl apiUrl(String path) { return HttpUrl.get(BackendEndpointPolicy.apiPath(apiBase, path).toString()); }
    private static String checkedMethod(String method) {
        if (method == null) throw new IllegalArgumentException("HTTP method required");
        String verb = method.toUpperCase(Locale.ROOT);
        if (!verb.matches("GET|POST|PATCH|PUT|DELETE")) throw new IllegalArgumentException("Unsupported HTTP method");
        return verb;
    }
    private static RequestBody jsonBody(String method, String value) {
        if ("GET".equals(method)) {
            if (value != null) throw new IllegalArgumentException("GET requests cannot contain a body");
            return null;
        }
        return value == null && "DELETE".equals(method) ? null : RequestBody.create(value == null ? "{}" : value, JSON);
    }

    private JSONObject send(HttpUrl url, String method, RequestBody body, String token, String idempotencyKey, int version) throws IOException, JSONException, BackendException {
        Request.Builder builder = new Request.Builder().url(url).method(method, body).header("Accept", "application/json");
        if (token != null) builder.header("Authorization", "Bearer " + token);
        if (idempotencyKey != null) {
            if (!idempotencyKey.matches("[A-Za-z0-9_-]{8,128}")) throw new IllegalArgumentException("Idempotency key must be 8–128 letters, digits, _ or -");
            builder.header("Idempotency-Key", idempotencyKey);
        }
        return executeResponse(builder.build(), version, response -> {
            ResponseBody responseBody = response.body();
            String raw = responseBody == null ? "" : readBounded(responseBody);
            JSONObject data;
            try { data = raw.isEmpty() ? new JSONObject() : new JSONObject(raw); }
            catch (JSONException error) { throw new BackendException(response.code(), "INVALID_SERVER_RESPONSE", "Máy chủ trả về dữ liệu không hợp lệ."); }
            if (!response.isSuccessful()) {
                JSONObject details = data.optJSONObject("error");
                String code = details == null ? "HTTP_" + response.code() : details.optString("code", details.optString("message", "HTTP_" + response.code()));
                if (code.length() > 100) code = "HTTP_" + response.code();
                String message = details == null ? "Yêu cầu không thành công (" + response.code() + ")." : details.optString("message", code);
                throw new BackendException(response.code(), code, message.length() > 500 ? message.substring(0, 500) : message);
            }
            return data;
        });
    }

    private interface ResponseReader<T> {
        T read(Response response) throws IOException, JSONException, BackendException;
    }

    private <T> T executeResponse(Request request, int version, ResponseReader<T> reader) throws BackendException, JSONException {
        for (int attempt = 0; attempt < 2; attempt++) {
            Call call = newCall(request, version, attempt > 0);
            boolean readMayRecover = true;
            try (Response response = call.execute()) {
                readMayRecover = response.isSuccessful();
                return reader.read(response);
            } catch (IOException error) {
                if (attempt == 0 && readMayRecover && canRetryRead(request, call, error, version)) continue;
                throw transportFailure(error, request.url());
            } catch (SecurityException error) {
                throw transportFailure(error, request.url());
            } finally { finished(call); }
        }
        throw new AssertionError("Read recovery exceeded one attempt");
    }

    /** An interrupted read is safe to repeat; account changes, HTTP failures and writes never replay. */
    private boolean canRetryRead(Request request, Call call, IOException error, int version) {
        if (!"GET".equals(request.method()) || call.isCanceled() || Thread.currentThread().isInterrupted()
                || hasCause(error, SocketTimeoutException.class) || hasCause(error, ConnectException.class)
                || hasCause(error, UnknownHostException.class) || hasCause(error, SSLException.class)) return false;
        boolean interrupted = hasCause(error, EOFException.class);
        Throwable cause = error;
        for (int depth = 0; cause != null && depth < 8; depth++, cause = cause.getCause()) {
            if (cause instanceof ErrnoException) {
                int errno = ((ErrnoException) cause).errno;
                if (errno == OsConstants.EACCES || errno == OsConstants.EPERM) return false;
                if (errno == OsConstants.ECONNRESET || errno == OsConstants.EPIPE || errno == OsConstants.ECONNABORTED) interrupted = true;
            } else if (cause instanceof SocketException && cause.getMessage() != null) {
                String message = cause.getMessage().toLowerCase(Locale.ROOT);
                if (message.contains("connection reset") || message.contains("broken pipe")) interrupted = true;
            }
        }
        synchronized (sessionLock) { return interrupted && !closed && generation == version; }
    }

    /** Debug metadata only: never log a URL, query, credentials, request/response body or exception text. */
    private static EventListener networkDiagnostics(Request request) {
        return new EventListener() {
            private String phase = "connect";
            private String operation() {
                return " method=" + request.method() + " target=" + diagnosticTarget(request.url())
                        + " route=" + diagnosticRoute(request.url()) + " phase=" + phase;
            }
            @Override public void requestHeadersStart(Call call) { phase = "request_headers"; }
            @Override public void requestBodyStart(Call call) { phase = "request_body"; }
            @Override public void responseHeadersStart(Call call) { phase = "response_headers"; }
            @Override public void responseHeadersEnd(Call call, Response response) {
                if (!response.isSuccessful()) Log.w(NETWORK_LOG_TAG, "event=http_error" + operation() + " status=" + response.code());
            }
            @Override public void responseBodyStart(Call call) { phase = "response_body"; }
            @Override public void callFailed(Call call, IOException error) {
                if (call.isCanceled()) return;
                StringBuilder types = new StringBuilder();
                Throwable cause = error;
                for (int depth = 0; cause != null && depth < 6; depth++, cause = cause.getCause()) {
                    if (types.length() > 0) types.append('/');
                    types.append(cause.getClass().getSimpleName());
                }
                Log.w(NETWORK_LOG_TAG, "event=transport_error" + operation() + " category="
                        + transportFailure(error, request.url()).code + " types=" + types);
            }
        };
    }

    private static String diagnosticTarget(HttpUrl url) {
        if (isLocal(url)) return "local_backend";
        if ("identitytoolkit.googleapis.com".equals(url.host())) return "firebase_auth";
        if ("securetoken.googleapis.com".equals(url.host())) return "firebase_token";
        if ("firebasestorage.googleapis.com".equals(url.host()) || "storage.googleapis.com".equals(url.host())
                || url.host().endsWith(".storage.googleapis.com")) return "firebase_media";
        return "api";
    }

    private static String diagnosticRoute(HttpUrl url) {
        if ("firebase_media".equals(diagnosticTarget(url))) return "/media";
        StringBuilder route = new StringBuilder();
        for (String segment : url.pathSegments()) {
            if (segment.isEmpty()) continue;
            // A fixed vocabulary keeps document/user/file identifiers out of Logcat too.
            boolean known = ("|v1|api|auth|accounts:signInWithPassword|accounts:signUp|accounts:sendOobCode|token|me|posts|tips|listings|media|download|upload|complete|"
                    + "comments|likes|saves|friends|requests|notifications|read|read-all|users|admin|verifications|orders|payments|categories|collection-points|reports|"
                    + "dashboard|statistics|config|audit-logs|points|messages|conversations|items|health|").contains("|" + segment + "|");
            route.append('/').append(known ? segment : ":id");
        }
        return route.length() == 0 ? "/" : route.toString();
    }

    private static boolean isLocal(HttpUrl url) {
        return url != null && ("10.0.2.2".equals(url.host()) || "127.0.0.1".equals(url.host()));
    }

    private static BackendException transportFailure(Throwable error, HttpUrl url) {
        String code = "NETWORK_ERROR", message = "Kết nối bị gián đoạn. Chạm để thử lại.";
        boolean denied = error instanceof SecurityException;
        Throwable cause = error;
        for (int depth = 0; cause != null && depth < 8; depth++, cause = cause.getCause()) {
            if (cause instanceof ErrnoException) {
                int errno = ((ErrnoException) cause).errno;
                if (errno == OsConstants.EACCES || errno == OsConstants.EPERM) denied = true;
            }
        }
        if (denied) {
            code = isLocal(url) ? "LOCAL_NETWORK_PERMISSION_REQUIRED" : "NETWORK_PERMISSION_DENIED";
            message = isLocal(url) ? "Ứng dụng chưa được phép truy cập mạng nội bộ. Vui lòng cấp quyền trong Cài đặt."
                    : "Ứng dụng chưa được phép kết nối mạng. Vui lòng kiểm tra quyền truy cập.";
        } else if (hasCause(error, SocketTimeoutException.class)) {
            code = "NETWORK_TIMEOUT"; message = "Máy chủ phản hồi chậm. Chạm để thử lại.";
        } else if (hasCause(error, UnknownHostException.class)) {
            code = "NETWORK_DNS_ERROR"; message = "Không tìm thấy máy chủ. Vui lòng kiểm tra kết nối Internet.";
        } else if (hasCause(error, SSLException.class)) {
            code = "SECURE_CONNECTION_FAILED"; message = "Không thiết lập được kết nối bảo mật. Vui lòng kiểm tra kết nối và ngày giờ thiết bị.";
        } else if (hasCause(error, ConnectException.class)) {
            code = isLocal(url) ? "LOCAL_BACKEND_UNAVAILABLE" : "SERVER_UNAVAILABLE";
            message = isLocal(url) ? "Chưa kết nối được backend trên máy tính. Vui lòng kiểm tra server đang chạy."
                    : "Chưa kết nối được máy chủ. Chạm để thử lại.";
        } else if (hasCause(error, EOFException.class)) {
            code = "NETWORK_INTERRUPTED"; message = "Máy chủ đã ngắt kết nối. Chạm để thử lại.";
        }
        BackendException failure = new BackendException(0, code, message);
        failure.initCause(error);
        return failure;
    }

    private static boolean hasCause(Throwable error, Class<? extends Throwable> type) {
        for (int depth = 0; error != null && depth < 8; depth++, error = error.getCause()) if (type.isInstance(error)) return true;
        return false;
    }
    private static String readBounded(ResponseBody body) throws IOException, BackendException {
        if (body.contentLength() > MAX_RESPONSE_BYTES) throw new BackendException(502, "RESPONSE_TOO_LARGE", "Dữ liệu phản hồi quá lớn.");
        try (InputStream input = body.byteStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int count, total = 0;
            while ((count = input.read(buffer)) != -1) {
                total += count;
                if (total > MAX_RESPONSE_BYTES) throw new BackendException(502, "RESPONSE_TOO_LARGE", "Dữ liệu phản hồi quá lớn.");
                output.write(buffer, 0, count);
            }
            return new String(output.toByteArray(), java.nio.charset.StandardCharsets.UTF_8);
        }
    }

    private interface Task<T> { T run(int version) throws Exception; }
    private <T> void execute(Task<T> task, Callback<T> callback) {
        executeOn(worker, task, callback);
    }
    private <T> void executeOn(ExecutorService executor, Task<T> task, Callback<T> callback) {
        if (callback == null) throw new IllegalArgumentException("Callback required");
        if (closed) throw new IllegalStateException("Client is closed");
        final int version = generation;
        try {
            executor.execute(() -> {
                if (closed || generation != version) return;
                try {
                    T value = task.run(version);
                    main.post(() -> { if (!closed && generation == version) callback.onSuccess(value); });
                } catch (Exception error) {
                    BackendException failure = error instanceof BackendException ? (BackendException) error
                            : error instanceof IllegalArgumentException ? new BackendException(400, "INVALID_REQUEST", error.getMessage())
                            : error instanceof JSONException ? new BackendException(502, "INVALID_SERVER_RESPONSE", "Dữ liệu máy chủ không hợp lệ.")
                            : error instanceof IOException || error instanceof SecurityException ? transportFailure(error, null)
                            : new BackendException(0, "CLIENT_ERROR", "Ứng dụng chưa xử lý được yêu cầu. Vui lòng thử lại.");
                    if (failure != error && failure.getCause() == null) failure.initCause(error);
                    main.post(() -> { if (!closed && generation == version) callback.onError(failure); });
                }
            });
        } catch (RejectedExecutionException error) { if (!closed) throw error; }
    }
}
