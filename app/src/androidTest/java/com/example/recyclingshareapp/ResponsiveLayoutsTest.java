package com.example.recyclingshareapp;

import android.content.pm.ActivityInfo;
import android.content.Context;
import android.content.res.Configuration;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.ContextThemeWrapper;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

/** Checks the navigation and sign-in controls used when a phone rotates. */
@RunWith(AndroidJUnit4.class)
public class ResponsiveLayoutsTest {
    @Test public void activityRecreatesWithLandscapeNavigation() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> activity.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE));
            scenario.recreate();
            scenario.onActivity(activity -> {
                assertEquals(Configuration.ORIENTATION_LANDSCAPE,
                        activity.getResources().getConfiguration().orientation);
                LinearLayout rail = activity.findViewById(R.id.bottom_nav_container);
                assertTrue(rail.getChildAt(0) instanceof ScrollView);
                assertEquals(LinearLayout.VERTICAL,
                        ((LinearLayout) activity.findViewById(R.id.bottom_navigation)).getOrientation());
            });
        }
    }

    @Test public void landscapeUsesScrollableRailAndVisibleSignInForm() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> {
                Configuration landscape = new Configuration(activity.getResources().getConfiguration());
                landscape.orientation = Configuration.ORIENTATION_LANDSCAPE;
                Context context = new ContextThemeWrapper(
                        activity.createConfigurationContext(landscape), R.style.Theme_RecyclingShareApp);
                LayoutInflater inflater = LayoutInflater.from(context);

                View shell = inflater.inflate(R.layout.activity_main, null, false);
                LinearLayout rail = shell.findViewById(R.id.bottom_nav_container);
                assertTrue(rail.getChildAt(0) instanceof ScrollView);
                LinearLayout navigation = shell.findViewById(R.id.bottom_navigation);
                assertEquals(LinearLayout.VERTICAL, navigation.getOrientation());
                for (int id : new int[]{R.id.nav_home, R.id.nav_explore, R.id.nav_create,
                        R.id.nav_messages, R.id.nav_profile, R.id.screen_container}) {
                    assertNotNull(shell.findViewById(id));
                }

                View login = inflater.inflate(R.layout.fragment_login, null, false);
                assertTrue(login instanceof LinearLayout);
                assertEquals(LinearLayout.HORIZONTAL, ((LinearLayout) login).getOrientation());
                for (int id : new int[]{R.id.login_email, R.id.login_password,
                        R.id.login_submit_btn, R.id.btn_google, R.id.go_register}) {
                    assertNotNull(login.findViewById(id));
                }
                ViewGroup rightPane = (ViewGroup) ((LinearLayout) login).getChildAt(1);
                assertTrue(rightPane instanceof ScrollView);
            });
        }
    }
}
