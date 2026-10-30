"""Refresh only Function artifacts from their generator definitions, never DTO/SQL/Class/ERD.

Run: python tools/update_social_diagrams.py
Then: python tools/export_diagram_png.py --only function-diagram
"""
# Chỉ làm mới sơ đồ chức năng, không đụng DTO hay schema.
from pathlib import Path
from hashlib import sha256
import ast
import textwrap
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape

root=Path(__file__).resolve().parents[1]
out=root/'Recycling Share App/diagrams-v2'
protected=[root/'database/schema.sql',root/'docs/domain-model.json']
protected+=list((root/'app/src/main/java/com/example/recyclingshareapp/model').glob('*.java'))
protected+=[out/(name+suffix) for name in ['class-diagram','erd'] for suffix in ['.drawio','.svg','.mmd','.png']]
before={path:sha256(path.read_bytes()).hexdigest() for path in protected}
tree=ast.parse((root/'tools/generate_design.py').read_text(encoding='utf-8'))
groups_node=next(node for node in tree.body if isinstance(node,ast.Assign) and any(isinstance(target,ast.Name) and target.id=='groups' for target in node.targets))
groups=ast.literal_eval(groups_node.value)
export_node=next(node for node in tree.body if isinstance(node,ast.FunctionDef) and node.name=='export_diagram')
# Execute one reviewed function definition, never import the side-effectful generator.
scope={'ET':ET,'escape':escape,'OUT':out}
exec(compile(ast.Module(body=[export_node],type_ignores=[]),'<diagram-export-only>','exec'),scope)
lines=['flowchart TB','    root["EcoShare • Cộng đồng, mua bán & SCAN"]']
nodes={'root':{'title':'EcoShare / Function','lines':['Trang chủ POST • Khám phá TIP / Chợ đồ cũ','SCAN riêng tư • Mua bán xác minh hai bên'],'x':735,'y':110,'w':650,'h':110}}
edges=[]
for i,(title,items,models) in enumerate(groups):
    lines.append(f'    root --> g{i}["{title}"]')
    contents=[]
    for j,item in enumerate(items):
        lines.append(f'    g{i} --> g{i}_{j}["{item}"]')
        contents+=textwrap.wrap('• '+item,width=62)
    contents+=['Models:']+textwrap.wrap(', '.join(models),width=65)
    nodes['g'+str(i)]={'title':title,'lines':contents,'x':40+(i%3)*680,'y':290+(i//3)*395,'w':600,'h':335}
    edges.append(('root','g'+str(i),''))
(out/'function-diagram.mmd').write_text('\n'.join(lines)+'\n',encoding='utf-8')
scope['export_diagram']('function-diagram','Function Diagram — Cộng đồng, SCAN & Admin',nodes,edges,2080,320+((len(groups)+2)//3)*395)
for path,digest in before.items():
    assert sha256(path.read_bytes()).hexdigest()==digest,f'Protected artifact changed: {path}'
print('Updated Function Mermaid/draw.io/SVG; protected Class, ERD, 20 DTOs, SQL and dictionary unchanged.')
