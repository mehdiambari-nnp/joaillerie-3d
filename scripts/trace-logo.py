# Vectorise un logo noir sur blanc (JPG/PNG) en SVG monochrome (currentColor), recadré.
# usage : python3 trace-logo.py entrée.jpg sortie.svg
import sys, potrace
from PIL import Image
import numpy as np
src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('L')
a = np.array(im) < 128
ys, xs = np.where(a)
x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
a = a[y0:y1, x0:x1]
pad = 2
a = np.pad(a, pad)
bm = potrace.Bitmap(~a)
pl = bm.trace(turdsize=6, alphamax=1.0, opttolerance=0.4)
d = []
for c in pl:
    s = c.start_point
    d.append(f'M{s.x:.1f} {s.y:.1f}')
    for seg in c.segments:
        if seg.is_corner:
            d.append(f'L{seg.c.x:.1f} {seg.c.y:.1f}L{seg.end_point.x:.1f} {seg.end_point.y:.1f}')
        else:
            d.append(f'C{seg.c1.x:.1f} {seg.c1.y:.1f} {seg.c2.x:.1f} {seg.c2.y:.1f} {seg.end_point.x:.1f} {seg.end_point.y:.1f}')
    d.append('Z')
h, w = a.shape
open(dst, 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}"><path fill="currentColor" fill-rule="evenodd" d="{"".join(d)}"/></svg>')
print(dst, w, h)
