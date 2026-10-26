package com.example.recyclingshareapp.data.remote;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;

/** Shared URL policy; cleartext is restricted to local emulator endpoints in debuggable builds. */
public final class BackendEndpointPolicy {
    public static final String SPARK_PROJECT_ID = "recycling-share-app";
    private BackendEndpointPolicy() { }

    public static URI validateBase(String value, boolean debuggable) {
        try {
            URI uri = new URI(value);
            boolean local = "10.0.2.2".equals(uri.getHost()) || "127.0.0.1".equals(uri.getHost());
            boolean allowed = "https".equals(uri.getScheme()) || (debuggable && local && "http".equals(uri.getScheme()));
            if (!allowed || uri.getHost() == null || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null
                    || value.indexOf('\\') >= 0 || !uri.normalize().equals(uri)) {
                throw new IllegalArgumentException("Backend URL must use HTTPS; debug HTTP is restricted to 10.0.2.2 or 127.0.0.1");
            }
            return new URI(value.endsWith("/") ? value : value + "/");
        } catch (URISyntaxException | NullPointerException error) {
            throw new IllegalArgumentException("Invalid backend URL");
        }
    }

    public static URI apiPath(URI base, String path) {
        if (path == null || !path.startsWith("/") || path.startsWith("//") || path.indexOf('\\') >= 0 || path.indexOf('#') >= 0) {
            throw new IllegalArgumentException("API path must start with a single /");
        }
        try {
            URI result = new URI(base.toString() + path.substring(1));
            if (!result.normalize().equals(result) || !base.getScheme().equals(result.getScheme()) || !base.getRawAuthority().equals(result.getRawAuthority())
                    || result.getRawPath().toLowerCase(Locale.ROOT).matches(".*%(2e|2f|5c).*")) {
                throw new IllegalArgumentException("API path must stay within the configured backend");
            }
            return result;
        } catch (URISyntaxException error) {
            throw new IllegalArgumentException("Invalid API path");
        }
    }

    /** A deliberate debug mode: the loopback Node server verifies tokens for this one real project. */
    public static URI validateSparkLocalBase(String value, boolean debuggable, String projectId) {
        URI uri = validateBase(value, debuggable);
        if (!debuggable || !SPARK_PROJECT_ID.equals(projectId) || !"http".equals(uri.getScheme())
                || !("10.0.2.2".equals(uri.getHost()) || "127.0.0.1".equals(uri.getHost()))
                || uri.getPort() != 5002 || !"/v1/".equals(uri.getPath())) {
            throw new IllegalArgumentException("Spark debug mode requires project recycling-share-app and the local backend on port 5002/v1");
        }
        return uri;
    }

    public static URI firestoreUploadPath(URI base, String mediaId, String path) {
        if (mediaId == null || !mediaId.matches("[A-Za-z0-9_-]{1,128}")
                || !("/media/" + mediaId + "/upload").equals(path)) {
            throw new IllegalArgumentException("Upload path does not match the issued media identifier");
        }
        return apiPath(base, path);
    }
}
