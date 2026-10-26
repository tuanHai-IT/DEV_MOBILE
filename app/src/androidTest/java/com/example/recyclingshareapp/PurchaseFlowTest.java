package com.example.recyclingshareapp;

import android.view.accessibility.AccessibilityNodeInfo;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.example.recyclingshareapp.data.remote.BackendSession;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import static com.example.recyclingshareapp.CommunityTestSupport.*;
import static org.junit.Assert.*;

/** Checkout uses a real approved listing and backend stock reservations, never local demo flags. */
@RunWith(AndroidJUnit4.class)
public class PurchaseFlowTest {
    private CommunityTestSupport server;
    private String orderId;
    @Before public void connect()throws Exception{server=new CommunityTestSupport();server.login("buyer@ecoshare.test");}
    @After public void restoreStock()throws Exception{if(server==null)return;try{if(orderId!=null)server.request("POST","/orders/"+orderId+"/cancel",new JSONObject().put("reason","Cleanup Android emulator checkout test"),null);}finally{BackendSession.signOut();}}
    @Test public void productDetailUsesStoredPriceAndDemoPaymentDoesNotSettleOrder()throws Exception{
        JSONObject listing=server.request("GET","/listings/demo-lamp",null,null);JSONObject item=listing.getJSONArray("items").getJSONObject(0);int stock=item.getInt("stock");
        JSONObject address=server.request("GET","/me/addresses",null,null).getJSONArray("items").getJSONObject(0);
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            scenario.onActivity(a->a.openCommunity("market_detail","demo-lamp",false));waitFor(scenario,a->visibleText(CommunityTestSupport.screenView(a, R.id.community_body)).contains(listing.optString("title"))&&exactText(CommunityTestSupport.screenView(a, R.id.community_body),"Mua hàng")!=null);
            scenario.onActivity(a->{assertTrue(visibleText(CommunityTestSupport.screenView(a, R.id.community_body)).contains("120.000"));});
            scenario.onActivity(a->exactText(CommunityTestSupport.screenView(a, R.id.community_body),"Mua hàng").performClick());
            String label=address.getString("recipient")+" · "+address.getString("line");long deadline=android.os.SystemClock.elapsedRealtime()+30000;boolean selected=false;
            while(android.os.SystemClock.elapsedRealtime()<deadline&&!selected){AccessibilityNodeInfo window=InstrumentationRegistry.getInstrumentation().getUiAutomation().getRootInActiveWindow();if(window!=null)for(AccessibilityNodeInfo node:window.findAccessibilityNodeInfosByText(label)){AccessibilityNodeInfo click=node;while(click!=null&&!click.isClickable())click=click.getParent();if(click!=null&&click.performAction(AccessibilityNodeInfo.ACTION_CLICK)){selected=true;break;}}if(!selected)Thread.sleep(100);}
            assertTrue("Native checkout did not offer the saved Firebase address",selected);
            waitFor(scenario,a->{androidx.fragment.app.Fragment fragment=a.getSupportFragmentManager().getPrimaryNavigationFragment();return fragment!=null&&fragment.getArguments()!=null&&"order_detail".equals(fragment.getArguments().getString("destination"));});
            scenario.onActivity(a->orderId=a.getSupportFragmentManager().getPrimaryNavigationFragment().requireArguments().getString("entity_id"));
            JSONObject order=server.request("GET","/orders/"+orderId,null,null);assertEquals("PENDING_PAYMENT",order.getString("status"));assertEquals(item.getLong("price_vnd"),order.getLong("total_vnd"));assertEquals(item.getString("id"),order.getJSONArray("items").getJSONObject(0).getString("listing_item_id"));
            JSONObject changed=server.request("GET","/listings/demo-lamp",null,null).getJSONArray("items").getJSONObject(0);assertEquals("Native checkout reserves actual stock",stock-1,changed.getInt("stock"));
            scenario.onActivity(a->exactText(CommunityTestSupport.screenView(a, R.id.community_body),"Thanh toán thử · Demo").performClick());
            waitFor(scenario,a->exactText(CommunityTestSupport.screenView(a, R.id.community_body),"Xác nhận thanh toán thử")!=null);
            screenshot(scenario,"payment_demo_selection");
            scenario.onActivity(a->{
                android.view.View choice=exactText(CommunityTestSupport.screenView(a, R.id.community_body),"VNPay");
                while(choice!=null&&!choice.isClickable())choice=(android.view.View)choice.getParent();
                assertNotNull("VNPay option is clickable",choice);
                choice.performClick();
            });
            scenario.onActivity(a->exactText(CommunityTestSupport.screenView(a, R.id.community_body),"Xác nhận thanh toán thử").performClick());
            waitFor(scenario,a->exactText(CommunityTestSupport.screenView(a, R.id.community_body),"Thanh toán thử thành công")!=null);
            screenshot(scenario,"payment_demo_result");
            scenario.onActivity(a->assertTrue(visibleText(CommunityTestSupport.screenView(a, R.id.community_body)).contains("Mô phỏng qua VNPay")));
            assertEquals("PENDING_PAYMENT",server.request("GET","/orders/"+orderId,null,null).getString("status"));
            assertEquals("Demo must not create a charge",0,server.request("GET","/orders/"+orderId+"/payments",null,null).getJSONArray("data").length());
        }
    }
}
