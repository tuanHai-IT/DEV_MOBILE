package com.example.recyclingshareapp;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.view.View;
import android.widget.EditText;
import androidx.fragment.app.Fragment;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.example.recyclingshareapp.data.remote.BackendSession;
import com.example.recyclingshareapp.data.remote.FirebaseBackendClient;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.lang.reflect.Field;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import okhttp3.Interceptor;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Protocol;
import okhttp3.Response;
import okhttp3.ResponseBody;
import okio.Buffer;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import static com.example.recyclingshareapp.CommunityTestSupport.*;
import static org.junit.Assert.*;

/** Native payout declarations use private API data and never start a payment or bank verification. */
@RunWith(AndroidJUnit4.class)
public class PayoutAccountUiTest {
    private static final String SAVE_FAILURE = "Không lưu được tài khoản thử nghiệm.";
    private CommunityTestSupport server;
    private Field httpField;
    private OkHttpClient originalHttp;
    private final AtomicReference<JSONObject> stored = new AtomicReference<>();
    private final AtomicBoolean failNextSave = new AtomicBoolean();
    private final AtomicInteger listingWrites = new AtomicInteger();
    private final List<JSONObject> submitted = new CopyOnWriteArrayList<>();

    @Before public void connect() throws Exception {
        server = new CommunityTestSupport();
        server.login("buyer@ecoshare.test");
        httpField = FirebaseBackendClient.class.getDeclaredField("http");
        httpField.setAccessible(true);
        originalHttp = (OkHttpClient) httpField.get(server.api);
    }

    @After public void restoreTransport() throws Exception {
        if (server == null) return;
        // newBuilder shares the pool and dispatcher; restoring ownership avoids closing them twice.
        if (originalHttp != null) httpField.set(server.api, originalHttp);
        BackendSession.signOut();
    }

    @Test public void missingAccountGateSavesBankDeclarationAndReturnsToListingComposer() throws Exception {
        installFixture(null);
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> activity.openCommunity("create_listing", null, false));
            waitFor(scenario, activity -> exactText(activeRoot(activity), "Khai báo tài khoản nhận tiền") != null);
            scenario.onActivity(activity -> {
                assertNull("A missing payout declaration must block listing submission",
                        exactText(activeRoot(activity), "Gửi duyệt"));
                assertNull("Ask for the declaration before collecting a listing draft",
                        screenView(activity, R.id.community_draft_title));
                exactText(activeRoot(activity), "Khai báo tài khoản nhận tiền").performClick();
            });
            waitForForm(scenario);
            capturePreview(scenario, "payout_account_bank");
            scenario.onActivity(activity -> {
                assertEquals("The payout screen must remember the listing return destination", "create_listing",
                        activity.getSupportFragmentManager().getPrimaryNavigationFragment()
                                .requireArguments().getString("entity_id"));
                fillBank(activity, "NGUYEN VAN AN", "Vietcombank", "001234567890");
                screenView(activity, R.id.community_payout_save).performClick();
            });
            waitFor(scenario, activity -> destination(activity, "create_listing")
                    && screenView(activity, R.id.community_draft_title) != null
                    && exactText(activeRoot(activity), "Gửi duyệt") != null);
            assertEquals("The declaration is saved once", 1, submitted.size());
            JSONObject body = submitted.get(0);
            assertEquals("BANK", body.getString("method"));
            assertEquals("NGUYEN VAN AN", body.getString("account_holder"));
            assertEquals("Vietcombank", body.getString("bank_name"));
            assertEquals("001234567890", body.getString("account_number"));
            assertFalse("Declaring an account must not claim bank verification", body.has("verified"));
            assertEquals("Opening the composer must not create a listing", 0, listingWrites.get());
        }
    }

    @Test public void failedSaveKeepsBankFieldsAndAllowsExplicitRetry() throws Exception {
        installFixture(null);
        failNextSave.set(true);
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> activity.openCommunity("payout_account", null, false));
            waitForForm(scenario);
            scenario.onActivity(activity -> {
                fillBank(activity, "TRAN THI BINH", "ACB", "000987654321");
                screenView(activity, R.id.community_payout_save).performClick();
            });
            waitFor(scenario, activity -> submitted.size() == 1
                    && screenView(activity, R.id.community_payout_save) != null
                    && screenView(activity, R.id.community_payout_save).isEnabled()
                    && visibleText(activity.getWindow().getDecorView()).contains(SAVE_FAILURE));
            scenario.onActivity(activity -> {
                assertTrue("A failed declaration must remain on its form", destination(activity, "payout_account"));
                assertEquals("TRAN THI BINH", entry(activity, R.id.community_payout_holder).getText().toString());
                assertEquals("ACB", entry(activity, R.id.community_payout_bank).getText().toString());
                assertEquals("000987654321", entry(activity, R.id.community_payout_number).getText().toString());
                assertNull(stored.get());
                screenView(activity, R.id.community_payout_save).performClick();
            });
            waitFor(scenario, activity -> submitted.size() == 2 && stored.get() != null
                    && destination(activity, "payout_account")
                    && screenView(activity, R.id.community_payout_save) != null
                    && screenView(activity, R.id.community_payout_save).isEnabled());
            assertEquals("A failed write is retried only by the user", 2, submitted.size());
            assertEquals(submitted.get(0).toString(), submitted.get(1).toString());
            assertEquals(0, listingWrites.get());
        }
    }

    @Test public void settingsReopensBankDeclarationAndMomoSwitchSendsOnlyMomoFields() throws Exception {
        installFixture(new JSONObject().put("method", "BANK").put("account_holder", "LE VAN CUONG")
                .put("bank_name", "Techcombank").put("account_number", "001122334455")
                .put("updated_at", "2026-10-26T10:00:00.000Z"));
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> activity.openCommunity("settings", null, false));
            waitFor(scenario, activity -> activeRoot(activity) != null
                    && activeRoot(activity).findViewWithTag("open_payout_account") != null);
            scenario.onActivity(activity -> activeRoot(activity).findViewWithTag("open_payout_account").performClick());
            waitFor(scenario, activity -> hasText(activity, R.id.community_payout_number, "001122334455"));
            scenario.recreate();
            waitFor(scenario, activity -> hasText(activity, R.id.community_payout_number, "001122334455"));
            scenario.onActivity(activity -> {
                assertEquals("LE VAN CUONG", entry(activity, R.id.community_payout_holder).getText().toString());
                assertEquals("Techcombank", entry(activity, R.id.community_payout_bank).getText().toString());
                assertNotNull("The form must explain the declaration status",
                        screenView(activity, R.id.community_payout_status));
                screenView(activity, R.id.community_payout_momo_method).performClick();
            });
            waitFor(scenario, activity -> screenView(activity, R.id.community_payout_phone) != null
                    && screenView(activity, R.id.community_payout_phone).isShown());
            capturePreview(scenario, "payout_account_momo");
            scenario.onActivity(activity -> {
                entry(activity, R.id.community_payout_holder).setText("LE VAN CUONG");
                entry(activity, R.id.community_payout_phone).setText("0901234567");
                screenView(activity, R.id.community_payout_save).performClick();
            });
            waitFor(scenario, activity -> submitted.size() == 1 && stored.get() != null
                    && "MOMO".equals(stored.get().optString("method"))
                    && screenView(activity, R.id.community_payout_save) != null
                    && screenView(activity, R.id.community_payout_save).isEnabled());
            JSONObject body = submitted.get(0);
            assertEquals("MOMO", body.getString("method"));
            assertEquals("LE VAN CUONG", body.getString("account_holder"));
            assertEquals("0901234567", body.getString("phone"));
            assertTrue("MoMo must not submit stale bank details", body.isNull("bank_name"));
            assertTrue("MoMo must not submit stale bank account numbers", body.isNull("account_number"));
            scenario.onActivity(activity -> activity.openCommunity("settings", null, false));
            waitFor(scenario, activity -> destination(activity, "settings"));
            scenario.onActivity(activity -> activeRoot(activity).findViewWithTag("open_payout_account").performClick());
            waitFor(scenario, activity -> hasText(activity, R.id.community_payout_phone, "0901234567"));
            assertEquals("Reopening the form must not save again", 1, submitted.size());
            assertEquals(0, listingWrites.get());
        }
    }

    private void installFixture(JSONObject initial) throws Exception {
        stored.set(initial);
        JSONObject profile = new JSONObject(BackendSession.profile().toString());
        profile.put("verified", true).put("verification_status", "VERIFIED")
                .put("payout_account_ready", initial != null);
        BackendSession.setProfile(profile);
        httpField.set(server.api, originalHttp.newBuilder().addInterceptor(chain -> {
            String path = chain.request().url().encodedPath();
            String method = chain.request().method();
            try {
                if (path.endsWith("/me/payout-account")) {
                    if ("GET".equals(method)) return jsonResponse(chain, 200, payoutResponse());
                    if ("PUT".equals(method)) {
                        Buffer buffer = new Buffer();
                        assertNotNull(chain.request().body());
                        chain.request().body().writeTo(buffer);
                        JSONObject body = new JSONObject(buffer.readUtf8());
                        submitted.add(body);
                        if (failNextSave.compareAndSet(true, false)) {
                            return jsonResponse(chain, 503, new JSONObject().put("error", new JSONObject()
                                    .put("code", "PAYOUT_FIXTURE_UNAVAILABLE").put("message", SAVE_FAILURE)));
                        }
                        stored.set(new JSONObject(body.toString()).put("updated_at", "2026-10-27T10:00:00.000Z"));
                        return jsonResponse(chain, 200, payoutResponse());
                    }
                }
                if (path.endsWith("/me") && "GET".equals(method)) {
                    return jsonResponse(chain, 200, new JSONObject(profile.toString())
                            .put("payout_account_ready", stored.get() != null));
                }
                if (path.endsWith("/categories") && "GET".equals(method)) {
                    return jsonResponse(chain, 200, new JSONObject().put("items", new JSONArray()
                            .put(new JSONObject().put("id", "payout-ui-category").put("name", "Đồ gia dụng"))));
                }
                if (path.endsWith("/listings") && "POST".equals(method)) {
                    listingWrites.incrementAndGet();
                    return jsonResponse(chain, 400, new JSONObject().put("error", new JSONObject()
                            .put("code", "UNEXPECTED_LISTING_WRITE").put("message", "Test must not create a listing.")));
                }
            } catch (JSONException error) {
                throw new IOException("Invalid payout UI fixture JSON", error);
            }
            return chain.proceed(chain.request());
        }).build());
    }

    private JSONObject payoutResponse() throws JSONException {
        JSONObject account = stored.get();
        return new JSONObject().put("payout_account", account == null ? JSONObject.NULL : account)
                .put("payout_account_ready", account != null);
    }

    private static Response jsonResponse(Interceptor.Chain chain, int status, JSONObject data) {
        return new Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1)
                .code(status).message(status == 200 ? "OK" : "Fixture failure")
                .body(ResponseBody.create(data.toString(), MediaType.get("application/json"))).build();
    }

    private static void waitForForm(ActivityScenario<MainActivity> scenario) throws Exception {
        waitFor(scenario, activity -> destination(activity, "payout_account")
                && screenView(activity, R.id.community_payout_holder) != null
                && screenView(activity, R.id.community_payout_save) != null
                && screenView(activity, R.id.community_payout_save).isEnabled());
    }

    /** The emulator's display screenshot may be black; draw this native form directly for review. */
    private static void capturePreview(ActivityScenario<MainActivity> scenario, String name) throws Exception {
        if (!screenshotsEnabled()) return;
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
        AtomicReference<Bitmap> rendered = new AtomicReference<>();
        AtomicReference<File> directory = new AtomicReference<>();
        scenario.onActivity(activity -> {
            View decor = activity.getWindow().getDecorView();
            assertTrue("The preview requires a laid out activity", decor.getWidth() > 0 && decor.getHeight() > 0);
            Bitmap bitmap = Bitmap.createBitmap(decor.getWidth(), decor.getHeight(), Bitmap.Config.ARGB_8888);
            decor.draw(new Canvas(bitmap));
            rendered.set(bitmap);
            directory.set(new File(activity.getExternalFilesDir(null), "screenshots"));
        });
        Bitmap bitmap = rendered.get();
        assertNotNull("The native view must provide a preview", bitmap);
        try {
            File folder = directory.get();
            assertTrue(folder.isDirectory() || folder.mkdirs());
            File target = new File(folder, name.replaceAll("[^A-Za-z0-9_-]", "_") + ".png");
            try (FileOutputStream output = new FileOutputStream(target)) {
                assertTrue(bitmap.compress(Bitmap.CompressFormat.PNG, 100, output));
            }
            System.out.println("EcoShare payout preview: " + target.getAbsolutePath());
        } finally {
            bitmap.recycle();
        }
    }

    private static void fillBank(MainActivity activity, String holder, String bank, String number) {
        screenView(activity, R.id.community_payout_bank_method).performClick();
        entry(activity, R.id.community_payout_holder).setText(holder);
        entry(activity, R.id.community_payout_bank).setText(bank);
        entry(activity, R.id.community_payout_number).setText(number);
    }

    private static EditText entry(MainActivity activity, int id) { return screenView(activity, id); }

    private static boolean hasText(MainActivity activity, int id, String expected) {
        EditText entry = screenView(activity, id);
        return entry != null && entry.isShown() && expected.contentEquals(entry.getText());
    }

    private static View activeRoot(MainActivity activity) {
        Fragment fragment = activity.getSupportFragmentManager().getPrimaryNavigationFragment();
        return fragment == null ? null : fragment.getView();
    }

    private static boolean destination(MainActivity activity, String expected) {
        Fragment fragment = activity.getSupportFragmentManager().getPrimaryNavigationFragment();
        return fragment != null && fragment.getArguments() != null
                && expected.equals(fragment.getArguments().getString("destination"));
    }
}
