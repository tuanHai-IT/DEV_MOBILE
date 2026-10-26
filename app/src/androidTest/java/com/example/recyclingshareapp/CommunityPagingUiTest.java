package com.example.recyclingshareapp;

import android.view.View;
import android.view.ViewGroup;
import android.view.MotionEvent;
import android.widget.ScrollView;
import android.widget.TextView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import com.example.recyclingshareapp.data.remote.BackendSession;
import com.example.recyclingshareapp.data.remote.FirebaseBackendClient;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.lang.reflect.Field;
import java.io.IOException;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicBoolean;
import okhttp3.Interceptor;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Protocol;
import okhttp3.Response;
import okhttp3.ResponseBody;
import static com.example.recyclingshareapp.CommunityTestSupport.*;
import static org.junit.Assert.*;

/** Uses seeded demo Auth and in-memory GET fixtures; no cloud account or Firestore write. */
@RunWith(AndroidJUnit4.class)
public class CommunityPagingUiTest {
    private CommunityTestSupport server;
    private Field httpField;
    private OkHttpClient originalHttp;

    @Before public void connect() throws Exception {
        server=new CommunityTestSupport();
        server.login("buyer@ecoshare.test");
        httpField=FirebaseBackendClient.class.getDeclaredField("http");
        httpField.setAccessible(true);
        originalHttp=(OkHttpClient)httpField.get(server.api);
    }

    @After public void restore() throws Exception {
        if(server==null)return;
        if(originalHttp!=null)httpField.set(server.api,originalHttp);
        BackendSession.signOut();
    }

    @Test public void homeStartsWithThreeAndFetchesNextPageOnlyNearBottom() throws Exception {
        AtomicInteger first=new AtomicInteger(),second=new AtomicInteger();
        inject(chain->{
            if(chain.request().url().encodedPath().endsWith("/posts")){
                assertEquals(String.valueOf(FirebaseBackendClient.FIRST_PAGE_SIZE),chain.request().url().queryParameter("limit"));
                String cursor=chain.request().url().queryParameter("cursor");
                if(cursor==null){first.incrementAndGet();return response(chain,posts(1,3,"page-three"));}
                assertEquals("page-three",cursor);second.incrementAndGet();return response(chain,posts(3,5,null));
            }
            return chain.proceed(chain.request());
        });
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            waitFor(scenario,activity->countPosts(CommunityTestSupport.screenView(activity, R.id.community_body))==3);
            scenario.onActivity(activity->{
                assertEquals(1,first.get());assertEquals("The next page must wait for scroll",0,second.get());
                assertNull(CommunityTestSupport.screenView(activity, R.id.community_body).findViewWithTag("post:p4"));
                ScrollView list=CommunityTestSupport.screenView(activity, R.id.community_scroll);
                assertTrue("Three cards must make the viewport scrollable",list.getChildAt(0).getHeight()>list.getHeight());
            });
            scenario.onActivity(activity->dragUp(CommunityTestSupport.screenView(activity, R.id.community_scroll)));
            waitFor(scenario,activity->countPosts(CommunityTestSupport.screenView(activity, R.id.community_body))==5);
            scenario.onActivity(activity->{assertEquals(1,first.get());assertEquals("Exactly one append request",1,second.get());assertNotNull(CommunityTestSupport.screenView(activity, R.id.community_body).findViewWithTag("post:p5"));});
        }
    }

    @Test public void exploreTabsReuseTheirLoadedPagesAndKeepIndependentCursors() throws Exception {
        AtomicInteger tipsFirst=new AtomicInteger(),marketFirst=new AtomicInteger(),tipsNext=new AtomicInteger();
        inject(chain->{
            String path=chain.request().url().encodedPath();
            if(path.endsWith("/tips")){
                assertEquals(String.valueOf(FirebaseBackendClient.FIRST_PAGE_SIZE),chain.request().url().queryParameter("limit"));
                String cursor=chain.request().url().queryParameter("cursor");
                if(cursor==null){tipsFirst.incrementAndGet();return response(chain,tips(1,3,"tip-three"));}
                assertEquals("tip-three",cursor);tipsNext.incrementAndGet();return response(chain,tips(4,4,null));
            }
            if(path.endsWith("/listings")){
                assertEquals(String.valueOf(FirebaseBackendClient.FIRST_PAGE_SIZE),chain.request().url().queryParameter("limit"));
                assertNull(chain.request().url().queryParameter("cursor"));
                marketFirst.incrementAndGet();return response(chain,listings(1,3));
            }
            return chain.proceed(chain.request());
        });
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            scenario.onActivity(activity->activity.openCommunity("explore",null,false));
            waitFor(scenario,activity->countPosts(CommunityTestSupport.screenView(activity, R.id.community_body))==3);
            scenario.onActivity(activity->{
                assertEquals(1,tipsFirst.get());assertEquals(0,tipsNext.get());
                TextView market=exactText(CommunityTestSupport.screenView(activity, R.id.community_body),"🧳 Trao đổi");assertNotNull(market);market.performClick();
            });
            waitFor(scenario,activity->visibleText(CommunityTestSupport.screenView(activity, R.id.community_body)).contains("Tin bán mẫu 3"));
            scenario.onActivity(activity->{
                assertEquals(1,marketFirst.get());
                TextView tipsTab=exactText(CommunityTestSupport.screenView(activity, R.id.community_body),"💡 Mẹo hay");assertNotNull(tipsTab);tipsTab.performClick();
            });
            scenario.onActivity(activity->{
                assertEquals(1,tipsFirst.get());assertEquals(3,countPosts(CommunityTestSupport.screenView(activity, R.id.community_body)));
                TextView more=exactText(CommunityTestSupport.screenView(activity, R.id.community_body),"Xem thêm");assertNotNull(more);more.performClick();
            });
            waitFor(scenario,activity->countPosts(CommunityTestSupport.screenView(activity, R.id.community_body))==4);
            scenario.onActivity(activity->{assertEquals(1,tipsFirst.get());assertEquals(1,tipsNext.get());assertEquals(1,marketFirst.get());});
        }
    }

    @Test public void profileEcoLinkOpensChallengesOnNewAndRetainedExploreTab() throws Exception {
        inject(chain -> {
            if (chain.request().url().encodedPath().endsWith("/challenges"))
                return response(chain, "{\"items\":[{\"id\":\"eco-profile-challenge\",\"title\":\"Thử thách từ hồ sơ\",\"body\":\"Tái chế cùng cộng đồng\"}],\"next_cursor\":null}");
            return chain.proceed(chain.request());
        });
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            for (int attempt = 0; attempt < 2; attempt++) {
                scenario.onActivity(activity -> activity.openCommunity("profile", null, false));
                waitFor(scenario, activity -> exactText(screenView(activity, R.id.community_body), "Xem thử thách →") != null);
                scenario.onActivity(activity -> exactText(screenView(activity, R.id.community_body), "Xem thử thách →").performClick());
                waitFor(scenario, activity -> screenView(activity, R.id.community_body) != null
                        && screenView(activity, R.id.community_body).findViewWithTag("challenge:eco-profile-challenge") != null);
                if (attempt == 0) {
                    scenario.onActivity(activity -> exactText(screenView(activity, R.id.community_body), "💡 Mẹo hay").performClick());
                    waitFor(scenario, activity -> screenView(activity, R.id.community_body).findViewWithTag("challenge:eco-profile-challenge") == null);
                }
            }
        }
    }

    @Test public void mainTabsKeepTheirViewsAndRefreshAfterAConfirmedChange() throws Exception {
        AtomicInteger postsReads = new AtomicInteger();
        AtomicBoolean edited = new AtomicBoolean();
        inject(chain -> {
            String path = chain.request().url().encodedPath();
            if (path.endsWith("/posts")) {
                postsReads.incrementAndGet();
                String fixture = posts(1, 3, null);
                return response(chain, edited.get() ? fixture.replace("Chia sẻ cách tái sử dụng vật liệu sạch trong gia đình.", "Nội dung mới từ quản trị") : fixture);
            }
            if (path.endsWith("/tips")) return response(chain, tips(1, 3, null));
            return chain.proceed(chain.request());
        });
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            waitFor(scenario, activity -> countPosts(screenView(activity, R.id.community_body)) == 3);
            java.util.concurrent.atomic.AtomicReference<androidx.fragment.app.Fragment> home = new java.util.concurrent.atomic.AtomicReference<>();
            java.util.concurrent.atomic.AtomicReference<View> homeView = new java.util.concurrent.atomic.AtomicReference<>();
            scenario.onActivity(activity -> {
                home.set(activity.getSupportFragmentManager().getPrimaryNavigationFragment());
                homeView.set(home.get().getView());
                activity.openCommunity("explore", null, false);
            });
            waitFor(scenario, activity -> {
                androidx.fragment.app.Fragment active = activity.getSupportFragmentManager().getPrimaryNavigationFragment();
                return active != null && "explore".equals(active.getArguments().getString("destination"))
                        && countPosts(screenView(activity, R.id.community_body)) == 3;
            });
            scenario.onActivity(activity -> {
                assertEquals(androidx.lifecycle.Lifecycle.State.STARTED, home.get().getLifecycle().getCurrentState());
                assertSame(homeView.get(), home.get().getView());
                activity.openCommunity("home", null, false);
            });
            waitFor(scenario, activity -> activity.getSupportFragmentManager().getPrimaryNavigationFragment() == home.get()
                    && home.get().isResumed());
            scenario.onActivity(activity -> {
                assertSame(homeView.get(), home.get().getView());
                assertEquals("Switching tabs must reuse the confirmed feed", 1, postsReads.get());
                activity.openCommunity("explore", null, false);
            });
            waitFor(scenario, activity -> home.get().isHidden());
            edited.set(true);
            com.example.recyclingshareapp.ui.CommunityFragment.clearPagedSnapshots();
            scenario.onActivity(activity -> activity.openCommunity("home", null, false));
            waitFor(scenario, activity -> visibleText(screenView(activity, R.id.community_body)).contains("Nội dung mới từ quản trị"));
            scenario.onActivity(activity -> assertSame("Changes refresh the existing tab root", homeView.get(), home.get().getView()));
            scenario.recreate();
            waitFor(scenario, activity -> {
                androidx.fragment.app.Fragment active = activity.getSupportFragmentManager().getPrimaryNavigationFragment();
                return active != null && "home".equals(active.getArguments().getString("destination"))
                        && active.isResumed();
            });
        }
    }

    @Test public void storyUploadFinishingAfterRotationCannotTouchTheDestroyedView() throws Exception {
        java.util.concurrent.CountDownLatch completing = new java.util.concurrent.CountDownLatch(1);
        java.util.concurrent.CountDownLatch release = new java.util.concurrent.CountDownLatch(1);
        inject(chain -> {
            if (chain.request().url().encodedPath().matches(".*/media/[A-Za-z0-9_-]+/complete")) {
                completing.countDown();
                try { if (!release.await(25, java.util.concurrent.TimeUnit.SECONDS)) throw new IOException("Story fixture timed out"); }
                catch (InterruptedException error) { Thread.currentThread().interrupt(); throw new IOException(error); }
            }
            return chain.proceed(chain.request());
        });
        java.io.File directory = new java.io.File(server.context.getCacheDir(), "community-camera");
        assertTrue(directory.isDirectory() || directory.mkdirs());
        java.io.File photo = new java.io.File(directory, "story-lifecycle-" + java.util.UUID.randomUUID() + ".png");
        android.graphics.Bitmap bitmap = android.graphics.Bitmap.createBitmap(64, 64, android.graphics.Bitmap.Config.ARGB_8888);
        try (java.io.FileOutputStream output = new java.io.FileOutputStream(photo)) {
            bitmap.eraseColor(android.graphics.Color.GREEN);
            assertTrue(bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, output));
        } finally { bitmap.recycle(); }
        android.net.Uri uri = androidx.core.content.FileProvider.getUriForFile(server.context, server.context.getPackageName() + ".files", photo);
        java.lang.reflect.Method create = com.example.recyclingshareapp.ui.CommunityFragment.class.getDeclaredMethod("createStory", android.net.Uri.class);
        create.setAccessible(true);
        Field busy = com.example.recyclingshareapp.ui.CommunityFragment.class.getDeclaredField("busy"); busy.setAccessible(true);
        java.util.concurrent.atomic.AtomicReference<androidx.fragment.app.Fragment> original = new java.util.concurrent.atomic.AtomicReference<>();
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            waitFor(scenario, activity -> screenView(activity, R.id.community_body) != null);
            scenario.onActivity(activity -> {
                original.set(activity.getSupportFragmentManager().getPrimaryNavigationFragment());
                try { create.invoke(original.get(), uri); } catch (Exception error) { throw new AssertionError(error); }
            });
            boolean confirmed = false;
            long deadline = android.os.SystemClock.elapsedRealtime() + 5000;
            while (!confirmed && android.os.SystemClock.elapsedRealtime() < deadline) {
                android.view.accessibility.AccessibilityNodeInfo window = androidx.test.platform.app.InstrumentationRegistry
                        .getInstrumentation().getUiAutomation().getRootInActiveWindow();
                if (window != null) for (android.view.accessibility.AccessibilityNodeInfo node
                        : window.findAccessibilityNodeInfosByText("Đăng story")) {
                    if (node.isClickable() && node.performAction(android.view.accessibility.AccessibilityNodeInfo.ACTION_CLICK)) {
                        confirmed = true;
                        break;
                    }
                }
                if (!confirmed) Thread.sleep(100);
            }
            assertTrue("Story confirmation dialog must be actionable", confirmed);
            assertTrue("The upload must reach completion before the old view is destroyed", completing.await(20, java.util.concurrent.TimeUnit.SECONDS));
            scenario.recreate();
            waitFor(scenario, activity -> activity.getSupportFragmentManager().getPrimaryNavigationFragment() != original.get()
                    && screenView(activity, R.id.community_body) != null);
            assertNull(original.get().getView());
            release.countDown();
            waitFor(scenario, activity -> {
                try { return !busy.getBoolean(original.get()); } catch (IllegalAccessException error) { throw new AssertionError(error); }
            });
            scenario.onActivity(activity -> assertNotNull(screenView(activity, R.id.community_body)));
        } finally { release.countDown(); photo.delete(); }
    }

    @Test public void alreadyLoadedOlderPostUpdatesWithoutLeavingHome() throws Exception {
        AtomicBoolean edited = new AtomicBoolean();
        AtomicInteger refreshes = new AtomicInteger();
        java.util.concurrent.atomic.AtomicReference<String> lastPostUrl = new java.util.concurrent.atomic.AtomicReference<>("");
        inject(chain -> {
            if (chain.request().url().encodedPath().endsWith("/posts")) {
                lastPostUrl.set(chain.request().url().toString());
                String cursor = chain.request().url().queryParameter("cursor");
                String limit = chain.request().url().queryParameter("limit");
                if (cursor == null && limit != null && Integer.parseInt(limit) >= 5) {
                    refreshes.incrementAndGet();
                    return response(chain, refreshedPosts(edited.get()));
                }
                if (cursor == null) return response(chain, posts(1, 3, "page-three"));
                return response(chain, posts(4, 5, null));
            }
            return chain.proceed(chain.request());
        });
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            waitFor(scenario, activity -> countPosts(CommunityTestSupport.screenView(activity, R.id.community_body)) >= 3);
            scenario.onActivity(activity -> {
                if (countPosts(CommunityTestSupport.screenView(activity, R.id.community_body)) < 5)
                    dragUp(CommunityTestSupport.screenView(activity, R.id.community_scroll));
            });
            waitFor(scenario, activity -> countPosts(CommunityTestSupport.screenView(activity, R.id.community_body)) >= 5);
            edited.set(true);
            scenario.onActivity(activity -> {
                try {
                    Object fragment = activity.getSupportFragmentManager().getPrimaryNavigationFragment();
                    Class<?> type = fragment.getClass();
                    Field foreground = type.getDeclaredField("foreground"); foreground.setAccessible(true);
                    assertTrue("Home must be foreground for live refresh", foreground.getBoolean(fragment));
                    Field active = type.getDeclaredField("activePage"); active.setAccessible(true);
                    Object page = active.get(fragment);
                    assertNotNull("Posts must be the active page", page);
                    Field loaded = page.getClass().getDeclaredField("loaded"); loaded.setAccessible(true);
                    Field loading = page.getClass().getDeclaredField("loading"); loading.setAccessible(true);
                    assertTrue("Posts must be loaded", loaded.getBoolean(page));
                    assertFalse("Pagination must have finished", loading.getBoolean(page));
                    for (String name : new String[]{"fetchedAt", "lastRefreshAttemptAt"}) {
                        Field time = page.getClass().getDeclaredField(name); time.setAccessible(true);
                        time.setLong(page, android.os.SystemClock.elapsedRealtime() - 20_000L);
                    }
                    Field tick = type.getDeclaredField("liveRefresh"); tick.setAccessible(true);
                    ((Runnable) tick.get(fragment)).run();
                } catch (ReflectiveOperationException error) { throw new AssertionError(error); }
            });
            try {
                waitFor(scenario, activity -> visibleText(CommunityTestSupport.screenView(activity, R.id.community_body))
                        .contains("Nội dung mới từ quản trị"));
            } catch (AssertionError error) {
                java.util.concurrent.atomic.AtomicReference<String> shown = new java.util.concurrent.atomic.AtomicReference<>();
                scenario.onActivity(activity -> shown.set(visibleText(CommunityTestSupport.screenView(activity, R.id.community_body))));
                throw new AssertionError("Refresh attempts=" + refreshes.get() + "; last posts URL=" + lastPostUrl.get()
                        + "; visible=" + shown.get(), error);
            }
            scenario.onActivity(activity -> {
                assertTrue("Home must refresh all five loaded rows", refreshes.get() > 0);
                assertEquals(5, countPosts(CommunityTestSupport.screenView(activity, R.id.community_body)));
            });
        }
    }

    private void inject(Interceptor interceptor) throws IllegalAccessException {
        httpField.set(server.api,originalHttp.newBuilder().addInterceptor(interceptor).build());
    }
    private static Response response(Interceptor.Chain chain,String json){
        return new Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(200).message("OK")
                .body(ResponseBody.create(json,MediaType.get("application/json"))).build();
    }
    private static int countPosts(View root){
        if(root==null)return 0;int count=root.getTag() instanceof String&&((String)root.getTag()).startsWith("post:")?1:0;
        if(root instanceof ViewGroup){ViewGroup group=(ViewGroup)root;for(int i=0;i<group.getChildCount();i++)count+=countPosts(group.getChildAt(i));}
        return count;
    }
    private static void dragUp(ScrollView list){
        long started=android.os.SystemClock.uptimeMillis();float x=list.getWidth()/2f;
        float top=list.getHeight()*0.8f,bottom=list.getHeight()*0.2f;
        motion(list,started,started,MotionEvent.ACTION_DOWN,x,top);
        for(int step=1;step<=12;step++)motion(list,started,started+step*20L,MotionEvent.ACTION_MOVE,x,top+(bottom-top)*step/12f);
        motion(list,started,started+260L,MotionEvent.ACTION_UP,x,bottom);
    }
    private static void motion(ScrollView list,long started,long now,int action,float x,float y){
        MotionEvent event=MotionEvent.obtain(started,now,action,x,y,0);
        try{list.dispatchTouchEvent(event);}finally{event.recycle();}
    }
    private static String posts(int from,int to,String cursor)throws IOException{return content("POST","p",from,to,cursor);}
    private static String refreshedPosts(boolean edited)throws IOException{
        try {
            JSONObject result=new JSONObject(posts(1,5,null));
            if(edited)result.getJSONArray("items").getJSONObject(4).put("body","Nội dung mới từ quản trị");
            return result.toString();
        }catch(JSONException error){throw new IOException(error);}
    }
    private static String tips(int from,int to,String cursor)throws IOException{return content("TIP","t",from,to,cursor);}
    private static String content(String kind,String prefix,int from,int to,String cursor)throws IOException{
        try{
            JSONArray entries=new JSONArray();String longBody="Chia sẻ cách tái sử dụng vật liệu sạch trong gia đình. ".repeat(10);
            for(int i=from;i<=to;i++)entries.put(new JSONObject().put("id",prefix+i).put("kind",kind).put("body",longBody)
                    .put("created_at","2026-10-19T00:00:00.000Z").put("author",new JSONObject().put("display_name","Tác giả "+i)).put("media",new JSONArray()));
            return new JSONObject().put("items",entries).put("next_cursor",cursor==null?JSONObject.NULL:cursor).toString();
        }catch(JSONException invalid){throw new IOException(invalid);}
    }
    private static String listings(int from,int to)throws IOException{
        try{
            JSONArray entries=new JSONArray();for(int i=from;i<=to;i++)entries.put(new JSONObject().put("id","l"+i).put("title","Tin bán mẫu "+i).put("description","Sản phẩm đã qua sử dụng còn tốt.").put("city","Hà Nội"));
            return new JSONObject().put("items",entries).put("next_cursor",JSONObject.NULL).toString();
        }catch(JSONException invalid){throw new IOException(invalid);}
    }
}
