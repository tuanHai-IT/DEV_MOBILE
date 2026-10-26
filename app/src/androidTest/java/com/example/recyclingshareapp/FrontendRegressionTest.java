package com.example.recyclingshareapp;

import android.graphics.Color;
import android.view.View;
import android.widget.EditText;
import android.widget.TextView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import com.example.recyclingshareapp.data.remote.BackendSession;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.ArrayList;
import java.util.UUID;
import static com.example.recyclingshareapp.CommunityTestSupport.*;
import static org.junit.Assert.*;

/** Real Auth/Firestore-backed native behavior with uniquely scoped emulator fixtures. */
@RunWith(AndroidJUnit4.class)
public class FrontendRegressionTest {
    private CommunityTestSupport server;
    private final ArrayList<String> cleanup=new ArrayList<>();
    private final String prefix="QA-ANDROID-"+UUID.randomUUID()+" ";
    @Before public void connect()throws Exception{server=new CommunityTestSupport();server.login("buyer@ecoshare.test");}
    @After public void cleanup()throws Exception{if(server==null)return;try{for(String path:cleanup)server.request("DELETE",path,null,null);}finally{BackendSession.signOut();}}
    private JSONObject create(String path,String text)throws Exception{JSONObject post=server.request("POST",path,new JSONObject().put("body",text),UUID.randomUUID().toString());cleanup.add(path+"/"+post.getString("id"));return post;}

    @Test public void homeShowsPublishedSharesAndExploreShowsTips()throws Exception{
        JSONObject share=create("/posts",prefix+"Câu chuyện từ Database");JSONObject tip=create("/tips",prefix+"Mẹo hay từ Database");
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            scenario.onActivity(a->a.openCommunity("home",null,false));waitFor(scenario,a->visibleText(CommunityTestSupport.screenView(a, R.id.community_body)).contains(share.optString("body")));
            scenario.onActivity(a->{String text=visibleText(CommunityTestSupport.screenView(a, R.id.community_body));assertFalse(text.contains(tip.optString("body")));assertNotNull("Posts can now be shared in chat",exactText(CommunityTestSupport.screenView(a, R.id.community_body),"Chia sẻ"));});
            scenario.onActivity(a->a.openCommunity("explore",null,false));waitFor(scenario,a->visibleText(CommunityTestSupport.screenView(a, R.id.community_body)).contains(tip.optString("body")));
            if(screenshotsEnabled()){
                server.request("DELETE","/posts/"+share.getString("id"),null,null);cleanup.remove("/posts/"+share.getString("id"));server.request("DELETE","/tips/"+tip.getString("id"),null,null);cleanup.remove("/tips/"+tip.getString("id"));
                captureCommunityScreens(scenario);
            }
        }
    }
    @Test public void reactionsAndInlineCommentPersistAfterRotation()throws Exception{
        JSONObject post=create("/posts",prefix+"Bài đầy đủ để bình luận");String id=post.getString("id"),comment=prefix+"Bình luận được lưu thật";
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            scenario.onActivity(a->a.openCommunity("post_detail",id,true));waitFor(scenario,a->CommunityTestSupport.screenView(a, R.id.community_comment)!=null&&CommunityTestSupport.screenView(a, R.id.community_body).findViewWithTag("like:"+id)!=null&&CommunityTestSupport.screenView(a, R.id.community_body).findViewWithTag("save:"+id)!=null);
            scenario.onActivity(a->CommunityTestSupport.screenView(a, R.id.community_body).findViewWithTag("like:"+id).performClick());waitFor(scenario,a->((TextView)CommunityTestSupport.screenView(a, R.id.community_body).findViewWithTag("like:"+id)).getCurrentTextColor()==Color.rgb(235,59,102));
            scenario.onActivity(a->CommunityTestSupport.screenView(a, R.id.community_body).findViewWithTag("save:"+id).performClick());waitFor(scenario,a->((TextView)CommunityTestSupport.screenView(a, R.id.community_body).findViewWithTag("save:"+id)).getCurrentTextColor()==Color.rgb(212,150,0));
            scenario.onActivity(a->{((EditText)CommunityTestSupport.screenView(a, R.id.community_comment)).setText(comment);CommunityTestSupport.screenView(a, R.id.community_submit).performClick();});waitFor(scenario,a->visibleText(CommunityTestSupport.screenView(a, R.id.community_body)).contains(comment));
            JSONObject persisted=server.request("GET","/posts/"+id,null,null);assertTrue(persisted.getBoolean("liked"));assertTrue(persisted.getBoolean("saved"));assertEquals(1,persisted.getInt("comment_count"));
            JSONArray comments=server.request("GET","/posts/"+id+"/comments",null,null).getJSONArray("items");assertEquals(comment,comments.getJSONObject(0).getString("body"));
            scenario.recreate();waitFor(scenario,a->CommunityTestSupport.screenView(a, R.id.community_body).findViewWithTag("save:"+id)!=null);scenario.onActivity(a->{assertEquals(Color.rgb(235,59,102),((TextView)CommunityTestSupport.screenView(a, R.id.community_body).findViewWithTag("like:"+id)).getCurrentTextColor());assertEquals(Color.rgb(212,150,0),((TextView)CommunityTestSupport.screenView(a, R.id.community_body).findViewWithTag("save:"+id)).getCurrentTextColor());});
        }
    }
    @Test public void nativeComposerKeepsDraftAndPublishesIntoDatabase()throws Exception{
        String text=prefix+"Nội dung soạn trực tiếp trên Android";
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            scenario.onActivity(a->a.openCommunity("create_post","POST",false));waitFor(scenario,a->CommunityTestSupport.screenView(a, R.id.community_draft)!=null);
            scenario.onActivity(a->((EditText)CommunityTestSupport.screenView(a, R.id.community_draft)).setText(text));scenario.recreate();waitFor(scenario,a->CommunityTestSupport.screenView(a, R.id.community_draft)!=null);
            scenario.onActivity(a->{assertEquals(text,((EditText)CommunityTestSupport.screenView(a, R.id.community_draft)).getText().toString());CommunityTestSupport.screenView(a, R.id.community_action).performClick();});waitFor(scenario,a->CommunityTestSupport.screenView(a, R.id.community_comment)!=null&&visibleText(CommunityTestSupport.screenView(a, R.id.community_body)).contains(text));
            JSONArray posts=server.request("GET","/posts?author_id=demo-buyer",null,null).getJSONArray("items");boolean found=false;for(int i=0;i<posts.length();i++){JSONObject post=posts.getJSONObject(i);if(text.equals(post.optString("body"))){cleanup.add("/posts/"+post.getString("id"));found=true;}}assertTrue("Composer content was not stored in Firestore",found);
        }
    }
    @Test public void scanPhotoIsStoredAndReadBackFromFirebase()throws Exception{
        JSONObject scan=server.request("POST","/scans",new JSONObject().put("title",prefix+"Ảnh SCAN"),UUID.randomUUID().toString());String id=scan.getString("id");cleanup.add("/scans/"+id);
        byte[] png=android.util.Base64.decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+kTaYAAAAASUVORK5CYII=",android.util.Base64.DEFAULT);
        JSONObject media=server.await(cb->server.api.uploadMedia("SCAN",id,"image/png",png,cb));byte[] stored=server.await(cb->server.api.downloadMedia(media.optString("id"),cb));assertArrayEquals(png,stored);
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){scenario.onActivity(a->a.openCommunity("scanner",null,false));waitFor(scenario,a->visibleText(CommunityTestSupport.screenView(a, R.id.community_body)).contains(scan.optString("title")));scenario.onActivity(a->assertEquals("SCAN",((TextView)CommunityTestSupport.screenView(a, R.id.community_title)).getText().toString()));}
    }
    private void captureCommunityScreens(ActivityScenario<MainActivity> scenario)throws Exception{
        scenario.onActivity(a->a.openCommunity("home",null,false));waitFor(scenario,a->CommunityTestSupport.screenView(a, R.id.community_body).findViewWithTag("post:demo-post-planters")!=null);waitFor(scenario,a->imageReady(CommunityTestSupport.screenView(a, R.id.community_body)));screenshot(scenario,"01-home");
        scenario.onActivity(a->a.openCommunity("create_menu",null,false));waitFor(scenario,a->exactText(CommunityTestSupport.screenView(a, R.id.community_body),"Bài chia sẻ")!=null);screenshot(scenario,"02-create-menu");
        scenario.onActivity(a->a.openCommunity("create_post","POST",false));waitFor(scenario,a->CommunityTestSupport.screenView(a, R.id.community_draft)!=null);scenario.onActivity(a->((EditText)CommunityTestSupport.screenView(a, R.id.community_draft)).setText("Một góc vườn nhỏ từ những chiếc chai đã qua sử dụng. Mình rất vui khi có thể mang đến cho chúng một cuộc sống mới! 💚"));screenshot(scenario,"03-composer");
        scenario.onActivity(a->a.openCommunity("post_detail","demo-post-corks",false));waitFor(scenario,a->CommunityTestSupport.screenView(a, R.id.community_body).findViewWithTag("like:demo-post-corks")!=null&&CommunityTestSupport.screenView(a, R.id.community_comment)!=null);waitFor(scenario,a->imageReady(CommunityTestSupport.screenView(a, R.id.community_body)));screenshot(scenario,"04-post-detail");
        scenario.onActivity(a->((android.widget.ScrollView)CommunityTestSupport.screenView(a, R.id.community_scroll)).fullScroll(View.FOCUS_DOWN));screenshot(scenario,"04b-post-comments");
        scenario.onActivity(a->a.openCommunity("friends",null,false));waitFor(scenario,a->CommunityTestSupport.screenView(a, R.id.community_body).findViewWithTag("loading")==null&&exactText(CommunityTestSupport.screenView(a, R.id.community_header),"Bạn bè & Mạng lưới")!=null);screenshot(scenario,"05-friends");
        scenario.onActivity(a->a.openCommunity("notifications",null,false));waitFor(scenario,a->CommunityTestSupport.screenView(a, R.id.community_body).findViewWithTag("loading")==null&&((TextView)CommunityTestSupport.screenView(a, R.id.community_title)).getText().toString().startsWith("Thông báo"));screenshot(scenario,"06-notifications");
        scenario.onActivity(a->a.openCommunity("scanner",null,false));waitFor(scenario,a->CommunityTestSupport.screenView(a, R.id.community_camera)!=null&&CommunityTestSupport.screenView(a, R.id.community_body).findViewWithTag("loading")==null);screenshot(scenario,"07-scan");
    }
    private boolean imageReady(View view){if(view instanceof android.widget.ImageView&&((android.widget.ImageView)view).getDrawable()!=null)return true;if(view instanceof android.view.ViewGroup){android.view.ViewGroup group=(android.view.ViewGroup)view;for(int i=0;i<group.getChildCount();i++)if(imageReady(group.getChildAt(i)))return true;}return false;}
}
