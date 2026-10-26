package com.example.recyclingshareapp;

import android.view.LayoutInflater;
import android.view.View;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.lang.reflect.Field;
import static org.junit.Assert.*;

/** Catches runtime Material theme/inflation errors on an actual Android runtime. */
@RunWith(AndroidJUnit4.class)
public class NativeLayoutsTest {
    @Test public void everyNativeScreenInflatesWithApplicationTheme() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> {
                int count=0;
                for (Field field : R.layout.class.getFields()) {
                    if (!field.getName().startsWith("fragment_")) continue;
                    try {
                        View screen=LayoutInflater.from(activity).inflate(field.getInt(null),null,false);
                        assertNotNull(field.getName(),screen);count++;
                    } catch (ReflectiveOperationException error) { throw new AssertionError(error); }
                }
                assertEquals(53,count);
            });
        }
    }
}
