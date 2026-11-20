#!/usr/bin/env python3
"""Builds the static site into dist/ and the facts file used by the chat assistant."""
import json, os, shutil, datetime, hashlib
from jinja2 import Environment, FileSystemLoader, select_autoescape
from markupsafe import Markup
from PIL import Image
import sitedata as D

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC, DIST = os.path.join(ROOT, "src"), os.path.join(ROOT, "dist")
S = D.SITE

def money(v): return "${:,.0f}".format(v)
def num(v): return "{:,}".format(v)

# image registry: name -> sizes on disk
IMG = {}
for folder in ("photos", "plans"):
    for f in sorted(os.listdir(os.path.join(SRC, "static/img", folder))):
        if not f.endswith(".webp"): continue
        stem = f[:-5]
        with Image.open(os.path.join(SRC, "static/img", folder, f)) as im: w, h = im.size
        base, _, tail = stem.rpartition("-")
        if tail.isdigit() and int(tail) >= 700 and folder == "photos" or (folder == "plans" and tail in ("900", "1800")):
            IMG.setdefault(base, {"folder": folder, "sizes": []})["sizes"].append((int(tail), w, h))
        else:
            IMG[stem] = {"folder": folder, "sizes": [(w, w, h)], "single": True}

def pic(name, alt, cls="", sizes="100vw", lazy=True, attrs=""):
    m = IMG[name]; folder = m["folder"]
    if m.get("single"):
        _, w, h = m["sizes"][0]
        src = f"/img/{folder}/{name}.webp"; srcset = ""
    else:
        ss = sorted(m["sizes"], key=lambda t: t[1])
        src = f"/img/{folder}/{name}-{ss[0][0]}.webp"
        srcset = ' srcset="' + ", ".join(f"/img/{folder}/{name}-{t}.webp {w}w" for t, w, h in ss) + f'" sizes="{sizes}"'
        _, w, h = ss[-1]
    load = ' loading="lazy" decoding="async"' if lazy else ' fetchpriority="high"'
    c = f' class="{cls}"' if cls else ""
    from html import escape
    return Markup(f'<img src="{src}"{srcset} width="{w}" height="{h}" alt="{escape(alt)}"{c}{load} {attrs}>')

def large(name):
    m = IMG[name]
    if m.get("single"): return f"/img/{m['folder']}/{name}.webp"
    t = max(m["sizes"], key=lambda t: t[1])[0]
    return f"/img/{m['folder']}/{name}-{t}.webp"

env = Environment(loader=FileSystemLoader(os.path.join(SRC, "templates")), autoescape=select_autoescape(["html"]),
                  trim_blocks=True, lstrip_blocks=True)
env.filters.update(money=money, num=num)
def asset(path):
    """Adds a short version to a css or js link so browsers pick up a new file right after a deploy."""
    return path + "?v=" + hashlib.md5(open(os.path.join(SRC, "static", path.lstrip("/")), "rb").read()).hexdigest()[:8]

env.globals.update(pic=pic, large=large, asset=asset)

units = D.UNITS
counts = {k: sum(1 for u in units if u["status"] == k) for k in "AUS"}
for p in D.PLANS:
    p["units"] = [u for u in units if u["plan"]["n"] == p["n"]]
    p["available"] = sum(1 for u in p["units"] if u["status"] == "A")
featured = [u for u in units if u["price"]]
total = len(units)
share = {k: round(100 * counts[k] / total, 2) for k in "AUS"}

ADDRESS = {"@type": "PostalAddress", "streetAddress": S["street"], "addressLocality": S["city"],
           "addressRegion": S["state"], "postalCode": S["zip"], "addressCountry": "US"}
ORG = {"@type": "RealEstateAgent", "@id": S["domain"] + "/#sales", "name": "Coastal Edge Sales",
       "url": S["domain"] + "/", "telephone": S["phone_tel"], "email": S["email"], "address": ADDRESS,
       "image": S["domain"] + "/img/photos/share.jpg", "sameAs": [S["facebook"], S["instagram"], S["tiktok"]]}
BUILDING = {"@type": "ApartmentComplex", "@id": S["domain"] + "/#building", "name": "Coastal Edge",
            "description": "New two and three bedroom condominiums one block from the beach and boardwalk in Seaside Heights, New Jersey.",
            "url": S["domain"] + "/", "address": ADDRESS, "telephone": S["phone_tel"],
            "image": [S["domain"] + large("hero-corner"), S["domain"] + large("front-wide"), S["domain"] + large("kitchen")],
            "numberOfBedrooms": {"@type": "QuantitativeValue", "minValue": 2, "maxValue": 3},
            "amenityFeature": [{"@type": "LocationFeatureSpecification", "name": a, "value": True} for a in D.AMENITY_LIST],
            "tourBookingPage": S["domain"] + "/contact/"}

def crumbs(*items):
    return {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i, "name": n, "item": S["domain"] + u} for i, (n, u) in enumerate((("Home", "/"),) + items, 1)]}

def ld(*nodes): return Markup(json.dumps({"@context": "https://schema.org", "@graph": list(nodes)}, ensure_ascii=False))

client_units = [{"num": u["num"], "floor": u["floor"], "plan": u["plan"]["n"], "status": u["status"],
                 "price": u["price"], "note": u["note"], "tag": u["tag"]} for u in units]
client_plans = [{k: p[k] for k in ("n", "slug", "name", "beds_label", "baths_label", "sf", "deck", "total", "exposure_label", "group")} for p in D.PLANS]

PAGES = []
def page(path, template, title, desc, jsonld=None, **ctx):
    PAGES.append(dict(path=path, template=template, title=title, desc=desc, jsonld=jsonld, ctx=ctx))

page("/", "index.html", "Coastal Edge | New Condos One Block From the Beach in Seaside Heights, NJ",
     "New two and three bedroom condominiums at 401 Boulevard, Seaside Heights. Private decks, heated indoor pool, rooftop deck and covered parking. See availability and schedule a tour.",
     ld(ORG, BUILDING, {"@type": "WebSite", "name": "Coastal Edge", "url": S["domain"] + "/"}), body_class="home")
page("/availability/", "availability.html", "Available Condos for Sale | Coastal Edge, Seaside Heights NJ",
     f"See which of the 36 residences at Coastal Edge are available today. {counts['A']} homes available, two bedroom plus den and three bedroom layouts. Request pricing or book a tour.",
     ld(crumbs(("Availability", "/availability/")), BUILDING))
page("/floor-plans/", "floorplans.html", "Floor Plans | 2 and 3 Bedroom Condos | Coastal Edge Seaside Heights",
     "Ten floor plans from 1,303 to 1,580 square feet, each with a private deck. Compare two bedroom plus den and three bedroom layouts at Coastal Edge.",
     ld(crumbs(("Floor Plans", "/floor-plans/"))))
for p in D.PLANS:
    fp = {"@type": "FloorPlan", "name": f"Coastal Edge {p['name']}", "numberOfBedrooms": p["beds"],
          "numberOfBathroomsTotal": p["baths"], "floorSize": {"@type": "QuantitativeValue", "value": p["sf"], "unitCode": "FTK"},
          "layoutImage": S["domain"] + large(f"plan-{p['n']}"), "isPartOf": {"@id": S["domain"] + "/#building"},
          "url": f"{S['domain']}/floor-plans/{p['slug']}/"}
    page(f"/floor-plans/{p['slug']}/", "plan.html",
         f"{p['name']}: {p['beds_label']}, {p['sf']:,} sq ft | Coastal Edge Floor Plans",
         f"{p['name']} at Coastal Edge: {p['beds_label'].lower()}, {p['baths_label'].lower()}, {p['sf']:,} square feet inside plus a {p['deck']} square foot deck. {p['exposure_label']}. View the plan and download the PDF.",
         ld(crumbs(("Floor Plans", "/floor-plans/"), (p["name"], f"/floor-plans/{p['slug']}/")), fp), plan=p)
page("/amenities/", "amenities.html", "Amenities | Indoor Pool, Rooftop Deck, Fitness | Coastal Edge",
     "Heated indoor pool and sauna, rooftop observation deck, fitness center, recreation room, business center, pet wash and covered parking at Coastal Edge in Seaside Heights.",
     ld(crumbs(("Amenities", "/amenities/")), BUILDING))
page("/gallery/", "gallery.html", "Photo Gallery | Coastal Edge Condos, Seaside Heights NJ",
     "Photos of the Coastal Edge building, finished kitchens and living rooms, the lobby and the beach one block away.",
     ld(crumbs(("Gallery", "/gallery/"))))
page("/neighborhood/", "neighborhood.html", "Neighborhood | Seaside Heights Beach and Boardwalk | Coastal Edge",
     "Coastal Edge is one block from the Seaside Heights beach and boardwalk and a few blocks from Barnegat Bay. See what is nearby and how far it is to the city.",
     ld(crumbs(("Neighborhood", "/neighborhood/"))))
page("/faq/", "faq.html", "Questions and Answers | Coastal Edge Condos Seaside Heights",
     "Answers about Coastal Edge: location, sizes, amenities, parking, association fees, warranty, rentals and how to tour.",
     ld(crumbs(("FAQ", "/faq/")), {"@type": "FAQPage", "mainEntity": [
         {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in D.FAQ]}))
page("/contact/", "contact.html", "Schedule a Tour | Contact Coastal Edge, Seaside Heights NJ",
     "Schedule a private tour of Coastal Edge at 401 Boulevard, Seaside Heights. Pick a day and send the form, or call " + S["phone_display"] + ", and the sales team will confirm a time.",
     ld(crumbs(("Contact", "/contact/")), ORG))
page("/brochure/", "brochure.html", "Download the Brochure | Coastal Edge Condos",
     "Get the Coastal Edge brochure with floor plans, amenities and the neighborhood. Tell us where to send it and download it right away.",
     ld(crumbs(("Brochure", "/brochure/"))))
page("/thank-you/", "thankyou.html", "Thank You | Coastal Edge", "Thank you for contacting Coastal Edge.", None, noindex=True)
page("/404.html", "404.html", "Page Not Found | Coastal Edge", "This page could not be found.", None, noindex=True)

if os.path.exists(DIST): shutil.rmtree(DIST)
shutil.copytree(os.path.join(SRC, "static"), DIST)
common = dict(site=S, nav=D.NAV, plans=D.PLANS, units=units, counts=counts, total=total, share=share, featured=featured, amenities=D.AMENITIES,
              amenity_list=D.AMENITY_LIST, finishes=D.FINISHES, nearby=D.NEARBY, drives=D.DRIVES, faq=D.FAQ,
              gallery=D.GALLERY, gallery_by={g[0]: g for g in D.GALLERY}, year=datetime.date.today().year,
              client_data=Markup(json.dumps({"units": client_units, "plans": client_plans}, separators=(",", ":"))))
for pg in PAGES:
    out = os.path.join(DIST, pg["path"].lstrip("/"))
    if pg["path"].endswith("/"): out = os.path.join(out, "index.html")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    html = env.get_template(pg["template"]).render(**common, **pg["ctx"], path=pg["path"], title=pg["title"], desc=pg["desc"],
                                                    jsonld=pg["jsonld"], canonical=S["domain"] + pg["path"])
    open(out, "w").write(html)

today = datetime.date.today().isoformat()
urls = [p["path"] for p in PAGES if not p["ctx"].get("noindex")]
open(os.path.join(DIST, "sitemap.xml"), "w").write(
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + "".join(f"  <url><loc>{S['domain']}{u}</loc><lastmod>{today}</lastmod></url>\n" for u in urls) + "</urlset>\n")
open(os.path.join(DIST, "robots.txt"), "w").write(f"User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /docs/\n\nSitemap: {S['domain']}/sitemap.xml\n")

# Facts for the chat assistant. Public information only.
facts = {
    "site": {k: S[k] for k in ("name", "phone_display", "email", "street", "city", "state", "zip", "tour_3d", "updated", "owner_portal")},
    "summary": "36 residences on floors 2 to 5 (floors 2 and 3 have plans 1 to 8, floors 4 and 5 have plans 1 to 10). Construction is complete and homes are ready for move in. One block from the beach and boardwalk.",
    "counts": {"available": counts["A"], "under_contract": counts["U"], "sold": counts["S"]},
    "plans": [{"plan": p["name"], "bedrooms": p["beds_label"], "baths": p["baths"], "interior_sqft": p["sf"], "deck_sqft": p["deck"],
               "exposure": p["exposure_label"], "floors": p["floors"], "page": f"/floor-plans/{p['slug']}/"} for p in D.PLANS],
    "units": [{"unit": u["num"], "plan": u["plan"]["name"], "status": u["status_label"],
               "listed_price": money(u["price"]) if u["price"] else None, **({"note": u["tag_label"]} if u["tag"] else {})} for u in units],
    "amenities": D.AMENITY_LIST, "finishes": D.FINISHES,
    "nearby": [f"{a} ({b})" for a, b in D.NEARBY], "drives": [f"{a}: {b}" for a, b in D.DRIVES],
    "faq": [{"q": q, "a": a} for q, a in D.FAQ],
    "pages": {"availability": "/availability/", "floor_plans": "/floor-plans/", "amenities": "/amenities/", "gallery": "/gallery/",
              "neighborhood": "/neighborhood/", "faq": "/faq/", "schedule_a_tour": "/contact/", "brochure": "/brochure/"},
}
os.makedirs(os.path.join(ROOT, "lib"), exist_ok=True)
json.dump(facts, open(os.path.join(ROOT, "lib", "facts.json"), "w"), indent=1)
print(f"Built {len(PAGES)} pages. Available {counts['A']}, under contract {counts['U']}, sold {counts['S']}.")
