"""All content for the Coastal Edge site lives here. Edit, then run: python3 build.py

PRICING RULE: only put a price in PUBLIC_PRICES when the unit is publicly listed
(MLS / Zillow). Every other available unit shows "Request pricing". Internal
prices must never be added to this file, because everything here ships to the browser.
"""

SITE = {
    "name": "Coastal Edge",
    "domain": "https://coastaledgenj.com",
    "tagline": "New condominiums one block from the beach",
    "phone_display": "732-330-6651",
    "phone_tel": "+17323306651",
    "email": "info@coastaledgenj.com",
    "street": "401 Boulevard",
    "city": "Seaside Heights",
    "state": "NJ",
    "zip": "08751",
    "sponsor": "401 Boulevard Urban Renewal LLC",
    "sponsor_address": "495 Route 70 #1085, Brick, NJ 08723",
    "tour_3d": "https://kuula.co/share/hfWdk/collection/7bf7K",
    "maps_url": "https://www.google.com/maps/search/?api=1&query=401+Boulevard+Seaside+Heights+NJ+08751",
    "facebook": "https://www.facebook.com/profile.php?id=61564828343410",
    "instagram": "https://www.instagram.com/coastaledgenj/",
    "tiktok": "https://www.tiktok.com/@coastaledgenj",
    "gtm_id": "GTM-W3TSTBMQ",
    # Owner login for residents: Townsmen's pay online page, which links to their AppFolio owner login.
    "owner_portal": "https://townsmen.co/payonline/",
    "manager": "Townsmen Properties",
    "manager_phone": "732-988-0048",
    "manager_tel": "+17329880048",
    "manager_email": "general@townsmen.co",
    "updated": "November 22, 2026",
}

EXPOSURE = {
    "NW": "Northwest corner", "N": "North", "NE": "Northeast corner, ocean side",
    "E": "East, ocean side", "SE": "Southeast corner, ocean side",
    "SW": "Southwest corner", "W": "West, bay side",
}

# number, bedrooms label, beds, den, baths, interior sf, deck sf, exposure, short note
_PLANS = [
    (1, 3, False, 2.5, 1397, 125, "NW", "Corner home with a long kitchen island and a walk in closet off the entry hall."),
    (2, 2, True, 2, 1460, 135, "N", "Two bedrooms plus a den, with a wide living and dining room that opens to the deck."),
    (3, 3, False, 2.5, 1469, 346, "NE", "Corner home with the largest deck in the building, wrapping two sides of the living room."),
    (4, 3, False, 2.5, 1383, 217, "E", "Ocean side home with a deep deck off the living room and a separate laundry room."),
    (5, 3, False, 2.5, 1383, 217, "E", "Ocean side home with a deep deck off the living room and a separate laundry room."),
    (6, 2, True, 2, 1371, 148, "E", "Two bedrooms plus a den on the ocean side, with the kitchen island facing the living room."),
    (7, 3, False, 2.5, 1344, 252, "SE", "Corner home on the ocean side with a large deck and windows on two sides."),
    (8, 3, False, 2.5, 1396, 120, "SW", "Corner home with windows on two sides and an open kitchen, dining and living room."),
    (9, 3, False, 2, 1303, 138, "W", "Bay side home on the fourth and fifth floors with an efficient three bedroom layout."),
    (10, 3, False, 2.5, 1580, 69, "W", "The largest interior in the building, on the fourth and fifth floors, bay side."),
]

PLANS = []
for n, beds, den, baths, sf, deck, exp, note in _PLANS:
    PLANS.append({
        "n": n, "slug": f"plan-{n}", "name": f"Plan {n:02d}",
        "beds": beds, "den": den, "baths": baths,
        "beds_label": f"{beds} Bedroom" + (" + Den" if den else ""),
        "beds_short": f"{beds} BR" + (" + Den" if den else ""),
        "baths_label": (f"{baths:g} Bath" if baths == 1 else f"{baths:g} Baths"),
        "group": "2den" if den else "3",
        "sf": sf, "deck": deck, "total": sf + deck,
        "exposure": exp, "exposure_label": EXPOSURE[exp], "note": note,
        "floors": "Floors 4 and 5" if n >= 9 else "Floors 2 to 5",
    })

# Status per unit, from the "Pricing and Sales" sheet (tab PRICING 11-10-26).
# A = available, U = under contract, S = sold.
_STATUS = {
    2: "AASSSSAS",
    3: "AAUAASSA",
    4: "AUSAAASAAA",
    5: "AAAASASSSA",
}

# Only units that are publicly listed AND available. Source: MLS, checked 11/16/2026; 502 listed 11/21/2026 (MLS 22636606).
PUBLIC_PRICES = {207: 899000, 405: 789000, 502: 768900, 504: 874900}
UNIT_NOTES = {504: "Top floor"}

# Tags on the unit list. Use them only for real, recent events and clear them after a month or so.
# "new" = Just listed (must be available). "sold" = Recently sold (must be sold).
# 405 relisted 11/13/2026. 502 listed 11/21/2026. 504 listed on the MLS in November 2026. 505 closed 11/6/2026.
UNIT_TAGS = {405: "new", 502: "new", 504: "new", 505: "sold"}
TAG_LABEL = {"new": "Just listed", "sold": "Recently sold"}

STATUS_LABEL = {"A": "Available", "U": "Under contract", "S": "Sold"}
UNITS = []
for floor, row in _STATUS.items():
    for i, s in enumerate(row, 1):
        num = floor * 100 + i
        p = PLANS[i - 1]
        UNITS.append({
            "num": num, "floor": floor, "plan": p, "status": s,
            "status_label": STATUS_LABEL[s],
            "price": PUBLIC_PRICES.get(num) if s == "A" else None,
            "note": UNIT_NOTES.get(num, "") or ("Top floor" if floor == 5 else ""),
            "tag": "", "tag_label": "",
        })
        t = UNIT_TAGS.get(num)
        if (t == "new" and s == "A") or (t == "sold" and s == "S"):
            UNITS[-1].update(tag=t, tag_label=TAG_LABEL[t])

AMENITIES = [
    {"title": "Heated indoor pool and sauna", "text": "Swim all year, whatever the weather is doing outside.", "img": "render-pool", "render": True},
    {"title": "Lobby", "text": "A finished, furnished lobby by HH Designers greets you and your guests.", "img": "lobby", "render": False},
    {"title": "Recreation room", "text": "Billiards, games and room to get together with neighbors and family.", "img": "render-rec", "render": True},
    {"title": "Business center", "text": "A conference room and a quiet place to work when the beach can wait.", "img": "render-conference", "render": True},
]
AMENITY_LIST = [
    "Heated indoor pool", "Sauna", "Rooftop observation deck", "Fitness center",
    "Recreation room", "Business center with conference room", "Pet wash station",
    "Furnished lobby", "Elevator", "Assigned covered garage parking",
    "EV charging compatible parking", "Private deck with every residence",
]
FINISHES = [
    "Interiors by HH Designers", "Open kitchens with a waterfall island", "Stainless steel appliances and gas range",
    "Sliding glass doors to a private deck", "Laundry in every residence", "Primary suite with private bath",
    "Smart lock entry", "10 year new home warranty",
]

NEARBY = [
    ("Seaside Heights beach", "One block east"),
    ("Seaside Heights Boardwalk", "One block east"),
    ("Casino Pier and Breakwater Beach", "On the boardwalk"),
    ("Barnegat Bay", "A few blocks west"),
    ("Klee's Bar and Grill", "On the Boulevard"),
    ("The Sawmill", "On the boardwalk in Seaside Park"),
    ("Beachcomber Bar and Grill", "On the boardwalk"),
    ("Hooks Bar and Grill", "In town"),
    ("Community center and boat rentals", "Bay side"),
]
DRIVES = [("Trenton", "49 miles"), ("Atlantic City", "61 miles"), ("Philadelphia", "65 miles"),
          ("New York City", "83 miles"), ("Newark Airport (EWR)", "70 miles"), ("Philadelphia Airport (PHL)", "74 miles")]

FAQ = [
    ("Where is Coastal Edge?",
     "Coastal Edge is at 401 Boulevard in Seaside Heights, New Jersey, one block from the beach and the boardwalk and a few blocks from Barnegat Bay."),
    ("Is the building finished?",
     "Yes. Construction is complete and residences are ready for move in. You can tour finished homes and the common areas."),
    ("What sizes are the residences?",
     "There are 36 residences on floors two through five. Layouts are two bedrooms plus a den or three bedrooms, from about 1,303 to 1,580 square feet inside, and every home has a private deck from about 69 to 346 square feet."),
    ("Which residences are available and what do they cost?",
     "The availability page shows the status of every residence. Prices are shown for the homes that are currently listed. For the others, send a request and the sales team will reply with current pricing."),
    ("What amenities does the building have?",
     "A heated indoor pool and sauna, a rooftop observation deck, a fitness center, a recreation room, a business center with a conference room, a pet wash station, a furnished lobby and an elevator."),
    ("Is parking included?",
     "Each residence comes with assigned covered parking in the building garage. The garage is compatible with electric vehicle charging. Ask the sales team about the space that goes with a specific residence."),
    ("What are the monthly association fees?",
     "Fees depend on the residence and are roughly $700 a month for the homes currently listed. The sales team can give you the exact figure and what it covers."),
    ("Is there a property tax program?",
     "The building is part of a long term tax abatement agreement with the Borough of Seaside Heights. Ask the sales team for the current figures for the residence you are looking at."),
    ("Is there a warranty?",
     "Yes. Residences are sold with a 10 year new home warranty."),
    ("Can I rent out my residence?",
     "Rentals are governed by the condominium association's rules and by Borough of Seaside Heights requirements. The sales team can send you the current rental policy."),
    ("Are pets allowed?",
     "The building has a pet wash station. Pet rules are set by the condominium association, so ask the sales team for the current policy."),
    ("Can I tour the building?",
     "Yes. Use the schedule a tour form or call 732-330-6651 and the sales team will confirm a time. You can also walk through the 3D tour online."),
    ("I am working with a real estate agent. Is that okay?",
     "Yes. Buyers working with an agent are welcome. Have your agent contact the sales team to set up a showing."),
]

GALLERY = [
    # file, alt, category, tag
    ("front-wide", "Coastal Edge at dusk on the Boulevard, with Barnegat Bay behind", "Building", "Virtual twilight"),
    ("hero-corner", "Coastal Edge entrance and signage at the corner of the Boulevard in Seaside Heights", "Building", ""),
    ("kitchen", "Kitchen with waterfall island, gas range and stainless steel appliances", "Interiors", ""),
    ("living-2", "Open living room and kitchen with sliding doors to the deck", "Interiors", "Virtually staged"),
    ("aerial-beach", "Aerial view from the ocean over the beach and boardwalk toward Coastal Edge and the bay", "Location", ""),
    ("lobby", "Furnished lobby at Coastal Edge", "Interiors", ""),
    ("living-1", "Living room with sliding glass doors and a view toward the ocean", "Interiors", "Virtually staged"),
    ("pendant", "Pendant light over the kitchen island", "Interiors", ""),
    ("living-3", "Living room with built in cabinetry", "Interiors", "Virtually staged"),
    ("front-bay", "Coastal Edge from above with the town and Barnegat Bay behind", "Building", ""),
    ("render-pool", "Rendering of the heated indoor pool", "Amenities", "Rendering"),
    ("corner-street", "Coastal Edge from above at the corner of the Boulevard", "Building", ""),
    ("render-rec", "Rendering of the recreation room", "Amenities", "Rendering"),
    ("aerial-town", "Aerial view of the beach, boardwalk and town", "Location", ""),
    ("render-conference", "Rendering of the conference room", "Amenities", "Rendering"),
]

NAV = [
    ("Availability", "/availability/"),
    ("Floor Plans", "/floor-plans/"),
    ("Amenities", "/amenities/"),
    ("Gallery", "/gallery/"),
    ("Neighborhood", "/neighborhood/"),
    ("FAQ", "/faq/"),
]
