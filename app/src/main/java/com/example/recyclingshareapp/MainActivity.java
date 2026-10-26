package com.example.recyclingshareapp;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.CancellationSignal;
import android.view.View;
import android.view.ViewGroup;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.RatingBar;
import android.widget.Switch;
import android.widget.TextView;
import androidx.activity.EdgeToEdge;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.fragment.app.Fragment;
import androidx.fragment.app.FragmentTransaction;
import androidx.lifecycle.Lifecycle;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.NoCredentialException;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.splashscreen.SplashScreen;
import com.example.recyclingshareapp.data.DemoRepository;
import com.example.recyclingshareapp.data.TradeRules;
import com.example.recyclingshareapp.ui.ScreenFragment;
import com.example.recyclingshareapp.ui.CommunityFragment;
import com.example.recyclingshareapp.data.remote.BackendSession;
import com.example.recyclingshareapp.data.remote.FirebaseBackendClient;
import org.json.JSONObject;
import androidx.core.view.WindowInsetsControllerCompat;
import com.google.android.material.snackbar.Snackbar;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Locale;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

/** Native screen host for Firebase community flows and legacy prototype screens. */
public class MainActivity extends AppCompatActivity {
    private DemoRepository repository;
    private String current = "onboarding";
    private String entityId;
    private boolean focusComments;
    private boolean authenticating;
    /** Explicit, read-only access to previously viewed public pages without a login session. */
    private boolean offlineGuest;
    private boolean awaitingLocalNetwork;
    private boolean pendingRegistration;
    private boolean pendingGoogleSignIn;
    private CancellationSignal googleSignInCancellation;
    private View screenView;
    private Fragment displayedFragment;
    private final Map<String, Fragment> mainTabs = new LinkedHashMap<>();
    private String pickTarget = "";
    private String otpPurpose = "register";
    private String registrationName = "";
    private boolean keyboardVisible;
    private final Handler loginHandler = new Handler(Looper.getMainLooper());
    private Runnable pendingHomeTransition;
    private int loginFlow;
    private final ArrayList<String> history = new ArrayList<>();
    private final ActivityResultLauncher<String> localNetworkPermission = registerForActivityResult(
            new ActivityResultContracts.RequestPermission(), granted -> {
                boolean google = pendingGoogleSignIn;
                pendingGoogleSignIn = false;
                awaitingLocalNetwork = false;
                if (granted) {
                    try { if (google) googleLogin(); else firebaseLogin(pendingRegistration); }
                    catch (IllegalStateException error) { toast(error.getMessage()); }
                } else toast("Cần cho phép mạng nội bộ để kết nối backend trên máy tính.");
            });
    private final ActivityResultLauncher<String> picker = registerForActivityResult(new ActivityResultContracts.GetContent(), uri -> {
        if (uri != null) {
            repository.put("picked_" + pickTarget, "yes");
            if ("listing".equals(pickTarget)) setText("listing_photo_status", "Đã chọn ảnh trên thiết bị (không tải lên).");
            if ("verification".equals(pickTarget)) setText("verify_document_status", "Đã chọn tài liệu mẫu (không lưu hoặc tải lên).");
            toast("Đã chọn tệp mẫu.");
        }
    });
    @Override protected void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
        repository = new DemoRepository(this);
        try { BackendSession.get(this); } catch (IllegalArgumentException | IllegalStateException error) { /* Login will show the backend error when a request starts. */ }
        EdgeToEdge.enable(this);
        setContentView(R.layout.activity_main);
        View scannerButton = findViewById(R.id.top_btn_scanner);
        scannerButton.setBackgroundTintList(null);
        scannerButton.setBackgroundResource(R.drawable.bg_nav_create);
        // FragmentManager restores these views on rotation; reuse the same tabs afterwards.
        for (Fragment fragment : getSupportFragmentManager().getFragments()) {
            String name = fragment.getArguments() == null ? null : fragment.getArguments().getString("destination");
            if (isMainTab(name)) mainTabs.put(name, fragment);
            if (!fragment.isHidden()) displayedFragment = fragment;
        }
        Fragment primary = getSupportFragmentManager().getPrimaryNavigationFragment();
        if (primary != null) displayedFragment = primary;
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main), (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.ime());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            boolean ime = insets.isVisible(WindowInsetsCompat.Type.ime());
            if (ime != keyboardVisible) {
                keyboardVisible = ime;
                updateChrome();
            }
            return insets;
        });
        bindActions(findViewById(R.id.bottom_navigation));
        bindActions(findViewById(R.id.top_app_bar));
        findViewById(R.id.back_button).setOnClickListener(v -> back());
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() { back(); }
        });
        boolean profileRecovery=BackendSession.isSignedIn()&&!BackendSession.hasProfile();
        if (savedInstanceState != null) {
            current = savedInstanceState.getString("screen", "home");
            entityId = savedInstanceState.getString("entity_id");
            focusComments = savedInstanceState.getBoolean("focus_comments", false);
            offlineGuest = savedInstanceState.getBoolean("offline_guest", false) && !BackendSession.isSignedIn() && !profileRecovery;
            if ((!BackendSession.isSignedIn() && (!offlineGuest || !offlineGuestScreen(current))) || profileRecovery) {
                current = "login";
                offlineGuest = false;
            }
            else if ("login".equals(current) && BackendSession.hasProfile()) current = "home";
            ArrayList<String> restored = savedInstanceState.getStringArrayList("history");
            if (restored != null && !"login".equals(current)) history.addAll(restored);
            pickTarget = savedInstanceState.getString("pick_target", "");
            otpPurpose = savedInstanceState.getString("otp_purpose", "register");
            registrationName = savedInstanceState.getString("registration_name", "");
            Fragment restoredScreen = displayedFragment;
            String restoredDestination = restoredScreen == null || restoredScreen.getArguments() == null
                    ? null : restoredScreen.getArguments().getString("destination");
            // Keep the restored Fragment (and its EditText/view state) across rotation.
            // Replace it only when the session now requires a different screen.
            if (!current.equals(restoredDestination)) {
                show(current, false, entityId, focusComments);
            } else {
                updateChrome();
            }
        } else show(BackendSession.isSignedIn()&&!profileRecovery ? "home" : "login", false);
        if(profileRecovery)recoverProfileAfterRecreation();
    }
    @Override protected void onSaveInstanceState(Bundle out) {
        out.putString("screen", current); out.putStringArrayList("history", history);
        out.putBoolean("offline_guest", offlineGuest);
        out.putString("entity_id", entityId); out.putBoolean("focus_comments", focusComments);
        out.putString("pick_target", pickTarget); out.putString("otp_purpose", otpPurpose);
        out.putString("registration_name", registrationName); super.onSaveInstanceState(out);
    }
    @Override protected void onDestroy() {
        cancelLoginTransition();
        super.onDestroy();
    }
    private void cancelLoginTransition() {
        loginFlow++;
        if (googleSignInCancellation != null) googleSignInCancellation.cancel();
        googleSignInCancellation = null;
        if (pendingHomeTransition != null) loginHandler.removeCallbacks(pendingHomeTransition);
        pendingHomeTransition = null;
    }
    private int id(String name) { return getResources().getIdentifier(name, "id", getPackageName()); }
    private String value(String name) {
        View view = screenView.findViewById(id(name));
        return view instanceof EditText ? ((EditText)view).getText().toString().trim() : "";
    }
    private String required(String name) {
        String value = value(name);
        if (value.isEmpty()) {
            View input=screenView.findViewById(id(name));
            if (input instanceof EditText) { ((EditText)input).setError("Vui lòng điền thông tin."); input.requestFocus(); }
            throw new IllegalStateException("Vui lòng điền đầy đủ thông tin.");
        }
        return value;
    }
    private void setText(String name, String content) {
        if (screenView == null) return;
        View view = screenView.findViewById(id(name));
        if (view instanceof TextView) ((TextView)view).setText(content);
    }
    private void toast(String message) { Snackbar.make(findViewById(R.id.main), message, Snackbar.LENGTH_LONG).show(); }
    private void bindFirebaseLogin(View view) {
        setText("login_submit_btn", "Đăng nhập");
        setText("login_heading", getString(R.string.login_welcome_title));
        View google=view.findViewById(R.id.btn_google);
        if(google!=null){
            google.setVisibility(View.VISIBLE);
            if(google.getLayoutParams() instanceof android.widget.LinearLayout.LayoutParams){
                android.widget.LinearLayout.LayoutParams params=(android.widget.LinearLayout.LayoutParams)google.getLayoutParams();
                params.width=0;params.weight=1;params.setMarginEnd(0);google.setLayoutParams(params);
            }
        }
        View apple=view.findViewById(R.id.btn_apple);
        if(apple!=null)apple.setVisibility(View.GONE);
    }
    private void firebaseLogin(boolean register) {
        if(authenticating || awaitingLocalNetwork)return;
        final String email=required(register?"register_email":"login_email");
        final String password=((EditText)screenView.findViewById(id(register?"register_password":"login_password"))).getText().toString();
        if(!android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()||password.length()<6)throw new IllegalStateException("Nhập email hợp lệ và mật khẩu từ 6 ký tự.");
        final String name=register?required("register_name"):null;
        if (BackendSession.usesLocalBackend() && android.os.Build.VERSION.SDK_INT >= 37
                && checkSelfPermission("android.permission.ACCESS_LOCAL_NETWORK")
                != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            pendingRegistration = register;
            awaitingLocalNetwork = true;
            localNetworkPermission.launch("android.permission.ACCESS_LOCAL_NETWORK");
            return;
        }
        final FirebaseBackendClient client=BackendSession.get(this);
        cancelLoginTransition();
        final int flow=loginFlow;
        authenticating=true;
        View button=screenView.findViewById(id(register?"register_submit":"login_submit_btn"));if(button!=null)button.setEnabled(false);
        FirebaseBackendClient.Callback<FirebaseBackendClient.SessionInfo> callback=new FirebaseBackendClient.Callback<FirebaseBackendClient.SessionInfo>(){
            @Override public void onSuccess(FirebaseBackendClient.SessionInfo info) {
                if (flow != loginFlow || isDestroyed() || isFinishing()) return;
                completeFirebaseLogin(client,flow,register,name);
            }
            @Override public void onError(FirebaseBackendClient.BackendException error){
                if(flow==loginFlow&&!isDestroyed()&&!isFinishing())loginFailed(error.getMessage());
            }
        };
        if(register)client.signUp(email,password,callback);else client.signIn(email,password,callback);
    }

    private void completeFirebaseLogin(FirebaseBackendClient client,int flow,boolean register,String name){
        offlineGuest = false;
        CommunityFragment.clearPagedSnapshots();
        setText(register?"register_submit":"login_submit_btn","Đang tải hồ sơ…");
        // Auth is complete: overlap the first three posts with /me without delaying navigation.
        if (!register) client.prefetchFirstPosts();
        FirebaseBackendClient.Callback<JSONObject> loaded=new FirebaseBackendClient.Callback<JSONObject>(){
            @Override public void onSuccess(JSONObject profile) {
                if (flow != loginFlow || isDestroyed() || isFinishing()) return;
                authenticating=false;BackendSession.setProfile(profile);
                if (register) client.prefetchFirstPosts();
                client.prefetchRemainingScreens();
                repository.put("logged_in","yes");repository.put("profile_name",profile.optString("display_name",""));
                repository.put("profile_bio",profile.optString("bio",""));repository.put("profile_city",profile.optString("city",""));
                showHomeWhenFirstPostsReady(client,flow,register);
            }
            @Override public void onError(FirebaseBackendClient.BackendException error){
                if(flow==loginFlow&&!isDestroyed()&&!isFinishing())loginProfileFailed(error);
            }
        };
        if(register){
            try{client.request("PATCH","/me",new JSONObject().put("display_name",name),null,loaded);}
            catch(org.json.JSONException error){loginFailed("Không tạo được hồ sơ.");}
        } else client.getMe(loaded);
    }

    private void googleLogin(){
        if(authenticating || awaitingLocalNetwork)return;
        if(BackendSession.isEmulator()){
            toast("Đăng nhập Google chỉ hỗ trợ Firebase thật, không hỗ trợ Firebase Emulator.");
            return;
        }
        int resource=getResources().getIdentifier("default_web_client_id","string",getPackageName());
        if(resource==0 || getString(resource).trim().isEmpty()){
            toast("Chưa cấu hình Google Sign-In: bật nhà cung cấp Google trên Firebase và tải lại google-services.json.");
            return;
        }
        if(BackendSession.usesLocalBackend() && android.os.Build.VERSION.SDK_INT >= 37
                && checkSelfPermission("android.permission.ACCESS_LOCAL_NETWORK")
                != android.content.pm.PackageManager.PERMISSION_GRANTED){
            pendingGoogleSignIn=true;
            awaitingLocalNetwork=true;
            localNetworkPermission.launch("android.permission.ACCESS_LOCAL_NETWORK");
            return;
        }
        final FirebaseBackendClient client=BackendSession.get(this);
        cancelLoginTransition();
        final int flow=loginFlow;
        authenticating=true;
        View button=screenView.findViewById(R.id.btn_google);
        if(button!=null)button.setEnabled(false);
        googleSignInCancellation=new CancellationSignal();
        GetCredentialRequest request=new GetCredentialRequest.Builder()
                .addCredentialOption(new GetSignInWithGoogleOption.Builder(getString(resource).trim()).build())
                .build();
        CredentialManager.create(this).getCredentialAsync(this,request,googleSignInCancellation,
                getMainExecutor(),new CredentialManagerCallback<GetCredentialResponse,GetCredentialException>(){
                    @Override public void onResult(GetCredentialResponse response){
                        if(flow!=loginFlow || isDestroyed() || isFinishing() || !"login".equals(current))return;
                        googleSignInCancellation=null;
                        Credential credential=response.getCredential();
                        if(!(credential instanceof CustomCredential)
                                || !GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())){
                            loginFailed("Tài khoản đã chọn không cung cấp mã đăng nhập Google.");
                            return;
                        }
                        final String googleToken;
                        try{googleToken=GoogleIdTokenCredential.createFrom(((CustomCredential)credential).getData()).getIdToken();}
                        catch(RuntimeException error){loginFailed("Không đọc được mã đăng nhập Google.");return;}
                        client.signInWithGoogleIdToken(googleToken,new FirebaseBackendClient.Callback<FirebaseBackendClient.SessionInfo>(){
                            @Override public void onSuccess(FirebaseBackendClient.SessionInfo info){
                                if(flow==loginFlow && !isDestroyed() && !isFinishing())completeFirebaseLogin(client,flow,false,null);
                            }
                            @Override public void onError(FirebaseBackendClient.BackendException error){
                                if(flow==loginFlow && !isDestroyed() && !isFinishing())loginFailed(error.getMessage());
                            }
                        });
                    }
                    @Override public void onError(GetCredentialException error){
                        if(flow!=loginFlow || isDestroyed() || isFinishing())return;
                        googleSignInCancellation=null;
                        if(error instanceof GetCredentialCancellationException){
                            authenticating=false;
                            View button=screenView==null?null:screenView.findViewById(R.id.btn_google);
                            if(button!=null)button.setEnabled(true);
                        } else if(error instanceof NoCredentialException){
                            loginFailed("Chưa tìm thấy tài khoản Google trên thiết bị. Hãy thêm tài khoản Google hoặc đăng nhập bằng email.");
                        } else loginFailed("Không thể mở đăng nhập Google. Kiểm tra Google Play và cấu hình OAuth của ứng dụng.");
                    }
                });
    }

    private void showHomeWhenFirstPostsReady(FirebaseBackendClient client,int flow,boolean register){
        setText(register?"register_submit":"login_submit_btn","Đang chuẩn bị bài viết…");
        AtomicBoolean entered=new AtomicBoolean();
        Runnable enterHome=()->{
            if(flow!=loginFlow||isDestroyed()||isFinishing()||!BackendSession.isSignedIn()
                    ||!entered.compareAndSet(false,true))return;
            if(pendingHomeTransition!=null)loginHandler.removeCallbacks(pendingHomeTransition);
            pendingHomeTransition=null;
            history.clear();show("home",false);
        };
        pendingHomeTransition=enterHome;
        // A maximum two-second transition lets the first page paint immediately
        // when ready; a slow or failed feed still opens Home with its retry state.
        loginHandler.postDelayed(enterHome,2_000L);
        client.request("GET","/posts?limit=" + FirebaseBackendClient.FIRST_PAGE_SIZE,null,null,new FirebaseBackendClient.Callback<JSONObject>(){
            @Override public void onSuccess(JSONObject value){enterHome.run();}
            @Override public void onError(FirebaseBackendClient.BackendException error){enterHome.run();}
        });
    }

    private void recoverProfileAfterRecreation(){
        final FirebaseBackendClient client=BackendSession.get(this);
        cancelLoginTransition();
        final int flow=loginFlow;
        authenticating=true;
        View button=screenView==null?null:screenView.findViewById(R.id.login_submit_btn);
        if(button!=null)button.setEnabled(false);
        setText("login_submit_btn","Đang tải hồ sơ…");
        client.getMe(new FirebaseBackendClient.Callback<JSONObject>(){
            @Override public void onSuccess(JSONObject profile){
                if(flow!=loginFlow||isDestroyed()||isFinishing())return;
                authenticating=false;BackendSession.setProfile(profile);
                repository.put("logged_in","yes");repository.put("profile_name",profile.optString("display_name",""));
                repository.put("profile_bio",profile.optString("bio",""));repository.put("profile_city",profile.optString("city",""));
                client.prefetchFirstPosts();client.prefetchRemainingScreens();
                showHomeWhenFirstPostsReady(client,flow,false);
            }
            @Override public void onError(FirebaseBackendClient.BackendException error){
                if(flow==loginFlow&&!isDestroyed()&&!isFinishing())loginProfileFailed(error);
            }
        });
    }
    private void loginProfileFailed(FirebaseBackendClient.BackendException error) {
        boolean unavailable = error.httpStatus == 0 || error.httpStatus == 404 || error.httpStatus >= 500
                || "INVALID_SERVER_RESPONSE".equals(error.code);
        // Preserve permission, account and validation errors returned by the backend.
        if (!unavailable || error.httpStatus == 401 || error.httpStatus == 403) {
            loginFailed(error.getMessage());
        } else if (BackendSession.isSparkLocal()) {
            loginFailed("Tài khoản đã xác thực. Chưa tải được hồ sơ: kiểm tra backend Spark cổng 5002 và quyền mạng nội bộ.");
        } else if (BackendSession.isEmulator()) {
            loginFailed("Tài khoản đã xác thực. Chưa tải được hồ sơ: kiểm tra Firebase Emulator cổng 5001 trên máy tính.");
        } else if ((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            loginFailed("Tài khoản đã xác thực. Backend Cloud Functions chưa sẵn sàng; kiểm tra cấu hình backend của bản debug.");
        } else {
            loginFailed("Tài khoản đã xác thực nhưng máy chủ ứng dụng chưa sẵn sàng. Vui lòng thử lại sau.");
        }
    }
    private void loginFailed(String message) {
        cancelLoginTransition();
        authenticating=false;
        BackendSession.signOut();
        CommunityFragment.clearPagedSnapshots();
        if(isDestroyed()||isFinishing())return;
        if(screenView!=null)for(String name:Arrays.asList("login_submit_btn","register_submit","btn_google")){View button=screenView.findViewById(id(name));if(button!=null)button.setEnabled(true);}
        setText("login_submit_btn","Đăng nhập");
        setText("register_submit","Tạo tài khoản");
        toast(message);
    }
    private void show(String destination, boolean addHistory) {
        show(destination, addHistory, null, false);
    }
    public void openCommunity(String destination, String selectedId, boolean comments) {
        show(destination, true, selectedId, comments);
    }

    /** Let the story viewer use the full content height while keeping bottom navigation visible. */
    public void setStoryViewerVisible(boolean visible) {
        View topBar = findViewById(R.id.top_app_bar);
        if (visible) {
            if (topBar != null) topBar.setVisibility(View.GONE);
        } else if (!isFinishing()) updateChrome();
    }

    public void logoutFromProfile() {
        cancelLoginTransition();
        BackendSession.signOut();
        offlineGuest = false;
        CommunityFragment.clearPagedSnapshots();
        repository.put("logged_in", "no");
        history.clear();
        show("login", false);
    }
    private boolean communityScreen(String name) {
        return Arrays.asList("home", "explore", "messages", "message_requests", "chat", "create_menu", "create_post", "post_detail", "tip_detail", "report", "share_post", "friends", "notifications", "scanner", "profile", "user_profile", "market_detail", "create_listing", "market", "edit_profile", "addresses", "orders", "order_detail", "payment_demo", "payment_demo_result", "my_listings", "verification", "admin_dashboard", "admin_moderation", "admin_reports").contains(name);
    }
    private static boolean offlineGuestScreen(String name) {
        return Arrays.asList("home", "explore", "post_detail", "tip_detail", "market_detail").contains(name);
    }
    private static boolean isMainTab(String name) {
        return "home".equals(name) || "explore".equals(name) || "messages".equals(name) || "profile".equals(name);
    }
    private void show(String destination, boolean addHistory, String selectedId, boolean comments) {
        boolean auth = Arrays.asList("onboarding", "login", "register", "forgot_password", "otp").contains(destination);
        if ("market".equals(destination)) destination = "explore";
        if ("guide_detail".equals(destination)) destination = "explore";
        if (!auth && !BackendSession.isSignedIn() && !(offlineGuest && offlineGuestScreen(destination))) {
            destination = "login";
            auth = true;
            addHistory = false;
            history.clear();
        }
        if (auth) offlineGuest = false;
        if (addHistory && !comments && destination.equals(current) && java.util.Objects.equals(selectedId, entityId) && screenView != null) return;
        View mainView = findViewById(R.id.main);
        if (mainView != null && mainView.isAttachedToWindow()) {
            new WindowInsetsControllerCompat(getWindow(), mainView).hide(WindowInsetsCompat.Type.ime());
        }
        int layout = getResources().getIdentifier("fragment_" + ("tip_detail".equals(destination)?"post_detail":destination), "layout", getPackageName());
        if (layout == 0 && communityScreen(destination)) layout = R.layout.fragment_home;
        if (layout == 0) { toast("Không tìm thấy màn hình."); return; }
        if (Arrays.asList("home", "explore", "messages", "profile").contains(destination)) {
            history.clear();
        } else if (addHistory && !destination.equals(current)) {
            history.add(current + "\u001f" + (entityId == null ? "" : entityId) + "\u001f" + focusComments);
        }
        current = destination;
        entityId = selectedId; focusComments = comments;
        screenView = null;
        Fragment target = isMainTab(destination) ? mainTabs.get(destination) : null;
        boolean created = target == null;
        if (created) target = communityScreen(destination)
                ? CommunityFragment.create(destination, selectedId, comments) : ScreenFragment.create(destination, layout);
        if ("explore".equals(destination) && selectedId != null && target instanceof CommunityFragment)
            ((CommunityFragment) target).selectExploreTab(selectedId);
        FragmentTransaction transaction = getSupportFragmentManager().beginTransaction().setReorderingAllowed(true);
        // Root tabs switch immediately. Animating two whole feeds caused needless redraws.
        if (!isMainTab(destination)) transaction.setCustomAnimations(R.anim.screen_enter, R.anim.screen_exit,
                R.anim.screen_pop_enter, R.anim.screen_pop_exit);
        if (auth) {
            for (Fragment tab : mainTabs.values()) transaction.remove(tab);
            if (displayedFragment != null && !mainTabs.containsValue(displayedFragment)) transaction.remove(displayedFragment);
            mainTabs.clear();
        } else if (displayedFragment != null && displayedFragment != target) {
            boolean retain = mainTabs.containsValue(displayedFragment)
                    && (!(displayedFragment instanceof CommunityFragment) || ((CommunityFragment) displayedFragment).canRetainTabView());
            if (retain) transaction.hide(displayedFragment).setMaxLifecycle(displayedFragment, Lifecycle.State.STARTED);
            else {
                mainTabs.values().remove(displayedFragment);
                transaction.remove(displayedFragment);
            }
        }
        if (created) transaction.add(R.id.screen_container, target, isMainTab(destination) ? "tab:" + destination : "screen:" + destination);
        else transaction.show(target);
        if (isMainTab(destination)) mainTabs.put(destination, target);
        transaction.setMaxLifecycle(target, Lifecycle.State.RESUMED).setPrimaryNavigationFragment(target).commit();
        displayedFragment = target;
        updateChrome();
    }
    private void updateChrome() {
        boolean loggedIn = BackendSession.isSignedIn();
        boolean isAuth = Arrays.asList("onboarding", "login", "register", "forgot_password", "otp").contains(current);
        boolean isMainTab = Arrays.asList("home", "explore", "messages", "profile").contains(current);

        boolean scannerChrome = "scanner".equals(current);
        View mainView = findViewById(R.id.main);
        if (mainView != null) mainView.setBackgroundColor(scannerChrome ? 0xFF071009 : getColor(R.color.eco_background));
        WindowInsetsControllerCompat systemBars = new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView());
        systemBars.setAppearanceLightStatusBars(!scannerChrome);
        systemBars.setAppearanceLightNavigationBars(!scannerChrome);

        View topBar = findViewById(R.id.top_app_bar);
        boolean hideTopBar = isAuth || "profile".equals(current) || "chat".equals(current) || "messages".equals(current)
                || (communityScreen(current) && !Arrays.asList("home", "explore").contains(current));
        if (topBar != null) topBar.setVisibility(hideTopBar ? View.GONE : View.VISIBLE);

        View bottomNav = findViewById(R.id.bottom_nav_container);
        // Keep the tab bar visible above the keyboard on both searchable main tabs.
        boolean keepNavWithKeyboard = "messages".equals(current) || "explore".equals(current);
        boolean showBottomNav = (loggedIn || offlineGuest) && (isMainTab || "report".equals(current) || "chat".equals(current))
                && (!keyboardVisible || keepNavWithKeyboard);
        if (bottomNav != null) bottomNav.setVisibility(showBottomNav ? View.VISIBLE : View.GONE);

        // Guests may browse only the public feed and discovery pages. Keep the
        // sign-in entry visible while private navigation and writes stay hidden.
        View create = findViewById(R.id.nav_create);
        if (create != null && create.getParent() instanceof View) ((View)create.getParent()).setVisibility(offlineGuest ? View.GONE : View.VISIBLE);
        for (int navId : new int[]{R.id.nav_messages, R.id.nav_profile}) {
            View nav = findViewById(navId);
            if (nav != null) nav.setVisibility(offlineGuest ? View.GONE : View.VISIBLE);
        }
        View guestLogin = findViewById(R.id.guest_login_action);
        if (guestLogin != null) {
            guestLogin.setVisibility(offlineGuest && ("home".equals(current) || "explore".equals(current)) ? View.VISIBLE : View.GONE);
            guestLogin.setOnClickListener(v -> { history.clear(); show("login", false); });
        }

        View backBtn = findViewById(R.id.back_button);
        View topLogo = findViewById(R.id.top_logo);
        View topTitle = findViewById(R.id.top_title);
        View topActions = findViewById(R.id.top_actions);

        if ("home".equals(current) || "explore".equals(current)) {
            if (backBtn != null) backBtn.setVisibility(View.GONE);
            if (topLogo != null) topLogo.setVisibility(View.VISIBLE);
            if (topTitle != null) {
                ((TextView)topTitle).setText(R.string.app_name);
                topTitle.setVisibility(View.VISIBLE);
            }
            if (topActions != null) topActions.setVisibility(offlineGuest ? View.GONE : View.VISIBLE);
        } else if (!hideTopBar) {
            if (backBtn != null) backBtn.setVisibility(View.VISIBLE);
            if (topLogo != null) topLogo.setVisibility(View.GONE);
            if (topActions != null) topActions.setVisibility(View.GONE);
            if (topTitle != null) {
                topTitle.setVisibility(View.VISIBLE);
                ((TextView)topTitle).setText(screenTitle(current));
            }
        }

        for (String tab : Arrays.asList("home", "explore", "messages", "profile")) {
            boolean active = tab.equals(current) || ("chat".equals(current) && "messages".equals(tab));
            updateNavTab(tab, active);
        }
        View notificationBadge=findViewById(id("notification_badge"));
        if (notificationBadge!=null) notificationBadge.setVisibility(View.GONE);
        if (loggedIn && Arrays.asList("home", "explore").contains(current)) {
            FirebaseBackendClient badgeClient=BackendSession.get(this);
            badgeClient.request("GET", "/notifications?limit=3", null, null, new FirebaseBackendClient.Callback<JSONObject>() {
                @Override public void onSuccess(JSONObject value) {
                    if(!isFinishing() && !isDestroyed() && notificationBadge!=null && BackendSession.isSignedIn()
                            && Arrays.asList("home", "explore").contains(current))
                        notificationBadge.setVisibility(value.optInt("unread_count")>0?View.VISIBLE:View.GONE);
                }
                @Override public void onError(FirebaseBackendClient.BackendException error) { }
            });
        }
    }
    private String screenTitle(String screen) {
        int title = getResources().getIdentifier(screen+"_heading", "string", getPackageName());
        if (title != 0) return getString(title).replace('\n',' ');
        switch (screen) {
            case "notifications": return "Thông báo";
            case "friends": return "Bạn bè";
            case "scanner": return "SCAN";
            case "search": return "Tìm kiếm";
            case "create_post": return "Tạo bài viết";
            case "create_listing": return "Đăng bán đồ cũ";
            case "settings": return "Cài đặt ⚙️";
            case "terms_policy": return "Điều khoản & Chính sách";
            case "edit_profile": return "Chỉnh sửa hồ sơ";
            case "badges": return "Huy hiệu & Điểm Xanh";
            case "my_impact": return "Tác động môi trường";
            case "market_detail": return "Chi tiết món đồ";
            case "post_detail": return "Chi tiết bài đăng";
            case "checkout": return "Xác nhận đơn";
            case "payment": return "Thanh toán";
            default: return getString(R.string.app_name);
        }
    }
    private void updateNavTab(String tabName, boolean isSelected) {
        View tab=findViewById(id("nav_"+tabName));
        if (tab!=null) tab.setSelected(isSelected);
        int iconId = id("nav_" + tabName + "_icon");
        int labelId = id("nav_" + tabName + "_label");
        int dotId = id("nav_" + tabName + "_dot");

        android.widget.ImageView icon = findViewById(iconId);
        TextView label = findViewById(labelId);
        View dot = findViewById(dotId);

        int activeColor = getResources().getColor(R.color.eco_green, getTheme());
        int inactiveColor = 0xFF94A3B8;

        if (icon != null) icon.setColorFilter(isSelected ? activeColor : inactiveColor);
        if (label != null) {
            label.setTextColor(isSelected ? activeColor : inactiveColor);
            label.setTypeface(null, isSelected ? android.graphics.Typeface.BOLD : android.graphics.Typeface.NORMAL);
        }
        if (dot != null) dot.setVisibility(isSelected ? View.VISIBLE : View.INVISIBLE);
    }
    private void back() {
        if (!history.isEmpty()) {
            String[] entry=history.remove(history.size()-1).split("\u001f",-1);
            show(entry[0], false, entry.length>1&&!entry[1].isEmpty()?entry[1]:null, entry.length>2&&Boolean.parseBoolean(entry[2]));
        }
        else if ((BackendSession.isSignedIn() || offlineGuest) && !"home".equals(current)) show("home", false);
        else if (offlineGuest) { history.clear(); show("login", false); }
        else finish();
    }
    private void bindActions(View view) {
        if (view == null) return;
        if (view.getTag() instanceof String) view.setOnClickListener(v -> {
            try { action((String)v.getTag()); }
            catch (IllegalArgumentException | IllegalStateException error) { toast(error.getMessage()); }
        });
        if (view instanceof ViewGroup) for (int i=0; i<((ViewGroup)view).getChildCount(); i++) bindActions(((ViewGroup)view).getChildAt(i));
    }
    public void bindScreen(View view, String destination) {
        screenView = view; bindActions(view);
        if ("login".equals(destination)) { bindFirebaseLogin(view); return; }
        if ("register".equals(destination)) return;
        if ("forgot_password".equals(destination)) {
            View email = view.findViewById(id("reset_email"));
            if (email instanceof EditText) ((EditText) email).setText(BackendSession.profile().optString("email", ""));
            return;
        }
        if ("settings".equals(destination)) {
            View admin = view.findViewById(R.id.settings_admin);
            JSONObject profile = BackendSession.profile();
            String role = profile.optString("role");
            if (admin != null) admin.setVisibility(Arrays.asList("ADMIN", "MODERATOR").contains(role) ? View.VISIBLE : View.GONE);
            TextView contact = view.findViewById(id("settings_contact"));
            if (contact != null) contact.setText(profile.optString("email", "Chưa cập nhật") + "  ·  " + profile.optString("phone", "Chưa có số điện thoại"));
            android.content.SharedPreferences prefs = getSharedPreferences("ecoshare_notification_settings", MODE_PRIVATE);
            for (String[] setting : new String[][]{{"settings_push", "push"}, {"settings_messages", "messages"}, {"settings_reactions", "reactions"}, {"settings_challenges", "challenges"}}) {
                View toggle = view.findViewById(id(setting[0]));
                if (toggle instanceof android.widget.CompoundButton) {
                    android.widget.CompoundButton control = (android.widget.CompoundButton) toggle;
                    control.setChecked(prefs.getBoolean(setting[1], true));
                    control.setOnCheckedChangeListener((button, enabled) -> prefs.edit().putBoolean(setting[1], enabled).apply());
                }
            }
        }
        setText("verification_state", verificationLabel(repository.verification()));
        boolean hasOrder=!"NONE".equals(repository.orderStatus());
        setText("orders_summary",hasOrder?repository.get("order_id", "")+"\n"+repository.orderStatus():"Chưa có đơn hàng. Khám phá Chợ đồ cũ để bắt đầu.");
        setText("order_state",hasOrder?repository.get("order_id", "")+"\n"+repository.orderStatus():"Chưa có đơn hàng");
        setText("order_delivery", repository.get("delivery", "Chưa có thông tin giao hàng"));
        setText("payment_result_status", repository.get("payment_provider", "") + " • " + repository.get("payment_status", "UNPAID") + " (DEMO)");
        int points=repository.greenPoints();
        String formattedPoints=java.text.NumberFormat.getIntegerInstance(new Locale("vi", "VN")).format(points);
        setText("impact_points", formattedPoints + ("profile".equals(destination) || "home".equals(destination) ? "" : " điểm xanh"));
        setText("profile_points_summary",getString(R.string.profile_points_format,formattedPoints));
        View progress=view.findViewById(id("profile_points_progress"));
        if (progress instanceof android.widget.ProgressBar) ((android.widget.ProgressBar)progress).setProgress(Math.min(Math.max(points,0),2000));
        setText("notification_state", repository.get("notification", "Chưa có thông báo giao dịch"));
        setText("post_comments", repository.get("comments", "Chưa có bình luận mới"));
        setText("my_listing_state", repository.get("listing_title", "Chưa có tin mới") + "\n" + repository.get("listing_state", ""));
        setText("moderation_item", repository.get("pending_content", "Không có nội dung chờ duyệt") + "\n" + repository.get("listing_state", ""));
        setText("admin_report_list", repository.get("report", "Chưa có báo cáo") + "\n" + repository.get("report_state", ""));
        setText("admin_counts", ("PENDING".equals(repository.get("listing_state", "")) ? "1" : "0") + " nội dung chờ duyệt\n" + ("OPEN".equals(repository.get("report_state", "")) ? "1" : "0") + " báo cáo mở");
        if ("profile".equals(destination)) {
            setText("profile_heading", repository.get("profile_name", "Nguyễn Thị Lan"));
            setText("profile_bio_text",repository.get("profile_bio",getString(R.string.profile_bio_l1)));
            setText("profile_city_text",repository.get("profile_city","TP. Hồ Chí Minh"));
            filterProfileTab(repository.get("profile_tab","posts"));
        }
        if ("edit_profile".equals(destination)) {
            setText("profile_name", repository.get("profile_name", "Nguyễn Thị Lan"));
            setText("profile_bio", repository.get("profile_bio", ""));
            setText("profile_city", repository.get("profile_city", "TP. Hồ Chí Minh"));
        }
        if ("privacy_settings".equals(destination)) ((Switch)view.findViewById(R.id.privacy_location)).setChecked("yes".equals(repository.get("public_city", "no")));
        if ("checkout".equals(destination) || "addresses".equals(destination)) {
            String[] parts = repository.get("address", "").split("\n", 3);
            if (parts.length==3) {
                String prefix="checkout".equals(destination)?"delivery_":"address_";
                setText(prefix+"name",parts[0]);setText(prefix+"phone",parts[1]);setText("checkout".equals(destination)?"delivery_address":"address_line",parts[2]);
            }
        }
        if ("explore".equals(destination)) filterMaterial(repository.get("material_filter","all"));
        updateToggles(view);
        updateStateActions();
    }
    private String verificationLabel(String state) {
        int label=getResources().getIdentifier("status_"+state.toLowerCase(Locale.ROOT),"string",getPackageName());
        return label==0?state:getString(label);
    }
    private void visibleAction(String identifier,boolean visible) {
        View action=screenView.findViewById(id(identifier));
        if (action!=null) action.setVisibility(visible?View.VISIBLE:View.GONE);
    }
    private void updateStateActions() {
        String order=repository.orderStatus();
        visibleAction("order_payment","PENDING_PAYMENT".equals(order));
        visibleAction("order_cancel","PENDING_PAYMENT".equals(order)&&!"PENDING".equals(repository.get("payment_status","")));
        visibleAction("order_ship_demo","PAID".equals(order));
        visibleAction("order_complete","SHIPPED".equals(order));
        visibleAction("order_review","COMPLETED".equals(order)&&!"yes".equals(repository.get("reviewed","no")));
        visibleAction("order_dispute",Arrays.asList("PAID","SHIPPED","COMPLETED").contains(order));
        visibleAction("result_retry","PENDING_PAYMENT".equals(order));
        visibleAction("verify_submit",Arrays.asList("UNVERIFIED","REJECTED","EXPIRED").contains(repository.verification()));
    }
    private void updateToggles(View view) {
        if (view.getTag() instanceof String && view.getTag().toString().startsWith("toggle:")) {
            String tag=view.getTag().toString();boolean selected="yes".equals(repository.get(tag,"no"));view.setSelected(selected);
            if (view instanceof com.google.android.material.button.MaterialButton) {
                com.google.android.material.button.MaterialButton button=(com.google.android.material.button.MaterialButton)view;
                boolean like=tag.startsWith("toggle:like:");button.setText(like?(selected?R.string.action_liked:R.string.action_like):(selected?R.string.action_saved:R.string.action_save));
                int color=androidx.core.content.ContextCompat.getColor(this,selected?R.color.eco_green:R.color.eco_muted);
                button.setTextColor(color);button.setIconTint(android.content.res.ColorStateList.valueOf(color));
            }
        }
        if (view instanceof ViewGroup) for(int i=0;i<((ViewGroup)view).getChildCount();i++)updateToggles(((ViewGroup)view).getChildAt(i));
    }
    private void filterMaterial(String material) {
        repository.put("material_filter",material);
        int matches=filterMaterialViews(screenView,material);
        visibleAction("explore_empty",matches==0);
    }
    private void filterProfileTab(String selected) {
        repository.put("profile_tab",selected);
        filterProfileViews(screenView,selected);
        visibleAction("profile_saved_empty","saved".equals(selected)&&!"yes".equals(repository.get("toggle:save_post:1","no")));
    }
    private void filterProfileViews(View view,String selected) {
        String transition=view.getTransitionName();
        if ("profile:post".equals(transition)||"profile:tip".equals(transition)) {
            boolean visible="posts".equals(selected)||("tips".equals(selected)&&"profile:tip".equals(transition))||("saved".equals(selected)&&"profile:post".equals(transition)&&"yes".equals(repository.get("toggle:save_post:1","no")));
            view.setVisibility(visible?View.VISIBLE:View.GONE);
        }
        if (view instanceof TextView && view.getTag() instanceof String && view.getTag().toString().startsWith("profile_tab:")) {
            boolean active=view.getTag().equals("profile_tab:"+selected);view.setSelected(active);
            view.setBackgroundTintList(null);
            view.setBackgroundResource(active?R.drawable.bg_tab_active:R.drawable.bg_explore_tab_selected);
            ((TextView)view).setTextColor(androidx.core.content.ContextCompat.getColor(this,active?R.color.white:R.color.eco_muted));
        }
        if (view instanceof ViewGroup)for(int i=0;i<((ViewGroup)view).getChildCount();i++)filterProfileViews(((ViewGroup)view).getChildAt(i),selected);
    }
    private int filterMaterialViews(View view,String material) {
        int matches=0;
        if (view.getTransitionName()!=null && view.getTransitionName().startsWith("material:")) {
            boolean match="all".equals(material)||view.getTransitionName().equals("material:"+material);
            view.setVisibility(match?View.VISIBLE:View.GONE);if(match)matches++;
        }
        if (view.getTag() instanceof String && view.getTag().toString().startsWith("filter:") && view instanceof TextView) {
            boolean selected=view.getTag().equals("filter:"+material);view.setSelected(selected);
            view.setBackgroundTintList(null);
            view.setBackgroundResource(selected?R.drawable.bg_tab_active:R.drawable.bg_explore_tab_selected);
            ((TextView)view).setTextColor(androidx.core.content.ContextCompat.getColor(this,selected?R.color.white:R.color.eco_ink));
        }
        if (view instanceof ViewGroup)for(int i=0;i<((ViewGroup)view).getChildCount();i++)matches+=filterMaterialViews(((ViewGroup)view).getChildAt(i),material);
        return matches;
    }
    private String phone(String identifier) {
        String phone=required(identifier).replace(" ","");
        if(!phone.matches("\\+?[0-9]{9,15}"))throw new IllegalStateException("Số điện thoại không hợp lệ.");
        return phone;
    }
    private void action(String action) {
        if ("back".equals(action)) { back();return; }
        if ("offline:guest".equals(action)) {
            if (authenticating || awaitingLocalNetwork) return;
            if (BackendSession.isSignedIn()) BackendSession.signOut();
            CommunityFragment.clearPagedSnapshots();
            offlineGuest = true;
            history.clear();
            show("home", false);
            return;
        }
        if ("social:google".equals(action)) { googleLogin();return; }
        if (action.startsWith("social:")) { toast(getString(R.string.social_not_connected));return; }
        if (action.startsWith("filter:")) { filterMaterial(action.substring(7));return; }
        if (action.startsWith("profile_tab:")) { filterProfileTab(action.substring(12));return; }
        if (action.startsWith("toggle:")) { repository.put(action,"yes".equals(repository.get(action,"no"))?"no":"yes");updateToggles(screenView);return; }
        if (action.startsWith("screen:")) { show("create_post".equals(action.substring(7))?"create_menu":action.substring(7), true); return; }
        if (action.startsWith("login:")) { firebaseLogin(false); return; }
        if (action.startsWith("pick:")) { pickTarget = action.substring(5); picker.launch("image/*"); return; }
        if (action.startsWith("pay:")) {
            String provider = ((android.widget.RadioButton)screenView.findViewById(R.id.provider_momo)).isChecked() ? "MoMo" : "VNPay";
            repository.simulatePayment(provider, action.substring(4));
            repository.put("notification", "Thanh toán mẫu: " + repository.get("payment_status", "")); show("payment_result", true); return;
        }
        if (action.startsWith("moderate:")) {
            TradeRules.requireStatus(repository.get("listing_state", ""), "PENDING");
            if (action.endsWith("rejected")) required("moderation_reason");
            repository.put("listing_state", action.endsWith("approved") ? "APPROVED" : "REJECTED");
            toast("Đã cập nhật kiểm duyệt mẫu."); show(current, false); return;
        }
        switch (action) {
            case "register":
                firebaseLogin(true); break;
            case "reset":
                String email=required("reset_email");
                if (!android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()) throw new IllegalStateException("Email chưa hợp lệ.");
                BackendSession.get(this).resetPassword(email,new FirebaseBackendClient.Callback<JSONObject>(){
                    public void onSuccess(JSONObject result){show("login",false);toast("Nếu email hợp lệ, Firebase sẽ gửi thư đặt lại mật khẩu.");}
                    public void onError(FirebaseBackendClient.BackendException error){toast(error.getMessage());}
                }); break;
            case "otp":
                if (!required("otp_code").matches("[0-9]{6}")) throw new IllegalStateException("Nhập 6 chữ số mẫu.");
                history.clear();
                if ("reset".equals(otpPurpose)) { show("login",false);toast("Đã hoàn tất bước khôi phục mẫu. Vui lòng đăng nhập."); }
                else { repository.login(false);if(!registrationName.isEmpty())repository.put("profile_name",registrationName);show("home",false); }
                break;
            case "logout": logoutFromProfile(); break;
            case "buy": repository.verifyTrading(); show("checkout", true); break;
            case "submit_verification":
                if (!Arrays.asList("UNVERIFIED","REJECTED","EXPIRED").contains(repository.verification())) throw new IllegalStateException("Hồ sơ đã được gửi hoặc đã xác minh.");
                required("verify_name"); if (!((CheckBox)screenView.findViewById(R.id.verify_consent)).isChecked() || !"yes".equals(repository.get("picked_verification", "no"))) throw new IllegalStateException("Chọn tài liệu mẫu và xác nhận đồng ý.");
                repository.put("verification", "PENDING"); show(current, false); toast("Hồ sơ mẫu đang chờ admin web duyệt."); break;
            case "create_order":
                repository.createOrder(required("delivery_name")+"\n"+phone("delivery_phone")+"\n"+required("delivery_address")); show("payment", true); break;
            case "retry_payment": TradeRules.requireStatus(repository.orderStatus(), "PENDING_PAYMENT"); show("payment", true); break;
            case "open_order": if ("NONE".equals(repository.orderStatus())) throw new IllegalStateException("Bạn chưa có đơn mẫu."); show("order_detail", true); break;
            case "ship_order": repository.ship(); show(current, false); break;
            case "complete_order": repository.complete(); repository.put("notification", "Đơn đã hoàn tất. Bạn nhận 10 điểm xanh."); show(current, false); break;
            case "cancel_order": repository.cancel(); show("order_detail", true); break;
            case "submit_dispute": repository.dispute(required("dispute_reason")); show("order_detail", true); toast("Đã gửi khiếu nại mẫu đến admin."); break;
            case "submit_review": TradeRules.requireStatus(repository.orderStatus(), "COMPLETED");
                if ("yes".equals(repository.get("reviewed", "no"))) throw new IllegalStateException("Bạn đã đánh giá đơn này.");
                required("review_content"); if (((RatingBar)screenView.findViewById(R.id.review_rating)).getRating()<1) throw new IllegalStateException("Chọn ít nhất 1 sao.");
                repository.put("reviewed", "yes"); toast("Đã lưu đánh giá mẫu."); back(); break;
            case "submit_listing":
                repository.verifyTrading(); String title=required("listing_title"); required("listing_category"); required("listing_condition"); required("listing_description");
                try { if (Long.parseLong(required("listing_amount"))<=0 || Integer.parseInt(required("listing_quantity"))<=0) throw new NumberFormatException(); }
                catch (NumberFormatException error) { throw new IllegalStateException("Giá và số lượng phải là số nguyên dương hợp lệ."); }
                if (!"yes".equals(repository.get("picked_listing", "no"))) throw new IllegalStateException("Chọn ít nhất một ảnh sản phẩm.");
                repository.put("listing_title", title); repository.put("pending_content", title); repository.put("listing_state", "PENDING"); show("my_listings", true); break;
            case "submit_post": repository.put("pending_content", required("post_content")); repository.put("listing_state", "PENDING"); toast("Bài viết mẫu đã gửi chờ duyệt."); back(); break;
            case "submit_report": repository.put("report", required("report_reason")); repository.put("report_state", "OPEN"); toast("Đã lưu báo cáo mẫu."); back(); break;
            case "ack_report": TradeRules.requireStatus(repository.get("report_state", ""), "OPEN"); repository.put("report_state", "IN_REVIEW"); show(current, false); break;
            case "comment_post": repository.put("comments", repository.get("comments", "")+"\nBạn: "+required("post_comment")); setText("post_comments", repository.get("comments", "")); setText("post_comment", ""); break;
            case "search":
                String query=required("search_query").toLowerCase(Locale.ROOT);String category=value("search_category").toLowerCase(Locale.ROOT);
                boolean found="đèn lọ thủy tinh vintage".contains(query)&&(category.isEmpty()||"đồ gia dụng".contains(category));
                setText("search_results",found?"1 kết quả: Đèn lọ thủy tinh vintage · 120.000 ₫":"Không có kết quả phù hợp trong dữ liệu mẫu.");
                visibleAction("search_open",found);break;
            case "save_profile": repository.put("profile_name", required("profile_name")); repository.put("profile_bio", value("profile_bio")); repository.put("profile_city", value("profile_city")); toast("Đã lưu hồ sơ trên thiết bị."); back();break;
            case "save_address": repository.put("address", required("address_name")+"\n"+phone("address_phone")+"\n"+required("address_line")); toast("Đã lưu địa chỉ mẫu."); back();break;
            case "save_privacy": repository.put("public_city", ((Switch)screenView.findViewById(R.id.privacy_location)).isChecked() ? "yes" : "no"); toast("Đã lưu lựa chọn."); break;
            case "save_listing": case "like_post": case "join_challenge": case "join_group": case "join_event":
                boolean wasSet="yes".equals(repository.get(action,"no")); repository.put(action,wasSet ? "no" : "yes"); toast(wasSet ? "Đã bỏ lựa chọn mẫu." : "Đã lưu lựa chọn mẫu."); break;
            default: toast("Thao tác chưa được hỗ trợ.");
        }
    }
}
