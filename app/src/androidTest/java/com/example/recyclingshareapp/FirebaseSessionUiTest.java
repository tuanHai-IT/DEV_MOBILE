package com.example.recyclingshareapp;

import android.widget.EditText;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import com.example.recyclingshareapp.data.remote.BackendSession;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import static com.example.recyclingshareapp.CommunityTestSupport.*;
import static org.junit.Assert.*;

/** Exercise actual login and privileged mobile navigation against the demo emulators. */
@RunWith(AndroidJUnit4.class)
public class FirebaseSessionUiTest {
    private CommunityTestSupport server;
    @Before public void connect() { server = new CommunityTestSupport(); }
    @After public void disconnect() { BackendSession.signOut(); }

    @Test public void loginFormAuthenticatesAndLoadsStoredProfile() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            waitFor(scenario, activity -> activity.findViewById(R.id.login_email) != null);
            scenario.onActivity(activity -> {
                ((EditText) activity.findViewById(R.id.login_email)).setText("buyer@ecoshare.test");
                ((EditText) activity.findViewById(R.id.login_password)).setText(PASSWORD);
                activity.findViewById(R.id.login_submit_btn).performClick();
            });
            waitFor(scenario, activity -> BackendSession.isSignedIn()
                    && CommunityTestSupport.screenView(activity, R.id.community_body) != null
                    && CommunityTestSupport.screenView(activity, R.id.community_body).findViewWithTag("post:demo-post-planters") != null);
            assertEquals("demo-buyer", BackendSession.profile().getString("id"));
        }
    }

    @Test public void mobileAdminLoadsLiveCountsAndDeniesMember() throws Exception {
        server.login("admin@ecoshare.test");
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> activity.openCommunity("admin_dashboard", null, false));
            waitFor(scenario, activity -> visibleText(CommunityTestSupport.screenView(activity, R.id.community_body))
                    .contains("Tin chờ") && !visibleText(CommunityTestSupport.screenView(activity, R.id.community_body)).contains("—"));
            screenshot(scenario, "08-mobile-admin");
            BackendSession.signOut();
            server.login("buyer@ecoshare.test");
            scenario.onActivity(activity -> activity.openCommunity("home", null, false));
            scenario.onActivity(activity -> activity.openCommunity("admin_dashboard", null, false));
            waitFor(scenario, activity -> visibleText(CommunityTestSupport.screenView(activity, R.id.community_body))
                    .contains("không có quyền quản trị"));
            scenario.onActivity(activity -> assertFalse(visibleText(CommunityTestSupport.screenView(activity, R.id.community_body))
                    .contains("Tin bán chờ duyệt:")));
        }
    }
}
