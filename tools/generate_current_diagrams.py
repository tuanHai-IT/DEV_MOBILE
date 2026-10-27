"""Export the audited, current EcoShare diagrams without regenerating app or SQL code.

Run: python tools/generate_current_diagrams.py
The domain diagram comes from docs/domain-model.json; database/schema.sql is a
reference schema, while production data lives in Firestore.
"""
from __future__ import annotations

import ast
import json
import re
import subprocess
import textwrap
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "Recycling Share App" / "diagrams-current"
OUT.mkdir(parents=True, exist_ok=True)
DOMAIN = json.loads((ROOT / "docs/domain-model.json").read_text(encoding="utf-8"))
# Show only entities with a live Android or Admin Web flow. The backend source
# schema remains the 20-entity superset documented separately.
APP_ENTITY_NAMES = {
    "User", "Verification", "Address", "Category", "Listing", "ListingItem",
    "MediaAsset", "Interaction", "Order", "OrderItem", "Payment", "Conversation",
    "Message", "Report", "GreenLedger", "ContentEntry", "AuditLog", "SystemSetting",
}
APP_DOMAIN = [entity for entity in DOMAIN if entity["name"] in APP_ENTITY_NAMES]
assert len(APP_DOMAIN) == 18, "Update the app diagram entity scope deliberately."


def camel(name: str) -> str:
    return re.sub(r"_([a-z])", lambda match: match[1].upper(), name)


def java_type(field: dict) -> str:
    return {"TEXT": "String", "INTEGER": "Long" if field["nullable"] else "long",
            "REAL": "Double" if field["nullable"] else "double"}[field["type"]]


# Reuse only the reviewed export function. Importing generate_design.py itself
# would rewrite the hand-maintained SQL, DTOs and older diagrams as a side effect.
tree = ast.parse((ROOT / "tools/generate_design.py").read_text(encoding="utf-8"))
export_node = next(node for node in tree.body if isinstance(node, ast.FunctionDef)
                   and node.name == "export_diagram")
scope = {"ET": ET, "escape": escape, "OUT": OUT}
exec(compile(ast.Module(body=[export_node], type_ignores=[]),
             "<diagram-export-only>", "exec"), scope)


def export(name: str, title: str, nodes: dict, edges: list, width: int, height: int) -> None:
    scope["export_diagram"](name, title, nodes, edges, width, height)
    svg = OUT / (name + ".svg")
    svg.write_text(svg.read_text(encoding="utf-8").replace(
        "EcoShare v2 • 20 domain classes • INTEGER VND • Editable source: draw.io / Mermaid",
        "EcoShare • cập nhật chức năng 27/10/2026 • sửa bằng draw.io / Mermaid"), encoding="utf-8")
    if name == "function-diagram":
        ET.register_namespace("", "http://www.w3.org/2000/svg")
        drawing = ET.parse(svg)
        svg_ns = "{http://www.w3.org/2000/svg}"
        for card in drawing.getroot().findall(svg_ns + "g"):
            titles = card.findall(svg_ns + "text")
            headers = card.findall(svg_ns + "rect")
            if not titles or len(headers) < 2:
                continue
            title_text = titles[0].text or ""
            if title_text.startswith("DEMO"):
                headers[1].set("fill", "#a66b13")
            elif title_text.startswith("CHƯA") or title_text.startswith("BACKEND-ONLY"):
                headers[1].set("fill", "#62736c")
        drawing.write(svg, encoding="utf-8", xml_declaration=True)


relations = [(field["target"], entity["name"], field["name"], field["nullable"])
             for entity in APP_DOMAIN for field in entity["fields"]
             if field["target"] and field["target"] in APP_ENTITY_NAMES]
class_lines = ["classDiagram", "direction LR"]
erd_lines = ["erDiagram"]
for entity in APP_DOMAIN:
    name = entity["name"]
    class_lines.extend([f"    class {name} {{"] + [
        f'        +{java_type(field)} {camel(field["name"])}'
        for field in entity["fields"]] + ["    }"])
    erd_lines.extend([f"    {name} {{"] + [
        f'        {field["type"]} {field["name"]}' +
        (" PK" if field["name"] == "id" else " FK" if field["target"] else "")
        for field in entity["fields"]] + ["    }"])
for parent, child, field, optional in relations:
    class_lines.append(f'    {parent} "{ "0..1" if optional else "1"}" <-- "0..*" {child} : {camel(field)}')
    erd_lines.append(f'    {parent} {"|o" if optional else "||"}--o{{ {child} : {field}')
(OUT / "class-diagram.mmd").write_text("\n".join(class_lines) + "\n", encoding="utf-8")
(OUT / "erd.mmd").write_text("\n".join(erd_lines) + "\n", encoding="utf-8")

for kind, title in (("class-diagram", "Class Diagram — 18 thực thể app"),
                    ("erd", "ERD logic — 18 thực thể app")):
    nodes = {}
    for index, entity in enumerate(APP_DOMAIN):
        name = entity["name"]
        lines = ([entity["purpose"]] if kind == "class-diagram" else [])
        for field in entity["fields"]:
            reference = (f' → {field["target"]}' + (" [0..1]" if field["nullable"] else " [1]")) if field["target"] else ""
            if kind == "class-diagram":
                lines.append(f'+ {camel(field["name"])}: {java_type(field)}{reference}')
            else:
                suffix = " [PK]" if field["name"] == "id" else " [FK]" if field["target"] else " NULL" if field["nullable"] else ""
                lines.append(f'{field["name"]}: {field["type"]}{suffix}{reference}')
        nodes[name] = {"title": name + (" / " + entity["table"] if kind == "erd" else ""),
                       "lines": lines, "x": 45 + (index % 4) * 540,
                       "y": 110 + (index // 4) * 475, "w": 450, "h": 425}
    edges = [(child, parent, field + (" [0..1]" if optional else " [1]"))
             for parent, child, field, optional in relations]
    export(kind, title, nodes, edges, 2200, 2510)

# These are the actual Android host, fragment, transport and local-store classes.
# The 20 DTOs above are data containers, not the controllers of these flows.
runtime = {
    "MainActivity": ["Host điều hướng native", "show(destination, addHistory)", "bindActions(view)"],
    "CommunityFragment": ["Luồng giao diện nối API", "go(screen, id, focus)", "selectExploreTab(tab)", "payoutAccount() / listingComposer()", "POST, TIP, chat, chợ, hồ sơ"],
    "ScreenFragment": ["Host các màn Android phụ", "onCreateView(inflater)", "Nhận xử lý tương tác từ MainActivity"],
    "FirebaseBackendClient": ["REST + Firebase Auth", "request / requestFresh", "uploadMedia / downloadMedia"],
    "BackendSession": ["Phiên và hồ sơ đăng nhập", "get(context) / profile()"],
    "SessionVault": ["Lưu phiên cục bộ", "Nội bộ data.remote"],
    "OfflineSnapshotStore": ["SQLite công khai chỉ đọc", "Nội bộ data.remote"],
    "DemoRepository": ["SharedPreferences", "Tuỳ chọn cục bộ và kết quả thanh toán demo"],
    "TradeRules": ["Ràng buộc luồng giao dịch", "Bổ sung validation phía server"],
    "BackendEndpointPolicy": ["Chọn endpoint API", "Spark debug / HTTPS release"],
    "PhotoUploadEncoder": ["Nén/chuẩn hóa ảnh cho Firestore Spark", "forFirestore(bytes)"],
}
runtime_edges = [
    ("MainActivity", "CommunityFragment", "điều hướng"),
    ("MainActivity", "ScreenFragment", "điều hướng"),
    ("MainActivity", "DemoRepository", "trạng thái cục bộ"),
    ("MainActivity", "BackendSession", "phiên"),
    ("CommunityFragment", "FirebaseBackendClient", "gọi API"),
    ("CommunityFragment", "BackendSession", "hồ sơ"),
    ("CommunityFragment", "PhotoUploadEncoder", "chuẩn hóa ảnh"),
    ("BackendSession", "FirebaseBackendClient", "quản lý phiên"),
    ("FirebaseBackendClient", "SessionVault", "lưu token"),
    ("FirebaseBackendClient", "OfflineSnapshotStore", "cache công khai"),
    ("FirebaseBackendClient", "BackendEndpointPolicy", "endpoint"),
    ("ScreenFragment", "MainActivity", "host"),
    ("MainActivity", "TradeRules", "luồng giao dịch"),
]
runtime_mmd = ["classDiagram", "direction LR"]
runtime_methods = {
    "MainActivity": ["-show(destination, addHistory)", "-bindActions(view)"],
    "CommunityFragment": ["+onCreateView(inflater, container, state)", "+selectExploreTab(tab)", "-go(screen, id, focus)", "-payoutAccount()", "-listingComposer()"],
    "ScreenFragment": ["+onCreateView(inflater, container, state)"],
    "FirebaseBackendClient": ["+request(method, path, body, idempotencyKey, callback)", "+uploadMedia(parentKind, parentId, mime, bytes, callback)", "+downloadMedia(id, callback)"],
    "BackendSession": ["+get(context)", "+profile()"],
    "DemoRepository": ["+get(key, fallback)", "+put(key, value)"],
    "TradeRules": ["+requireStatus(status, expected)"],
    "PhotoUploadEncoder": ["+forFirestore(bytes)"],
}
for name in runtime:
    runtime_mmd.extend([f"    class {name} {{"] +
                       [f"        {item}" for item in runtime_methods.get(name, [])] + ["    }"])
runtime_mmd.extend(f"    {source} --> {target} : {label}"
                   for source, target, label in runtime_edges)
(OUT / "runtime-class-diagram.mmd").write_text("\n".join(runtime_mmd) + "\n", encoding="utf-8")
runtime_nodes = {name: {"title": name, "lines": items,
                        "x": 45 + (index % 3) * 650,
                        "y": 110 + (index // 3) * 260, "w": 550, "h": 205}
                 for index, (name, items) in enumerate(runtime.items())}
export("runtime-class-diagram", "Class Diagram — lớp Android chính",
       runtime_nodes, runtime_edges, 1990, 1480)

# This diagram is limited to user/admin features present in the current UI.
# Payment is shown as a device-only demo; it is not a backend Payment entity.
groups = [
    ("Tài khoản", ["Đăng nhập email/mật khẩu và khôi phục mật khẩu", "Hồ sơ, ảnh đại diện/ảnh bìa, địa chỉ và xác minh", "Khai báo tài khoản nhận tiền ngân hàng hoặc MoMo", "Đăng nhập Google"]),
    ("Cộng đồng", ["Bài chia sẻ và mẹo hay: tạo, sửa, đọc", "Thích, lưu, bình luận và trả lời", "Story ảnh/video; báo cáo nội dung"]),
    ("Khám phá", ["Tìm kiếm bài viết, mẹo hay và tin bán", "Thử thách và cộng điểm Eco", "Duyệt tin bán trước khi hiện công khai"]),
    ("Mua bán", ["Khai báo tài khoản nhận tiền trước khi đăng/gửi lại tin bán", "Tạo/sửa tin bán, giá và tồn kho", "Đơn mua và kiểm tra xác minh hai bên", "Danh sách và chi tiết đơn hàng"]),
    ("DEMO · Thanh toán", ["Chọn MoMo hoặc VNPay trong app", "Lưu kết quả demo trên thiết bị", "Không chuyển tiền thật"]),
    ("Bạn bè và thông báo", ["Tìm bạn, gửi và xử lý lời mời", "Xem thông báo và đánh dấu đã đọc", "Chia sẻ bài viết qua tin nhắn"]),
    ("Tin nhắn", ["Hội thoại 1-1 và tin nhắn chờ", "Gửi tin nhắn chữ, ảnh và bài viết", "Tải lịch sử tin nhắn theo trang"]),
    ("SCAN", ["Chụp hoặc chọn ảnh sản phẩm", "Lưu lịch sử quét riêng tư", "Đọc ảnh qua API có kiểm tra quyền"]),
    ("Điểm Eco", ["Xem điểm và thanh tiến trình hồ sơ", "Hoàn tất thử thách để nhận điểm"]),
    ("Admin Web", ["Quản lý người dùng, nội dung, tin bán, đơn hàng và giao dịch", "Đối soát thanh toán; xử lý xác minh và báo cáo", "Thống kê, cấu hình, sổ điểm, hoàn tiền và xuất CSV"]),
    ("Admin mobile", ["Xem tổng quan quản trị", "Duyệt hoặc từ chối tin bán", "Xử lý báo cáo kèm lý do"]),
]
function_mmd = ["flowchart TB", '    root["EcoShare • chức năng có trên app / Admin Web"]']
function_nodes = {"root": {"title": "EcoShare / Function", "lines": [
    "Các luồng có giao diện sử dụng trong Android và Admin Web"],
    "x": 765, "y": 100, "w": 590, "h": 105}}
function_edges = []
for index, (title, items) in enumerate(groups):
    key = f"g{index}"
    function_mmd.append(f'    root --> {key}["{title}"]')
    for child, item in enumerate(items):
        function_mmd.append(f'    {key} --> {key}_{child}["{item}"]')
    card_lines = []
    for item in items:
        card_lines.extend(textwrap.wrap("• " + item, width=67))
    function_nodes[key] = {"title": title, "lines": card_lines,
                           "x": 40 + (index % 3) * 700,
                           "y": 245 + (index // 3) * 235,
                           "w": 620, "h": 170}
    function_edges.append(("root", key, ""))
function_mmd.extend([
    "    classDef live fill:#e5f6ee,stroke:#2b8b63,color:#123e2d",
    "    classDef demo fill:#fff1d8,stroke:#d5911d,color:#5b3a08",
    "    class " + ",".join(f"g{i}" for i in range(len(groups)) if i != 4) + " live",
    "    class g4 demo",
])
(OUT / "function-diagram.mmd").write_text("\n".join(function_mmd) + "\n", encoding="utf-8")
export("function-diagram", "Function Diagram — tính năng trên app",
       function_nodes, function_edges, 2160, 1155)

README = """# Sơ đồ EcoShare — phạm vi tính năng trên app (27/10/2026)

- `class-diagram`: 18 thực thể có luồng giao diện đang dùng trong Android/Admin Web, cùng thuộc tính và quan hệ.
- `runtime-class-diagram`: các lớp Java chính điều khiển luồng Android; sơ đồ này mô tả cấu trúc chạy, không phải danh sách tính năng.
- `erd`: ERD logic phạm vi app gồm 18 thực thể. `Review` và `CollectionPoint` chỉ có model/API, không có luồng giao diện tương ứng nên được lược khỏi hai sơ đồ dữ liệu. `Payment` được giữ vì Admin Web có trang quản lý/đối soát giao dịch.
- `function-diagram`: các tính năng có giao diện đang sử dụng trên Android/Admin Web. Thanh toán MoMo/VNPay được ghi rõ là demo lưu trên thiết bị, không chuyển tiền thật.

Các file `.mmd`, `.drawio`, `.svg` và `.png` lần lượt là nguồn Mermaid, bản chỉnh diagrams.net, bản xem/in và ảnh raster. ZIP chứa cả bộ cùng tài liệu đối chiếu. Sinh lại bằng `python tools/generate_current_diagrams.py` sau khi thay đổi mô hình hoặc phạm vi tính năng.

Sơ đồ dữ liệu là mô hình logic; Firestore là nguồn dữ liệu vận hành và `database/schema.sql` là schema SQLite tham chiếu. `docs/domain-model.json` cùng `docs/firestore-physical-map.md` tiếp tục mô tả đủ 20 mô hình/collection backend, kể cả hai mục đã lược khỏi sơ đồ phạm vi app. Thanh toán trong Android chỉ lưu kết quả demo trên thiết bị; không tạo giao dịch thật. Xem `docs/system-audit-2026-10-23.md` để biết căn cứ phân loại giao diện.

Khai báo nhận tiền bổ sung ngày 27/10 được lưu trong trường riêng tư `users._payout_account`, ngoài projection DTO/SQL. Function Diagram đã ghi điều kiện bắt buộc khai báo trước khi đăng/gửi lại tin bán; xem `payout-account.md` trong ZIP hoặc `docs/payout-account.md` của repo.
"""
(OUT / "README.md").write_text(README, encoding="utf-8")

edge = Path("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe")
if edge.is_file():
    for name in ("class-diagram", "runtime-class-diagram", "erd", "function-diagram"):
        svg = OUT / (name + ".svg")
        document = ET.parse(svg).getroot()
        profile = ROOT / ".qa" / ("edge-diagrams-current-" + name)
        profile.mkdir(parents=True, exist_ok=True)
        subprocess.run([str(edge), "--headless", "--disable-gpu", "--no-first-run",
                        "--hide-scrollbars", "--user-data-dir=" + str(profile),
                        "--window-size=" + document.get("width") + "," + document.get("height"),
                        "--screenshot=" + str(OUT / (name + ".png")), svg.as_uri()],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=90)
with zipfile.ZipFile(OUT / "ecoshare-diagrams-current.zip", "w", zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(OUT.iterdir()):
        if path.suffix in {".drawio", ".svg", ".mmd", ".md", ".png"}:
            archive.write(path, path.name)
    archive.write(ROOT / "docs/domain-model.json", "domain-model.json")
    archive.write(ROOT / "database/schema.sql", "schema.sql")
    audit = ROOT / "docs/system-audit-2026-10-23.md"
    if audit.is_file():
        archive.write(audit, "system-audit.md")
    physical = ROOT / "docs/firestore-physical-map.md"
    if physical.is_file():
        archive.write(physical, "firestore-physical-map.md")
    payout = ROOT / "docs/payout-account.md"
    if payout.is_file():
        archive.write(payout, "payout-account.md")
        for preview in (ROOT / "docs/previews/payout-account").glob("*.png"):
            archive.write(preview, "previews/payout-account/" + preview.name)
print("Generated current domain/runtime Class, ERD and Function diagrams.")
