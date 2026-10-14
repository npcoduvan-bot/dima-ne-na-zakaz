"""Release gate: reject missing/empty/corrupt photos before packaging."""
from pathlib import Path
from PIL import Image
from fontTools.ttLib import TTFont
import json,re,subprocess
root=Path(__file__).resolve().parents[1]; dist=root/'dist'
photos=json.loads((dist/'photos.js').read_text(encoding='utf-8').split('=',1)[1].strip().rstrip(';'))
assert len(photos)==186
assert len({p['id'] for p in photos})==len(photos)
assert len({p['displayNumber'] for p in photos})==len(photos)
removed=json.loads((root/'scripts/removed-photos.json').read_text(encoding='utf-8-sig'))
assert not ({p['displayNumber'] for p in photos}&set(removed['reservedDisplayNumbers']))
assert {73,122,126,137,142,168}<={p['displayNumber'] for p in photos}
paths=set()
for p in photos:
 assert p['displayNumber']==p['id']+1 # frozen legacy mapping, not used at runtime
 assert p['title'] and p['category']
 for key in ['src','thumbnail','fullImage']:paths.add(p[key])
 for variant in p['srcSet'].split(', '):paths.add(variant.rsplit(' ',1)[0])
 with Image.open(dist/p['src']) as im:
  im.load();assert im.size==(p['width'],p['height'])
for name in ['index.html','style.css']:
 for path in re.findall(r'(?:src=["\']|url\(["\']?)(assets/[^"\')]+)',(dist/name).read_text(encoding='utf-8')):paths.add(path)
for path in paths:
 f=dist/path;assert f.is_file() and f.stat().st_size>0,path
 if f.suffix in ['.jpg','.webp','.png']:
  with Image.open(f) as im:im.load()
for p in removed['removed']:assert not (dist/p['src']).exists()
font=TTFont(dist/'assets/geologica.woff');assert all(ord(c) in font.getBestCmap() for c in 'НЕ НА ЗАКАЗНУ ВОТ ФОТКИМЕНЯ ЗОВУТ ДИМА')
assert any(n.toUnicode()=='Geologica' for n in font['name'].names)
print(f'PASS: {len(photos)} stable photo records, {len(paths)} local assets decoded/validated, all six restored; eight removals absent; Geologica Cyrillic present.')
