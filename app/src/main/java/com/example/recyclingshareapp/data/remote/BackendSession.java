package com.example.recyclingshareapp.data.remote;

import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Objects;

/** One authenticated server session shared by the native screens. Refresh credentials are encrypted at rest. */
public final class BackendSession {
    public enum Mode { CLOUD_FUNCTIONS, EMULATOR, SPARK_LOCAL }
    public interface ProfileListener { void onProfileChanged(JSONObject profile); }

    private static final long PROFILE_REFRESH_INTERVAL_MS = 15_000L;
    private static final long FAILED_REFRESH_INTERVAL_MS = 5_000L;
    // Keep Android's Looper out of class initialization so pure JVM mode tests can load this class.
    private static final class MainDispatcher {
        static final Handler HANDLER = new Handler(Looper.getMainLooper());
    }
    private static final ArrayList<ProfileListener> profileListeners = new ArrayList<>();
    private static FirebaseBackendClient client;
    private static JSONObject profile;
    private static Mode mode = Mode.CLOUD_FUNCTIONS;
    private static boolean modeExplicitlySelected;
    private static long profileRevision;
    private static long sessionEpoch;
    private static long lastProfileRefreshAt;
    private static long lastProfileAttemptAt;
    private static boolean profileRefreshInFlight;
    private BackendSession() { }

    public static synchronized FirebaseBackendClient get(Context context) {
        if (client == null) {
            Context app = context.getApplicationContext();
            boolean debug = (app.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
            int projectResource = app.getResources().getIdentifier("project_id", "string", app.getPackageName());
            String projectId = projectResource == 0 ? null : app.getString(projectResource).trim();
            if (!modeExplicitlySelected) {
                mode = resolveMode(debug, projectId);
                // Earlier builds saved the login-screen selector. Discard that setting now that
                // the connection is automatic, and never reuse Emulator credentials on Spark.
                android.content.SharedPreferences prefs = app.getSharedPreferences("backend_connection", Context.MODE_PRIVATE);
                String previousMode = prefs.getString("mode", null);
                if ((previousMode != null && !mode.name().equals(previousMode))
                        || prefs.getBoolean("emulator", false)) new SessionVault(app).clear();
                if (prefs.contains("mode") || prefs.contains("emulator")) prefs.edit().clear().apply();
            }
            switch (mode) {
                case EMULATOR: client = new FirebaseBackendClient(app,
                        "http://10.0.2.2:5001/demo-recycling-share/asia-southeast1/api/v1", "demo-key", "http://10.0.2.2:9099"); break;
                case SPARK_LOCAL: client = FirebaseBackendClient.forSparkLocal(app); break;
                default: client = FirebaseBackendClient.fromGoogleServices(app);
            }
            JSONObject restoredProfile = client.cachedOwnProfile();
            if (restoredProfile != null) profile = restoredProfile;
        }
        return client;
    }

    /** Use the local Spark API for this debug project; production always uses HTTPS. */
    static Mode resolveMode(boolean debug, String projectId) {
        if (!debug) return Mode.CLOUD_FUNCTIONS;
        return BackendEndpointPolicy.SPARK_PROJECT_ID.equals(projectId) ? Mode.SPARK_LOCAL : Mode.CLOUD_FUNCTIONS;
    }

    public static void useEmulator(Context context, boolean enabled) {
        useMode(context, enabled ? Mode.EMULATOR : Mode.CLOUD_FUNCTIONS);
    }
    public static void useMode(Context context, Mode selected) {
        if (selected == null) throw new IllegalArgumentException("Connection mode is required");
        boolean debug = (context.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        if (selected != Mode.CLOUD_FUNCTIONS && !debug) throw new IllegalArgumentException("Local backends are only available in debug builds");
        synchronized (BackendSession.class) {
            if (mode == selected && client != null) return;
        }
        FirebaseBackendClient checkedSpark = selected == Mode.SPARK_LOCAL ? FirebaseBackendClient.forSparkLocal(context) : null;
        FirebaseBackendClient old;
        long revision;
        synchronized (BackendSession.class) {
            old = client;
            client = checkedSpark;
            mode = selected;
            modeExplicitlySelected = true;
            revision = clearProfileLocked();
        }
        // A refresh token belongs to the backend mode that issued it; don't restore a cloud token into an emulator (or vice versa).
        if (old != null) { old.signOut(); old.close(); }
        else new SessionVault(context).clear();
        if (checkedSpark != null) checkedSpark.signOut();
        notifyProfileListeners(revision);
    }
    public static synchronized boolean isEmulator() { return mode == Mode.EMULATOR; }
    public static synchronized boolean isSparkLocal() { return mode == Mode.SPARK_LOCAL; }
    public static synchronized boolean usesLocalBackend() { return mode != Mode.CLOUD_FUNCTIONS; }
    public static synchronized boolean isSignedIn() { return client != null && client.isSignedIn(); }
    public static synchronized boolean hasProfile() { return profile != null; }
    public static synchronized JSONObject profile() {
        try { return profile == null ? new JSONObject() : new JSONObject(profile.toString()); }
        catch (Exception ignored) { return new JSONObject(); }
    }
    public static void setProfile(JSONObject value) {
        final long revision;
        synchronized (BackendSession.class) {
            profile = copy(value);
            if (client != null && profile != null) client.saveOwnProfile(profile);
            // Login, an edit, or another server read supersedes an older background refresh.
            // This also releases an in-flight read suppressed by a direct account switch.
            sessionEpoch++;
            profileRefreshInFlight = false;
            lastProfileRefreshAt = profile == null ? 0L : SystemClock.elapsedRealtime();
            lastProfileAttemptAt = 0L;
            revision = ++profileRevision;
        }
        notifyProfileListeners(revision);
    }

    /** Observe the current account's profile; notifications are always delivered on the main thread. */
    public static synchronized void addProfileListener(ProfileListener listener) {
        if (listener != null && !profileListeners.contains(listener)) profileListeners.add(listener);
    }
    public static synchronized void removeProfileListener(ProfileListener listener) {
        profileListeners.remove(listener);
    }

    /** Refresh points and other profile fields in the background when Home becomes visible. */
    public static void refreshProfile(Context context) { refreshProfile(context, false); }
    /** Set force after a points-changing write; ordinary screen visits remain rate limited. */
    public static void refreshProfile(Context context, boolean force) {
        final FirebaseBackendClient currentClient;
        final String uid;
        final long epoch;
        final long startingRevision;
        synchronized (BackendSession.class) {
            currentClient = get(context);
            FirebaseBackendClient.SessionInfo info = currentClient.currentSession();
            if (info == null || profile == null || profileRefreshInFlight) return;
            long now = SystemClock.elapsedRealtime();
            if (!force && (now - lastProfileRefreshAt < PROFILE_REFRESH_INTERVAL_MS
                    || now - lastProfileAttemptAt < FAILED_REFRESH_INTERVAL_MS)) return;
            uid = info.uid;
            epoch = sessionEpoch;
            startingRevision = profileRevision;
            profileRefreshInFlight = true;
            lastProfileAttemptAt = now;
        }
        try {
            currentClient.getMe(new FirebaseBackendClient.Callback<JSONObject>() {
                @Override public void onSuccess(JSONObject result) {
                    final long revision;
                    synchronized (BackendSession.class) {
                        if (!sameSession(currentClient, uid, epoch)) return;
                        profileRefreshInFlight = false;
                        // A profile edit or newer server read won while this request was in flight.
                        if (profileRevision != startingRevision) return;
                        JSONObject refreshed = copy(result);
                        if (refreshed == null) return;
                        lastProfileRefreshAt = SystemClock.elapsedRealtime();
                        if (profile != null && profile.toString().equals(refreshed.toString())) return;
                        profile = refreshed;
                        revision = ++profileRevision;
                    }
                    notifyProfileListeners(revision);
                }
                @Override public void onError(FirebaseBackendClient.BackendException error) {
                    synchronized (BackendSession.class) {
                        if (sameSession(currentClient, uid, epoch)) profileRefreshInFlight = false;
                    }
                }
            });
        } catch (IllegalStateException error) {
            synchronized (BackendSession.class) {
                if (sameSession(currentClient, uid, epoch)) profileRefreshInFlight = false;
            }
        }
    }

    private static boolean sameSession(FirebaseBackendClient expected, String uid, long epoch) {
        if (client != expected || sessionEpoch != epoch || !expected.isSignedIn()) return false;
        FirebaseBackendClient.SessionInfo info = expected.currentSession();
        return info != null && Objects.equals(uid, info.uid);
    }

    private static JSONObject copy(JSONObject value) {
        if (value == null) return null;
        try { return new JSONObject(value.toString()); }
        catch (Exception ignored) { return null; }
    }

    private static long clearProfileLocked() {
        profile = null;
        sessionEpoch++;
        profileRefreshInFlight = false;
        lastProfileRefreshAt = 0L;
        lastProfileAttemptAt = 0L;
        return ++profileRevision;
    }

    private static void notifyProfileListeners(long revision) {
        Runnable deliver = () -> {
            ArrayList<ProfileListener> listeners;
            JSONObject snapshot;
            synchronized (BackendSession.class) {
                if (revision != profileRevision) return;
                listeners = new ArrayList<>(profileListeners);
                snapshot = copy(profile);
            }
            for (ProfileListener listener : listeners) {
                synchronized (BackendSession.class) {
                    if (!profileListeners.contains(listener) || revision != profileRevision) continue;
                }
                listener.onProfileChanged(copy(snapshot));
            }
        };
        if (Looper.myLooper() == Looper.getMainLooper()) deliver.run();
        else MainDispatcher.HANDLER.post(deliver);
    }

    public static void signOut() {
        final FirebaseBackendClient current;
        final long revision;
        synchronized (BackendSession.class) {
            current = client;
            revision = clearProfileLocked();
            if (current != null) current.signOut();
        }
        notifyProfileListeners(revision);
    }
}
