"""Single source for the 20 domain DTOs, SQL schema and exported diagrams.

Run: python tools/generate_design.py. No third-party dependencies.
"""
# Nguồn sinh DTO, schema tham chiếu và file sơ đồ.
from pathlib import Path
from xml.sax.saxutils import escape
import xml.etree.ElementTree as ET
import json
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'Recycling Share App/diagrams-v2'
OUT.mkdir(parents=True, exist_ok=True)
JAVA = ROOT/'app/src/main/java/com/example/recyclingshareapp/model'
JAVA.mkdir(parents=True, exist_ok=True)
DB = ROOT/'database'
DB.mkdir(exist_ok=True)

# name, SQL table, purpose, fields: name SQL-type [nullable ?] [foreign target ->Class]
ENTITIES = [
('User','users','Tài khoản, vai trò & trạng thái',[
 'id TEXT','display_name TEXT','email TEXT','role TEXT','status TEXT','phone TEXT?', 'bio TEXT?', 'city TEXT?', 'avatar_key TEXT?', 'cover_key TEXT?', 'created_at TEXT']),
('Verification','verifications','Xác minh chung cho mua và bán',[
 'id TEXT','user_id TEXT->User','status TEXT','submitted_at TEXT','reviewer_id TEXT?->User','reviewed_at TEXT?','expires_at TEXT?','reason TEXT?']),
('Address','addresses','Địa chỉ giao nhận',[
 'id TEXT','user_id TEXT->User','recipient TEXT','phone TEXT','line TEXT','city TEXT','is_default INTEGER']),
('Category','categories','Danh mục sản phẩm',[
 'id TEXT','name TEXT','description TEXT?','active INTEGER']),
('Listing','listings','Tin bán đồ cũ; COMMUNITY giữ tương thích',[
 'id TEXT','seller_id TEXT->User','kind TEXT','title TEXT','description TEXT','status TEXT','city TEXT','latitude REAL?','longitude REAL?','tags_json TEXT?','created_at TEXT','moderator_id TEXT?->User','moderation_reason TEXT?']),
('ListingItem','listing_items','Sản phẩm thuộc tin bán',[
 'id TEXT','listing_id TEXT->Listing','category_id TEXT->Category','name TEXT','material TEXT','condition TEXT','price_vnd INTEGER','stock INTEGER','unit TEXT']),
('MediaAsset','media_assets','Ảnh/video/tài liệu riêng tư',[
 'id TEXT','uploader_id TEXT->User','storage_key TEXT','mime_type TEXT','visibility TEXT','listing_id TEXT?->Listing','message_id TEXT?->Message','content_id TEXT?->ContentEntry','report_id TEXT?->Report','verification_id TEXT?->Verification']),
('Interaction','interactions','Tương tác, kết bạn, lịch sử và thông báo',[
 'id TEXT','user_id TEXT->User','type TEXT','listing_id TEXT?->Listing','content_id TEXT?->ContentEntry','target_user_id TEXT?->User','parent_comment_id TEXT?->Interaction','like_count INTEGER?','body TEXT?','read_at TEXT?','created_at TEXT']),
('Order','orders','Đơn mua bán; một người bán mỗi đơn',[
 'id TEXT','buyer_id TEXT->User','seller_id TEXT->User','address_id TEXT?->Address','delivery_snapshot TEXT','status TEXT','subtotal_vnd INTEGER','shipping_vnd INTEGER','total_vnd INTEGER','created_at TEXT','completed_at TEXT?']),
('OrderItem','order_items','Chốt giá & số lượng tại lúc mua',[
 'id TEXT','order_id TEXT->Order','listing_item_id TEXT->ListingItem','title_snapshot TEXT','quantity INTEGER','unit_price_vnd INTEGER']),
('Payment','payments','Lần thanh toán/hoàn tiền qua cổng',[
 'id TEXT','order_id TEXT->Order','parent_payment_id TEXT?->Payment','kind TEXT','provider TEXT','provider_ref TEXT?','idempotency_key TEXT','amount_vnd INTEGER','currency TEXT','status TEXT','created_at TEXT','confirmed_at TEXT?']),
('Conversation','conversations','Hội thoại giữa hai thành viên',[
 'id TEXT','member_a_id TEXT->User','member_b_id TEXT->User','order_id TEXT?->Order','created_at TEXT']),
('Message','messages','Tin nhắn trong hội thoại',[
 'id TEXT','conversation_id TEXT->Conversation','sender_id TEXT->User','body TEXT','content_id TEXT?->ContentEntry','content_kind TEXT?','sent_at TEXT','read_at TEXT?']),
('Review','reviews','Đánh giá sau đơn hoàn tất',[
 'id TEXT','order_id TEXT->Order','author_id TEXT->User','target_user_id TEXT->User','rating INTEGER','body TEXT','created_at TEXT']),
('Report','reports','Báo cáo hoặc tranh chấp giao dịch',[
 'id TEXT','reporter_id TEXT->User','listing_id TEXT?->Listing','content_id TEXT?->ContentEntry','target_user_id TEXT?->User','order_id TEXT?->Order','reason TEXT','status TEXT','resolver_id TEXT?->User','resolution TEXT?','created_at TEXT']),
('CollectionPoint','collection_points','Đơn vị & điểm thu gom',[
 'id TEXT','manager_id TEXT?->User','name TEXT','address TEXT','latitude REAL','longitude REAL','materials TEXT','opening_hours TEXT','status TEXT']),
('GreenLedger','green_ledger','Sổ điểm; không cộng trùng',[
 'id TEXT','user_id TEXT->User','order_id TEXT?->Order','content_id TEXT?->ContentEntry','points INTEGER','reason TEXT','dedupe_key TEXT','created_at TEXT']),
('ContentEntry','content_entries','Bài chia sẻ, mẹo hay, SCAN và nội dung cộng đồng',[
 'id TEXT','author_id TEXT->User','parent_id TEXT?->ContentEntry','kind TEXT','title TEXT','body TEXT','status TEXT','starts_at TEXT?','ends_at TEXT?','points_cost INTEGER','metadata_json TEXT']),
('AuditLog','audit_logs','Nhật ký thao tác quản trị',[
 'id TEXT','actor_id TEXT->User','action TEXT','entity_type TEXT','entity_id TEXT','reason TEXT','created_at TEXT']),
('SystemSetting','system_settings','Cấu hình và phân quyền theo vai trò',[
 'id TEXT','key TEXT','value_json TEXT','updated_by TEXT->User','updated_at TEXT']),
]

CHECKS = {
 'users': ["role IN ('MEMBER','COLLECTOR','MODERATOR','ADMIN')", "status IN ('ACTIVE','SUSPENDED')"],
 'verifications': ["status IN ('PENDING','VERIFIED','REJECTED','EXPIRED')"],
 'listings': ["kind IN ('SALE','COMMUNITY')", "status IN ('PENDING','APPROVED','REJECTED','HIDDEN','SOLD')"],
 'listing_items': ['price_vnd > 0','stock >= 0'],
 'media_assets': ["visibility IN ('PUBLIC','PRIVATE')", '(listing_id IS NOT NULL) + (message_id IS NOT NULL) + (content_id IS NOT NULL) + (report_id IS NOT NULL) + (verification_id IS NOT NULL) = 1', "verification_id IS NULL OR visibility = 'PRIVATE'"],
 'interactions': ["type IN ('LIKE','COMMENT','COMMENT_LIKE','SAVE','VIEW','SEARCH','FOLLOW','JOIN','REGISTER','FRIEND_REQUEST','NOTIFICATION','CHALLENGE_COMPLETION')"],
 'orders': ["buyer_id <> seller_id", "status IN ('PENDING_PAYMENT','PAID','SHIPPED','COMPLETED','CANCELLED','DISPUTED','REFUND_PENDING','REFUNDED')", 'subtotal_vnd > 0','shipping_vnd >= 0','total_vnd = subtotal_vnd + shipping_vnd'],
 'order_items': ['quantity > 0','unit_price_vnd > 0'],
 'payments': ["kind IN ('CHARGE','REFUND')", "provider IN ('MOMO','VNPAY')", "status IN ('PENDING','SUCCEEDED','FAILED','CANCELLED')", 'amount_vnd > 0', "currency = 'VND'", "(kind = 'CHARGE' AND parent_payment_id IS NULL) OR (kind = 'REFUND' AND parent_payment_id IS NOT NULL)"],
 'conversations': ['member_a_id <> member_b_id'],
 'messages': ["(content_id IS NULL AND content_kind IS NULL) OR (content_id IS NOT NULL AND content_kind IN ('POST','TIP'))"],
 'reviews': ['rating BETWEEN 1 AND 5','author_id <> target_user_id'],
 'reports': ["status IN ('OPEN','IN_REVIEW','RESOLVED','DISMISSED')", '(listing_id IS NOT NULL) + (content_id IS NOT NULL) + (target_user_id IS NOT NULL) + (order_id IS NOT NULL) = 1'],
 'collection_points': ['latitude BETWEEN -90 AND 90','longitude BETWEEN -180 AND 180',"status IN ('ACTIVE','INACTIVE')"],
 'green_ledger': ['points <> 0'],
 'content_entries': ["kind IN ('POST','TIP','SCAN','STORY','ARTICLE','GROUP','EVENT','CHALLENGE','REWARD','BADGE')", "status IN ('DRAFT','PUBLISHED','HIDDEN','PRIVATE','ARCHIVED')", "(kind = 'SCAN' AND status IN ('PRIVATE','ARCHIVED')) OR (kind <> 'SCAN' AND status <> 'PRIVATE')", 'points_cost >= 0'],
}
UNIQUE = {'users':['email'], 'categories':['name'], 'reviews':['order_id, author_id'], 'payments':['idempotency_key','provider, provider_ref'], 'green_ledger':['dedupe_key'], 'system_settings':['key']}

def field(raw):
    name, rawtype = raw.split(' ',1)
    target = rawtype.split('->')[1] if '->' in rawtype else None
    typ = rawtype.split('->')[0]
    return {'name':name,'type':typ.replace('?',''),'nullable':'?' in typ,'target':target}

schema = [{'name':n,'table':t,'purpose':p,'fields':[field(f) for f in fs]} for n,t,p,fs in ENTITIES]
by_name = {e['name']:e for e in schema}
(ROOT/'docs/domain-model.json').write_text(json.dumps(schema,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

def camel(name):
    return re.sub(r'_([a-z])',lambda m:m[1].upper(),name)

sql = ['-- SQLite reference schema; enforce server business transactions described in docs/architecture.md.', 'PRAGMA foreign_keys = ON;']
for entity in schema:
    columns=[]
    fields=[]
    for f in entity['fields']:
        col=f'  {f["name"]} {f["type"]}' + (' PRIMARY KEY' if f['name']=='id' else '' if f['nullable'] else ' NOT NULL')
        if f['target']: col += ' REFERENCES '+by_name[f['target']]['table']+'(id)'
        columns.append(col)
        typ = ('String' if f['type']=='TEXT' else ('Double' if f['nullable'] else 'double') if f['type']=='REAL' else ('Long' if f['nullable'] else 'long'))
        fields.append(f'    public {typ} {camel(f["name"])};')
    columns += [f'  CHECK ({c})' for c in CHECKS.get(entity['table'],[])]
    columns += [f'  UNIQUE ({c})' for c in UNIQUE.get(entity['table'],[])]
    sql.append('CREATE TABLE '+entity['table']+' (\n'+',\n'.join(columns)+'\n);')
    (JAVA/(entity['name']+'.java')).write_text('package com.example.recyclingshareapp.model;\n\n/** '+entity['purpose']+'. Generated from docs/domain-model.json; amounts are integer VND. */\npublic final class '+entity['name']+' {\n'+'\n'.join(fields)+'\n}\n',encoding='utf-8')
    for f in entity['fields']:
        if f['target']: sql.append(f'CREATE INDEX idx_{entity["table"]}_{f["name"]} ON {entity["table"]}({f["name"]});')
sql += [
"CREATE UNIQUE INDEX one_successful_charge_per_order ON payments(order_id) WHERE kind = 'CHARGE' AND status = 'SUCCEEDED';",
"CREATE UNIQUE INDEX one_pending_charge_per_order ON payments(order_id) WHERE kind = 'CHARGE' AND status = 'PENDING';",
"CREATE UNIQUE INDEX one_pending_verification_per_user ON verifications(user_id) WHERE status = 'PENDING';",
"CREATE UNIQUE INDEX one_default_address_per_user ON addresses(user_id) WHERE is_default = 1;",
"""CREATE TRIGGER verified_order_insert BEFORE INSERT ON orders BEGIN
  SELECT RAISE(ABORT, 'Both parties must be active and verified') WHERE
    (SELECT COUNT(*) FROM users u WHERE u.id IN (NEW.buyer_id, NEW.seller_id) AND u.status = 'ACTIVE'
      AND EXISTS (SELECT 1 FROM verifications v WHERE v.user_id = u.id AND v.status = 'VERIFIED'
        AND (v.expires_at IS NULL OR v.expires_at > strftime('%Y-%m-%dT%H:%M:%SZ','now')))) <> 2;
END;""",
"""CREATE TRIGGER review_completed_order BEFORE INSERT ON reviews BEGIN
  SELECT RAISE(ABORT, 'Review requires completed order and participants') WHERE NOT EXISTS
    (SELECT 1 FROM orders o WHERE o.id = NEW.order_id AND o.status = 'COMPLETED' AND
    ((o.buyer_id = NEW.author_id AND o.seller_id = NEW.target_user_id) OR
     (o.seller_id = NEW.author_id AND o.buyer_id = NEW.target_user_id)));
END;""",
"CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_logs BEGIN SELECT RAISE(ABORT, 'Append-only audit log'); END;",
"CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_logs BEGIN SELECT RAISE(ABORT, 'Append-only audit log'); END;",
"""CREATE TRIGGER scan_media_private_insert BEFORE INSERT ON media_assets BEGIN
  SELECT RAISE(ABORT, 'Scan media must be private') WHERE NEW.content_id IS NOT NULL
    AND NEW.visibility <> 'PRIVATE'
    AND EXISTS (SELECT 1 FROM content_entries WHERE id = NEW.content_id AND kind = 'SCAN');
END;""",
"""CREATE TRIGGER scan_media_private_update BEFORE UPDATE ON media_assets BEGIN
  SELECT RAISE(ABORT, 'Scan media must be private') WHERE NEW.content_id IS NOT NULL
    AND NEW.visibility <> 'PRIVATE'
    AND EXISTS (SELECT 1 FROM content_entries WHERE id = NEW.content_id AND kind = 'SCAN');
END;""",
]
(DB/'schema.sql').write_text('\n\n'.join(sql)+'\n',encoding='utf-8')

relations=[]
for e in schema:
    for f in e['fields']:
        if f['target']: relations.append((f['target'],e['name'],f['name'],f['nullable']))

class_mmd=['classDiagram','direction LR']
erd_mmd=['erDiagram']
for e in schema:
    class_mmd += ['    class '+e['name']+' {']+[f'        +{("String" if f["type"]=="TEXT" else "double" if f["type"]=="REAL" else "long")} {camel(f["name"])}' for f in e['fields']]+['    }']
    erd_mmd += ['    '+e['name']+' {']+[f'        {f["type"]} {f["name"]}'+(' PK' if f['name']=='id' else ' FK' if f['target'] else '') for f in e['fields']]+['    }']
for parent,child,label,optional in relations:
    class_mmd.append(f'    {parent} "{ "0..1" if optional else "1"}" <-- "0..*" {child} : {camel(label)}')
    erd_mmd.append(f'    {parent} {"|o" if optional else "||"}--o{{ {child} : {label}')
(OUT/'class-diagram.mmd').write_text('\n'.join(class_mmd)+'\n',encoding='utf-8')
(OUT/'erd.mmd').write_text('\n'.join(erd_mmd)+'\n',encoding='utf-8')

groups=[
 ('Tài khoản & xác minh',['Đăng ký, đăng nhập, OTP; hồ sơ, địa chỉ','Xác minh cả người mua và người bán','Admin web duyệt / từ chối / hết hạn'],['User','Verification','Address']),
 ('Trang chủ & bài chia sẻ',['Trang chủ chỉ POST đã đăng; soạn tối đa 500 ký tự','Xem đầy đủ bài và bình luận; thích đỏ, lưu vàng','Ảnh, vật liệu, cân nặng, tags; bỏ tính năng chia sẻ'],['ContentEntry','Interaction','MediaAsset']),
 ('Đơn hàng mua bán',['Kiểm tra hai bên VERIFIED, không tự mua','Chốt giá, giữ tồn kho trong transaction','Giao nhận, hoàn tất, hủy, tranh chấp'],['Order','OrderItem']),
 ('Thanh toán trung gian',['MoMo / VNPay; backend tạo phiên','Webhook chữ ký, số tiền, mã đơn, idempotency','Thử lại, đối soát, hoàn tiền qua cổng'],['Payment']),
 ('Bạn bè, chat & thông báo',['Lời mời kết bạn; chấp nhận / từ chối; tìm bạn','Thông báo thích, bình luận, kết bạn; đọc tất cả','Chat giữa hai tài khoản; tệp theo quyền'],['Conversation','Message','Interaction','MediaAsset']),
 ('Đánh giá & hỗ trợ',['Đánh giá mỗi bên một lần sau hoàn tất','Báo cáo tin / tài khoản / khiếu nại đơn','Bằng chứng, người xử lý, kết quả'],['Review','Report','MediaAsset']),
 ('Bản đồ & thu gom',['Danh sách / bản đồ điểm thu gom','Vật liệu tiếp nhận, giờ làm, vị trí','Admin web quản lý điểm & đơn vị'],['CollectionPoint']),
 ('Điểm xanh & nội dung',['Sổ điểm, huy hiệu, bảng xếp hạng','Kiến thức, nhóm, sự kiện, thử thách, thưởng','Tương tác tham gia; không cộng trùng'],['GreenLedger','ContentEntry','Interaction']),
 ('Admin web: vận hành đầy đủ',['Người dùng, phân quyền, xác minh, tin, báo cáo','Đơn hàng, thanh toán, đối soát, hoàn tiền','Danh mục, điểm thu gom, nội dung, điểm xanh'],['User','Verification','Listing','Report','Order','Payment','Category','CollectionPoint','ContentEntry','GreenLedger']),
 ('Admin web: kiểm soát hệ thống',['Cấu hình ứng dụng, chính sách & vai trò','Nhật ký quản trị, thống kê, xuất dữ liệu','Bắt buộc lý do cho thao tác nhạy cảm'],['SystemSetting','AuditLog']),
 ('Admin mobile: chức năng cơ bản',['Tổng quan chỉ số','Duyệt / từ chối bài đăng','Tiếp nhận báo cáo; việc khác qua web'],['Listing','Report','AuditLog']),
 ('Khám phá: mẹo hay & chợ đồ cũ',['Mẹo hay TIP; soạn và đọc nội dung hướng dẫn','Chợ SALE có giá, tồn kho; duyệt trước niêm yết','Đặt mua cần xác minh cả người mua và người bán'],['ContentEntry','Listing','ListingItem','Category','MediaAsset']),
 ('SCAN: ảnh lưu riêng tư',['Spark: ảnh Firestore inline tối đa 384 KiB','Chỉ chủ ảnh và ADMIN xem; MODERATOR không xem','Lịch sử SCAN; Storage là tùy chọn Blaze riêng'],['ContentEntry','MediaAsset','AuditLog']),
]
function_mmd=['flowchart TB','    root["EcoShare • Mua bán & tái sử dụng"]']
for i,(title,items,models) in enumerate(groups):
    function_mmd.append(f'    root --> g{i}["{title}"]')
    for j,item in enumerate(items): function_mmd.append(f'    g{i} --> g{i}_{j}["{item}"]')
(OUT/'function-diagram.mmd').write_text('\n'.join(function_mmd)+'\n',encoding='utf-8')

def export_diagram(filename,title,nodes,edges,width,height):
    mxfile=ET.Element('mxfile',host='app.diagrams.net',type='device')
    diagram=ET.SubElement(mxfile,'diagram',name=title,id=filename)
    graph=ET.SubElement(diagram,'mxGraphModel',dx='1200',dy='800',grid='1',gridSize='10',page='1',pageWidth=str(width),pageHeight=str(height))
    tree=ET.SubElement(graph,'root'); ET.SubElement(tree,'mxCell',id='0'); ET.SubElement(tree,'mxCell',id='1',parent='0')
    svg=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-label="{escape(title)}"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#799987"/></marker></defs><rect width="100%" height="100%" fill="#f4f8f3"/><text x="40" y="42" font-family="Arial,sans-serif" font-size="26" font-weight="bold" fill="#193d2d">{escape(title)}</text><text x="40" y="68" font-family="Arial,sans-serif" font-size="14" fill="#52675b">EcoShare v2 • 20 domain classes • INTEGER VND • Editable source: draw.io / Mermaid</text>']
    for i,(source,target,label) in enumerate(edges):
        a,b=nodes[source],nodes[target]
        cell=ET.SubElement(tree,'mxCell',id=f'edge{i}',value='',edge='1',parent='1',source=source,target=target,style='edgeStyle=orthogonalEdgeStyle;rounded=1;html=0;fontSize=10;strokeColor=#799987;endArrow=open;labelBackgroundColor=#f4f8f3;')
        geometry=ET.SubElement(cell,'mxGeometry',relative='1',attrib={'as':'geometry'})
        ax,ay=a['x']+a['w']/2,a['y']+a['h']/2
        bx,by=b['x']+b['w']/2,b['y']+b['h']/2
        if abs(ax-bx)>abs(ay-by):
            ax=a['x']+(a['w'] if bx>ax else 0); bx=b['x']+(0 if bx>ax else b['w'])
        else:
            ay=a['y']+(a['h'] if by>ay else 0); by=b['y']+(0 if by>ay else b['h'])
        if filename!='function-diagram':
            # Route through column/row gutters so relationships never cut through cards.
            ay=a['y']+55+(i%10)*26;by=b['y']+55+(i%10)*26
            ax=a['x']+a['w'];bx=b['x']
            source_lane=ax+20+(i%5)*13;target_lane=bx-18-(i%3)*12
            corridor=a['y']+a['h']+18+(i%4)*9
            points=[(source_lane,ay),(source_lane,corridor),(target_lane,corridor),(target_lane,by)]
            arr=ET.SubElement(geometry,'Array',attrib={'as':'points'})
            for px,py in points:ET.SubElement(arr,'mxPoint',x=str(px),y=str(py))
            cell.set('style',cell.get('style')+f'exitX=1;exitY={(ay-a["y"])/a["h"]};entryX=0;entryY={(by-b["y"])/b["h"]};')
            path=f'M{ax},{ay} '+ ' '.join(f'L{px},{py}' for px,py in points)+f' L{bx},{by}'
            label_x=min(source_lane,target_lane)+8;label_y=corridor-3
        else:
            path=f'M{ax},{ay} L{bx},{by}';label_x=(ax+bx)/2;label_y=(ay+by)/2-4
        svg.append(f'<path d="{path}" stroke="#799987" opacity="0.45" fill="none" marker-end="url(#arrow)"><title>{escape(label)}</title></path>')
    for key,node in nodes.items():
        value=node['title']+'\n'+'\n'.join(node['lines'])
        cell=ET.SubElement(tree,'mxCell',id=key,value=value,vertex='1',parent='1',style='rounded=1;whiteSpace=wrap;html=0;align=left;verticalAlign=top;spacing=14;fontSize=13;fillColor=#ffffff;strokeColor=#94b39d;fontFamily=Arial;')
        ET.SubElement(cell,'mxGeometry',x=str(node['x']),y=str(node['y']),width=str(node['w']),height=str(node['h']),attrib={'as':'geometry'})
        x,y,w,h=(node[k] for k in ['x','y','w','h'])
        svg += [f'<g><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="15" fill="white" stroke="#94b39d"/><rect x="{x}" y="{y}" width="{w}" height="43" rx="15" fill="#193d2d"/><text x="{x+14}" y="{y+28}" font-family="Arial,sans-serif" font-size="17" font-weight="bold" fill="white">{escape(node["title"])}</text>']
        for j,line in enumerate(node['lines']): svg.append(f'<text x="{x+14}" y="{y+65+j*22}" font-family="Arial,sans-serif" font-size="12" fill="#193d2d">{escape(line)}</text>')
        svg.append('</g>')
    svg.append('</svg>')
    ET.indent(mxfile)
    (OUT/(filename+'.drawio')).write_bytes(ET.tostring(mxfile,encoding='utf-8',xml_declaration=True))
    (OUT/(filename+'.svg')).write_text('\n'.join(svg),encoding='utf-8')

for kind in ['class-diagram','erd']:
    nodes={}
    for i,e in enumerate(schema):
        reference=lambda f: (' → '+f['target']+(' [0..1]' if f['nullable'] else ' [1]')) if f['target'] else ''
        if kind=='erd': lines=[f'{f["name"]}: {f["type"]}'+(' [PK]' if f['name']=='id' else ' [FK]' if f['target'] else '')+(' NULL' if f['nullable'] and not f['target'] else '')+reference(f) for f in e['fields']]
        else: lines=[e['purpose']]+[f'+ {camel(f["name"])}: '+('String' if f['type']=='TEXT' else 'double' if f['type']=='REAL' else 'long')+('?' if f['nullable'] else '')+reference(f) for f in e['fields']]
        nodes[e['name']]={'title':e['name']+(' / '+e['table'] if kind=='erd' else ''),'lines':lines,'x':50+(i%4)*535,'y':110+(i//4)*460,'w':415,'h':400}
    edges=[(child,parent,label+(' [0..1]' if optional else ' [1]')) for parent,child,label,optional in relations]
    export_diagram(kind, 'Class Diagram — 20 lớp nghiệp vụ' if kind=='class-diagram' else 'ERD — 20 bảng đồng bộ với Class',nodes,edges,2200,2430)
nodes={'root':{'title':'EcoShare v2 / Function','lines':['Mua bán có xác minh hai bên','Thanh toán qua MoMo / VNPay'],'x':735,'y':110,'w':530,'h':110}}
edges=[]
for i,(title,items,models) in enumerate(groups):
    lines=[]
    import textwrap
    for item in items: lines.extend(textwrap.wrap('• '+item,width=47))
    lines += ['Models:']
    lines += textwrap.wrap(', '.join(models),width=49)
    nodes['g'+str(i)]={'title':title,'lines':lines,'x':40+(i%3)*680,'y':290+(i//3)*395,'w':600,'h':335}
    edges.append(('root','g'+str(i),''))
export_diagram('function-diagram','Function Diagram — Cộng đồng, SCAN & Admin',nodes,edges,2080,320+((len(groups)+2)//3)*395)

(OUT/'README.md').write_text('''# Bộ sơ đồ EcoShare v2

Các file mới không ghi đè bản gốc. Mỗi sơ đồ có `.drawio` để chỉnh sửa bằng diagrams.net, `.svg` để mở trực tiếp/in, `.mmd` cho Mermaid và bản `.png` xuất bằng `tools/export_diagram_png.py`.

- `class-diagram`: đúng 20 lớp **nghiệp vụ**. Activity, Fragment, Repository, adapter và service hạ tầng không nằm trong giới hạn mô hình nghiệp vụ.
- `erd`: 20 bảng tương ứng 1:1 với 20 lớp; mọi khóa ngoại dùng cùng tên trường. Thuộc tính tham chiếu ghi rõ đích và [1] hoặc [0..1]; mỗi bản ghi cha có thể được 0..* bản ghi con tham chiếu. Mermaid có bội số trực tiếp trên đường quan hệ. Số [0..1] chỉ quan hệ nullable từ bản ghi con sang cha, không có nghĩa là quan hệ 1:1 toàn cục.
- `function-diagram`: thay yêu cầu trao đổi bằng mua bán, có xác minh hai bên, thanh toán, hoàn tiền và phạm vi admin.

Nguồn sinh: `tools/generate_design.py`; data dictionary: `docs/domain-model.json`; SQL tham chiếu: `database/schema.sql`.

User gộp Account/Role/Profile; Listing + ListingItem quản lý chợ đồ cũ; ContentEntry gộp POST/TIP/SCAN và nội dung biên tập; MediaAsset quản lý ảnh/tệp; Interaction gộp thích/lưu/bình luận/kết bạn/thông báo/tham gia; Order + OrderItem thay Request/Exchange/Handover; Payment quản lý thanh toán/hoàn tiền; GreenLedger quản lý điểm; AuditLog + SystemSetting dùng chung cho admin, không thêm lớp Admin riêng.
''',encoding='utf-8')
with zipfile.ZipFile(OUT/'ecoshare-diagrams-v2.zip','w',zipfile.ZIP_DEFLATED) as archive:
    for file in OUT.iterdir():
        if file.suffix in {'.drawio','.svg','.mmd','.md','.png'}: archive.write(file,file.name)
    archive.write(DB/'schema.sql','schema.sql')
    archive.write(ROOT/'docs/domain-model.json','domain-model.json')
print('Generated 20 Java domain DTOs, 20 SQL tables and 3 diagrams in draw.io/SVG/Mermaid + ZIP.')
