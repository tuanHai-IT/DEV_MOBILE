package com.example.recyclingshareapp.data.remote;

import org.junit.Test;
import static org.junit.Assert.assertEquals;

/** Guards the automatic backend selection after removing the login-screen selector. */
public class BackendSessionModeTest {
    @Test public void pinnedProjectDebugUsesSpark() {
        assertEquals(BackendSession.Mode.SPARK_LOCAL,
                BackendSession.resolveMode(true, "recycling-share-app"));
    }

    @Test public void releaseAlwaysUsesCloud() {
        assertEquals(BackendSession.Mode.CLOUD_FUNCTIONS,
                BackendSession.resolveMode(false, "recycling-share-app"));
        assertEquals(BackendSession.Mode.CLOUD_FUNCTIONS,
                BackendSession.resolveMode(false, "demo-recycling-share"));
    }

    @Test public void anotherOrMissingProjectDoesNotDefaultToRealSpark() {
        for (String project : new String[]{null, "demo-recycling-share", "another-project"}) {
            assertEquals(BackendSession.Mode.CLOUD_FUNCTIONS,
                    BackendSession.resolveMode(true, project));
        }
    }
}
