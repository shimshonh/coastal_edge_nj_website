"""Prepare photos for the site: gentle tone work, then WebP at two widths."""
import sys, os
import numpy as np
from PIL import Image, ImageFilter

SRC_Z = sys.argv[1]      # listing photos
SRC_SITE = sys.argv[2]   # current-site images
OUT = sys.argv[3]

def tone(im, sky=False, warm=1.0, sat=1.12, lift=0.0):
    a = np.asarray(im.convert('RGB')).astype(np.float32) / 255.0
    # mild levels stretch on luminance percentiles
    lum = a @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    lo, hi = np.percentile(lum, [0.6, 99.6])
    lo = min(lo, 0.06); hi = max(hi, 0.94)
    a = np.clip((a - lo) / (hi - lo), 0, 1)
    if sky:
        r, g, b = a[..., 0], a[..., 1], a[..., 2]
        h = a.shape[0]
        yy = np.linspace(0, 1, h, dtype=np.float32)[:, None]
        m = ((b > r * 1.10) & (b > g * 1.02) & (b > 0.42)).astype(np.float32)
        m *= np.clip((0.62 - yy) / 0.12, 0, 1)          # only the upper part of the frame
        mi = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(9))
        m = np.asarray(mi).astype(np.float32) / 255.0
        depth = (1 - yy / 0.62).clip(0, 1) * 0.5 + 0.5    # deeper toward the top
        k = (m * depth)[..., None]
        deep = a * np.array([0.80, 0.90, 1.02], dtype=np.float32)
        a = a * (1 - k * 0.55) + deep * (k * 0.55)
    # warmth outside of sky
    a[..., 0] *= warm; a[..., 2] *= (2 - warm)
    # soft S curve
    a = np.clip(a, 0, 1)
    a = a + 0.10 * (a - 0.5) * (1 - np.abs(2 * a - 1))
    if lift: a = a + lift * (1 - a) * a * 2
    # saturation (vibrance style: boost muted colours more)
    lum = (a @ np.array([0.299, 0.587, 0.114], dtype=np.float32))[..., None]
    chroma = np.abs(a - lum).max(axis=2, keepdims=True)
    s = 1 + (sat - 1) * (1 - np.clip(chroma * 2.2, 0, 1))
    a = lum + (a - lum) * s
    out = Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8))
    return out.filter(ImageFilter.UnsharpMask(radius=1.4, percent=55, threshold=2))

def save(im, name, widths=(1536, 800), q=80):
    for w in widths:
        r = im if im.width <= w else im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        r.save(os.path.join(OUT, f'{name}-{w}.webp'), 'WEBP', quality=q, method=6)
    print(name, im.size)

Z = {
 'hero-corner':   ('3a49d25fd215ad2526e0e54b259104b7', dict(sky=True, warm=1.015)),
 'front-wide':    ('ea5fec8c50afb979b0dea5d29d909acd', dict(sky=True, warm=1.015)),
 'front-bay':     ('bdf06378eeaef8585bd6f98b4a57899a', dict(sky=True, warm=1.01)),
 'corner-bay':    ('0efde532a0440158f444e5341da0c305', dict(sky=True, warm=1.01)),
 'corner-street': ('6fbaf91e5324bb1d726a471081447910', dict(sky=True, warm=1.015)),
 'aerial-beach':  ('fe72cc7beab6eb4989467a795acf3dd2', dict(sky=True, warm=1.01)),
 'aerial-town':   ('b5d469f0c4251da25f0d7cbdfd831276', dict(sky=True, warm=1.015)),
 'beach-path':    ('f7f9022aca3532a41588b6001e2e821f', dict(sky=True, warm=1.02)),
 'kitchen':       ('b928d4a0be167ecc6768628e45dd4392', dict(warm=1.012, sat=1.08, lift=0.04)),
 'pendant':       ('0671fe02170f6eaf80c777bc1b0b3b6d', dict(warm=1.012, sat=1.06, lift=0.03)),
 'lobby':         ('61de4c60817efdd34cd1208bf0ad0027', dict(warm=1.012, sat=1.08, lift=0.04)),
 'living-1':      ('db4f86fa7eb4ff583454015784c9e2ae', dict(warm=1.012, sat=1.08, lift=0.04)),
 'living-2':      ('7f3bfc39f23e90b598bbc29a27d5d37e', dict(warm=1.012, sat=1.08, lift=0.04)),
 'living-3':      ('2e8eef88e6c5b9adaf6e39462a09c1f8', dict(warm=1.012, sat=1.08, lift=0.04)),
}
for name, (fid, kw) in Z.items():
    save(tone(Image.open(os.path.join(SRC_Z, fid + '.jpg')), **kw), name)

R = {  # artist renderings carried over from the current site (amenity spaces)
 'render-pool': 'Frame-1102-1.png', 'render-rooftop': 'Frame-1102-2-1.png',
 'render-rooftop-aerial': 'Frame-1108-2-1.png', 'render-rec': 'Frame-1108-1.png',
 'render-conference': 'Frame-1107-1.png', 'ocean': 'frs-1.jpg', 'map': 'Frame.png',
}
for name, f in R.items():
    im = Image.open(os.path.join(SRC_SITE, f)).convert('RGB')
    save(im, name, widths=(1400, 800), q=82)
# social share image (JPG, 1200x630) from the hero photo
im = tone(Image.open(os.path.join(SRC_Z, Z['hero-corner'][0] + '.jpg')), sky=True, warm=1.015)
w, h = im.size; th = round(w * 630 / 1200); top = (h - th) // 2
im.crop((0, top, w, top + th)).resize((1200, 630), Image.LANCZOS).save(os.path.join(OUT, 'share.jpg'), quality=84)
