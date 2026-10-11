"""Test photos for tools/test_inv8.mjs, made fresh by tools/run_tests.sh: a dark part on a light, slightly grainy background, like a
phone photo of a part on the counter. Landscape and portrait JPEGs and a PNG, so the uploads and the photo AI see the usual cases.
  python3 tools/test_photos.py <folder>"""
import os, random, sys
from PIL import Image, ImageDraw

out = sys.argv[1]
os.makedirs(out, exist_ok=True)
SPECS = [('front.jpg', 3000, 2250, (200, 214, 222)), ('back.jpg', 3000, 2250, (222, 214, 200)), ('label.jpg', 2250, 3000, (214, 222, 200)),
         ('closeup.jpg', 2000, 1500, (205, 205, 215)), ('extra.png', 1200, 900, (225, 215, 215))] + \
        [(f'w{i}.jpg', 1600, 1200, (200 + i * 4, 215, 222 - i * 3)) for i in range(6)]
for n, (name, W, H, bg) in enumerate(SPECS):
    rnd = random.Random(n)
    im = Image.new('RGB', (W, H), bg)
    px = im.load()
    for _ in range(W * H // 40):   # grain
        x, y, v = rnd.randrange(W), rnd.randrange(H), rnd.randint(-12, 12)
        px[x, y] = tuple(max(0, min(255, a + v)) for a in bg)
    d = ImageDraw.Draw(im)
    cx, cy, r, ink = W // 2, H // 2, min(W, H) * 0.3, (40, 50, 62)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=ink)
    d.ellipse([cx - r * 0.45, cy - r * 0.4, cx + r * 0.45, cy + r * 0.4], fill=bg)
    d.rectangle([cx + r * 0.95, cy - r * 0.17, min(cx + r * 1.9, W - 40), cy + r * 0.17], fill=ink)
    d.text((20, 20), name.split('.')[0], fill=(0, 0, 0))
    f = os.path.join(out, name)
    im.save(f, quality=92) if name.endswith('.jpg') else im.save(f)
print('test photos in', out)
