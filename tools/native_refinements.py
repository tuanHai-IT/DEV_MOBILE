"""Behavior/accessibility refinements applied to the native design catalogue.

Keep interaction IDs and layout behavior here so regenerating XML preserves fixes.
"""
import xml.etree.ElementTree as ET

A = '{http://schemas.android.com/apk/res/android}'
APP = '{http://schemas.android.com/apk/res-auto}'


def refine(name, root, string):
    def by_id(identifier):
        return next((n for n in root.iter() if n.get(A+'id') == '@+id/'+identifier), None)

    def by_text(key):
        return next((n for n in root.iter() if n.get(A+'text') == '@string/'+key), None)

    def identify(key, identifier):
        node=by_text(key)
        if node is not None:node.set(A+'id','@+id/'+identifier)
        return node

    def add_button(parent, identifier, label, action, icon):
        node=ET.SubElement(parent,'com.google.android.material.button.MaterialButton',{'style':'@style/Eco.Secondary',A+'id':'@+id/'+identifier,A+'layout_width':'match_parent',A+'layout_height':'wrap_content',A+'text':string(identifier,label),A+'tag':action,APP+'icon':'@drawable/'+icon,APP+'iconGravity':'textStart',APP+'iconSize':'20dp'})
        return node

    # All interactive views can receive keyboard/accessibility focus and have a
    # practical touch target. Decorative icons do not repeat the parent's label.
    for node in root.iter():
        if node.get(A+'textColor','').upper() in ['#94A3B8','#829B8E']:
            node.set(A+'textColor','@color/eco_muted')
        if node.get(A+'tag'):
            node.set(A+'focusable','true')
            node.set(A+'minHeight','48dp')
            if node.tag=='TextView' and not node.get(A+'gravity'):node.set(A+'gravity','center_vertical')
            height=node.get(A+'layout_height','')
            if height.endswith('dp') and 0<float(height[:-2])<48:
                node.set(A+'layout_height','48dp')
            if node.tag.endswith('MaterialButton') and not node.get(A+'text'):
                action=node.get(A+'tag','').removeprefix('screen:')
                label={'material_guide':'Hướng dẫn phân loại','recycling_map':'Điểm thu gom','search':'Tìm kiếm'}.get(action,'Mở chi tiết')
                node.set(A+'contentDescription',string('access_'+action,label))
        if node.tag=='ImageView' and not node.get(A+'contentDescription'):
            node.set(A+'importantForAccessibility','no')

    if name=='login':
        by_id('login_submit_btn').set(A+'text',string('login_demo_submit','Vào EcoShare • Demo'))
        by_id('login_submit_btn').set(A+'layout_height','wrap_content')
        for provider in ['google','apple']:
            by_id('btn_'+provider).set(A+'tag','social:'+provider)
        for node in root.iter():
            if node.get(A+'tag')=='screen:forgot_password':node.set(A+'id','@+id/go_forgot')
        title=by_id('login_heading')
        parent=next(n for n in root.iter() if title in list(n))
        note=ET.Element('TextView',{'style':'@style/Eco.Body',A+'layout_width':'match_parent',A+'layout_height':'wrap_content',A+'text':string('login_demo_note','Bản trải nghiệm trên thiết bị. Email và mật khẩu chỉ minh họa; các nút demo mở tài khoản mẫu.'),A+'textSize':'12sp',A+'padding':'12dp',A+'background':'@drawable/bg_mint',A+'layout_marginBottom':'18dp'})
        parent.insert(2,note)
        for key in ['login_footer_register','login_forgot_link']:
            node=by_text(key)
            if node is not None:node.set(A+'gravity','center_vertical')

    if name=='chat':
        string('chat_input_hint','Nhắn tin…')
        header=root[0]
        header.set(A+'layout_height','wrap_content');header.set(A+'minHeight','64dp')
        header.set(A+'paddingVertical','8dp')
        header[0].set(A+'id','@+id/chat_back');header[0].set(A+'tag','back')
        identify('chat_hoa_name','chat_contact_name')
        identify('chat_hoa_status','chat_contact_status')
        avatar=next(n for n in header.iter('ImageView') if n.get(A+'src')=='@drawable/ic_avatar_hoa')
        avatar.set(A+'id','@+id/chat_contact_avatar')
        header[-1].set(A+'tag','chat_call');header[-1].set(A+'focusable','true')
        header[-1].set(A+'layout_height','48dp')
        scroll=root[1];scroll.set(A+'id','@+id/chat_scroll');scroll.set(A+'clipToPadding','false')
        messages=scroll[0]
        for child in list(messages):messages.remove(child)
        messages.set(A+'id','@+id/chat_messages')
        for index in range(1,4):
            chip=by_text('chat_chip_'+str(index))
            if chip is not None:
                chip.set(A+'tag','chat_reply:'+str(index));chip.set(A+'minHeight','48dp');chip.set(A+'gravity','center_vertical');chip.set(A+'focusable','true')
        composer=root[-1]
        for child in composer:
            child.set(A+'minHeight','48dp')
            child.set(A+'layout_height','wrap_content' if child.find('EditText') is not None else '48dp')
        edit=by_id('chat_message');edit.set(A+'layout_height','wrap_content');edit.set(A+'minHeight','48dp')
        edit.set(A+'paddingVertical','12dp');edit.set(A+'inputType','textCapSentences|textMultiLine')
        edit.set(A+'maxLines','4');edit.set(A+'imeOptions','actionSend')
        edit.set(A+'maxLength','4000')
        by_id('chat_send').set(A+'contentDescription',string('chat_send_access','Gửi tin nhắn'))

    if name=='messages':
        for node in root.iter():
            if node.get(A+'tag')!='screen:chat':continue
            contact=next((image.get(A+'src','').removeprefix('@drawable/ic_avatar_') for image in node.iter('ImageView') if image.get(A+'src','').startswith('@drawable/ic_avatar_')),'hoa')
            node.set(A+'tag','chat:'+contact)
            if node.get(A+'layout_width')=='match_parent':
                node.set(A+'id','@+id/conversation_'+contact)
                texts=[n for n in node.iter('TextView')]
                if len(texts)>1:texts[1].set(A+'id','@+id/chat_preview_'+contact)

    if name in ['market_detail','friends']:
        for node in root.iter():
            if node.get(A+'tag')=='screen:chat':
                node.set(A+'tag','chat:hoa' if 'hoa' in node.get(A+'id','') else 'chat:minh')

    if name=='profile':
        identify('profile_bio_l1','profile_bio_text')
        identify('profile_city_str','profile_city_text')
        identify('eco_lvl_score','profile_points_summary')
        level=identify('eco_warrior_title','profile_level_title')
        if level is not None:level.set(A+'text',string('profile_level_start','Mỗi giao dịch hoàn tất là một bước xanh.'))
        for node in root.iter():
            if node.tag=='ProgressBar':node.set(A+'id','@+id/profile_points_progress');node.set(A+'progress','0')
            if node.get(A+'tag')=='screen:edit_profile':node.set(A+'id','@+id/profile_edit_action')
        points=by_id('impact_points')
        if points is not None:points.set(A+'text',string('profile_initial_points','0'))
        stats=next(n for n in root.iter() if any(points in list(child) for child in n))
        stats.set(A+'gravity','center_vertical')
        for stat in stats:stat.set(A+'minHeight','64dp')
        for node in root.iter():
            if node.get(A+'tag')=='screen:settings' and node.tag=='LinearLayout':node.set(A+'id','@+id/profile_settings_action')
        for node in root.iter('TextView'):
            label=node.get(A+'text','')
            tabs={'@string/tab_my_posts':'posts','@string/tab_my_tips':'tips','@string/tab_saved':'saved'}
            if label in tabs:
                tab=tabs[label]
                node.set(A+'tag','profile_tab:'+tab);node.set(A+'id','@+id/profile_tab_'+tab)
                node.set(A+'focusable','true');node.set(A+'minHeight','48dp')
        for node in root.iter('FrameLayout'):
            if node.get(A+'tag')=='screen:post_detail':node.set(A+'transitionName','profile:post')
            if node.get(A+'tag')=='screen:guide_detail':node.set(A+'transitionName','profile:tip')
        empty=ET.Element('TextView',{'style':'@style/Eco.Body',A+'id':'@+id/profile_saved_empty',A+'layout_width':'match_parent',A+'layout_height':'wrap_content',A+'text':string('profile_no_saved','Bạn chưa lưu bài viết nào. Chọn Lưu ở bảng tin để thêm vào đây.'),A+'visibility':'gone',A+'padding':'16dp',A+'layout_marginHorizontal':'16dp'})
        root[0].insert(len(root[0])-1,empty)

    if name=='settings':
        container=root[0]
        admin=add_button(container,'settings_admin','Admin cơ bản • Demo','screen:admin_dashboard','ic_shield')
        container.remove(admin);container.insert(len(container)-1,admin)

    if name=='explore':
        container=root[0]
        materials={'mat_all':'all','mat_plastic':'plastic','mat_glass':'glass','mat_rubber':'rubber','mat_paper':'paper','mat_electronic':'electronic'}
        for node in root.iter():
            key=node.get(A+'text','').removeprefix('@string/')
            if key in materials:
                node.set(A+'id','@+id/filter_material_'+materials[key]);node.set(A+'tag','filter:'+materials[key]);node.set(A+'minHeight','48dp');node.set(A+'gravity','center');node.set(A+'layout_height','48dp')
            if node.get(A+'tag') in ['screen:guide_detail','screen:market_detail'] and node.tag in ['FrameLayout','LinearLayout']:
                images=[n.get(A+'src','') for n in node.iter('ImageView')]
                material='rubber' if any('tire' in image for image in images) else 'glass' if any('lamp' in image for image in images) else 'plastic'
                node.set(A+'transitionName','material:'+material)
                if material=='rubber':node.set(A+'tag','screen:material_guide')
        empty=ET.SubElement(container,'TextView',{'style':'@style/Eco.Body',A+'id':'@+id/explore_empty',A+'layout_width':'match_parent',A+'layout_height':'wrap_content',A+'text':string('explore_empty_note','Chưa có nội dung mẫu cho vật liệu này. Bạn có thể xem cẩm nang phân loại hoặc chọn Tất cả.'),A+'visibility':'gone',A+'padding':'16dp',A+'background':'@drawable/bg_mint'})
        container.remove(empty);container.insert(4,empty)
        add_button(container,'explore_groups','Cộng đồng & nhóm xanh','screen:groups','ic_friends')
        add_button(container,'explore_events','Lịch sự kiện','screen:events','ic_bell')
        add_button(container,'explore_rewards','Góc phần thưởng','screen:reward_shop','ic_award')

    if name in ['home','post_detail','market_detail']:
        likes=0;saves=0
        for node in root.iter():
            action=node.get(A+'tag','')
            if action=='like_post':
                likes+=1;node.set(A+'tag','toggle:like:'+str(likes))
            if action=='save_listing':
                saves+=1;node.set(A+'tag','toggle:'+('save_listing:lamp' if name=='market_detail' else 'save_post:'+str(saves)))
            if node.get(A+'text','').startswith('@string/act_share'):
                node.set(A+'tag','share_post')
        string('action_like','Thích');string('action_liked','Đã thích')
        string('action_save','Lưu');string('action_saved','Đã lưu')

    # Common runtime labels, used by the host instead of untranslated enums.
    for key,label in {'status_unverified':'Chưa xác minh','status_pending':'Đang chờ duyệt','status_verified':'Đã xác minh','status_rejected':'Hồ sơ bị từ chối','status_expired':'Hồ sơ đã hết hạn','social_not_connected':'Đăng nhập bằng Google/Apple chưa được kết nối. Bạn có thể dùng tài khoản demo.','chat_call_not_connected':'Cuộc gọi chưa được hỗ trợ trong bản demo.','profile_points_format':'%1$s / 2.000 điểm','notification_access':'Thông báo','friends_access':'Bạn bè','scanner_access':'Hướng dẫn nhận diện vật liệu','new_post_access':'Tạo bài viết','demo_short':'Bản trải nghiệm'}.items():string(key,label)

    return root
