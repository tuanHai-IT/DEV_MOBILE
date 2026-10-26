package com.example.recyclingshareapp.data.remote;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Encrypted-at-rest Firebase refresh credentials backed by the Android Keystore. */
final class SessionVault {
    private static final String PREFS = "ecoshare_secure_session";
    private static final String KEY_ALIAS = "ecoshare_session_key_v1";
    private final SharedPreferences preferences;

    SessionVault(Context context) {
        preferences = context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    synchronized JSONObject read() {
        try {
            String ivValue = preferences.getString("iv", null);
            String value = preferences.getString("value", null);
            if (ivValue == null || value == null) return null;
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(ivValue, Base64.NO_WRAP)));
            return new JSONObject(new String(cipher.doFinal(Base64.decode(value, Base64.NO_WRAP)), StandardCharsets.UTF_8));
        } catch (Exception error) {
            clear();
            return null;
        }
    }

    synchronized void writeProfile(String uid, JSONObject profile) {
        JSONObject saved = read();
        if (saved == null || !uid.equals(saved.optString("uid"))) return;
        try {
            JSONObject safe = new JSONObject();
            for (String key : new String[]{"id", "display_name", "role", "status", "bio", "city", "avatar_key", "cover_key", "created_at", "verification_status", "verified", "points_balance"})
                if (profile.has(key)) safe.put(key, profile.opt(key));
            saved.put("profile", safe);
            writeRaw(saved);
        } catch (Exception ignored) { }
    }

    synchronized JSONObject readProfile(String uid) {
        JSONObject saved = read();
        if (saved == null || !uid.equals(saved.optString("uid"))) return null;
        JSONObject profile = saved.optJSONObject("profile");
        if (profile == null) return null;
        try { return new JSONObject(profile.toString()); } catch (Exception ignored) { return null; }
    }

    synchronized void write(String uid, String email, String idToken, String refreshToken, long expiresAtEpochMs) {
        try {
            JSONObject session = new JSONObject().put("uid", uid).put("email", email)
                    .put("id_token", idToken).put("refresh_token", refreshToken)
                    .put("expires_at", expiresAtEpochMs);
            JSONObject existing = read();
            if (existing != null && uid.equals(existing.optString("uid")) && existing.has("profile")) session.put("profile", existing.optJSONObject("profile"));
            writeRaw(session);
        } catch (Exception error) {
            clear();
        }
    }

    private void writeRaw(JSONObject session) throws Exception {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key());
            preferences.edit().putString("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
                    .putString("value", Base64.encodeToString(cipher.doFinal(session.toString().getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP))
                    .apply();
    }

    synchronized void clear() { preferences.edit().clear().apply(); }

    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        java.security.Key existing = store.getKey(KEY_ALIAS, null);
        if (existing instanceof SecretKey) return (SecretKey) existing;
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build());
        return generator.generateKey();
    }
}
