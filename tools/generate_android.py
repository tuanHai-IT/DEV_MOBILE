"""Generate Android XML screens from the reviewed native screen catalogue.

Run from the repository root: python tools/generate_android.py
Only generated layouts, strings and style resources are replaced.
"""
from pathlib import Path
from xml.sax.saxutils import escape
import xml.etree.ElementTree as ET
import json
import re
from native_refinements import refine

ROOT = Path(__file__).resolve().parents[1]
if (ROOT / 'app/src/main/java/com/example/recyclingshareapp/ui/CommunityFragment.java').exists():
    raise SystemExit('Online community layouts are maintained in app/src/main/res/layout. Legacy regeneration is disabled to preserve the Firebase screens.')
RES = ROOT / 'app/src/main/res'
strings = {'app_name': 'EcoShare', 'back': 'Quay lại', 'demo_notice': 'Bản mẫu • Dữ liệu lưu trên thiết bị'}
screens = {}

def clean_key(key):
    k = re.sub(r'[^a-zA-Z0-9_]', '_', key).strip('_').lower()
    return k or 'val'

def s(key, value):
    k = clean_key(key)
    strings[k] = value
    return '@string/' + k

def text(key, value, style='Body', extra='', width='match_parent', height='wrap_content'):
    return f'<TextView style="@style/Eco.{style}" android:layout_width="{width}" android:layout_height="{height}" android:text="{s(key, value)}" {extra}/>\n'

def button(key, value, action, secondary=False, icon=None):
    icon_attr = f' app:icon="@drawable/{icon}" app:iconGravity="textStart" app:iconSize="18dp" app:iconPadding="8dp"' if icon else ''
    style_name = "Secondary" if secondary else "Button"
    return f'<com.google.android.material.button.MaterialButton style="@style/Eco.{style_name}" android:layout_width="match_parent" android:layout_height="wrap_content" android:id="@+id/{key}" android:text="{s(key, value)}" android:tag="{action}"{icon_attr}/>\n'

def field(key, hint, kind='text', value='', helper=''):
    val = f' android:text="{s(key + "_value", value)}"' if value else ''
    help_attr = f' app:helperText="{s(key + "_helper", helper)}"' if helper else ''
    return f'<com.google.android.material.textfield.TextInputLayout style="@style/Eco.Input" android:layout_width="match_parent" android:layout_height="wrap_content" android:hint="{s(key + "_hint", hint)}"{help_attr}><com.google.android.material.textfield.TextInputEditText android:id="@+id/{key}" android:layout_width="match_parent" android:layout_height="wrap_content" android:inputType="{kind}" android:maxLength="1000"{val}/></com.google.android.material.textfield.TextInputLayout>\n'

def badge(key, value, variant='mint', extra=''):
    bg = {'mint': '@drawable/bg_mint', 'verified': '@drawable/bg_badge_verified', 'pending': '@drawable/bg_badge_pending', 'rejected': '@drawable/bg_badge_rejected'}.get(variant, '@drawable/bg_mint')
    color = {'mint': '@color/eco_green', 'verified': '@color/eco_green', 'pending': '@color/eco_amber', 'rejected': '@color/eco_red'}.get(variant, '@color/eco_green')
    return f'<TextView style="@style/Eco.Badge" android:layout_width="wrap_content" android:layout_height="wrap_content" android:background="{bg}" android:textColor="{color}" android:text="{s(key, value)}" {extra}/>\n'

def card(key, title, body, action=None, badge_text=None, icon=None):
    res = '<LinearLayout style="@style/Eco.Card" android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="vertical">'
    if badge_text or icon:
        res += '<LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="horizontal" android:gravity="center_vertical" android:layout_marginBottom="8dp">'
        if icon:
            res += f'<ImageView android:layout_width="22dp" android:layout_height="22dp" android:src="@drawable/{icon}" android:layout_marginEnd="8dp"/>'
        res += f'<TextView style="@style/Eco.CardTitle" android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:layout_marginBottom="0dp" android:text="{s(key + "_title", title)}"/>'
        if badge_text:
            res += f'<TextView style="@style/Eco.Badge" android:layout_width="wrap_content" android:layout_height="wrap_content" android:layout_marginBottom="0dp" android:paddingHorizontal="10dp" android:paddingVertical="4dp" android:textSize="11sp" android:text="{s(key + "_badge", badge_text)}"/>'
        res += '</LinearLayout>'
    else:
        res += text(key + '_title', title, 'CardTitle')
    if body:
        res += text(key + '_body', body, 'Body')
    if action:
        res += button(key + '_open', 'Xem chi tiết →', 'screen:' + action, secondary=True, icon='ic_chevron_right')
    res += '</LinearLayout>\n'
    return res

def hero(key, eyebrow, title, body, icon='ic_eco_leaf'):
    res = '<LinearLayout style="@style/Eco.Hero" android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="vertical">'
    res += '<LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="horizontal" android:gravity="center_vertical" android:layout_marginBottom="8dp">'
    res += f'<ImageView android:layout_width="20dp" android:layout_height="20dp" android:src="@drawable/{icon}" android:layout_marginEnd="6dp"/>'
    res += text(key + '_eyebrow', eyebrow, 'HeroLabel', width='wrap_content')
    res += '</LinearLayout>'
    res += text(key + '_heading', title, 'HeroTitle')
    res += text(key + '_copy', body, 'HeroBody')
    res += '</LinearLayout>\n'
    return res

def points_card(key, points_title, points_val, subtitle, action=None):
    res = '<LinearLayout style="@style/Eco.Hero" android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="vertical" android:background="@drawable/bg_hero">'
    res += '<LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="horizontal" android:gravity="center_vertical">'
    res += '<ImageView android:layout_width="24dp" android:layout_height="24dp" android:src="@drawable/ic_eco_leaf" android:layout_marginEnd="10dp"/>'
    res += '<LinearLayout android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:orientation="vertical">'
    res += f'<TextView style="@style/Eco.HeroLabel" android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="{s(key + "_lbl", points_title)}" android:layout_marginBottom="2dp"/>'
    res += f'<TextView style="@style/Eco.HeroTitle" android:layout_width="wrap_content" android:layout_height="wrap_content" android:id="@+id/{key}_points" android:text="{s(key + "_pts", points_val)}" android:textSize="24sp" android:layout_marginBottom="2dp"/>'
    res += f'<TextView style="@style/Eco.HeroBody" android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="{s(key + "_sub", subtitle)}" android:textSize="12sp"/>'
    res += '</LinearLayout>'
    res += '</LinearLayout>'
    if action:
        res += f'<com.google.android.material.button.MaterialButton style="@style/Eco.Secondary" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="12dp" android:id="@+id/{key}_btn" android:text="{s(key + "_act", "Xem chi tiết điểm xanh →")}" android:tag="screen:{action}"/>'
    res += '</LinearLayout>\n'
    return res

def section(title):
    k = clean_key('sec_' + title)
    return f'<TextView style="@style/Eco.Title" android:layout_width="match_parent" android:layout_height="wrap_content" android:textSize="18sp" android:layout_marginTop="8dp" android:layout_marginBottom="12dp" android:text="{s(k, title)}"/>\n'

def screen(name, title, subtitle, content, custom_xml=None):
    screens[name] = {'title': title, 'subtitle': subtitle}
    if custom_xml:
        xml = custom_xml
    else:
        xml = ('<?xml version="1.0" encoding="utf-8"?>\n'
               '<ScrollView xmlns:android="http://schemas.android.com/apk/res/android" '
               'xmlns:app="http://schemas.android.com/apk/res-auto" '
               'android:layout_width="match_parent" android:layout_height="match_parent" '
               'android:fillViewport="true" android:background="@color/eco_background">\n'
               '<LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content" '
               'android:orientation="vertical" android:paddingHorizontal="18dp" android:paddingVertical="18dp">\n')
        xml += text(name + '_subtitle', subtitle, 'Eyebrow')
        xml += text(name + '_heading', title, 'Title', f'android:id="@+id/{name}_heading"')
        xml += content
        xml += '</LinearLayout>\n</ScrollView>\n'
    ET.register_namespace('android', 'http://schemas.android.com/apk/res/android')
    ET.register_namespace('app', 'http://schemas.android.com/apk/res-auto')
    document = ET.fromstring(xml)
    document = refine(name, document, s)
    ET.indent(document)
    (RES / 'layout' / f'fragment_{name}.xml').write_bytes(ET.tostring(document, encoding='utf-8', xml_declaration=True))

# 1. Onboarding
screen('onboarding', 'Vòng đời mới.\nGiá trị mới.', 'ECOSHARE / SỐNG XANH MỖI NGÀY',
    hero('welcome', 'CÙNG NHAU TÁI SỬ DỤNG', 'Món đồ cũ,\nkhởi đầu mới.', 'Mua bán đồ đã qua sử dụng, chia sẻ kiến thức sống xanh và kết nối trạm thu gom quanh bạn.', icon='ic_eco_leaf') +
    card('trust', 'An tâm từ cả hai phía', 'Người mua và người bán đều phải được xác minh trước khi giao dịch. Bảo đảm minh bạch, an toàn tuyệt đối.', icon='ic_shield', badge_text='ĐÃ XÁC MINH') +
    card('payment_info', 'Thanh toán trực tuyến tiện lợi', 'Hỗ trợ thiết kế tích hợp cổng ví điện tử MoMo và VNPay với quy trình bảo vệ đơn hàng rõ ràng.', icon='ic_wallet') +
    card('rewards_info', 'Tích lũy Điểm Xanh mỗi ngày', 'Nhận điểm thưởng cho mỗi giao dịch thành công hoặc hoạt động phân loại rác bảo vệ môi trường.', icon='ic_award') +
    button('get_started', 'Bắt đầu hành trình ngay →', 'screen:login', icon='ic_nav_home'))

# 2. Login (Upgraded to match user Image 1)
login_xml = f'''<?xml version="1.0" encoding="utf-8"?>
<ScrollView xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:fillViewport="true"
    android:background="@color/eco_green_dark">

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="vertical">

        <!-- Photo hero behind the brand -->
        <FrameLayout
            android:layout_width="match_parent"
            android:layout_height="300dp">

            <ImageView
                android:layout_width="match_parent"
                android:layout_height="match_parent"
                android:src="@drawable/img_cover_plants"
                android:scaleType="centerCrop"
                android:importantForAccessibility="no" />

            <View
                android:layout_width="match_parent"
                android:layout_height="match_parent"
                android:background="#990B3425"
                android:importantForAccessibility="no" />

        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="match_parent"
            android:orientation="vertical"
            android:gravity="top|center_horizontal"
            android:paddingHorizontal="24dp"
            android:paddingTop="36dp"
            android:paddingBottom="28dp">

            <LinearLayout
                android:layout_width="56dp"
                android:layout_height="56dp"
                android:gravity="center"
                android:background="@drawable/bg_badge_verified"
                android:backgroundTint="#33FFFFFF"
                android:layout_marginBottom="16dp">

                <TextView
                    android:layout_width="36dp"
                    android:layout_height="36dp"
                    android:gravity="center"
                    android:translationY="-3dp"
                    android:text="♻︎"
                    android:textColor="@color/eco_lime"
                    android:textSize="31sp"
                    android:contentDescription="{s('login_logo_desc', 'EcoShare')}" />
            </LinearLayout>

            <TextView
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="{s('login_brand_title', 'EcoShare')}"
                android:textColor="@color/white"
                android:textSize="36sp"
                android:textStyle="bold"
                android:fontFamily="serif"
                android:layout_marginBottom="6dp" />

            <TextView
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="{s('login_brand_sub', 'Cộng đồng tái chế — Sống xanh cùng nhau 🌿')}"
                android:textColor="#E0F2E9"
                android:textSize="13.5sp"
                android:gravity="center"
                android:layout_marginBottom="24dp" />

            <!-- Community Stats Row (1.247 thành viên | 89kg tái chế/ngày | 4.6★ đánh giá) -->
            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:orientation="horizontal"
                android:gravity="center"
                android:baselineAligned="false">

                <LinearLayout
                    android:layout_width="0dp"
                    android:layout_height="wrap_content"
                    android:layout_weight="1"
                    android:orientation="vertical"
                    android:gravity="center">

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('stat_members_val', '1.247')}"
                        android:textColor="@color/white"
                        android:textSize="17sp"
                        android:textStyle="bold" />

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('stat_members_lbl', 'thành viên')}"
                        android:textColor="#C2E0D1"
                        android:textSize="11.5sp" />
                </LinearLayout>

                <View
                    android:layout_width="1dp"
                    android:layout_height="26dp"
                    android:background="#40FFFFFF" />

                <LinearLayout
                    android:layout_width="0dp"
                    android:layout_height="wrap_content"
                    android:layout_weight="1"
                    android:orientation="vertical"
                    android:gravity="center">

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('stat_weight_val', '89kg')}"
                        android:textColor="@color/white"
                        android:textSize="17sp"
                        android:textStyle="bold" />

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('stat_weight_lbl', 'tái chế/ngày')}"
                        android:textColor="#C2E0D1"
                        android:textSize="11.5sp" />
                </LinearLayout>

                <View
                    android:layout_width="1dp"
                    android:layout_height="26dp"
                    android:background="#40FFFFFF" />

                <LinearLayout
                    android:layout_width="0dp"
                    android:layout_height="wrap_content"
                    android:layout_weight="1"
                    android:orientation="vertical"
                    android:gravity="center">

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('stat_rating_val', '4.6★')}"
                        android:textColor="@color/white"
                        android:textSize="17sp"
                        android:textStyle="bold" />

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('stat_rating_lbl', 'đánh giá')}"
                        android:textColor="#C2E0D1"
                        android:textSize="11.5sp" />
                </LinearLayout>
            </LinearLayout>
        </LinearLayout>
        </FrameLayout>

        <!-- Bottom Sheet White Card Overlay (Image 1) -->
        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="vertical"
            android:background="@drawable/bg_card"
            android:backgroundTint="@color/white"
            android:paddingHorizontal="24dp"
            android:paddingTop="28dp"
            android:paddingBottom="36dp">

            <TextView
                android:id="@+id/login_heading"
                style="@style/Eco.Title"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="{s('login_welcome_title', 'Chào mừng trở lại! 👋')}"
                android:textSize="22sp"
                android:layout_marginBottom="4dp" />

            <TextView
                style="@style/Eco.Body"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="{s('login_welcome_sub', 'Đăng nhập để kết nối với cộng đồng xanh')}"
                android:textSize="13sp"
                android:textColor="@color/eco_muted"
                android:layout_marginBottom="20dp" />

            <!-- EMAIL -->
            <TextView
                style="@style/Eco.Eyebrow"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="{s('login_email_lbl', 'EMAIL')}"
                android:textSize="11sp"
                android:textColor="@color/eco_muted"
                android:layout_marginBottom="6dp" />

            <com.google.android.material.textfield.TextInputLayout
                style="@style/Eco.Input"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:hint="{s('login_email_hint', 'email@example.com')}"
                android:layout_marginBottom="12dp">

                <com.google.android.material.textfield.TextInputEditText
                    android:id="@+id/login_email"
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:inputType="textEmailAddress" />
            </com.google.android.material.textfield.TextInputLayout>

            <!-- MẬT KHẨU -->
            <TextView
                style="@style/Eco.Eyebrow"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="{s('login_pwd_lbl', 'MẬT KHẨU')}"
                android:textSize="11sp"
                android:textColor="@color/eco_muted"
                android:layout_marginBottom="6dp" />

            <com.google.android.material.textfield.TextInputLayout
                style="@style/Eco.Input"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:hint="{s('login_pwd_hint', '••••••••')}"
                app:passwordToggleEnabled="true"
                android:layout_marginBottom="6dp">

                <com.google.android.material.textfield.TextInputEditText
                    android:id="@+id/login_password"
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:inputType="textPassword" />
            </com.google.android.material.textfield.TextInputLayout>

            <!-- Quên mật khẩu? -->
            <TextView
                android:id="@+id/go_forgot"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_gravity="end"
                android:text="{s('login_forgot_link', 'Quên mật khẩu?')}"
                android:textColor="@color/eco_ink"
                android:textSize="12.5sp"
                android:textStyle="bold"
                android:paddingVertical="4dp"
                android:layout_marginBottom="16dp"
                android:tag="screen:forgot_password" />

            <!-- CTA Đăng nhập Button -->
            <com.google.android.material.button.MaterialButton
                android:id="@+id/login_submit_btn"
                style="@style/Eco.Button"
                android:layout_width="match_parent"
                android:layout_height="52dp"
                android:text="{s('login_btn_submit', 'Đăng nhập')}"
                android:textSize="15sp"
                android:tag="login:verified"
                android:layout_marginBottom="8dp" />

            <!-- Quick Unverified Demo Option -->
            <com.google.android.material.button.MaterialButton
                android:id="@+id/login_unverified_btn"
                style="@style/Eco.Secondary"
                android:layout_width="match_parent"
                android:layout_height="42dp"
                android:text="{s('login_unverified_demo', 'Dùng tài khoản chưa xác minh • Demo')}"
                android:textSize="12sp"
                android:tag="login:unverified"
                android:layout_marginBottom="18dp" />

            <!-- Divider: hoac -->
            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:orientation="horizontal"
                android:gravity="center_vertical"
                android:layout_marginBottom="18dp">

                <View
                    android:layout_width="0dp"
                    android:layout_height="1dp"
                    android:layout_weight="1"
                    android:background="@color/eco_border" />

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="{s('login_or_text', '  hoặc  ')}"
                    android:textColor="@color/eco_muted_light"
                    android:textSize="12sp" />

                <View
                    android:layout_width="0dp"
                    android:layout_height="1dp"
                    android:layout_weight="1"
                    android:background="@color/eco_border" />
            </LinearLayout>

            <!-- Social Login: Google & Apple -->
            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:orientation="horizontal"
                android:gravity="center"
                android:layout_marginBottom="24dp">

                <com.google.android.material.button.MaterialButton
                    android:id="@+id/btn_google"
                    style="@style/Eco.Secondary"
                    android:layout_width="0dp"
                    android:layout_height="48dp"
                    android:layout_weight="1"
                    android:layout_marginEnd="6dp"
                    android:text="{s('login_google', 'Google')}"
                    android:textColor="#334155"
                    android:textSize="13sp"
                    app:icon="@drawable/ic_google"
                    app:iconSize="18dp"
                    app:iconTint="@null"
                    app:iconGravity="textStart"
                    app:strokeColor="#CBD5E1"
                    app:strokeWidth="1dp"
                    android:tag="login:verified" />

                <com.google.android.material.button.MaterialButton
                    android:id="@+id/btn_apple"
                    style="@style/Eco.Secondary"
                    android:layout_width="0dp"
                    android:layout_height="48dp"
                    android:layout_weight="1"
                    android:layout_marginStart="6dp"
                    android:text="{s('login_apple', 'Apple')}"
                    android:textColor="#334155"
                    android:textSize="13sp"
                    app:icon="@drawable/ic_apple"
                    app:iconSize="18dp"
                    app:iconTint="@null"
                    app:iconGravity="textStart"
                    app:strokeColor="#CBD5E1"
                    app:strokeWidth="1dp"
                    android:tag="login:verified" />
            </LinearLayout>

            <!-- Footer: Chưa có tài khoản? Đăng ký ngay -->
            <TextView
                android:id="@+id/go_register"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_gravity="center"
                android:padding="8dp"
                android:layout_marginBottom="24dp"
                android:text="{s('login_footer_register', 'Chưa có tài khoản? Đăng ký ngay')}"
                android:textColor="@color/eco_ink"
                android:textSize="13sp"
                android:tag="screen:register" />

        </LinearLayout>
    </LinearLayout>
</ScrollView>'''
screen('login', 'Chào mừng trở lại! 👋', 'TÀI KHOẢN ECOSHARE', '', custom_xml=login_xml)

# 3. Register
screen('register', 'Tạo tài khoản', 'GIA NHẬP CỘNG ĐỒNG ECOSHARE',
    card('register_intro', 'Bắt đầu lối sống xanh', 'Chỉ mất 1 phút để đăng ký tài khoản tham gia mua bán và chia sẻ kiến thức.', icon='ic_eco_leaf') +
    field('register_name', 'Họ và tên đầy đủ') +
    field('register_email', 'Địa chỉ Email', 'textEmailAddress') +
    field('register_password', 'Mật khẩu (tối thiểu 8 ký tự)', 'textPassword') +
    button('register_submit', 'Tiếp tục • Nhận mã xác thực OTP', 'register', icon='ic_arrow_back'))

# 4. OTP
screen('otp', 'Xác nhận liên hệ', 'BƯỚC 02 / BẢO MẬT TÀI KHOẢN',
    card('otp_card', 'Mã xác thực gửi qua tin nhắn', 'Luồng demo: nhập 6 chữ số bất kỳ (ví dụ: 123456) để kích hoạt tài khoản mẫu và đăng nhập vào ứng dụng.', icon='ic_shield') +
    field('otp_code', 'Mã OTP mẫu (6 chữ số)', 'number') +
    button('otp_submit', 'Xác nhận mã và Đăng nhập', 'otp', icon='ic_verified'))

# 5. Forgot Password
screen('forgot_password', 'Lấy lại mật khẩu', 'BẢO MẬT TÀI KHOẢN',
    card('forgot_card', 'Khôi phục quyền truy cập', 'Nhập email bạn đã đăng ký để nhận liên kết đặt lại mật khẩu an toàn.', icon='ic_shield') +
    field('reset_email', 'Email đã đăng ký', 'textEmailAddress') +
    button('reset_submit', 'Gửi hướng dẫn xác nhận • Demo', 'reset', icon='ic_arrow_back'))

# 6. Home (Upgraded to match user Images 2 & 3)
home_xml = f'''<?xml version="1.0" encoding="utf-8"?>
<ScrollView xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:fillViewport="true"
    android:background="@color/eco_background">

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="vertical"
        android:paddingHorizontal="16dp"
        android:paddingTop="12dp"
        android:paddingBottom="24dp">

        <!-- Top Eco Points Card (Matching Image 2 & 3) -->
        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="horizontal"
            android:gravity="center_vertical"
            android:background="@drawable/bg_hero"
            android:paddingHorizontal="16dp"
            android:paddingVertical="14dp"
            android:layout_marginBottom="14dp"
            android:tag="screen:my_impact">

            <ImageView
                android:layout_width="28dp"
                android:layout_height="28dp"
                android:src="@drawable/ic_eco_leaf"
                android:layout_marginEnd="12dp"
                android:contentDescription="{s('home_pts_leaf_desc', 'Eco Points')}" />

            <LinearLayout
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:orientation="vertical">

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="{s('home_pts_title', 'Điểm Eco của bạn')}"
                    android:textColor="@color/white"
                    android:textSize="14sp"
                    android:textStyle="bold"
                    android:layout_marginBottom="2dp" />

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="{s('home_pts_subtitle', 'Hoàn thành thêm thử thách để tăng điểm')}"
                    android:textColor="#C8E6D8"
                    android:textSize="11.5sp" />
            </LinearLayout>

            <LinearLayout
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:orientation="vertical"
                android:gravity="end">

                <TextView
                    android:id="@+id/impact_points"
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="{s('home_pts_val', '1,240')}"
                    android:textColor="@color/white"
                    android:textSize="22sp"
                    android:textStyle="bold" />

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="{s('home_pts_unit', 'điểm')}"
                    android:textColor="@color/eco_lime"
                    android:textSize="11sp"
                    android:textStyle="bold" />
            </LinearLayout>
        </LinearLayout>




        <!-- Social Feed: Post 1 (Lê Thị Hoa - Images 2 & 3) -->
        <LinearLayout
            style="@style/Eco.Card"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="vertical"
            android:padding="16dp"
            android:layout_marginBottom="16dp">

            <!-- Author Header -->
            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:orientation="horizontal"
                android:gravity="center_vertical"
                android:layout_marginBottom="10dp">

                <!-- Avatar with Online Dot -->
                <FrameLayout
                    android:layout_width="44dp"
                    android:layout_height="44dp">

                    <ImageView
                        android:layout_width="44dp"
                        android:layout_height="44dp"
                        android:src="@drawable/ic_avatar_hoa"
                        android:contentDescription="{s('author_hoa', 'Lê Thị Hoa')}" />

                    <View
                        android:layout_width="12dp"
                        android:layout_height="12dp"
                        android:layout_gravity="bottom|end"
                        android:background="@drawable/bg_online_dot" />
                </FrameLayout>

                <LinearLayout
                    android:layout_width="0dp"
                    android:layout_height="wrap_content"
                    android:layout_weight="1"
                    android:orientation="vertical"
                    android:layout_marginStart="10dp">

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('post_author_1', 'Lê Thị Hoa')}"
                        android:textColor="@color/eco_ink"
                        android:textSize="15sp"
                        android:textStyle="bold"
                        android:layout_marginBottom="2dp" />

                    <LinearLayout
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:orientation="horizontal"
                        android:gravity="center_vertical">

                        <TextView
                            android:layout_width="wrap_content"
                            android:layout_height="wrap_content"
                            android:text="{s('post_time_1', '2 giờ trước • ')}"
                            android:textColor="@color/eco_muted"
                            android:textSize="11.5sp" />

                        <!-- Category Pill -->
                        <TextView
                            android:layout_width="wrap_content"
                            android:layout_height="wrap_content"
                            android:background="@drawable/bg_badge_verified"
                            android:backgroundTint="@color/eco_blue_light"
                            android:paddingHorizontal="7dp"
                            android:paddingVertical="2dp"
                            android:text="{s('post_cat_nhua', 'Nhựa')}"
                            android:textColor="@color/eco_blue"
                            android:textSize="10.5sp"
                            android:textStyle="bold"
                            android:layout_marginEnd="6dp" />

                        <!-- Weight Saved Pill -->
                        <TextView
                            android:layout_width="wrap_content"
                            android:layout_height="wrap_content"
                            android:background="@drawable/bg_badge_verified"
                            android:paddingHorizontal="7dp"
                            android:paddingVertical="2dp"
                            android:text="{s('post_weight_saved_1', '♻ 0.8kg')}"
                            android:textColor="@color/eco_green"
                            android:textSize="10.5sp"
                            android:textStyle="bold" />
                    </LinearLayout>
                </LinearLayout>

                <ImageView
                    android:layout_width="22dp"
                    android:layout_height="22dp"
                    android:src="@drawable/ic_more_vert"
                    android:contentDescription="{s('more_desc', 'Tùy chọn')}" />
            </LinearLayout>

            <!-- Post Text Content -->
            <TextView
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:text="{s('post_body_1', 'Biến 5 chai nhựa cũ thành vườn treo mini siêu xinh 🌿✨ Mất khoảng 30 phút và HOÀN TOÀN không tốn tiền!\n\n📋 Cách làm:\n1️⃣ ...\nXem thêm')}"
                android:textColor="@color/eco_ink"
                android:textSize="14sp"
                android:lineSpacingExtra="3dp"
                android:layout_marginBottom="8dp"
                android:tag="screen:post_detail" />

            <!-- Hashtags -->
            <TextView
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:text="{s('post_tags_1', '#ChậuHoa #TáiChếNhựa #DIY #ZeroWaste')}"
                android:textColor="@color/eco_green"
                android:textSize="13sp"
                android:textStyle="bold"
                android:layout_marginBottom="12dp" />

            <!-- Post Image with Overlay Badge -->
            <FrameLayout
                android:layout_width="match_parent"
                android:layout_height="240dp"
                android:background="@drawable/bg_card_mint"
                android:layout_marginBottom="12dp"
                android:tag="screen:post_detail">

                <ImageView
                    android:layout_width="match_parent"
                    android:layout_height="match_parent"
                    android:scaleType="centerCrop"
                    android:src="@drawable/illustration_hanging_garden"
                    android:contentDescription="{s('post_img_desc_1', 'Vườn treo chai nhựa tái chế')}" />

                <!-- Badge overlay top-left -->
                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:layout_margin="12dp"
                    android:background="@drawable/bg_badge_verified"
                    android:backgroundTint="#D9FFFFFF"
                    android:paddingHorizontal="10dp"
                    android:paddingVertical="5dp"
                    android:text="{s('overlay_badge_tip', '💡 Mẹo hay')}"
                    android:textColor="@color/eco_green"
                    android:textSize="11.5sp"
                    android:textStyle="bold" />
            </FrameLayout>

            <!-- Reaction Counts Row -->
            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:orientation="horizontal"
                android:gravity="center_vertical"
                android:paddingVertical="4dp"
                android:layout_marginBottom="8dp">

                <TextView
                    android:layout_width="0dp"
                    android:layout_height="wrap_content"
                    android:layout_weight="1"
                    android:text="{s('post_react_1', '❤️ ♻️ 🌿 234 lượt thích')}"
                    android:textColor="@color/eco_muted"
                    android:textSize="12sp" />

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="{s('post_comments_shares_1', '3 bình luận  •  89 lượt chia sẻ')}"
                    android:textColor="@color/eco_muted"
                    android:textSize="12sp"
                    android:tag="screen:post_detail" />
            </LinearLayout>

            <View
                android:layout_width="match_parent"
                android:layout_height="1dp"
                android:background="@color/eco_border_subtle"
                android:layout_marginBottom="6dp" />

            <!-- Post Action Bar: Thả cảm xúc, Bình luận, Chia sẻ, Lưu (User requirement!) -->
            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="44dp"
                android:orientation="horizontal"
                android:gravity="center_vertical">

                <!-- 1. Thích -->
                <com.google.android.material.button.MaterialButton
                    style="@style/Widget.Material3.Button.TextButton"
                    android:layout_width="0dp"
                    android:layout_height="match_parent"
                    android:layout_weight="1"
                    android:text="{s('act_like', 'Thích')}"
                    android:textColor="@color/eco_muted"
                    android:textSize="12sp"
                    app:icon="@drawable/ic_like_outline"
                    app:iconTint="@color/eco_muted"
                    app:iconSize="18dp"
                    app:iconGravity="textStart"
                    android:padding="0dp"
                    android:tag="like_post" />

                <!-- 2. Bình luận -->
                <com.google.android.material.button.MaterialButton
                    style="@style/Widget.Material3.Button.TextButton"
                    android:layout_width="0dp"
                    android:layout_height="match_parent"
                    android:layout_weight="1"
                    android:text="{s('act_comment', 'Bình luận')}"
                    android:textColor="@color/eco_muted"
                    android:textSize="12sp"
                    app:icon="@drawable/ic_comment"
                    app:iconTint="@color/eco_muted"
                    app:iconSize="18dp"
                    app:iconGravity="textStart"
                    android:padding="0dp"
                    android:tag="screen:post_detail" />

                <!-- 3. Chia sẻ -->
                <com.google.android.material.button.MaterialButton
                    style="@style/Widget.Material3.Button.TextButton"
                    android:layout_width="0dp"
                    android:layout_height="match_parent"
                    android:layout_weight="1"
                    android:text="{s('act_share', 'Chia sẻ')}"
                    android:textColor="@color/eco_muted"
                    android:textSize="12sp"
                    app:icon="@drawable/ic_share"
                    app:iconTint="@color/eco_muted"
                    app:iconSize="18dp"
                    app:iconGravity="textStart"
                    android:padding="0dp"
                    android:tag="screen:post_detail" />

                <!-- 4. Lưu -->
                <com.google.android.material.button.MaterialButton
                    style="@style/Widget.Material3.Button.TextButton"
                    android:layout_width="0dp"
                    android:layout_height="match_parent"
                    android:layout_weight="1"
                    android:text="{s('act_save', 'Lưu')}"
                    android:textColor="@color/eco_muted"
                    android:textSize="12sp"
                    app:icon="@drawable/ic_bookmark"
                    app:iconTint="@color/eco_muted"
                    app:iconSize="18dp"
                    app:iconGravity="textStart"
                    android:padding="0dp"
                    android:tag="save_listing" />
            </LinearLayout>
        </LinearLayout>

        <!-- Social Feed: Post 2 (Trần Văn Minh) -->
        <LinearLayout
            style="@style/Eco.Card"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="vertical"
            android:padding="16dp"
            android:layout_marginBottom="16dp">

            <!-- Author Header -->
            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:orientation="horizontal"
                android:gravity="center_vertical"
                android:layout_marginBottom="10dp">

                <FrameLayout
                    android:layout_width="44dp"
                    android:layout_height="44dp">

                    <ImageView
                        android:layout_width="44dp"
                        android:layout_height="44dp"
                        android:src="@drawable/ic_avatar_minh"
                        android:contentDescription="{s('author_minh', 'Trần Văn Minh')}" />

                    <View
                        android:layout_width="12dp"
                        android:layout_height="12dp"
                        android:layout_gravity="bottom|end"
                        android:background="@drawable/bg_online_dot" />
                </FrameLayout>

                <LinearLayout
                    android:layout_width="0dp"
                    android:layout_height="wrap_content"
                    android:layout_weight="1"
                    android:orientation="vertical"
                    android:layout_marginStart="10dp">

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('post_author_2', 'Trần Văn Minh')}"
                        android:textColor="@color/eco_ink"
                        android:textSize="15sp"
                        android:textStyle="bold"
                        android:layout_marginBottom="2dp" />

                    <LinearLayout
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:orientation="horizontal"
                        android:gravity="center_vertical">

                        <TextView
                            android:layout_width="wrap_content"
                            android:layout_height="wrap_content"
                            android:text="{s('post_time_2', '4 giờ trước • ')}"
                            android:textColor="@color/eco_muted"
                            android:textSize="11.5sp" />

                        <TextView
                            android:layout_width="wrap_content"
                            android:layout_height="wrap_content"
                            android:background="@drawable/bg_badge_verified"
                            android:backgroundTint="@color/eco_amber_light"
                            android:paddingHorizontal="7dp"
                            android:paddingVertical="2dp"
                            android:text="{s('post_cat_caosu', 'Cao su')}"
                            android:textColor="@color/eco_amber"
                            android:textSize="10.5sp"
                            android:textStyle="bold"
                            android:layout_marginEnd="6dp" />

                        <TextView
                            android:layout_width="wrap_content"
                            android:layout_height="wrap_content"
                            android:background="@drawable/bg_badge_verified"
                            android:paddingHorizontal="7dp"
                            android:paddingVertical="2dp"
                            android:text="{s('post_weight_saved_2', '♻ 12kg')}"
                            android:textColor="@color/eco_green"
                            android:textSize="10.5sp"
                            android:textStyle="bold" />
                    </LinearLayout>
                </LinearLayout>

                <ImageView
                    android:layout_width="22dp"
                    android:layout_height="22dp"
                    android:src="@drawable/ic_more_vert"
                    android:contentDescription="{s('more_desc2', 'Tùy chọn')}" />
            </LinearLayout>

            <TextView
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:text="{s('post_body_2', 'Nhiều chỗ sửa xe sẵn sàng cho lốp cũ lắm! Mình vừa xin được 3 lốp xe cũ làm xích đu và bồn hoa cho các bé mầm non sân nhà...')}"
                android:textColor="@color/eco_ink"
                android:textSize="14sp"
                android:lineSpacingExtra="3dp"
                android:layout_marginBottom="12dp"
                android:tag="screen:post_detail" />

            <!-- Post Image -->
            <FrameLayout
                android:layout_width="match_parent"
                android:layout_height="180dp"
                android:background="@drawable/bg_card_mint"
                android:layout_marginBottom="12dp"
                android:tag="screen:post_detail">

                <ImageView
                    android:layout_width="match_parent"
                    android:layout_height="match_parent"
                    android:scaleType="centerCrop"
                    android:src="@drawable/illustration_tire_swing"
                    android:contentDescription="{s('post_img_desc_2', 'Xích đu lốp xe tái chế')}" />
            </FrameLayout>

            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:orientation="horizontal"
                android:gravity="center_vertical"
                android:paddingVertical="4dp"
                android:layout_marginBottom="8dp">

                <TextView
                    android:layout_width="0dp"
                    android:layout_height="wrap_content"
                    android:layout_weight="1"
                    android:text="{s('post_react_2', '❤️ ♻️ 156 lượt thích')}"
                    android:textColor="@color/eco_muted"
                    android:textSize="12sp" />

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="{s('post_comments_shares_2', '8 bình luận  •  24 lượt chia sẻ')}"
                    android:textColor="@color/eco_muted"
                    android:textSize="12sp"
                    android:tag="screen:post_detail" />
            </LinearLayout>

            <View
                android:layout_width="match_parent"
                android:layout_height="1dp"
                android:background="@color/eco_border_subtle"
                android:layout_marginBottom="6dp" />

            <!-- Post Action Bar -->
            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="44dp"
                android:orientation="horizontal"
                android:gravity="center_vertical">

                <com.google.android.material.button.MaterialButton
                    style="@style/Widget.Material3.Button.TextButton"
                    android:layout_width="0dp"
                    android:layout_height="match_parent"
                    android:layout_weight="1"
                    android:text="{s('act_like2', 'Thích')}"
                    android:textColor="@color/eco_muted"
                    android:textSize="12sp"
                    app:icon="@drawable/ic_like_outline"
                    app:iconTint="@color/eco_muted"
                    app:iconSize="18dp"
                    app:iconGravity="textStart"
                    android:padding="0dp"
                    android:tag="like_post" />

                <com.google.android.material.button.MaterialButton
                    style="@style/Widget.Material3.Button.TextButton"
                    android:layout_width="0dp"
                    android:layout_height="match_parent"
                    android:layout_weight="1"
                    android:text="{s('act_comment2', 'Bình luận')}"
                    android:textColor="@color/eco_muted"
                    android:textSize="12sp"
                    app:icon="@drawable/ic_comment"
                    app:iconTint="@color/eco_muted"
                    app:iconSize="18dp"
                    app:iconGravity="textStart"
                    android:padding="0dp"
                    android:tag="screen:post_detail" />

                <com.google.android.material.button.MaterialButton
                    style="@style/Widget.Material3.Button.TextButton"
                    android:layout_width="0dp"
                    android:layout_height="match_parent"
                    android:layout_weight="1"
                    android:text="{s('act_share2', 'Chia sẻ')}"
                    android:textColor="@color/eco_muted"
                    android:textSize="12sp"
                    app:icon="@drawable/ic_share"
                    app:iconTint="@color/eco_muted"
                    app:iconSize="18dp"
                    app:iconGravity="textStart"
                    android:padding="0dp"
                    android:tag="screen:post_detail" />

                <com.google.android.material.button.MaterialButton
                    style="@style/Widget.Material3.Button.TextButton"
                    android:layout_width="0dp"
                    android:layout_height="match_parent"
                    android:layout_weight="1"
                    android:text="{s('act_save2', 'Lưu')}"
                    android:textColor="@color/eco_muted"
                    android:textSize="12sp"
                    app:icon="@drawable/ic_bookmark"
                    app:iconTint="@color/eco_muted"
                    app:iconSize="18dp"
                    app:iconGravity="textStart"
                    android:padding="0dp"
                    android:tag="save_listing" />
            </LinearLayout>
        </LinearLayout>

        <!-- Bottom Actions -->
        <com.google.android.material.button.MaterialButton
            style="@style/Eco.Button"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:id="@+id/home_post_create"
            android:text="{s('btn_share_story', '+ Chia sẻ câu chuyện sống xanh của bạn')}"
            app:icon="@drawable/ic_plus"
            app:iconSize="18dp"
            app:iconGravity="textStart"
            android:tag="screen:create_post" />

        <com.google.android.material.button.MaterialButton
            style="@style/Eco.Secondary"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:id="@+id/home_market"
            android:text="{s('btn_explore_market', 'Khám phá tất cả sản phẩm Chợ đồ cũ →')}"
            app:icon="@drawable/ic_nav_market"
            app:iconSize="18dp"
            app:iconGravity="textStart"
            android:tag="screen:market" />

    </LinearLayout>
</ScrollView>'''
screen('home', 'Chào Lan, sống xanh nhé!', 'ECOSHARE / CỘNG ĐỒNG', '', custom_xml=home_xml)

# 7. Explore (Upgraded to match user Image 4 + includes integrated Market section)
explore_xml = f'''<?xml version="1.0" encoding="utf-8"?>
<ScrollView xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:fillViewport="true"
    android:background="@color/eco_background">

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="vertical"
        android:paddingHorizontal="16dp"
        android:paddingTop="12dp"
        android:paddingBottom="24dp">

        <!-- Top Header: Title & Shortcut Icons -->
        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="horizontal"
            android:gravity="center_vertical"
            android:layout_marginBottom="12dp">

            <TextView
                android:id="@+id/explore_heading"
                style="@style/Eco.Title"
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:text="{s('explore_title_header', 'Khám phá ♻')}"
                android:textSize="24sp"
                android:layout_marginBottom="0dp" />

            <com.google.android.material.button.MaterialButton
                style="@style/Widget.Material3.Button.IconButton"
                android:layout_width="38dp"
                android:layout_height="38dp"
                android:layout_marginEnd="4dp"
                android:insetLeft="0dp"
                android:insetTop="0dp"
                android:insetRight="0dp"
                android:insetBottom="0dp"
                app:cornerRadius="19dp"
                app:backgroundTint="@color/eco_mint"
                app:icon="@drawable/ic_eco_leaf"
                app:iconTint="@color/eco_ink"
                app:iconSize="18dp"
                app:iconGravity="textStart"
                android:tag="screen:material_guide" />

            <com.google.android.material.button.MaterialButton
                style="@style/Widget.Material3.Button.IconButton"
                android:layout_width="38dp"
                android:layout_height="38dp"
                android:insetLeft="0dp"
                android:insetTop="0dp"
                android:insetRight="0dp"
                android:insetBottom="0dp"
                app:cornerRadius="19dp"
                app:backgroundTint="@color/eco_mint"
                app:icon="@drawable/ic_map_pin"
                app:iconTint="@color/eco_ink"
                app:iconSize="18dp"
                app:iconGravity="textStart"
                android:tag="screen:recycling_map" />
        </LinearLayout>

        <!-- Search Bar -->
        <com.google.android.material.button.MaterialButton
            style="@style/Eco.Secondary"
            android:layout_width="match_parent"
            android:layout_height="48dp"
            android:text="{s('explore_search_hint', '🔍 Tìm kiếm mẹo tái chế, đồ cũ...')}"
            android:textColor="@color/eco_muted"
            android:textSize="13sp"
            android:gravity="start|center_vertical"
            android:paddingStart="16dp"
            android:layout_marginBottom="14dp"
            android:tag="screen:search" />

        <!-- Category Switch Pills (User instruction: Chuyển đổi Mẹo hay hoặc Chợ đồ cũ) -->
        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="horizontal"
            android:gravity="center_vertical"
            android:layout_marginBottom="14dp">

            <!-- Tab 1: Mẹo hay (Active) -->
            <TextView
                android:layout_width="0dp"
                android:layout_height="38dp"
                android:layout_weight="1"
                android:gravity="center"
                android:background="@drawable/bg_badge_verified"
                android:backgroundTint="@color/eco_green"
                android:text="{s('tab_diy_tips', '💡 Mẹo hay')}"
                android:textColor="@color/white"
                android:textSize="12.5sp"
                android:textStyle="bold"
                android:layout_marginEnd="6dp" />

            <!-- Tab 2: Thử thách -->
            <TextView
                android:layout_width="0dp"
                android:layout_height="38dp"
                android:layout_weight="1"
                android:gravity="center"
                android:background="@drawable/bg_card"
                android:text="{s('tab_challenges', '🏆 Thử thách')}"
                android:textColor="@color/eco_ink"
                android:textSize="12.5sp"
                android:layout_marginEnd="6dp"
                android:tag="screen:challenge_detail" />

            <!-- Tab 3: Chợ đồ cũ (Switches to Market!) -->
            <TextView
                android:layout_width="0dp"
                android:layout_height="38dp"
                android:layout_weight="1"
                android:gravity="center"
                android:background="@drawable/bg_card"
                android:text="{s('tab_market_integrated', '🛍️ Chợ đồ cũ')}"
                android:textColor="@color/eco_ink"
                android:textSize="12.5sp"
                android:tag="screen:market" />
        </LinearLayout>

        <!-- Material Filter Pills (Horizontal) -->
        <HorizontalScrollView
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:scrollbars="none"
            android:layout_marginBottom="14dp">

            <LinearLayout
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:orientation="horizontal"
                android:gravity="center_vertical">

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="32dp"
                    android:gravity="center"
                    android:paddingHorizontal="14dp"
                    android:background="@drawable/bg_badge_verified"
                    android:backgroundTint="@color/eco_ink"
                    android:text="{s('mat_all', 'Tất cả')}"
                    android:textColor="@color/white"
                    android:textSize="11.5sp"
                    android:textStyle="bold"
                    android:layout_marginEnd="6dp" />

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="32dp"
                    android:gravity="center"
                    android:paddingHorizontal="14dp"
                    android:background="@drawable/bg_card"
                    android:text="{s('mat_plastic', 'Nhựa')}"
                    android:textColor="@color/eco_ink"
                    android:textSize="11.5sp"
                    android:layout_marginEnd="6dp" />

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="32dp"
                    android:gravity="center"
                    android:paddingHorizontal="14dp"
                    android:background="@drawable/bg_card"
                    android:text="{s('mat_glass', 'Thủy tinh')}"
                    android:textColor="@color/eco_ink"
                    android:textSize="11.5sp"
                    android:layout_marginEnd="6dp" />

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="32dp"
                    android:gravity="center"
                    android:paddingHorizontal="14dp"
                    android:background="@drawable/bg_card"
                    android:text="{s('mat_rubber', 'Cao su')}"
                    android:textColor="@color/eco_ink"
                    android:textSize="11.5sp"
                    android:layout_marginEnd="6dp" />

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="32dp"
                    android:gravity="center"
                    android:paddingHorizontal="14dp"
                    android:background="@drawable/bg_card"
                    android:text="{s('mat_paper', 'Giấy')}"
                    android:textColor="@color/eco_ink"
                    android:textSize="11.5sp"
                    android:layout_marginEnd="6dp" />

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="32dp"
                    android:gravity="center"
                    android:paddingHorizontal="14dp"
                    android:background="@drawable/bg_card"
                    android:text="{s('mat_electronic', 'Điện tử')}"
                    android:textColor="@color/eco_ink"
                    android:textSize="11.5sp" />
            </LinearLayout>
        </HorizontalScrollView>

        <!-- Featured Banner Card (Image 4) -->
        <FrameLayout
            android:layout_width="match_parent"
            android:layout_height="140dp"
            android:background="@drawable/bg_hero"
            android:padding="16dp"
            android:layout_marginBottom="16dp"
            android:tag="screen:guide_detail">

            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:layout_gravity="bottom"
                android:orientation="vertical">

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="{s('feat_badge_lbl', '✨ NỔI BẬT')}"
                    android:textColor="@color/eco_lime"
                    android:textSize="11sp"
                    android:textStyle="bold"
                    android:layout_marginBottom="2dp" />

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="{s('feat_guide_title', 'Chai nhựa thành chậu vườn treo')}"
                    android:textColor="@color/white"
                    android:textSize="18sp"
                    android:textStyle="bold"
                    android:layout_marginBottom="4dp" />

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="{s('feat_guide_meta', '⏱ 20 phút • Dễ • ❤️ 1,234')}"
                    android:textColor="#E0F2E9"
                    android:textSize="12sp" />
            </LinearLayout>
        </FrameLayout>

        <!-- 2-Column Grid (Mẹo hay tái chế) -->
        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="horizontal"
            android:layout_marginBottom="14dp">

            <!-- Card 1 (Left): Lốp xe thành xích đu -->
            <LinearLayout
                style="@style/Eco.Card"
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:layout_marginEnd="6dp"
                android:padding="10dp"
                android:tag="screen:guide_detail">

                <ImageView
                    android:layout_width="match_parent"
                    android:layout_height="110dp"
                    android:scaleType="centerCrop"
                    android:src="@drawable/illustration_tire_swing"
                    android:background="@drawable/bg_card_mint"
                    android:layout_marginBottom="8dp"
                    android:contentDescription="{s('diy_tire_desc', 'Lốp xe tái chế')}" />

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:background="@drawable/bg_badge_verified"
                    android:backgroundTint="@color/eco_amber_light"
                    android:paddingHorizontal="7dp"
                    android:paddingVertical="2dp"
                    android:text="{s('diff_medium', 'Trung bình')}"
                    android:textColor="@color/eco_amber"
                    android:textSize="10sp"
                    android:textStyle="bold"
                    android:layout_marginBottom="4dp" />

                <TextView
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:text="{s('diy_title_1', 'Lốp xe thành xích đu sân vườn')}"
                    android:textColor="@color/eco_ink"
                    android:textSize="13sp"
                    android:textStyle="bold"
                    android:maxLines="2"
                    android:layout_marginBottom="4dp" />

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="{s('diy_meta_1', '⏱ 2 giờ • ❤️ 856\\nbởi Minh')}"
                    android:textColor="@color/eco_muted"
                    android:textSize="11sp" />
            </LinearLayout>

            <!-- Card 2 (Right): Lọ thủy tinh thành đèn -->
            <LinearLayout
                style="@style/Eco.Card"
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:layout_marginStart="6dp"
                android:padding="10dp"
                android:tag="screen:market_detail">

                <ImageView
                    android:layout_width="match_parent"
                    android:layout_height="110dp"
                    android:scaleType="centerInside"
                    android:src="@drawable/illustration_lamp"
                    android:background="@drawable/bg_card_mint"
                    android:layout_marginBottom="8dp"
                    android:contentDescription="{s('diy_lamp_desc', 'Đèn lọ thủy tinh')}" />

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:background="@drawable/bg_badge_verified"
                    android:paddingHorizontal="7dp"
                    android:paddingVertical="2dp"
                    android:text="{s('diff_easy', 'Dễ')}"
                    android:textColor="@color/eco_green"
                    android:textSize="10sp"
                    android:textStyle="bold"
                    android:layout_marginBottom="4dp" />

                <TextView
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:text="{s('diy_title_2', 'Lọ thủy tinh thành đèn trang trí')}"
                    android:textColor="@color/eco_ink"
                    android:textSize="13sp"
                    android:textStyle="bold"
                    android:maxLines="2"
                    android:layout_marginBottom="4dp" />

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="{s('diy_meta_2', '⏱ 10 phút • ❤️ 2.1k\\nbởi Mai')}"
                    android:textColor="@color/eco_muted"
                    android:textSize="11sp" />
            </LinearLayout>
        </LinearLayout>

        <!-- Integrated Market Section (User instruction: Mục khám phá sẽ chứa cả mục chợ đồ cũ) -->
        <TextView
            style="@style/Eco.Title"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:text="{s('explore_sec_market', '🛍️ Chợ đồ cũ nổi bật')}"
            android:textSize="18sp"
            android:layout_marginTop="8dp"
            android:layout_marginBottom="12dp" />

        <LinearLayout
            style="@style/Eco.Card"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="vertical"
            android:layout_marginBottom="12dp">

            <ImageView
                android:layout_width="match_parent"
                android:layout_height="160dp"
                android:src="@drawable/illustration_lamp"
                android:background="@drawable/bg_card_mint"
                android:contentDescription="{s('explore_market_lamp_desc', 'Đèn lọ vintage')}"
                android:scaleType="centerInside"
                android:layout_marginBottom="10dp" />

            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:orientation="horizontal"
                android:gravity="center_vertical"
                android:layout_marginBottom="4dp">

                <TextView
                    style="@style/Eco.Badge"
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:background="@drawable/bg_badge_verified"
                    android:text="{s('badge_like_new_exp', 'NHƯ MỚI')}"
                    android:textSize="10.5sp"
                    android:paddingHorizontal="8dp"
                    android:paddingVertical="3dp"
                    android:layout_marginBottom="0dp"
                    android:layout_marginEnd="6dp" />

                <TextView
                    style="@style/Eco.Body"
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:textSize="12sp"
                    android:text="{s('city_hcm_exp', 'TP. Hồ Chí Minh')}"
                    android:layout_marginBottom="0dp" />
            </LinearLayout>

            <TextView
                style="@style/Eco.CardTitle"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:text="{s('exp_item_title', 'Đèn lọ thủy tinh vintage')}" />

            <TextView
                style="@style/Eco.PriceTag"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="{s('exp_item_price', '120.000 ₫')}"
                android:layout_marginBottom="6dp" />

            <TextView
                style="@style/Eco.Body"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:text="{s('exp_item_seller', 'Người bán: Trần Văn Minh • Đã xác minh ✓')}" />

            <com.google.android.material.button.MaterialButton
                style="@style/Eco.Button"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:text="{s('btn_buy_exp', 'Xem chi tiết & Mua ngay →')}"
                app:icon="@drawable/ic_nav_market"
                app:iconSize="18dp"
                app:iconGravity="textStart"
                android:tag="screen:market_detail" />
        </LinearLayout>

        <!-- Market Action Shortcuts -->
        <com.google.android.material.button.MaterialButton
            style="@style/Eco.Secondary"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:text="{s('btn_sell_item', '+ Đăng bán món đồ mới')}"
            app:icon="@drawable/ic_plus"
            app:iconSize="18dp"
            app:iconGravity="textStart"
            android:tag="screen:create_listing"
            android:layout_marginBottom="8dp" />

        <com.google.android.material.button.MaterialButton
            style="@style/Eco.Secondary"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:text="{s('btn_full_market', 'Vào toàn bộ danh mục Chợ đồ cũ →')}"
            app:icon="@drawable/ic_nav_market"
            app:iconSize="18dp"
            app:iconGravity="textStart"
            android:tag="screen:market" />

    </LinearLayout>
</ScrollView>'''
screen('explore', 'Khám phá điều xanh', 'KIẾN THỨC & CỘNG ĐỒNG ECOSHARE', '', custom_xml=explore_xml)

# 8. Market
screen('market', 'Chợ đồ cũ', 'MUA BÁN / TÁI SỬ DỤNG VẬT PHẨM',
    card('market_trust_box', 'Giao dịch có bảo vệ', 'Cả người mua và người bán đều phải có hồ sơ xác minh danh tính được duyệt. Giá niêm yết bằng VNĐ.', icon='ic_verified', badge_text='AN TÂM') +
    button('market_search', 'Tìm kiếm & Lọc danh mục sản phẩm', 'screen:search', secondary=True, icon='ic_search') +
    '<LinearLayout style="@style/Eco.Card" android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="vertical">' +
    '<ImageView android:layout_width="match_parent" android:layout_height="180dp" android:src="@drawable/illustration_lamp" android:background="@drawable/bg_card_mint" android:contentDescription="' + s('desc_lamp2', 'Đèn lọ thủy tinh vintage') + '" android:scaleType="centerInside" android:layout_marginBottom="12dp"/>' +
    '<LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="horizontal" android:gravity="center_vertical" android:layout_marginBottom="4dp">' +
    '<TextView style="@style/Eco.Badge" android:layout_width="wrap_content" android:layout_height="wrap_content" android:background="@drawable/bg_badge_verified" android:text="' + s('badge_new2', 'NHƯ MỚI') + '" android:textSize="10.5sp" android:paddingHorizontal="8dp" android:paddingVertical="3dp" android:layout_marginBottom="0dp" android:layout_marginEnd="6dp"/>' +
    '<TextView style="@style/Eco.Body" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textSize="12sp" android:text="' + s('city_hcm2', 'TP. Hồ Chí Minh') + '" android:layout_marginBottom="0dp"/>' +
    '</LinearLayout>' +
    text('market_lamp_title', 'Đèn lọ thủy tinh vintage', 'CardTitle') +
    '<TextView style="@style/Eco.PriceTag" android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="' + s('market_lamp_price', '120.000 ₫') + '" android:layout_marginBottom="6dp"/>' +
    text('market_lamp_desc', 'Người bán: Trần Văn Minh • Đã xác minh ✓\nPhí ship dự kiến: 25.000 ₫', 'Body') +
    button('market_lamp_open', 'Xem chi tiết & Mua ngay →', 'screen:market_detail', secondary=True, icon='ic_nav_market') +
    '</LinearLayout>' +
    button('market_sell', '+ Đăng bán món đồ mới', 'screen:create_listing', icon='ic_plus') +
    button('market_orders', 'Quản lý Đơn mua & Đơn bán', 'screen:orders', secondary=True, icon='ic_truck'))

# 9. Market Detail
screen('market_detail', 'Đèn lọ thủy tinh vintage', 'ĐỒ GIA DỤNG / NHƯ MỚI',
    '<LinearLayout style="@style/Eco.Card" android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="vertical" android:padding="12dp">' +
    '<ImageView android:layout_width="match_parent" android:layout_height="220dp" android:src="@drawable/illustration_lamp" android:background="@drawable/bg_card_mint" android:contentDescription="' + s('lamp_description', 'Bộ đèn làm từ lọ thủy tinh tái sử dụng') + '" android:scaleType="centerInside" android:layout_marginBottom="8dp"/>' +
    '</LinearLayout>' +
    '<LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="horizontal" android:gravity="center_vertical" android:layout_marginBottom="8dp">' +
    '<TextView style="@style/Eco.PriceTag" android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:id="@+id/listing_price" android:text="' + s('sample_price', '120.000 ₫') + '" android:textSize="26sp"/>' +
    '<TextView style="@style/Eco.Badge" android:layout_width="wrap_content" android:layout_height="wrap_content" android:id="@+id/seller_status" android:background="@drawable/bg_badge_verified" android:text="' + s('sample_seller', 'Trần Văn Minh • Đã xác minh ✓') + '" android:layout_marginBottom="0dp"/>' +
    '</LinearLayout>' +
    card('listing_info', 'Thông tin sản phẩm', 'Bộ 3 lọ thủy tinh tái sử dụng kèm nến thơm vintage. Nhận trực tiếp tại TP. Hồ Chí Minh hoặc giao hàng toàn quốc (25.000 ₫). Tình trạng: Như mới. Tồn kho: 1 bộ.', icon='ic_shield') +
    button('buy_now', '🛒 Mua ngay (120.000 ₫)', 'buy', icon='ic_nav_market') +
    button('contact_seller', '💬 Nhắn tin cho người bán', 'screen:chat', secondary=True, icon='ic_nav_messages') +
    button('listing_save', '❤️ Lưu vào danh sách yêu thích', 'save_listing', secondary=True, icon='ic_heart') +
    button('listing_report', '🚩 Báo cáo tin đăng vi phạm', 'screen:report', secondary=True))

# 10. Create Listing
screen('create_listing', 'Đăng bán món đồ', 'TIN ĐĂNG MỚI / CHỜ KIỂM DUYỆT',
    card('sell_guide', 'Quy tắc đăng bán an toàn', 'Chỉ người bán đã được xác minh mới được gửi tin. Mọi tin đăng mới sẽ được ban quản trị xét duyệt trong 24h.', icon='ic_shield') +
    field('listing_title', 'Tên sản phẩm (ví dụ: Bộ bình thủy tinh)') +
    field('listing_category', 'Danh mục (Đồ gia dụng, Sách, Quần áo...)') +
    field('listing_condition', 'Tình trạng (Mới, Như mới, Đã qua sử dụng)') +
    field('listing_amount', 'Giá bán (VNĐ)', 'number') +
    field('listing_quantity', 'Số lượng sản phẩm', 'number', '1') +
    field('listing_description', 'Mô tả chi tiết sản phẩm, xuất xứ, kích thước...', 'textMultiLine') +
    button('listing_photo', 'Chọn ảnh sản phẩm từ máy', 'pick:listing', secondary=True, icon='ic_camera') +
    text('listing_photo_status', 'Chưa chọn ảnh nào', extra='android:id="@+id/listing_photo_status"') +
    button('listing_submit', 'Gửi tin đăng chờ duyệt', 'submit_listing', icon='ic_plus'))

# 11. Verification
screen('verification', 'Xác minh danh tính', 'DÀNH CHO CẢ NGƯỜI MUA & NGƯỜI BÁN',
    '<LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="horizontal" android:gravity="center_vertical" android:layout_marginBottom="12dp">' +
    '<TextView style="@style/Eco.CardTitle" android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="' + s('verify_state_lbl', 'Trạng thái hồ sơ: ') + '" android:layout_marginBottom="0dp"/>' +
    '<TextView style="@style/Eco.Badge" android:layout_width="wrap_content" android:layout_height="wrap_content" android:id="@+id/verification_state" android:text="' + s('unverified_lbl', 'Chưa xác minh') + '" android:layout_marginBottom="0dp"/>' +
    '</LinearLayout>' +
    card('verify_why', 'Vì sao cần xác minh?', 'Xác minh danh tính giúp bảo vệ cộng đồng, chống lừa đảo và kích hoạt đầy đủ quyền đăng bán, mua hàng và nhận thanh toán.', icon='ic_shield', badge_text='QUAN TRỌNG') +
    field('verify_name', 'Họ tên đúng trên giấy tờ CCCD/CMND') +
    button('verify_document', 'Chọn ảnh tài liệu mẫu', 'pick:verification', secondary=True, icon='ic_camera') +
    text('verify_document_status', 'Bản demo: không lưu trữ hoặc tải lên giấy tờ thật.', extra='android:id="@+id/verify_document_status"') +
    '<CheckBox android:id="@+id/verify_consent" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginBottom="12dp" android:text="' + s('verify_consent_label', 'Tôi đồng ý gửi hồ sơ mẫu để ban quản trị xét duyệt quyền giao dịch') + '"/>' +
    button('verify_submit', 'Gửi hồ sơ mẫu xét duyệt', 'submit_verification', icon='ic_verified'))

# 12. Checkout
screen('checkout', 'Xác nhận đặt mua', 'BƯỚC 01 / THÔNG TIN GIAO NHẬN',
    card('checkout_item', 'Đèn lọ thủy tinh vintage', 'Số lượng: 1 bộ × 120.000 ₫\nPhí giao hàng: 25.000 ₫\n------------------------\nTổng thanh toán: 145.000 ₫', icon='ic_nav_market', badge_text='ĐƠN HÀNG') +
    badge('checkout_verify', '✓ Cả hai bên đều đã xác minh danh tính hợp lệ', variant='verified') +
    field('delivery_name', 'Họ tên người nhận hàng') +
    field('delivery_phone', 'Số điện thoại liên hệ', 'phone') +
    field('delivery_address', 'Địa chỉ nhận hàng chi tiết', 'textPostalAddress') +
    button('checkout_continue', 'Tiếp tục chọn cổng thanh toán →', 'create_order', icon='ic_wallet'))

# 13. Payment
screen('payment', 'Chọn cổng thanh toán', 'BƯỚC 02 / THANH TOÁN TRUNG GIAN',
    '<LinearLayout style="@style/Eco.Card" android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="vertical" android:gravity="center" android:padding="20dp">' +
    '<TextView style="@style/Eco.Eyebrow" android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="' + s('payment_total_lbl', 'TỔNG TIỀN CẦN THANH TOÁN') + '" android:layout_gravity="center"/>' +
    '<TextView style="@style/Eco.PriceTag" android:layout_width="wrap_content" android:layout_height="wrap_content" android:id="@+id/payment_total" android:textSize="32sp" android:text="' + s('sample_total', '145.000 ₫') + '" android:layout_gravity="center"/>' +
    '</LinearLayout>' +
    card('payment_safe_note', 'Thanh toán có bảo hộ', 'Demo cổng thanh toán: không trừ tiền thật. Hệ thống xác nhận qua webhook an toàn từ MoMo hoặc VNPay.', icon='ic_shield') +
    '<RadioGroup android:id="@+id/payment_provider" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginBottom="16dp">' +
    '<RadioButton android:id="@+id/provider_momo" android:layout_width="match_parent" android:layout_height="56dp" android:checked="true" android:text="' + s('momo', 'Ví MoMo (Mô phỏng thanh toán)') + '"/>' +
    '<RadioButton android:id="@+id/provider_vnpay" android:layout_width="match_parent" android:layout_height="56dp" android:text="' + s('vnpay', 'Cổng VNPay (Mô phỏng thanh toán)') + '"/>' +
    '</RadioGroup>' +
    button('payment_demo_success', '✓ Mô phỏng Cổng báo Thành công', 'pay:success', icon='ic_verified') +
    button('payment_demo_pending', '⏳ Mô phỏng Cổng báo Đang xử lý', 'pay:pending', secondary=True) +
    button('payment_demo_failure', '✕ Mô phỏng Cổng báo Thất bại / Thử lại', 'pay:failed', secondary=True) +
    button('payment_cancel', 'Hủy đơn chưa thanh toán', 'cancel_order', secondary=True))

# 14. Payment Result
screen('payment_result', 'Kết quả giao dịch', 'BƯỚC 03 / PHẢN HỒI TỪ CỔNG',
    '<LinearLayout style="@style/Eco.Card" android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="vertical" android:gravity="center" android:padding="24dp">' +
    '<ImageView android:layout_width="48dp" android:layout_height="48dp" android:src="@drawable/ic_verified" android:layout_marginBottom="8dp"/>' +
    text('payment_result_status', 'Đang xử lý', 'Title', 'android:id="@+id/payment_result_status" android:gravity="center"') +
    text('payment_result_copy', 'Trong hệ thống thực tế, chỉ chữ ký webhook hợp lệ từ MoMo/VNPay mới cập nhật trạng thái đơn sang đã thanh toán.', 'Body', 'android:gravity="center"') +
    '</LinearLayout>' +
    button('result_order', 'Xem chi tiết đơn hàng', 'screen:order_detail', icon='ic_truck') +
    button('result_retry', 'Quay lại cổng thanh toán', 'retry_payment', secondary=True, icon='ic_wallet'))

# 15. Orders
screen('orders', 'Đơn hàng của bạn', 'QUẢN LÝ ĐƠN MUA & ĐƠN BÁN',
    card('orders_summary_box', 'Đơn hàng gần nhất', '', icon='ic_truck') +
    text('orders_summary', 'Chưa có đơn hàng', 'Body', 'android:id="@+id/orders_summary"') +
    button('orders_detail', 'Mở xem đơn hàng gần nhất', 'open_order', icon='ic_truck') +
    button('orders_selling', 'Danh sách tin bán của tôi', 'screen:my_listings', secondary=True, icon='ic_nav_market') +
    button('orders_market', 'Tiếp tục mua sắm tại Chợ đồ cũ', 'screen:market', secondary=True, icon='ic_search'))

# 16. Order Detail
screen('order_detail', 'Chi tiết đơn hàng', 'THEO DÕI VẬN CHUYỂN & GIAO NHẬN',
    '<LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="horizontal" android:gravity="center_vertical" android:layout_marginBottom="12dp">' +
    '<TextView style="@style/Eco.CardTitle" android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="' + s('order_state_lbl', 'Trạng thái: ') + '" android:layout_marginBottom="0dp"/>' +
    '<TextView style="@style/Eco.Badge" android:layout_width="wrap_content" android:layout_height="wrap_content" android:id="@+id/order_state" android:text="' + s('no_order_lbl', 'Chưa có đơn') + '" android:layout_marginBottom="0dp"/>' +
    '</LinearLayout>' +
    card('order_product', 'Sản phẩm đặt mua', 'Đèn lọ thủy tinh vintage\nSố lượng: 1 bộ · Giá: 120.000 ₫\nPhí ship: 25.000 ₫ · Tổng: 145.000 ₫', icon='ic_nav_market') +
    card('order_shipping_box', 'Thông tin giao nhận', '', icon='ic_map_pin') +
    text('order_delivery', 'Thông tin giao hàng', 'Body', 'android:id="@+id/order_delivery"') +
    section('Thao tác đơn hàng') +
    button('order_payment', 'Tiếp tục thanh toán (nếu chưa trả)', 'retry_payment', icon='ic_wallet') +
    button('order_ship_demo', '🚚 Mô phỏng người bán đang giao hàng', 'ship_order', secondary=True, icon='ic_truck') +
    button('order_complete', '✓ Xác nhận đã nhận hàng (+10 điểm xanh)', 'complete_order', icon='ic_verified') +
    button('order_review', '⭐ Đánh giá giao dịch người bán', 'screen:review', secondary=True, icon='ic_star') +
    button('order_dispute', '⚠️ Khiếu nại / Yêu cầu hỗ trợ', 'screen:dispute', secondary=True) +
    button('order_cancel', 'Hủy đơn chưa thanh toán', 'cancel_order', secondary=True))

# 17. Review
screen('review', 'Đánh giá giao dịch', 'GỬI PHẢN HỒI SAU KHI NHẬN HÀNG',
    card('review_info', 'Đóng góp ý kiến', 'Chỉ các bên trong đơn hàng đã hoàn tất mới được gửi đánh giá, mỗi bên một lần duy nhất.', icon='ic_star') +
    '<LinearLayout style="@style/Eco.Card" android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="vertical" android:gravity="center" android:padding="16dp">' +
    '<TextView style="@style/Eco.CardTitle" android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="' + s('rating_satisfaction', 'Mức độ hài lòng của bạn') + '" android:layout_gravity="center"/>' +
    '<RatingBar android:id="@+id/review_rating" android:layout_width="wrap_content" android:layout_height="wrap_content" android:numStars="5" android:stepSize="1" android:rating="5" android:progressTint="@color/eco_amber" android:layout_marginVertical="8dp"/>' +
    '</LinearLayout>' +
    field('review_content', 'Nhận xét về sản phẩm, đóng gói và thái độ người bán...', 'textMultiLine') +
    button('review_submit', 'Gửi đánh giá cộng đồng', 'submit_review', icon='ic_star'))

# 18. Dispute
screen('dispute', 'Khiếu nại đơn hàng', 'TRỢ GIÚP & BẢO HỘ GIAO DỊCH',
    card('dispute_info_box', 'Quy trình xử lý khiếu nại', 'Mô tả sự cố của đơn đã thanh toán. Ban quản trị web sẽ kiểm tra bằng chứng và xử lý hoàn tiền qua cổng thanh toán.', icon='ic_shield') +
    field('dispute_reason', 'Lý do khiếu nại chi tiết...', 'textMultiLine') +
    button('dispute_evidence', 'Chọn ảnh chụp bằng chứng', 'pick:evidence', secondary=True, icon='ic_camera') +
    button('dispute_submit', 'Gửi khiếu nại đến Quản trị viên', 'submit_dispute', icon='ic_verified'))

# 19. My Listings
screen('my_listings', 'Tin bán của tôi', 'QUẢN LÝ SẢN PHẨM ĐANG BÁN',
    card('my_listing_card', 'Sản phẩm mới nhất', '', icon='ic_nav_market') +
    text('my_listing_state', 'Chưa có tin mới', 'Body', 'android:id="@+id/my_listing_state"') +
    button('my_listing_create', '+ Đăng bán sản phẩm mới', 'screen:create_listing', icon='ic_plus'))

# 20. Messages (Upgraded to Messenger / Instagram style matching Image 5)
messages_xml = f'''<?xml version="1.0" encoding="utf-8"?>
<ScrollView xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:fillViewport="true"
    android:background="@color/eco_background">

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="vertical"
        android:paddingHorizontal="18dp"
        android:paddingTop="16dp"
        android:paddingBottom="24dp">

        <!-- Top Header: Title + Compose Button (Image 5) -->
        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="horizontal"
            android:gravity="center_vertical"
            android:layout_marginBottom="16dp">

            <TextView
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:text="{s('messages_title_main', 'Tin nhắn 💬')}"
                android:textColor="@color/eco_green_dark"
                android:textSize="26sp"
                android:textStyle="bold"
                android:fontFamily="serif" />

            <LinearLayout
                android:layout_width="40dp"
                android:layout_height="40dp"
                android:gravity="center"
                android:background="@drawable/bg_badge_verified"
                android:backgroundTint="#151B6B4C"
                android:tag="screen:chat">

                <ImageView
                    android:layout_width="22dp"
                    android:layout_height="22dp"
                    android:src="@drawable/ic_compose"
                    app:tint="@color/eco_green"
                    android:contentDescription="{s('compose_action_desc', 'Soạn tin nhắn mới')}" />
            </LinearLayout>
        </LinearLayout>

        <!-- Search Input Bar (Image 5) -->
        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="horizontal"
            android:gravity="center_vertical"
            android:background="@drawable/bg_search_input"
            android:paddingHorizontal="14dp"
            android:paddingVertical="10dp"
            android:layout_marginBottom="18dp">

            <ImageView
                android:layout_width="18dp"
                android:layout_height="18dp"
                android:src="@drawable/ic_search"
                app:tint="#64748B"
                android:layout_marginEnd="10dp"
                android:contentDescription="{s('search_msg_icon_desc', 'Tìm kiếm')}" />

            <TextView
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:text="{s('search_messages_hint', 'Tìm kiếm tin nhắn...')}"
                android:textColor="#64748B"
                android:textSize="14sp" />
        </LinearLayout>

        <!-- Section: ĐANG HOẠT ĐỘNG (Image 5) -->
        <TextView
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="{s('active_now_header', 'ĐANG HOẠT ĐỘNG')}"
            android:textColor="#64748B"
            android:textSize="12sp"
            android:textStyle="bold"
            android:letterSpacing="0.04"
            android:layout_marginBottom="12dp" />

        <!-- Horizontal Active Story / Online Avatars -->
        <HorizontalScrollView
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:scrollbars="none"
            android:layout_marginBottom="20dp">

            <LinearLayout
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:orientation="horizontal">

                <!-- User: Hoa -->
                <LinearLayout
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:orientation="vertical"
                    android:gravity="center_horizontal"
                    android:layout_marginEnd="16dp"
                    android:tag="screen:chat">

                    <FrameLayout
                        android:layout_width="54dp"
                        android:layout_height="54dp">

                        <ImageView
                            android:layout_width="54dp"
                            android:layout_height="54dp"
                            android:src="@drawable/ic_avatar_hoa"
                            android:contentDescription="{s('avatar_hoa_desc', 'Hoa')}" />

                        <View
                            android:layout_width="14dp"
                            android:layout_height="14dp"
                            android:layout_gravity="bottom|end"
                            android:background="@drawable/bg_online_dot" />
                    </FrameLayout>

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('name_hoa_short', 'Hoa')}"
                        android:textColor="@color/eco_text"
                        android:textSize="12sp"
                        android:layout_marginTop="5dp" />
                </LinearLayout>

                <!-- User: Anh -->
                <LinearLayout
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:orientation="vertical"
                    android:gravity="center_horizontal"
                    android:layout_marginEnd="16dp"
                    android:tag="screen:chat">

                    <FrameLayout
                        android:layout_width="54dp"
                        android:layout_height="54dp">

                        <ImageView
                            android:layout_width="54dp"
                            android:layout_height="54dp"
                            android:src="@drawable/ic_avatar_anh"
                            android:contentDescription="{s('avatar_anh_desc', 'Anh')}" />

                        <View
                            android:layout_width="14dp"
                            android:layout_height="14dp"
                            android:layout_gravity="bottom|end"
                            android:background="@drawable/bg_online_dot" />
                    </FrameLayout>

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('name_anh_short', 'Anh')}"
                        android:textColor="@color/eco_text"
                        android:textSize="12sp"
                        android:layout_marginTop="5dp" />
                </LinearLayout>

                <!-- User: Minh -->
                <LinearLayout
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:orientation="vertical"
                    android:gravity="center_horizontal"
                    android:layout_marginEnd="16dp"
                    android:tag="screen:chat">

                    <FrameLayout
                        android:layout_width="54dp"
                        android:layout_height="54dp">

                        <ImageView
                            android:layout_width="54dp"
                            android:layout_height="54dp"
                            android:src="@drawable/ic_avatar_minh"
                            android:contentDescription="{s('avatar_minh_desc', 'Minh')}" />

                        <View
                            android:layout_width="14dp"
                            android:layout_height="14dp"
                            android:layout_gravity="bottom|end"
                            android:background="@drawable/bg_online_dot" />
                    </FrameLayout>

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('name_minh_short', 'Minh')}"
                        android:textColor="@color/eco_text"
                        android:textSize="12sp"
                        android:layout_marginTop="5dp" />
                </LinearLayout>

                <!-- User: Hùng -->
                <LinearLayout
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:orientation="vertical"
                    android:gravity="center_horizontal"
                    android:layout_marginEnd="16dp"
                    android:tag="screen:chat">

                    <FrameLayout
                        android:layout_width="54dp"
                        android:layout_height="54dp">

                        <ImageView
                            android:layout_width="54dp"
                            android:layout_height="54dp"
                            android:src="@drawable/ic_avatar_hung"
                            android:contentDescription="{s('avatar_hung_desc', 'Hùng')}" />

                        <View
                            android:layout_width="14dp"
                            android:layout_height="14dp"
                            android:layout_gravity="bottom|end"
                            android:background="@drawable/bg_online_dot" />
                    </FrameLayout>

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('name_hung_short', 'Hùng')}"
                        android:textColor="@color/eco_text"
                        android:textSize="12sp"
                        android:layout_marginTop="5dp" />
                </LinearLayout>

            </LinearLayout>
        </HorizontalScrollView>

        <!-- Conversation Items in Pale Mint Card Container (Image 5) -->
        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="vertical"
            android:background="@drawable/bg_card_mint"
            android:paddingHorizontal="14dp"
            android:paddingVertical="8dp">

            <!-- Conversation 1: Lê Thị Hoa (Image 5) -->
            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:orientation="horizontal"
                android:gravity="center_vertical"
                android:paddingVertical="12dp"
                android:tag="screen:chat">

                <FrameLayout
                    android:layout_width="50dp"
                    android:layout_height="50dp">

                    <ImageView
                        android:layout_width="50dp"
                        android:layout_height="50dp"
                        android:src="@drawable/ic_avatar_hoa"
                        android:contentDescription="{s('chat_hoa_avatar_desc', 'Lê Thị Hoa')}" />

                    <View
                        android:layout_width="12dp"
                        android:layout_height="12dp"
                        android:layout_gravity="bottom|end"
                        android:background="@drawable/bg_online_dot" />
                </FrameLayout>

                <LinearLayout
                    android:layout_width="0dp"
                    android:layout_height="wrap_content"
                    android:layout_weight="1"
                    android:orientation="vertical"
                    android:layout_marginStart="12dp"
                    android:layout_marginEnd="8dp">

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('chat_hoa_fullname', 'Lê Thị Hoa')}"
                        android:textColor="@color/eco_text"
                        android:textSize="15sp"
                        android:textStyle="bold"
                        android:layout_marginBottom="3dp" />

                    <TextView
                        android:layout_width="match_parent"
                        android:layout_height="wrap_content"
                        android:text="{s('chat_hoa_msg_prev', 'Mình mới đăng video hướng dẫn làm đèn thủy tin...')}"
                        android:textColor="#4B5563"
                        android:textSize="13sp"
                        android:maxLines="1"
                        android:ellipsize="end" />
                </LinearLayout>

                <LinearLayout
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:orientation="vertical"
                    android:gravity="end">

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('chat_hoa_time', '5 phút trước')}"
                        android:textColor="#64748B"
                        android:textSize="11sp"
                        android:layout_marginBottom="6dp" />

                    <TextView
                        android:layout_width="20dp"
                        android:layout_height="20dp"
                        android:background="@drawable/bg_badge_unread"
                        android:text="{s('chat_hoa_unread', '2')}"
                        android:textColor="@color/white"
                        android:textSize="11sp"
                        android:textStyle="bold"
                        android:gravity="center" />
                </LinearLayout>
            </LinearLayout>

            <View
                android:layout_width="match_parent"
                android:layout_height="1dp"
                android:background="#D1FAE5" />

            <!-- Conversation 2: Trần Văn Minh (Image 5) -->
            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:orientation="horizontal"
                android:gravity="center_vertical"
                android:paddingVertical="12dp"
                android:tag="screen:chat">

                <FrameLayout
                    android:layout_width="50dp"
                    android:layout_height="50dp">

                    <ImageView
                        android:layout_width="50dp"
                        android:layout_height="50dp"
                        android:src="@drawable/ic_avatar_minh"
                        android:contentDescription="{s('chat_minh_avatar_desc', 'Trần Văn Minh')}" />

                    <View
                        android:layout_width="12dp"
                        android:layout_height="12dp"
                        android:layout_gravity="bottom|end"
                        android:background="@drawable/bg_online_dot" />
                </FrameLayout>

                <LinearLayout
                    android:layout_width="0dp"
                    android:layout_height="wrap_content"
                    android:layout_weight="1"
                    android:orientation="vertical"
                    android:layout_marginStart="12dp"
                    android:layout_marginEnd="8dp">

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('chat_minh_fullname', 'Trần Văn Minh')}"
                        android:textColor="@color/eco_text"
                        android:textSize="15sp"
                        android:textStyle="bold"
                        android:layout_marginBottom="3dp" />

                    <TextView
                        android:layout_width="match_parent"
                        android:layout_height="wrap_content"
                        android:text="{s('chat_minh_msg_prev', 'Nhiều chỗ sửa xe sẵn sàng cho lốp cũ lắm! Chúc bạn thà...')}"
                        android:textColor="#4B5563"
                        android:textSize="13sp"
                        android:maxLines="1"
                        android:ellipsize="end" />
                </LinearLayout>

                <LinearLayout
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:orientation="vertical"
                    android:gravity="end">

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('chat_minh_time', '2 giờ trước')}"
                        android:textColor="#64748B"
                        android:textSize="11sp" />
                </LinearLayout>
            </LinearLayout>

            <View
                android:layout_width="match_parent"
                android:layout_height="1dp"
                android:background="#D1FAE5" />

            <!-- Conversation 3: Phạm Quốc Anh (Image 5) -->
            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:orientation="horizontal"
                android:gravity="center_vertical"
                android:paddingVertical="12dp"
                android:tag="screen:chat">

                <FrameLayout
                    android:layout_width="50dp"
                    android:layout_height="50dp">

                    <ImageView
                        android:layout_width="50dp"
                        android:layout_height="50dp"
                        android:src="@drawable/ic_avatar_anh"
                        android:contentDescription="{s('chat_anh_avatar_desc', 'Phạm Quốc Anh')}" />

                    <View
                        android:layout_width="12dp"
                        android:layout_height="12dp"
                        android:layout_gravity="bottom|end"
                        android:background="@drawable/bg_online_dot" />
                </FrameLayout>

                <LinearLayout
                    android:layout_width="0dp"
                    android:layout_height="wrap_content"
                    android:layout_weight="1"
                    android:orientation="vertical"
                    android:layout_marginStart="12dp"
                    android:layout_marginEnd="8dp">

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('chat_anh_fullname', 'Phạm Quốc Anh')}"
                        android:textColor="@color/eco_text"
                        android:textSize="15sp"
                        android:textStyle="bold"
                        android:layout_marginBottom="3dp" />

                    <TextView
                        android:layout_width="match_parent"
                        android:layout_height="wrap_content"
                        android:text="{s('chat_anh_msg_prev', 'Bạn có thể share bài vẽ dự án không? Cần nhiều n...')}"
                        android:textColor="#4B5563"
                        android:textSize="13sp"
                        android:maxLines="1"
                        android:ellipsize="end" />
                </LinearLayout>

                <LinearLayout
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:orientation="vertical"
                    android:gravity="end">

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('chat_anh_time', '1 ngày trước')}"
                        android:textColor="#64748B"
                        android:textSize="11sp"
                        android:layout_marginBottom="6dp" />

                    <TextView
                        android:layout_width="20dp"
                        android:layout_height="20dp"
                        android:background="@drawable/bg_badge_unread"
                        android:text="{s('chat_anh_unread', '1')}"
                        android:textColor="@color/white"
                        android:textSize="11sp"
                        android:textStyle="bold"
                        android:gravity="center" />
                </LinearLayout>
            </LinearLayout>

            <View
                android:layout_width="match_parent"
                android:layout_height="1dp"
                android:background="#D1FAE5" />

            <!-- Conversation 4: Nguyễn Văn Hùng (Image 5) -->
            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:orientation="horizontal"
                android:gravity="center_vertical"
                android:paddingVertical="12dp"
                android:tag="screen:chat">

                <FrameLayout
                    android:layout_width="50dp"
                    android:layout_height="50dp">

                    <ImageView
                        android:layout_width="50dp"
                        android:layout_height="50dp"
                        android:src="@drawable/ic_avatar_hung"
                        android:contentDescription="{s('chat_hung_avatar_desc', 'Nguyễn Văn Hùng')}" />

                    <View
                        android:layout_width="12dp"
                        android:layout_height="12dp"
                        android:layout_gravity="bottom|end"
                        android:background="@drawable/bg_online_dot" />
                </FrameLayout>

                <LinearLayout
                    android:layout_width="0dp"
                    android:layout_height="wrap_content"
                    android:layout_weight="1"
                    android:orientation="vertical"
                    android:layout_marginStart="12dp"
                    android:layout_marginEnd="8dp">

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('chat_hung_fullname', 'Nguyễn Văn Hùng')}"
                        android:textColor="@color/eco_text"
                        android:textSize="15sp"
                        android:textStyle="bold"
                        android:layout_marginBottom="3dp" />

                    <TextView
                        android:layout_width="match_parent"
                        android:layout_height="wrap_content"
                        android:text="{s('chat_hung_msg_prev', 'Cuối tuần này mình rảnh! Sáng thứ 7 nhé 📷')}"
                        android:textColor="#4B5563"
                        android:textSize="13sp"
                        android:maxLines="1"
                        android:ellipsize="end" />
                </LinearLayout>

                <LinearLayout
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:orientation="vertical"
                    android:gravity="end">

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('chat_hung_time', '3 ngày trước')}"
                        android:textColor="#64748B"
                        android:textSize="11sp" />
                </LinearLayout>
            </LinearLayout>

        </LinearLayout>

    </LinearLayout>
</ScrollView>
'''
screen('messages', 'Tin nhắn cộng đồng', 'KẾT NỐI & TRAO ĐỔI SỐNG XANH', '', custom_xml=messages_xml)

# 21. Chat (Upgraded to match user Image 1)
chat_xml = f'''<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:background="#F4FBF7">

    <!-- Top Chat Header Bar (Image 1) -->
    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="60dp"
        android:orientation="horizontal"
        android:gravity="center_vertical"
        android:paddingHorizontal="14dp"
        android:background="@color/white"
        android:elevation="2dp">

        <!-- Back Button in rounded light green box -->
        <FrameLayout
            android:layout_width="38dp"
            android:layout_height="38dp"
            android:background="@drawable/bg_chat_action"
            android:tag="screen:messages">

            <ImageView
                android:layout_width="18dp"
                android:layout_height="18dp"
                android:layout_gravity="center"
                android:src="@drawable/ic_arrow_back"
                app:tint="@color/eco_green"
                android:contentDescription="{s('chat_back_desc', 'Quay lại')}" />
        </FrameLayout>

        <!-- Avatar with Online Dot -->
        <FrameLayout
            android:layout_width="40dp"
            android:layout_height="40dp"
            android:layout_marginStart="12dp">

            <ImageView
                android:layout_width="40dp"
                android:layout_height="40dp"
                android:src="@drawable/ic_avatar_hoa"
                android:contentDescription="{s('chat_header_hoa_desc', 'Lê Thị Hoa')}" />

            <View
                android:layout_width="11dp"
                android:layout_height="11dp"
                android:layout_gravity="bottom|end"
                android:background="@drawable/bg_online_dot" />
        </FrameLayout>

        <!-- Name & Active Status -->
        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:orientation="vertical"
            android:layout_marginStart="10dp">

            <TextView
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="{s('chat_hoa_name', 'Lê Thị Hoa')}"
                android:textColor="@color/eco_ink"
                android:textSize="15.5sp"
                android:textStyle="bold" />

            <TextView
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="{s('chat_hoa_status', '• Đang hoạt động')}"
                android:textColor="#16A34A"
                android:textSize="11.5sp"
                android:textStyle="bold" />
        </LinearLayout>

        <!-- Call Button in rounded light green box -->
        <FrameLayout
            android:layout_width="38dp"
            android:layout_height="38dp"
            android:background="@drawable/bg_chat_action">

            <ImageView
                android:layout_width="18dp"
                android:layout_height="18dp"
                android:layout_gravity="center"
                android:src="@drawable/ic_phone"
                android:contentDescription="{s('chat_call_desc', 'Gọi điện')}" />
        </FrameLayout>
    </LinearLayout>

    <!-- Message Bubbles ScrollView (Image 1) -->
    <ScrollView
        android:layout_width="match_parent"
        android:layout_height="0dp"
        android:layout_weight="1"
        android:fillViewport="true">

        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="vertical"
            android:paddingHorizontal="14dp"
            android:paddingVertical="14dp">

            <!-- Bubble 1: Hoa (Incoming) -->
            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:orientation="horizontal"
                android:gravity="bottom"
                android:layout_marginBottom="2dp">

                <ImageView
                    android:layout_width="28dp"
                    android:layout_height="28dp"
                    android:src="@drawable/ic_avatar_hoa"
                    android:layout_marginEnd="8dp"
                    android:contentDescription="{s('author_hoa', 'Lê Thị Hoa')}" />

                <LinearLayout
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:background="@drawable/bg_bubble_incoming"
                    android:elevation="1dp"
                    android:paddingHorizontal="14dp"
                    android:paddingVertical="10dp"
                    android:maxWidth="260dp">

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('chat_bubble_1', 'Lan ơi, cái chắn gió nút chai của bạn đẹp quá! Chỉ mình làm với 🙏')}"
                        android:textColor="#1E293B"
                        android:textSize="13.5sp"
                        android:lineSpacingExtra="2dp" />
                </LinearLayout>
            </LinearLayout>

            <!-- Time 10:30 -->
            <TextView
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="{s('chat_time_1', '10:30')}"
                android:textColor="#94A3B8"
                android:textSize="10.5sp"
                android:layout_marginStart="36dp"
                android:layout_marginBottom="12dp" />

            <!-- Bubble 2: Lan (Outgoing - Green) -->
            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:gravity="end"
                android:layout_marginBottom="2dp">

                <LinearLayout
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:background="@drawable/bg_bubble_outgoing"
                    android:paddingHorizontal="14dp"
                    android:paddingVertical="10dp"
                    android:maxWidth="260dp">

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('chat_bubble_2', 'Hihi cảm ơn Hoa nhé! Thực ra rất dễ làm đó. Để mình chụp từng bước gửi cho')}"
                        android:textColor="@color/white"
                        android:textSize="13.5sp"
                        android:lineSpacingExtra="2dp" />
                </LinearLayout>
            </LinearLayout>

            <!-- Time 10:32 -->
            <TextView
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_gravity="end"
                android:text="{s('chat_time_2', '10:32')}"
                android:textColor="#94A3B8"
                android:textSize="10.5sp"
                android:layout_marginBottom="12dp" />

            <!-- Bubble 3: Hoa (Incoming) -->
            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:orientation="horizontal"
                android:gravity="bottom"
                android:layout_marginBottom="2dp">

                <ImageView
                    android:layout_width="28dp"
                    android:layout_height="28dp"
                    android:src="@drawable/ic_avatar_hoa"
                    android:layout_marginEnd="8dp"
                    android:contentDescription="{s('author_hoa', 'Lê Thị Hoa')}" />

                <LinearLayout
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:background="@drawable/bg_bubble_incoming"
                    android:elevation="1dp"
                    android:paddingHorizontal="14dp"
                    android:paddingVertical="10dp"
                    android:maxWidth="260dp">

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('chat_bubble_3', 'Ưa quá! Mình cũng muốn học làm đèn lọ thủy tinh. Cuối tuần bạn rảnh không?')}"
                        android:textColor="#1E293B"
                        android:textSize="13.5sp"
                        android:lineSpacingExtra="2dp" />
                </LinearLayout>
            </LinearLayout>

            <!-- Time 10:45 -->
            <TextView
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="{s('chat_time_3', '10:45')}"
                android:textColor="#94A3B8"
                android:textSize="10.5sp"
                android:layout_marginStart="36dp"
                android:layout_marginBottom="12dp" />

            <!-- Bubble 4: Lan (Outgoing - Green) -->
            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:gravity="end"
                android:layout_marginBottom="2dp">

                <LinearLayout
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:background="@drawable/bg_bubble_outgoing"
                    android:paddingHorizontal="14dp"
                    android:paddingVertical="10dp"
                    android:maxWidth="260dp">

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('chat_bubble_4', 'Cuối tuần này bận rồi 😅 Tuần sau nhé!')}"
                        android:textColor="@color/white"
                        android:textSize="13.5sp"
                        android:lineSpacingExtra="2dp" />
                </LinearLayout>
            </LinearLayout>

            <!-- Time 10:47 -->
            <TextView
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_gravity="end"
                android:text="{s('chat_time_4', '10:47')}"
                android:textColor="#94A3B8"
                android:textSize="10.5sp"
                android:layout_marginBottom="12dp" />

            <!-- Bubble 5: Hoa (Incoming) -->
            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:orientation="horizontal"
                android:gravity="bottom"
                android:layout_marginBottom="2dp">

                <View
                    android:layout_width="28dp"
                    android:layout_height="28dp"
                    android:layout_marginEnd="8dp" />

                <LinearLayout
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:background="@drawable/bg_bubble_incoming"
                    android:elevation="1dp"
                    android:paddingHorizontal="14dp"
                    android:paddingVertical="10dp"
                    android:maxWidth="260dp">

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('chat_bubble_5', 'Oke bạn ơi! Nhớ nhé đừng có quên 💚')}"
                        android:textColor="#1E293B"
                        android:textSize="13.5sp"
                        android:lineSpacingExtra="2dp" />
                </LinearLayout>
            </LinearLayout>

            <!-- Time 11:00 -->
            <TextView
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="{s('chat_time_5', '11:00')}"
                android:textColor="#94A3B8"
                android:textSize="10.5sp"
                android:layout_marginStart="36dp"
                android:layout_marginBottom="12dp" />

            <!-- Bubble 6: Hoa (Incoming) -->
            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:orientation="horizontal"
                android:gravity="bottom"
                android:layout_marginBottom="2dp">

                <ImageView
                    android:layout_width="28dp"
                    android:layout_height="28dp"
                    android:src="@drawable/ic_avatar_hoa"
                    android:layout_marginEnd="8dp"
                    android:contentDescription="{s('author_hoa', 'Lê Thị Hoa')}" />

                <LinearLayout
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:background="@drawable/bg_bubble_incoming"
                    android:elevation="1dp"
                    android:paddingHorizontal="14dp"
                    android:paddingVertical="10dp"
                    android:maxWidth="260dp">

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('chat_bubble_6', 'Mình mới đăng video hướng dẫn làm đèn thủy tinh rồi, bạn xem thử nha!')}"
                        android:textColor="#1E293B"
                        android:textSize="13.5sp"
                        android:lineSpacingExtra="2dp" />
                </LinearLayout>
            </LinearLayout>

            <!-- Time 14:20 -->
            <TextView
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="{s('chat_time_6', '14:20')}"
                android:textColor="#94A3B8"
                android:textSize="10.5sp"
                android:layout_marginStart="36dp"
                android:layout_marginBottom="12dp" />

            <!-- Live sent dynamic messages -->
            <TextView
                android:id="@+id/chat_history"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:textColor="#065F46"
                android:textSize="12sp"
                android:visibility="gone" />

        </LinearLayout>
    </ScrollView>

    <!-- Quick Reply Suggestion Chips (Image 1) -->
    <HorizontalScrollView
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:scrollbars="none"
        android:paddingHorizontal="12dp"
        android:paddingVertical="6dp"
        android:background="#F4FBF7">

        <LinearLayout
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:orientation="horizontal">

            <TextView
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:background="@drawable/bg_chat_chip"
                android:paddingHorizontal="14dp"
                android:paddingVertical="7dp"
                android:text="{s('chat_chip_1', '👍 Hay quá!')}"
                android:textColor="#15803D"
                android:textSize="12sp"
                android:textStyle="bold"
                android:layout_marginEnd="8dp" />

            <TextView
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:background="@drawable/bg_chat_chip"
                android:paddingHorizontal="14dp"
                android:paddingVertical="7dp"
                android:text="{s('chat_chip_2', '♻️ Mình cũng thích!')}"
                android:textColor="#15803D"
                android:textSize="12sp"
                android:textStyle="bold"
                android:layout_marginEnd="8dp" />

            <TextView
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:background="@drawable/bg_chat_chip"
                android:paddingHorizontal="14dp"
                android:paddingVertical="7dp"
                android:text="{s('chat_chip_3', '🌿 Cảm ơn bạn!')}"
                android:textColor="#15803D"
                android:textSize="12sp"
                android:textStyle="bold"
                android:layout_marginEnd="8dp" />
        </LinearLayout>
    </HorizontalScrollView>

    <!-- Bottom Input Bar (Image 1) -->
    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="horizontal"
        android:gravity="center_vertical"
        android:background="@color/white"
        android:paddingHorizontal="12dp"
        android:paddingVertical="8dp"
        android:elevation="8dp">

        <!-- Attachment Button -->
        <FrameLayout
            android:layout_width="40dp"
            android:layout_height="40dp"
            android:background="@drawable/bg_chat_action"
            android:tag="pick:chat">

            <ImageView
                android:layout_width="20dp"
                android:layout_height="20dp"
                android:layout_gravity="center"
                android:src="@drawable/ic_clip"
                android:contentDescription="{s('chat_attach_desc', 'Đính kèm')}" />
        </FrameLayout>

        <!-- Message Input Field with leaf icon inside -->
        <FrameLayout
            android:layout_width="0dp"
            android:layout_height="42dp"
            android:layout_weight="1"
            android:layout_marginHorizontal="8dp"
            android:background="@drawable/bg_chat_input">

            <EditText
                android:id="@+id/chat_message"
                android:layout_width="match_parent"
                android:layout_height="match_parent"
                android:background="@android:color/transparent"
                android:hint="{s('chat_input_hint', 'hello')}"
                android:textColor="#1E293B"
                android:textColorHint="#94A3B8"
                android:textSize="13.5sp"
                android:paddingStart="14dp"
                android:paddingEnd="36dp"
                android:inputType="text" />

            <ImageView
                android:layout_width="18dp"
                android:layout_height="18dp"
                android:layout_gravity="end|center_vertical"
                android:layout_marginEnd="12dp"
                android:src="@drawable/ic_eco_leaf"
                app:tint="#16A34A"
                android:contentDescription="{s('leaf_eco_desc', 'Eco')}" />
        </FrameLayout>

        <!-- Send Button -->
        <FrameLayout
            android:id="@+id/chat_send"
            android:layout_width="42dp"
            android:layout_height="42dp"
            android:background="@drawable/bg_circle_avatar"
            android:backgroundTint="#2E7D52"
            android:tag="send_message">

            <ImageView
                android:layout_width="18dp"
                android:layout_height="18dp"
                android:layout_gravity="center"
                android:src="@drawable/ic_send"
                android:contentDescription="{s('chat_send_desc', 'Gửi')}" />
        </FrameLayout>
    </LinearLayout>
</LinearLayout>
'''
screen('chat', 'Lê Thị Hoa', 'TIN NHẮN / TRÒ CHUYỆN SỐNG XANH', '', custom_xml=chat_xml)

# 22. Profile (Upgraded to match user Image 2)
profile_xml = f'''<?xml version="1.0" encoding="utf-8"?>
<ScrollView xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:fillViewport="true"
    android:background="#F4FBF7">

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="vertical"
        android:paddingBottom="24dp">

        <!-- Cover Photo with Action Buttons (Image 2) -->
        <FrameLayout
            android:layout_width="match_parent"
            android:layout_height="190dp">

            <ImageView
                android:layout_width="match_parent"
                android:layout_height="match_parent"
                android:src="@drawable/bg_cover_garden"
                android:scaleType="centerCrop"
                android:contentDescription="{s('cover_garden_desc', 'Ảnh bìa vườn tái chế')}" />

            <!-- Action buttons overlay on top right of cover -->
            <LinearLayout
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_gravity="top|end"
                android:layout_margin="14dp"
                android:orientation="horizontal"
                android:gravity="center_vertical">

                <!-- Chỉnh sửa Button (frosted pill) -->
                <LinearLayout
                    android:layout_width="wrap_content"
                    android:layout_height="32dp"
                    android:orientation="horizontal"
                    android:gravity="center_vertical"
                    android:background="@drawable/bg_frosted_pill"
                    android:paddingHorizontal="12dp"
                    android:layout_marginEnd="8dp"
                    android:tag="screen:edit_profile">

                    <ImageView
                        android:layout_width="14dp"
                        android:layout_height="14dp"
                        android:src="@drawable/ic_edit"
                        android:layout_marginEnd="5dp"
                        android:contentDescription="{s('edit_profile_icon_desc', 'Chỉnh sửa')}" />

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('profile_btn_edit', 'Chỉnh sửa')}"
                        android:textColor="#1E293B"
                        android:textSize="12sp"
                        android:textStyle="bold" />
                </LinearLayout>

                <!-- More Options Button (frosted circle) -->
                <FrameLayout
                    android:layout_width="32dp"
                    android:layout_height="32dp"
                    android:background="@drawable/bg_frosted_circle"
                    android:tag="screen:settings">

                    <ImageView
                        android:layout_width="16dp"
                        android:layout_height="16dp"
                        android:layout_gravity="center"
                        android:src="@drawable/ic_more_vert"
                        app:tint="#1E293B"
                        android:contentDescription="{s('more_profile_opts', 'Cài đặt')}" />
                </FrameLayout>
            </LinearLayout>
        </FrameLayout>

        <!-- Main Profile Overlapping White Card (Image 2) -->
        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="vertical"
            android:background="@drawable/bg_card"
            android:elevation="4dp"
            android:layout_marginHorizontal="14dp"
            android:layout_marginTop="-24dp"
            android:paddingHorizontal="16dp"
            android:paddingTop="18dp"
            android:paddingBottom="18dp">

            <!-- Avatar & Name Header -->
            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:orientation="horizontal"
                android:gravity="center_vertical"
                android:layout_marginBottom="12dp">

                <!-- Squircle Avatar with Online Dot -->
                <FrameLayout
                    android:layout_width="72dp"
                    android:layout_height="72dp"
                    android:background="@drawable/bg_avatar_squircle"
                    android:elevation="2dp">

                    <ImageView
                        android:layout_width="72dp"
                        android:layout_height="72dp"
                        android:src="@drawable/ic_avatar_lan"
                        android:contentDescription="{s('author_lan_desc', 'Nguyễn Thị Lan')}" />

                    <View
                        android:layout_width="14dp"
                        android:layout_height="14dp"
                        android:layout_gravity="bottom|end"
                        android:background="@drawable/bg_online_dot" />
                </FrameLayout>

                <LinearLayout
                    android:layout_width="0dp"
                    android:layout_height="wrap_content"
                    android:layout_weight="1"
                    android:orientation="vertical"
                    android:layout_marginStart="14dp">

                    <TextView
                        android:id="@+id/profile_heading"
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('profile_fullname', 'Nguyễn Thị Lan')}"
                        android:textColor="#111827"
                        android:textSize="19sp"
                        android:textStyle="bold" />

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('profile_handle', '@lan_recycles')}"
                        android:textColor="#94A3B8"
                        android:textSize="12.5sp"
                        android:layout_marginTop="1dp"
                        android:layout_marginBottom="5dp" />

                    <!-- Eco Star Pill Badge -->
                    <LinearLayout
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:orientation="horizontal"
                        android:gravity="center_vertical"
                        android:background="@drawable/bg_star_badge"
                        android:paddingHorizontal="9dp"
                        android:paddingVertical="3dp">

                        <TextView
                            android:layout_width="wrap_content"
                            android:layout_height="wrap_content"
                            android:text="{s('eco_star_label', '🌟 Eco Star')}"
                            android:textColor="#B45309"
                            android:textSize="11sp"
                            android:textStyle="bold" />
                    </LinearLayout>
                </LinearLayout>
            </LinearLayout>

            <!-- Bio Lines -->
            <TextView
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:text="{s('profile_bio_l1', 'Yêu môi trường xanh 🌿 | DIY Queen | Hà Nội')}"
                android:textColor="#374151"
                android:textSize="13sp"
                android:layout_marginBottom="3dp" />

            <TextView
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:text="{s('profile_bio_l2', 'Đã tái chế được 89kg đồ dùng ♻️')}"
                android:textColor="#111827"
                android:textSize="13sp"
                android:textStyle="bold"
                android:layout_marginBottom="10dp" />

            <!-- Location & Join Date Row -->
            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:orientation="horizontal"
                android:gravity="center_vertical"
                android:layout_marginBottom="16dp">

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="{s('profile_city_str', '📍 Hà Nội, Việt Nam')}"
                    android:textColor="#64748B"
                    android:textSize="12sp"
                    android:layout_marginEnd="14dp" />

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="{s('profile_joined_str', '📅 Tháng 3, 2022')}"
                    android:textColor="#64748B"
                    android:textSize="12sp" />
            </LinearLayout>

            <!-- 4-Column Stats (Image 2) -->
            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:orientation="horizontal"
                android:baselineAligned="false"
                android:layout_marginBottom="16dp">

                <!-- 47 Bài đăng -->
                <LinearLayout
                    android:layout_width="0dp"
                    android:layout_height="wrap_content"
                    android:layout_weight="1"
                    android:orientation="vertical"
                    android:gravity="center">

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('stat_posts_num', '47')}"
                        android:textColor="#111827"
                        android:textSize="18sp"
                        android:textStyle="bold" />

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('stat_posts_lbl', 'Bài đăng')}"
                        android:textColor="#64748B"
                        android:textSize="11sp"
                        android:layout_marginTop="1dp" />
                </LinearLayout>

                <!-- 234 Bạn bè -->
                <LinearLayout
                    android:layout_width="0dp"
                    android:layout_height="wrap_content"
                    android:layout_weight="1"
                    android:orientation="vertical"
                    android:gravity="center"
                    android:tag="screen:friends">

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('stat_friends_num', '234')}"
                        android:textColor="#111827"
                        android:textSize="18sp"
                        android:textStyle="bold" />

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('stat_friends_lbl', 'Bạn bè')}"
                        android:textColor="#64748B"
                        android:textSize="11sp"
                        android:layout_marginTop="1dp" />
                </LinearLayout>

                <!-- 89kg Tái chế -->
                <LinearLayout
                    android:layout_width="0dp"
                    android:layout_height="wrap_content"
                    android:layout_weight="1"
                    android:orientation="vertical"
                    android:gravity="center">

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('stat_recycled_num', '89kg')}"
                        android:textColor="#111827"
                        android:textSize="18sp"
                        android:textStyle="bold" />

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('stat_recycled_lbl', 'Tái chế')}"
                        android:textColor="#64748B"
                        android:textSize="11sp"
                        android:layout_marginTop="1dp" />
                </LinearLayout>

                <!-- 1,240 Điểm Eco -->
                <LinearLayout
                    android:layout_width="0dp"
                    android:layout_height="wrap_content"
                    android:layout_weight="1"
                    android:orientation="vertical"
                    android:gravity="center"
                    android:tag="screen:my_impact">

                    <TextView
                        android:id="@+id/impact_points"
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('stat_points_num', '1,240')}"
                        android:textColor="#15803D"
                        android:textSize="18sp"
                        android:textStyle="bold" />

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('stat_points_lbl', 'Điểm Eco')}"
                        android:textColor="#64748B"
                        android:textSize="11sp"
                        android:layout_marginTop="1dp" />
                </LinearLayout>
            </LinearLayout>

            <!-- Eco Level Card with Progress Bar (Image 2) -->
            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:orientation="vertical"
                android:background="@drawable/bg_card_mint"
                android:paddingHorizontal="14dp"
                android:paddingVertical="12dp"
                android:layout_marginBottom="14dp"
                android:tag="screen:my_impact">

                <!-- Top row: Cấp độ Eco & Points -->
                <LinearLayout
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:orientation="horizontal"
                    android:gravity="center_vertical"
                    android:layout_marginBottom="6dp">

                    <TextView
                        android:layout_width="0dp"
                        android:layout_height="wrap_content"
                        android:layout_weight="1"
                        android:text="{s('eco_lvl_title', '🌿 Cấp độ Eco')}"
                        android:textColor="#15803D"
                        android:textSize="13sp"
                        android:textStyle="bold" />

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('eco_lvl_score', '1240/2000 điểm')}"
                        android:textColor="#64748B"
                        android:textSize="11.5sp" />
                </LinearLayout>

                <!-- Progress Bar -->
                <ProgressBar
                    style="?android:attr/progressBarStyleHorizontal"
                    android:layout_width="match_parent"
                    android:layout_height="8dp"
                    android:max="2000"
                    android:progress="1240"
                    android:progressTint="#16A34A"
                    android:progressBackgroundTint="#DCFCE7"
                    android:layout_marginBottom="8dp" />

                <!-- Bottom row: Eco Warrior & Huy hiệu -->
                <LinearLayout
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:orientation="horizontal"
                    android:gravity="center_vertical">

                    <TextView
                        android:layout_width="0dp"
                        android:layout_height="wrap_content"
                        android:layout_weight="1"
                        android:text="{s('eco_warrior_title', '🌿 Eco Warrior')}"
                        android:textColor="#15803D"
                        android:textSize="12sp"
                        android:textStyle="bold" />

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('eco_badges_link', 'Huy hiệu →')}"
                        android:textColor="#15803D"
                        android:textSize="12sp"
                        android:textStyle="bold"
                        android:tag="screen:badges" />
                </LinearLayout>
            </LinearLayout>

            <!-- 2 Action Buttons Row: Tác động / Cài đặt (Image 2) -->
            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:orientation="horizontal">

                <LinearLayout
                    android:layout_width="0dp"
                    android:layout_height="40dp"
                    android:layout_weight="1"
                    android:gravity="center"
                    android:background="@drawable/bg_mint"
                    android:layout_marginEnd="8dp"
                    android:tag="screen:my_impact">

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('profile_act_impact', '📊 Tác động')}"
                        android:textColor="#15803D"
                        android:textSize="13sp"
                        android:textStyle="bold" />
                </LinearLayout>

                <LinearLayout
                    android:layout_width="0dp"
                    android:layout_height="40dp"
                    android:layout_weight="1"
                    android:gravity="center"
                    android:background="@drawable/bg_mint"
                    android:tag="screen:settings">

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('profile_act_settings', '⚙️ Cài đặt')}"
                        android:textColor="#15803D"
                        android:textSize="13sp"
                        android:textStyle="bold" />
                </LinearLayout>
            </LinearLayout>

        </LinearLayout>

        <!-- Horizontal Tabs: Bài đăng / Mẹo / Đã lưu (Image 2) -->
        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="horizontal"
            android:background="@drawable/bg_card"
            android:padding="4dp"
            android:layout_marginHorizontal="14dp"
            android:layout_marginTop="12dp"
            android:layout_marginBottom="12dp">

            <!-- Selected Tab: Bài đăng -->
            <LinearLayout
                android:layout_width="0dp"
                android:layout_height="36dp"
                android:layout_weight="1"
                android:gravity="center"
                android:background="@drawable/bg_nav_create">

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="{s('tab_my_posts', '📷 Bài đăng')}"
                    android:textColor="@color/white"
                    android:textSize="12.5sp"
                    android:textStyle="bold" />
            </LinearLayout>

            <!-- Tab: Mẹo -->
            <LinearLayout
                android:layout_width="0dp"
                android:layout_height="36dp"
                android:layout_weight="1"
                android:gravity="center">

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="{s('tab_my_tips', '💡 Mẹo')}"
                    android:textColor="#64748B"
                    android:textSize="12.5sp" />
            </LinearLayout>

            <!-- Tab: Đã lưu -->
            <LinearLayout
                android:layout_width="0dp"
                android:layout_height="36dp"
                android:layout_weight="1"
                android:gravity="center">

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="{s('tab_saved', '🔖 Đã lưu')}"
                    android:textColor="#64748B"
                    android:textSize="12.5sp" />
            </LinearLayout>
        </LinearLayout>

        <!-- Posts Grid Row (Image 2: Wine Cork Craft Post) -->
        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="horizontal"
            android:paddingHorizontal="14dp">

            <!-- Post Card 1: Cork Wind Chime with likes badge -->
            <FrameLayout
                android:layout_width="165dp"
                android:layout_height="220dp"
                android:background="@drawable/bg_card"
                android:elevation="2dp"
                android:layout_marginEnd="10dp"
                android:tag="screen:post_detail">

                <ImageView
                    android:layout_width="match_parent"
                    android:layout_height="match_parent"
                    android:src="@drawable/photo_cork_wind_chime"
                    android:scaleType="centerCrop"
                    android:contentDescription="{s('cork_wind_chime_desc', 'Chuông gió nút chai')}" />

                <!-- Heart Likes Badge at bottom -->
                <LinearLayout
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:layout_gravity="bottom|start"
                    android:layout_margin="10dp"
                    android:orientation="horizontal"
                    android:gravity="center_vertical"
                    android:background="@drawable/bg_frosted_pill"
                    android:paddingHorizontal="8dp"
                    android:paddingVertical="4dp">

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('cork_likes_badge', '❤️ 445')}"
                        android:textColor="#E11D48"
                        android:textSize="11.5sp"
                        android:textStyle="bold" />
                </LinearLayout>
            </FrameLayout>

            <!-- Post Card 2: Glass Jar Lamp with likes badge -->
            <FrameLayout
                android:layout_width="165dp"
                android:layout_height="220dp"
                android:background="@drawable/bg_card"
                android:elevation="2dp"
                android:tag="screen:guide_detail">

                <ImageView
                    android:layout_width="match_parent"
                    android:layout_height="match_parent"
                    android:src="@drawable/illustration_lamp"
                    android:scaleType="centerCrop"
                    android:contentDescription="{s('lamp_guide_desc', 'Đèn lọ thủy tinh')}" />

                <!-- Heart Likes Badge at bottom -->
                <LinearLayout
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:layout_gravity="bottom|start"
                    android:layout_margin="10dp"
                    android:orientation="horizontal"
                    android:gravity="center_vertical"
                    android:background="@drawable/bg_frosted_pill"
                    android:paddingHorizontal="8dp"
                    android:paddingVertical="4dp">

                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="{s('lamp_likes_badge', '❤️ 2.1k')}"
                        android:textColor="#E11D48"
                        android:textSize="11.5sp"
                        android:textStyle="bold" />
                </LinearLayout>
            </FrameLayout>
        </LinearLayout>

        <!-- Orders & Account Management Shortcuts -->
        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="vertical"
            android:paddingHorizontal="14dp"
            android:layout_marginTop="16dp">

            <LinearLayout
                style="@style/Eco.Card"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:orientation="vertical"
                android:padding="16dp"
                android:layout_marginBottom="12dp">

                <LinearLayout
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:orientation="horizontal"
                    android:gravity="center_vertical"
                    android:layout_marginBottom="6dp">

                    <ImageView
                        android:layout_width="20dp"
                        android:layout_height="20dp"
                        android:src="@drawable/ic_truck"
                        android:layout_marginEnd="8dp"
                        android:contentDescription="{s('order_icon_desc', 'Đơn hàng')}" />

                    <TextView
                        android:layout_width="0dp"
                        android:layout_height="wrap_content"
                        android:layout_weight="1"
                        android:text="{s('orders_box_title', 'Đơn hàng của bạn')}"
                        android:textColor="@color/eco_text"
                        android:textSize="15sp"
                        android:textStyle="bold" />
                </LinearLayout>

                <TextView
                    android:id="@+id/orders_summary"
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:text="{s('default_order_summary_txt', 'Chưa có đơn hàng • Sẵn sàng giao dịch')}"
                    android:textColor="#4B5563"
                    android:textSize="13sp"
                    android:layout_marginBottom="12dp" />

                <com.google.android.material.button.MaterialButton
                    style="@style/Eco.Secondary"
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:id="@+id/btn_profile_view_orders"
                    android:text="{s('view_all_orders_btn', 'Quản lý đơn mua &amp; Đơn bán →')}"
                    android:tag="screen:orders" />
            </LinearLayout>

            <com.google.android.material.button.MaterialButton
                style="@style/Eco.Secondary"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:id="@+id/btn_my_listings"
                android:text="{s('btn_my_listings_txt', '🛍️ Quản lý sản phẩm đang bán')}"
                android:tag="screen:my_listings"
                android:layout_marginBottom="8dp" />

            <com.google.android.material.button.MaterialButton
                style="@style/Eco.Secondary"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:id="@+id/btn_verification"
                android:text="{s('btn_verification_txt', '🛡️ Hồ sơ xác minh danh tính')}"
                android:tag="screen:verification"
                android:layout_marginBottom="8dp" />

            <com.google.android.material.button.MaterialButton
                style="@style/Eco.Secondary"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:id="@+id/btn_settings"
                android:text="{s('btn_settings_txt', '⚙️ Cài đặt tài khoản &amp; Bảo mật')}"
                android:tag="screen:settings" />
        </LinearLayout>

    </LinearLayout>
</ScrollView>
'''
screen('profile', 'Nguyễn Thị Lan', 'HỒ SƠ THÀNH VIÊN XANH', '', custom_xml=profile_xml)


# 23. Edit Profile
screen('edit_profile', 'Chỉnh sửa hồ sơ', 'CẬP NHẬT THÔNG TIN CÁ NHÂN',
    field('profile_name', 'Tên hiển thị công khai', 'text', 'Nguyễn Thị Lan') +
    field('profile_bio', 'Tiểu sử / Giới thiệu bản thân', 'textMultiLine') +
    field('profile_city', 'Thành phố sinh sống', 'text', 'TP. Hồ Chí Minh') +
    button('profile_save', 'Lưu thay đổi hồ sơ', 'save_profile', icon='ic_verified') +
    button('profile_addresses', 'Quản lý sổ địa chỉ giao hàng', 'screen:addresses', secondary=True, icon='ic_map_pin'))

# 24. Addresses
screen('addresses', 'Địa chỉ nhận hàng', 'SỔ ĐỊA CHỈ GIAO NHẬN',
    card('addr_info', 'Địa chỉ mặc định', 'Địa chỉ này được dùng tự động khi bạn đặt mua đồ trên chợ EcoShare.', icon='ic_map_pin') +
    field('address_name', 'Họ tên người nhận') +
    field('address_phone', 'Số điện thoại nhận hàng', 'phone') +
    field('address_line', 'Địa chỉ chi tiết (Số nhà, đường, phường, quận)', 'textPostalAddress') +
    button('address_save', 'Lưu địa chỉ mặc định', 'save_address', icon='ic_verified'))

# 25. Settings
screen('settings', 'Cài đặt', 'TÀI KHOẢN & ỨNG DỤNG',
    card('settings_overview', 'EcoShare phiên bản 1.0', 'Ứng dụng mua bán đồ cũ & chia sẻ tri thức tái chế vì môi trường xanh.', icon='ic_eco_leaf') +
    button('settings_privacy', 'Quyền riêng tư & Bảo mật dữ liệu', 'screen:privacy_settings', secondary=True, icon='ic_shield') +
    button('settings_help', 'Trung tâm trợ giúp & FAQ', 'screen:help_center', secondary=True) +
    button('settings_logout', 'Đăng xuất tài khoản mẫu', 'logout', secondary=True))

# 26. Privacy Settings
screen('privacy_settings', 'Quyền riêng tư', 'QUẢN LÝ DỮ LIỆU CÁ NHÂN',
    card('privacy_box', 'Bảo vệ danh tính', 'Tài liệu xác minh không bao giờ hiển thị công khai. Địa chỉ nhận hàng chỉ được chia sẻ cho người bán trong đơn hàng của bạn.', icon='ic_shield') +
    '<Switch android:id="@+id/privacy_location" android:layout_width="match_parent" android:layout_height="56dp" android:text="' + s('privacy_location_label', 'Hiển thị thành phố công khai trên hồ sơ') + '"/>' +
    button('privacy_save', 'Lưu lựa chọn riêng tư', 'save_privacy', icon='ic_verified'))

# 27. Notifications
screen('notifications', 'Thông báo', 'CẬP NHẬT MỚI NHẤT',
    '<LinearLayout style="@style/Eco.Card" android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="vertical">' +
    text('notification_state', 'Chưa có thông báo giao dịch', 'Body', 'android:id="@+id/notification_state"') +
    '</LinearLayout>' +
    card('notification_green', 'Chào mừng thành viên mới!', 'Chào mừng bạn đến với cộng đồng EcoShare. Hãy cùng nhau tái sử dụng đồ cũ và bảo vệ hành tinh.', action='explore', icon='ic_eco_leaf'))

# 28. Search
screen('search', 'Tìm kiếm', 'MÓN ĐỒ / KIẾN THỨC / ĐỊA ĐIỂM',
    field('search_query', 'Từ khóa tìm kiếm (ví dụ: đèn, lọ, sách...)') +
    field('search_category', 'Danh mục (để trống: tìm kiếm tất cả)') +
    button('search_submit', 'Tìm kiếm trong hệ thống', 'search', icon='ic_search') +
    '<LinearLayout style="@style/Eco.Card" android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="vertical">' +
    text('search_results', 'Nhập từ khóa và bấm tìm kiếm để bắt đầu', 'Body', 'android:id="@+id/search_results"') +
    '</LinearLayout>' +
    button('search_open', 'Xem sản phẩm gợi ý: Đèn thủy tinh', 'screen:market_detail', secondary=True, icon='ic_nav_market'))

# 29. Post Detail
screen('post_detail', 'Vườn treo từ chai nhựa', 'LÊ THỊ HOA / CÂU CHUYỆN SỐNG XANH',
    hero('post_hero', 'TÁI SỬ DỤNG / 20 PHÚT', 'Một góc xanh\ntừ món đồ cũ.', 'Vệ sinh chai, đục lỗ thoát nước, thêm đất và trồng cây nhỏ. Cùng thử vào cuối tuần nhé!', icon='ic_eco_leaf') +
    button('post_like', '❤️ Thích bài viết này', 'like_post', secondary=True, icon='ic_heart') +
    field('post_comment', 'Viết bình luận hoặc chia sẻ mẹo của bạn...') +
    button('post_comment_send', 'Đăng bình luận', 'comment_post') +
    '<LinearLayout style="@style/Eco.Card" android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="vertical">' +
    text('post_comments', 'Chưa có bình luận mới', 'Body', 'android:id="@+id/post_comments"') +
    '</LinearLayout>' +
    button('post_photo', 'Xem ảnh minh họa chi tiết', 'screen:image_viewer', secondary=True, icon='ic_camera') +
    button('post_tag', 'Khám phá chủ đề #TáiChếNhựa', 'screen:hashtag', secondary=True) +
    button('post_report', 'Báo cáo bài viết vi phạm', 'screen:report', secondary=True))

# 30. Create Post
screen('create_post', 'Chia sẻ câu chuyện', 'CỘNG ĐỒNG SỐNG XANH / CHỜ DUYỆT',
    card('post_guide', 'Lan tỏa lối sống xanh', 'Chia sẻ mẹo tái chế, cách bạn sửa chữa đồ cũ hoặc ý tưởng bảo vệ môi trường để nhận điểm xanh.', icon='ic_eco_leaf') +
    field('post_content', 'Bạn đã tái sử dụng hoặc phân loại món đồ nào hôm nay?', 'textMultiLine') +
    button('post_submit', 'Gửi bài viết chờ duyệt', 'submit_post', icon='ic_plus'))

# 31. Image Viewer
screen('image_viewer', 'Góc xanh tái sử dụng', 'ẢNH MINH HỌA NATIVE',
    '<LinearLayout style="@style/Eco.Card" android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="vertical" android:padding="12dp">' +
    '<ImageView android:layout_width="match_parent" android:layout_height="280dp" android:src="@drawable/illustration_lamp" android:background="@drawable/bg_card_mint" android:contentDescription="@string/lamp_description" android:scaleType="centerInside" android:layout_marginBottom="8dp"/>' +
    '</LinearLayout>' +
    card('image_caption_card', 'Mô tả hình ảnh', 'Minh họa tái chế native trong ứng dụng. Hình ảnh thực tế sẽ được tải từ cloud media khi kết nối backend.', icon='ic_camera'))

# 32. Hashtag
screen('hashtag', '#TáiChếNhựa', 'CHỦ ĐỀ CỘNG ĐỒNG NỔI BẬT',
    card('hashtag_post', 'Vườn treo từ chai nhựa', 'Một ý tưởng nhỏ để bắt đầu biến rác thải thành mảng xanh gia đình.', action='post_detail', icon='ic_eco_leaf', badge_text='TOP MẸO'))

# 33. Report
screen('report', 'Báo cáo vi phạm', 'AN TOÀN CỘNG ĐỒNG',
    card('report_guide', 'Cùng giữ môi trường an toàn', 'Vui lòng nêu rõ lý do bài viết, sản phẩm hoặc người dùng có hành vi gian lận, không đúng sự thật.', icon='ic_shield') +
    field('report_reason', 'Lý do báo cáo chi tiết...', 'textMultiLine') +
    button('report_photo', 'Chọn ảnh bằng chứng vi phạm', 'pick:evidence', secondary=True, icon='ic_camera') +
    button('report_submit', 'Gửi báo cáo đến Ban quản trị', 'submit_report', icon='ic_verified'))

# 34. Friends
screen('friends', 'Bạn bè xanh', 'KẾT NỐI & TƯƠNG TÁC',
    card('friend_hoa', 'Lê Thị Hoa', 'Thành viên tích cực cộng đồng tái chế TP.HCM • 3.450 điểm xanh', action='chat', icon='ic_nav_profile', badge_text='BẠN BÈ') +
    card('friend_minh', 'Trần Văn Minh', 'Người bán đã xác minh • Chuyên đồ gia dụng & thủ công', action='chat', icon='ic_nav_profile', badge_text='NGƯỜI BÁN'))

# 35. Recycling Map
screen('recycling_map', 'Điểm thu gom gần bạn', 'BẢN ĐỒ KHU VỰC TP. HỒ CHÍ MINH',
    hero('map_placeholder', 'MẠNG LƯỚI ĐIỂM THU GOM', 'Gửi đúng nơi.\nTái chế đúng cách.', 'Tìm kiếm các trạm thu gom giấy, nhựa, kim loại và pin đã được kiểm duyệt.', icon='ic_map_pin') +
    card('point_sample', 'Trạm xanh Thảo Điền', 'Thu gom: Giấy · Chai nhựa PET · Vỏ lon kim loại\nGiờ mở cửa: 08:00 – 17:00 (Thứ 2 đến Thứ 7)', action='recycling_point_detail', icon='ic_map_pin', badge_text='ĐANG MỞ'))

# 36. Recycling Point Detail
screen('recycling_point_detail', 'Trạm xanh Thảo Điền', 'ĐIỂM THU GOM / DỮ LIỆU MẪU',
    card('point_material', 'Vật liệu tiếp nhận', 'Tiếp nhận: Giấy carton sạch, chai nhựa PET trong suốt, lon nhôm và kim loại. Không nhận pin hỏng hoặc rác thải nguy hại tại điểm này.', icon='ic_eco_leaf', badge_text='QUY ĐỊNH') +
    card('point_hours', 'Lưu ý trước khi mang đến', 'Vui lòng làm sạch và phơi khô các chai lọ trước khi bàn giao để hỗ trợ công tác phân loại hiệu quả hơn.', icon='ic_shield') +
    button('point_guide', 'Xem cẩm nang phân loại chi tiết', 'screen:material_guide', icon='ic_eco_leaf'))

# 37. Material Guide
screen('material_guide', 'Phân loại rác dễ dàng', 'CẨM NANG TÁI CHẾ CHO MỌI NHÀ',
    card('material_plastic', '01 / Nhựa PET (Số 1)', 'Rửa sạch bên trong, để khô ráo, ép bẹp để tiết kiệm diện tích. Tháo riêng nắp chai nhựa.', icon='ic_eco_leaf', badge_text='PHỔ BIẾN') +
    card('material_paper', '02 / Giấy & Bìa carton', 'Giữ giấy luôn khô ráo, gỡ bỏ toàn bộ băng dính, kim bấm và màng bọc nilon trước khi nộp.', icon='ic_eco_leaf') +
    card('material_battery', '03 / Pin & Đồ điện tử', 'Tuyệt đối không vứt vào thùng rác sinh hoạt. Bàn giao tại các điểm thu gom rác nguy hại chuyên dụng.', icon='ic_shield', badge_text='NGUY HẠI'))

# 38. Guide Detail
screen('guide_detail', 'Chai nhựa thành chậu cây', 'HƯỚNG DẪN TỪNG BƯỚC / 20 PHÚT',
    card('guide_tools', 'Dụng cụ cần chuẩn bị', '1-2 chai nhựa sạch, kéo, dao trổ, dây treo chắc chắn, đất mùn hữu cơ và cây con hoặc hạt mầm.', icon='ic_eco_leaf') +
    card('guide_steps', '5 bước thực hiện đơn giản', '1. Rửa sạch chai và bóc nhãn.\n2. Cắt thân chai và làm mịn cạnh sắc.\n3. Đục 3-4 lỗ nhỏ dưới đáy thoát nước.\n4. Cho đất dinh dưỡng vào khoảng 2/3 chai.\n5. Trồng cây và treo ở nơi có ánh nắng sáng.', icon='ic_award') +
    button('guide_materials', 'Tìm hiểu thêm về các loại nhựa', 'screen:material_guide', secondary=True, icon='ic_eco_leaf'))

# 39. My Impact
screen('my_impact', 'Tác động của bạn', 'MỖI HÀNH ĐỘNG ĐỀU CÓ Ý NGHĨA',
    '<LinearLayout style="@style/Eco.Hero" android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="vertical" android:gravity="center" android:padding="24dp">' +
    '<ImageView android:layout_width="48dp" android:layout_height="48dp" android:src="@drawable/ic_award" android:layout_marginBottom="8dp"/>' +
    '<TextView style="@style/Eco.HeroLabel" android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="' + s('impact_total_label', 'TỔNG ĐIỂM ECO TÍCH LŨY') + '" android:layout_gravity="center"/>' +
    '<TextView style="@style/Eco.HeroTitle" android:layout_width="wrap_content" android:layout_height="wrap_content" android:id="@+id/impact_points" android:text="' + s('init_points', '0 điểm xanh') + '" android:textSize="32sp" android:layout_gravity="center" android:layout_marginBottom="6dp"/>' +
    text('impact_note', 'Bản demo tự động cộng 10 điểm xanh sau khi bạn bấm xác nhận đã nhận hàng thành công.', 'HeroBody', 'android:gravity="center"') +
    '</LinearLayout>' +
    button('impact_badges', 'Xem bộ sưu tập Huy hiệu xanh', 'screen:badges', icon='ic_award') +
    button('impact_leaderboard', 'Bảng xếp hạng Cộng đồng sống xanh', 'screen:leaderboard', secondary=True, icon='ic_star'))

# 40. Badges
screen('badges', 'Bộ sưu tập huy hiệu', 'GHI NHẬN ĐÓNG GÓP VÌ MÔI TRƯỜNG',
    card('badge_start', 'Mầm xanh Eco', 'Huy hiệu dành cho thành viên gia nhập cộng đồng và tìm hiểu kiến thức tái chế.', icon='ic_award', badge_text='ĐÃ ĐẠT') +
    card('badge_trade', 'Vòng đời mới', 'Huy hiệu trao tặng khi hoàn tất đơn hàng mua bán đồ cũ đầu tiên thành công.', icon='ic_award', badge_text='ĐÃ ĐẠT'))

# 41. Leaderboard
screen('leaderboard', 'Cộng đồng sống xanh', 'BẢNG XẾP HẠNG THÀNH VIÊN TÍCH CỰC',
    card('rank_hoa', 'Hạng 1 • Lê Thị Hoa', '3.450 điểm xanh • 42 hoạt động tái chế hoàn tất', icon='ic_award', badge_text='TOP 1') +
    card('rank_minh', 'Hạng 2 • Trần Văn Minh', '2.100 điểm xanh • 28 giao dịch đồ cũ uy tín', icon='ic_award', badge_text='TOP 2') +
    button('leaderboard_impact', 'Xem điểm của tôi', 'screen:my_impact', secondary=True, icon='ic_award'))

# 42. Reward Shop
screen('reward_shop', 'Góc phần thưởng', 'ĐỔI ĐIỂM XANH LẤY QUÀ TẶNG',
    card('reward_bag', 'Túi vải Canvas EcoShare', 'Cần 500 điểm xanh • Quà tặng tái sử dụng bền đẹp, thay thế hoàn toàn túi nilon khi mua sắm.', icon='ic_award', badge_text='500 ĐIỂM') +
    button('reward_points', 'Xem số dư Điểm Xanh của bạn', 'screen:my_impact', secondary=True, icon='ic_award'))

# 43. Challenge Detail
screen('challenge_detail', '30 ngày dùng túi vải', 'THỬ THÁCH CỘNG ĐỒNG THÁNG NÀY',
    card('challenge_info', 'Xây dựng thói quen xanh', 'Mang theo túi vải cá nhân mỗi khi mua sắm. Cùng giảm 30 chiếc túi nilon thải ra môi trường trong tháng.', icon='ic_award', badge_text='THỬ THÁCH') +
    button('challenge_join', 'Tham gia thử thách ngay (+50 điểm)', 'join_challenge', icon='ic_award'))

# 44. Groups
screen('groups', 'Cộng đồng của bạn', 'NHÓM & SỰ KIỆN XANH',
    card('group_green', 'Hội tái sử dụng đồ cũ TP.HCM', '2.840 thành viên • Cùng chia sẻ mẹo vặt gia đình và sản phẩm tái chế.', action='group_detail', icon='ic_nav_explore', badge_text='2.8K TV') +
    button('groups_events', 'Xem lịch sự kiện sắp diễn ra', 'screen:events', secondary=True, icon='ic_nav_explore'))

# 45. Group Detail
screen('group_detail', 'Hội tái sử dụng TP.HCM', 'NHÓM CỘNG ĐỒNG HOẠT ĐỘNG',
    card('group_rules', 'Nội quy nhóm', 'Tôn trọng các thành viên, chia sẻ thông tin đúng chủ đề và sử dụng luồng mua bán chính thức trong app để được bảo vệ.', icon='ic_shield') +
    button('group_join', 'Tham gia nhóm này', 'join_group', icon='ic_plus') +
    button('group_events', 'Xem các sự kiện giao lưu của hội', 'screen:events', secondary=True, icon='ic_nav_explore'))

# 46. Events
screen('events', 'Hẹn nhau sống xanh', 'SỰ KIỆN CỘNG ĐỒNG GẦN BẠN',
    card('event_weekend', 'Ngày hội Tái Chế & Trao Đổi Đồ Cũ', 'Thời gian: Thứ 7 tuần này · 08:30 – 16:00\nĐịa điểm: Công viên 23/9, Quận 1, TP.HCM\nHoạt động: Đổi sách, cây xanh, hướng dẫn phân loại rác.', icon='ic_award', badge_text='SẮP DIỄN RA') +
    button('event_join', 'Đăng ký tham gia sự kiện', 'join_event', icon='ic_award'))

# 47. Scanner
screen('scanner', 'Nhận diện vật liệu', 'HƯỚNG DẪN KÝ HIỆU BAO BÌ VẬT LIỆU',
    card('scanner_info', 'Tra cứu thủ công', 'Chưa tích hợp camera nhận diện ML tự động. Bạn có thể tra cứu nhanh theo mã số ký hiệu in trên bao bì sản phẩm:', icon='ic_camera') +
    button('scanner_pet', 'Nhựa số 1: PET / PETE (Chai nước ngọt, dầu ăn)', 'screen:material_guide', secondary=True, icon='ic_eco_leaf') +
    button('scanner_paper', 'Ký hiệu PAP: Giấy & Bìa carton tái chế', 'screen:material_guide', secondary=True, icon='ic_eco_leaf'))

# 48. Help Center
screen('help_center', 'Chúng tôi có thể giúp gì?', 'TRUNG TÂM TRỢ GIÚP & HỎI ĐÁP',
    card('help_verify', 'Vì sao cần xác minh danh tính cả 2 bên?', 'Để phòng ngừa gian lận, truy vết giao dịch và bảo vệ quyền lợi hoàn tiền khi có tranh chấp phát sinh.', icon='ic_shield') +
    card('help_payment', 'Thanh toán được bảo vệ như thế nào?', 'Tiền được giữ an toàn tại hệ thống trung gian qua MoMo/VNPay và chỉ chuyển đến người bán sau khi người mua xác nhận đã nhận hàng.', icon='ic_wallet') +
    button('help_report', 'Gửi yêu cầu trợ giúp hoặc phản ánh vi phạm', 'screen:report', secondary=True, icon='ic_verified'))

# 49. Admin Dashboard
screen('admin_dashboard', 'Quản trị nhanh', 'ADMIN MOBILE / CHẾ ĐỘ DEMO',
    card('admin_scope', 'Phạm vi quản trị Mobile', 'Quản trị viên thao tác chuyên sâu trên Web Admin. Ứng dụng mobile hỗ trợ xem nhanh số liệu, duyệt tin đăng và tiếp nhận báo cáo.', icon='ic_shield') +
    '<LinearLayout style="@style/Eco.Hero" android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="vertical" android:gravity="center" android:padding="20dp">' +
    '<TextView style="@style/Eco.HeroLabel" android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="' + s('admin_queue_label', 'TỔNG QUAN HÀNG CHỜ') + '" android:layout_gravity="center"/>' +
    text('admin_counts', 'Tổng quan', 'HeroTitle', 'android:id="@+id/admin_counts" android:gravity="center"') +
    '</LinearLayout>' +
    button('admin_pending', 'Duyệt bài đăng và sản phẩm mới', 'screen:admin_moderation', icon='ic_verified') +
    button('admin_reports', 'Xử lý báo cáo cộng đồng', 'screen:admin_reports', secondary=True, icon='ic_shield') +
    card('admin_web_card', 'Admin Web đầy đủ 14 phân hệ', 'Mở trình duyệt truy cập admin-web: quản lý người dùng, KYC xác minh, đơn hàng, hoàn tiền, đối soát và sổ điểm xanh.', icon='ic_shield'))

# 50. Admin Moderation
screen('admin_moderation', 'Hàng chờ kiểm duyệt', 'ADMIN MOBILE / DUYỆT NỘI DUNG',
    '<LinearLayout style="@style/Eco.Card" android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="vertical">' +
    text('moderation_item', 'Không có nội dung chờ duyệt', 'Body', 'android:id="@+id/moderation_item"') +
    '</LinearLayout>' +
    button('moderation_approve', '✓ Phê duyệt nội dung này', 'moderate:approved', icon='ic_verified') +
    field('moderation_reason', 'Lý do từ chối (nếu không duyệt)...') +
    button('moderation_reject', '✕ Từ chối nội dung này', 'moderate:rejected', secondary=True))

# 51. Admin Reports
screen('admin_reports', 'Báo cáo vi phạm', 'ADMIN MOBILE / TIẾP NHẬN PHẢN ÁNH',
    '<LinearLayout style="@style/Eco.Card" android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="vertical">' +
    text('admin_report_list', 'Chưa có báo cáo', 'Body', 'android:id="@+id/admin_report_list"') +
    '</LinearLayout>' +
    card('report_scope', 'Quy trình xử lý tranh chấp', 'Điều tra giao dịch, hoàn tiền qua cổng, khóa tài khoản được thực hiện trên Admin Web để đảm bảo đối soát kế toán.', icon='ic_shield') +
    button('admin_report_ack', 'Đánh dấu đã tiếp nhận xử lý', 'ack_report', icon='ic_verified'))

# Save strings and catalogue
(RES / 'values/strings.xml').write_text(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n' +
    ''.join(f'    <string name="{k}">{escape(v).replace(chr(39), chr(92)+chr(39)).replace(chr(10), chr(92)+"n")}</string>\n' for k, v in strings.items()) +
    '</resources>\n', encoding='utf-8')
(ROOT / 'docs').mkdir(exist_ok=True)
(ROOT / 'docs/android-screens.json').write_text(json.dumps(screens, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Generated {len(screens)} native XML screens and {len(strings)} strings.')
