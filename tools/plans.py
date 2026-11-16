"""Floor plan images and lighter PDFs from the original plan sheets."""
import sys, os, subprocess, tempfile
import numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
SRC, OUT_IMG, OUT_DOC = sys.argv[1:4]

def trim(im, pad=40):
    g = np.asarray(im.convert('L'))
    ys, xs = np.where(g < 235)
    if len(xs) == 0: return im
    b = (max(xs.min() - pad, 0), max(ys.min() - pad, 0), min(xs.max() + pad, im.width), min(ys.max() + pad, im.height))
    return im.crop(b)

def render(pdf, dpi, tmp):
    subprocess.run(['pdftoppm', '-r', str(dpi), '-jpeg', '-jpegopt', 'quality=88', pdf, os.path.join(tmp, 'p')], check=True)
    return [Image.open(os.path.join(tmp, f)).convert('RGB') for f in sorted(os.listdir(tmp))]

for n in range(1, 11):
    pdf = os.path.join(SRC, f'Coastal_Edge_Unit_{n}.pdf')
    with tempfile.TemporaryDirectory() as tmp:
        pages = render(pdf, 100, tmp)
        W, H = pages[0].size
        # page 1: the plan drawing, without the sheet border, title block and stats table
        plan = trim(pages[0].crop((int(W * .02), int(H * .03), int(W * .915), int(H * .905))))
        for w in (1800, 900):
            r = plan if plan.width <= w else plan.resize((w, round(plan.height * w / plan.width)), Image.LANCZOS)
            r.save(os.path.join(OUT_IMG, f'plan-{n}-{w}.webp'), 'WEBP', quality=84, method=6)
        for i, pg in enumerate(pages[1:4], 1):
            v = trim(pg.crop((int(W * .016), int(H * .024), int(W * .915), int(H * .945))), pad=20)
            v.thumbnail((1400, 1400), Image.LANCZOS)
            v.save(os.path.join(OUT_IMG, f'plan-{n}-3d-{i}.webp'), 'WEBP', quality=78, method=6)
        # lighter PDF for download (full sheets, 4 pages)
        small = [p.resize((p.width * 9 // 10, p.height * 9 // 10), Image.LANCZOS) for p in pages]
        small[0].save(os.path.join(OUT_DOC, f'coastal-edge-floor-plan-{n}.pdf'), save_all=True, append_images=small[1:], quality=72, resolution=90)
        print(n, plan.size, os.path.getsize(os.path.join(OUT_DOC, f'coastal-edge-floor-plan-{n}.pdf')) // 1024, 'KB')

with tempfile.TemporaryDirectory() as tmp:
    pages = render(os.path.join(SRC, 'CE-Book-2024-R3.pdf'), 110, tmp)
    print('brochure pages', len(pages), pages[0].size)
    pages[0].save(os.path.join(OUT_DOC, 'coastal-edge-brochure.pdf'), save_all=True, append_images=pages[1:], quality=78, resolution=110)
    print('brochure', os.path.getsize(os.path.join(OUT_DOC, 'coastal-edge-brochure.pdf')) // 1024, 'KB')
    c = pages[0].copy(); c.thumbnail((900, 900)); c.save(os.path.join(OUT_IMG, 'brochure-cover.webp'), 'WEBP', quality=82)
    for i in (1, 2, 3):
        c = pages[i].copy(); c.thumbnail((700, 700)); c.save(os.path.join(OUT_IMG, f'brochure-p{i+1}.webp'), 'WEBP', quality=78)
