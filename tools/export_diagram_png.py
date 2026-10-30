"""Render the SVG diagram exports to PNG using an installed Edge, then refresh ZIP.

Windows only, no npm/third-party Python packages. Uses a disposable local profile.
Run: python tools/export_diagram_png.py
"""
# Xuất PNG từ SVG bằng Edge. Không sửa nội dung sơ đồ.
from pathlib import Path
import argparse
import subprocess
import xml.etree.ElementTree as ET
import zipfile

root=Path(__file__).resolve().parents[1]
out=root/'Recycling Share App/diagrams-v2'
edge=Path('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')
if not edge.is_file():raise SystemExit('Microsoft Edge is required only for optional PNG exports; SVG/draw.io/Mermaid are already available.')
profile=root/'.qa/edge-diagram-profile'
profile.mkdir(parents=True,exist_ok=True)
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--only',choices=['class-diagram','erd','function-diagram'],help='Render one PNG without touching the other diagram exports.')
options=parser.parse_args()
names=[options.only] if options.only else ['class-diagram','erd','function-diagram']
for name in names:
    svg=out/(name+'.svg')
    document=ET.parse(svg).getroot()
    subprocess.run([str(edge),'--headless','--disable-gpu','--no-first-run','--hide-scrollbars',
        '--user-data-dir='+str(profile),'--window-size='+document.get('width')+','+document.get('height'),
        '--screenshot='+str(out/(name+'.png')),svg.as_uri()],check=True,
        creationflags=subprocess.CREATE_NO_WINDOW,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
with zipfile.ZipFile(out/'ecoshare-diagrams-v2.zip','w',zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(out.iterdir()):
        if file.suffix in {'.drawio','.svg','.mmd','.md','.png'}:archive.write(file,file.name)
    archive.write(root/'database/schema.sql','schema.sql')
    archive.write(root/'docs/domain-model.json','domain-model.json')
    archive.write(root/'docs/architecture.md','architecture.md')
print('Exported '+str(len(names))+' PNG diagram(s) and refreshed ZIP with current schema/dictionary/architecture.')
