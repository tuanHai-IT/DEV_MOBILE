package com.example.recyclingshareapp;

import android.view.View;
import android.view.ViewGroup;
import android.graphics.Bitmap;
import android.widget.ImageView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import com.example.recyclingshareapp.data.remote.BackendSession;
import com.example.recyclingshareapp.data.remote.FirebaseBackendClient;
import okhttp3.Interceptor;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Protocol;
import okhttp3.Response;
import okhttp3.ResponseBody;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.ByteArrayOutputStream;
import java.lang.reflect.Field;
import java.util.concurrent.atomic.AtomicBoolean;
import static com.example.recyclingshareapp.CommunityTestSupport.*;
import static org.junit.Assert.*;

/** Profile rendering uses account/API data and never fills missing fields with demo values. */
@RunWith(AndroidJUnit4.class)
public class CommunityProfileUiTest {
    private CommunityTestSupport server;
    private Field httpField;
    private OkHttpClient originalHttp;

    @Before public void connect() throws Exception {
        server = new CommunityTestSupport();
        server.login("buyer@ecoshare.test");
        httpField = FirebaseBackendClient.class.getDeclaredField("http");
        httpField.setAccessible(true);
        originalHttp = (OkHttpClient) httpField.get(server.api);
    }

    @After public void restore() throws Exception {
        if (server != null) {
            if (originalHttp != null) httpField.set(server.api, originalHttp);
            BackendSession.signOut();
        }
    }

    @Test public void emptyAccountPostsDoNotCreateDemoProfileContent() throws Exception {
        inject(chain -> {
            if (chain.request().url().encodedPath().endsWith("/posts")
                    && chain.request().url().queryParameter("author_id") != null) {
                return jsonResponse(chain, "{\"items\":[],\"next_cursor\":null}");
            }
            return chain.proceed(chain.request());
        });
        JSONObject account = BackendSession.profile();
        String expectedName = account.optString("display_name", "");
        String expectedPoints = java.text.NumberFormat.getIntegerInstance(java.util.Locale.US)
                .format(Math.max(0, account.optLong("points_balance", 0)));

        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> activity.openCommunity("profile", null, false));
            waitFor(scenario, activity -> {
                String displayed = visibleText(CommunityTestSupport.screenView(activity, R.id.community_body));
                return displayed.contains(expectedName)
                        && displayed.contains("Ch\u01b0a c\u00f3 n\u1ed9i dung trong m\u1ee5c n\u00e0y.");
            });
            scenario.onActivity(activity -> {
                String displayed = visibleText(CommunityTestSupport.screenView(activity, R.id.community_body));
                assertTrue("Profile should use the signed-in account name", displayed.contains(expectedName));
                assertTrue("Profile should use the real Eco point balance", displayed.contains(expectedPoints));
                assertFalse("Profile must not invent a bio", displayed.contains("DIY Queen"));
                assertFalse("Profile must not invent recycled weight", displayed.contains("89kg"));
                assertFalse("An empty profile must not show fabricated post counts", displayed.contains("47"));
            });
        }
    }

    @Test public void profileReadsActualMediaFieldAndZeroLikeCount() throws Exception {
        Bitmap sourceImage = Bitmap.createBitmap(2, 2, Bitmap.Config.ARGB_8888);
        sourceImage.eraseColor(android.graphics.Color.GREEN);
        ByteArrayOutputStream encodedImage = new ByteArrayOutputStream();
        assertTrue(sourceImage.compress(Bitmap.CompressFormat.PNG, 100, encodedImage));
        sourceImage.recycle();
        byte[] image = encodedImage.toByteArray();
        AtomicBoolean mediaRequested = new AtomicBoolean();
        inject(chain -> {
            String path = chain.request().url().encodedPath();
            if (path.endsWith("/posts") && chain.request().url().queryParameter("author_id") != null) {
                return jsonResponse(chain, "{\"items\":[{\"id\":\"profile-audit-post\",\"kind\":\"POST\",\"title\":\"A real post\",\"body\":\"Real content\",\"created_at\":\"2026-10-19T00:00:00.000Z\",\"like_count\":0,\"media\":[{\"id\":\"profile-audit-media\"}]}],\"next_cursor\":null}");
            }
            if (path.endsWith("/media/profile-audit-media/download")) {
                mediaRequested.set(true);
                return new Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1)
                        .code(200).message("OK")
                        .header("Content-Type", "image/png")
                        .body(ResponseBody.create(image, MediaType.get("image/png"))).build();
            }
            return chain.proceed(chain.request());
        });

        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> activity.openCommunity("profile", null, false));
            waitFor(scenario, activity -> visibleText(CommunityTestSupport.screenView(activity, R.id.community_body))
                    .contains("\u2764\ufe0f 0"));
            waitFor(scenario, activity -> mediaRequested.get());
            waitFor(scenario, activity -> hasLoadedProfileImage(CommunityTestSupport.screenView(activity, R.id.community_body)));
            scenario.onActivity(activity -> {
                String displayed = visibleText(CommunityTestSupport.screenView(activity, R.id.community_body));
                assertTrue("Zero is a valid server count", displayed.contains("\u2764\ufe0f 0"));
                assertFalse("Profile must not replace zero likes with demo counts", displayed.contains("445"));
            });
        }
    }

    private void inject(Interceptor interceptor) throws IllegalAccessException {
        httpField.set(server.api, originalHttp.newBuilder().addInterceptor(interceptor).build());
    }

    private static Response jsonResponse(Interceptor.Chain chain, String json) {
        return new Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1)
                .code(200).message("OK")
                .body(ResponseBody.create(json, MediaType.get("application/json"))).build();
    }

    private static boolean hasLoadedProfileImage(View view) {
        if (view instanceof ImageView && ((ImageView) view).getDrawable() != null) return true;
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) {
                if (hasLoadedProfileImage(group.getChildAt(i))) return true;
            }
        }
        return false;
    }
}
