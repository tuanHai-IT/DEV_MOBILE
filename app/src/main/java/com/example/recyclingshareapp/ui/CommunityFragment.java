
package com.example.recyclingshareapp.ui;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.LruCache;
import android.text.Editable;
import android.text.InputFilter;
import android.text.InputType;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewConfiguration;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.RadioButton;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.VideoView;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.content.FileProvider;
import androidx.fragment.app.Fragment;

import com.example.recyclingshareapp.MainActivity;
import com.example.recyclingshareapp.R;
import com.example.recyclingshareapp.data.remote.BackendSession;
import com.example.recyclingshareapp.data.remote.FirebaseBackendClient;
import com.google.android.material.snackbar.Snackbar;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.net.URLEncoder;
import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.WeakHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;
import java.util.function.Consumer;

/** Native community screens. Every card comes from the backend, including empty and error states. */
public final class CommunityFragment extends Fragment {
    private static final int PAGE_SIZE = FirebaseBackendClient.FIRST_PAGE_SIZE, MAX_SNAPSHOT_ROUTES = 12, MAX_SNAPSHOT_ITEMS = 60;
    private static final int ROWS_PER_FRAME = 3;
    private static final long PAGE_SNAPSHOT_TTL_MS = 45_000L;
    private static final long LIVE_REFRESH_INTERVAL_MS = 15_000L;
    private static final long LIVE_REFRESH_TICK_MS = 5_000L;
    private static final WeakHashMap<FirebaseBackendClient, LinkedHashMap<String, PageSnapshot>> PAGE_SNAPSHOTS = new WeakHashMap<>();
    private static long snapshotRevision;
    private static final int GREEN = Color.rgb(22,107,77), INK = Color.rgb(18,60,56);
    private static final int MUTED = Color.rgb(103,125,129), RED = Color.rgb(235,59,102), GOLD = Color.rgb(212,150,0);
    private static final String[] MATERIALS = {"Nhựa", "Thủy tinh", "Cao su", "Giấy", "Điện tử", "Vải", "Kim loại", "Hỗn hợp"};
    private LinearLayout body, footer, photoStrip;
    private TextView ecoPointsValue;
    private View ecoPointsBanner;
    private View root;
    private ScrollView scroll;
    private FirebaseBackendClient api;
    private String destination, entityId, contentKind = "POST", exploreTab = "tips", friendTab = "requests", profileTab = "posts", memberProfileTab = "posts", memberProfileUserId = "", replyTargetId = "";
    private boolean focusComments, busy, requestedExploreTab;
    private int viewVersion;
    private long seenSnapshotRevision;
    private String displayedOwnProfile = "";
    private final LruCache<String, Bitmap> decodedImages = new LruCache<String, Bitmap>(8 * 1024) {
        @Override protected int sizeOf(String key, Bitmap value) { return Math.max(1, value.getAllocationByteCount() / 1024); }
    };
    private final Map<String, PageState> pageStates = new LinkedHashMap<>();
    private PageState activePage;
    private boolean userScrolled;
    private boolean foreground, detailRefreshInFlight;
    private JSONObject displayedDetail;
    private long lastDetailRefreshAt;
    private float touchStartY;
    private EditText draft, draftTitle, weight, tags, city, price, stock;
    private EditText chatInput;
    private LinearLayout chatMessages;
    private EditText reportDetails;
    private Button reportSubmit;
    private String selectedReportReason = "";
    private String chatDraft = "", pendingChatBody = "", pendingChatKey = "";
    private Runnable friendSearchTask;
    private String chatPhotoConversationId = "", retryChatPhotoMessageId = "";
    private String chatPartnerName = "Thành viên EcoShare";
    private final ArrayList<TextView> chatIncomingAvatars = new ArrayList<>();
    private boolean chatReady;
    private FrameLayout storyViewer;
    private VideoView storyVideo;
    private ProgressBar storyProgress;
    private Runnable storyTicker;
    private OnBackPressedCallback storyBackCallback;
    private int storyScrollVisibility = View.VISIBLE, storyFooterVisibility = View.GONE;
    private long storyStartedAt;
    private TextView publish;
    private final Set<String> materials = new LinkedHashSet<>();
    private final ArrayList<Uri> pictures = new ArrayList<>();
    private Uri cameraUri;
    private String savedBody = "", savedTitle = "", savedWeight = "", savedTags = "";
    private String savedCity = "", savedPrice = "", savedStock = "1", createdEntityId = "";
    private int uploadedPhotoCount;
    private String createKey = UUID.randomUUID().toString();
    private String checkoutKey = "", checkoutItem = "", checkoutAddress = "", verificationId = "";
    private int orderDetailSerial;
    private final ExecutorService images = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Runnable liveRefresh = new Runnable() {
        @Override public void run() {
            if (!foreground || body == null || !isAdded()) return;
            if ("home".equals(destination) || "profile".equals(destination))
                BackendSession.refreshProfile(requireContext());
            PageState page = activePage;
            if (page != null && page.loaded && !page.loading
                    && SystemClock.elapsedRealtime() - Math.max(page.fetchedAt,page.lastRefreshAttemptAt) >= LIVE_REFRESH_INTERVAL_MS)
                fetchPage(page, true);
            if ("post_detail".equals(destination) || "tip_detail".equals(destination)) refreshDetail();
            main.postDelayed(this, LIVE_REFRESH_TICK_MS);
        }
    };
    private final BackendSession.ProfileListener sessionProfileListener = profile -> {
        if (body == null) return;
        if ("home".equals(destination)) updateEcoPoints();
        else if ("profile".equals(destination) && profile != null) profile();
    };

    private static final class PageSnapshot {
        final ArrayList<String> rows;
        final String cursor;
        final int scrollY;
        final int firstPageCount;
        final int unreadCount;
        final long fetchedAt;
        PageSnapshot(ArrayList<String> rows, String cursor, int scrollY, int firstPageCount, int unreadCount, long fetchedAt) {
            this.rows = rows; this.cursor = cursor; this.scrollY = scrollY; this.firstPageCount = firstPageCount; this.unreadCount=unreadCount; this.fetchedAt = fetchedAt;
        }
    }

    private static final class PageState {
        final String path;
        final ArrayList<JSONObject> rows = new ArrayList<>();
        String cursor = "", emptyMessage;
        boolean loaded, loading, errorWasRefresh, renderScheduled, restoreScrollPending;
        int scrollY, renderedCount, renderSerial, requestSerial, unreadCount, firstPageCount;
        long fetchedAt, lastRefreshAttemptAt;
        FirebaseBackendClient.BackendException error;
        LinearLayout target;
        Consumer<JSONObject> render;
        View footer;
        PageState(String path) { this.path = path; }
    }

    /** Clears data from a previous login, including a repeat login by the same account. */
    public static void clearPagedSnapshots() { synchronized (PAGE_SNAPSHOTS) { PAGE_SNAPSHOTS.clear(); snapshotRevision++; } }

    /** Long feeds are reconstructed from snapshots instead of holding many offscreen image views. */
    public boolean canRetainTabView() { return activePage == null || activePage.rows.size() <= 18; }

    /** Apply a destination tab to either a new or a retained Explore fragment. */
    public void selectExploreTab(String tab) {
        if (!"tips".equals(tab) && !"challenges".equals(tab) && !"market".equals(tab)) return;
        if (tab.equals(exploreTab)) return;
        exploreTab = tab;
        requestedExploreTab = body != null;
    }

    private final ActivityResultLauncher<String> photoPicker = registerForActivityResult(new ActivityResultContracts.GetMultipleContents(), uris -> {
        if (body == null) return;
        for (Uri uri : uris) if (!pictures.contains(uri) && pictures.size() < 5) pictures.add(uri);
        if (uris.size() > 5) message("Mỗi bài đăng tối đa 5 ảnh.");
        renderPickedPhotos();
    });
    private final ActivityResultLauncher<String> scanPicker = registerForActivityResult(new ActivityResultContracts.GetContent(), uri -> {
        if (uri != null && body != null) saveScan(uri);
    });
    private final ActivityResultLauncher<String> storyPicker = registerForActivityResult(new ActivityResultContracts.GetContent(), uri -> {
        if (uri != null && body != null && !busy) createStory(uri);
    });
    private final ActivityResultLauncher<String> chatPhotoPicker = registerForActivityResult(new ActivityResultContracts.GetContent(), uri -> {
        String conversationId = chatPhotoConversationId;
        String retryId = retryChatPhotoMessageId;
        chatPhotoConversationId = retryChatPhotoMessageId = "";
        if (uri != null && body != null && "chat".equals(destination) && conversationId.equals(entityId) && !busy)
            sendChatPhoto(uri, retryId);
    });
    private final ActivityResultLauncher<String> verificationPicker = registerForActivityResult(new ActivityResultContracts.GetContent(), uri -> {
        if(uri==null||body==null||busy)return;busy=true;
        if(verificationId.isEmpty())send("POST","/me/verifications",json(),null,record->{verificationId=record.optString("id");upload("VERIFICATION",verificationId,uri,()->{busy=false;message("Đã gửi giấy tờ. Quản trị viên sẽ xét duyệt hồ sơ.");verification();});});
        else upload("VERIFICATION",verificationId,uri,()->{busy=false;message("Đã lưu giấy tờ xác minh riêng tư.");verification();});
    });
    private final ActivityResultLauncher<String> profileAvatarPicker = registerForActivityResult(new ActivityResultContracts.GetContent(), uri -> {
        if (uri != null && body != null && !busy) uploadProfileImage("avatar_key", uri);
    });
    private final ActivityResultLauncher<String> profileCoverPicker = registerForActivityResult(new ActivityResultContracts.GetContent(), uri -> {
        if (uri != null && body != null && !busy) uploadProfileImage("cover_key", uri);
    });
    private final ActivityResultLauncher<Uri> camera = registerForActivityResult(new ActivityResultContracts.TakePicture(), success -> {
        if (success && cameraUri != null && body != null) saveScan(cameraUri);
    });

    public static CommunityFragment create(String destination, String entityId, boolean focusComments) {
        CommunityFragment fragment = new CommunityFragment();
        Bundle args = new Bundle(); args.putString("destination", destination); args.putString("entity_id", entityId); args.putBoolean("focus_comments", focusComments);
        fragment.setArguments(args); return fragment;
    }
    @Override public void onCreate(@Nullable Bundle state) {
        super.onCreate(state);
        destination = requireArguments().getString("destination", "home"); entityId = requireArguments().getString("entity_id", "");
        focusComments = requireArguments().getBoolean("focus_comments");
        contentKind = "tip_detail".equals(destination) || "TIP".equals(entityId) ? "TIP" : "POST";
        if (state != null) {
            savedBody = state.getString("draft", ""); savedTitle = state.getString("title", ""); savedWeight = state.getString("weight", ""); savedTags = state.getString("tags", "");
            savedCity = state.getString("city", ""); savedPrice = state.getString("price", ""); savedStock = state.getString("stock", "1"); createdEntityId = state.getString("created_id", ""); uploadedPhotoCount = state.getInt("uploaded_photos");
            checkoutKey=state.getString("checkout_key","");checkoutItem=state.getString("checkout_item","");checkoutAddress=state.getString("checkout_address","");verificationId=state.getString("verification_id","");
            chatDraft=state.getString("chat_draft","");pendingChatBody=state.getString("pending_chat_body","");pendingChatKey=state.getString("pending_chat_key","");
            chatPhotoConversationId=state.getString("chat_photo_conversation", "");retryChatPhotoMessageId=state.getString("chat_photo_retry", "");
            createKey = state.getString("create_key", createKey); exploreTab = state.getString("explore_tab", "tips"); friendTab = state.getString("friend_tab", "requests"); profileTab = state.getString("profile_tab", "posts");
            ArrayList<String> selected = state.getStringArrayList("materials"); if (selected != null) materials.addAll(selected);
            ArrayList<String> photos = state.getStringArrayList("pictures"); if (photos != null) for (String uri : photos) pictures.add(Uri.parse(uri));
            String cameraPath = state.getString("camera_uri"); if (cameraPath != null) cameraUri = Uri.parse(cameraPath);
        }
    }
    @Override public void onSaveInstanceState(@NonNull Bundle state) {
        state.putString("draft", draft == null ? savedBody : draft.getText().toString()); state.putString("title", draftTitle == null ? savedTitle : draftTitle.getText().toString());
        state.putString("weight", weight == null ? savedWeight : weight.getText().toString()); state.putString("tags", tags == null ? savedTags : tags.getText().toString());
        state.putString("city", city == null ? savedCity : city.getText().toString());state.putString("price", price == null ? savedPrice : price.getText().toString());state.putString("stock", stock == null ? savedStock : stock.getText().toString());state.putString("created_id",createdEntityId);state.putInt("uploaded_photos",uploadedPhotoCount);
        state.putString("checkout_key",checkoutKey);state.putString("checkout_item",checkoutItem);state.putString("checkout_address",checkoutAddress);state.putString("verification_id",verificationId);
        state.putString("chat_draft",chatInput==null?chatDraft:chatInput.getText().toString());state.putString("pending_chat_body",pendingChatBody);state.putString("pending_chat_key",pendingChatKey);
        state.putString("chat_photo_conversation",chatPhotoConversationId);state.putString("chat_photo_retry",retryChatPhotoMessageId);
        state.putString("create_key", createKey); state.putString("explore_tab", exploreTab); state.putString("friend_tab", friendTab); state.putString("profile_tab", profileTab);
        state.putStringArrayList("materials", new ArrayList<>(materials)); ArrayList<String> photoUris = new ArrayList<>(); for (Uri uri : pictures) photoUris.add(uri.toString()); state.putStringArrayList("pictures", photoUris);
        if (cameraUri != null) state.putString("camera_uri", cameraUri.toString()); super.onSaveInstanceState(state);
    }
    @Nullable @Override public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle state) {
        int layout;
        switch (destination) {
            case "explore": layout = R.layout.fragment_explore; break;
            case "create_menu": layout = R.layout.fragment_create_menu; break;
            case "create_post": layout = R.layout.fragment_create_post; break;
            case "post_detail": case "tip_detail": layout = R.layout.fragment_post_detail; break;
            case "report": layout = R.layout.fragment_home; break;
            case "friends": layout = R.layout.fragment_friends; break;
            case "notifications": layout = R.layout.fragment_notifications; break;
            case "messages": layout = R.layout.fragment_messages; break;
            case "message_requests": layout = R.layout.fragment_messages; break;
            case "chat": layout = R.layout.fragment_chat; break;
            case "scanner": layout = R.layout.fragment_scanner; break;
            case "market_detail": layout = R.layout.fragment_market_detail; break;
            case "create_listing": layout = R.layout.fragment_create_listing; break;
            case "profile": case "edit_profile": case "addresses": case "orders": case "order_detail": case "payment_demo": case "payment_demo_result": case "my_listings": case "verification": case "admin_dashboard": case "admin_moderation": case "admin_reports": layout = R.layout.fragment_profile; break;
            default: layout = R.layout.fragment_home;
        }
        return inflater.inflate(layout, container, false);
    }
    @Override public void onViewCreated(@NonNull View view, @Nullable Bundle state) {
        root = view; body = view.findViewById(R.id.community_body); footer = view.findViewById(R.id.community_footer); scroll = view.findViewById(R.id.community_scroll); viewVersion++;
        storyBackCallback = new OnBackPressedCallback(false) {
            @Override public void handleOnBackPressed() { closeStoryViewer(); }
        };
        requireActivity().getOnBackPressedDispatcher().addCallback(getViewLifecycleOwner(), storyBackCallback);
        api = BackendSession.get(requireContext()); view.findViewById(R.id.community_back).setOnClickListener(v -> requireActivity().getOnBackPressedDispatcher().onBackPressed());
        int touchSlop=ViewConfiguration.get(requireContext()).getScaledTouchSlop();
        scroll.setOnTouchListener((v,event)->{
            if(event.getActionMasked()==MotionEvent.ACTION_DOWN)touchStartY=event.getY();
            else if(event.getActionMasked()==MotionEvent.ACTION_MOVE&&Math.abs(event.getY()-touchStartY)>touchSlop)userScrolled=true;
            return false;
        });
        scroll.setOnScrollChangeListener((View.OnScrollChangeListener)(v, x, y, oldX, oldY) -> {
            if (userScrolled&&y > oldY && y > 0) maybeLoadNextPage();
        });
        synchronized (PAGE_SNAPSHOTS) { seenSnapshotRevision = snapshotRevision; }
        renderDestination();
    }
    @Override public void onResume() {
        super.onResume();
        if ("explore".equals(destination) && requestedExploreTab && body != null) {
            requestedExploreTab = false;
            explore();
        } else if ("explore".equals(destination) && root != null) header("Khám phá", false);
        long revision;
        synchronized (PAGE_SNAPSHOTS) { revision = snapshotRevision; }
        if (body != null && seenSnapshotRevision != revision) {
            seenSnapshotRevision = revision;
            // Keep the confirmed rows visible while a changed route refreshes in the background.
            for (PageState page : pageStates.values()) {
                page.requestSerial++; page.loading = false; page.error = null;
                page.fetchedAt = -PAGE_SNAPSHOT_TTL_MS;
            }
            viewVersion++;
            renderDestination();
        } else if (body != null && "profile".equals(destination)
                && !displayedOwnProfile.equals(BackendSession.profile().toString())) profile();
        foreground = true;
        main.removeCallbacks(liveRefresh);
        main.postDelayed(liveRefresh, LIVE_REFRESH_TICK_MS);
        if ("home".equals(destination) || "profile".equals(destination)) {
            BackendSession.addProfileListener(sessionProfileListener);
            if ("home".equals(destination)) updateEcoPoints();
            BackendSession.refreshProfile(requireContext());
        }
    }
    @Override public void onPause() {
        foreground = false;
        closeStoryViewer();
        main.removeCallbacks(liveRefresh);
        BackendSession.removeProfileListener(sessionProfileListener);
        super.onPause();
    }
    private void renderDestination() {
        body.setPadding(dp(16),dp(16),dp(16),dp(24));
        switch (destination) {
            case "home": home(); break;
            case "explore": header("Khám phá", false); explore(); break;
            case "create_menu": createMenu(); break;
            case "create_post": composer(); break;
            case "post_detail": case "tip_detail": detail(); break;
            case "report": reportScreen(); break;
            case "share_post": sharePostScreen(""); break;
            case "friends": friends(""); break;
            case "notifications": notifications(); break;
            case "messages": conversations(); break;
            case "chat": conversationDetail(); break;
            case "scanner": scanner(); break;
            case "market_detail": listingDetail(); break;
            case "create_listing": listingComposer(); break;
            case "profile": profile(); break;
            case "user_profile": userProfile(); break;
            case "message_requests": messageRequests(); break;
            case "edit_profile": editProfile(); break;
            case "addresses": addresses(); break;
            case "orders": orders(); break;
            case "order_detail": orderDetail(); break;
            case "payment_demo": demoPayment(); break;
            case "payment_demo_result": demoPaymentResult(); break;
            case "my_listings": myListings(); break;
            case "verification": verification(); break;
            case "admin_dashboard": case "admin_moderation": case "admin_reports": mobileAdmin(); break;
            default: body.removeAllViews(); showPaged(body,"/posts","Chưa có bài viết. Hãy chia sẻ câu chuyện tái chế đầu tiên của bạn.",post -> postCard(body,post,false));
        }
    }
    @Override public void onDestroyView() { closeStoryViewer(); if(chatInput!=null)chatDraft=chatInput.getText().toString(); chatReady=false; chatIncomingAvatars.clear(); foreground=false; main.removeCallbacks(liveRefresh); if(friendSearchTask!=null)main.removeCallbacks(friendSearchTask); friendSearchTask=null; displayedDetail=null; detailRefreshInFlight=false; lastDetailRefreshAt=0L; viewVersion++; deactivatePage(); for (PageState state : pageStates.values()) { state.requestSerial++; state.loading = false; state.target = null; state.render = null; state.footer = null; } root = null; body = null; footer = null; scroll = null; photoStrip = null; ecoPointsValue = null; ecoPointsBanner = null; draft = draftTitle = weight = tags = city = price = stock = chatInput = null; chatMessages = null; reportDetails = null; reportSubmit = null; selectedReportReason = ""; super.onDestroyView(); }
    @Override public void onDestroy() { images.shutdownNow(); decodedImages.evictAll(); super.onDestroy(); }

    private void header(String title, boolean visible) {
        root.findViewById(R.id.community_header).setVisibility(visible ? View.VISIBLE : View.GONE);
        ((TextView)root.findViewById(R.id.community_title)).setText(title);
    }
    private void go(String screen, String id, boolean focus) { ((MainActivity)requireActivity()).openCommunity(screen, id, focus); }
    private boolean signedIn() { if (BackendSession.isSignedIn()) return true; message("Đăng nhập để dùng tính năng này."); go("login", null, false); return false; }
    private void message(String message) { if (root != null) Snackbar.make(root, message, Snackbar.LENGTH_LONG).show(); }
    private int dp(float value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private LinearLayout column() { LinearLayout v = new LinearLayout(requireContext()); v.setOrientation(LinearLayout.VERTICAL); return v; }
    private LinearLayout row() { LinearLayout v = new LinearLayout(requireContext()); v.setOrientation(LinearLayout.HORIZONTAL); v.setGravity(Gravity.CENTER_VERTICAL); return v; }
    private TextView text(String label, int sp, int color, boolean bold) {
        TextView v = new TextView(requireContext()); v.setText(label); v.setTextSize(sp); v.setTextColor(color); v.setLineSpacing(dp(3),1); if (bold) v.setTypeface(null, Typeface.BOLD); return v;
    }
    private TextView label(String value) { TextView v = text(value, 12, MUTED, true); v.setPadding(0,dp(18),0,dp(8)); body.addView(v); return v; }
    private Button button(String label, Runnable click) {
        Button v = new Button(requireContext()); v.setText(label); v.setTextSize(13); v.setAllCaps(false); v.setTextColor(GREEN); v.setMinHeight(dp(48)); v.setMinimumHeight(dp(48)); v.setBackgroundResource(R.drawable.community_pill);v.setForeground(new android.graphics.drawable.RippleDrawable(android.content.res.ColorStateList.valueOf(0x263BAA76),null,null));v.setStateListAnimator(null);v.setElevation(dp(1));v.setTranslationZ(0);v.setOnTouchListener((view,event)->{if(event.getActionMasked()==MotionEvent.ACTION_DOWN)view.animate().scaleX(.97f).scaleY(.97f).setDuration(80).start();else if(event.getActionMasked()==MotionEvent.ACTION_UP||event.getActionMasked()==MotionEvent.ACTION_CANCEL)view.animate().scaleX(1f).scaleY(1f).setDuration(130).start();return false;}); v.setOnClickListener(w -> click.run()); return v;
    }
    private Button orderActionButton(String title, int icon, boolean destructive, Runnable click) {
        Button v = button(title, click);
        v.setTextSize(14);
        v.setTypeface(null, Typeface.BOLD);
        v.setTextColor(destructive ? Color.rgb(180, 35, 24) : Color.WHITE);
        v.setBackgroundResource(destructive ? R.drawable.bg_order_cancel : R.drawable.bg_order_payment);
        v.setBackgroundTintList(null);
        v.setPadding(dp(18), 0, dp(18), 0);
        v.setCompoundDrawablePadding(dp(10));
        android.graphics.drawable.Drawable leading = androidx.core.content.ContextCompat.getDrawable(requireContext(), icon);
        if (leading != null) {
            leading = androidx.core.graphics.drawable.DrawableCompat.wrap(leading.mutate());
            androidx.core.graphics.drawable.DrawableCompat.setTint(leading, destructive ? Color.rgb(180, 35, 24) : Color.WHITE);
            v.setCompoundDrawablesWithIntrinsicBounds(leading, null, null, null);
        }
        v.setMinHeight(dp(destructive ? 52 : 56));
        v.setMinimumHeight(dp(destructive ? 52 : 56));
        v.setElevation(destructive ? 0 : dp(2));
        v.setStateListAnimator(null);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, dp(destructive ? 52 : 56));
        lp.topMargin = dp(destructive ? 8 : 10);
        body.addView(v, lp);
        return v;
    }
    private EditText input(String hint, int max, int id) {
        EditText v = new EditText(requireContext()); if (id != 0) v.setId(id); v.setHint(hint); v.setTextSize(15); v.setTextColor(INK); v.setHintTextColor(MUTED); v.setPadding(dp(14),dp(12),dp(14),dp(12)); v.setBackgroundResource(R.drawable.community_card); v.setMinHeight(dp(52)); if (max > 0) v.setFilters(new InputFilter[]{new InputFilter.LengthFilter(max)}); return v;
    }
    private EditText addComposerField(EditText field, int minHeight) {
        field.setBackgroundResource(R.drawable.community_card);
        field.setPadding(dp(16),dp(14),dp(16),dp(14));
        field.setMinHeight(dp(minHeight));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1,-2);
        lp.topMargin = dp(3); lp.bottomMargin = dp(8);
        body.addView(field,lp);
        return field;
    }    private LinearLayout card(LinearLayout parent) {
        LinearLayout v = column(); v.setPadding(dp(16),dp(14),dp(16),dp(14)); v.setBackgroundResource(R.drawable.community_card);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1,-2); lp.bottomMargin = dp(14); parent.addView(v,lp); return v;
    }
    private void action(String title, Runnable click) { TextView v = root.findViewById(R.id.community_action); v.setVisibility(View.VISIBLE); v.setText(title);v.setTextColor(GREEN);v.setPadding(dp(8),0,dp(8),0);v.setBackgroundResource(R.drawable.community_pill); v.setOnClickListener(w -> click.run()); }
    private String route() { return "TIP".equals(contentKind) ? "/tips" : "/posts"; }
    private static String enc(String value) { try { return URLEncoder.encode(value == null ? "" : value,"UTF-8"); } catch(java.io.UnsupportedEncodingException impossible) { throw new AssertionError(impossible); } }
    private static JSONObject json(Object... pairs) { JSONObject row = new JSONObject(); try { for(int i = 0; i < pairs.length; i += 2) row.put((String)pairs[i],pairs[i+1]); } catch(JSONException error) { throw new IllegalArgumentException(error); } return row; }
    private void get(String path, Consumer<JSONObject> done) { if (api.isSignedIn()) api.request("GET",path,null,null,callback(done)); else api.getPublic(path,callback(done)); }
    private void getFresh(String path, Consumer<JSONObject> done) { api.requestFresh(path, callback(done)); }
    private void send(String method, String path, JSONObject data, String key, Consumer<JSONObject> done) { api.request(method,path,data,key,callback(result -> { if (!"GET".equals(method)) resetPagedData(); done.accept(result); })); }
    private void resetPagedData() { clearPagedSnapshots(); for(PageState page:pageStates.values())page.requestSerial++; pageStates.clear(); activePage=null; }
    private FirebaseBackendClient.Callback<JSONObject> callback(Consumer<JSONObject> done) {
        int version = viewVersion;
        return new FirebaseBackendClient.Callback<JSONObject>() {
            public void onSuccess(JSONObject data) { if (body != null && version == viewVersion && isAdded()) done.accept(data); }
            public void onError(FirebaseBackendClient.BackendException error) { if (body != null && version == viewVersion && isAdded()) { busy = false; if (publish != null) publish.setEnabled(true); if (!showLoadError(error)) message(error.getMessage()); } }
        };
    }
    private TextView loading(LinearLayout parent) { TextView v = text("Đang tải…",14,MUTED,false); v.setTag("loading"); v.setPadding(0,dp(12),0,dp(12)); parent.addView(v); return v; }
    private boolean showLoadError(FirebaseBackendClient.BackendException error) {
        View item = body.findViewWithTag("loading");
        if (!(item instanceof TextView)) return false;
        TextView notice = (TextView)item;
        notice.setText("Chưa tải được dữ liệu\n\n" + error.getMessage() + "\n\nChạm để thử lại");
        notice.setPadding(dp(18),dp(20),dp(18),dp(20));
        notice.setBackgroundResource(R.drawable.community_card);
        notice.setFocusable(true);
        notice.setOnClickListener(v -> {
            if (body == null || !isAdded()) return;
            viewVersion++;
            renderDestination();
        });
        return true;
    }
    private void empty(LinearLayout parent, String message) { TextView v = text(message,14,MUTED,false); v.setPadding(dp(12),dp(30),dp(12),dp(30)); v.setGravity(Gravity.CENTER); parent.addView(v); }

    private void home() {
        header("Bài chia sẻ", false);
        body.removeAllViews();
        if (api.isSignedIn()) {
            ecoPointsBanner = ecoPointsCard();
            LinearLayout.LayoutParams bannerParams = new LinearLayout.LayoutParams(-1, -2);
            bannerParams.bottomMargin = dp(16);
            body.addView(ecoPointsBanner, bannerParams);
            updateEcoPoints();
        } else {
            guestReadOnlyBanner();
        }
        stories();
        LinearLayout posts = column();
        body.addView(posts);
        showPaged(posts, "/posts", "Chưa có bài viết. Hãy chia sẻ câu chuyện tái chế đầu tiên của bạn.", post -> postCard(posts, post, false));
    }

    private void stories() {
        LinearLayout storyCard = column();
        storyCard.setPadding(dp(10), dp(8), dp(10), dp(8));
        storyCard.setBackgroundResource(R.drawable.community_card);
        storyCard.setClipToOutline(true);
        LinearLayout.LayoutParams cardParams = new LinearLayout.LayoutParams(-1, -2);
        cardParams.bottomMargin = dp(14);
        body.addView(storyCard, cardParams);
        HorizontalScrollView strip = new HorizontalScrollView(requireContext());
        strip.setHorizontalScrollBarEnabled(false);
        LinearLayout cards = row(); cards.setPadding(dp(2), 0, dp(2), dp(4)); strip.addView(cards);
        storyCard.addView(strip, new LinearLayout.LayoutParams(-1, dp(88)));
        LinearLayout add = column(); add.setGravity(Gravity.CENTER); add.setPadding(dp(8), dp(8), dp(8), dp(8));
        FrameLayout addRing = new FrameLayout(requireContext());
        TextView plus = text("＋", 25, GREEN, true); plus.setGravity(Gravity.CENTER); plus.setBackgroundResource(R.drawable.bg_circle_avatar);
        addRing.addView(plus, new FrameLayout.LayoutParams(dp(52), dp(52), Gravity.CENTER));
        add.addView(addRing, new LinearLayout.LayoutParams(dp(58), dp(58)));
        TextView own = text("Tin của bạn", 10, INK, true); own.setGravity(Gravity.CENTER); own.setSingleLine(true); add.addView(own);
        add.setOnClickListener(v -> { if (!signedIn()) return; storyPicker.launch("*/*"); });
        cards.addView(add, new LinearLayout.LayoutParams(dp(76), -1));
        get("/stories?limit=12", response -> {
            JSONArray entries = response.optJSONArray("items"); if (entries == null) return;
            for (int i = 0; i < entries.length(); i++) {
                JSONObject story = entries.optJSONObject(i); if (story == null) continue;
                JSONObject author = story.optJSONObject("author"); String name = author == null ? "Thành viên" : author.optString("display_name", "Thành viên");
                JSONArray media = story.optJSONArray("media"); if (media == null || media.length() == 0) continue;
                String mediaId = media.optJSONObject(0).optString("id", "");
                LinearLayout item = column(); item.setGravity(Gravity.CENTER); item.setPadding(dp(8), dp(8), dp(8), dp(8));
                FrameLayout ring = new FrameLayout(requireContext()); ring.setBackgroundResource(R.drawable.bg_story_ring);
                TextView initials = text(initials(name), 17, GREEN, true); initials.setGravity(Gravity.CENTER); initials.setBackgroundResource(R.drawable.bg_circle_avatar);
                FrameLayout.LayoutParams avatarParams = new FrameLayout.LayoutParams(dp(48), dp(48), Gravity.CENTER); ring.addView(initials, avatarParams);
                item.addView(ring, new LinearLayout.LayoutParams(dp(58), dp(58)));
                TextView caption = text(name, 10, INK, true); caption.setGravity(Gravity.CENTER); caption.setMaxLines(1); caption.setEllipsize(android.text.TextUtils.TruncateAt.END); item.addView(caption);
                item.setOnClickListener(v -> showStory(story, mediaId, media.optJSONObject(0).optString("mime_type")));
                cards.addView(item, new LinearLayout.LayoutParams(dp(76), -1));
            }
        });
    }

    private void createStory(Uri uri) {
        if (uri == null || busy) return;
        EditText caption = input("Thêm nội dung cho story…", 300, 0);
        caption.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        caption.setSingleLine(false);
        caption.setMinLines(3);
        caption.setMaxLines(5);
        caption.setGravity(Gravity.TOP | Gravity.START);
        TextView counter = text("0/300", 11, MUTED, false);
        counter.setGravity(Gravity.END);
        LinearLayout content = column();
        content.setPadding(dp(20), dp(8), dp(20), dp(4));
        content.addView(caption, new LinearLayout.LayoutParams(-1, -2));
        LinearLayout.LayoutParams counterParams = new LinearLayout.LayoutParams(-1, -2);
        counterParams.topMargin = dp(6);
        content.addView(counter, counterParams);
        caption.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) { }
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) { counter.setText(s.length() + "/300"); }
            @Override public void afterTextChanged(Editable s) { }
        });
        androidx.appcompat.app.AlertDialog dialog = new androidx.appcompat.app.AlertDialog.Builder(requireContext())
                .setTitle("Thêm chữ vào story")
                .setView(content)
                .setNegativeButton("Hủy", null)
                .setPositiveButton("Đăng story", null)
                .create();
        dialog.setOnShowListener(ignored -> dialog.getButton(androidx.appcompat.app.AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            String bodyText = caption.getText().toString().trim();
            dialog.dismiss();
            uploadStory(uri, bodyText);
        }));
        dialog.show();
    }

    private void uploadStory(Uri uri, String captionText) {
        Context context = requireContext().getApplicationContext();
        final int version = viewVersion;
        busy = true;
        images.execute(() -> {
            try {
                String mime = context.getContentResolver().getType(uri);
                if (mime == null) throw new IllegalArgumentException("Không xác định được định dạng tệp.");
                int duration = 0;
                if (mime.startsWith("video/")) {
                    if (!"video/mp4".equals(mime)) throw new IllegalArgumentException("Video story hiện hỗ trợ MP4.");
                    MediaMetadataRetriever retriever = new MediaMetadataRetriever();
                    try { retriever.setDataSource(context, uri); duration = Integer.parseInt(retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)); }
                    finally { retriever.release(); }
                    if (duration < 1 || duration > 10_000) throw new IllegalArgumentException("Video story phải dài tối đa 10 giây.");
                } else if (!mime.matches("image/(jpeg|png|webp)")) throw new IllegalArgumentException("Chọn ảnh hoặc video MP4.");
                byte[] original;
                try (InputStream stream = context.getContentResolver().openInputStream(uri)) { original = readImage(stream); }
                byte[] bytes = original; String contentType = mime;
                if (mime.startsWith("image/") && api.isSparkLocal()) { PhotoUploadEncoder.Photo photo = PhotoUploadEncoder.forFirestore(original); bytes = photo.bytes; contentType = photo.mime; }
                if (api.isSparkLocal() && bytes.length > 384 * 1024) throw new IllegalArgumentException("Tệp story cần nhỏ hơn 384 KB trên gói Firebase miễn phí; hãy chọn video nén ngắn hơn hoặc ảnh đã nén.");
                final byte[] ready = bytes; final String readyMime = contentType; final int readyDuration = duration;
                main.post(() -> {
                    if (body == null || version != viewVersion || !isAdded()) { busy = false; return; }
                    api.request("POST", "/stories", json("body", captionText, "duration_ms", readyDuration), UUID.randomUUID().toString(), new FirebaseBackendClient.Callback<JSONObject>() {
                        @Override public void onSuccess(JSONObject story) {
                            api.uploadMedia("CONTENT", story.optString("id"), readyMime, ready, new FirebaseBackendClient.Callback<JSONObject>() {
                                @Override public void onSuccess(JSONObject media) {
                                    busy = false; clearPagedSnapshots();
                                    if (body == null || version != viewVersion || !isAdded() || !foreground) return;
                                    home(); message("Story đã đăng và sẽ tự hết hạn sau 24 giờ.");
                                }
                                @Override public void onError(FirebaseBackendClient.BackendException error) { busy = false; message("Chưa tải được story: " + error.getMessage()); }
                            });
                        }
                        @Override public void onError(FirebaseBackendClient.BackendException error) { busy = false; message(error.getMessage()); }
                    });
                });
            } catch (Exception error) { main.post(() -> { busy = false; if (body != null) message(error.getMessage()); }); }
        });
    }

    private void showStory(JSONObject story, String mediaId, String mime) {
        String id = story.optString("id");
        if (id.isEmpty() || mediaId.isEmpty()) return;
        final int version = viewVersion;
        final Context context = requireContext().getApplicationContext();
        final int edge = getResources().getDisplayMetrics().widthPixels;
        api.downloadMedia(mediaId, new FirebaseBackendClient.Callback<byte[]>() {
            @Override public void onSuccess(byte[] bytes) {
                if (body == null || version != viewVersion || !foreground || images.isShutdown()) return;
                try { images.execute(() -> {
                    try {
                        final boolean videoStory = mime.startsWith("video/");
                        final File file = videoStory ? new File(context.getCacheDir(), "story-" + id + ".mp4") : null;
                        final Bitmap bitmap;
                        if (videoStory) {
                            try (java.io.FileOutputStream output = new java.io.FileOutputStream(file)) { output.write(bytes); }
                            bitmap = null;
                        } else bitmap = decode(bytes, Math.min(1600, edge));
                        main.post(() -> {
                            if (body == null || version != viewVersion || !isAdded() || !foreground) return;
                            closeStoryViewer();
                            openStoryViewer(story, bitmap, file, videoStory);
                        });
                    } catch (Exception error) { main.post(() -> { if (body != null && version == viewVersion) message("Không mở được story."); }); }
                }); } catch (RejectedExecutionException ignored) { /* Screen closed while media arrived. */ }
            }
            @Override public void onError(FirebaseBackendClient.BackendException error) { message(error.getMessage()); }
        });
    }

    private void openStoryViewer(JSONObject story, Bitmap bitmap, File file, boolean videoStory) {
        if (root == null || !(root instanceof ViewGroup) || !isAdded()) return;
        ViewGroup host = (ViewGroup) root;
        View header = root.findViewById(R.id.community_header);
        if (header != null) header.setVisibility(View.GONE);
        storyScrollVisibility = scroll == null ? View.VISIBLE : scroll.getVisibility();
        storyFooterVisibility = footer == null ? View.GONE : footer.getVisibility();
        if (scroll != null) scroll.setVisibility(View.GONE);
        if (footer != null) footer.setVisibility(View.GONE);

        FrameLayout viewer = new FrameLayout(requireContext());
        viewer.setBackgroundColor(Color.BLACK);
        JSONObject author = story.optJSONObject("author");
        String authorName = author == null ? "Thành viên EcoShare" : author.optString("display_name", "Thành viên EcoShare");
        ImageView image = new ImageView(requireContext());
        image.setScaleType(ImageView.ScaleType.CENTER_CROP);
        image.setContentDescription("Story của " + authorName);
        if (!videoStory && bitmap != null) image.setImageBitmap(bitmap);
        viewer.addView(image, new FrameLayout.LayoutParams(-1, -1));

        if (videoStory) {
            VideoView video = new VideoView(requireContext());
            video.setVideoURI(Uri.fromFile(file));
            storyVideo = video;
            viewer.addView(video, new FrameLayout.LayoutParams(-1, -1));
        } else storyVideo = null;

        View shade = new View(requireContext());
        shade.setBackground(new GradientDrawable(GradientDrawable.Orientation.BOTTOM_TOP,
                new int[]{0xD9000000, 0x00000000}));
        viewer.addView(shade, new FrameLayout.LayoutParams(-1, -1));

        ProgressBar progress = new ProgressBar(requireContext(), null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(1000);
        progress.setProgress(0);
        progress.setProgressTintList(android.content.res.ColorStateList.valueOf(Color.WHITE));
        progress.setProgressBackgroundTintList(android.content.res.ColorStateList.valueOf(0x66FFFFFF));
        storyProgress = progress;
        LinearLayout top = column();
        top.setPadding(dp(14), dp(14), dp(14), 0);
        top.addView(progress, new LinearLayout.LayoutParams(-1, dp(2)));

        LinearLayout meta = row();
        LinearLayout.LayoutParams metaParams = new LinearLayout.LayoutParams(-1, dp(48));
        metaParams.topMargin = dp(12);
        top.addView(meta, metaParams);
        String avatarId = author == null ? "" : author.optString("avatar_key", "");
        FrameLayout avatarFrame = new FrameLayout(requireContext());
        GradientDrawable avatarRing = new GradientDrawable();
        avatarRing.setShape(GradientDrawable.OVAL);
        avatarRing.setColor(0x44FFFFFF);
        avatarRing.setStroke(dp(1), 0xFFFFFFFF);
        avatarFrame.setBackground(avatarRing);
        ImageView avatarImage = new ImageView(requireContext());
        avatarImage.setScaleType(ImageView.ScaleType.CENTER_CROP);
        avatarImage.setClipToOutline(true);
        GradientDrawable avatarCircle = new GradientDrawable();
        avatarCircle.setShape(GradientDrawable.OVAL);
        avatarCircle.setColor(0xFFEAF7EE);
        avatarImage.setBackground(avatarCircle);
        FrameLayout.LayoutParams avatarParams = new FrameLayout.LayoutParams(dp(36), dp(36), Gravity.CENTER);
        avatarFrame.addView(avatarImage, avatarParams);
        if (!avatarId.isEmpty() && !"null".equals(avatarId)) loadImage(avatarImage, avatarId);
        else {
            TextView initials = text(initials(authorName), 14, GREEN, true);
            initials.setGravity(Gravity.CENTER);
            initials.setBackground(avatarCircle);
            avatarFrame.addView(initials, avatarParams);
        }
        meta.addView(avatarFrame, new LinearLayout.LayoutParams(dp(40), dp(40)));

        LinearLayout details = column();
        details.setPadding(dp(10), 0, 0, 0);
        TextView name = text(authorName, 14, Color.WHITE, true);
        TextView age = text(storyAge(story.optString("created_at", "")), 12, 0xFFE5E7EB, false);
        details.addView(name);
        details.addView(age);
        meta.addView(details, new LinearLayout.LayoutParams(0, -2, 1));
        TextView close = text("×", 30, Color.WHITE, false);
        close.setGravity(Gravity.CENTER);
        close.setContentDescription("Đóng story");
        close.setOnClickListener(v -> closeStoryViewer());
        meta.addView(close, new LinearLayout.LayoutParams(dp(40), dp(44)));
        viewer.addView(top, new FrameLayout.LayoutParams(-1, -2, Gravity.TOP));

        String captionText = story.optString("body", "").trim();
        if (!captionText.isEmpty()) {
            TextView caption = text(captionText, 14, Color.WHITE, true);
            caption.setShadowLayer(dp(3), 0, dp(1), 0xAA000000);
            caption.setMaxLines(5);
            caption.setEllipsize(android.text.TextUtils.TruncateAt.END);
            caption.setPadding(dp(16), dp(12), dp(16), dp(8));
            caption.setGravity(Gravity.START | Gravity.CENTER_VERTICAL);
            FrameLayout.LayoutParams captionParams = new FrameLayout.LayoutParams(-1, -2, Gravity.BOTTOM);
            captionParams.bottomMargin = dp(70);
            viewer.addView(caption, captionParams);
        }

        storyViewer = viewer;
        host.addView(viewer, new LinearLayout.LayoutParams(-1, 0, 1));
        storyBackCallback.setEnabled(true);
        if (requireActivity() instanceof MainActivity) ((MainActivity) requireActivity()).setStoryViewerVisible(true);
        storyStartedAt = SystemClock.elapsedRealtime();
        if (videoStory && storyVideo != null) {
            storyVideo.setOnPreparedListener(player -> {
                if (storyViewer != viewer) return;
                player.setLooping(false);
                storyStartedAt = SystemClock.elapsedRealtime();
                storyVideo.start();
                scheduleStoryProgress(videoStory, viewer);
            });
            storyVideo.setOnCompletionListener(player -> closeStoryViewer());
        } else scheduleStoryProgress(false, viewer);
    }

    private void scheduleStoryProgress(boolean video, FrameLayout viewer) {
        if (storyTicker != null) main.removeCallbacks(storyTicker);
        storyTicker = new Runnable() {
            @Override public void run() {
                if (storyViewer != viewer || storyProgress == null) return;
                if (video && storyVideo != null) {
                    int duration = storyVideo.getDuration(), position = storyVideo.getCurrentPosition();
                    if (duration > 0) storyProgress.setProgress(Math.min(1000, position * 1000 / duration));
                    main.postDelayed(this, 50);
                } else {
                    long elapsed = SystemClock.elapsedRealtime() - storyStartedAt;
                    storyProgress.setProgress((int) Math.min(1000, elapsed * 1000 / 5000L));
                    if (elapsed >= 5000L) closeStoryViewer();
                    else main.postDelayed(this, 50);
                }
            }
        };
        main.post(storyTicker);
    }

    private void closeStoryViewer() {
        boolean wasOpen = storyViewer != null;
        if (storyTicker != null) main.removeCallbacks(storyTicker);
        storyTicker = null;
        if (storyVideo != null) {
            try { storyVideo.stopPlayback(); } catch (IllegalStateException ignored) { }
            storyVideo = null;
        }
        if (storyBackCallback != null) storyBackCallback.setEnabled(false);
        if (storyViewer != null) {
            ViewGroup parent = (ViewGroup) storyViewer.getParent();
            if (parent != null) parent.removeView(storyViewer);
            storyViewer = null;
        }
        storyProgress = null;
        if (!wasOpen) return;
        if (scroll != null) scroll.setVisibility(storyScrollVisibility);
        if (footer != null) footer.setVisibility(storyFooterVisibility);
        if (root != null) {
            View header = root.findViewById(R.id.community_header);
            if (header != null) header.setVisibility("home".equals(destination) ? View.GONE : View.VISIBLE);
        }
        if (getActivity() instanceof MainActivity) ((MainActivity) requireActivity()).setStoryViewerVisible(false);
    }

    private static String storyAge(String iso) {
        if (iso == null || iso.length() < 19) return "Vừa xong";
        try {
            java.text.SimpleDateFormat parser = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US);
            parser.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
            long created = parser.parse(iso.substring(0, 19)).getTime();
            long minutes = Math.max(0, (System.currentTimeMillis() - created) / 60_000L);
            if (minutes < 1) return "Vừa xong";
            if (minutes < 60) return minutes + " phút trước";
            long hours = minutes / 60;
            if (hours < 24) return hours + " giờ trước";
            return (hours / 24) + " ngày trước";
        } catch (Exception ignored) { return "Vừa xong"; }
    }

    private void guestReadOnlyBanner() {
        LinearLayout note = card(body);
        note.addView(text("Nội dung công khai · Chỉ đọc", 14, GREEN, true));
        note.addView(text("Khi mất mạng, chỉ các bài và ảnh đã xem được mở lại.", 12, MUTED, false));
    }

    private View ecoPointsCard() {
        LinearLayout card = row();
        card.setId(R.id.home_eco_points_banner);
        card.setBackgroundResource(R.drawable.bg_eco_points_banner);
        card.setPadding(dp(16), dp(11), dp(16), dp(11));
        card.setMinimumHeight(dp(64));
        card.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_YES);

        ImageView leaf = new ImageView(requireContext());
        leaf.setImageResource(R.drawable.ic_eco_points_sprout);
        leaf.setContentDescription(null);
        leaf.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        LinearLayout.LayoutParams leafParams = new LinearLayout.LayoutParams(dp(28), dp(28));
        leafParams.setMarginEnd(dp(12));
        card.addView(leaf, leafParams);

        LinearLayout description = column();
        TextView title = text("Điểm Eco của bạn", 12, Color.WHITE, true);
        TextView subtitle = text("Hoàn thành thêm thử thách để tăng điểm", 10, Color.rgb(219, 246, 160), false);
        subtitle.setMaxLines(2);
        title.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        subtitle.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        description.addView(title);
        description.addView(subtitle);
        LinearLayout.LayoutParams descriptionParams = new LinearLayout.LayoutParams(0, -2, 1);
        card.addView(description, descriptionParams);

        LinearLayout balance = column();
        balance.setGravity(Gravity.END);
        balance.setPadding(dp(12), 0, 0, 0);
        ecoPointsValue = text("0", 18, Color.WHITE, true);
        ecoPointsValue.setId(R.id.home_eco_points_value);
        ecoPointsValue.setGravity(Gravity.END);
        ecoPointsValue.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        TextView unit = text("điểm", 10, Color.rgb(219, 246, 160), false);
        unit.setGravity(Gravity.END);
        unit.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        balance.addView(ecoPointsValue);
        balance.addView(unit);
        card.addView(balance);
        return card;
    }

    private void updateEcoPoints() {
        if (ecoPointsValue == null || ecoPointsBanner == null) return;
        JSONObject profile = BackendSession.profile();
        long points = Math.max(0, profile == null ? 0 : profile.optLong("points_balance", 0));
        ecoPointsValue.setText(NumberFormat.getIntegerInstance(Locale.US).format(points));
        ecoPointsBanner.setContentDescription("Điểm Eco của bạn: " + points + " điểm. Hoàn thành thêm thử thách để tăng điểm.");
    }

    private void explore() {
        deactivatePage();
        // Media from the previous tab must not paint the newly selected tab.
        viewVersion++;
        header("Khám phá", false);
        body.removeAllViews();
        if (!api.isSignedIn()) guestReadOnlyBanner();
        EditText search = input("Tìm kiếm mẹo tái chế...", 100, R.id.community_search);
        stylePrimarySearch(search);
        search.setImeOptions(android.view.inputmethod.EditorInfo.IME_ACTION_SEARCH);
        search.setOnEditorActionListener((v, action, event) -> {
            if (action == android.view.inputmethod.EditorInfo.IME_ACTION_SEARCH) { searchExplore(search.getText().toString().trim()); return true; }
            return false;
        });
        body.addView(search);
        exploreTabs();
        LinearLayout results=column(); body.addView(results);
        if("tips".equals(exploreTab)) showPaged(results,"/tips","Chưa có nội dung đã xuất bản.",entry->postCard(results,entry,false));
        else if("challenges".equals(exploreTab)) showPaged(results,"/challenges","Chưa có thử thách mới.",entry->challengeCard(results,entry));
        else showPaged(results,"/listings","Chưa có nội dung đã xuất bản.",entry->listingCard(results,entry));
    }
    private void stylePrimarySearch(EditText search) {
        search.setSingleLine(true);
        search.setTextSize(15);
        search.setHintTextColor(0xFF728B85);
        search.setBackgroundResource(R.drawable.bg_explore_search);
        search.setMinHeight(dp(50));
        search.setMinimumHeight(dp(50));
        search.setPadding(dp(16), dp(10), dp(16), dp(10));
        search.setElevation(dp(3));
        android.graphics.drawable.Drawable icon = androidx.core.content.ContextCompat.getDrawable(requireContext(), R.drawable.ic_search);
        if (icon != null) {
            icon = androidx.core.graphics.drawable.DrawableCompat.wrap(icon.mutate());
            androidx.core.graphics.drawable.DrawableCompat.setTint(icon, GREEN);
            icon.setBounds(0, 0, dp(20), dp(20));
            search.setCompoundDrawablePadding(dp(10));
            search.setCompoundDrawablesRelative(icon, null, null, null);
        }
    }
    private void exploreTabs() {
        LinearLayout strip = row();
        strip.setPadding(dp(3), dp(3), dp(3), dp(3));
        strip.setBackgroundResource(R.drawable.bg_explore_tabs);
        strip.setClipChildren(false);
        strip.setClipToPadding(false);
        LinearLayout.LayoutParams stripParams = new LinearLayout.LayoutParams(-1, dp(42));
        stripParams.topMargin = dp(12);
        stripParams.bottomMargin = dp(16);
        body.addView(strip, stripParams);
        String[] labels = {"💡 Mẹo hay", "🏆 Thử thách", "🧳 Trao đổi"};
        String[] values = {"tips", "challenges", "market"};
        for (int i = 0; i < values.length; i++) {
            String value = values[i];
            boolean selected = value.equals(exploreTab);
            TextView tab = text(labels[i], 12, selected ? INK : 0xFF98A7BE, selected);
            tab.setGravity(Gravity.CENTER);
            tab.setSingleLine(true);
            tab.setBackgroundResource(selected ? R.drawable.bg_explore_tab_selected : R.drawable.bg_tab_inactive);
            tab.setElevation(selected ? dp(2) : 0);
            tab.setClickable(true);
            tab.setFocusable(true);
            tab.setContentDescription(labels[i]);
            tab.setOnClickListener(v -> {
                if (!value.equals(exploreTab)) { exploreTab = value; explore(); }
            });
            strip.addView(tab, new LinearLayout.LayoutParams(0, -1, 1));
        }
    }
    private void searchExplore(String query) {
        if (query.isEmpty()) { message("Nhập từ khóa để tìm trong mẹo, thử thách và Chợ đồ cũ."); return; }
        body.removeViews(body.getChildCount() - 1, 1);
        LinearLayout results = column(); body.addView(results);
        TextView wait = loading(results);
        get("/explore/search?q=" + enc(query) + "&limit=50", response -> {
            results.removeView(wait);
            JSONArray items = response.optJSONArray("items");
            if (items == null || items.length() == 0) { empty(results, "Không tìm thấy kết quả phù hợp."); return; }
            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.optJSONObject(i); if (item == null) continue;
                switch (item.optString("kind")) {
                    case "TIP": postCard(results, item, false); break;
                    case "CHALLENGE": challengeCard(results, item); break;
                    case "LISTING": listingCard(results, item); break;
                }
            }
        });
    }

    private void challengeCard(LinearLayout parent, JSONObject challenge) {
        LinearLayout card = card(parent);
        card.setTag("challenge:" + challenge.optString("id"));
        renderChallengeCard(card, challenge);
    }
    private void renderChallengeCard(LinearLayout card, JSONObject challenge) {
        card.removeAllViews();
        card.setPadding(dp(14), dp(14), dp(14), dp(12));
        JSONObject metadata = challenge.optJSONObject("metadata");
        int reward = challenge.optInt("reward_points", metadata == null ? 0 : metadata.optInt("reward_points", 0));
        int target = challenge.optInt("target", metadata == null ? 0 : metadata.optInt("target", 0));
        String unit = challenge.optString("unit", metadata == null ? "" : metadata.optString("unit", ""));
        String endsAt = challenge.optString("ends_at", "");
        boolean completed = challenge.optBoolean("completed");
        long now = System.currentTimeMillis();
        long starts = challengeTimestamp(challenge.optString("starts_at", ""));
        long ends = challengeTimestamp(endsAt);
        boolean upcoming = starts > now, ended = ends > 0 && ends < now;
        String state = completed ? "Đã hoàn thành" : upcoming ? "Sắp diễn ra" : ended ? "Đã kết thúc" : "Đang diễn ra";

        LinearLayout head = row();
        head.setGravity(Gravity.TOP);
        TextView icon = text("🏆", 23, GREEN, false);
        icon.setGravity(Gravity.CENTER);
        icon.setBackgroundResource(R.drawable.community_pill);
        head.addView(icon, new LinearLayout.LayoutParams(dp(44), dp(44)));
        LinearLayout heading = column();
        heading.setPadding(dp(10), 0, 0, 0);
        LinearLayout titleRow = row();
        titleRow.setGravity(Gravity.TOP);
        TextView title = text(challenge.optString("title", "Thử thách Eco"), 14, INK, true);
        title.setMaxLines(2);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(0, -2, 1);
        titleParams.rightMargin = dp(5);
        titleRow.addView(title, titleParams);
        TextView status = text(state, 10, completed || (!upcoming && !ended) ? GREEN : MUTED, true);
        status.setPadding(dp(8), dp(4), dp(8), dp(4));
        status.setBackgroundResource(R.drawable.bg_challenge_status);
        titleRow.addView(status);
        heading.addView(titleRow);
        TextView description = text(challenge.optString("body", ""), 12, MUTED, false);
        description.setMaxLines(3);
        LinearLayout.LayoutParams descriptionParams = new LinearLayout.LayoutParams(-1, -2);
        descriptionParams.topMargin = dp(4);
        heading.addView(description, descriptionParams);
        head.addView(heading, new LinearLayout.LayoutParams(0, -2, 1));
        card.addView(head);

        StringBuilder facts = new StringBuilder("♻ Thử thách Eco");
        if (target > 0) facts.append("    🎯 ").append(target).append(unit.isEmpty() ? "" : " " + unit);
        if (!endsAt.isEmpty() && !"null".equals(endsAt)) facts.append("    🗓 ").append(date(endsAt));
        TextView meta = text(facts.toString(), 11, MUTED, false);
        LinearLayout.LayoutParams metaParams = new LinearLayout.LayoutParams(-1, -2);
        metaParams.topMargin = dp(10);
        card.addView(meta, metaParams);

        int progressTarget = Math.max(1, challenge.optInt("progress_target", 1));
        int progress = completed ? progressTarget : Math.max(0, Math.min(progressTarget, challenge.optInt("progress_current", 0)));
        LinearLayout progressRow = row();
        TextView progressLabel = text("Tiến độ", 11, MUTED, false);
        progressRow.addView(progressLabel, new LinearLayout.LayoutParams(0, -2, 1));
        progressRow.addView(text(progress + "/" + progressTarget, 11, GREEN, true));
        LinearLayout.LayoutParams progressParams = new LinearLayout.LayoutParams(-1, -2);
        progressParams.topMargin = dp(12);
        card.addView(progressRow, progressParams);
        ProgressBar bar = new ProgressBar(requireContext(), null, android.R.attr.progressBarStyleHorizontal);
        bar.setMax(progressTarget);
        bar.setProgress(progress);
        bar.setProgressTintList(android.content.res.ColorStateList.valueOf(0xFF4FAB80));
        bar.setProgressBackgroundTintList(android.content.res.ColorStateList.valueOf(0xFFE4F2E8));
        LinearLayout.LayoutParams barParams = new LinearLayout.LayoutParams(-1, dp(7));
        barParams.topMargin = dp(4);
        card.addView(bar, barParams);

        View divider = new View(requireContext());
        divider.setBackgroundColor(0xFFECF3EE);
        LinearLayout.LayoutParams dividerParams = new LinearLayout.LayoutParams(-1, dp(1));
        dividerParams.topMargin = dp(12);
        card.addView(divider, dividerParams);
        LinearLayout footer = row();
        TextView points = text("🏅 +" + reward + " điểm", 12, 0xFFE69200, true);
        footer.addView(points, new LinearLayout.LayoutParams(0, -2, 1));
        TextView details = text("Xem chi tiết →", 12, GREEN, true);
        details.setGravity(Gravity.CENTER);
        details.setPadding(dp(12), 0, dp(12), 0);
        details.setBackgroundResource(R.drawable.community_pill);
        details.setClickable(true);
        details.setFocusable(true);
        details.setOnClickListener(v -> challengeDetails(challenge, card, completed, upcoming, ended, reward, target, unit, endsAt));
        footer.addView(details, new LinearLayout.LayoutParams(-2, dp(36)));
        LinearLayout.LayoutParams footerParams = new LinearLayout.LayoutParams(-1, -2);
        footerParams.topMargin = dp(8);
        card.addView(footer, footerParams);
    }
    private long challengeTimestamp(String iso) {
        if (iso.isEmpty() || "null".equals(iso)) return -1;
        for (String pattern : new String[]{"yyyy-MM-dd'T'HH:mm:ss.SSSX", "yyyy-MM-dd'T'HH:mm:ssX"}) {
            try {
                java.text.SimpleDateFormat format = new java.text.SimpleDateFormat(pattern, Locale.US);
                format.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
                java.util.Date parsed = format.parse(iso);
                if (parsed != null) return parsed.getTime();
            } catch (java.text.ParseException ignored) { }
        }
        return -1;
    }
    private void challengeDetails(JSONObject challenge, LinearLayout card, boolean completed, boolean upcoming, boolean ended,
                                  int reward, int target, String unit, String endsAt) {
        StringBuilder details = new StringBuilder(challenge.optString("body", ""));
        if (target > 0) details.append("\n\nMục tiêu: ").append(target).append(unit.isEmpty() ? "" : " " + unit);
        if (!endsAt.isEmpty() && !"null".equals(endsAt)) details.append("\nHạn hoàn thành: ").append(date(endsAt));
        details.append("\nĐiểm thưởng: +").append(reward).append(" điểm Eco");
        androidx.appcompat.app.AlertDialog.Builder dialog = new androidx.appcompat.app.AlertDialog.Builder(requireContext())
                .setTitle(challenge.optString("title", "Thử thách Eco"))
                .setMessage(details.toString())
                .setNegativeButton("Đóng", null);
        if (!completed && !upcoming && !ended) {
            dialog.setPositiveButton("Hoàn thành & nhận điểm", (window, which) -> completeChallenge(challenge.optString("id"), () -> {
                try { challenge.put("completed", true); } catch (JSONException ignored) { }
                for (PageState page : pageStates.values()) {
                    for (JSONObject row : page.rows) {
                        if (challenge.optString("id").equals(row.optString("id"))) {
                            try { row.put("completed", true); } catch (JSONException ignored) { }
                        }
                    }
                }
                if (card.getParent() != null) renderChallengeCard(card, challenge);
                if (activePage != null) savePage(activePage);
            }));
        }
        dialog.show();
    }
    private void completeChallenge(String challengeId, Runnable onComplete) {
        if (!signedIn() || challengeId.isEmpty() || busy) return;
        busy = true;
        api.request("POST", "/challenges/" + enc(challengeId) + "/complete", json(), UUID.randomUUID().toString(), new FirebaseBackendClient.Callback<JSONObject>() {
            @Override public void onSuccess(JSONObject result) {
                busy = false;
                if (!isAdded()) return;
                clearPagedSnapshots();
                BackendSession.refreshProfile(requireContext(), true);
                onComplete.run();
                message(result.optBoolean("created", true)
                        ? "Bạn vừa nhận " + result.optInt("points") + " điểm Eco!"
                        : "Thử thách này đã hoàn thành trước đó.");
            }
            @Override public void onError(FirebaseBackendClient.BackendException error) {
                busy = false; if (isAdded()) message(error.getMessage());
            }
        });
    }
    private void tabs(LinearLayout parent, String[] labels, String[] values, String selected, Consumer<String> choose) {
        LinearLayout strip=row(); strip.setPadding(dp(2),dp(2),dp(2),dp(2)); strip.setBackgroundResource(R.drawable.community_pill); LinearLayout.LayoutParams stripLp=new LinearLayout.LayoutParams(-1,-2); stripLp.bottomMargin=dp(18); parent.addView(strip,stripLp);
        for(int i=0;i<labels.length;i++) { String value=values[i]; Button tab=button(labels[i],()->choose.accept(value)); if(value.equals(selected)) { tab.setBackgroundResource(R.drawable.community_card); tab.setTextColor(GREEN); } else tab.setTextColor(MUTED); strip.addView(tab,new LinearLayout.LayoutParams(0,dp(48),1)); }
    }
    private static String pagePath(String path,String cursor) { return pagePath(path,cursor,PAGE_SIZE); }
    private static String pagePath(String path,String cursor,int limit) {
        String base=path+(path.contains("?")?"&":"?")+"limit="+limit;
        return cursor.isEmpty()?base:base+"&cursor="+enc(cursor);
    }
    private String snapshotKey(String path) {
        FirebaseBackendClient.SessionInfo session=api.currentSession();
        return (session==null?"public":session.uid)+"|"+path;
    }
    private PageState pageState(String path) {
        PageState state=pageStates.get(path);
        if(state!=null)return state;
        state=new PageState(path);
        PageSnapshot snapshot;
        synchronized(PAGE_SNAPSHOTS){LinkedHashMap<String,PageSnapshot> cache=PAGE_SNAPSHOTS.get(api);snapshot=cache==null?null:cache.get(snapshotKey(path));}
        if(snapshot!=null){
            try { for(String row:snapshot.rows)state.rows.add(new JSONObject(row)); state.cursor=snapshot.cursor; state.scrollY=snapshot.scrollY; state.firstPageCount=snapshot.firstPageCount; state.unreadCount=snapshot.unreadCount; state.fetchedAt=snapshot.fetchedAt; state.loaded=true; }
            catch(JSONException invalid){state.rows.clear();state.cursor="";state.loaded=false;}
        }
        if(!state.loaded){
            JSONObject cached=api.cachedJson(pagePath(path,""));
            if(cached!=null)acceptPage(state,cached,true);
        }
        pageStates.put(path,state);
        return state;
    }
    private void savePage(PageState state) {
        if(!state.loaded||api==null||api.currentSession()==null)return;
        synchronized(PAGE_SNAPSHOTS){
            LinkedHashMap<String,PageSnapshot> cache=PAGE_SNAPSHOTS.get(api);
            if(cache==null){cache=new LinkedHashMap<>(16,0.75f,true);PAGE_SNAPSHOTS.put(api,cache);}
            String key=snapshotKey(state.path);
            if(state.rows.size()>MAX_SNAPSHOT_ITEMS){cache.remove(key);return;}
            ArrayList<String> rows=new ArrayList<>(state.rows.size());for(JSONObject row:state.rows)rows.add(row.toString());
            cache.put(key,new PageSnapshot(rows,state.cursor,state.scrollY,state.firstPageCount,state.unreadCount,state.fetchedAt));
            while(cache.size()>MAX_SNAPSHOT_ROUTES)cache.remove(cache.keySet().iterator().next());
        }
    }
    private void deactivatePage() {
        if(activePage==null)return;
        if(scroll!=null)activePage.scrollY=scroll.getScrollY();
        savePage(activePage);
        activePage.renderSerial++;activePage.renderScheduled=false;activePage.restoreScrollPending=false;
        activePage.target=null;activePage.render=null;activePage.footer=null;activePage=null;userScrolled=false;
    }
    private void showPaged(LinearLayout target,String path,String emptyMessage,Consumer<JSONObject> render) {
        deactivatePage();
        PageState state=pageState(path);activePage=state;userScrolled=false;state.target=target;state.render=render;state.emptyMessage=emptyMessage;state.renderedCount=0;state.footer=null;state.renderSerial++;state.renderScheduled=false;state.restoreScrollPending=state.scrollY>0;
        syncPage(state);
        if(!state.loaded)fetchPage(state,false);
        else if(SystemClock.elapsedRealtime()-state.fetchedAt>PAGE_SNAPSHOT_TTL_MS)fetchPage(state,true);
    }
    private void fetchPage(PageState state,boolean refresh) {
        if(state.loading||(!refresh&&state.loaded&&state.cursor.isEmpty()))return;
        String cursor=refresh||!state.loaded?"":state.cursor;
        state.loading=true;state.error=null;state.errorWasRefresh=refresh;state.requestSerial++;
        state.lastRefreshAttemptAt=SystemClock.elapsedRealtime();
        int serial=state.requestSerial;
        syncPage(state);
        // A live refresh covers pages the reader has already loaded, up to the API's
        // 100-row limit. The initial and next-page requests still fetch just three.
        int limit=refresh?Math.min(100,Math.max(PAGE_SIZE,state.rows.size())):PAGE_SIZE;
        String path=pagePath(state.path,cursor,limit);
        FirebaseBackendClient.Callback<JSONObject> callback=new FirebaseBackendClient.Callback<JSONObject>(){
            public void onSuccess(JSONObject response){
                if(serial!=state.requestSerial||body==null||!isAdded())return;
                state.loading=false;acceptPage(state,response,refresh||!state.loaded);savePage(state);syncPage(state);
            }
            public void onError(FirebaseBackendClient.BackendException error){
                if(serial!=state.requestSerial||body==null||!isAdded())return;
                state.loading=false;state.error=error;syncPage(state);
            }
        };
        if(api.isSignedIn()) {
            if(refresh) api.requestFresh(path,callback);
            else api.request("GET",path,null,null,callback);
        } else api.getPublic(path,callback);
    }
    private void acceptPage(PageState state,JSONObject response,boolean firstPage) {
        JSONArray entries=response.optJSONArray("items");ArrayList<JSONObject> incoming=new ArrayList<>();
        if(entries!=null)for(int i=0;i<entries.length();i++){JSONObject item=entries.optJSONObject(i);if(item!=null)incoming.add(item);}
        String next=response.optString("next_cursor","");if("null".equals(next))next="";
        boolean rebuild=false;
        if(firstPage){
            // Keep any older tail beyond this refresh window when its IDs are unchanged.
            // Replacing it on every foreground refresh would jump the reader to the top.
            boolean sameHead=state.loaded&&state.firstPageCount==incoming.size()&&state.rows.size()>=incoming.size();
            if(sameHead)for(int i=0;i<incoming.size();i++)if(!state.rows.get(i).optString("id").equals(incoming.get(i).optString("id"))){sameHead=false;break;}
            if(!sameHead){state.rows.clear();state.rows.addAll(incoming);state.cursor=next;state.scrollY=activePage==state&&scroll!=null?scroll.getScrollY():state.scrollY;rebuild=true;}
            else{
                for(int i=0;i<incoming.size();i++){if(!state.rows.get(i).toString().equals(incoming.get(i).toString()))rebuild=true;state.rows.set(i,incoming.get(i));}
                if(state.rows.size()==incoming.size())state.cursor=next;
            }
            state.firstPageCount=incoming.size();
            state.fetchedAt=SystemClock.elapsedRealtime();
            state.unreadCount=response.optInt("unread_count",state.unreadCount);
        }else{
            Set<String> known=new LinkedHashSet<>();for(JSONObject row:state.rows)known.add(row.optString("id"));
            for(JSONObject item:incoming)if(known.add(item.optString("id")))state.rows.add(item);
            state.cursor=next.equals(state.cursor)?"":next;
        }
        state.loaded=true;state.error=null;
        if(rebuild&&state.target!=null){if(activePage==state&&scroll!=null)state.scrollY=scroll.getScrollY();state.target.removeAllViews();state.renderedCount=0;state.footer=null;state.renderSerial++;state.renderScheduled=false;state.restoreScrollPending=state.scrollY>0;}
        if(activePage==state&&"/notifications".equals(state.path)&&root!=null)
            updateNotificationBadge(state.unreadCount);
    }
    private void syncPage(PageState state) {
        if(activePage!=state||state.target==null||state.render==null||body==null)return;
        LinearLayout target=state.target;
        if(state.footer!=null){target.removeView(state.footer);state.footer=null;}
        int end=Math.min(state.rows.size(),state.renderedCount+ROWS_PER_FRAME);
        for(int i=state.renderedCount;i<end;i++)state.render.accept(state.rows.get(i));
        state.renderedCount=end;
        if(end<state.rows.size()){
            if(!state.renderScheduled){
                state.renderScheduled=true;
                int serial=state.renderSerial;
                target.postOnAnimation(()->{
                    if(state.renderSerial!=serial||state.target!=target||activePage!=state)return;
                    state.renderScheduled=false;
                    if(state.renderedCount<state.rows.size())syncPage(state);
                });
            }
            return;
        }
        if(state.error!=null){
            FirebaseBackendClient.BackendException error=state.error;
            boolean missingOfflineSnapshot = !api.isSignedIn() && state.rows.isEmpty()
                    && (error.httpStatus == 0 || error.httpStatus >= 502 && error.httpStatus <= 504);
            String explanation = missingOfflineSnapshot
                    ? "Chưa có nội dung đã lưu cho mục này.\n\nKết nối mạng và mở mục này một lần để lưu lại. Chạm để thử lại."
                    : "Chưa tải được dữ liệu\n\n" + error.getMessage() + "\n\n"
                    + ("INVALID_CURSOR".equals(error.code) ? "Danh sách đã thay đổi. Chạm để tải lại từ đầu" : "Chạm để thử lại");
            TextView retry=text(explanation,14,MUTED,false);
            retry.setTag("loading");retry.setPadding(dp(18),dp(20),dp(18),dp(20));retry.setBackgroundResource(R.drawable.community_card);retry.setFocusable(true);
            retry.setOnClickListener(v->{if(activePage!=state)return;boolean invalid="INVALID_CURSOR".equals(error.code);state.error=null;if(invalid){state.rows.clear();state.cursor="";state.loaded=false;state.scrollY=0;target.removeAllViews();state.renderedCount=0;state.footer=null;fetchPage(state,false);}else fetchPage(state,state.errorWasRefresh||!state.loaded);});
            target.addView(retry);state.footer=retry;
        }else if(state.loading){if(!state.loaded||!state.errorWasRefresh)state.footer=loading(target);}
        else if(state.rows.isEmpty()&&state.loaded&&state.cursor.isEmpty()){
            TextView message=text(state.emptyMessage,14,MUTED,false);message.setPadding(dp(12),dp(30),dp(12),dp(30));message.setGravity(Gravity.CENTER);target.addView(message);state.footer=message;
        }else if(state.loaded&&!state.cursor.isEmpty()){
            Button more=button("Xem thêm",()->fetchPage(state,false));target.addView(more);state.footer=more;
        }
        if("member_profile_content".equals(target.getTag()) && state.footer instanceof TextView && !(state.footer instanceof Button)) {
            TextView status=(TextView)state.footer;
            status.setBackgroundResource(R.drawable.bg_card);
            status.setGravity(Gravity.CENTER);
            status.setMinHeight(dp(80));
            LinearLayout.LayoutParams statusParams=(LinearLayout.LayoutParams)status.getLayoutParams();
            statusParams.setMargins(dp(14),0,dp(14),dp(12));
            status.setLayoutParams(statusParams);
        }
        if(state.restoreScrollPending&&state.loaded&&state.rows.size()>0&&scroll!=null){
            state.restoreScrollPending=false;
            int position=state.scrollY;
            scroll.post(()->{if(activePage==state&&!userScrolled&&scroll!=null)scroll.scrollTo(0,position);});
        }
    }
    private void maybeLoadNextPage() {
        PageState state=activePage;
        if(!userScrolled||state==null||!state.loaded||state.loading||state.renderedCount<state.rows.size()||state.error!=null||state.cursor.isEmpty()||scroll==null)return;
        View content=scroll.getChildAt(0);if(content==null)return;
        if(content.getHeight()-scroll.getScrollY()-scroll.getHeight()<=dp(320))fetchPage(state,false);
    }
    private void postCard(LinearLayout parent, JSONObject post, boolean full) {
        String id=post.optString("id"), kind=post.optString("kind","POST"), destination="TIP".equals(kind)?"tip_detail":"post_detail";
        LinearLayout card=card(parent);card.setTag("post:"+id); JSONObject author=post.optJSONObject("author"); String authorName=author==null?"Thành viên EcoShare":author.optString("display_name","Thành viên EcoShare");
        LinearLayout top=row(); avatar(top,authorName,author==null?"":author.optString("avatar_key",""),44);
        LinearLayout name=column(); name.setPadding(dp(10),0,0,0); name.addView(text(authorName,14,INK,true)); name.addView(text(date(post.optString("created_at"))+" · Công khai",11,MUTED,false)); top.addView(name,new LinearLayout.LayoutParams(0,-2,1));
        if (api.isSignedIn()) {
            Button report = button("🚩", () -> go("report", id, false));
            report.setContentDescription("Báo cáo bài viết");
            report.setTextSize(18);
            report.setPadding(0, 0, 0, 0);
            report.setMinHeight(dp(40));
            report.setMinimumHeight(dp(40));
            report.setMinWidth(dp(40));
            report.setMinimumWidth(dp(40));
            top.addView(report, new LinearLayout.LayoutParams(dp(40), dp(40)));
        }
        card.addView(top);
        if (author != null && !author.optString("id", "").isEmpty()) top.setOnClickListener(v -> go("user_profile", author.optString("id"), false));
        String title=post.optString("title",""); if(!title.isEmpty()) { TextView heading=text(title,17,INK,true); heading.setPadding(0,dp(12),0,0); card.addView(heading); }
        TextView content=text(post.optString("body"),15,INK,false); content.setPadding(0,dp(12),0,dp(8)); if(!full) { content.setMaxLines(5); content.setEllipsize(android.text.TextUtils.TruncateAt.END); content.setOnClickListener(v->go(destination,id,false)); } card.addView(content);
        JSONArray tags=post.optJSONArray("tags"), material=post.optJSONArray("materials"); ArrayList<String> badges=new ArrayList<>(); if(material!=null) for(int i=0;i<material.length();i++)badges.add(material.optString(i)); if(tags!=null) for(int i=0;i<tags.length();i++)badges.add("#"+tags.optString(i)); if(post.optDouble("weight_kg",0)>0)badges.add(post.optDouble("weight_kg")+" kg tái chế"); if(!badges.isEmpty())card.addView(text(android.text.TextUtils.join("  ",badges),12,GREEN,false));
        JSONArray media=post.optJSONArray("media"); if(media!=null) for(int i=0;i<media.length();i++) { JSONObject photo=media.optJSONObject(i); if(photo==null)continue; ImageView image=mediaImage(card,photo.optString("id"),full?300:220); if(!full) { image.setOnClickListener(v->go(destination,id,false)); break; } }
        LinearLayout statistics = row();
        statistics.setPadding(0, dp(10), 0, dp(8));
        TextView counts = text("❤️  " + post.optInt("like_count") + " lượt thích", 12, MUTED, false);
        counts.setTag("counts:" + id);
        counts.setTag(R.id.community_body, post);
        statistics.addView(counts, new LinearLayout.LayoutParams(0, -2, 1));
        TextView commentCount = text(post.optInt("comment_count") + " bình luận", 12, MUTED, false);
        commentCount.setTag("comment-count:" + id);
        statistics.addView(commentCount);
        statistics.setOnClickListener(v -> go(destination, id, true));
        card.addView(statistics);
        View divider = new View(requireContext());
        divider.setBackgroundColor(Color.rgb(230, 239, 234));
        card.addView(divider, new LinearLayout.LayoutParams(-1, dp(1)));

        boolean liked = post.optBoolean("liked"), saved = post.optBoolean("saved");
        LinearLayout actions = row();
        Button like = button(liked ? "Đã thích" : "Thích", () -> {});
        Button comment = button("Bình luận", () -> go(destination, id, true));
        Button save = button("", () -> {});
        Button share = button("Chia sẻ", () -> go("share_post", kind + ":" + id, false));
        like.setTag("like:" + id);
        comment.setTag("comment:" + id);
        save.setTag("save:" + id);
        stylePostAction(like, liked ? RED : MUTED);
        stylePostAction(comment, MUTED);
        stylePostAction(save, saved ? GOLD : MUTED);
        stylePostAction(share, MUTED);
        reactionIcon(like, liked);
        android.graphics.drawable.Drawable commentIcon = androidx.appcompat.content.res.AppCompatResources.getDrawable(requireContext(), R.drawable.ic_comment);
        if (commentIcon != null) {
            commentIcon = commentIcon.mutate();
            commentIcon.setTint(MUTED);
            commentIcon.setBounds(0, 0, dp(19), dp(19));
            comment.setCompoundDrawablesRelative(commentIcon, null, null, null);
            comment.setCompoundDrawablePadding(dp(3));
        }
        bookmark(save, saved);
        android.graphics.drawable.Drawable shareIcon = androidx.appcompat.content.res.AppCompatResources.getDrawable(requireContext(), R.drawable.ic_share);
        if (shareIcon != null) {
            shareIcon = shareIcon.mutate();
            shareIcon.setTint(MUTED);
            shareIcon.setBounds(0, 0, dp(19), dp(19));
            share.setCompoundDrawablesRelative(shareIcon, null, null, null);
            share.setCompoundDrawablePadding(dp(3));
        }
        String base = "TIP".equals(kind) ? "/tips/" : "/posts/";
        like.setOnClickListener(v -> reaction(post, base, id, "LIKE", like, counts));
        save.setOnClickListener(v -> reaction(post, base, id, "SAVE", save, counts));
        LinearLayout likeSlot = row();
        likeSlot.setGravity(Gravity.CENTER);
        likeSlot.addView(like, new LinearLayout.LayoutParams(-2, dp(50)));
        actions.addView(likeSlot, new LinearLayout.LayoutParams(0, dp(50), 1.1f));
        LinearLayout commentSlot = row();
        commentSlot.setGravity(Gravity.CENTER);
        commentSlot.addView(comment, new LinearLayout.LayoutParams(-2, dp(50)));
        actions.addView(commentSlot, new LinearLayout.LayoutParams(0, dp(50), 1.25f));
        LinearLayout shareSlot = row();
        shareSlot.setGravity(Gravity.CENTER);
        shareSlot.addView(share, new LinearLayout.LayoutParams(-2, dp(50)));
        actions.addView(shareSlot, new LinearLayout.LayoutParams(0, dp(50), 1));
        actions.addView(save, new LinearLayout.LayoutParams(dp(48), dp(50)));
        card.addView(actions);
        if(!full) { card.setContentDescription("Bài viết của "+authorName); card.setOnClickListener(v->go(destination,id,false)); }
    }
    private void reportScreen() {
        if (!signedIn()) return;
        header("🚩 Báo cáo vi phạm", true);
        body.removeAllViews();
        body.setPadding(dp(16), dp(16), dp(16), dp(20));
        footer.removeAllViews();
        footer.setOrientation(LinearLayout.VERTICAL);
        footer.setVisibility(View.VISIBLE);
        footer.setPadding(dp(16), dp(10), dp(16), dp(12));
        footer.setBackgroundColor(Color.WHITE);
        selectedReportReason = "";

        LinearLayout form = card(body);
        form.addView(text("Tại sao bạn báo cáo bài đăng này?", 16, INK, true));
        TextView hint = text("Chọn lý do phù hợp nhất với tình huống của bạn.", 13, MUTED, false);
        hint.setPadding(0, dp(4), 0, dp(12));
        form.addView(hint);

        String[] reasons = {"Spam hoặc lừa đảo", "Thông tin sai sự thật", "Nội dung không phù hợp", "Ngôn ngữ thù hận", "Vi phạm bản quyền", "Lý do khác"};
        String[] icons = {"⚠️", "❌", "🚫", "😡", "©️", "💬"};
        RadioButton[] radios = new RadioButton[reasons.length];
        LinearLayout[] choices = new LinearLayout[reasons.length];
        reportDetails = input("Mô tả thêm để chúng tôi xem xét", 1000, 0);
        reportDetails.setGravity(Gravity.TOP | Gravity.START);
        reportDetails.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        reportDetails.setMinHeight(dp(96));
        reportDetails.setVisibility(View.GONE);

        for (int i = 0; i < reasons.length; i++) {
            final int index = i;
            LinearLayout choice = row();
            choice.setPadding(dp(12), 0, dp(8), 0);
            choice.setBackgroundResource(R.drawable.community_pill);
            LinearLayout.LayoutParams choiceParams = new LinearLayout.LayoutParams(-1, dp(52));
            choiceParams.bottomMargin = dp(7);
            form.addView(choice, choiceParams);
            TextView icon = text(icons[i], 18, INK, false);
            icon.setGravity(Gravity.CENTER);
            choice.addView(icon, new LinearLayout.LayoutParams(dp(34), -1));
            TextView label = text(reasons[i], 14, INK, false);
            choice.addView(label, new LinearLayout.LayoutParams(0, -2, 1));
            RadioButton radio = new RadioButton(requireContext());
            radio.setButtonTintList(new android.content.res.ColorStateList(
                    new int[][]{new int[]{android.R.attr.state_checked}, new int[]{}},
                    new int[]{GREEN, Color.rgb(210, 220, 216)}));
            radio.setFocusable(false);
            radios[i] = radio;
            choice.addView(radio, new LinearLayout.LayoutParams(dp(42), dp(48)));
            choices[i] = choice;
            View.OnClickListener select = v -> {
                selectedReportReason = reasons[index];
                for (int j = 0; j < radios.length; j++) {
                    radios[j].setChecked(j == index);
                    choices[j].setBackgroundResource(j == index ? R.drawable.community_card : R.drawable.community_pill);
                }
                reportDetails.setVisibility(index == reasons.length - 1 ? View.VISIBLE : View.GONE);
                updateReportSubmitEnabled();
            };
            choice.setOnClickListener(select);
            radio.setOnClickListener(select);
        }
        LinearLayout.LayoutParams detailsParams = new LinearLayout.LayoutParams(-1, -2);
        detailsParams.topMargin = dp(4);
        form.addView(reportDetails, detailsParams);

        LinearLayout privacy = card(body);
        privacy.setBackgroundResource(R.drawable.community_pill);
        TextView privacyText = text("🔒  Báo cáo được giữ kín với người đăng bài. Đội ngũ EcoShare sẽ xem xét nội dung và lý do bạn gửi.", 13, GREEN, false);
        privacyText.setPadding(dp(4), dp(2), dp(4), dp(2));
        privacy.addView(privacyText);

        reportSubmit = button("Tiếp theo  →", this::submitContentReport);
        reportSubmit.setEnabled(false);
        reportSubmit.setTextColor(Color.WHITE);
        reportSubmit.setBackgroundResource(R.drawable.bg_order_payment);
        footer.addView(reportSubmit, new LinearLayout.LayoutParams(-1, dp(52)));
        reportDetails.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) { }
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) { updateReportSubmitEnabled(); }
            @Override public void afterTextChanged(Editable s) { }
        });
    }
    private void updateReportSubmitEnabled() {
        if (reportSubmit == null) return;
        boolean needsDetails = "Lý do khác".equals(selectedReportReason);
        boolean hasDetails = reportDetails != null && reportDetails.getText().toString().trim().length() >= 5;
        reportSubmit.setEnabled(!selectedReportReason.isEmpty() && (!needsDetails || hasDetails));
        reportSubmit.setAlpha(reportSubmit.isEnabled() ? 1f : .55f);
    }
    private void submitContentReport() {
        if (!signedIn() || entityId == null || entityId.isEmpty() || selectedReportReason.isEmpty()) return;
        String details = reportDetails == null ? "" : reportDetails.getText().toString().trim();
        if ("Lý do khác".equals(selectedReportReason) && details.length() < 5) {
            message("Vui lòng mô tả lý do báo cáo (ít nhất 5 ký tự).");
            return;
        }
        String reason = selectedReportReason + (details.isEmpty() ? "" : ": " + details);
        reportSubmit.setEnabled(false);
        reportSubmit.setText("Đang gửi báo cáo…");
        int version = viewVersion;
        api.request("POST", "/reports", json("content_id", entityId, "reason", reason), null,
                new FirebaseBackendClient.Callback<JSONObject>() {
                    @Override public void onSuccess(JSONObject result) {
                        if (body == null || version != viewVersion) return;
                        message("Đã gửi báo cáo. Cảm ơn bạn đã giúp EcoShare an toàn hơn.");
                        requireActivity().getOnBackPressedDispatcher().onBackPressed();
                    }
                    @Override public void onError(FirebaseBackendClient.BackendException error) {
                        if (body == null || version != viewVersion) return;
                        reportSubmit.setText("Tiếp theo  →");
                        updateReportSubmitEnabled();
                        if ("SELF_REPORT".equals(error.code)) message("Bạn không thể báo cáo bài viết của chính mình.");
                        else if ("REPORT_EXISTS".equals(error.code)) message("Bạn đã gửi báo cáo cho bài viết này rồi.");
                        else if ("NOT_FOUND".equals(error.code)) message("Bài viết không còn tồn tại hoặc đã bị ẩn.");
                        else if (!showLoadError(error)) message(error.getMessage());
                    }
                });
    }
    private void stylePostAction(Button button, int color) {
        button.setTextSize(13);
        button.setTextColor(color);
        button.setGravity(Gravity.CENTER);
        button.setPadding(dp(1), 0, dp(1), 0);
        button.setMinHeight(dp(50));
        button.setMinimumHeight(dp(50));
        button.setMinWidth(0);
        button.setMinimumWidth(0);
        button.setBackgroundColor(Color.TRANSPARENT);
        button.setElevation(0);
    }
    private void reactionIcon(Button button, boolean liked) {
        android.graphics.drawable.Drawable icon = androidx.appcompat.content.res.AppCompatResources.getDrawable(
                requireContext(), liked ? R.drawable.ic_heart : R.drawable.ic_like_outline);
        if (icon == null) return;
        icon = icon.mutate();
        icon.setTint(liked ? RED : MUTED);
        icon.setBounds(0, 0, dp(19), dp(19));
        button.setCompoundDrawablesRelative(icon, null, null, null);
        button.setCompoundDrawablePadding(dp(3));
        button.setContentDescription(liked ? "Bỏ thích bài viết" : "Thích bài viết");
    }
    private void reaction(JSONObject post, String base, String id, String type, Button button, TextView counts) {
        if (!signedIn()) return;
        boolean like = "LIKE".equals(type), active = !post.optBoolean(like ? "liked" : "saved");
        button.setEnabled(false);
        int version = viewVersion;
        api.request("PUT", base + id + "/reactions/" + type, json("active", active), null,
                new FirebaseBackendClient.Callback<JSONObject>() {
                    @Override public void onSuccess(JSONObject result) {
                        if (body == null || version != viewVersion) return;
                        button.setEnabled(true);
                        boolean selected = result.optBoolean("active");
                        try {
                            post.put(like ? "liked" : "saved", selected);
                            post.put("like_count", result.optInt("like_count", post.optInt("like_count")));
                        } catch (JSONException ignored) { }
                        if (like) {
                            button.setText(selected ? "Đã thích" : "Thích");
                            button.setTextColor(selected ? RED : MUTED);
                            reactionIcon(button, selected);
                        } else {
                            button.setText("");
                            button.setTextColor(selected ? GOLD : MUTED);
                            bookmark(button, selected);
                        }
                        counts.setText("❤️  " + post.optInt("like_count") + " lượt thích");
                        clearPagedSnapshots();
                        if (activePage != null) savePage(activePage);
                    }
                    @Override public void onError(FirebaseBackendClient.BackendException error) {
                        if (body != null && version == viewVersion) {
                            button.setEnabled(true);
                            message(error.getMessage());
                        }
                    }
                });
    }
    private void bookmark(Button button,boolean saved){android.graphics.drawable.Drawable icon=androidx.appcompat.content.res.AppCompatResources.getDrawable(requireContext(),saved?R.drawable.ic_community_bookmark_filled:R.drawable.ic_bookmark);if(icon==null)return;icon=icon.mutate();icon.setTint(saved?GOLD:MUTED);icon.setBounds(0,0,dp(23),dp(25));button.setCompoundDrawablesRelative(icon,null,null,null);button.setCompoundDrawablePadding(0);button.setContentDescription(saved?"Bỏ lưu bài viết":"Lưu bài viết");}
    private static String initials(String name) { String trimmed=name.trim(); if(trimmed.isEmpty())return "E"; String[] parts=trimmed.split("\\s+"); return (""+parts[0].charAt(0)+(parts.length>1?parts[parts.length-1].charAt(0):"")).toUpperCase(Locale.ROOT); }
    private static String date(String iso) { if(iso.length()<10)return ""; return iso.substring(8,10)+"/"+iso.substring(5,7)+"/"+iso.substring(0,4); }
    private ImageView mediaImage(LinearLayout parent,String id,int height) {
        ImageView image=new ImageView(requireContext()); image.setContentDescription("Ảnh bài đăng"); image.setBackgroundResource(R.drawable.community_pill); image.setClipToOutline(true); image.setScaleType(ImageView.ScaleType.CENTER_CROP); LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,dp(height));lp.topMargin=dp(10);parent.addView(image,lp);
        loadImage(image,id);return image;
    }
    private void avatar(LinearLayout parent,String name,String media,int size){
        if(!media.isEmpty()&&!"null".equals(media)){ImageView image=new ImageView(requireContext());image.setContentDescription("Ảnh đại diện "+name);image.setScaleType(ImageView.ScaleType.CENTER_CROP);image.setBackgroundResource(R.drawable.community_pill);image.setClipToOutline(true);parent.addView(image,new LinearLayout.LayoutParams(dp(size),dp(size)));loadImage(image,media);}
        else{TextView letter=text(initials(name),18,GREEN,true);letter.setGravity(Gravity.CENTER);letter.setBackgroundResource(R.drawable.community_pill);parent.addView(letter,new LinearLayout.LayoutParams(dp(size),dp(size)));}
    }
    private void loadImage(ImageView image,String id) {
        loadImage(image, id, 0);
    }
    private void loadImage(ImageView image,String id,int requestedEdge) {
        int version = viewVersion;
        ViewGroup.LayoutParams params = image.getLayoutParams();
        int edge = requestedEdge > 0 ? requestedEdge : params != null && params.width > 0 && params.height > 0
                ? Math.max(params.width, params.height) : getResources().getDisplayMetrics().widthPixels;
        final int targetEdge = Math.max(96, Math.min(1600, edge));
        final String key = id + ":" + targetEdge;
        image.setTag(R.id.community_action, key);
        Bitmap cached = decodedImages.get(key);
        if (cached != null) { image.setImageBitmap(cached); return; }
        api.downloadMedia(id,new FirebaseBackendClient.Callback<byte[]>() {
            public void onSuccess(byte[] bytes) {
                if (body == null || version != viewVersion || images.isShutdown()) return;
                try {
                    images.execute(() -> {
                        Bitmap ready = decodedImages.get(key);
                        if (ready == null) {
                            ready = decode(bytes, targetEdge);
                            if (ready != null && !images.isShutdown()) decodedImages.put(key, ready);
                        }
                        final Bitmap bitmap = ready;
                        main.post(() -> {
                            if (body != null && version == viewVersion && bitmap != null
                                    && key.equals(image.getTag(R.id.community_action))) image.setImageBitmap(bitmap);
                        });
                    });
                } catch (RejectedExecutionException ignored) { /* The screen was closed after its response arrived. */ }
            }
            public void onError(FirebaseBackendClient.BackendException e) {
                if(body!=null&&version==viewVersion)image.setContentDescription("Không tải được ảnh");
            }
        });
    }
    private static Bitmap decode(byte[] bytes) { return decode(bytes, 1600); }
    private static Bitmap decode(byte[] bytes, int edge) {
        BitmapFactory.Options bounds=new BitmapFactory.Options();bounds.inJustDecodeBounds=true;
        BitmapFactory.decodeByteArray(bytes,0,bytes.length,bounds);
        if(bounds.outWidth<=0||bounds.outHeight<=0)return null;
        BitmapFactory.Options size=new BitmapFactory.Options();size.inSampleSize=1;
        while(Math.max(bounds.outWidth,bounds.outHeight)/size.inSampleSize>edge)size.inSampleSize*=2;
        return BitmapFactory.decodeByteArray(bytes,0,bytes.length,size);
    }

    private void createMenu() {
        header("Tạo bài đăng",true); body.removeAllViews(); TextView prompt=text("Bạn muốn chia sẻ gì với cộng đồng?",14,MUTED,false); prompt.setPadding(0,dp(4),0,dp(20));body.addView(prompt);
        menuChoice("📷","Bài chia sẻ","Chia sẻ sản phẩm và câu chuyện tái chế",()->go("create_post","POST",false));
        menuChoice("💡","Mẹo hay","Hướng dẫn và kinh nghiệm tái chế",()->go("create_post","TIP",false));
        menuChoice("🛍","Chợ đồ cũ","Đăng bán đồ đã qua sử dụng",()->go("create_listing",null,false));
        LinearLayout fact=card(body);fact.setBackgroundResource(R.drawable.bg_hero);fact.addView(text("💡 BẠN CÓ BIẾT?",12,Color.WHITE,true));TextView factBody=text("Tái sử dụng một món đồ cũng là một cách giảm rác thải. Bắt đầu từ câu chuyện của bạn!",14,Color.WHITE,false);factBody.setPadding(0,dp(10),0,0);fact.addView(factBody);
    }
    private void menuChoice(String icon,String title,String description,Runnable click) { LinearLayout choice=card(body);LinearLayout line=row();TextView glyph=text(icon,25,GREEN,false);line.addView(glyph,new LinearLayout.LayoutParams(dp(44),dp(48)));LinearLayout copy=column();copy.addView(text(title,16,INK,true));copy.addView(text(description,12,MUTED,false));line.addView(copy,new LinearLayout.LayoutParams(0,-2,1));line.addView(text("›",26,MUTED,false));choice.addView(line);choice.setMinimumHeight(dp(86));choice.setFocusable(true);choice.setContentDescription(title+". "+description);choice.setOnClickListener(v->click.run()); }
    private void composer() {
        header("TIP".equals(contentKind)?"Soạn mẹo hay":"Soạn nội dung",true); body.removeAllViews(); if(!signedIn())return;
        JSONObject profile=BackendSession.profile(); LinearLayout author=row();author.addView(text("●  "+(profile==null?"Bạn":profile.optString("display_name","Bạn")),15,INK,true));body.addView(author);body.addView(text("🌐 Công khai",12,GREEN,false));
        if("TIP".equals(contentKind)){label("TIÊU ĐỀ MẸO HAY");draftTitle=input("Đặt tiêu đề ngắn gọn",120,R.id.community_draft_title);draftTitle.setText(savedTitle);addComposerField(draftTitle,56);}
        label("TIP".equals(contentKind)?"NỘI DUNG MẸO HAY":"NỘI DUNG BÀI VIẾT");
        draft=input("Chia sẻ câu chuyện tái chế của bạn với cộng đồng… 💚",500,R.id.community_draft);draft.setGravity(Gravity.TOP);draft.setMinLines(6);draft.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_FLAG_MULTI_LINE|InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);draft.setText(savedBody);addComposerField(draft,184);
        TextView counter=text(draft.length()+"/500",12,MUTED,false);counter.setGravity(Gravity.END);counter.setPadding(0,dp(3),dp(4),0);body.addView(counter);draft.addTextChangedListener(watcher(()->{counter.setText(draft.length()+"/500");updatePublishAvailability();}));
        photosForm();label("🏷 PHÂN LOẠI VẬT LIỆU");chips();LinearLayout fields=row();fields.setGravity(Gravity.TOP);LinearLayout left=column(),right=column();left.addView(text("⚖ TRỌNG LƯỢNG TÁI CHẾ",11,MUTED,true));right.addView(text("🏷 TAGS",11,MUTED,true));
        weight=input("Ví dụ: 1.5 kg",12,R.id.community_weight);weight.setInputType(InputType.TYPE_CLASS_NUMBER|InputType.TYPE_NUMBER_FLAG_DECIMAL);weight.setText(savedWeight);tags=input("DIY, ZeroWaste…",200,R.id.community_tags);tags.setText(savedTags);left.addView(weight);right.addView(tags);LinearLayout.LayoutParams fieldLp=new LinearLayout.LayoutParams(0,-2,1);fieldLp.setMargins(0,dp(16),dp(6),0);fields.addView(left,fieldLp);LinearLayout.LayoutParams rightLp=new LinearLayout.LayoutParams(0,-2,1);rightLp.setMargins(dp(6),dp(16),0,0);fields.addView(right,rightLp);body.addView(fields);
        action("Đăng",this::publishPost);publish=root.findViewById(R.id.community_action);updatePublishAvailability();
    }
    private void updatePublishAvailability(){if(publish==null||draft==null)return;boolean enabled=!busy&&!draft.getText().toString().trim().isEmpty();publish.setEnabled(enabled);publish.setTextColor(enabled?GREEN:MUTED);}
    private void chips() {
        for(int start=0;start<MATERIALS.length;start+=4){LinearLayout line=row();for(int i=start;i<Math.min(start+4,MATERIALS.length);i++){String material=MATERIALS[i];Button chip=button(material,()->{});chip.setBackgroundTintList(null);chip.setBackgroundResource(materials.contains(material)?R.drawable.bg_tab_active:R.drawable.community_chip);chip.setTextSize(11);chip.setTextColor(materials.contains(material)?Color.WHITE:INK);chip.setOnClickListener(v->{if(materials.contains(material))materials.remove(material);else materials.add(material);chip.setTextColor(materials.contains(material)?Color.WHITE:INK);chip.setBackgroundResource(materials.contains(material)?R.drawable.bg_tab_active:R.drawable.community_chip);});LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(0,dp(48),1);lp.setMargins(dp(2),dp(3),dp(2),dp(3));line.addView(chip,lp);}body.addView(line);}
    }
    private void photosForm() {
        label("📷 THÊM ẢNH · TỐI ĐA 5"); HorizontalScrollView horizontal=new HorizontalScrollView(requireContext());photoStrip=row();horizontal.addView(photoStrip);body.addView(horizontal);renderPickedPhotos();
    }
    private void renderPickedPhotos() {
        if(photoStrip==null)return;photoStrip.removeAllViews();Button add=button("＋\nTừ máy",()->{if(pictures.size()<5)photoPicker.launch("image/*");else message("Mỗi bài đăng tối đa 5 ảnh.");});add.setBackgroundResource(R.drawable.community_chip);add.setBackgroundTintList(null);add.setTextColor(GREEN);add.setEnabled(!busy&&createdEntityId.isEmpty());photoStrip.addView(add,new LinearLayout.LayoutParams(dp(84),dp(84)));
        for(Uri uri:new ArrayList<>(pictures)){LinearLayout preview=column();ImageView image=new ImageView(requireContext());image.setScaleType(ImageView.ScaleType.CENTER_CROP);image.setBackgroundResource(R.drawable.bg_photo_grid);image.setClipToOutline(true);image.setContentDescription("Ảnh đã chọn");preview.addView(image,new LinearLayout.LayoutParams(dp(80),dp(60)));Button remove=button("Bỏ ảnh",()->{pictures.remove(uri);renderPickedPhotos();});remove.setEnabled(!busy&&createdEntityId.isEmpty());preview.addView(remove,new LinearLayout.LayoutParams(dp(80),dp(48)));LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-2,-2);lp.leftMargin=dp(8);photoStrip.addView(preview,lp);int version=viewVersion;Context context=requireContext().getApplicationContext();images.execute(()->{try(InputStream stream=context.getContentResolver().openInputStream(uri)){byte[] bytes=readImage(stream);Bitmap bitmap=decode(bytes);main.post(()->{if(body!=null&&version==viewVersion)image.setImageBitmap(bitmap);});}catch(Exception ignored){}});}
    }
    private void publishPost() {
        if(busy||!signedIn())return;String value=draft.getText().toString().trim();if(value.isEmpty()){draft.setError("Hãy nhập nội dung bài đăng.");return;}Double kg=null;try{String raw=weight.getText().toString().trim();if(!raw.isEmpty()){kg=Double.valueOf(raw);if(!Double.isFinite(kg)||kg<0||kg>100000)throw new NumberFormatException();}}catch(NumberFormatException error){weight.setError("Nhập số kg hợp lệ.");return;}
        JSONArray tagValues=new JSONArray();for(String raw:tags.getText().toString().split(",")){String tag=raw.trim().replaceFirst("^#","");if(tag.length()>40){tags.setError("Mỗi tag tối đa 40 ký tự.");return;}if(!tag.isEmpty())tagValues.put(tag);}if(tagValues.length()>12){tags.setError("Tối đa 12 tags.");return;}
        JSONObject data=json("body",value,"materials",new JSONArray(materials),"weight_kg",kg==null?JSONObject.NULL:kg,"tags",tagValues);if(draftTitle!=null&&!draftTitle.getText().toString().trim().isEmpty())put(data,"title",draftTitle.getText().toString().trim());busy=true;publish.setEnabled(false);renderPickedPhotos();
        send(createdEntityId.isEmpty()?"POST":"PATCH",route()+(createdEntityId.isEmpty()?"":"/"+enc(createdEntityId)),data,createdEntityId.isEmpty()?createKey:null,post->{createdEntityId=post.optString("id",createdEntityId);renderPickedPhotos();uploadPictures("CONTENT",createdEntityId,uploadedPhotoCount,()->{clearPagedSnapshots();busy=false;go("TIP".equals(contentKind)?"tip_detail":"post_detail",createdEntityId,false);});});
    }
    private void uploadPictures(String kind,String id,int position,Runnable done){if(position>=pictures.size()){done.run();return;}upload(kind,id,pictures.get(position),()->{uploadedPhotoCount=position+1;uploadPictures(kind,id,position+1,done);});}
    private void upload(String kind,String id,Uri uri,Runnable done) {
        int version=viewVersion;Context context=requireContext().getApplicationContext();boolean compact=api.isSparkLocal();images.execute(()->{try(InputStream stream=context.getContentResolver().openInputStream(uri)){byte[] original=readImage(stream);String detected=context.getContentResolver().getType(uri);String mime=detected==null?"image/jpeg":detected;if(!mime.matches("image/(jpeg|png|webp)"))throw new IllegalArgumentException("Chọn ảnh JPEG, PNG hoặc WebP.");PhotoUploadEncoder.Photo photo=compact?PhotoUploadEncoder.forFirestore(original):null;byte[] bytes=photo==null?original:photo.bytes;String contentType=photo==null?mime:photo.mime;main.post(()->{if(body==null||version!=viewVersion)return;api.uploadMedia(kind,id,contentType,bytes,callback(result->done.run()));});}catch(Exception e){main.post(()->{if(body!=null&&version==viewVersion){busy=false;if(publish!=null)publish.setEnabled(true);message("Nội dung đã được lưu, nhưng ảnh chưa tải lên: "+e.getMessage());}});}});
    }
    private static byte[] readImage(InputStream stream)throws Exception{if(stream==null)throw new IllegalArgumentException("Không đọc được ảnh.");try(ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] buffer=new byte[8192];int n,total=0;while((n=stream.read(buffer))!=-1){total+=n;if(total>10*1024*1024)throw new IllegalArgumentException("Ảnh gốc cần nhỏ hơn 10 MB.");out.write(buffer,0,n);}if(total==0)throw new IllegalArgumentException("Ảnh trống.");return out.toByteArray();}}
    private static void put(JSONObject target,String key,Object value){try{target.put(key,value);}catch(JSONException e){throw new IllegalArgumentException(e);}}
    private static TextWatcher watcher(Runnable changed){return new TextWatcher(){public void beforeTextChanged(CharSequence s,int start,int count,int after){}public void onTextChanged(CharSequence s,int start,int before,int count){changed.run();}public void afterTextChanged(Editable e){}};}

    private void detail() {
        replyTargetId = "";
        header("TIP".equals(contentKind)?"Mẹo hay":"Bài đăng",true);body.removeAllViews();if(entityId==null||entityId.isEmpty()){empty(body,"Không tìm thấy bài đăng.");return;}TextView wait=loading(body);
        get(route()+"/"+enc(entityId),post->{body.removeView(wait);displayedDetail=post;lastDetailRefreshAt=SystemClock.elapsedRealtime();postCard(body,post,true);TextView heading=label(post.optInt("comment_count")+" BÌNH LUẬN");heading.setTag("comment-section-count");LinearLayout comments=column();body.addView(comments);loadComments(comments,null);if(api.isSignedIn())commentFooter(comments);else footer.setVisibility(View.GONE);});
    }
    private void refreshDetail() {
        if (displayedDetail == null || detailRefreshInFlight || entityId == null || entityId.isEmpty()
                || SystemClock.elapsedRealtime() - lastDetailRefreshAt < LIVE_REFRESH_INTERVAL_MS) return;
        detailRefreshInFlight = true;
        lastDetailRefreshAt = SystemClock.elapsedRealtime();
        int version = viewVersion;
        String id = entityId;
        FirebaseBackendClient.Callback<JSONObject> callback = new FirebaseBackendClient.Callback<JSONObject>() {
            @Override public void onSuccess(JSONObject post) {
                detailRefreshInFlight = false;
                if (body == null || version != viewVersion || !id.equals(entityId) || !isAdded()) return;
                if (displayedDetail != null && displayedDetail.toString().equals(post.toString())) return;
                View oldCard = body.findViewWithTag("post:" + id);
                if (oldCard == null || oldCard.getParent() != body) return;
                LinearLayout holder = column();
                postCard(holder, post, true);
                View updatedCard = holder.getChildAt(0);
                holder.removeView(updatedCard);
                int index = body.indexOfChild(oldCard);
                body.removeViewAt(index);
                body.addView(updatedCard, index);
                displayedDetail = post;
            }
            @Override public void onError(FirebaseBackendClient.BackendException error) {
                detailRefreshInFlight = false;
            }
        };
        String path = route() + "/" + enc(id);
        if (api.isSignedIn()) api.requestFresh(path, callback);
        else api.getPublic(path, callback);
    }
    private void loadComments(LinearLayout comments,String cursor){TextView wait=loading(comments);get(route()+"/"+enc(entityId)+"/comments"+(cursor==null?"":"?cursor="+enc(cursor)),result->{comments.removeView(wait);JSONArray entries=result.optJSONArray("items");if((entries==null||entries.length()==0)&&cursor==null)empty(comments,"Chưa có bình luận. Hãy bắt đầu cuộc trò chuyện.");if(entries!=null)for(int i=0;i<entries.length();i++){JSONObject comment=entries.optJSONObject(i);if(comment!=null)commentCard(comments,comment);}String next=result.optString("next_cursor","");if(!next.isEmpty()&&!"null".equals(next)){Button more=button("Xem thêm bình luận",()->{});more.setOnClickListener(v->{comments.removeView(more);loadComments(comments,next);});comments.addView(more);}if(focusComments){focusComments=false;scroll.post(()->{if(scroll!=null)scroll.smoothScrollTo(0,comments.getTop());});EditText entry=root.findViewById(R.id.community_comment);if(entry!=null)entry.requestFocus();}});}
    private void commentCard(LinearLayout parent,JSONObject comment){
        boolean reply=!comment.isNull("parent_comment_id")&&!comment.optString("parent_comment_id","").isEmpty();
        JSONObject author=comment.optJSONObject("author");String name=author==null?"Thành viên":author.optString("display_name","Thành viên");
        LinearLayout item=column();LinearLayout.LayoutParams itemLp=new LinearLayout.LayoutParams(-1,-2);itemLp.bottomMargin=dp(10);if(reply)itemLp.leftMargin=dp(24);parent.addView(item,itemLp);
        LinearLayout line=row();line.setGravity(Gravity.CENTER_VERTICAL);item.addView(line);
        avatar(line,name,author==null?"":author.optString("avatar_key",""),36);
        LinearLayout bubble=column();bubble.setPadding(dp(13),dp(9),dp(13),dp(10));bubble.setBackgroundResource(R.drawable.community_card);
        LinearLayout.LayoutParams bubbleLp=new LinearLayout.LayoutParams(0,-2,1);bubbleLp.leftMargin=dp(8);line.addView(bubble,bubbleLp);
        bubble.addView(text(name,13,INK,true));TextView message=text(comment.optString("body"),14,INK,false);message.setPadding(0,dp(3),0,0);bubble.addView(message);
        LinearLayout controls=row();controls.setPadding(dp(44),dp(2),0,0);item.addView(controls);
        TextView time=text(relativeTime(comment.optString("created_at")),11,MUTED,false);time.setGravity(Gravity.CENTER_VERTICAL);controls.addView(time);
        if(api.isSignedIn()){
            TextView like=text(commentLikeLabel(comment),11,comment.optBoolean("liked")?GREEN:MUTED,comment.optBoolean("liked"));
            like.setTag("comment-like:"+comment.optString("id"));like.setGravity(Gravity.CENTER_VERTICAL);like.setMinHeight(dp(32));like.setPadding(dp(12),0,dp(8),0);
            like.setOnClickListener(v->likeComment(comment,like));controls.addView(like);
            if(!reply){TextView respond=text("Trả lời",11,MUTED,false);respond.setGravity(Gravity.CENTER_VERTICAL);respond.setMinHeight(dp(32));respond.setPadding(dp(8),0,dp(8),0);respond.setOnClickListener(v->{replyTargetId=comment.optString("id","");EditText input=root==null?null:root.findViewById(R.id.community_comment);if(input!=null){input.setHint("Trả lời "+name+"…");input.requestFocus();((InputMethodManager)requireContext().getSystemService(Context.INPUT_METHOD_SERVICE)).showSoftInput(input,InputMethodManager.SHOW_IMPLICIT);}});controls.addView(respond);}
        }
    }
    private String commentLikeLabel(JSONObject comment){int count=comment.optInt("like_count");return count>0?"Thích ("+count+")":"Thích";}
    private void likeComment(JSONObject comment,TextView control){
        if(!signedIn()||!control.isEnabled())return;
        boolean active=!comment.optBoolean("liked");control.setEnabled(false);int version=viewVersion;
        api.request("PUT",route()+"/"+enc(entityId)+"/comments/"+enc(comment.optString("id"))+"/reactions/LIKE",json("active",active),null,new FirebaseBackendClient.Callback<JSONObject>(){
            public void onSuccess(JSONObject result){if(body==null||version!=viewVersion)return;control.setEnabled(true);put(comment,"liked",result.optBoolean("active"));put(comment,"like_count",result.optInt("like_count"));control.setText(commentLikeLabel(comment));control.setTextColor(comment.optBoolean("liked")?GREEN:MUTED);control.setTypeface(null,comment.optBoolean("liked")?Typeface.BOLD:Typeface.NORMAL);}
            public void onError(FirebaseBackendClient.BackendException error){if(body==null||version!=viewVersion)return;control.setEnabled(true);message(error.getMessage());}
        });
    }
    private static String relativeTime(String iso){
        try{java.text.SimpleDateFormat format=new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",Locale.US);format.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));java.util.Date parsed=format.parse(iso);if(parsed==null)return date(iso);long minutes=Math.max(0,(System.currentTimeMillis()-parsed.getTime())/60000);if(minutes<1)return "Vừa xong";if(minutes<60)return minutes+" phút trước";long hours=minutes/60;if(hours<24)return hours+" giờ trước";long days=hours/24;if(days<7)return days+" ngày trước";}catch(Exception ignored){}return date(iso);
    }
    private void commentFooter(LinearLayout comments){
        footer.removeAllViews();footer.setVisibility(View.VISIBLE);footer.setPadding(dp(12),dp(8),dp(12),dp(8));footer.setBackgroundColor(Color.WHITE);
        JSONObject profile=BackendSession.profile();String name=profile==null?"Bạn":profile.optString("display_name","Bạn");
        avatar(footer,name,profile==null?"":profile.optString("avatar_key",""),34);
        EditText entry=input(replyTargetId.isEmpty()?"Viết bình luận…":"Trả lời bình luận…",2000,R.id.community_comment);entry.setMaxLines(4);entry.setMinHeight(dp(46));entry.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_FLAG_MULTI_LINE|InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);entry.setBackgroundResource(R.drawable.bg_chat_input);
        LinearLayout.LayoutParams entryLp=new LinearLayout.LayoutParams(0,-2,1);entryLp.leftMargin=dp(8);entryLp.rightMargin=dp(8);footer.addView(entry,entryLp);
        ImageButton send=new ImageButton(requireContext());send.setId(R.id.community_submit);send.setContentDescription("Gửi bình luận");send.setScaleType(ImageView.ScaleType.CENTER_INSIDE);send.setPadding(dp(10),dp(10),dp(10),dp(10));send.setImageResource(R.drawable.ic_send);send.setBackgroundResource(R.drawable.bg_comment_send);
        send.setBackgroundTintList(null);
        send.setEnabled(false);entry.addTextChangedListener(watcher(()->send.setEnabled(!entry.getText().toString().trim().isEmpty()&&!busy)));footer.addView(send,new LinearLayout.LayoutParams(dp(44),dp(44)));
        send.setOnClickListener(v->{if(!signedIn()||busy)return;String value=entry.getText().toString().trim();if(value.isEmpty())return;busy=true;send.setEnabled(false);JSONObject previous=entry.getTag() instanceof JSONObject?(JSONObject)entry.getTag():new JSONObject();String key=value.equals(previous.optString("body"))?previous.optString("key",UUID.randomUUID().toString()):UUID.randomUUID().toString();entry.setTag(json("key",key,"body",value));JSONObject payload=json("body",value);if(!replyTargetId.isEmpty())put(payload,"parent_comment_id",replyTargetId);api.request("POST",route()+"/"+enc(entityId)+"/comments",payload,key,new FirebaseBackendClient.Callback<JSONObject>(){final int version=viewVersion;public void onSuccess(JSONObject comment){if(body==null||version!=viewVersion)return;busy=false;entry.setText("");entry.setTag(null);entry.setHint("Viết bình luận…");replyTargetId="";incrementCommentCount();clearPagedSnapshots();if(comments.getChildCount()==1&&comments.getChildAt(0) instanceof TextView)comments.removeAllViews();commentCard(comments,comment);scroll.post(()->{if(scroll!=null)scroll.fullScroll(View.FOCUS_DOWN);});}public void onError(FirebaseBackendClient.BackendException e){if(body!=null&&version==viewVersion){busy=false;send.setEnabled(true);message(e.getMessage());}}});});
    }

    private void conversations() {
        deactivatePage();
        header("Tin nhắn", true);
        body.removeAllViews();
        body.setPadding(0, 0, 0, dp(24));
        footer.setVisibility(View.GONE);
        if (!signedIn()) return;
        root.findViewById(R.id.community_back).setVisibility(View.GONE);
        root.findViewById(R.id.message_header_icon).setVisibility(View.VISIBLE);
        action("", () -> go("friends", null, false));
        TextView compose = root.findViewById(R.id.community_action);
        compose.setContentDescription("Tạo cuộc trò chuyện");
        compose.setBackgroundResource(R.drawable.community_pill);
        compose.setCompoundDrawablesWithIntrinsicBounds(0, 0, 0, 0);
        compose.setForeground(requireContext().getDrawable(R.drawable.ic_compose));
        compose.setForegroundGravity(Gravity.CENTER);
        LinearLayout list = column();
        list.setId(R.id.community_conversations);
        EditText search = messageSearch(false);
        body.addView(list);
        TextView noResults = messageSearchEmpty(false);
        showPaged(list, "/conversations", "Chưa có cuộc trò chuyện. Mở Bạn bè để bắt đầu nhắn tin.",
                conversation -> {
                    conversationCard(list, conversation);
                    filterMessageRows(list, search.getText().toString(), noResults);
                });
        search.addTextChangedListener(watcher(() -> filterMessageRows(list, search.getText().toString(), noResults)));
    }

    private EditText messageSearch(boolean requests) {
        LinearLayout panel = column();
        panel.setPadding(dp(16), dp(16), dp(16), dp(12));
        panel.setBackgroundResource(R.color.community_mint);
        body.addView(panel);
        EditText search = input(requests ? "Tìm tin nhắn chờ..." : "Tìm kiếm tin nhắn...", 100, R.id.community_search);
        stylePrimarySearch(search);
        panel.addView(search);
        if (!requests) {
            TextView pending = text("Tin nhắn chờ", 13, GREEN, true);
            pending.setGravity(Gravity.CENTER_VERTICAL | Gravity.START);
            pending.setMinHeight(dp(48));
            pending.setPadding(dp(16), dp(8), dp(16), dp(8));
            pending.setCompoundDrawablePadding(dp(10));
            pending.setCompoundDrawablesWithIntrinsicBounds(R.drawable.ic_nav_messages, 0, R.drawable.ic_chevron_right, 0);
            pending.setBackgroundResource(R.drawable.community_card);
            pending.setClickable(true);
            pending.setFocusable(true);
            pending.setOnClickListener(v -> go("message_requests", null, false));
            LinearLayout.LayoutParams pendingParams = new LinearLayout.LayoutParams(-1, -2);
            pendingParams.topMargin = dp(12);
            panel.addView(pending, pendingParams);
        }
        return search;
    }

    private TextView messageSearchEmpty(boolean requests) {
        TextView notice = text(requests ? "Không tìm thấy trong các tin nhắn chờ đã tải."
                : "Không tìm thấy trong các cuộc trò chuyện đã tải.", 13, MUTED, false);
        notice.setPadding(dp(18), dp(20), dp(18), dp(20));
        notice.setGravity(Gravity.CENTER);
        notice.setBackgroundResource(R.drawable.community_card);
        notice.setVisibility(View.GONE);
        LinearLayout.LayoutParams noticeParams = new LinearLayout.LayoutParams(-1, -2);
        noticeParams.setMargins(dp(16), dp(8), dp(16), dp(8));
        body.addView(notice, noticeParams);
        return notice;
    }

    private void filterMessageRows(LinearLayout list, String query, TextView noResults) {
        String needle = query.trim().toLowerCase(Locale.forLanguageTag("vi-VN"));
        int rows = 0, matches = 0;
        for (int i = 0; i < list.getChildCount(); i++) {
            View child = list.getChildAt(i);
            if ("message_recent".equals(child.getTag())) {
                child.setVisibility(needle.isEmpty() ? View.VISIBLE : View.GONE);
            } else if ("message_row".equals(child.getTag())) {
                rows++;
                String haystack = String.valueOf(child.getTag(R.id.community_search));
                boolean match = needle.isEmpty() || haystack.contains(needle);
                child.setVisibility(match ? View.VISIBLE : View.GONE);
                if (match) matches++;
            }
        }
        noResults.setVisibility(!needle.isEmpty() && rows > 0 && matches == 0 ? View.VISIBLE : View.GONE);
    }

    private void recentMessageContact(LinearLayout list, JSONObject partner, String conversationId) {
        if (partner == null || partner.optString("id", "").isEmpty()) return;
        LinearLayout recent = list.findViewWithTag("message_recent");
        if (recent == null) {
            recent = column();
            recent.setTag("message_recent");
            recent.setPadding(dp(16), dp(12), dp(16), dp(10));
            recent.setBackgroundResource(R.drawable.community_card);
            recent.addView(text("LIÊN HỆ GẦN ĐÂY", 11, MUTED, true));
            HorizontalScrollView scroller = new HorizontalScrollView(requireContext());
            scroller.setHorizontalScrollBarEnabled(false);
            LinearLayout.LayoutParams scrollParams = new LinearLayout.LayoutParams(-1, dp(84));
            scrollParams.topMargin = dp(8);
            recent.addView(scroller, scrollParams);
            LinearLayout people = row();
            people.setTag("message_recent_people");
            scroller.addView(people);
            LinearLayout.LayoutParams recentParams = new LinearLayout.LayoutParams(-1, -2);
            recentParams.setMargins(dp(16), dp(4), dp(16), dp(8));
            list.addView(recent, 0, recentParams);
        }
        LinearLayout people = recent.findViewWithTag("message_recent_people");
        String partnerId = partner.optString("id");
        if (people == null || people.findViewWithTag("recent:" + partnerId) != null || people.getChildCount() >= 8) return;
        String fullName = partner.optString("display_name", "Thành viên");
        String[] words = fullName.trim().split("\\s+");
        LinearLayout person = column();
        person.setTag("recent:" + partnerId);
        person.setGravity(Gravity.CENTER_HORIZONTAL);
        avatar(person, fullName, partner.optString("avatar_key", ""), 46);
        String shortName = words.length == 0 || words[words.length - 1].matches("\\d+")
                ? fullName : words[words.length - 1];
        TextView label = text(shortName, 11, INK, false);
        label.setSingleLine(true);
        label.setEllipsize(android.text.TextUtils.TruncateAt.END);
        label.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams labelParams = new LinearLayout.LayoutParams(-1, -2);
        labelParams.topMargin = dp(4);
        person.addView(label, labelParams);
        person.setClickable(true);
        person.setFocusable(true);
        person.setContentDescription("Trò chuyện với " + fullName);
        person.setOnClickListener(v -> go("chat", conversationId, false));
        LinearLayout.LayoutParams personParams = new LinearLayout.LayoutParams(dp(62), dp(78));
        personParams.rightMargin = dp(10);
        people.addView(person, personParams);
    }

    private LinearLayout messageRow(LinearLayout parent, String name, String avatarId, String preview,
                                    String updatedAt) {
        LinearLayout item = column();
        item.setTag("message_row");
        item.setTag(R.id.community_search, (name + " " + preview).toLowerCase(Locale.forLanguageTag("vi-VN")));
        item.setPadding(dp(16), dp(12), dp(16), dp(12));
        item.setBackgroundResource(R.drawable.community_card);
        LinearLayout.LayoutParams itemParams = new LinearLayout.LayoutParams(-1, -2);
        itemParams.setMargins(dp(16), dp(6), dp(16), dp(6));
        parent.addView(item, itemParams);
        LinearLayout line = row();
        line.setMinimumHeight(dp(62));
        item.addView(line);
        avatar(line, name, avatarId, 50);
        LinearLayout copy = column();
        copy.setPadding(dp(12), 0, dp(8), 0);
        LinearLayout nameLine = row();
        TextView title = text(name, 14, INK, true);
        title.setSingleLine(true);
        title.setEllipsize(android.text.TextUtils.TruncateAt.END);
        nameLine.addView(title, new LinearLayout.LayoutParams(0, -2, 1));
        TextView time = text(updatedAt.isEmpty() ? "" : relativeTime(updatedAt), 10, MUTED, false);
        time.setSingleLine(true);
        nameLine.addView(time);
        copy.addView(nameLine);
        TextView summary = text(preview, 12, MUTED, false);
        summary.setSingleLine(true);
        summary.setEllipsize(android.text.TextUtils.TruncateAt.END);
        LinearLayout.LayoutParams summaryParams = new LinearLayout.LayoutParams(-1, -2);
        summaryParams.topMargin = dp(4);
        copy.addView(summary, summaryParams);
        line.addView(copy, new LinearLayout.LayoutParams(0, -2, 1));
        return item;
    }

    private void conversationCard(LinearLayout parent, JSONObject conversation) {
        String conversationId = conversation.optString("id", "");
        FirebaseBackendClient.SessionInfo session = api.currentSession();
        String self = session == null ? "" : session.uid;
        String otherId = self.equals(conversation.optString("member_a_id"))
                ? conversation.optString("member_b_id") : conversation.optString("member_a_id");
        String preview = conversation.isNull("last_message") ? "" : conversation.optString("last_message", "");
        JSONObject partner = conversation.optJSONObject("partner");
        String name = partner == null ? "Thành viên EcoShare" : partner.optString("display_name", "Thành viên EcoShare");
        String avatarId = partner == null ? "" : partner.optString("avatar_key", "");
        String updated = conversation.optString("updated_at", conversation.optString("created_at", ""));
        recentMessageContact(parent, partner, conversationId);
        LinearLayout item = messageRow(parent, name, avatarId,
                preview.isEmpty() ? "Chạm để bắt đầu trò chuyện" : preview, updated);
        item.setClickable(true);
        item.setFocusable(true);
        item.setOnClickListener(v -> go("chat", conversationId, false));
        if (partner == null) loadPartnerName(otherId, value -> {
            if (item.getParent() != null) {
                LinearLayout line = (LinearLayout) item.getChildAt(0);
                LinearLayout copy = (LinearLayout) line.getChildAt(1);
                LinearLayout nameLine = (LinearLayout) copy.getChildAt(0);
                ((TextView) nameLine.getChildAt(0)).setText(value);
                item.setTag(R.id.community_search, (value + " " + preview).toLowerCase(Locale.forLanguageTag("vi-VN")));
            }
        });
    }

    private void messageRequests() {
        deactivatePage(); header("Tin nhắn chờ", true); body.removeAllViews();
        body.setPadding(0, 0, 0, dp(24));
        if (!signedIn()) return;
        LinearLayout list = column();
        EditText search = messageSearch(true);
        body.addView(list);
        TextView noResults = messageSearchEmpty(true);
        showPaged(list, "/message-requests", "Không có tin nhắn chờ.", request -> {
            JSONObject sender = request.optJSONObject("sender");
            String senderId = sender == null ? "" : sender.optString("id", "");
            String name = sender == null ? "Thành viên" : sender.optString("display_name", "Thành viên");
            String preview = request.optString("last_message", "");
            LinearLayout item = messageRow(list, name, sender == null ? "" : sender.optString("avatar_key", ""),
                    preview.isEmpty() ? "Muốn bắt đầu trò chuyện với bạn" : preview,
                    request.optString("updated_at", request.optString("created_at", "")));
            LinearLayout line = (LinearLayout) item.getChildAt(0);
            line.setClickable(true);
            line.setFocusable(true);
            line.setOnClickListener(v -> { if (!senderId.isEmpty()) go("user_profile", senderId, false); });
            LinearLayout actions = row();
            actions.setPadding(dp(62), dp(7), 0, dp(9));
            Button accept = button("Chấp nhận", () -> respondMessageRequest(request, true));
            accept.setTextColor(Color.WHITE);
            accept.setBackgroundResource(R.drawable.bg_order_payment);
            actions.addView(accept, new LinearLayout.LayoutParams(0, dp(42), 1));
            Button decline = button("Từ chối", () -> respondMessageRequest(request, false));
            LinearLayout.LayoutParams declineParams = new LinearLayout.LayoutParams(0, dp(42), 1);
            declineParams.leftMargin = dp(8);
            actions.addView(decline, declineParams);
            item.addView(actions);
            filterMessageRows(list, search.getText().toString(), noResults);
        });
        search.addTextChangedListener(watcher(() -> filterMessageRows(list, search.getText().toString(), noResults)));
    }

    private void respondMessageRequest(JSONObject request, boolean accept) {
        send("POST", "/message-requests/" + enc(request.optString("id")) + "/respond", json("accept", accept), null, result -> {
            if (accept) go("chat", request.optString("id"), false); else messageRequests();
        });
    }

    private void userProfile() {
        deactivatePage();
        header("Hồ sơ thành viên", true);
        body.removeAllViews();
        body.setPadding(0, 0, 0, dp(24));
        if (entityId == null || entityId.isEmpty()) return;
        String userId = entityId;
        if (!userId.equals(memberProfileUserId)) {
            memberProfileUserId = userId;
            memberProfileTab = "posts";
        }
        TextView wait = loading(body);
        wait.setBackgroundResource(R.drawable.bg_card);
        wait.setGravity(Gravity.CENTER);
        wait.setMinHeight(dp(120));
        LinearLayout.LayoutParams waitParams = (LinearLayout.LayoutParams) wait.getLayoutParams();
        waitParams.setMargins(dp(14), dp(14), dp(14), 0);
        wait.setLayoutParams(waitParams);
        get("/users/" + enc(userId), user -> {
            if (body == null) return;
            body.removeView(wait);
            String name = user.optString("display_name", "Thành viên EcoShare");
            if (name.trim().isEmpty()) name = "Thành viên EcoShare";

            FrameLayout cover = new FrameLayout(requireContext());
            ImageView coverPhoto = new ImageView(requireContext());
            coverPhoto.setScaleType(ImageView.ScaleType.CENTER_CROP);
            coverPhoto.setImageResource(R.drawable.img_cover_plants);
            cover.addView(coverPhoto, new FrameLayout.LayoutParams(-1, -1));
            String coverKey = user.optString("cover_key", "");
            if (!coverKey.isEmpty() && !"null".equals(coverKey)) loadImage(coverPhoto, coverKey, dp(640));
            View coverShade = new View(requireContext());
            coverShade.setBackground(new GradientDrawable(GradientDrawable.Orientation.BOTTOM_TOP,
                    new int[]{0x660B3323, 0x000B3323}));
            cover.addView(coverShade, new FrameLayout.LayoutParams(-1, -1));
            body.addView(cover, new LinearLayout.LayoutParams(-1, dp(148)));

            LinearLayout summary = column();
            summary.setBackgroundResource(R.drawable.bg_card);
            summary.setElevation(dp(3));
            summary.setPadding(dp(16), dp(17), dp(16), dp(16));
            LinearLayout.LayoutParams summaryParams = new LinearLayout.LayoutParams(-1, -2);
            summaryParams.setMargins(dp(14), -dp(28), dp(14), 0);
            body.addView(summary, summaryParams);

            LinearLayout identity = row();
            LinearLayout avatarHolder = column();
            avatarHolder.setPadding(dp(2), dp(2), dp(2), dp(2));
            avatarHolder.setBackgroundResource(R.drawable.bg_card);
            avatarHolder.setElevation(dp(2));
            avatar(avatarHolder, name, user.optString("avatar_key", ""), 72);
            identity.addView(avatarHolder);
            LinearLayout identityText = column();
            identityText.setPadding(dp(13), 0, 0, 0);
            identityText.addView(text(name, 20, INK, true));
            TextView badge = text(user.optBoolean("verified") ? "✓ Đã xác minh" : "Thành viên EcoShare",
                    11, user.optBoolean("verified") ? GREEN : MUTED, true);
            badge.setPadding(dp(10), dp(3), dp(10), dp(3));
            badge.setBackgroundResource(user.optBoolean("verified") ? R.drawable.bg_badge_verified : R.drawable.bg_profile_stat);
            LinearLayout.LayoutParams badgeParams = new LinearLayout.LayoutParams(-2, -2);
            badgeParams.topMargin = dp(5);
            identityText.addView(badge, badgeParams);
            identity.addView(identityText, new LinearLayout.LayoutParams(0, -2, 1));
            summary.addView(identity);

            String bio = user.optString("bio", "").trim();
            if (!bio.isEmpty() && !"null".equals(bio)) {
                TextView bioText = text(bio, 14, INK, false);
                LinearLayout.LayoutParams bioParams = new LinearLayout.LayoutParams(-1, -2);
                bioParams.topMargin = dp(15);
                summary.addView(bioText, bioParams);
            }
            String city = user.optString("city", "").trim();
            String joined = date(user.optString("created_at", ""));
            String meta = (!city.isEmpty() && !"null".equals(city) ? "📍 " + city : "")
                    + (!joined.isEmpty() ? (!city.isEmpty() && !"null".equals(city) ? "   ·   " : "") + "Tham gia " + joined : "");
            if (!meta.isEmpty()) {
                TextView metaText = text(meta, 12, MUTED, false);
                LinearLayout.LayoutParams metaParams = new LinearLayout.LayoutParams(-1, -2);
                metaParams.topMargin = dp(12);
                summary.addView(metaText, metaParams);
            }

            View divider = new View(requireContext());
            divider.setBackgroundColor(0xFFE6F1E9);
            LinearLayout.LayoutParams dividerParams = new LinearLayout.LayoutParams(-1, dp(1));
            dividerParams.topMargin = dp(16);
            dividerParams.bottomMargin = dp(14);
            summary.addView(divider, dividerParams);

            if (userId.equals(BackendSession.profile().optString("id"))) {
                Button edit = button("Chỉnh sửa hồ sơ", () -> go("edit_profile", null, false));
                edit.setBackgroundResource(R.drawable.bg_primary_button);
                edit.setBackgroundTintList(null);
                edit.setTextColor(Color.WHITE);
                edit.setTypeface(null, Typeface.BOLD);
                edit.setClipToOutline(true);
                summary.addView(edit, new LinearLayout.LayoutParams(-1, dp(48)));
            } else {
                LinearLayout actions = row();
                Button friend = button("Đang kiểm tra…", () -> {});
                friend.setEnabled(false);
                friend.setTextSize(12);
                friend.setTypeface(null, Typeface.BOLD);
                friend.setBackgroundResource(R.drawable.bg_primary_button);
                friend.setBackgroundTintList(null);
                friend.setTextColor(Color.WHITE);
                friend.setClipToOutline(true);
                actions.addView(friend, new LinearLayout.LayoutParams(0, dp(48), 1));
                Button chat = button("Nhắn tin", () -> startConversation(userId));
                chat.setTextSize(12);
                chat.setTypeface(null, Typeface.BOLD);
                chat.setBackgroundResource(R.drawable.bg_profile_action_outline);
                chat.setBackgroundTintList(null);
                chat.setClipToOutline(true);
                LinearLayout.LayoutParams chatParams = new LinearLayout.LayoutParams(0, dp(48), 1);
                chatParams.leftMargin = dp(9);
                actions.addView(chat, chatParams);
                summary.addView(actions);
                get("/friends/relationship/" + enc(userId), relation -> {
                    String status = relation.optString("status", "NONE");
                    boolean canAct = !"ACCEPTED".equals(status) && (!"PENDING".equals(status) || !relation.optBoolean("is_sender"));
                    friend.setEnabled(canAct);
                    friend.setBackgroundResource(canAct ? R.drawable.bg_primary_button : R.drawable.bg_secondary_button);
                    friend.setTextColor(canAct ? Color.WHITE : GREEN);
                    if ("ACCEPTED".equals(status)) friend.setText("✓ Bạn bè");
                    else if ("PENDING".equals(status) && relation.optBoolean("is_sender")) friend.setText("Đã gửi lời mời");
                    else if ("PENDING".equals(status)) {
                        friend.setText("Chấp nhận lời mời");
                        friend.setOnClickListener(v -> send("POST", "/friends/requests/" + enc(relation.optString("request_id")) + "/respond", json("accept", true), null, ignored -> userProfile()));
                    } else {
                        friend.setText("Kết bạn");
                        friend.setOnClickListener(v -> send("POST", "/friends/requests", json("user_id", userId), null, ignored -> userProfile()));
                    }
                });
            }

            LinearLayout tabs = row();
            tabs.setBackgroundResource(R.drawable.bg_card);
            tabs.setElevation(dp(2));
            tabs.setPadding(dp(4), dp(4), dp(4), dp(4));
            LinearLayout.LayoutParams tabsParams = new LinearLayout.LayoutParams(-1, -2);
            tabsParams.setMargins(dp(14), dp(14), dp(14), dp(12));
            body.addView(tabs, tabsParams);
            Button postsTab = button("📝 Bài chia sẻ", () -> {});
            Button tipsTab = button("💡 Mẹo hay", () -> {});
            postsTab.setElevation(0);
            tipsTab.setElevation(0);
            tabs.addView(postsTab, new LinearLayout.LayoutParams(0, dp(42), 1));
            tabs.addView(tipsTab, new LinearLayout.LayoutParams(0, dp(42), 1));
            LinearLayout results = column();
            results.setTag("member_profile_content");
            body.addView(results);
            Runnable selectTab = () -> {
                boolean postsSelected = "posts".equals(memberProfileTab);
                postsTab.setBackgroundResource(postsSelected ? R.drawable.bg_tab_active : R.drawable.bg_tab_inactive);
                tipsTab.setBackgroundResource(postsSelected ? R.drawable.bg_tab_inactive : R.drawable.bg_tab_active);
                postsTab.setTextColor(postsSelected ? Color.WHITE : MUTED);
                tipsTab.setTextColor(postsSelected ? MUTED : Color.WHITE);
                postsTab.setTypeface(null, postsSelected ? Typeface.BOLD : Typeface.NORMAL);
                tipsTab.setTypeface(null, postsSelected ? Typeface.NORMAL : Typeface.BOLD);
                deactivatePage();
                results.removeAllViews();
                String path = postsSelected ? "/posts?author_id=" : "/tips?author_id=";
                showPaged(results, path + enc(userId), postsSelected ? "Chưa có bài chia sẻ." : "Chưa có mẹo hay.",
                        item -> profilePostCard(results, item));
            };
            postsTab.setOnClickListener(v -> { if (!"posts".equals(memberProfileTab)) { memberProfileTab = "posts"; selectTab.run(); } });
            tipsTab.setOnClickListener(v -> { if (!"tips".equals(memberProfileTab)) { memberProfileTab = "tips"; selectTab.run(); } });
            selectTab.run();
        });
    }

    private void conversationDetail() {
        deactivatePage();
        chatReady = false;
        chatPartnerName = "Thành viên EcoShare";
        chatIncomingAvatars.clear();
        header("Trò chuyện", true);
        body.removeAllViews();
        body.setGravity(Gravity.BOTTOM);
        footer.removeAllViews();
        if (!signedIn() || entityId == null || entityId.isEmpty()) {
            empty(body, "Không tìm thấy cuộc trò chuyện.");
            return;
        }
        LinearLayout headerAvatar = root.findViewById(R.id.chat_header_avatar);
        headerAvatar.removeAllViews();
        avatar(headerAvatar, chatPartnerName, "", 40);
        headerAvatar.getChildAt(0).setBackgroundResource(R.drawable.bg_chat_avatar);
        chatMessages = column();
        chatMessages.setId(R.id.community_chat_messages);
        body.addView(chatMessages);
        chatInput = input("Nhắn tin…", 2000, R.id.community_chat_input);
        chatInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE
                | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        chatInput.setMaxLines(4);
        chatInput.setMinHeight(dp(46));
        chatInput.setBackgroundResource(R.drawable.bg_chat_input);
        chatInput.setPadding(dp(14), dp(10), dp(14), dp(10));
        chatInput.setText(chatDraft);
        footer.setPadding(dp(12), dp(8), dp(12), dp(8));
        ImageButton attach = new ImageButton(requireContext());
        attach.setContentDescription("Đính kèm ảnh, bài viết hoặc mẹo hay");
        attach.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
        attach.setImageResource(R.drawable.ic_clip);
        attach.setBackgroundResource(R.drawable.bg_chat_action);
        attach.setPadding(dp(9), dp(9), dp(9), dp(9));
        LinearLayout.LayoutParams attachParams = new LinearLayout.LayoutParams(dp(40), dp(40));
        attachParams.rightMargin = dp(8);
        footer.addView(attach, attachParams);
        attach.setOnClickListener(v -> chooseChatAttachment());
        LinearLayout.LayoutParams inputParams = new LinearLayout.LayoutParams(0, -2, 1);
        inputParams.rightMargin = dp(8);
        footer.addView(chatInput, inputParams);
        Button sendButton = button("", () -> {});
        sendButton.setId(R.id.community_chat_send);
        sendButton.setContentDescription("Gửi tin nhắn");
        sendButton.setBackgroundResource(R.drawable.bg_comment_send);
        sendButton.setBackgroundTintList(null);
        sendButton.setForeground(requireContext().getDrawable(R.drawable.ic_send));
        sendButton.setForegroundGravity(Gravity.CENTER);
        sendButton.setPadding(0, 0, 0, 0);
        sendButton.setEnabled(false);
        chatInput.addTextChangedListener(watcher(() -> sendButton.setEnabled(
                chatReady && !busy && !chatInput.getText().toString().trim().isEmpty())));
        footer.addView(sendButton, new LinearLayout.LayoutParams(dp(46), dp(46)));
        footer.setVisibility(View.VISIBLE);
        sendButton.setOnClickListener(v -> sendChatMessage(sendButton));
        LinearLayout suggestions = root.findViewById(R.id.chat_quick_reply_row);
        suggestions.removeAllViews();
        for (String reply : new String[]{"👍 Hay quá!", "♻️ Mình cũng thích!", "🌿 Cảm ơn bạn!", "📸 Cho mình xem nhé"}) {
            TextView chip = text(reply, 12, GREEN, false);
            chip.setGravity(Gravity.CENTER);
            chip.setMinHeight(dp(34));
            chip.setPadding(dp(12), dp(6), dp(12), dp(6));
            chip.setBackgroundResource(R.drawable.bg_chat_chip);
            chip.setClickable(true);
            chip.setFocusable(true);
            chip.setOnClickListener(v -> {
                chatInput.setText(reply);
                chatInput.setSelection(chatInput.length());
            });
            LinearLayout.LayoutParams chipParams = new LinearLayout.LayoutParams(-2, -2);
            chipParams.rightMargin = dp(8);
            suggestions.addView(chip, chipParams);
        }
        root.findViewById(R.id.chat_quick_replies).setVisibility(View.VISIBLE);
        TextView wait = loading(chatMessages);
        get("/conversations/" + enc(entityId), conversation -> {
            chatMessages.removeView(wait);
            FirebaseBackendClient.SessionInfo session = api.currentSession();
            String self = session == null ? "" : session.uid;
            String otherId = self.equals(conversation.optString("member_a_id"))
                    ? conversation.optString("member_b_id") : conversation.optString("member_a_id");
            View identity = root.findViewById(R.id.chat_header_identity);
            identity.setContentDescription("Xem hồ sơ người trò chuyện");
            identity.setOnClickListener(v -> go("user_profile", otherId, false));
            loadChatPartner(otherId);
            loadChatMessages("");
        });
    }

    private void loadChatPartner(String userId) {
        if (userId == null || userId.isEmpty()) return;
        final int version = viewVersion;
        api.request("GET", "/users/" + enc(userId), null, null,
                new FirebaseBackendClient.Callback<JSONObject>() {
                    @Override public void onSuccess(JSONObject user) {
                        if (root == null || version != viewVersion || !isAdded()) return;
                        chatPartnerName = user.optString("display_name", "Thành viên EcoShare");
                        ((TextView) root.findViewById(R.id.community_title)).setText(chatPartnerName);
                        LinearLayout holder = root.findViewById(R.id.chat_header_avatar);
                        holder.removeAllViews();
                        avatar(holder, chatPartnerName, user.optString("avatar_key", ""), 40);
                        holder.getChildAt(0).setBackgroundResource(R.drawable.bg_chat_avatar);
                        for (TextView label : chatIncomingAvatars)
                            if (label.getParent() != null) label.setText(initials(chatPartnerName));
                    }
                    @Override public void onError(FirebaseBackendClient.BackendException error) {
                        // Messages remain usable when the partner profile is unavailable.
                    }
                });
    }

    private void loadPartnerName(String userId, Consumer<String> done) {
        if (userId == null || userId.isEmpty()) return;
        final int version = viewVersion;
        api.request("GET", "/users/" + enc(userId), null, null,
                new FirebaseBackendClient.Callback<JSONObject>() {
                    @Override public void onSuccess(JSONObject user) {
                        if (body != null && version == viewVersion && isAdded())
                            done.accept(user.optString("display_name", "Thành viên EcoShare"));
                    }
                    @Override public void onError(FirebaseBackendClient.BackendException error) {
                        // The conversation remains usable if this public profile becomes unavailable.
                    }
                });
    }

    private void loadChatMessages(String cursor) {
        if (chatMessages == null) return;
        final boolean firstPage = cursor.isEmpty();
        final int oldHeight = chatMessages.getHeight(), oldScroll = scroll.getScrollY();
        TextView wait = loading(chatMessages);
        String path = "/conversations/" + enc(entityId) + "/messages?newest=1&limit=20"
                + (firstPage ? "" : "&cursor=" + enc(cursor));
        getFresh(path, page -> {
            chatMessages.removeView(wait);
            if (firstPage) {
                chatMessages.removeAllViews();
                chatIncomingAvatars.clear();
            }
            JSONArray items = page.optJSONArray("items");
            LinearLayout batch = column();
            if (items != null) for (int index = items.length() - 1; index >= 0; index--) {
                JSONObject item = items.optJSONObject(index);
                if (item != null) chatMessageCard(batch, item);
            }
            chatMessages.addView(batch, 0);
            if (firstPage && batch.getChildCount() == 0) {
                empty(chatMessages, "Chưa có tin nhắn. Hãy gửi lời chào đầu tiên.");
                chatMessages.getChildAt(chatMessages.getChildCount() - 1).setTag("chat-empty");
            }
            if (firstPage) {
                chatReady = true;
                View send = root.findViewById(R.id.community_chat_send);
                if (send != null && chatInput != null)
                    send.setEnabled(!busy && !chatInput.getText().toString().trim().isEmpty());
            }
            String next = page.optString("next_cursor", "");
            if (!next.isEmpty() && !"null".equals(next)) {
                Button older = button("Xem tin nhắn cũ", () -> {});
                older.setOnClickListener(v -> {
                    chatMessages.removeView(older);
                    loadChatMessages(next);
                });
                chatMessages.addView(older, 0);
            }
            scroll.post(() -> {
                if (scroll == null || chatMessages == null) return;
                if (firstPage) scroll.fullScroll(View.FOCUS_DOWN);
                else scroll.scrollTo(0, oldScroll + Math.max(0, chatMessages.getHeight() - oldHeight));
            });
        });
    }

    private void chatMessageCard(LinearLayout parent, JSONObject item) {
        String id = item.optString("id", "");
        if (!id.isEmpty() && parent.findViewWithTag("chat-message:" + id) != null) return;
        FirebaseBackendClient.SessionInfo session = api.currentSession();
        boolean mine = session != null && session.uid.equals(item.optString("sender_id"));
        LinearLayout line = row();
        line.setTag("chat-message:" + id);
        line.setGravity(mine ? Gravity.END : Gravity.START);
        if (!mine) {
            TextView partnerAvatar = text(initials(chatPartnerName), 10, GREEN, true);
            partnerAvatar.setGravity(Gravity.CENTER);
            partnerAvatar.setBackgroundResource(R.drawable.bg_chat_avatar);
            LinearLayout.LayoutParams avatarParams = new LinearLayout.LayoutParams(dp(28), dp(28));
            avatarParams.gravity = Gravity.BOTTOM;
            avatarParams.rightMargin = dp(7);
            avatarParams.bottomMargin = dp(16);
            line.addView(partnerAvatar, avatarParams);
            chatIncomingAvatars.add(partnerAvatar);
        }
        LinearLayout stack = column();
        stack.setGravity(mine ? Gravity.END : Gravity.START);
        LinearLayout bubble = column();
        bubble.setPadding(dp(14), dp(10), dp(14), dp(10));
        bubble.setBackgroundResource(mine ? R.drawable.bg_bubble_outgoing : R.drawable.bg_bubble_incoming);
        bubble.setElevation(dp(1));
        String messageBody = item.optString("body", "");
        String mediaId = item.optString("media_id", "");
        boolean photoMessage = "📷 Ảnh".equals(messageBody);
        TextView messageText = null;
        if (!mediaId.isEmpty() && !"null".equals(mediaId)) {
            ImageView photo = new ImageView(requireContext());
            photo.setContentDescription("Ảnh đính kèm trong tin nhắn. Chạm để xem lớn.");
            photo.setScaleType(ImageView.ScaleType.CENTER_CROP);
            photo.setBackgroundResource(R.drawable.bg_chat_photo);
            photo.setClipToOutline(true);
            photo.setClickable(true);
            photo.setFocusable(true);
            photo.setOnClickListener(v -> showChatPhoto(mediaId));
            bubble.addView(photo, new LinearLayout.LayoutParams(
                    Math.max(dp(140), Math.min(dp(230), getResources().getDisplayMetrics().widthPixels - dp(122))),
                    dp(190)));
            loadImage(photo, mediaId, dp(640));
        }
        if (mediaId.isEmpty() || "null".equals(mediaId) || !photoMessage) {
            String label = photoMessage ? (mine ? "Ảnh chưa tải lên · Chạm để thử lại" : "Ảnh đang được gửi…") : messageBody;
            messageText = text(label, 14, mine ? Color.WHITE : INK, false);
            bubble.addView(messageText);
            if (photoMessage && mine) {
                bubble.setClickable(true);
                bubble.setFocusable(true);
                bubble.setOnClickListener(v -> openChatPhotoPicker(id));
            }
        }
        String sharedId = item.optString("content_id", "");
        if (!sharedId.isEmpty() && !"null".equals(sharedId)) {
            TextView open = text("Chạm để xem bài viết  →", 12, mine ? Color.WHITE : GREEN, true);
            open.setPadding(0, dp(8), 0, 0);
            bubble.addView(open);
            bubble.setClickable(true);
            bubble.setFocusable(true);
            bubble.setContentDescription("Mở bài viết được chia sẻ");
            bubble.setOnClickListener(v -> go("TIP".equals(item.optString("content_kind"))
                    ? "tip_detail" : "post_detail", sharedId, false));
        }
        if (messageText != null) messageText.setMaxWidth(Math.max(dp(120), Math.min(getResources().getDisplayMetrics().widthPixels - dp(126), dp(280))));
        stack.addView(bubble, new LinearLayout.LayoutParams(-2, -2));
        String sentAt = chatTime(item.optString("sent_at", ""));
        if (!sentAt.isEmpty()) {
            TextView when = text(sentAt, 10, MUTED, false);
            when.setGravity(mine ? Gravity.END : Gravity.START);
            when.setPadding(dp(3), dp(3), dp(3), 0);
            stack.addView(when, new LinearLayout.LayoutParams(-1, -2));
        }
        line.addView(stack, new LinearLayout.LayoutParams(-2, -2));
        LinearLayout.LayoutParams lineParams = new LinearLayout.LayoutParams(-1, -2);
        lineParams.bottomMargin = dp(12);
        parent.addView(line, lineParams);
    }

    private void showChatPhoto(String mediaId) {
        if (!isAdded() || mediaId.isEmpty()) return;
        ImageView photo = new ImageView(requireContext());
        photo.setContentDescription("Ảnh đính kèm trong tin nhắn");
        photo.setScaleType(ImageView.ScaleType.FIT_CENTER);
        photo.setBackgroundColor(Color.rgb(16, 31, 23));
        photo.setPadding(dp(8), dp(8), dp(8), dp(8));
        photo.setLayoutParams(new ViewGroup.LayoutParams(-1, dp(380)));
        new androidx.appcompat.app.AlertDialog.Builder(requireContext())
                .setView(photo)
                .setPositiveButton("Đóng", null)
                .show();
        loadImage(photo, mediaId, dp(1200));
    }

    private static String chatTime(String iso) {
        if (iso == null || iso.length() < 16) return "";
        try {
            java.text.SimpleDateFormat source = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US);
            source.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
            java.util.Date date = source.parse(iso);
            if (date != null) return new java.text.SimpleDateFormat("HH:mm", Locale.getDefault()).format(date);
        } catch (java.text.ParseException ignored) { }
        return iso.substring(11, 16);
    }

    private void chooseChatAttachment() {
        if (!chatReady || busy) return;
        new androidx.appcompat.app.AlertDialog.Builder(requireContext())
                .setTitle("Đính kèm vào tin nhắn")
                .setItems(new String[]{"Ảnh từ thư viện", "Bài viết", "Mẹo hay"}, (dialog, which) -> {
                    if (which == 0) openChatPhotoPicker("");
                    else chooseChatContent(which == 1 ? "POST" : "TIP");
                })
                .setNegativeButton("Đóng", null)
                .show();
    }

    private void openChatPhotoPicker(String messageId) {
        if (!chatReady || busy || entityId == null || entityId.isEmpty()) return;
        chatPhotoConversationId = entityId;
        retryChatPhotoMessageId = messageId;
        chatPhotoPicker.launch("image/*");
    }

    private void sendChatPhoto(Uri uri, String retryMessageId) {
        if (!chatReady || busy || !signedIn()) return;
        busy = true;
        final int version = viewVersion;
        final String conversationId = entityId;
        final FirebaseBackendClient client = api;
        final Context context = requireContext().getApplicationContext();
        View sendButton = root.findViewById(R.id.community_chat_send);
        if (sendButton != null) sendButton.setEnabled(false);
        if (chatMessages != null && chatMessages.findViewWithTag("chat-photo-progress") == null) {
            TextView progress = text("Đang gửi ảnh…", 12, MUTED, false);
            progress.setTag("chat-photo-progress");
            progress.setGravity(Gravity.END);
            progress.setPadding(dp(8), dp(8), dp(8), dp(12));
            chatMessages.addView(progress);
            scroll.post(() -> { if (scroll != null) scroll.fullScroll(View.FOCUS_DOWN); });
        }
        try {
            images.execute(() -> {
                try (InputStream stream = context.getContentResolver().openInputStream(uri)) {
                    byte[] bytes = PhotoUploadEncoder.forFirestore(readImage(stream)).bytes;
                    main.post(() -> {
                        if (!chatPhotoScreenActive(version, conversationId)) {
                            finishChatPhoto(version, conversationId, null);
                            return;
                        }
                        if (!retryMessageId.isEmpty()) {
                            uploadChatPhoto(client, conversationId, retryMessageId, bytes, null, version);
                            return;
                        }
                        client.request("POST", "/conversations/" + enc(conversationId) + "/messages",
                                json("body", "📷 Ảnh"), UUID.randomUUID().toString(),
                                new FirebaseBackendClient.Callback<JSONObject>() {
                                    @Override public void onSuccess(JSONObject created) {
                                        uploadChatPhoto(client, conversationId, created.optString("id"), bytes, created, version);
                                    }
                                    @Override public void onError(FirebaseBackendClient.BackendException error) {
                                        finishChatPhoto(version, conversationId, error.getMessage());
                                    }
                                });
                    });
                } catch (Exception error) {
                    main.post(() -> finishChatPhoto(version, conversationId,
                            "Không đọc được ảnh: " + error.getMessage()));
                }
            });
        } catch (RejectedExecutionException error) {
            finishChatPhoto(version, conversationId, "Không thể chuẩn bị ảnh để gửi.");
        }
    }

    private void uploadChatPhoto(FirebaseBackendClient client, String conversationId, String messageId,
                                 byte[] bytes, @Nullable JSONObject created, int version) {
        if (messageId.isEmpty()) {
            finishChatPhoto(version, conversationId, "Không tạo được tin nhắn ảnh.");
            return;
        }
        client.uploadMedia("MESSAGE", messageId, "image/jpeg", bytes,
                new FirebaseBackendClient.Callback<JSONObject>() {
                    @Override public void onSuccess(JSONObject media) {
                        if (chatPhotoScreenActive(version, conversationId)) {
                            clearPagedSnapshots();
                            if (created == null) loadChatMessages("");
                            else {
                                try { created.put("media_id", media.optString("id")); }
                                catch (JSONException ignored) { }
                                appendChatMessage(created);
                            }
                        }
                        finishChatPhoto(version, conversationId, null);
                    }
                    @Override public void onError(FirebaseBackendClient.BackendException error) {
                        if (created != null && chatPhotoScreenActive(version, conversationId)) appendChatMessage(created);
                        finishChatPhoto(version, conversationId,
                                "Ảnh chưa tải lên. Chạm tin nhắn ảnh để thử lại: " + error.getMessage());
                    }
                });
    }

    private boolean chatPhotoScreenActive(int version, String conversationId) {
        return body != null && isAdded() && version == viewVersion && "chat".equals(destination)
                && conversationId.equals(entityId);
    }

    private void finishChatPhoto(int version, String conversationId, @Nullable String error) {
        busy = false;
        if (!chatPhotoScreenActive(version, conversationId)) return;
        if (chatMessages != null) {
            View progress = chatMessages.findViewWithTag("chat-photo-progress");
            if (progress != null && progress.getParent() == chatMessages) chatMessages.removeView(progress);
        }
        View send = root.findViewById(R.id.community_chat_send);
        if (send != null && chatInput != null)
            send.setEnabled(chatReady && !chatInput.getText().toString().trim().isEmpty());
        if (error != null) message(error);
    }

    private void chooseChatContent(String kind) {
        String path = "TIP".equals(kind) ? "/tips?limit=20" : "/posts?limit=20";
        get(path, response -> {
            JSONArray items = response.optJSONArray("items");
            if (items == null || items.length() == 0) {
                message("Chưa có nội dung để chia sẻ.");
                return;
            }
            ArrayList<JSONObject> choices = new ArrayList<>();
            ArrayList<String> labels = new ArrayList<>();
            for (int i = 0; i < items.length(); i++) {
                JSONObject entry = items.optJSONObject(i);
                if (entry == null || entry.optString("id", "").isEmpty()) continue;
                choices.add(entry);
                String title = entry.optString("title", "").trim();
                if (title.isEmpty()) title = entry.optString("body", "Bài chia sẻ").trim();
                labels.add(title.length() > 70 ? title.substring(0, 70) + "…" : title);
            }
            if (choices.isEmpty()) {
                message("Chưa có nội dung để chia sẻ.");
                return;
            }
            new androidx.appcompat.app.AlertDialog.Builder(requireContext())
                    .setTitle("TIP".equals(kind) ? "Chọn mẹo hay" : "Chọn bài viết")
                    .setItems(labels.toArray(new String[0]), (dialog, which) ->
                            sendChatSharedContent(choices.get(which)))
                    .setNegativeButton("Đóng", null)
                    .show();
        });
    }

    private void sendChatSharedContent(JSONObject content) {
        if (!chatReady || busy || content == null) return;
        String contentId = content.optString("id", "");
        if (contentId.isEmpty()) return;
        busy = true;
        final int version = viewVersion;
        api.request("POST", "/conversations/" + enc(entityId) + "/messages",
                json("content_id", contentId), UUID.randomUUID().toString(),
                new FirebaseBackendClient.Callback<JSONObject>() {
                    @Override public void onSuccess(JSONObject result) {
                        if (body == null || version != viewVersion || !isAdded()) return;
                        busy = false;
                        clearPagedSnapshots();
                        appendChatMessage(result);
                    }
                    @Override public void onError(FirebaseBackendClient.BackendException error) {
                        if (body == null || version != viewVersion || !isAdded()) return;
                        busy = false;
                        message(error.getMessage());
                    }
                });
    }

    private void appendChatMessage(JSONObject result) {
        if (chatMessages == null) return;
        if (chatMessages.findViewWithTag("chat-message:" + result.optString("id")) == null) {
            View placeholder = chatMessages.findViewWithTag("chat-empty");
            if (placeholder != null && placeholder.getParent() == chatMessages)
                chatMessages.removeView(placeholder);
            chatMessageCard(chatMessages, result);
        }
        scroll.post(() -> { if (scroll != null) scroll.fullScroll(View.FOCUS_DOWN); });
    }

    private void sendChatMessage(Button sendButton) {
        if (busy || !chatReady || chatInput == null || !signedIn()) return;
        String value = chatInput.getText().toString().trim();
        if (value.isEmpty()) return;
        String key = value.equals(pendingChatBody) && !pendingChatKey.isEmpty()
                ? pendingChatKey : UUID.randomUUID().toString();
        pendingChatBody = value;
        pendingChatKey = key;
        busy = true;
        sendButton.setEnabled(false);
        final int version = viewVersion;
        api.request("POST", "/conversations/" + enc(entityId) + "/messages", json("body", value), key,
                new FirebaseBackendClient.Callback<JSONObject>() {
                    @Override public void onSuccess(JSONObject result) {
                        if (body == null || version != viewVersion || !isAdded()) return;
                        busy = false;
                        pendingChatBody = pendingChatKey = "";
                        if (value.equals(chatInput.getText().toString().trim())) chatInput.setText("");
                        chatDraft = chatInput.getText().toString();
                        clearPagedSnapshots();
                        appendChatMessage(result);
                        sendButton.setEnabled(!chatInput.getText().toString().trim().isEmpty());
                    }
                    @Override public void onError(FirebaseBackendClient.BackendException error) {
                        if (body == null || version != viewVersion || !isAdded()) return;
                        busy = false;
                        sendButton.setEnabled(!chatInput.getText().toString().trim().isEmpty());
                        message(error.getMessage());
                    }
                });
    }

    private void sharePostScreen(String query) {
        deactivatePage();
        viewVersion++;
        if (!signedIn()) return;
        String routeId = entityId == null ? "" : entityId;
        int separator = routeId.indexOf(':');
        if (separator < 1 || separator == routeId.length() - 1) {
            header("Chia sẻ bài viết", true);
            body.removeAllViews();
            empty(body, "Không tìm thấy bài viết để chia sẻ.");
            return;
        }
        String kind = routeId.substring(0, separator);
        String contentId = routeId.substring(separator + 1);
        if (!"POST".equals(kind) && !"TIP".equals(kind)) return;
        header("TIP".equals(kind) ? "Chia sẻ mẹo hay" : "Chia sẻ bài viết", true);
        body.removeAllViews();
        body.addView(text("Gửi bài viết này cho bạn bè qua tin nhắn", 14, MUTED, false));
        LinearLayout preview = card(body);
        preview.addView(text("BÀI VIẾT ĐƯỢC CHIA SẺ", 11, GREEN, true));
        TextView previewText = text("Đang tải bài viết…", 15, INK, true);
        previewText.setPadding(0, dp(6), 0, 0);
        preview.addView(previewText);
        get(("TIP".equals(kind) ? "/tips/" : "/posts/") + enc(contentId), post -> {
            String title = post.optString("title", "").trim();
            String summary = post.optString("body", "").trim();
            previewText.setText(title.isEmpty() ? summary : title);
            previewText.setMaxLines(3);
            previewText.setEllipsize(android.text.TextUtils.TruncateAt.END);
        });
        EditText search = input("Tìm bạn bè…", 80, R.id.community_search);
        search.setSingleLine(true);
        search.setText(query);
        search.setImeOptions(android.view.inputmethod.EditorInfo.IME_ACTION_SEARCH);
        search.setOnEditorActionListener((v, action, event) -> {
            if (action == android.view.inputmethod.EditorInfo.IME_ACTION_SEARCH) {
                sharePostScreen(search.getText().toString().trim());
                return true;
            }
            return false;
        });
        body.addView(search);
        label("BẠN BÈ");
        LinearLayout results = column();
        body.addView(results);
        showPaged(results, "/friends?tab=friends&q=" + enc(query),
                "Bạn chưa có bạn bè phù hợp để chia sẻ.",
                friend -> shareFriendCard(results, friend, contentId));
    }

    private void shareFriendCard(LinearLayout parent, JSONObject friend, String contentId) {
        String memberId = friend.optString("id", "");
        LinearLayout card = card(parent);
        LinearLayout line = row();
        String name = friend.optString("display_name", "Thành viên EcoShare");
        avatar(line, name, friend.optString("avatar_key", ""), 44);
        TextView nameView = text(name, 15, INK, true);
        nameView.setPadding(dp(10), 0, 0, 0);
        line.addView(nameView, new LinearLayout.LayoutParams(0, -2, 1));
        Button sendButton = button("Gửi", () -> {});
        sendButton.setMinWidth(dp(64));
        line.addView(sendButton, new LinearLayout.LayoutParams(dp(70), dp(44)));
        card.addView(line);
        final String[] retryKey = {UUID.randomUUID().toString()};
        sendButton.setOnClickListener(v -> {
            if (busy || memberId.isEmpty()) return;
            busy = true;
            sendButton.setEnabled(false);
            int version = viewVersion;
            api.request("POST", "/conversations", json("member_id", memberId), null,
                    new FirebaseBackendClient.Callback<JSONObject>() {
                        @Override public void onSuccess(JSONObject conversation) {
                            if (body == null || version != viewVersion || !isAdded()) return;
                            String conversationId = conversation.optString("id", "");
                            if (conversationId.isEmpty()) {
                                busy = false;
                                sendButton.setEnabled(true);
                                message("Không mở được cuộc trò chuyện.");
                                return;
                            }
                            api.request("POST", "/conversations/" + enc(conversationId) + "/messages",
                                    json("content_id", contentId), retryKey[0],
                                    new FirebaseBackendClient.Callback<JSONObject>() {
                                        @Override public void onSuccess(JSONObject result) {
                                            if (body == null || version != viewVersion || !isAdded()) return;
                                            busy = false;
                                            clearPagedSnapshots();
                                            sendButton.setText("Đã gửi");
                                            sendButton.setEnabled(false);
                                            Snackbar.make(root, "Đã chia sẻ bài viết cho " + name, Snackbar.LENGTH_LONG)
                                                    .setAction("Xem tin nhắn", action -> go("chat", conversationId, false)).show();
                                        }
                                        @Override public void onError(FirebaseBackendClient.BackendException error) {
                                            if (body == null || version != viewVersion || !isAdded()) return;
                                            busy = false;
                                            sendButton.setEnabled(true);
                                            message(error.getMessage());
                                        }
                                    });
                        }
                        @Override public void onError(FirebaseBackendClient.BackendException error) {
                            if (body == null || version != viewVersion || !isAdded()) return;
                            busy = false;
                            sendButton.setEnabled(true);
                            message(error.getMessage());
                        }
                    });
        });
    }

    private void friends(String query) {
        deactivatePage(); viewVersion++; header("Bạn bè & Mạng lưới",true); body.removeAllViews(); if(!signedIn())return;
        if(friendSearchTask!=null)main.removeCallbacks(friendSearchTask);
        LinearLayout controls=root.findViewById(R.id.friends_controls); controls.removeAllViews();
        LinearLayout searchBar=row(); searchBar.setBackgroundResource(R.drawable.bg_friends_search); searchBar.setPadding(dp(12),0,dp(10),0);
        controls.addView(searchBar,new LinearLayout.LayoutParams(-1,dp(44)));
        ImageView searchIcon=new ImageView(requireContext()); searchIcon.setImageResource(R.drawable.ic_search); searchIcon.setColorFilter(MUTED);
        searchBar.addView(searchIcon,new LinearLayout.LayoutParams(dp(19),dp(19)));
        EditText search=input("Tìm kiếm bạn bè...",80,R.id.community_search); search.setSingleLine(true); search.setTextSize(13); search.setBackground(null); search.setMinHeight(0); search.setMinimumHeight(0);
        search.setPadding(dp(10),0,0,0); search.setText(query); search.setImeOptions(android.view.inputmethod.EditorInfo.IME_ACTION_SEARCH);
        searchBar.addView(search,new LinearLayout.LayoutParams(0,-1,1));
        LinearLayout tabStrip=row(); tabStrip.setPadding(dp(3),dp(3),dp(3),dp(3)); tabStrip.setBackgroundResource(R.drawable.bg_explore_tabs);
        LinearLayout.LayoutParams tabLp=new LinearLayout.LayoutParams(-1,dp(40)); tabLp.topMargin=dp(12); controls.addView(tabStrip,tabLp);
        LinearLayout results=column(); body.addView(results);
        renderFriendTabs(tabStrip,search,results);
        search.addTextChangedListener(new TextWatcher(){
            @Override public void beforeTextChanged(CharSequence s,int start,int count,int after){}
            @Override public void onTextChanged(CharSequence s,int start,int before,int count){}
            @Override public void afterTextChanged(Editable text){
                if(friendSearchTask!=null)main.removeCallbacks(friendSearchTask);
                String value=text.toString().trim();
                friendSearchTask=()->{if(body!=null&&"friends".equals(destination))loadFriendResults(results,value);};
                main.postDelayed(friendSearchTask,300);
            }
        });
        search.setOnEditorActionListener((v,action,event)->{
            if(action!=android.view.inputmethod.EditorInfo.IME_ACTION_SEARCH)return false;
            if(friendSearchTask!=null)main.removeCallbacks(friendSearchTask);
            loadFriendResults(results,search.getText().toString().trim());
            ((InputMethodManager)requireContext().getSystemService(Context.INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(search.getWindowToken(),0);
            return true;
        });
        loadFriendResults(results,query);
    }
    private void renderFriendTabs(LinearLayout strip,EditText search,LinearLayout results){
        strip.removeAllViews();
        String[] labels={"Lời mời","Bạn bè","Gợi ý"}, values={"requests","friends","suggestions"};
        for(int i=0;i<labels.length;i++){
            String value=values[i]; Button tab=button(labels[i],()->{
                if(value.equals(friendTab))return;
                if(friendSearchTask!=null)main.removeCallbacks(friendSearchTask);
                friendTab=value; renderFriendTabs(strip,search,results);
                loadFriendResults(results,search.getText().toString().trim());
            });
            tab.setMinWidth(0); tab.setMinimumWidth(0); tab.setMinHeight(0); tab.setMinimumHeight(0);
            tab.setTextSize(12); tab.setTypeface(null,Typeface.BOLD); tab.setElevation(0);
            tab.setBackgroundResource(value.equals(friendTab)?R.drawable.bg_explore_tab_selected:0); tab.setBackgroundTintList(null);
            tab.setTextColor(value.equals(friendTab)?GREEN:Color.rgb(143,159,170));
            tab.setContentDescription(labels[i]+(value.equals(friendTab)?", đang chọn":""));
            strip.addView(tab,new LinearLayout.LayoutParams(0,-1,1));
        }
    }
    private void loadFriendResults(LinearLayout results,String query){
        results.removeAllViews();
        String emptyMessage="requests".equals(friendTab)?"Bạn chưa có lời mời kết bạn mới.":"friends".equals(friendTab)?"Chưa có bạn bè phù hợp.":"Chưa có gợi ý phù hợp.";
        showPaged(results,"/friends?tab="+friendTab+"&q="+enc(query),emptyMessage,user->friendCard(results,user,query));
    }
    private void friendCard(LinearLayout parent,JSONObject user,String query) {
        LinearLayout card=card(parent); card.setPadding(dp(16),dp(16),dp(16),dp(14));
        String name=user.optString("display_name","Thành viên"); LinearLayout line=row(); line.setGravity(Gravity.TOP);
        avatar(line,name,user.optString("avatar_key",""),54);
        LinearLayout copy=column(); copy.setPadding(dp(10),0,0,0);
        TextView nameLabel=text(name,15,INK,true); nameLabel.setTypeface(Typeface.create("serif",Typeface.BOLD)); copy.addView(nameLabel);
        String bio=user.optString("bio","").trim(); if(!bio.isEmpty())copy.addView(text(bio,12,MUTED,false));
        String city=user.optString("city","").trim(); if(!city.isEmpty())copy.addView(text("📍 "+city,12,MUTED,false));
        line.addView(copy,new LinearLayout.LayoutParams(0,-2,1)); card.addView(line);
        line.setOnClickListener(v->go("user_profile",user.optString("id"),false));
        LinearLayout actions=row(); LinearLayout.LayoutParams actionsLp=new LinearLayout.LayoutParams(-1,-2); actionsLp.topMargin=dp(10); actionsLp.leftMargin=dp(64);
        if("requests".equals(friendTab)){
            Button accept=friendAction("✓ Chấp nhận",true,()->respondFriend(user,true,query));
            Button decline=friendAction("Từ chối",false,()->respondFriend(user,false,query));
            LinearLayout.LayoutParams acceptLp=new LinearLayout.LayoutParams(0,dp(38),1); acceptLp.rightMargin=dp(8);
            actions.addView(accept,acceptLp); actions.addView(decline,new LinearLayout.LayoutParams(0,dp(38),1));
        }else if("suggestions".equals(friendTab)){
            boolean pending="PENDING".equals(user.optString("status",""));
            Button request=friendAction(pending?"Đã gửi lời mời":"Kết bạn",!pending,()->send("POST","/friends/requests",json("user_id",user.optString("id")),null,result->friends(query)));
            request.setEnabled(!pending); actions.addView(request,new LinearLayout.LayoutParams(-1,dp(38)));
        }else actions.addView(friendAction("Nhắn tin",true,()->startConversation(user.optString("id"))),new LinearLayout.LayoutParams(-1,dp(38)));
        card.addView(actions,actionsLp);
    }
    private Button friendAction(String title,boolean primary,Runnable click){
        Button action=button(title,click); action.setTextSize(12); action.setTypeface(null,Typeface.BOLD);
        action.setMinHeight(0); action.setMinimumHeight(0); action.setElevation(0); action.setPadding(dp(4),0,dp(4),0);
        action.setTextColor(primary?Color.WHITE:GREEN);
        action.setBackgroundResource(primary?R.drawable.bg_friends_accept:R.drawable.bg_friends_decline); action.setBackgroundTintList(null);
        return action;
    }
    private void startConversation(String memberId) {
        if (memberId.isEmpty() || busy) return;
        busy = true;
        api.request("POST", "/conversations", json("member_id", memberId), null,
                new FirebaseBackendClient.Callback<JSONObject>() {
                    final int version = viewVersion;
                    @Override public void onSuccess(JSONObject conversation) {
                        if (body == null || version != viewVersion || !isAdded()) return;
                        busy = false;
                        clearPagedSnapshots();
                        go("chat", conversation.optString("id"), false);
                    }
                    @Override public void onError(FirebaseBackendClient.BackendException error) {
                        if (body == null || version != viewVersion || !isAdded()) return;
                        busy = false;
                        message(error.getMessage());
                    }
                });
    }
    private void respondFriend(JSONObject user,boolean accept,String query){String request=user.optString("request_id",user.optString("relationship_id"));send("POST","/friends/requests/"+enc(request)+"/respond",json("accept",accept),null,result->{message(accept?"Đã chấp nhận lời mời.":"Đã từ chối lời mời.");friends(query);});}
    private void notifications() {
        deactivatePage();header("Thông báo",true);body.removeAllViews();if(!signedIn())return;
        action("Đọc tất cả",()->send("POST","/notifications/read-all",json(),null,result->notifications()));
        TextView readAll=root.findViewById(R.id.community_action); readAll.setBackground(null); readAll.setTextSize(11);
        showPaged(body,"/notifications","Bạn chưa có thông báo.",notice->notificationCard(body,notice));
        if(activePage!=null)updateNotificationBadge(activePage.unreadCount);
    }
    private void updateNotificationBadge(int unread){
        if(root==null)return;
        TextView badge=root.findViewById(R.id.notification_count); if(badge==null)return;
        badge.setVisibility(unread>0?View.VISIBLE:View.GONE);
        if(unread>0){badge.setText(unread>99?"99+":String.valueOf(unread));badge.setContentDescription(unread+" thông báo chưa đọc");}
    }
    private long notificationTime(String iso){
        if(iso==null||iso.length()<19)return -1;
        try{
            java.text.SimpleDateFormat parser=new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss",Locale.US);
            parser.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
            java.util.Date parsed=parser.parse(iso.substring(0,19));
            return parsed==null?-1:parsed.getTime();
        }catch(java.text.ParseException invalid){return -1;}
    }
    private boolean notificationIsToday(long timestamp){
        if(timestamp<0)return false;
        java.util.Calendar current=java.util.Calendar.getInstance(), created=java.util.Calendar.getInstance();
        created.setTimeInMillis(timestamp);
        return current.get(java.util.Calendar.ERA)==created.get(java.util.Calendar.ERA)
                &&current.get(java.util.Calendar.YEAR)==created.get(java.util.Calendar.YEAR)
                &&current.get(java.util.Calendar.DAY_OF_YEAR)==created.get(java.util.Calendar.DAY_OF_YEAR);
    }
    private String notificationAge(long timestamp,String iso){
        if(timestamp<0)return date(iso);
        long minutes=Math.max(0,(System.currentTimeMillis()-timestamp)/60_000L);
        if(minutes<1)return "Vừa xong";
        if(minutes<60)return minutes+" phút trước";
        if(minutes<1_440)return minutes/60+" giờ trước";
        if(minutes<10_080)return minutes/1_440+" ngày trước";
        return date(iso);
    }
    private String notificationTypeIcon(String subtype){
        if(subtype.contains("LIKE"))return "❤️";
        if(subtype.contains("COMMENT"))return "💬";
        if(subtype.contains("FRIEND"))return "🤝";
        if(subtype.contains("CHALLENGE"))return "🏆";
        return "🔔";
    }
    private void notificationCard(LinearLayout parent,JSONObject notice){
        String iso=notice.optString("created_at",""); long timestamp=notificationTime(iso);
        boolean today=notificationIsToday(timestamp);
        String sectionTag=today?"notifications:today":"notifications:previous";
        LinearLayout section=parent.findViewWithTag(sectionTag);
        if(section==null){
            TextView heading=text(today?"HÔM NAY":"TRƯỚC ĐÓ",11,Color.rgb(145,160,177),true);
            heading.setPadding(dp(16),dp(11),dp(16),dp(8));
            heading.setBackgroundColor(today?Color.rgb(240,251,245):Color.TRANSPARENT);
            parent.addView(heading,new LinearLayout.LayoutParams(-1,-2));
            section=column(); section.setTag(sectionTag); section.setBackgroundColor(today?Color.WHITE:Color.TRANSPARENT);
            parent.addView(section,new LinearLayout.LayoutParams(-1,-2));
        }
        boolean unread=notice.isNull("read_at")||notice.optString("read_at","").isEmpty();
        JSONObject author=notice.optJSONObject("author");
        String name=author==null?"EcoShare":author.optString("display_name","EcoShare");
        LinearLayout item=row(); item.setGravity(Gravity.CENTER_VERTICAL); item.setPadding(dp(16),dp(11),dp(16),dp(11)); item.setMinimumHeight(dp(76));
        section.addView(item,new LinearLayout.LayoutParams(-1,-2));
        FrameLayout avatarFrame=new FrameLayout(requireContext()); item.addView(avatarFrame,new LinearLayout.LayoutParams(dp(48),dp(48)));
        LinearLayout avatarHost=row(); avatarFrame.addView(avatarHost,new FrameLayout.LayoutParams(dp(44),dp(44),Gravity.TOP|Gravity.START));
        avatar(avatarHost,name,author==null?"":author.optString("avatar_key",""),44);
        TextView type=text(notificationTypeIcon(notice.optString("subtype","SYSTEM")),10,INK,false);
        type.setGravity(Gravity.CENTER); type.setBackgroundResource(R.drawable.bg_notification_type);
        FrameLayout.LayoutParams typeLp=new FrameLayout.LayoutParams(dp(19),dp(19),Gravity.BOTTOM|Gravity.END);
        avatarFrame.addView(type,typeLp);
        LinearLayout copy=column(); LinearLayout.LayoutParams copyLp=new LinearLayout.LayoutParams(0,-2,1); copyLp.leftMargin=dp(9); item.addView(copy,copyLp);
        String content=notice.optString("body","").trim(); if(content.isEmpty())content=name;
        TextView description=text(content,13,INK,false);
        if(content.startsWith(name)){
            android.text.SpannableString styled=new android.text.SpannableString(content);
            styled.setSpan(new android.text.style.StyleSpan(Typeface.BOLD),0,name.length(),android.text.Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            description.setText(styled);
        }
        copy.addView(description);
        TextView age=text(notificationAge(timestamp,iso),11,Color.rgb(145,160,177),false);
        LinearLayout.LayoutParams ageLp=new LinearLayout.LayoutParams(-1,-2); ageLp.topMargin=dp(2); copy.addView(age,ageLp);
        if(unread){
            View dot=new View(requireContext()); dot.setBackgroundResource(R.drawable.bg_notification_dot);
            LinearLayout.LayoutParams dotLp=new LinearLayout.LayoutParams(dp(8),dp(8)); dotLp.leftMargin=dp(8); item.addView(dot,dotLp);
        }
        item.setFocusable(true);
        item.setForeground(new android.graphics.drawable.RippleDrawable(android.content.res.ColorStateList.valueOf(0x162C765B),null,null));
        item.setOnClickListener(v->send("POST","/notifications/"+enc(notice.optString("id"))+"/read",json(),null,read->{
            String contentId=notice.optString("content_id","");
            if(!contentId.isEmpty()&&!"null".equals(contentId))go("TIP".equals(notice.optString("content_kind"))?"tip_detail":"post_detail",contentId,true);
            else if(notice.optString("subtype","").contains("FRIEND"))go("friends",null,false);
            else notifications();
        }));
    }
    private void scanner() {
        deactivatePage(); header("SCAN",true); body.removeAllViews(); if(!signedIn())return;
        body.setPadding(0,0,0,0);
        FrameLayout stage=new FrameLayout(requireContext());
        stage.addView(new ScanOverlayView(requireContext()),new FrameLayout.LayoutParams(-1,-1));
        body.addView(stage,new LinearLayout.LayoutParams(-1,dp(620)));
        LinearLayout historyPanel=column(); historyPanel.setPadding(dp(16),dp(20),dp(16),dp(150));
        historyPanel.setBackgroundColor(0xFF0B180E); body.addView(historyPanel,new LinearLayout.LayoutParams(-1,-2));
        scroll.post(()->{
            if(body==null||!"scanner".equals(destination))return;
            int viewport=Math.max(scroll.getHeight(),dp(520));
            ViewGroup.LayoutParams params=stage.getLayoutParams();
            params.height=viewport; stage.setLayoutParams(params);
            historyPanel.setMinimumHeight(viewport);
        });
        TextView historyTitle=text("ẢNH SCAN ĐÃ LƯU",12,Color.WHITE,true);
        historyPanel.addView(historyTitle);
        TextView historyHint=text("Ảnh của bạn được lưu riêng tư trên Firebase.",12,0xFF9EB8A5,false);
        LinearLayout.LayoutParams hintLp=new LinearLayout.LayoutParams(-1,-2); hintLp.topMargin=dp(4); hintLp.bottomMargin=dp(14);
        historyPanel.addView(historyHint,hintLp);
        LinearLayout history=column(); historyPanel.addView(history);
        showPaged(history,"/scans","Chưa có ảnh SCAN đã lưu.",scan->scanCard(history,scan));

        action("Ảnh đã lưu",()->scroll.post(()->scroll.fullScroll(View.FOCUS_DOWN)));
        TextView historyAction=root.findViewById(R.id.community_action);
        historyAction.setBackground(null); historyAction.setTextColor(0xFFC4EAD0); historyAction.setTextSize(12);
        footer.removeAllViews(); footer.setOrientation(LinearLayout.VERTICAL); footer.setVisibility(View.VISIBLE);
        TextView instruction=text("Chụp hoặc chọn ảnh để lưu sản phẩm tái chế",11,0xFFC4D7C7,false);
        instruction.setGravity(Gravity.CENTER); footer.addView(instruction,new LinearLayout.LayoutParams(-1,-2));
        LinearLayout controls=row(); controls.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams controlsLp=new LinearLayout.LayoutParams(-1,dp(86)); controlsLp.topMargin=dp(8); footer.addView(controls,controlsLp);
        TextView gallery=scanControl("🖼️",48,R.drawable.bg_scan_side,"Chọn ảnh từ thư viện",()->{if(!busy)scanPicker.launch("image/*");});
        controls.addView(gallery,new LinearLayout.LayoutParams(dp(48),dp(48)));
        TextView capture=scanControl("📷",80,R.drawable.bg_scan_capture,"Chụp ảnh SCAN",this::takePhoto);
        capture.setId(R.id.community_camera);
        LinearLayout.LayoutParams captureLp=new LinearLayout.LayoutParams(dp(80),dp(80)); captureLp.leftMargin=dp(24); captureLp.rightMargin=dp(24);
        controls.addView(capture,captureLp);
        TextView tips=scanControl("💡",48,R.drawable.bg_scan_side,"Mẹo chụp ảnh SCAN",()->new androidx.appcompat.app.AlertDialog.Builder(requireContext())
                .setTitle("Mẹo chụp ảnh SCAN")
                .setMessage("Đặt sản phẩm trong vùng sáng, giữ điện thoại ổn định rồi chạm nút máy ảnh. Bạn cũng có thể chọn ảnh có sẵn; ảnh SCAN chỉ lưu trong tài khoản của bạn.")
                .setPositiveButton("Đã hiểu",null).show());
        controls.addView(tips,new LinearLayout.LayoutParams(dp(48),dp(48)));
    }
    private TextView scanControl(String symbol,int size,int background,String description,Runnable click){
        TextView control=text(symbol,size>=80?28:22,Color.WHITE,false);
        control.setGravity(Gravity.CENTER); control.setBackgroundResource(background);
        control.setContentDescription(description); control.setFocusable(true); control.setClickable(true);
        control.setOnClickListener(v->click.run());
        return control;
    }
    private void scanCard(LinearLayout history,JSONObject scan){
        LinearLayout card=card(history);card.addView(text(scan.optString("title","Ảnh SCAN"),15,INK,true));card.addView(text(date(scan.optString("created_at")),11,MUTED,false));
        JSONArray media=scan.optJSONArray("media");if(media!=null)for(int j=0;j<media.length();j++){JSONObject photo=media.optJSONObject(j);if(photo!=null)mediaImage(card,photo.optString("id"),200);}
        Button remove=button("Xóa ảnh SCAN",()->new androidx.appcompat.app.AlertDialog.Builder(requireContext()).setTitle("Xóa ảnh SCAN?").setMessage("Ảnh này sẽ được ẩn khỏi lịch sử SCAN của bạn.").setPositiveButton("Xóa",(dialog,which)->send("DELETE","/scans/"+enc(scan.optString("id")),null,null,deleted->scanner())).setNegativeButton("Giữ lại",null).show());card.addView(remove);
    }
    private void takePhoto(){if(busy)return;try{File dir=new File(requireContext().getCacheDir(),"community-camera");if(!dir.exists()&&!dir.mkdirs())throw new IllegalStateException("Không tạo được thư mục ảnh.");File file=new File(dir,UUID.randomUUID()+".jpg");cameraUri=FileProvider.getUriForFile(requireContext(),requireContext().getPackageName()+".files",file);camera.launch(cameraUri);}catch(Exception error){message("Không mở được camera. Bạn có thể chọn ảnh từ máy.");}}
    private void saveScan(Uri uri){if(busy||!signedIn())return;busy=true;message("Đang lưu ảnh SCAN…");send("POST","/scans",json("title","Ảnh SCAN · "+new java.text.SimpleDateFormat("dd/MM/yyyy",Locale.forLanguageTag("vi-VN")).format(new java.util.Date())),UUID.randomUUID().toString(),scan->upload("SCAN",scan.optString("id"),uri,()->{busy=false;message("Đã lưu ảnh SCAN trên Firebase.");scanner();}));}

    private void listingCard(LinearLayout parent, JSONObject listing) {
        int columns = getResources().getConfiguration().orientation == android.content.res.Configuration.ORIENTATION_LANDSCAPE ? 3 : 2;
        View previous = parent.getChildCount() == 0 ? null : parent.getChildAt(parent.getChildCount() - 1);
        LinearLayout gridRow;
        if (previous instanceof LinearLayout && "market_grid_row".equals(previous.getTag())
                && ((LinearLayout) previous).getChildCount() < columns) gridRow = (LinearLayout) previous;
        else {
            gridRow = row();
            gridRow.setTag("market_grid_row");
            gridRow.setGravity(Gravity.TOP);
            gridRow.setWeightSum(columns);
            LinearLayout.LayoutParams rowParams = new LinearLayout.LayoutParams(-1, -2);
            rowParams.bottomMargin = dp(12);
            parent.addView(gridRow, rowParams);
        }
        int position = gridRow.getChildCount();
        LinearLayout tile = column();
        tile.setTag("listing:" + listing.optString("id"));
        tile.setBackgroundResource(R.drawable.bg_market_product_card);
        tile.setClipToOutline(true);
        tile.setElevation(dp(1));
        tile.setClickable(true);
        tile.setFocusable(true);
        tile.setOnClickListener(v -> go("market_detail", listing.optString("id"), false));
        LinearLayout.LayoutParams tileParams = new LinearLayout.LayoutParams(0, -2, 1);
        tileParams.leftMargin = position == 0 ? 0 : dp(6);
        tileParams.rightMargin = position == columns - 1 ? 0 : dp(6);
        gridRow.addView(tile, tileParams);

        FrameLayout image = new FrameLayout(requireContext());
        image.setBackgroundColor(0xFFEDF7F1);
        tile.addView(image, new LinearLayout.LayoutParams(-1, dp(126)));
        TextView placeholder = text("♻", 28, GREEN, true);
        placeholder.setGravity(Gravity.CENTER);
        image.addView(placeholder, new FrameLayout.LayoutParams(-1, -1));
        String mediaId = listing.optString("preview_media_id", "");
        if (!mediaId.isEmpty() && !"null".equals(mediaId)) {
            ImageView photo = new ImageView(requireContext());
            photo.setContentDescription("Ảnh " + listing.optString("title", "sản phẩm"));
            photo.setScaleType(ImageView.ScaleType.CENTER_CROP);
            image.addView(photo, new FrameLayout.LayoutParams(-1, -1));
            loadImage(photo, mediaId, dp(230));
        }
        long price = listing.isNull("min_price_vnd") ? -1 : listing.optLong("min_price_vnd", -1);
        if (price >= 0) {
            TextView priceBadge = text(price == 0 ? "Miễn phí 💚" : currency(price), 11, GREEN, true);
            priceBadge.setGravity(Gravity.CENTER);
            priceBadge.setPadding(dp(8), 0, dp(8), 0);
            priceBadge.setBackgroundResource(R.drawable.bg_market_price_badge);
            FrameLayout.LayoutParams priceParams = new FrameLayout.LayoutParams(-2, dp(26), Gravity.TOP | Gravity.START);
            priceParams.setMargins(dp(7), dp(7), 0, 0);
            image.addView(priceBadge, priceParams);
        }
        long created = challengeTimestamp(listing.optString("created_at", ""));
        if (created > 0 && System.currentTimeMillis() - created < 7L * 24 * 60 * 60 * 1000) {
            TextView newBadge = text("Mới", 10, Color.WHITE, true);
            newBadge.setGravity(Gravity.CENTER);
            newBadge.setPadding(dp(7), 0, dp(7), 0);
            newBadge.setBackgroundResource(R.drawable.bg_market_new_badge);
            FrameLayout.LayoutParams badgeParams = new FrameLayout.LayoutParams(-2, dp(24), Gravity.TOP | Gravity.END);
            badgeParams.setMargins(0, dp(8), dp(8), 0);
            image.addView(newBadge, badgeParams);
        }

        LinearLayout content = column();
        content.setPadding(dp(10), dp(8), dp(10), dp(9));
        tile.addView(content);
        TextView title = text(listing.optString("title", "Sản phẩm"), 13, INK, true);
        title.setMaxLines(2);
        title.setEllipsize(android.text.TextUtils.TruncateAt.END);
        content.addView(title, new LinearLayout.LayoutParams(-1, dp(42)));
        JSONObject seller = listing.optJSONObject("seller");
        String sellerName = seller == null ? "Thành viên EcoShare" : seller.optString("display_name", "Thành viên EcoShare");
        String avatarId = seller == null ? "" : seller.optString("avatar_key", "");
        LinearLayout sellerRow = row();
        if (!avatarId.isEmpty() && !"null".equals(avatarId)) {
            ImageView avatarImage = new ImageView(requireContext());
            avatarImage.setScaleType(ImageView.ScaleType.CENTER_CROP);
            avatarImage.setBackgroundResource(R.drawable.bg_circle_avatar);
            avatarImage.setClipToOutline(true);
            sellerRow.addView(avatarImage, new LinearLayout.LayoutParams(dp(18), dp(18)));
            loadImage(avatarImage, avatarId, dp(72));
        } else {
            TextView initials = text(initials(sellerName), 10, GREEN, true);
            initials.setGravity(Gravity.CENTER);
            initials.setBackgroundResource(R.drawable.bg_circle_avatar);
            sellerRow.addView(initials, new LinearLayout.LayoutParams(dp(18), dp(18)));
        }
        String city = listing.optString("city", "");
        TextView sellerInfo = text(sellerName + (city.isEmpty() ? "" : "  ·  📍 " + city), 10, MUTED, false);
        sellerInfo.setSingleLine(true);
        sellerInfo.setEllipsize(android.text.TextUtils.TruncateAt.END);
        sellerInfo.setPadding(dp(5), 0, 0, 0);
        sellerRow.addView(sellerInfo, new LinearLayout.LayoutParams(0, -2, 1));
        content.addView(sellerRow, new LinearLayout.LayoutParams(-1, dp(22)));
        LinearLayout bottom = row();
        TextView posted = text(date(listing.optString("created_at", "")), 10, MUTED, false);
        bottom.addView(posted, new LinearLayout.LayoutParams(0, -2, 1));
        String sellerId = listing.optString("seller_id", "");
        boolean own = !sellerId.isEmpty() && sellerId.equals(BackendSession.profile().optString("id", ""));
        TextView contact = text(own ? "Xem tin" : "Liên hệ", 11, GREEN, true);
        contact.setGravity(Gravity.CENTER);
        contact.setPadding(dp(9), 0, dp(9), 0);
        contact.setBackgroundResource(R.drawable.community_pill);
        contact.setClickable(true);
        contact.setFocusable(true);
        contact.setOnClickListener(v -> {
            if (own || sellerId.isEmpty()) go("market_detail", listing.optString("id"), false);
            else if (signedIn()) startConversation(sellerId);
        });
        bottom.addView(contact, new LinearLayout.LayoutParams(-2, dp(30)));
        content.addView(bottom, new LinearLayout.LayoutParams(-1, dp(34)));
    }
    private LinearLayout listingDetailCard() {
        LinearLayout card = column();
        card.setPadding(dp(16), dp(16), dp(16), dp(16));
        card.setBackgroundResource(R.drawable.community_card);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.setMargins(dp(14), dp(14), dp(14), 0);
        body.addView(card, params);
        return card;
    }

    private void listingDetail() {
        header("Chi tiết đồ cũ", false);
        body.removeAllViews();
        body.setPadding(0, 0, 0, dp(24));
        if (entityId == null || entityId.isEmpty()) {
            LinearLayout card = listingDetailCard();
            empty(card, "Chưa chọn sản phẩm.");
            return;
        }
        TextView wait = loading(body);
        wait.setPadding(dp(16), dp(24), dp(16), dp(24));
        get("/listings/" + enc(entityId), listing -> {
            body.removeView(wait);
            renderListingDetail(listing);
        });
    }

    private void renderListingDetail(JSONObject listing) {
        JSONArray items = listing.optJSONArray("items");
        String title = listing.optString("title", "Sản phẩm");
        String state = listing.optString("status", "");
        String sellerId = listing.optString("seller_id", "");
        JSONObject seller = listing.optJSONObject("seller");
        String sellerName = seller == null ? "Thành viên EcoShare" : seller.optString("display_name", "Thành viên EcoShare");
        String avatarId = seller == null ? "" : seller.optString("avatar_key", "");

        FrameLayout hero = new FrameLayout(requireContext());
        hero.setBackgroundColor(0xFFE5F3EB);
        int heroHeight = getResources().getConfiguration().orientation == android.content.res.Configuration.ORIENTATION_LANDSCAPE ? 220 : 280;
        body.addView(hero, new LinearLayout.LayoutParams(-1, dp(heroHeight)));
        TextView placeholder = text("♻", 54, GREEN, true);
        placeholder.setGravity(Gravity.CENTER);
        hero.addView(placeholder, new FrameLayout.LayoutParams(-1, -1));
        ImageView heroPhoto = new ImageView(requireContext());
        heroPhoto.setContentDescription("Ảnh " + title);
        heroPhoto.setScaleType(ImageView.ScaleType.CENTER_CROP);
        hero.addView(heroPhoto, new FrameLayout.LayoutParams(-1, -1));
        String previewId = listing.optString("preview_media_id", "");
        if (!previewId.isEmpty() && !"null".equals(previewId)) loadImage(heroPhoto, previewId, dp(640));

        TextView back = text("‹", 31, Color.WHITE, false);
        back.setGravity(Gravity.CENTER);
        back.setContentDescription("Quay lại");
        back.setBackgroundResource(R.drawable.bg_frosted_circle);
        back.setClickable(true);
        back.setFocusable(true);
        back.setOnClickListener(v -> requireActivity().getOnBackPressedDispatcher().onBackPressed());
        FrameLayout.LayoutParams backParams = new FrameLayout.LayoutParams(dp(40), dp(40), Gravity.TOP | Gravity.START);
        backParams.setMargins(dp(16), dp(16), 0, 0);
        hero.addView(back, backParams);

        TextView tagIcon = text("🏷", 19, Color.WHITE, true);
        tagIcon.setGravity(Gravity.CENTER);
        tagIcon.setContentDescription("Loại sản phẩm");
        tagIcon.setBackgroundResource(R.drawable.bg_frosted_circle);
        FrameLayout.LayoutParams tagParams = new FrameLayout.LayoutParams(dp(40), dp(40), Gravity.TOP | Gravity.END);
        tagParams.setMargins(0, dp(16), dp(16), 0);
        hero.addView(tagIcon, tagParams);

        String material = items != null && items.length() > 0 && items.optJSONObject(0) != null
                ? items.optJSONObject(0).optString("material", "") : "";
        TextView category = text(material.isEmpty() ? "Đồ cũ" : material, 11, Color.WHITE, true);
        category.setGravity(Gravity.CENTER);
        category.setPadding(dp(12), 0, dp(12), 0);
        category.setBackgroundResource(R.drawable.bg_market_category_badge);
        FrameLayout.LayoutParams categoryParams = new FrameLayout.LayoutParams(-2, dp(28), Gravity.BOTTOM | Gravity.START);
        categoryParams.setMargins(dp(16), 0, 0, dp(14));
        hero.addView(category, categoryParams);

        LinearLayout summary = listingDetailCard();
        LinearLayout titleRow = row();
        summary.addView(titleRow);
        TextView name = text(title, 21, INK, true);
        name.setMaxLines(3);
        titleRow.addView(name, new LinearLayout.LayoutParams(0, -2, 1));
        long created = challengeTimestamp(listing.optString("created_at", ""));
        if (created > 0 && System.currentTimeMillis() - created < 7L * 24 * 60 * 60 * 1000) {
            TextView fresh = text("Mới", 11, GREEN, true);
            fresh.setGravity(Gravity.CENTER);
            fresh.setPadding(dp(12), 0, dp(12), 0);
            fresh.setBackgroundResource(R.drawable.community_pill);
            LinearLayout.LayoutParams freshParams = new LinearLayout.LayoutParams(-2, dp(28));
            freshParams.leftMargin = dp(8);
            titleRow.addView(fresh, freshParams);
        }
        LinearLayout priceRow = row();
        LinearLayout.LayoutParams priceRowParams = new LinearLayout.LayoutParams(-1, -2);
        priceRowParams.topMargin = dp(8);
        summary.addView(priceRow, priceRowParams);
        long lowest = Long.MAX_VALUE;
        long stockCount = 0;
        int itemCount = 0;
        String singleUnit = "cái";
        if (items != null) for (int i = 0; i < items.length(); i++) {
            JSONObject item = items.optJSONObject(i);
            if (item == null) continue;
            itemCount++;
            singleUnit = item.optString("unit", "cái");
            lowest = Math.min(lowest, item.optLong("price_vnd", Long.MAX_VALUE));
            stockCount += Math.max(0, item.optInt("stock"));
        }
        String displayedPrice = lowest == Long.MAX_VALUE ? "Liên hệ" : lowest == 0 ? "Miễn phí" : currency(lowest);
        priceRow.addView(text((itemCount > 1 ? "Từ " : "") + displayedPrice, 22, GREEN, true),
                new LinearLayout.LayoutParams(0, -2, 1));
        String unit = itemCount == 1 ? singleUnit : "sản phẩm";
        TextView quantity = text("Còn " + stockCount + " " + unit, 12, GREEN, true);
        quantity.setGravity(Gravity.CENTER);
        quantity.setPadding(dp(10), 0, dp(10), 0);
        quantity.setBackgroundResource(R.drawable.community_pill);
        priceRow.addView(quantity, new LinearLayout.LayoutParams(-2, dp(30)));
        if (!"APPROVED".equals(state)) {
            TextView status = text("Trạng thái: " + statusLabel(state), 12, MUTED, true);
            status.setPadding(0, dp(8), 0, 0);
            summary.addView(status);
        }

        LinearLayout sellerCard = listingDetailCard();
        LinearLayout sellerRow = row();
        sellerCard.addView(sellerRow);
        avatar(sellerRow, sellerName, avatarId, 48);
        LinearLayout sellerText = column();
        sellerText.setPadding(dp(12), 0, dp(8), 0);
        sellerText.addView(text(sellerName, 15, INK, true));
        String city = listing.optString("city", "");
        sellerText.addView(text((city.isEmpty() ? "" : "📍 " + city + " · ") + "Xem hồ sơ người bán", 12, MUTED, false));
        sellerRow.addView(sellerText, new LinearLayout.LayoutParams(0, -2, 1));
        TextView arrow = text("→", 20, GREEN, true);
        arrow.setGravity(Gravity.CENTER);
        arrow.setBackgroundResource(R.drawable.community_pill);
        sellerRow.addView(arrow, new LinearLayout.LayoutParams(dp(38), dp(38)));
        if (!sellerId.isEmpty()) {
            sellerCard.setClickable(true);
            sellerCard.setFocusable(true);
            sellerCard.setOnClickListener(v -> go(sellerId.equals(BackendSession.profile().optString("id", "")) ? "profile" : "user_profile", sellerId, false));
        }

        LinearLayout description = listingDetailCard();
        TextView descriptionLabel = text("▤  Mô tả", 14, INK, true);
        description.addView(descriptionLabel);
        TextView descriptionText = text(listing.optString("description", ""), 14, INK, false);
        descriptionText.setPadding(0, dp(8), 0, 0);
        description.addView(descriptionText);

        LinearLayout gallery = listingDetailCard();
        gallery.setVisibility(View.GONE);
        get("/media?parent_kind=LISTING&parent_id=" + enc(entityId), photos -> {
            JSONArray entries = photos.optJSONArray("items");
            if (entries == null || entries.length() == 0) return;
            JSONObject first = entries.optJSONObject(0);
            if ((previewId.isEmpty() || "null".equals(previewId)) && first != null) loadImage(heroPhoto, first.optString("id"), dp(640));
            if (entries.length() <= 1) return;
            gallery.setVisibility(View.VISIBLE);
            gallery.addView(text("ẢNH SẢN PHẨM", 12, MUTED, true));
            for (int i = 1; i < entries.length(); i++) {
                JSONObject photo = entries.optJSONObject(i);
                if (photo != null) mediaImage(gallery, photo.optString("id"), 190);
            }
        });

        LinearLayout purchase = listingDetailCard();
        boolean hasStock = stockCount > 0;
        Button buy = button(hasStock ? "Mua hàng" : "Đã hết hàng", () -> buyListingItems(items));
        buy.setEnabled("APPROVED".equals(state) && hasStock);
        purchase.addView(buy);
    }

    private void buyListingItems(JSONArray items) {
        if (items == null || !signedIn()) return;
        ArrayList<JSONObject> available = new ArrayList<>();
        for (int i = 0; i < items.length(); i++) {
            JSONObject item = items.optJSONObject(i);
            if (item != null && item.optInt("stock") > 0) available.add(item);
        }
        if (available.isEmpty()) return;
        if (available.size() == 1) {
            buyItem(available.get(0));
            return;
        }
        String[] choices = new String[available.size()];
        for (int i = 0; i < available.size(); i++) {
            JSONObject item = available.get(i);
            choices[i] = item.optString("name", "Sản phẩm") + " · " + currency(item.optLong("price_vnd"))
                    + " · Còn " + item.optInt("stock") + " " + item.optString("unit", "cái");
        }
        new androidx.appcompat.app.AlertDialog.Builder(requireContext())
                .setTitle("Chọn sản phẩm cần mua")
                .setItems(choices, (dialog, which) -> buyItem(available.get(which)))
                .setNegativeButton("Đóng", null)
                .show();
    }
    private void buyItem(JSONObject item){
        if(busy||!signedIn())return;busy=true;
        get("/me/addresses",response->{
            JSONArray addresses=response.optJSONArray("items");
            if(addresses==null||addresses.length()==0){busy=false;message("Thêm địa chỉ nhận hàng trước khi mua.");go("addresses",null,false);return;}
            String[] labels=new String[addresses.length()];
            for(int i=0;i<addresses.length();i++){JSONObject address=addresses.optJSONObject(i);labels[i]=address==null?"Địa chỉ":address.optString("recipient","Địa chỉ")+" · "+address.optString("line","");}
            boolean[] submitted={false};
            androidx.appcompat.app.AlertDialog dialog=new androidx.appcompat.app.AlertDialog.Builder(requireContext()).setTitle("Mua 1 sản phẩm · Chọn địa chỉ").setItems(labels,(choice,which)->{
                JSONObject address=addresses.optJSONObject(which);if(address==null){busy=false;return;}submitted[0]=true;
                JSONArray lines=new JSONArray().put(json("listing_item_id",item.optString("id"),"quantity",1));
                String itemId=item.optString("id"),addressId=address.optString("id");if(checkoutKey.isEmpty()||!checkoutItem.equals(itemId)||!checkoutAddress.equals(addressId)){checkoutKey=UUID.randomUUID().toString();checkoutItem=itemId;checkoutAddress=addressId;}
                send("POST","/orders",json("address_id",addressId,"items",lines),checkoutKey,order->{busy=false;String orderId=order.optString("id");checkoutKey="";go("order_detail",orderId,false);});
            }).setNegativeButton("Đóng",null).create();
            dialog.setOnDismissListener(d->{if(!submitted[0])busy=false;});dialog.show();
        });
    }
    private android.content.SharedPreferences demoPayments() {
        return requireContext().getSharedPreferences("ecoshare_demo_payments", Context.MODE_PRIVATE);
    }
    private String demoPaymentKey(String orderId) {
        return BackendSession.profile().optString("id") + ":" + orderId + ":";
    }
    private void demoPayment() {
        header("Thanh toán thử", true);
        body.removeAllViews();
        if (!signedIn()) return;
        if (entityId == null || entityId.isEmpty()) {
            empty(body, "Chưa chọn đơn hàng để thanh toán thử.");
            return;
        }
        String orderId = entityId;
        TextView wait = loading(body);
        getFresh("/orders/" + enc(orderId), order -> {
            body.removeView(wait);
            String buyerId = BackendSession.profile().optString("id");
            if (!"PENDING_PAYMENT".equals(order.optString("status"))
                    || !buyerId.equals(order.optString("buyer_id"))) {
                empty(body, "Đơn hàng này không còn ở bước chờ thanh toán.");
                orderActionButton("Xem đơn hàng", R.drawable.ic_wallet_white, false,
                        () -> go("order_detail", orderId, false));
                return;
            }
            long amount = order.optLong("total_vnd");
            LinearLayout intro = card(body);
            intro.setBackgroundResource(R.drawable.bg_card_mint);
            intro.addView(text("CHẾ ĐỘ DEMO · KHÔNG CHUYỂN TIỀN", 11, GREEN, true));
            TextView title = text("Chọn cách thanh toán", 22, INK, true);
            LinearLayout.LayoutParams titleLp = new LinearLayout.LayoutParams(-1, -2);
            titleLp.topMargin = dp(8);
            intro.addView(title, titleLp);
            intro.addView(text("Bạn có thể thử giao diện MoMo hoặc VNPay. App sẽ không mở ví, không trừ tiền và không cập nhật đơn hàng trên máy chủ.", 13, MUTED, false));

            label("TỔNG ĐƠN HÀNG");
            LinearLayout total = card(body);
            total.addView(text("Đơn #" + shortId(orderId), 13, MUTED, false));
            total.addView(text(currency(amount), 28, GREEN, true));

            label("PHƯƠNG THỨC MÔ PHỎNG");
            String[] selected = {"MOMO"};
            LinearLayout momo = demoProviderOption("MoMo", "Ví điện tử · Demo", R.drawable.logo_momo);
            LinearLayout vnpay = demoProviderOption("VNPay", "Cổng thanh toán · Demo", R.drawable.logo_vnpay);
            body.addView(momo);
            body.addView(vnpay);
            Runnable update = () -> {
                styleDemoProvider(momo, "MOMO".equals(selected[0]));
                styleDemoProvider(vnpay, "VNPAY".equals(selected[0]));
            };
            momo.setOnClickListener(view -> { selected[0] = "MOMO"; update.run(); });
            vnpay.setOnClickListener(view -> { selected[0] = "VNPAY"; update.run(); });
            update.run();

            orderActionButton("Xác nhận thanh toán thử", R.drawable.ic_wallet_white, false, () -> {
                String key = demoPaymentKey(orderId);
                demoPayments().edit().putString(key + "provider", selected[0])
                        .putLong(key + "amount", amount).putBoolean(key + "completed", true).apply();
                go("payment_demo_result", orderId, false);
            });
            Button back = button("Quay lại đơn hàng", () -> go("order_detail", orderId, false));
            LinearLayout.LayoutParams backLp = new LinearLayout.LayoutParams(-1, dp(48));
            backLp.topMargin = dp(8);
            body.addView(back, backLp);
        });
    }
    private LinearLayout demoProviderOption(String name, String description, int logoRes) {
        LinearLayout option = row();
        option.setPadding(dp(15), dp(13), dp(15), dp(13));
        option.setMinimumHeight(dp(76));
        option.setClickable(true);
        option.setFocusable(true);
        option.setContentDescription(name + ", " + description);
        ImageView icon = new ImageView(requireContext());
        icon.setImageResource(logoRes);
        icon.setScaleType(ImageView.ScaleType.FIT_CENTER);
        icon.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        LinearLayout.LayoutParams iconLp = new LinearLayout.LayoutParams(dp(46), dp(46));
        iconLp.rightMargin = dp(13);
        option.addView(icon, iconLp);
        LinearLayout copy = column();
        copy.addView(text(name, 16, INK, true));
        copy.addView(text(description, 12, MUTED, false));
        option.addView(copy, new LinearLayout.LayoutParams(0, -2, 1));
        TextView check = text("", 19, GREEN, true);
        check.setGravity(Gravity.CENTER);
        check.setTag("demo-provider-check");
        option.addView(check, new LinearLayout.LayoutParams(dp(28), dp(28)));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
        lp.bottomMargin = dp(10);
        option.setLayoutParams(lp);
        return option;
    }
    private void styleDemoProvider(LinearLayout option, boolean selected) {
        GradientDrawable background = new GradientDrawable();
        background.setColor(Color.WHITE);
        background.setCornerRadius(dp(20));
        background.setStroke(dp(selected ? 2 : 1), selected ? GREEN : 0xFFE1EBE5);
        option.setBackground(background);
        TextView check = option.findViewWithTag("demo-provider-check");
        if (check != null) check.setText(selected ? "✓" : "○");
        option.setSelected(selected);
    }
    private void demoPaymentResult() {
        header("Kết quả thanh toán thử", true);
        body.removeAllViews();
        if (!signedIn()) return;
        String orderId = entityId == null ? "" : entityId;
        String key = demoPaymentKey(orderId);
        if (orderId.isEmpty() || !demoPayments().getBoolean(key + "completed", false)) {
            empty(body, "Chưa có kết quả thanh toán thử cho đơn hàng này.");
            return;
        }
        String provider = "VNPAY".equals(demoPayments().getString(key + "provider", "")) ? "VNPay" : "MoMo";
        long amount = demoPayments().getLong(key + "amount", 0);
        LinearLayout result = card(body);
        result.setPadding(dp(22), dp(26), dp(22), dp(25));
        TextView symbol = text("✓", 35, Color.WHITE, true);
        symbol.setGravity(Gravity.CENTER);
        symbol.setBackgroundResource(R.drawable.bg_order_payment);
        LinearLayout.LayoutParams symbolLp = new LinearLayout.LayoutParams(dp(64), dp(64));
        symbolLp.gravity = Gravity.CENTER_HORIZONTAL;
        result.addView(symbol, symbolLp);
        TextView heading = text("Thanh toán thử thành công", 21, INK, true);
        heading.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams headingLp = new LinearLayout.LayoutParams(-1, -2);
        headingLp.topMargin = dp(16);
        result.addView(heading, headingLp);
        TextView total = text(currency(amount), 27, GREEN, true);
        total.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams totalLp = new LinearLayout.LayoutParams(-1, -2);
        totalLp.topMargin = dp(8);
        result.addView(total, totalLp);
        TextView providerText = text("Mô phỏng qua " + provider + " · Đơn #" + shortId(orderId), 13, MUTED, false);
        providerText.setGravity(Gravity.CENTER);
        result.addView(providerText);

        LinearLayout notice = card(body);
        notice.setBackgroundResource(R.drawable.bg_card_mint);
        notice.addView(text("Chỉ là bản demo", 15, INK, true));
        notice.addView(text("Không có tiền được chuyển, không phát sinh giao dịch MoMo/VNPay. Đơn hàng trên máy chủ vẫn ở trạng thái chờ thanh toán.", 13, MUTED, false));
        orderActionButton("Xem chi tiết đơn hàng", R.drawable.ic_wallet_white, false,
                () -> go("order_detail", orderId, false));
        Button retry = button("Thử lại với cổng khác", () -> go("payment_demo", orderId, false));
        LinearLayout.LayoutParams retryLp = new LinearLayout.LayoutParams(-1, dp(48));
        retryLp.topMargin = dp(8);
        body.addView(retry, retryLp);
    }
    private void listingComposer(){header("Đăng bán đồ cũ",true);body.removeAllViews();if(!signedIn())return;body.addView(text("Người bán và người mua phải được xác minh. Tin bán sẽ được quản trị viên duyệt trước khi xuất hiện trong Chợ đồ cũ.",14,MUTED,false));label("TÊN SẢN PHẨM");draftTitle=input("Tên món đồ muốn bán",200,R.id.community_draft_title);draftTitle.setText(savedTitle);addComposerField(draftTitle,56);label("MÔ TẢ SẢN PHẨM");draft=input("Tình trạng, chất liệu, thông tin sản phẩm (ít nhất 10 ký tự)…",10000,R.id.community_draft);draft.setMinLines(4);draft.setGravity(Gravity.TOP);draft.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_FLAG_MULTI_LINE);draft.setText(savedBody);addComposerField(draft,120);label("KHU VỰC");city=input("Tỉnh / thành phố",100,0);JSONObject profile=BackendSession.profile();if(profile!=null)city.setText(savedCity.isEmpty()?profile.optString("city",""):savedCity);addComposerField(city,56);label("GIÁ BÁN (VND)");price=input("Ví dụ: 50000",9,0);price.setInputType(InputType.TYPE_CLASS_NUMBER);price.setText(savedPrice);addComposerField(price,56);label("SỐ LƯỢNG");stock=input("Số lượng còn bán",5,0);stock.setText(savedStock);stock.setInputType(InputType.TYPE_CLASS_NUMBER);addComposerField(stock,56);label("VẬT LIỆU");chips();photosForm();label("DANH MỤC");LinearLayout categories=column();body.addView(categories);final String[] selected={null};get("/categories",result->{JSONArray entries=result.optJSONArray("items");if(entries==null||entries.length()==0){empty(categories,"Chưa có danh mục. Liên hệ quản trị viên.");return;}android.widget.RadioGroup choices=new android.widget.RadioGroup(requireContext());for(int i=0;i<entries.length();i++){JSONObject category=entries.optJSONObject(i);if(category==null)continue;android.widget.RadioButton option=new android.widget.RadioButton(requireContext());option.setId(View.generateViewId());option.setText(category.optString("name"));option.setMinHeight(dp(48));option.setTag(category.optString("id"));choices.addView(option);}choices.setOnCheckedChangeListener((group,id)->{View selectedView=group.findViewById(id);selected[0]=selectedView==null?null:String.valueOf(selectedView.getTag());});categories.addView(choices);});action("Gửi duyệt",()->publishListing(selected[0]));publish=root.findViewById(R.id.community_action);}
    private void publishListing(String category){if(busy)return;String title=draftTitle.getText().toString().trim(),description=draft.getText().toString().trim(),location=city.getText().toString().trim();if(title.isEmpty()){draftTitle.setError("Nhập tên sản phẩm.");return;}if(description.length()<10){draft.setError("Mô tả cần ít nhất 10 ký tự.");return;}if(location.isEmpty()){city.setError("Nhập tỉnh / thành phố.");return;}long amount;int quantity;try{amount=Long.parseLong(price.getText().toString());if(amount<1000||amount>999999999)throw new NumberFormatException();}catch(NumberFormatException e){price.setError("Giá từ 1.000 đến 999.999.999 đ.");return;}try{quantity=Integer.parseInt(stock.getText().toString());if(quantity<1||quantity>10000)throw new NumberFormatException();}catch(NumberFormatException e){stock.setError("Số lượng từ 1 đến 10.000.");return;}String material=materials.isEmpty()?"Hỗn hợp":android.text.TextUtils.join(", ",materials);JSONObject item=json("category_id",category,"name",title,"material",material,"condition","GOOD","price_vnd",amount,"stock",quantity,"unit","cái");busy=true;publish.setEnabled(false);send("POST","/listings",json("title",title,"description",description,"city",location,"items",new JSONArray().put(item)),createKey,listing->uploadPictures("LISTING",listing.optString("id"),0,()->{clearPagedSnapshots();busy=false;message("Đã lưu tin bán và gửi quản trị viên duyệt.");go("market_detail",listing.optString("id"),false);}));}

    private void profileEcoProgress(LinearLayout parent, long points) {
        long remainder = points % 2000;
        long goal = points <= 2000 ? 2000 : remainder == 0 ? points
                : points > Long.MAX_VALUE - (2000 - remainder) ? Long.MAX_VALUE : points + 2000 - remainder;
        float progress = Math.min(1f, (float) points / goal);
        NumberFormat number = NumberFormat.getIntegerInstance(Locale.US);

        LinearLayout panel = column();
        panel.setPadding(dp(12), dp(11), dp(12), dp(11));
        panel.setBackgroundResource(R.drawable.bg_profile_eco_level);
        LinearLayout.LayoutParams panelParams = new LinearLayout.LayoutParams(-1, -2);
        panelParams.topMargin = dp(8);
        parent.addView(panel, panelParams);

        LinearLayout heading = row();
        heading.setGravity(Gravity.CENTER_VERTICAL);
        heading.addView(text("🌿 Cấp độ Eco", 12, INK, true), new LinearLayout.LayoutParams(0, -2, 1));
        TextView score = text(number.format(points) + "/" + number.format(goal) + " điểm", 11, MUTED, false);
        score.setGravity(Gravity.END);
        heading.addView(score);
        panel.addView(heading);

        LinearLayout track = row();
        track.setBackgroundResource(R.drawable.bg_eco_progress_track);
        track.setClipToOutline(true);
        track.setContentDescription("Đã đạt " + number.format(points) + " trên " + number.format(goal) + " điểm Eco");
        LinearLayout.LayoutParams trackParams = new LinearLayout.LayoutParams(-1, dp(8));
        trackParams.topMargin = dp(7);
        panel.addView(track, trackParams);
        View fill = new View(requireContext());
        fill.setBackgroundResource(R.drawable.bg_eco_progress_fill);
        track.addView(fill, new LinearLayout.LayoutParams(0, dp(8), progress));
        track.addView(new View(requireContext()), new LinearLayout.LayoutParams(0, dp(8), 1f - progress));

        LinearLayout footer = row();
        footer.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams footerParams = new LinearLayout.LayoutParams(-1, -2);
        footerParams.topMargin = dp(7);
        panel.addView(footer, footerParams);
        footer.addView(text("🌿 Mốc Eco tiếp theo", 10, MUTED, false), new LinearLayout.LayoutParams(0, -2, 1));
        TextView challenges = text("Xem thử thách →", 11, GREEN, true);
        challenges.setOnClickListener(view -> {
            go("explore", "challenges", false);
        });
        challenges.setContentDescription("Xem thử thách để kiếm thêm điểm Eco");
        footer.addView(challenges);
    }

    private void profile(){
        deactivatePage();viewVersion++;header("",false);body.removeAllViews();body.setPadding(0,0,0,dp(24));if(!signedIn())return;JSONObject profile=BackendSession.profile();
        displayedOwnProfile = profile.toString();
        String name=profile.optString("display_name","").trim();
        if(name.isEmpty()||"Tài khoản".equals(name))name="Thành viên EcoShare";
        String bio=profile.optString("bio","").trim();
        String city=profile.optString("city","").trim();
        String role=profile.optString("role","");
        boolean adminRole="ADMIN".equals(role)||"MODERATOR".equals(role);
        long points=Math.max(0,profile.optLong("points_balance",0));
        boolean verified=profile.optBoolean("verified", "VERIFIED".equals(profile.optString("verification_status","")));
        String createdAt=profile.optString("created_at","");
        String dateDisplay=date(createdAt);
        String uid=profile.optString("id",profile.optString("uid",""));

        // ─── 1. Full-width Cover Photo with Rustic Garden and Top Action Buttons ───
        android.widget.FrameLayout coverFrame=new android.widget.FrameLayout(requireContext());
        ImageView cover=new ImageView(requireContext());
        cover.setImageResource(R.drawable.img_cover_plants);
        cover.setScaleType(ImageView.ScaleType.CENTER_CROP);
        coverFrame.addView(cover,new android.widget.FrameLayout.LayoutParams(-1,dp(190)));
        String coverKey=profile.optString("cover_key","");
        if(!coverKey.isEmpty()&&!("null".equals(coverKey)))loadImage(cover,coverKey);

        LinearLayout topActions=new LinearLayout(requireContext());
        topActions.setOrientation(LinearLayout.HORIZONTAL);
        topActions.setGravity(Gravity.CENTER_VERTICAL);
        android.widget.FrameLayout.LayoutParams topActionsLp=new android.widget.FrameLayout.LayoutParams(-2,-2);
        topActionsLp.gravity=Gravity.TOP|Gravity.END;
        topActionsLp.topMargin=dp(16);
        topActionsLp.rightMargin=dp(16);

        LinearLayout editCoverBtn=new LinearLayout(requireContext());
        editCoverBtn.setOrientation(LinearLayout.HORIZONTAL);
        editCoverBtn.setGravity(Gravity.CENTER);
        editCoverBtn.setPadding(dp(12),dp(6),dp(14),dp(6));
        editCoverBtn.setBackgroundResource(R.drawable.bg_frosted_pill);
        ImageView editIcon=new ImageView(requireContext());
        editIcon.setImageResource(R.drawable.ic_edit);
        editIcon.setColorFilter(Color.parseColor("#F75B49"));
        editCoverBtn.addView(editIcon,new LinearLayout.LayoutParams(dp(13),dp(13)));
        View editGap=new View(requireContext());
        editCoverBtn.addView(editGap,new LinearLayout.LayoutParams(dp(6),0));
        TextView editText=text("Chỉnh sửa",12,Color.WHITE,true);
        editText.setShadowLayer(4f,0f,1.5f,Color.parseColor("#50000000"));
        editCoverBtn.addView(editText);
        editCoverBtn.setOnClickListener(v->go("edit_profile",null,false));
        topActions.addView(editCoverBtn);

        View actionSpacer=new View(requireContext());
        topActions.addView(actionSpacer,new LinearLayout.LayoutParams(dp(8),0));

        android.widget.FrameLayout moreBtn=new android.widget.FrameLayout(requireContext());
        moreBtn.setBackgroundResource(R.drawable.bg_frosted_circle);
        moreBtn.setContentDescription("Mở Cài đặt");
        moreBtn.setFocusable(true);
        ImageView moreIcon=new ImageView(requireContext());
        moreIcon.setImageResource(R.drawable.ic_settings);
        moreIcon.setColorFilter(Color.WHITE);
        android.widget.FrameLayout.LayoutParams moreIconLp=new android.widget.FrameLayout.LayoutParams(dp(19),dp(19));
        moreIconLp.gravity=Gravity.CENTER;
        moreBtn.addView(moreIcon,moreIconLp);
        moreBtn.setOnClickListener(v->go("settings",null,false));
        topActions.addView(moreBtn,new LinearLayout.LayoutParams(dp(34),dp(34)));
        coverFrame.addView(topActions,topActionsLp);
        body.addView(coverFrame);

        // ─── 2. Main Profile Overlapping White Card (Image 2) ───
        LinearLayout mainCard=column();
        mainCard.setBackgroundResource(R.drawable.bg_card);
        mainCard.setElevation(dp(4));
        LinearLayout.LayoutParams mainCardLp=new LinearLayout.LayoutParams(-1,-2);
        mainCardLp.setMargins(dp(14),dp(-30),dp(14),0);
        mainCard.setPadding(dp(16),dp(18),dp(16),dp(18));

        // Header: Avatar & Name
        LinearLayout headerRow=row();
        android.widget.FrameLayout avatarContainer=new android.widget.FrameLayout(requireContext());
        avatarContainer.setBackgroundResource(R.drawable.bg_avatar_squircle);
        avatarContainer.setElevation(dp(2));
        String avatarKey=profile.optString("avatar_key","");
        if(!avatarKey.isEmpty()&&!("null".equals(avatarKey))){
            ImageView avatarImg=new ImageView(requireContext());
            avatarImg.setScaleType(ImageView.ScaleType.CENTER_CROP);
            avatarImg.setBackgroundResource(R.drawable.bg_avatar_squircle);
            avatarImg.setClipToOutline(true);
            avatarContainer.addView(avatarImg,new android.widget.FrameLayout.LayoutParams(dp(74),dp(74)));
            loadImage(avatarImg,avatarKey);
        }else{
            TextView avatarInitials=text(initials(name),24,GREEN,true);
            avatarInitials.setGravity(Gravity.CENTER);
            avatarInitials.setBackgroundResource(R.drawable.bg_avatar_squircle);
            avatarContainer.addView(avatarInitials,new android.widget.FrameLayout.LayoutParams(dp(74),dp(74)));
        }
        headerRow.addView(avatarContainer,new LinearLayout.LayoutParams(dp(74),dp(74)));

        LinearLayout nameBlock=column();
        nameBlock.setPadding(dp(14),0,0,0);
        TextView nameText=text(name,19,Color.parseColor("#111827"),true);
        nameBlock.addView(nameText);
        LinearLayout badgeRow=row();
        badgeRow.setPadding(0,dp(4),0,0);
        String badgeLabel="ADMIN".equals(role)?"Quản trị viên":"MODERATOR".equals(role)?"Điều hành viên":verified?"✓ Đã xác minh":"Thành viên EcoShare";
        boolean trustedBadge=verified||adminRole;
        TextView accountBadge=text(badgeLabel,12,trustedBadge?GREEN:Color.parseColor("#64748B"),true);
        accountBadge.setPadding(dp(10),dp(3),dp(10),dp(3));
        accountBadge.setBackgroundResource(trustedBadge?R.drawable.bg_badge_verified:R.drawable.bg_profile_stat);
        badgeRow.addView(accountBadge);
        nameBlock.addView(badgeRow);
        headerRow.addView(nameBlock,new LinearLayout.LayoutParams(0,-2,1));
        mainCard.addView(headerRow);

        // Bio section
        TextView bioL1=text(bio.isEmpty()?"Chưa thêm phần giới thiệu.":bio,14,bio.isEmpty()?Color.parseColor("#94A3B8"):Color.parseColor("#374151"),false);
        bioL1.setPadding(0,dp(12),0,0);
        mainCard.addView(bioL1);
        // Show only profile metadata returned by the account API.
        LinearLayout metaRow=row();
        metaRow.setPadding(0,dp(8),0,0);
        if(!city.isEmpty())metaRow.addView(text("📍 "+city,12,Color.parseColor("#64748B"),false));
        if(!dateDisplay.isEmpty()){
            TextView dateView=text("📅 Tham gia "+dateDisplay,12,Color.parseColor("#64748B"),false);
            LinearLayout.LayoutParams dateLp=new LinearLayout.LayoutParams(-2,-2);dateLp.leftMargin=city.isEmpty()?0:dp(16);metaRow.addView(dateView,dateLp);
        }
        if(metaRow.getChildCount()>0)mainCard.addView(metaRow);

        // Keep this summary limited to values returned by the API.
        LinearLayout statsRow=row();
        statsRow.setPadding(0,dp(16),0,dp(6));
        String[] statValues={NumberFormat.getIntegerInstance(Locale.US).format(points),verified?"Có":"Chưa"};
        String[] statLabels={"Điểm Eco","Xác minh"};
        for(int i=0;i<statValues.length;i++){
            LinearLayout statCol=column();
            statCol.setGravity(Gravity.CENTER);
            TextView valView=text(statValues[i],18,Color.parseColor("#111827"),true);
            valView.setGravity(Gravity.CENTER);
            statCol.addView(valView);
            TextView lblView=text(statLabels[i],12,Color.parseColor("#64748B"),false);
            lblView.setGravity(Gravity.CENTER);
            lblView.setPadding(0,dp(2),0,0);
            statCol.addView(lblView);
            statsRow.addView(statCol,new LinearLayout.LayoutParams(0,-2,1));
        }
        mainCard.addView(statsRow);
        profileEcoProgress(mainCard, points);

        // Profile shortcuts lead to account data that is stored in Firebase.
        LinearLayout actionRow=row();
        actionRow.setPadding(0,dp(14),0,0);
        Button addressesBtn=new Button(requireContext());
        addressesBtn.setText("Địa chỉ");addressesBtn.setTextSize(14);addressesBtn.setAllCaps(false);
        addressesBtn.setTextColor(Color.parseColor("#166534"));addressesBtn.setBackgroundResource(R.drawable.bg_profile_action_outline);
        addressesBtn.setStateListAnimator(null);addressesBtn.setElevation(0);
        addressesBtn.setMinHeight(dp(46));addressesBtn.setMinimumHeight(dp(46));
        addressesBtn.setOnClickListener(v->go("addresses",null,false));
        actionRow.addView(addressesBtn,new LinearLayout.LayoutParams(0,dp(46),1));

        View btnSpacer=new View(requireContext());
        actionRow.addView(btnSpacer,new LinearLayout.LayoutParams(dp(10),0));

        Button ordersBtn=new Button(requireContext());
        ordersBtn.setText("Đơn hàng");ordersBtn.setTextSize(14);ordersBtn.setAllCaps(false);
        ordersBtn.setTextColor(Color.parseColor("#166534"));ordersBtn.setBackgroundResource(R.drawable.bg_profile_action_outline);
        ordersBtn.setStateListAnimator(null);ordersBtn.setElevation(0);
        ordersBtn.setMinHeight(dp(46));ordersBtn.setMinimumHeight(dp(46));
        ordersBtn.setOnClickListener(v->go("orders",null,false));
        actionRow.addView(ordersBtn,new LinearLayout.LayoutParams(0,dp(46),1));
        mainCard.addView(actionRow);

        body.addView(mainCard,mainCardLp);

        // ─── 3. Pill Tabs Strip (Image 2) ───
        profileTabs(body,new String[]{"📷 Bài đăng","💡 Mẹo","🔖 Đã lưu"},new String[]{"posts","tips","saved"},profileTab,tab->{profileTab=tab;profile();});

        // ─── 4. Posts Grid Content ───
        LinearLayout results=column();body.addView(results);
        if("saved".equals(profileTab))savedPosts(results);
        else showPaged(results,"tips".equals(profileTab)?"/tips?author_id="+enc(uid):"/posts?author_id="+enc(uid),"Chưa có nội dung trong mục này.",post->profilePostCard(results,post));
    }

    /** Profile-specific tab strip with rounded active pill and emoji icons */
    private void profileTabs(LinearLayout parent,String[] labels,String[] values,String selected,Consumer<String> choose){
        LinearLayout container=row();
        container.setBackgroundResource(R.drawable.bg_card);
        container.setElevation(dp(2));
        container.setPadding(dp(4),dp(4),dp(4),dp(4));
        LinearLayout.LayoutParams stripLp=new LinearLayout.LayoutParams(-1,-2);
        stripLp.setMargins(dp(14),dp(12),dp(14),dp(10));
        parent.addView(container,stripLp);
        for(int i=0;i<labels.length;i++){
            String value=values[i];
            Button tab=new Button(requireContext());tab.setText(labels[i]);tab.setTextSize(13);tab.setAllCaps(false);
            tab.setStateListAnimator(null);tab.setElevation(0);tab.setPadding(dp(12),0,dp(12),0);
            tab.setMinHeight(dp(40));tab.setMinimumHeight(dp(40));
            if(value.equals(selected)){tab.setBackgroundResource(R.drawable.bg_tab_active);tab.setTextColor(Color.WHITE);tab.setTypeface(null,Typeface.BOLD);}
            else{tab.setBackgroundResource(R.drawable.bg_tab_inactive);tab.setTextColor(MUTED);tab.setTypeface(null,Typeface.NORMAL);}
            tab.setOnClickListener(v->choose.accept(value));
            LinearLayout.LayoutParams tabLp=new LinearLayout.LayoutParams(0,dp(40),1);
            container.addView(tab,tabLp);
        }
    }

    private void profilePostCard(LinearLayout parent,JSONObject post){
        LinearLayout targetRow=null;
        int count=parent.getChildCount();
        if(count>0){
            View last=parent.getChildAt(count-1);
            if(last instanceof LinearLayout&&((LinearLayout)last).getOrientation()==LinearLayout.HORIZONTAL&&((LinearLayout)last).getChildCount()<2){
                targetRow=(LinearLayout)last;
            }
        }
        if(targetRow==null){
            targetRow=row();
            LinearLayout.LayoutParams rowLp=new LinearLayout.LayoutParams(-1,-2);
            rowLp.setMargins(dp(14),0,dp(14),dp(10));
            parent.addView(targetRow,rowLp);
        }
        boolean isSecond=targetRow.getChildCount()==1;
        android.widget.FrameLayout card=new android.widget.FrameLayout(requireContext());
        card.setBackgroundResource(R.drawable.bg_card);
        card.setClipToOutline(true);
        card.setElevation(dp(2));

        String postId=post.optString("id","");
        JSONArray media=post.optJSONArray("media");
        JSONObject firstMedia=media==null?null:media.optJSONObject(0);
        String mediaId=firstMedia==null?"":firstMedia.optString("id","");
        if(!mediaId.isEmpty()&&!("null".equals(mediaId))){
            ImageView img=new ImageView(requireContext());
            img.setContentDescription("Ảnh bài đăng");
            img.setScaleType(ImageView.ScaleType.CENTER_CROP);
            card.addView(img,new android.widget.FrameLayout.LayoutParams(-1,-1));
            loadImage(img,mediaId);
        }else{
            card.setBackgroundResource(R.drawable.bg_card_mint);
            String title=post.optString("title","").trim();
            if(title.isEmpty())title=post.optString("body","").trim();
            if(title.isEmpty())title="Bài chia sẻ";
            TextView titleView=text(title,15,INK,true);
            titleView.setMaxLines(5);
            titleView.setEllipsize(android.text.TextUtils.TruncateAt.END);
            titleView.setGravity(Gravity.CENTER_VERTICAL);
            titleView.setPadding(dp(14),dp(12),dp(14),dp(12));
            card.addView(titleView,new android.widget.FrameLayout.LayoutParams(-1,-1));
        }

        int likes=Math.max(0,post.optInt("like_count",0));
        TextView likeBadge=text("❤️ "+likes,11,Color.WHITE,true);
        likeBadge.setBackgroundResource(R.drawable.bg_frosted_pill);
        if(likeBadge.getBackground()!=null)likeBadge.getBackground().setTint(Color.parseColor("#99000000"));
        likeBadge.setPadding(dp(8),dp(3),dp(8),dp(3));
        android.widget.FrameLayout.LayoutParams badgeLp=new android.widget.FrameLayout.LayoutParams(-2,-2);
        badgeLp.gravity=Gravity.BOTTOM|Gravity.START;
        badgeLp.setMargins(dp(8),0,0,dp(8));
        card.addView(likeBadge,badgeLp);

        if(!postId.isEmpty())card.setOnClickListener(v->go("post_detail",postId,false));
        else card.setContentDescription("Bài viết chưa có mã để mở chi tiết");

        LinearLayout.LayoutParams cardLp=new LinearLayout.LayoutParams(0,dp(180),1);
        cardLp.setMargins(isSecond?dp(5):0,0,isSecond?0:dp(5),0);
        targetRow.addView(card,cardLp);
    }
    private void savedPosts(LinearLayout results){
        LinearLayout posts=column(),tips=column();results.addView(text("BÀI VIẾT ĐÃ LƯU",12,MUTED,true));results.addView(posts);results.addView(text("MẸO HAY ĐÃ LƯU",12,MUTED,true));results.addView(tips);
        savedSection(posts,"/posts?saved=true",null);savedSection(tips,"/tips?saved=true",null);
    }
    private void savedSection(LinearLayout target,String path,String cursor){
        savedSection(target,path,cursor,0);
    }
    private void savedSection(LinearLayout target,String path,String cursor,int emptyPages){
        TextView wait=loading(target);int version=viewVersion;
        api.request("GET",pagePath(path,cursor==null?"":cursor),null,null,new FirebaseBackendClient.Callback<JSONObject>(){
            public void onSuccess(JSONObject response){
                if(body==null||version!=viewVersion||!isAdded())return;
                target.removeView(wait);JSONArray entries=response.optJSONArray("items");int rendered=0;
                if(entries!=null)for(int i=0;i<entries.length();i++){JSONObject post=entries.optJSONObject(i);if(post!=null){postCard(target,post,false);rendered++;}}
                String next=response.optString("next_cursor","");if("null".equals(next)||next.equals(cursor))next="";
                if(rendered==0&&!next.isEmpty()&&emptyPages<3){savedSection(target,path,next,emptyPages+1);return;}
                if(!next.isEmpty()){
                    if(target.getChildCount()==0)empty(target,"Chưa thấy nội dung phù hợp trong các mục đã lưu gần đây.");
                    String following=next;Button more=button("Xem tiếp nội dung đã lưu",()->{});
                    more.setOnClickListener(v->{target.removeView(more);savedSection(target,path,following);});target.addView(more);
                }else if(target.getChildCount()==0)empty(target,"Chưa có nội dung đã lưu.");
            }
            public void onError(FirebaseBackendClient.BackendException error){if(body==null||version!=viewVersion||!isAdded())return;wait.setText("Chưa tải được dữ liệu\n\n"+error.getMessage()+"\n\nChạm để thử lại");wait.setBackgroundResource(R.drawable.community_card);wait.setOnClickListener(v->{target.removeView(wait);savedSection(target,path,cursor);});}
        });
    }
    private EditText field(LinearLayout parent,String hint,String initial,int max,int type){EditText entry=input(hint,max,0);entry.setInputType(type);entry.setText(initial);LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);lp.topMargin=dp(8);parent.addView(entry,lp);return entry;}
    private View profileImageTile(String label, int iconResource, Runnable chooseImage) {
        LinearLayout tile = column();
        tile.setGravity(Gravity.CENTER);
        tile.setPadding(dp(8), dp(12), dp(8), dp(12));
        tile.setMinimumHeight(dp(100));
        tile.setBackgroundResource(R.drawable.bg_card);
        tile.setElevation(dp(2));
        tile.setClipToOutline(true);
        tile.setForeground(new android.graphics.drawable.RippleDrawable(
                android.content.res.ColorStateList.valueOf(0x263BAA76), null, null));
        tile.setContentDescription(label);
        tile.setFocusable(true);

        FrameLayout iconBadge = new FrameLayout(requireContext());
        iconBadge.setBackgroundResource(R.drawable.bg_nav_create);
        ImageView icon = new ImageView(requireContext());
        icon.setImageResource(iconResource);
        icon.setColorFilter(Color.WHITE);
        icon.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        iconBadge.addView(icon, new FrameLayout.LayoutParams(dp(20), dp(20), Gravity.CENTER));
        tile.addView(iconBadge, new LinearLayout.LayoutParams(dp(40), dp(40)));

        TextView title = text(label, 13, INK, true);
        title.setGravity(Gravity.CENTER);
        title.setMaxLines(2);
        title.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(-1, -2);
        titleParams.topMargin = dp(8);
        tile.addView(title, titleParams);
        tile.setOnTouchListener((view, event) -> {
            if (event.getActionMasked() == MotionEvent.ACTION_DOWN) view.animate().scaleX(.97f).scaleY(.97f).setDuration(80).start();
            else if (event.getActionMasked() == MotionEvent.ACTION_UP || event.getActionMasked() == MotionEvent.ACTION_CANCEL)
                view.animate().scaleX(1f).scaleY(1f).setDuration(130).start();
            return false;
        });
        tile.setOnClickListener(view -> chooseImage.run());
        return tile;
    }

    private void editProfile(){
        header("Chỉnh sửa hồ sơ",true);body.removeAllViews();if(!signedIn())return;JSONObject profile=BackendSession.profile();
        label("ẢNH HỒ SƠ");
        LinearLayout imageActions=row();
        imageActions.addView(profileImageTile("Đổi ảnh đại diện",R.drawable.ic_nav_profile,
                ()->{if(!busy)profileAvatarPicker.launch("image/*");}),new LinearLayout.LayoutParams(0,-2,1));
        View imageGap=new View(requireContext());imageActions.addView(imageGap,new LinearLayout.LayoutParams(dp(10),0));
        imageActions.addView(profileImageTile("Đổi ảnh bìa",R.drawable.ic_camera,
                ()->{if(!busy)profileCoverPicker.launch("image/*");}),new LinearLayout.LayoutParams(0,-2,1));
        body.addView(imageActions);
        label("TÊN HIỂN THỊ");EditText name=field(body,"Tên hiển thị",profile.optString("display_name"),100,InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_FLAG_CAP_WORDS);
        label("GIỚI THIỆU");EditText bio=field(body,"Câu chuyện của bạn",profile.optString("bio",""),1000,InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_FLAG_MULTI_LINE);bio.setMinLines(3);
        label("THÀNH PHỐ");EditText location=field(body,"Tỉnh / thành phố",profile.optString("city",""),100,InputType.TYPE_CLASS_TEXT);
        action("Lưu",()->{String value=name.getText().toString().trim();if(value.isEmpty()){name.setError("Nhập tên hiển thị.");return;}send("PATCH","/me",json("display_name",value,"bio",bio.getText().toString().trim(),"city",location.getText().toString().trim().isEmpty()?JSONObject.NULL:location.getText().toString().trim()),null,updated->{BackendSession.setProfile(updated);message("Đã lưu hồ sơ trên Firebase.");go("profile",null,false);});});
    }
    private void uploadProfileImage(String field,Uri uri){
        if(busy||!signedIn())return;
        JSONObject profile=BackendSession.profile();String uid=profile.optString("id",profile.optString("uid",""));
        if(uid.isEmpty()||"null".equals(uid)){message("Không xác định được tài khoản hiện tại.");return;}
        busy=true;FirebaseBackendClient client=api;Context context=requireContext().getApplicationContext();boolean compact=client.isSparkLocal();
        images.execute(()->{
            try(InputStream stream=context.getContentResolver().openInputStream(uri)){
                byte[] original=readImage(stream);String detected=context.getContentResolver().getType(uri);String mime=detected==null?"image/jpeg":detected;
                if(!mime.matches("image/(jpeg|png|webp)"))throw new IllegalArgumentException("Chọn ảnh JPEG, PNG hoặc WebP.");
                PhotoUploadEncoder.Photo photo=compact?PhotoUploadEncoder.forFirestore(original):null;byte[] bytes=photo==null?original:photo.bytes;String contentType=photo==null?mime:photo.mime;
                client.uploadMedia("AVATAR",uid,contentType,bytes,new FirebaseBackendClient.Callback<JSONObject>(){
                    @Override public void onSuccess(JSONObject asset){
                        String mediaId=asset.optString("id","");
                        if(mediaId.isEmpty()||"null".equals(mediaId)){finishProfileImage(false,"Máy chủ không trả về ảnh đã tải lên.");return;}
                        client.request("PATCH","/me",json(field,mediaId),null,new FirebaseBackendClient.Callback<JSONObject>(){
                            @Override public void onSuccess(JSONObject updated){BackendSession.setProfile(updated);finishProfileImage(true,"cover_key".equals(field)?"Đã đổi ảnh bìa hồ sơ.":"Đã đổi ảnh đại diện.");}
                            @Override public void onError(FirebaseBackendClient.BackendException error){finishProfileImage(false,"Ảnh đã tải lên nhưng chưa cập nhật được hồ sơ: "+error.getMessage());}
                        });
                    }
                    @Override public void onError(FirebaseBackendClient.BackendException error){finishProfileImage(false,"Chưa tải được ảnh lên Firebase: "+error.getMessage());}
                });
            }catch(Exception error){finishProfileImage(false,"Không thể đọc ảnh đã chọn: "+error.getMessage());}
        });
    }
    private void finishProfileImage(boolean success,String notice){main.post(()->{busy=false;if(body==null||!isAdded())return;message(notice);if(success&&"edit_profile".equals(destination))go("profile",null,false);});}
    private void addresses(){
        header("Địa chỉ nhận hàng",true);
        body.removeAllViews();
        if(!signedIn())return;
        action("＋ Thêm",()->addressForm(null));
        TextView add=root.findViewById(R.id.community_action);
        add.setBackgroundResource(R.drawable.bg_primary_button);
        add.setTextColor(Color.WHITE);
        add.setPadding(dp(14),0,dp(14),0);
        TextView wait=loading(body);
        get("/me/addresses",response->{
            body.removeView(wait);
            JSONArray entries=response.optJSONArray("items");
            if(entries==null||entries.length()==0){
                LinearLayout blank=card(body);
                blank.setPadding(dp(20),dp(26),dp(20),dp(26));
                ImageView icon=new ImageView(requireContext());icon.setImageResource(R.drawable.ic_map_pin);icon.setColorFilter(GREEN);
                LinearLayout.LayoutParams iconLp=new LinearLayout.LayoutParams(dp(32),dp(32));iconLp.gravity=Gravity.CENTER_HORIZONTAL;blank.addView(icon,iconLp);
                TextView title=text("Chưa có địa chỉ nhận hàng",16,INK,true);title.setGravity(Gravity.CENTER);
                LinearLayout.LayoutParams titleLp=new LinearLayout.LayoutParams(-1,-2);titleLp.topMargin=dp(8);blank.addView(title,titleLp);
                TextView hint=text("Thêm địa chỉ để nhận hàng thuận tiện hơn.",13,MUTED,false);hint.setGravity(Gravity.CENTER);
                LinearLayout.LayoutParams hintLp=new LinearLayout.LayoutParams(-1,-2);hintLp.topMargin=dp(4);blank.addView(hint,hintLp);
                Button create=button("＋ Thêm địa chỉ",()->addressForm(null));create.setTextColor(Color.WHITE);create.setTypeface(null,Typeface.BOLD);create.setTextSize(14);create.setBackgroundResource(R.drawable.bg_primary_button);create.setBackgroundTintList(null);
                LinearLayout.LayoutParams createLp=new LinearLayout.LayoutParams(-1,dp(48));createLp.topMargin=dp(20);blank.addView(create,createLp);
                return;
            }
            for(int i=0;i<entries.length();i++){
                JSONObject address=entries.optJSONObject(i);
                if(address!=null)addressCard(address);
            }
        });
    }
    private void addressCard(JSONObject address){
        LinearLayout tile=card(body);
        tile.setPadding(dp(18),dp(18),dp(18),dp(16));
        LinearLayout heading=row();heading.setGravity(Gravity.CENTER_VERTICAL);
        TextView recipient=text(address.optString("recipient"),17,INK,true);
        recipient.setMaxLines(2);
        heading.addView(recipient,new LinearLayout.LayoutParams(0,-2,1));
        if(address.optBoolean("is_default")){
            TextView badge=text("✓ Mặc định",11,GREEN,true);
            badge.setGravity(Gravity.CENTER);
            badge.setPadding(dp(10),dp(5),dp(10),dp(5));
            badge.setBackgroundResource(R.drawable.bg_address_default_badge);
            LinearLayout.LayoutParams badgeLp=new LinearLayout.LayoutParams(-2,-2);badgeLp.leftMargin=dp(8);heading.addView(badge,badgeLp);
        }
        tile.addView(heading);
        addressDetail(tile,R.drawable.ic_phone,address.optString("phone"),dp(13));
        String line=address.optString("line").trim(),city=address.optString("city").trim();
        addressDetail(tile,R.drawable.ic_map_pin,line.isEmpty()?city:city.isEmpty()?line:line+", "+city,dp(8));
        View divider=new View(requireContext());divider.setBackgroundColor(0xFFE7F0EB);
        LinearLayout.LayoutParams dividerLp=new LinearLayout.LayoutParams(-1,dp(1));dividerLp.topMargin=dp(18);dividerLp.bottomMargin=dp(14);tile.addView(divider,dividerLp);
        LinearLayout actions=row();
        Button edit=button("Chỉnh sửa",()->addressForm(address));
        edit.setTextSize(14);edit.setTypeface(null,Typeface.BOLD);edit.setTextColor(Color.WHITE);
        edit.setBackgroundResource(R.drawable.bg_primary_button);edit.setBackgroundTintList(null);edit.setElevation(0);
        LinearLayout.LayoutParams editLp=new LinearLayout.LayoutParams(0,dp(48),1);editLp.rightMargin=dp(5);actions.addView(edit,editLp);
        Button delete=button("Xóa",()->new androidx.appcompat.app.AlertDialog.Builder(requireContext()).setTitle("Xóa địa chỉ?").setPositiveButton("Xóa",(dialog,which)->send("DELETE","/me/addresses/"+enc(address.optString("id")),null,null,result->addresses())).setNegativeButton("Giữ lại",null).show());
        delete.setTextSize(14);delete.setTypeface(null,Typeface.BOLD);delete.setTextColor(0xFFB42318);
        delete.setBackgroundResource(R.drawable.bg_order_cancel);delete.setBackgroundTintList(null);delete.setElevation(0);
        LinearLayout.LayoutParams deleteLp=new LinearLayout.LayoutParams(0,dp(48),1);deleteLp.leftMargin=dp(5);actions.addView(delete,deleteLp);
        tile.addView(actions);
    }
    private void addressDetail(LinearLayout tile,int icon,String value,int topMargin){
        LinearLayout line=row();line.setGravity(Gravity.TOP);
        LinearLayout.LayoutParams lineLp=new LinearLayout.LayoutParams(-1,-2);lineLp.topMargin=topMargin;
        ImageView image=new ImageView(requireContext());image.setImageResource(icon);image.setColorFilter(GREEN);
        LinearLayout.LayoutParams iconLp=new LinearLayout.LayoutParams(dp(18),dp(18));iconLp.topMargin=dp(2);iconLp.rightMargin=dp(10);line.addView(image,iconLp);
        TextView detail=text(value,14,INK,false);line.addView(detail,new LinearLayout.LayoutParams(0,-2,1));
        tile.addView(line,lineLp);
    }
    private void addressForm(JSONObject existing){
        JSONObject original=existing==null?new JSONObject():existing;LinearLayout form=column();form.setPadding(dp(16),dp(8),dp(16),dp(8));
        EditText recipient=field(form,"Người nhận",original.optString("recipient"),100,InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_FLAG_CAP_WORDS),phone=field(form,"Số điện thoại",original.optString("phone"),16,InputType.TYPE_CLASS_PHONE),line=field(form,"Số nhà, đường, phường / xã",original.optString("line"),300,InputType.TYPE_CLASS_TEXT),location=field(form,"Tỉnh / thành phố",original.optString("city"),100,InputType.TYPE_CLASS_TEXT);
        android.widget.CheckBox defaultAddress=new android.widget.CheckBox(requireContext());defaultAddress.setText("Đặt làm địa chỉ mặc định");defaultAddress.setChecked(original.optBoolean("is_default",existing==null));defaultAddress.setMinHeight(dp(48));form.addView(defaultAddress);
        ScrollView container=new ScrollView(requireContext());container.addView(form);androidx.appcompat.app.AlertDialog dialog=new androidx.appcompat.app.AlertDialog.Builder(requireContext()).setTitle(existing==null?"Thêm địa chỉ":"Sửa địa chỉ").setView(container).setPositiveButton("Lưu",null).setNegativeButton("Đóng",null).create();
        dialog.setOnShowListener(d->dialog.getButton(androidx.appcompat.app.AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{String who=recipient.getText().toString().trim(),number=phone.getText().toString().trim(),addressLine=line.getText().toString().trim(),cityName=location.getText().toString().trim();if(who.isEmpty()){recipient.setError("Nhập tên người nhận.");return;}if(!number.matches("\\+?[0-9]{8,15}")){phone.setError("Số điện thoại từ 8 đến 15 chữ số.");return;}if(addressLine.isEmpty()){line.setError("Nhập địa chỉ.");return;}if(cityName.isEmpty()){location.setError("Nhập tỉnh / thành phố.");return;}send(existing==null?"POST":"PATCH","/me/addresses"+(existing==null?"":"/"+enc(existing.optString("id"))),json("recipient",who,"phone",number,"line",addressLine,"city",cityName,"is_default",defaultAddress.isChecked()),null,result->{dialog.dismiss();addresses();});}));dialog.show();
    }
    private void orders(){
        deactivatePage();header("Đơn mua & đơn bán",true);body.removeAllViews();if(!signedIn())return;action("Làm mới",()->{resetPagedData();orders();});root.<TextView>findViewById(R.id.community_action).setBackgroundResource(R.drawable.bg_profile_action_outline);String uid=BackendSession.profile().optString("id");
        showPaged(body,"/me/orders","Chưa có đơn hàng nào trên tài khoản này.",order->orderCard(body,order,uid));
    }
    private void orderCard(LinearLayout parent,JSONObject order,String uid){
        String id=order.optString("id"),state=order.optString("status");
        boolean buyer=uid.equals(order.optString("buyer_id"));
        LinearLayout tile=card(parent);tile.setPadding(dp(18),dp(17),dp(18),dp(8));
        tile.setClickable(true);tile.setFocusable(true);tile.setOnClickListener(v->go("order_detail",id,false));
        LinearLayout heading=row();heading.setGravity(Gravity.TOP);
        ImageView icon=new ImageView(requireContext());icon.setImageResource(R.drawable.ic_nav_market);icon.setColorFilter(GREEN);icon.setBackgroundResource(R.drawable.bg_chat_action);icon.setPadding(dp(10),dp(10),dp(10),dp(10));
        LinearLayout.LayoutParams iconLp=new LinearLayout.LayoutParams(dp(44),dp(44));iconLp.rightMargin=dp(12);heading.addView(icon,iconLp);
        LinearLayout identity=column();
        identity.addView(text(buyer?"Đơn mua":"Đơn bán",16,INK,true));
        TextView code=text("Mã #"+shortId(id),12,MUTED,false);code.setSingleLine(true);code.setEllipsize(android.text.TextUtils.TruncateAt.END);
        LinearLayout.LayoutParams codeLp=new LinearLayout.LayoutParams(-1,-2);codeLp.topMargin=dp(2);identity.addView(code,codeLp);
        heading.addView(identity,new LinearLayout.LayoutParams(0,-2,1));
        TextView status=text(statusLabel(state),11,orderStatusColor(state),true);
        status.setGravity(Gravity.CENTER);status.setPadding(dp(10),dp(5),dp(10),dp(5));
        status.setBackgroundResource(orderStatusBackground(state));
        LinearLayout.LayoutParams statusLp=new LinearLayout.LayoutParams(-2,-2);statusLp.leftMargin=dp(8);statusLp.topMargin=dp(4);heading.addView(status,statusLp);
        tile.addView(heading);
        LinearLayout summary=row();summary.setGravity(Gravity.BOTTOM);
        LinearLayout.LayoutParams summaryLp=new LinearLayout.LayoutParams(-1,-2);summaryLp.topMargin=dp(16);
        LinearLayout amount=column();amount.addView(text("TỔNG TIỀN",11,MUTED,true));
        TextView total=text(currency(order.optLong("total_vnd")),21,INK,true);
        LinearLayout.LayoutParams totalLp=new LinearLayout.LayoutParams(-1,-2);totalLp.topMargin=dp(2);amount.addView(total,totalLp);
        summary.addView(amount,new LinearLayout.LayoutParams(0,-2,1));
        String orderDate=date(order.optString("created_at"));
        if(!orderDate.isEmpty()){TextView dateView=text(orderDate,12,MUTED,false);dateView.setGravity(Gravity.END);summary.addView(dateView);}
        tile.addView(summary,summaryLp);
        View divider=new View(requireContext());divider.setBackgroundColor(0xFFE7F0EB);
        LinearLayout.LayoutParams dividerLp=new LinearLayout.LayoutParams(-1,dp(1));dividerLp.topMargin=dp(14);tile.addView(divider,dividerLp);
        LinearLayout detail=row();detail.setMinimumHeight(dp(46));
        TextView detailLabel=text("Xem chi tiết đơn hàng",14,GREEN,true);detail.addView(detailLabel,new LinearLayout.LayoutParams(0,-2,1));
        ImageView arrow=new ImageView(requireContext());arrow.setImageResource(R.drawable.ic_chevron_right);arrow.setColorFilter(GREEN);detail.addView(arrow,new LinearLayout.LayoutParams(dp(20),dp(20)));
        tile.addView(detail);
    }
    private int orderStatusColor(String state){
        if("CANCELLED".equals(state)||"FAILED".equals(state)||"REFUNDED".equals(state))return 0xFFB42318;
        if("PENDING_PAYMENT".equals(state)||"DISPUTED".equals(state))return 0xFF8A5500;
        return GREEN;
    }
    private int orderStatusBackground(String state){
        if("CANCELLED".equals(state)||"FAILED".equals(state)||"REFUNDED".equals(state))return R.drawable.bg_badge_rejected;
        if("PENDING_PAYMENT".equals(state)||"DISPUTED".equals(state))return R.drawable.bg_badge_pending;
        return R.drawable.bg_address_default_badge;
    }
    private void orderDetail(){
        header("Chi tiết đơn hàng",true);body.removeAllViews();
        if(!signedIn())return;
        if(entityId==null||entityId.isEmpty()){empty(body,"Chưa chọn đơn hàng.");return;}
        String orderId=entityId;
        int serial=++orderDetailSerial;
        action("Làm mới",this::orderDetail);
        root.<TextView>findViewById(R.id.community_action).setBackgroundResource(R.drawable.bg_profile_action_outline);
        TextView wait=loading(body);
        getFresh("/orders/"+enc(orderId),order->{
            if(serial!=orderDetailSerial||!orderId.equals(entityId))return;
            body.removeView(wait);
            String state=order.optString("status"),uid=BackendSession.profile().optString("id");
            boolean buyer=uid.equals(order.optString("buyer_id")),seller=uid.equals(order.optString("seller_id"));
            int statusColor=orderStatusColor(state);
            LinearLayout summary=card(body);summary.setPadding(dp(18),dp(18),dp(18),dp(17));
            LinearLayout top=row();
            ImageView icon=new ImageView(requireContext());
            icon.setImageResource("SHIPPED".equals(state)?R.drawable.ic_truck:"COMPLETED".equals(state)?R.drawable.ic_verified:"PENDING_PAYMENT".equals(state)?R.drawable.ic_wallet:"CANCELLED".equals(state)?R.drawable.ic_close_danger:R.drawable.ic_nav_market);
            icon.setColorFilter(statusColor);icon.setBackgroundResource(orderStatusBackground(state));icon.setPadding(dp(12),dp(12),dp(12),dp(12));
            LinearLayout.LayoutParams iconLp=new LinearLayout.LayoutParams(dp(48),dp(48));iconLp.rightMargin=dp(12);top.addView(icon,iconLp);
            LinearLayout heading=column();heading.addView(text(buyer?"ĐƠN MUA":"ĐƠN BÁN",11,MUTED,true));heading.addView(text(statusLabel(state),20,statusColor,true));
            top.addView(heading,new LinearLayout.LayoutParams(0,-2,1));summary.addView(top);
            View divider=new View(requireContext());divider.setBackgroundColor(0xFFE7F0EB);
            LinearLayout.LayoutParams dividerLp=new LinearLayout.LayoutParams(-1,dp(1));dividerLp.topMargin=dp(16);dividerLp.bottomMargin=dp(12);summary.addView(divider,dividerLp);
            LinearLayout codeRow=row();codeRow.addView(text("Mã đơn",13,MUTED,false),new LinearLayout.LayoutParams(0,-2,1));codeRow.addView(text("#"+shortId(order.optString("id")),13,INK,true));summary.addView(codeRow);
            String created=date(order.optString("created_at"));
            if(!created.isEmpty()){LinearLayout dateRow=row();LinearLayout.LayoutParams dateLp=new LinearLayout.LayoutParams(-1,-2);dateLp.topMargin=dp(7);dateRow.addView(text("Ngày đặt",13,MUTED,false),new LinearLayout.LayoutParams(0,-2,1));dateRow.addView(text(created,13,INK,false));summary.addView(dateRow,dateLp);}
            LinearLayout totalRow=row();LinearLayout.LayoutParams totalLp=new LinearLayout.LayoutParams(-1,-2);totalLp.topMargin=dp(17);
            totalRow.addView(text("CANCELLED".equals(state)?"Giá trị đơn hàng":"Tổng thanh toán",14,INK,true),new LinearLayout.LayoutParams(0,-2,1));totalRow.addView(text(currency(order.optLong("total_vnd")),23,GREEN,true));summary.addView(totalRow,totalLp);

            JSONArray items=order.optJSONArray("items");
            label("SẢN PHẨM"+(items==null?"":" ("+items.length()+")"));
            LinearLayout products=card(body);products.setPadding(dp(18),dp(8),dp(18),dp(8));
            if(items==null||items.length()==0){TextView none=text("Chưa có thông tin sản phẩm.",13,MUTED,false);none.setPadding(0,dp(12),0,dp(12));products.addView(none);}
            else for(int i=0;i<items.length();i++){
                JSONObject item=items.optJSONObject(i);if(item==null)continue;
                if(i>0){View separator=new View(requireContext());separator.setBackgroundColor(0xFFE7F0EB);products.addView(separator,new LinearLayout.LayoutParams(-1,dp(1)));}
                LinearLayout itemRow=row();itemRow.setPadding(0,dp(12),0,dp(12));
                LinearLayout itemText=column();itemText.addView(text(item.optString("title_snapshot",item.optString("name","Sản phẩm")),15,INK,true));
                TextView quantity=text(item.optInt("quantity")+" × "+currency(item.optLong("unit_price_vnd")),13,MUTED,false);
                LinearLayout.LayoutParams quantityLp=new LinearLayout.LayoutParams(-1,-2);quantityLp.topMargin=dp(5);itemText.addView(quantity,quantityLp);
                itemRow.addView(itemText,new LinearLayout.LayoutParams(0,-2,1));
                TextView itemTotal=text(currency(item.optLong("unit_price_vnd")*item.optInt("quantity")),14,INK,true);itemTotal.setPadding(dp(8),0,0,0);itemRow.addView(itemTotal);
                products.addView(itemRow);
            }

            JSONObject delivery=order.optJSONObject("delivery_snapshot");
            if(delivery==null){try{delivery=new JSONObject(order.optString("delivery_snapshot",""));}catch(JSONException ignored){}}
            String carrier=order.optString("carrier","");
            if(delivery!=null||!carrier.isEmpty()){
                label("GIAO HÀNG");LinearLayout shipping=card(body);shipping.setPadding(dp(18),dp(16),dp(18),dp(16));
                if(delivery!=null){
                    shipping.addView(text(delivery.optString("recipient","Người nhận"),15,INK,true));
                    String phone=delivery.optString("phone","");if(!phone.isEmpty())addressDetail(shipping,R.drawable.ic_phone,phone,dp(9));
                    String line=delivery.optString("line",""),city=delivery.optString("city","");
                    String address=line.isEmpty()?city:city.isEmpty()?line:line+", "+city;
                    if(!address.isEmpty())addressDetail(shipping,R.drawable.ic_map_pin,address,dp(7));
                }
                if(!carrier.isEmpty()){
                    View shippingDivider=new View(requireContext());shippingDivider.setBackgroundColor(0xFFE7F0EB);
                    LinearLayout.LayoutParams shippingDividerLp=new LinearLayout.LayoutParams(-1,dp(1));shippingDividerLp.topMargin=dp(14);shippingDividerLp.bottomMargin=dp(11);shipping.addView(shippingDivider,shippingDividerLp);
                    shipping.addView(text("Vận chuyển: "+carrier,13,INK,true));
                    String tracking=order.optString("tracking_code","");if(!tracking.isEmpty())shipping.addView(text("Mã vận đơn: "+tracking,12,MUTED,false));
                }
            }

            label("THANH TOÁN");
            LinearLayout paymentCard=card(body);paymentCard.setPadding(dp(18),dp(16),dp(18),dp(15));
            paymentCard.addView(text("Chi tiết thanh toán",16,INK,true));
            orderAmountLine(paymentCard,"Tiền hàng",order.optLong("subtotal_vnd",order.optLong("total_vnd")));
            orderAmountLine(paymentCard,"Phí vận chuyển",order.optLong("shipping_vnd"));
            View paymentDivider=new View(requireContext());paymentDivider.setBackgroundColor(0xFFE7F0EB);
            LinearLayout.LayoutParams paymentDividerLp=new LinearLayout.LayoutParams(-1,dp(1));paymentDividerLp.topMargin=dp(13);paymentDividerLp.bottomMargin=dp(11);paymentCard.addView(paymentDivider,paymentDividerLp);
            LinearLayout grandTotal=row();grandTotal.addView(text("Tổng cộng",14,INK,true),new LinearLayout.LayoutParams(0,-2,1));grandTotal.addView(text(currency(order.optLong("total_vnd")),18,GREEN,true));paymentCard.addView(grandTotal);
            if("PENDING_PAYMENT".equals(state)&&buyer){
                String demoKey=demoPaymentKey(orderId);
                String demoProvider="VNPAY".equals(demoPayments().getString(demoKey+"provider",""))?"VNPay":"MoMo";
                String demoLine=demoPayments().getBoolean(demoKey+"completed",false)
                        ? "Đã thử giao diện "+demoProvider+" · Không chuyển tiền"
                        : "Chưa thực hiện thanh toán thử";
                TextView demoState=text(demoLine,13,GREEN,true);
                LinearLayout.LayoutParams demoLp=new LinearLayout.LayoutParams(-1,-2);
                demoLp.topMargin=dp(14);
                paymentCard.addView(demoState,demoLp);
                paymentCard.addView(text("Bản demo không tạo giao dịch và không đổi trạng thái đơn hàng.",12,MUTED,false));
            }

            if("PENDING_PAYMENT".equals(state)){
                label("THAO TÁC ĐƠN HÀNG");
                if(buyer){
                    body.addView(text("Thử chọn MoMo hoặc VNPay. Đây chỉ là giao diện demo, không chuyển tiền thật.",13,MUTED,false));
                    orderActionButton("Thanh toán thử · Demo",R.drawable.ic_wallet_white,false,()->go("payment_demo",orderId,false));
                }
                orderActionButton("Hủy đơn hàng",R.drawable.ic_close_danger,true,()->new androidx.appcompat.app.AlertDialog.Builder(requireContext()).setTitle("Hủy đơn hàng?").setMessage("Đơn sẽ được hủy trên hệ thống.").setPositiveButton("Hủy đơn",(dialog,which)->send("POST","/orders/"+enc(entityId)+"/cancel",json("reason","Người dùng yêu cầu hủy đơn trên Android"),null,result->orderDetail())).setNegativeButton("Giữ đơn",null).show());
            }
            if("PAID".equals(state)&&seller){label("THAO TÁC ĐƠN HÀNG");orderActionButton("Xác nhận gửi hàng",R.drawable.ic_truck,false,this::shipOrder);}
            if("SHIPPED".equals(state)&&buyer){label("THAO TÁC ĐƠN HÀNG");orderActionButton("Đã nhận được hàng",R.drawable.ic_verified,false,()->send("POST","/orders/"+enc(entityId)+"/complete",json(),null,result->{api.getMe(callback(BackendSession::setProfile));orderDetail();}));}
        });
    }
    private void orderAmountLine(LinearLayout parent,String label,long amount){
        LinearLayout line=row();LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);lp.topMargin=dp(11);
        line.addView(text(label,13,MUTED,false),new LinearLayout.LayoutParams(0,-2,1));line.addView(text(currency(amount),13,INK,false));parent.addView(line,lp);
    }
    private void shipOrder(){LinearLayout form=column();form.setPadding(dp(16),dp(8),dp(16),dp(8));EditText carrier=field(form,"Đơn vị vận chuyển","",200,InputType.TYPE_CLASS_TEXT),tracking=field(form,"Mã vận đơn","",200,InputType.TYPE_CLASS_TEXT);new androidx.appcompat.app.AlertDialog.Builder(requireContext()).setTitle("Xác nhận gửi hàng").setView(form).setPositiveButton("Gửi",(dialog,which)->{if(carrier.getText().toString().trim().isEmpty()||tracking.getText().toString().trim().isEmpty()){message("Nhập đơn vị vận chuyển và mã vận đơn.");return;}send("POST","/orders/"+enc(entityId)+"/ship",json("carrier",carrier.getText().toString().trim(),"tracking_code",tracking.getText().toString().trim()),null,result->orderDetail());}).setNegativeButton("Đóng",null).show();}
    private void myListings(){
        deactivatePage();header("Tin bán của tôi",true);body.removeAllViews();if(!signedIn())return;
        action("＋ Đăng bán",()->go("create_listing",null,false));
        TextView add=root.findViewById(R.id.community_action);add.setBackgroundResource(R.drawable.bg_primary_button);add.setTextColor(Color.WHITE);add.setPadding(dp(14),0,dp(14),0);
        showPaged(body,"/me/listings","Bạn chưa đăng bán sản phẩm nào.",listing->myListingCard(body,listing));
    }
    private void myListingCard(LinearLayout parent,JSONObject listing){
        String id=listing.optString("id"),state=listing.optString("status");
        boolean rejected="REJECTED".equals(state),pending="PENDING".equals(state),hidden="HIDDEN".equals(state);
        int stateColor=rejected?0xFFB42318:pending?0xFF8A5500:hidden?MUTED:GREEN;
        int stateBackground=rejected?R.drawable.bg_badge_rejected:pending?R.drawable.bg_badge_pending:hidden?R.drawable.bg_friends_decline:R.drawable.bg_address_default_badge;
        LinearLayout tile=card(parent);tile.setPadding(dp(18),dp(17),dp(18),dp(16));
        LinearLayout heading=row();heading.setGravity(Gravity.TOP);
        ImageView icon=new ImageView(requireContext());icon.setImageResource(R.drawable.ic_nav_market);icon.setColorFilter(GREEN);icon.setBackgroundResource(R.drawable.bg_chat_action);icon.setPadding(dp(10),dp(10),dp(10),dp(10));
        LinearLayout.LayoutParams iconLp=new LinearLayout.LayoutParams(dp(44),dp(44));iconLp.rightMargin=dp(12);heading.addView(icon,iconLp);
        LinearLayout listingInfo=column();listingInfo.addView(text(listing.optString("title"),16,INK,true));
        String city=listing.optString("city","").trim();
        if(!city.isEmpty()){TextView cityText=text(city,12,MUTED,false);LinearLayout.LayoutParams cityLp=new LinearLayout.LayoutParams(-1,-2);cityLp.topMargin=dp(3);listingInfo.addView(cityText,cityLp);}
        heading.addView(listingInfo,new LinearLayout.LayoutParams(0,-2,1));tile.addView(heading);
        LinearLayout statusRow=row();LinearLayout.LayoutParams statusRowLp=new LinearLayout.LayoutParams(-1,-2);statusRowLp.topMargin=dp(13);
        TextView badge=text(statusLabel(state),11,stateColor,true);badge.setGravity(Gravity.CENTER);badge.setPadding(dp(10),dp(5),dp(10),dp(5));badge.setBackgroundResource(stateBackground);
        statusRow.addView(badge);
        String created=date(listing.optString("created_at"));
        if(!created.isEmpty()){TextView createdView=text("Đăng ngày "+created,12,MUTED,false);createdView.setGravity(Gravity.END);statusRow.addView(createdView,new LinearLayout.LayoutParams(0,-2,1));}
        tile.addView(statusRow,statusRowLp);
        String reason=listing.optString("moderation_reason","");
        if((rejected||hidden)&&!reason.isEmpty()&&!"null".equals(reason)){
            TextView reasonView=text((rejected?"Lý do từ chối: ":"Ghi chú: ")+reason,12,rejected?0xFFB42318:MUTED,false);
            LinearLayout.LayoutParams reasonLp=new LinearLayout.LayoutParams(-1,-2);reasonLp.topMargin=dp(10);tile.addView(reasonView,reasonLp);
        }
        View divider=new View(requireContext());divider.setBackgroundColor(0xFFE7F0EB);
        LinearLayout.LayoutParams dividerLp=new LinearLayout.LayoutParams(-1,dp(1));dividerLp.topMargin=dp(15);dividerLp.bottomMargin=dp(13);tile.addView(divider,dividerLp);
        LinearLayout actions=row();
        Button view=button("Xem tin bán",()->go("market_detail",id,false));view.setTextSize(14);view.setTypeface(null,Typeface.BOLD);view.setTextColor(Color.WHITE);view.setBackgroundResource(R.drawable.bg_primary_button);view.setBackgroundTintList(null);view.setElevation(0);
        LinearLayout.LayoutParams viewLp=new LinearLayout.LayoutParams(0,dp(48),1);viewLp.rightMargin=dp(5);actions.addView(view,viewLp);
        Button edit=button("Chỉnh sửa",()->editListing(listing));edit.setTextSize(14);edit.setTypeface(null,Typeface.BOLD);edit.setTextColor(GREEN);edit.setBackgroundResource(R.drawable.bg_profile_action_outline);edit.setBackgroundTintList(null);edit.setElevation(0);
        LinearLayout.LayoutParams editLp=new LinearLayout.LayoutParams(0,dp(48),1);editLp.leftMargin=dp(5);actions.addView(edit,editLp);
        tile.addView(actions);
    }
    private void editListing(JSONObject listing){LinearLayout form=column();form.setPadding(dp(16),dp(8),dp(16),dp(8));EditText title=field(form,"Tiêu đề",listing.optString("title"),200,InputType.TYPE_CLASS_TEXT),description=field(form,"Mô tả",listing.optString("description"),10000,InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_FLAG_MULTI_LINE),location=field(form,"Thành phố",listing.optString("city"),200,InputType.TYPE_CLASS_TEXT);new androidx.appcompat.app.AlertDialog.Builder(requireContext()).setTitle("Sửa tin bán · Gửi duyệt lại").setView(form).setPositiveButton("Lưu",(dialog,which)->send("PATCH","/listings/"+enc(listing.optString("id")),json("title",title.getText().toString().trim(),"description",description.getText().toString().trim(),"city",location.getText().toString().trim()),null,result->myListings())).setNegativeButton("Đóng",null).show();}
    private void verification(){
        header("Xác minh tài khoản",true);body.removeAllViews();if(!signedIn())return;
        TextView wait=loading(body);
        api.getMe(callback(me->{
            BackendSession.setProfile(me);verificationId=me.optString("pending_verification_id","");if("null".equals(verificationId))verificationId="";
            boolean verified=me.optBoolean("verified","VERIFIED".equals(me.optString("verification_status")));
            get("/me/verifications",response->{
                body.removeView(wait);
                boolean pending=!verificationId.isEmpty();
                int stateColor=verified?GREEN:pending?0xFF8A5500:INK;
                LinearLayout overview=card(body);overview.setPadding(dp(18),dp(20),dp(18),dp(20));
                LinearLayout heading=row();
                ImageView icon=new ImageView(requireContext());icon.setImageResource(verified?R.drawable.ic_verified:R.drawable.ic_shield);
                icon.setColorFilter(stateColor);icon.setBackgroundResource(verified?R.drawable.bg_badge_verified:pending?R.drawable.bg_badge_pending:R.drawable.bg_card_mint);
                icon.setPadding(dp(13),dp(13),dp(13),dp(13));
                LinearLayout.LayoutParams iconLp=new LinearLayout.LayoutParams(dp(54),dp(54));iconLp.rightMargin=dp(13);heading.addView(icon,iconLp);
                LinearLayout headingText=column();headingText.addView(text("TRẠNG THÁI TÀI KHOẢN",11,MUTED,true));
                TextView stateTitle=text(verified?"Đã xác minh":pending?"Đang chờ xét duyệt":"Chưa xác minh",20,stateColor,true);
                LinearLayout.LayoutParams stateLp=new LinearLayout.LayoutParams(-1,-2);stateLp.topMargin=dp(3);headingText.addView(stateTitle,stateLp);
                heading.addView(headingText,new LinearLayout.LayoutParams(0,-2,1));overview.addView(heading);
                String explanation=verified?"Tài khoản của bạn đã được xác minh và có thể tham gia giao dịch mua bán.":pending?"Hồ sơ đã được gửi. Quản trị viên sẽ xem xét giấy tờ của bạn.":"Xác minh tài khoản để có thể mua và bán sản phẩm trên EcoShare.";
                TextView explanationView=text(explanation,14,MUTED,false);
                LinearLayout.LayoutParams explanationLp=new LinearLayout.LayoutParams(-1,-2);explanationLp.topMargin=dp(16);overview.addView(explanationView,explanationLp);

                if(!verified||!verificationId.isEmpty()){
                    Button chooseDocument=button(verificationId.isEmpty()?"Chọn giấy tờ để gửi xác minh":"Bổ sung ảnh giấy tờ",()->{if(!busy)verificationPicker.launch("image/*");});
                    chooseDocument.setBackgroundResource(R.drawable.bg_primary_button);chooseDocument.setBackgroundTintList(null);
                    chooseDocument.setTextColor(Color.WHITE);chooseDocument.setTextSize(14);chooseDocument.setTypeface(null,Typeface.BOLD);
                    android.graphics.drawable.Drawable camera=androidx.core.content.ContextCompat.getDrawable(requireContext(),R.drawable.ic_camera);
                    if(camera!=null){camera=androidx.core.graphics.drawable.DrawableCompat.wrap(camera.mutate());androidx.core.graphics.drawable.DrawableCompat.setTint(camera,Color.WHITE);camera.setBounds(0,0,dp(19),dp(19));chooseDocument.setCompoundDrawables(camera,null,null,null);chooseDocument.setCompoundDrawablePadding(dp(8));}
                    LinearLayout.LayoutParams chooseDocumentLp=new LinearLayout.LayoutParams(-1,dp(52));chooseDocumentLp.topMargin=dp(4);chooseDocumentLp.bottomMargin=dp(5);
                    body.addView(chooseDocument,chooseDocumentLp);
                }

                LinearLayout privacy=card(body);privacy.setBackgroundResource(R.drawable.bg_card_mint);privacy.setPadding(dp(16),dp(16),dp(16),dp(16));
                LinearLayout privacyHeading=row();ImageView shield=new ImageView(requireContext());shield.setImageResource(R.drawable.ic_shield);shield.setColorFilter(GREEN);
                LinearLayout.LayoutParams shieldLp=new LinearLayout.LayoutParams(dp(20),dp(20));shieldLp.rightMargin=dp(9);privacyHeading.addView(shield,shieldLp);
                privacyHeading.addView(text("Giấy tờ được bảo mật",14,INK,true));privacy.addView(privacyHeading);
                TextView privacyInfo=text("Chỉ bạn và quản trị viên xét duyệt có thể xem giấy tờ xác minh.",13,MUTED,false);
                LinearLayout.LayoutParams privacyLp=new LinearLayout.LayoutParams(-1,-2);privacyLp.topMargin=dp(8);privacy.addView(privacyInfo,privacyLp);

                JSONArray entries=response.optJSONArray("items");
                if(entries!=null&&entries.length()>0){
                    label("LỊCH SỬ XÁC MINH");
                    for(int i=0;i<entries.length();i++){
                        JSONObject record=entries.optJSONObject(i);if(record==null)continue;
                        String status=record.optString("status"),reason=record.optString("reason","");
                        boolean rejected="REJECTED".equals(status)||"EXPIRED".equals(status);
                        boolean awaiting="PENDING".equals(status);
                        int color=rejected?0xFFB42318:awaiting?0xFF8A5500:GREEN;
                        LinearLayout history=card(body);history.setPadding(dp(17),dp(16),dp(17),dp(16));
                        LinearLayout historyHeading=row();
                        ImageView historyIcon=new ImageView(requireContext());historyIcon.setImageResource(rejected?R.drawable.ic_close_danger:awaiting?R.drawable.ic_shield:R.drawable.ic_verified);
                        historyIcon.setColorFilter(color);historyIcon.setBackgroundResource(rejected?R.drawable.bg_badge_rejected:awaiting?R.drawable.bg_badge_pending:R.drawable.bg_badge_verified);historyIcon.setPadding(dp(10),dp(10),dp(10),dp(10));
                        LinearLayout.LayoutParams historyIconLp=new LinearLayout.LayoutParams(dp(42),dp(42));historyIconLp.rightMargin=dp(11);historyHeading.addView(historyIcon,historyIconLp);
                        LinearLayout historyText=column();historyText.addView(text(statusLabel(status),16,color,true));
                        String submitted=date(record.optString("submitted_at"));if(!submitted.isEmpty()){TextView submittedView=text("Gửi ngày "+submitted,12,MUTED,false);LinearLayout.LayoutParams submittedLp=new LinearLayout.LayoutParams(-1,-2);submittedLp.topMargin=dp(2);historyText.addView(submittedView,submittedLp);}
                        historyHeading.addView(historyText,new LinearLayout.LayoutParams(0,-2,1));history.addView(historyHeading);
                        if(!reason.isEmpty()&&!"null".equals(reason)){
                            View noteDivider=new View(requireContext());noteDivider.setBackgroundColor(0xFFE7F0EB);
                            LinearLayout.LayoutParams noteDividerLp=new LinearLayout.LayoutParams(-1,dp(1));noteDividerLp.topMargin=dp(14);noteDividerLp.bottomMargin=dp(10);history.addView(noteDivider,noteDividerLp);
                            history.addView(text("GHI CHÚ XÉT DUYỆT",11,MUTED,true));
                            TextView note=text(reason,13,INK,false);LinearLayout.LayoutParams noteLp=new LinearLayout.LayoutParams(-1,-2);noteLp.topMargin=dp(4);history.addView(note,noteLp);
                        }
                    }
                }
            });
        }));
    }
    private void incrementCommentCount(){View view=body.findViewWithTag("counts:"+entityId);if(!(view instanceof TextView))return;JSONObject post=view.getTag(R.id.community_body) instanceof JSONObject?(JSONObject)view.getTag(R.id.community_body):null;if(post==null)return;int count=post.optInt("comment_count")+1;put(post,"comment_count",count);View total=body.findViewWithTag("comment-count:"+entityId);if(total instanceof TextView)((TextView)total).setText(count+" bình luận");View heading=body.findViewWithTag("comment-section-count");if(heading instanceof TextView)((TextView)heading).setText(count+" BÌNH LUẬN");}
    private void mobileAdmin(){
        String title="admin_moderation".equals(destination)?"Kiểm duyệt":("admin_reports".equals(destination)?"Báo cáo":"Quản trị");
        header(title,true);body.removeAllViews();if(!signedIn())return;TextView wait=loading(body);
        api.getMe(callback(me->{
            body.removeView(wait);BackendSession.setProfile(me);String role=me.optString("role","");
            if(!"ADMIN".equals(role)&&!"MODERATOR".equals(role)){empty(body,"Tài khoản của bạn không có quyền quản trị ứng dụng.");return;}
            action("Làm mới",this::mobileAdmin);
            if("admin_moderation".equals(destination)){adminModerationPage();return;}
            if("admin_reports".equals(destination)){adminReportsScreen();return;}
            adminDashboardPage(role);
        }));
    }
    private void adminDashboardPage(String role){
        adminHero("TRUNG TÂM QUẢN TRỊ","Chào mừng trở lại","Theo dõi hoạt động EcoShare và xử lý nhanh các việc cần chú ý.",role);
        LinearLayout metrics=row();LinearLayout.LayoutParams metricRow=new LinearLayout.LayoutParams(-1,-2);metricRow.bottomMargin=dp(4);body.addView(metrics,metricRow);
        TextView listings=adminMetric(metrics,"—","Tin chờ");TextView reports=adminMetric(metrics,"—","Báo cáo");TextView content=adminMetric(metrics,"—","Đã đăng");
        TextView users=null,orders=null;
        if("ADMIN".equals(role)){LinearLayout summary=card(body);summary.setOrientation(LinearLayout.HORIZONTAL);summary.setGravity(Gravity.CENTER_VERTICAL);users=text("👥  Người dùng  —",14,INK,true);summary.addView(users,new LinearLayout.LayoutParams(0,dp(42),1));orders=text("🛍  Đơn hàng  —",14,INK,true);summary.addView(orders,new LinearLayout.LayoutParams(0,dp(42),1));}
        TextView usersMetric=users,ordersMetric=orders;
        get("/admin/dashboard",stats->{JSONObject moderation=stats.optJSONObject("moderation");if(moderation==null)moderation=new JSONObject();listings.setText(String.valueOf(moderation.optLong("pending_listings")));reports.setText(String.valueOf(moderation.optLong("open_content_reports")));content.setText(String.valueOf(moderation.optLong("published_content")));if(usersMetric!=null)usersMetric.setText("👥  Người dùng  "+stats.optLong("users"));if(ordersMetric!=null)ordersMetric.setText("🛍  Đơn hàng  "+stats.optLong("orders"));});
        label("THAO TÁC NHANH");
        adminNavigationCard("🧾","Duyệt tin bán","Xem và xử lý tin đang chờ duyệt","admin_moderation");
        adminNavigationCard("🚩","Báo cáo nội dung","Theo dõi báo cáo đang mở","admin_reports");
        adminNavigationCard("🏆","Thử thách Eco","Tạo thử thách và cập nhật điểm thưởng","admin_moderation");
        TextView note=text("Quản trị tài khoản, xác minh, thanh toán và các cấu hình đầy đủ vẫn thực hiện trên Admin web.",12,MUTED,false);note.setPadding(dp(4),dp(6),dp(4),dp(12));body.addView(note);
    }
    private void adminModerationPage(){
        adminHero("KIỂM DUYỆT","Nội dung cộng đồng","Duyệt tin bán và cập nhật thử thách Eco ngay trên điện thoại.",BackendSession.profile().optString("role","MODERATOR"));
        label("TIN BÁN CHỜ DUYỆT");LinearLayout listings=column();body.addView(listings);adminListingsPage(listings,null);
        label("THỬ THÁCH ECO");body.addView(button("＋  Thêm thử thách",this::createAdminChallenge));
        LinearLayout challenges=column();body.addView(challenges);
        get("/admin/content?kind=CHALLENGE&status=PUBLISHED&limit=20",result->{JSONArray items=result.optJSONArray("items");if(items==null||items.length()==0){empty(challenges,"Chưa có thử thách đã xuất bản.");return;}for(int i=0;i<items.length();i++){JSONObject challenge=items.optJSONObject(i);if(challenge!=null)adminChallengeCard(challenges,challenge);}});
    }
    private void adminReportsScreen(){
        adminHero("HÀNG ĐỢI AN TOÀN","Báo cáo đang mở","Xem nội dung bị báo cáo, ghi lại hướng xử lý và đóng từng báo cáo.",BackendSession.profile().optString("role","MODERATOR"));
        LinearLayout reports=column();body.addView(reports);adminReportsPage(reports,null);
    }
    private void adminHero(String eyebrow,String title,String description,String role){
        LinearLayout hero=column();hero.setPadding(dp(20),dp(18),dp(20),dp(18));
        android.graphics.drawable.GradientDrawable background=new android.graphics.drawable.GradientDrawable(android.graphics.drawable.GradientDrawable.Orientation.LEFT_RIGHT,new int[]{requireContext().getColor(R.color.eco_gradient_start),requireContext().getColor(R.color.eco_gradient_end)});background.setCornerRadius(dp(23));background.setStroke(dp(1),0x338EDDB1);hero.setBackground(background);
        TextView caption=text(eyebrow+"  ·  "+role,11,0xFFD4F772,true);caption.setLetterSpacing(.09f);hero.addView(caption);TextView heading=text(title,23,Color.WHITE,true);LinearLayout.LayoutParams titleLp=new LinearLayout.LayoutParams(-1,-2);titleLp.topMargin=dp(7);hero.addView(heading,titleLp);TextView bodyText=text(description,13,0xFFE2F5EB,false);LinearLayout.LayoutParams descLp=new LinearLayout.LayoutParams(-1,-2);descLp.topMargin=dp(5);hero.addView(bodyText,descLp);LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);lp.bottomMargin=dp(13);body.addView(hero,lp);
    }
    private TextView adminMetric(LinearLayout parent,String value,String caption){
        LinearLayout tile=column();tile.setGravity(Gravity.CENTER_VERTICAL);tile.setPadding(dp(11),dp(10),dp(8),dp(10));tile.setBackgroundResource(R.drawable.community_card);TextView number=text(value,20,GREEN,true);TextView label=text(caption,11,MUTED,false);tile.addView(number);LinearLayout.LayoutParams labelLp=new LinearLayout.LayoutParams(-1,-2);labelLp.topMargin=dp(2);tile.addView(label,labelLp);LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(0,dp(72),1);lp.setMargins(dp(2),0,dp(6),0);parent.addView(tile,lp);return number;
    }
    private void adminNavigationCard(String icon,String title,String description,String screen){
        LinearLayout tile=card(body);tile.setOrientation(LinearLayout.HORIZONTAL);tile.setGravity(Gravity.CENTER_VERTICAL);tile.setPadding(dp(14),dp(12),dp(14),dp(12));tile.setClickable(true);tile.setFocusable(true);tile.setForeground(new android.graphics.drawable.RippleDrawable(android.content.res.ColorStateList.valueOf(0x263BAA76),null,null));tile.setOnTouchListener((view,event)->{if(event.getActionMasked()==MotionEvent.ACTION_DOWN)view.animate().scaleX(.985f).scaleY(.985f).setDuration(75).start();else if(event.getActionMasked()==MotionEvent.ACTION_UP||event.getActionMasked()==MotionEvent.ACTION_CANCEL)view.animate().scaleX(1f).scaleY(1f).setDuration(135).start();return false;});
        TextView iconView=text(icon,23,GREEN,true);iconView.setGravity(Gravity.CENTER);iconView.setBackgroundResource(R.drawable.bg_mint);tile.addView(iconView,new LinearLayout.LayoutParams(dp(48),dp(48)));LinearLayout details=column();details.setPadding(dp(12),0,0,0);details.addView(text(title,15,INK,true));TextView detail=text(description,12,MUTED,false);LinearLayout.LayoutParams detailLp=new LinearLayout.LayoutParams(-1,-2);detailLp.topMargin=dp(3);details.addView(detail,detailLp);LinearLayout.LayoutParams detailsLp=new LinearLayout.LayoutParams(0,-2,1);tile.addView(details,detailsLp);tile.addView(text("›",26,GREEN,true));tile.setOnClickListener(view->go(screen,null,false));
    }
    private void adminChallengeCard(LinearLayout parent, JSONObject challenge) {
        LinearLayout item = card(parent); item.addView(text(challenge.optString("title"), 16, INK, true));
        item.addView(text(challenge.optString("body"), 13, MUTED, false));
        JSONObject metadata; try { metadata = new JSONObject(challenge.optString("metadata_json", "{}")); } catch (JSONException error) { metadata = new JSONObject(); }
        item.addView(text("Thưởng " + metadata.optInt("reward_points") + " điểm Eco", 12, GREEN, true));
        final JSONObject currentMetadata = metadata;
        item.addView(button("Chỉnh sửa thử thách & điểm", () -> editAdminChallenge(challenge, currentMetadata)));
    }
    private void createAdminChallenge() {
        LinearLayout form = column(); form.setPadding(dp(16), dp(8), dp(16), dp(8));
        EditText title = field(form, "Tên thử thách", "", 200, InputType.TYPE_CLASS_TEXT);
        EditText bodyText = field(form, "Mô tả và cách hoàn thành", "", 4000, InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        EditText points = field(form, "Điểm thưởng (0–5000)", "20", 5, InputType.TYPE_CLASS_NUMBER);
        androidx.appcompat.app.AlertDialog dialog = new androidx.appcompat.app.AlertDialog.Builder(requireContext()).setTitle("Thêm thử thách").setView(form).setPositiveButton("Xuất bản", null).setNegativeButton("Hủy", null).create();
        dialog.setOnShowListener(ignored -> dialog.getButton(androidx.appcompat.app.AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            int reward; try { reward = Integer.parseInt(points.getText().toString()); if (reward < 0 || reward > 5000 || title.getText().toString().trim().isEmpty() || bodyText.getText().toString().trim().isEmpty()) throw new NumberFormatException(); }
            catch (NumberFormatException error) { message("Nhập tiêu đề, mô tả và điểm thưởng từ 0 đến 5000."); return; }
            send("POST", "/admin/content", json("parent_id", JSONObject.NULL, "kind", "CHALLENGE", "title", title.getText().toString().trim(), "body", bodyText.getText().toString().trim(), "status", "PUBLISHED", "starts_at", JSONObject.NULL, "ends_at", JSONObject.NULL, "points_cost", 0, "metadata", json("reward_points", reward), "reason", "Tạo thử thách Eco trên ứng dụng quản trị"), UUID.randomUUID().toString(), result -> mobileAdmin()); dialog.dismiss();
        })); dialog.show();
    }
    private void editAdminChallenge(JSONObject challenge, JSONObject previousMetadata) {
        LinearLayout form = column(); form.setPadding(dp(16), dp(8), dp(16), dp(8));
        EditText title = field(form, "Tên thử thách", challenge.optString("title"), 200, InputType.TYPE_CLASS_TEXT);
        EditText bodyText = field(form, "Mô tả và cách hoàn thành", challenge.optString("body"), 4000, InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        EditText points = field(form, "Điểm thưởng (0–5000)", String.valueOf(previousMetadata.optInt("reward_points")), 5, InputType.TYPE_CLASS_NUMBER);
        androidx.appcompat.app.AlertDialog dialog = new androidx.appcompat.app.AlertDialog.Builder(requireContext()).setTitle("Chỉnh sửa thử thách").setView(form).setPositiveButton("Lưu", null).setNegativeButton("Hủy", null).create();
        dialog.setOnShowListener(ignored -> dialog.getButton(androidx.appcompat.app.AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            int reward; try { reward = Integer.parseInt(points.getText().toString()); if (reward < 0 || reward > 5000 || title.getText().toString().trim().isEmpty() || bodyText.getText().toString().trim().isEmpty()) throw new NumberFormatException(); }
            catch (NumberFormatException error) { message("Nhập tiêu đề, mô tả và điểm thưởng từ 0 đến 5000."); return; }
            JSONObject metadata; try { metadata = new JSONObject(previousMetadata.toString()); metadata.put("reward_points", reward); }
            catch (JSONException error) { message("Không đọc được thiết lập thử thách hiện tại."); return; }
            send("PATCH", "/admin/content/" + enc(challenge.optString("id")), json("title", title.getText().toString().trim(), "body", bodyText.getText().toString().trim(), "metadata", metadata, "reason", "Cập nhật nội dung và điểm thử thách"), null, result -> mobileAdmin()); dialog.dismiss();
        })); dialog.show();
    }
    private void adminListingsPage(LinearLayout target,String cursor){
        TextView wait=loading(target);get("/admin/listings?status=PENDING"+(cursor==null?"":"&cursor="+enc(cursor)),response->{target.removeView(wait);JSONArray entries=response.optJSONArray("items");if((entries==null||entries.length()==0)&&cursor==null)empty(target,"Không có tin bán đang chờ duyệt.");if(entries!=null)for(int i=0;i<entries.length();i++){JSONObject listing=entries.optJSONObject(i);if(listing==null)continue;LinearLayout card=card(target);card.addView(text(listing.optString("title"),17,INK,true));card.addView(text(listing.optString("description"),14,INK,false));card.addView(text(listing.optString("city"),12,MUTED,false));card.addView(button("Xem chi tiết",()->go("market_detail",listing.optString("id"),false)));LinearLayout actions=row();actions.addView(button("Duyệt tin",()->adminReason("Duyệt tin bán","Ghi lý do phê duyệt",reason->send("POST","/admin/listings/"+enc(listing.optString("id"))+"/review",json("status","APPROVED","reason",reason),null,result->mobileAdmin()))),new LinearLayout.LayoutParams(0,dp(48),1));actions.addView(button("Từ chối",()->adminReason("Từ chối tin bán","Nêu nội dung cần khắc phục",reason->send("POST","/admin/listings/"+enc(listing.optString("id"))+"/review",json("status","REJECTED","reason",reason),null,result->mobileAdmin()))),new LinearLayout.LayoutParams(0,dp(48),1));card.addView(actions);}String next=response.optString("next_cursor","");if(!next.isEmpty()&&!"null".equals(next)){Button more=button("Xem thêm tin chờ duyệt",()->{});more.setOnClickListener(v->{target.removeView(more);adminListingsPage(target,next);});target.addView(more);}});
    }
    private void adminReportsPage(LinearLayout target,String cursor){
        TextView wait=loading(target);get("/admin/reports?status=OPEN"+(cursor==null?"":"&cursor="+enc(cursor)),response->{target.removeView(wait);JSONArray entries=response.optJSONArray("items");if((entries==null||entries.length()==0)&&cursor==null)empty(target,"Không có báo cáo đang mở.");if(entries!=null)for(int i=0;i<entries.length();i++){JSONObject report=entries.optJSONObject(i);if(report==null)continue;LinearLayout card=card(target);card.addView(text("Báo cáo · "+shortId(report.optString("id")),15,INK,true));card.addView(text(report.optString("reason",report.optString("body","")),14,INK,false));String order=report.optString("order_id","");if(!order.isEmpty()&&!"null".equals(order))card.addView(text("Đối soát giao dịch và hoàn tiền được xử lý trên Admin web.",13,MUTED,false));LinearLayout actions=row();actions.addView(button("Đã xử lý",()->adminReason("Đóng báo cáo","Mô tả kết quả xử lý",reason->send("POST","/admin/reports/"+enc(report.optString("id"))+"/resolve",json("status","RESOLVED","reason",reason),null,result->mobileAdmin()))),new LinearLayout.LayoutParams(0,dp(48),1));actions.addView(button("Bác bỏ",()->adminReason("Bác bỏ báo cáo","Nêu lý do bác bỏ",reason->send("POST","/admin/reports/"+enc(report.optString("id"))+"/resolve",json("status","DISMISSED","reason",reason),null,result->mobileAdmin()))),new LinearLayout.LayoutParams(0,dp(48),1));card.addView(actions);}String next=response.optString("next_cursor","");if(!next.isEmpty()&&!"null".equals(next)){Button more=button("Xem thêm báo cáo",()->{});more.setOnClickListener(v->{target.removeView(more);adminReportsPage(target,next);});target.addView(more);}});
    }
    private void adminReason(String title,String hint,Consumer<String> submitted){
        EditText reason=input(hint,1000,0);reason.setMinLines(3);reason.setGravity(Gravity.TOP);reason.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_FLAG_MULTI_LINE);LinearLayout container=column();container.setPadding(dp(16),dp(8),dp(16),dp(8));container.addView(reason);
        androidx.appcompat.app.AlertDialog dialog=new androidx.appcompat.app.AlertDialog.Builder(requireContext()).setTitle(title).setView(container).setPositiveButton("Xác nhận",null).setNegativeButton("Đóng",null).create();dialog.setOnShowListener(d->dialog.getButton(androidx.appcompat.app.AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{String value=reason.getText().toString().trim();if(value.length()<5){reason.setError("Lý do cần ít nhất 5 ký tự.");return;}submitted.accept(value);dialog.dismiss();}));dialog.show();
    }
    private static String currency(long value){return String.format(Locale.forLanguageTag("vi-VN"),"%,d đ",value);}
    private static String shortId(String id){return id.length()>12?id.substring(0,12):id;}
    private static String statusLabel(String status){switch(status){case"VERIFIED":return"Đã xác minh";case"UNVERIFIED":return"Chưa xác minh";case"PENDING":return"Chờ duyệt";case"REJECTED":return"Đã từ chối";case"EXPIRED":return"Đã hết hạn";case"APPROVED":return"Đang hiển thị";case"HIDDEN":return"Đã ẩn";case"PENDING_PAYMENT":return"Chờ thanh toán";case"PAID":case"SUCCEEDED":return"Đã thanh toán";case"SHIPPED":return"Đang giao hàng";case"COMPLETED":return"Đã hoàn tất";case"CANCELLED":return"Đã hủy";case"DISPUTED":return"Đang xử lý khiếu nại";case"REFUNDED":return"Đã hoàn tiền";case"FAILED":return"Không thành công";default:return status;}}
}

