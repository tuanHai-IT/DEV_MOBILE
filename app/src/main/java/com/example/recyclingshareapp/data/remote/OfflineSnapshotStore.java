package com.example.recyclingshareapp.data.remote;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteException;
import android.database.sqlite.SQLiteOpenHelper;
import android.util.Log;

/** Bounded, public-content-only snapshots for pages that have actually loaded online. */
final class OfflineSnapshotStore extends SQLiteOpenHelper {
    private static final String TAG = "EcoShareOffline";
    private static final int MAX_PAGES = 120;
    private static final int MAX_IMAGES = 16;
    private static final int MAX_PAGE_CHARS = 64 * 1024;
    private static final int MAX_IMAGE_BYTES = 768 * 1024;

    OfflineSnapshotStore(Context context) {
        super(context.getApplicationContext(), "ecoshare_public_snapshots.db", null, 1);
    }

    @Override public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE pages (scope TEXT NOT NULL, route TEXT NOT NULL, body TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY(scope, route))");
        db.execSQL("CREATE TABLE images (scope TEXT NOT NULL, media_id TEXT NOT NULL, bytes BLOB NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY(scope, media_id))");
    }

    @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        db.execSQL("DROP TABLE IF EXISTS pages");
        db.execSQL("DROP TABLE IF EXISTS images");
        onCreate(db);
    }

    synchronized String page(String scope, String route) {
        try (Cursor cursor = getReadableDatabase().query("pages", new String[]{"body"},
                "scope=? AND route=?", new String[]{scope, route}, null, null, null, "1")) {
            return cursor.moveToFirst() ? cursor.getString(0) : null;
        } catch (SQLiteException error) {
            Log.w(TAG, "Could not read public page snapshot", error);
            return null;
        }
    }

    synchronized void putPage(String scope, String route, String body) {
        if (body == null || body.length() > MAX_PAGE_CHARS) return;
        try {
            SQLiteDatabase db = getWritableDatabase();
            ContentValues values = new ContentValues();
            values.put("scope", scope);
            values.put("route", route);
            values.put("body", body);
            values.put("updated_at", System.currentTimeMillis());
            db.insertWithOnConflict("pages", null, values, SQLiteDatabase.CONFLICT_REPLACE);
            db.execSQL("DELETE FROM pages WHERE rowid NOT IN (SELECT rowid FROM pages ORDER BY updated_at DESC LIMIT " + MAX_PAGES + ")");
        } catch (SQLiteException error) {
            Log.w(TAG, "Could not save public page snapshot", error);
        }
    }

    synchronized byte[] image(String scope, String id) {
        try (Cursor cursor = getReadableDatabase().query("images", new String[]{"bytes"},
                "scope=? AND media_id=?", new String[]{scope, id}, null, null, null, "1")) {
            return cursor.moveToFirst() ? cursor.getBlob(0) : null;
        } catch (SQLiteException error) {
            Log.w(TAG, "Could not read public image snapshot", error);
            return null;
        }
    }

    synchronized void putImage(String scope, String id, byte[] bytes) {
        if (bytes == null || bytes.length == 0 || bytes.length > MAX_IMAGE_BYTES) return;
        try {
            SQLiteDatabase db = getWritableDatabase();
            ContentValues values = new ContentValues();
            values.put("scope", scope);
            values.put("media_id", id);
            values.put("bytes", bytes);
            values.put("updated_at", System.currentTimeMillis());
            db.insertWithOnConflict("images", null, values, SQLiteDatabase.CONFLICT_REPLACE);
            db.execSQL("DELETE FROM images WHERE rowid NOT IN (SELECT rowid FROM images ORDER BY updated_at DESC LIMIT " + MAX_IMAGES + ")");
        } catch (SQLiteException error) {
            Log.w(TAG, "Could not save public image snapshot", error);
        }
    }

    synchronized void clearPages(String scope) {
        try { getWritableDatabase().delete("pages", "scope=?", new String[]{scope}); }
        catch (SQLiteException error) { Log.w(TAG, "Could not clear public page snapshots", error); }
    }
}
