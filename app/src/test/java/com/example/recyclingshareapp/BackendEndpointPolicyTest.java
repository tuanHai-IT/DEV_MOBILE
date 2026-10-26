package com.example.recyclingshareapp;

import com.example.recyclingshareapp.data.remote.BackendEndpointPolicy;
import org.junit.Test;
import java.net.URI;
import static org.junit.Assert.*;

public class BackendEndpointPolicyTest {
    @Test public void productionUsesHttpsAndKeepsFunctionPrefix() {
        URI base = BackendEndpointPolicy.validateBase("https://example.test/api", false);
        assertEquals("https://example.test/api/me", BackendEndpointPolicy.apiPath(base, "/me").toString());
        assertEquals("https://example.test/api/listings?limit=10", BackendEndpointPolicy.apiPath(base, "/listings?limit=10").toString());
    }
    @Test public void releaseRejectsAllCleartext() {
        assertThrows(IllegalArgumentException.class, () -> BackendEndpointPolicy.validateBase("http://10.0.2.2:5001/api", false));
        assertThrows(IllegalArgumentException.class, () -> BackendEndpointPolicy.validateBase("http://127.0.0.1:5001/api", false));
    }
    @Test public void debugOnlyAllowsExactLocalEmulatorAddresses() {
        assertEquals("10.0.2.2", BackendEndpointPolicy.validateBase("http://10.0.2.2:5001/api", true).getHost());
        assertEquals("127.0.0.1", BackendEndpointPolicy.validateBase("http://127.0.0.1:5001/api", true).getHost());
        assertThrows(IllegalArgumentException.class, () -> BackendEndpointPolicy.validateBase("http://192.168.1.2/api", true));
        assertThrows(IllegalArgumentException.class, () -> BackendEndpointPolicy.validateBase("http://10.0.2.2.evil.test/api", true));
    }
    @Test public void rejectsCredentialsQueriesAndDotSegmentsInBase() {
        assertThrows(IllegalArgumentException.class, () -> BackendEndpointPolicy.validateBase("https://user:password@example.test/api", true));
        assertThrows(IllegalArgumentException.class, () -> BackendEndpointPolicy.validateBase("https://example.test/api?token=secret", true));
        assertThrows(IllegalArgumentException.class, () -> BackendEndpointPolicy.validateBase("https://example.test/api/../other", true));
    }
    @Test public void pathsCannotRedirectAuthorizationToAnotherOrigin() {
        URI base = BackendEndpointPolicy.validateBase("https://example.test/api", false);
        assertThrows(IllegalArgumentException.class, () -> BackendEndpointPolicy.apiPath(base, "//attacker.test/me"));
        assertThrows(IllegalArgumentException.class, () -> BackendEndpointPolicy.apiPath(base, "https://attacker.test/me"));
        assertThrows(IllegalArgumentException.class, () -> BackendEndpointPolicy.apiPath(base, "/../private"));
        assertThrows(IllegalArgumentException.class, () -> BackendEndpointPolicy.apiPath(base, "/%2e%2e/private"));
        assertThrows(IllegalArgumentException.class, () -> BackendEndpointPolicy.apiPath(base, "/%2f%2fattacker.test"));
        assertThrows(IllegalArgumentException.class, () -> BackendEndpointPolicy.apiPath(base, "/me#other"));
        assertThrows(IllegalArgumentException.class, () -> BackendEndpointPolicy.apiPath(base, "/\\attacker.test"));
    }
    @Test public void sparkLocalModeRequiresDebugAndThePinnedRealProject() {
        URI base=BackendEndpointPolicy.validateSparkLocalBase("http://10.0.2.2:5002/v1",true,"recycling-share-app");
        assertEquals("http://10.0.2.2:5002/v1/",base.toString());
        assertThrows(IllegalArgumentException.class,()->BackendEndpointPolicy.validateSparkLocalBase("http://10.0.2.2:5002/v1",false,"recycling-share-app"));
        assertThrows(IllegalArgumentException.class,()->BackendEndpointPolicy.validateSparkLocalBase("http://10.0.2.2:5002/v1",true,"demo-recycling-share"));
        assertThrows(IllegalArgumentException.class,()->BackendEndpointPolicy.validateSparkLocalBase("http://10.0.2.2:5002/v1",true,"another-project"));
    }
    @Test public void sparkModeCannotUseEmulatorOrRemoteEndpoints() {
        for(String value:new String[]{"http://10.0.2.2:5001/v1","http://10.0.2.2:5002/api/v1","https://10.0.2.2:5002/v1","http://192.168.1.2:5002/v1","http://10.0.2.2.evil.test:5002/v1"})
            assertThrows(value,IllegalArgumentException.class,()->BackendEndpointPolicy.validateSparkLocalBase(value,true,"recycling-share-app"));
    }
    @Test public void inlineMediaUploadIsBoundToItsIssuedIdAndBackend() {
        URI base=BackendEndpointPolicy.validateSparkLocalBase("http://10.0.2.2:5002/v1",true,"recycling-share-app");
        assertEquals("http://10.0.2.2:5002/v1/media/photo-123/upload",BackendEndpointPolicy.firestoreUploadPath(base,"photo-123","/media/photo-123/upload").toString());
        for(String path:new String[]{"/media/other/upload","//attacker.test/upload","/media/photo-123/upload?token=secret","/media/photo-123/../upload","https://attacker.test/upload"})
            assertThrows(IllegalArgumentException.class,()->BackendEndpointPolicy.firestoreUploadPath(base,"photo-123",path));
    }
}
