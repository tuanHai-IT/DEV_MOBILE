package com.example.recyclingshareapp;

import android.widget.Button;
import android.widget.EditText;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import com.example.recyclingshareapp.data.remote.BackendSession;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.UUID;

import static com.example.recyclingshareapp.CommunityTestSupport.visibleText;
import static com.example.recyclingshareapp.CommunityTestSupport.exactText;
import static com.example.recyclingshareapp.CommunityTestSupport.waitFor;
import static org.junit.Assert.*;

/** The main Messages tab must display and send Firestore-backed conversations. */
@RunWith(AndroidJUnit4.class)
public class ConversationUiTest {
    private CommunityTestSupport server;

    @After public void signOut() { if (server != null) BackendSession.signOut(); }

    @Test public void messagesTabReadsAndSendsRealConversation() throws Exception {
        server = new CommunityTestSupport();
        server.login("buyer@ecoshare.test");
        JSONObject relationship = server.request("GET", "/friends/relationship/demo-seller", null, null);
        if (!relationship.optBoolean("is_friend")) {
            String requestId = relationship.optString("request_id", "");
            if ("PENDING".equals(relationship.optString("status")) && !relationship.optBoolean("is_sender")) {
                server.request("POST", "/friends/requests/" + requestId + "/respond",
                        new JSONObject().put("accept", true), null);
            } else {
                if (requestId.isEmpty()) requestId = server.request("POST", "/friends/requests",
                        new JSONObject().put("user_id", "demo-seller"), null).getString("id");
                server.login("seller@ecoshare.test");
                server.request("POST", "/friends/requests/" + requestId + "/respond",
                        new JSONObject().put("accept", true), null);
                server.login("buyer@ecoshare.test");
            }
        }
        JSONObject conversation = server.request("POST", "/conversations",
                new JSONObject().put("member_id", "demo-seller"), null);
        String conversationId = conversation.getString("id");
        String first = "Tin nhắn QA " + UUID.randomUUID();
        server.request("POST", "/conversations/" + conversationId + "/messages",
                new JSONObject().put("body", first), UUID.randomUUID().toString());

        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> activity.openCommunity("messages", null, false));
            waitFor(scenario, activity -> visibleText(CommunityTestSupport.screenView(activity, R.id.community_body)).contains(first));
            scenario.onActivity(activity -> {
                android.view.View row = exactText(CommunityTestSupport.screenView(activity, R.id.community_conversations), first);
                while (row != null && !"message_row".equals(row.getTag())) row = (android.view.View) row.getParent();
                assertNotNull("Conversation row must be visible", row);
                assertTrue(row.performClick());
            });
            waitFor(scenario, activity -> CommunityTestSupport.screenView(activity, R.id.community_chat_input) != null
                    && visibleText(CommunityTestSupport.screenView(activity, R.id.community_chat_messages)).contains(first));
            String reply = "Trả lời QA " + UUID.randomUUID();
            scenario.onActivity(activity -> {
                EditText input = CommunityTestSupport.screenView(activity, R.id.community_chat_input);
                Button send = CommunityTestSupport.screenView(activity, R.id.community_chat_send);
                input.setText(reply);
                assertTrue("Send must activate once the newest page is ready", send.isEnabled());
                assertTrue(send.performClick());
            });
            waitFor(scenario, activity -> visibleText(CommunityTestSupport.screenView(activity, R.id.community_chat_messages)).contains(reply));
            JSONArray messages = server.request("GET", "/conversations/" + conversationId
                    + "/messages?newest=1&limit=20", null, null).getJSONArray("items");
            boolean persisted = false;
            for (int index = 0; index < messages.length(); index++)
                if (reply.equals(messages.getJSONObject(index).optString("body"))) persisted = true;
            assertTrue("The message must be stored in Firestore through the API", persisted);
        }
    }
}
