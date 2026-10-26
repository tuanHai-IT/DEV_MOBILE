package com.example.recyclingshareapp;

import android.content.Context;
import android.graphics.Bitmap;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.platform.app.InstrumentationRegistry;
import com.example.recyclingshareapp.data.remote.BackendSession;
import com.example.recyclingshareapp.data.remote.FirebaseBackendClient;
import com.example.recyclingshareapp.ui.CommunityFragment;
import org.json.JSONObject;
import org.junit.Assume;
import java.util.concurrent.CountDownLatch;
import java.io.File;
import java.io.FileOutputStream;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;
import java.util.function.Predicate;
import static org.junit.Assert.*;

/** Explicitly enabled emulator-only helpers; never use configured cloud endpoints in UI tests. */
final class CommunityTestSupport {
    static final String PASSWORD="EcoShareDemo123!";
    final Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
    final FirebaseBackendClient api;
    CommunityTestSupport(){
        Assume.assumeTrue("Run with -Pandroid.testInstrumentationRunnerArguments.ecoshareEmulator=true and seeded Firebase emulators",
                "true".equals(InstrumentationRegistry.getArguments().getString("ecoshareEmulator")));
        if(android.os.Build.VERSION.SDK_INT>=37) {
            InstrumentationRegistry.getInstrumentation().getUiAutomation().grantRuntimePermission(
                    context.getPackageName(),"android.permission.ACCESS_LOCAL_NETWORK");
        }
        BackendSession.useEmulator(context,true);api=BackendSession.get(context);
        BackendSession.signOut();
        CommunityFragment.clearPagedSnapshots();
    }
    <T>T await(Consumer<FirebaseBackendClient.Callback<T>> operation)throws Exception{
        CountDownLatch latch=new CountDownLatch(1);AtomicReference<T> value=new AtomicReference<>();AtomicReference<Exception> failure=new AtomicReference<>();
        operation.accept(new FirebaseBackendClient.Callback<T>(){public void onSuccess(T result){value.set(result);latch.countDown();}public void onError(FirebaseBackendClient.BackendException error){failure.set(error);latch.countDown();}});
        assertTrue("Firebase emulator request timed out",latch.await(40,TimeUnit.SECONDS));if(failure.get()!=null)throw failure.get();return value.get();
    }
    void login(String email)throws Exception {this.<FirebaseBackendClient.SessionInfo>await(cb->api.signIn(email,PASSWORD,cb));BackendSession.setProfile(request("GET","/me",null,null));}
    JSONObject request(String method,String path,JSONObject data,String key)throws Exception{return await(cb->api.request(method,path,data,key,cb));}
    static boolean screenshotsEnabled(){return "true".equals(InstrumentationRegistry.getArguments().getString("ecoshareScreenshots"));}
    static void screenshot(ActivityScenario<MainActivity> scenario,String name)throws Exception{
        if(!screenshotsEnabled())return;
        scenario.onActivity(activity->{android.view.inputmethod.InputMethodManager keyboard=(android.view.inputmethod.InputMethodManager)activity.getSystemService(Context.INPUT_METHOD_SERVICE);keyboard.hideSoftInputFromWindow(activity.getWindow().getDecorView().getWindowToken(),0);activity.getWindow().getDecorView().clearFocus();});
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();Thread.sleep(400);
        Bitmap image=InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();assertNotNull("Android renderer did not provide a screenshot",image);
        File directory=new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalFilesDir(null),"screenshots");assertTrue(directory.isDirectory()||directory.mkdirs());
        File target=new File(directory,name.replaceAll("[^A-Za-z0-9_-]","_")+".png");try(FileOutputStream output=new FileOutputStream(target)){assertTrue(image.compress(Bitmap.CompressFormat.PNG,100,output));}finally{image.recycle();}
        System.out.println("EcoShare screenshot: "+target.getAbsolutePath());
    }
    static void waitFor(ActivityScenario<MainActivity> scenario,Predicate<MainActivity> check)throws Exception{
        long deadline=android.os.SystemClock.elapsedRealtime()+30000;AtomicReference<Throwable> last=new AtomicReference<>();
        while(android.os.SystemClock.elapsedRealtime()<deadline){java.util.concurrent.atomic.AtomicBoolean okay=new java.util.concurrent.atomic.AtomicBoolean();scenario.onActivity(activity->{try{okay.set(check.test(activity));}catch(Throwable error){last.set(error);}});if(okay.get())return;Thread.sleep(100);}
        AssertionError error=new AssertionError("Expected native UI state was not displayed within 30 seconds");if(last.get()!=null)error.initCause(last.get());throw error;
    }
    static String visibleText(View view){if(view==null||view.getVisibility()!=View.VISIBLE)return "";StringBuilder value=new StringBuilder();if(view instanceof TextView)value.append(((TextView)view).getText()).append('\n');if(view instanceof ViewGroup){ViewGroup group=(ViewGroup)view;for(int i=0;i<group.getChildCount();i++)value.append(visibleText(group.getChildAt(i)));}return value.toString();}
    /** Hidden retained tabs have the same layout IDs; assertions must target the active screen. */
    static <T extends View> T screenView(MainActivity activity, int id) {
        androidx.fragment.app.Fragment fragment = activity.getSupportFragmentManager().getPrimaryNavigationFragment();
        View root = fragment == null ? null : fragment.getView();
        return root == null ? null : root.findViewById(id);
    }
    static TextView exactText(View root,String text){if(root instanceof TextView&&text.contentEquals(((TextView)root).getText())&&root.isShown())return (TextView)root;if(root instanceof ViewGroup){ViewGroup group=(ViewGroup)root;for(int i=0;i<group.getChildCount();i++){TextView found=exactText(group.getChildAt(i),text);if(found!=null)return found;}}return null;}
}
