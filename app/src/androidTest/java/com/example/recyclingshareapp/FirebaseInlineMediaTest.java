package com.example.recyclingshareapp;

import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.example.recyclingshareapp.data.remote.FirebaseBackendClient;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Assume;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.Iterator;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;
import static org.junit.Assert.*;

/** Separate local API with Firestore inline media and Auth Emulator; never uses Spark/cloud accounts. */
@RunWith(AndroidJUnit4.class)
public class FirebaseInlineMediaTest {
    private FirebaseBackendClient client;
    private String scanId;

    @Before public void connectToExplicitInlineEmulator() throws Exception {
        Assume.assumeTrue("Enable ecoshareEmulator and ecoshareInlineEmulator with the seeded local API on port 5003",
                "true".equals(InstrumentationRegistry.getArguments().getString("ecoshareEmulator"))
                && "true".equals(InstrumentationRegistry.getArguments().getString("ecoshareInlineEmulator")));
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        if(android.os.Build.VERSION.SDK_INT>=37)InstrumentationRegistry.getInstrumentation().getUiAutomation().grantRuntimePermission(
                context.getPackageName(),"android.permission.ACCESS_LOCAL_NETWORK");
        client=FirebaseBackendClient.forInlineEmulator(context);
        assertFalse("This test must never use real Firebase Auth",client.isSparkLocal());
        this.<FirebaseBackendClient.SessionInfo>await(done->client.signIn("buyer@ecoshare.test",CommunityTestSupport.PASSWORD,done));
        JSONObject profile=request("GET","/me",null,null);assertEquals("demo-buyer",profile.getString("id"));
    }

    @After public void archiveOnlyCreatedFixture() throws Exception {
        if(client==null)return;
        try { if(scanId!=null)request("DELETE","/scans/"+scanId,null,null); }
        finally { client.close(); }
    }

    @Test public void inlineTicketUploadsRawBytesFinalizesAndDownloadsWithoutLeakingBlobJson() throws Exception {
        JSONObject created=request("POST","/scans",new JSONObject().put("title","QA-INLINE-ANDROID-"+UUID.randomUUID()),UUID.randomUUID().toString());
        scanId=created.getString("id");assertEquals("PRIVATE",created.getString("status"));
        byte[] original=android.util.Base64.decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+kTaYAAAAASUVORK5CYII=",android.util.Base64.DEFAULT);
        JSONObject complete=await(done->client.uploadMedia("SCAN",scanId,"image/png",original,done));
        assertEquals("READY",complete.getString("status"));String mediaId=complete.getString("id");
        byte[] stored=await(done->client.downloadMedia(mediaId,done));assertArrayEquals("Inline PUT/complete/download must preserve the original bytes",original,stored);
        JSONObject metadata=request("GET","/media?parent_kind=SCAN&parent_id="+scanId,null,null);
        JSONArray items=metadata.getJSONArray("items");assertEquals(1,items.length());JSONObject row=items.getJSONObject(0);
        assertEquals(mediaId,row.getString("id"));assertEquals("image/png",row.getString("mime_type"));assertEquals(original.length,row.getInt("size_bytes"));assertEquals("PRIVATE",row.getString("visibility"));
        assertNoPrivateBlobFields(metadata);
        JSONObject scan=request("GET","/scans/"+scanId,null,null);assertNoPrivateBlobFields(scan);assertEquals(mediaId,scan.getJSONArray("media").getJSONObject(0).getString("id"));
    }

    private void assertNoPrivateBlobFields(Object value) throws Exception {
        if(value instanceof JSONObject){JSONObject object=(JSONObject)value;Iterator<String> keys=object.keys();while(keys.hasNext()){String key=keys.next();assertFalse("Private Firestore bytes must not enter JSON: "+key,key.startsWith("_inline")||"bytes".equals(key)||"buffer".equals(key));assertNoPrivateBlobFields(object.get(key));}}
        else if(value instanceof JSONArray){JSONArray values=(JSONArray)value;for(int i=0;i<values.length();i++)assertNoPrivateBlobFields(values.get(i));}
    }
    private JSONObject request(String method,String path,JSONObject body,String key)throws Exception{return await(done->client.request(method,path,body,key,done));}
    private <T>T await(Consumer<FirebaseBackendClient.Callback<T>> action)throws Exception{
        CountDownLatch complete=new CountDownLatch(1);AtomicReference<T> result=new AtomicReference<>();AtomicReference<Exception> failure=new AtomicReference<>();
        action.accept(new FirebaseBackendClient.Callback<T>(){public void onSuccess(T value){result.set(value);complete.countDown();}public void onError(FirebaseBackendClient.BackendException error){failure.set(error);complete.countDown();}});
        assertTrue("Inline emulator request timed out",complete.await(40,TimeUnit.SECONDS));if(failure.get()!=null)throw failure.get();return result.get();
    }
}
