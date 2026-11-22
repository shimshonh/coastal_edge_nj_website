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

def golden(im):
    """Warm, late afternoon grade for the home page hero. Tone and colour only."""
    a = np.asarray(tone(im, sky=False, warm=1.0, sat=1.06)).astype(np.float32) / 255.0
    h, w = a.shape[:2]
    yy = np.linspace(0, 1, h, dtype=np.float32)[:, None]
    xx = np.linspace(0, 1, w, dtype=np.float32)[None, :]
    lum = (a @ np.array([0.299, 0.587, 0.114], dtype=np.float32))
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    sky = ((b > r * 1.08) & (b > g * 1.01) & (b > 0.40)).astype(np.float32) * np.clip((0.60 - yy) / 0.10, 0, 1)
    sky = np.asarray(Image.fromarray((sky * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(12))).astype(np.float32) / 255.0
    # 1) warm white balance, stronger in the light parts than in the shadows
    k = ((0.45 + 0.55 * lum) * (1 - 0.55 * sky))[..., None]
    a = a * (1 + k * (np.array([1.085, 1.01, 0.86], dtype=np.float32) - 1))
    # 2) sky: softer, less cold blue, with a peach glow toward the horizon
    grey = (a @ np.array([0.299, 0.587, 0.114], dtype=np.float32))[..., None]
    a = a + (grey - a) * (sky * 0.30)[..., None]
    horizon = np.clip(1 - np.abs(yy - 0.40) / 0.34, 0, 1) ** 1.5
    peach = np.array([1.0, 0.80, 0.60], dtype=np.float32)
    m = (sky * horizon * 0.42)[..., None]
    a = a * (1 - m) + (1 - (1 - a) * (1 - peach * 0.55)) * m
    # 3) low sun from the upper right (screen blend)
    d = np.sqrt(((xx - 0.92) * 1.15) ** 2 + (yy - 0.10) ** 2)
    sun = (np.clip(1 - d / 0.95, 0, 1) ** 2 * 0.26)[..., None] * np.array([1.0, 0.76, 0.48], dtype=np.float32)
    a = 1 - (1 - np.clip(a, 0, 1)) * (1 - sun)
    # 4) a little more contrast and colour so it does not look washed
    a = np.clip(a, 0, 1); a = a + 0.08 * (a - 0.5) * (1 - np.abs(2 * a - 1))
    grey = (a @ np.array([0.299, 0.587, 0.114], dtype=np.float32))[..., None]
    a = grey + (a - grey) * 1.08
    return Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8))

def save(im, name, widths=(1536, 800), q=80):
    for w in widths:
        r = im if im.width <= w else im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        r.save(os.path.join(OUT, f'{name}-{w}.webp'), 'WEBP', quality=q, method=6)
    print(name, im.size)

Z = {
 # Building photos from the 502 listing (MLS 22636606, November 2026): finished signage and storefronts.
 'hero-corner':   ('f422b016f7878d429e4072dec139777a', dict(sky=True, warm=1.015)),
 'front-wide':    ('7ad2dda0bbd229f5b32933b3ac0102e4', dict(warm=1.0, sat=1.04)),   # virtual twilight
 'front-bay':     ('97b0cb6e096eca7b83a016028235e4d2', dict(sky=True, warm=1.015)),
 'corner-street': ('6fbaf91e5324bb1d726a471081447910', dict(sky=True, warm=1.015)),
 'aerial-beach':  ('fe72cc7beab6eb4989467a795acf3dd2', dict(sky=True, warm=1.01)),
 'aerial-town':   ('b5d469f0c4251da25f0d7cbdfd831276', dict(sky=True, warm=1.015)),
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
 'render-pool': 'Frame-1102-1.png',
 'render-rec': 'Frame-1108-1.png',
 'render-conference': 'Frame-1107-1.png', 'ocean': 'frs-1.jpg', 'map': 'Frame.png',
}
for name, f in R.items():
    im = Image.open(os.path.join(SRC_SITE, f)).convert('RGB')
    save(im, name, widths=(1400, 800), q=82)
# Home page slides. The first is the listing's virtual twilight photo, already warm, so it only gets the light tone.
HERO = {'hero-1': '7ad2dda0bbd229f5b32933b3ac0102e4', 'hero-2': '97b0cb6e096eca7b83a016028235e4d2', 'hero-3': 'b5d469f0c4251da25f0d7cbdfd831276'}
for name, fid in HERO.items():
    src = Image.open(os.path.join(SRC_Z, fid + '.jpg'))
    save(tone(src, warm=1.0, sat=1.04) if name == 'hero-1' else golden(src), name)
# social share image (JPG, 1200x630) from the hero photo
im = tone(Image.open(os.path.join(SRC_Z, HERO['hero-1'] + '.jpg')), warm=1.0, sat=1.04)
w, h = im.size; th = round(w * 630 / 1200); top = (h - th) // 2
im.crop((0, top, w, top + th)).resize((1200, 630), Image.LANCZOS).save(os.path.join(OUT, 'share.jpg'), quality=84)
