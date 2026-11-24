// Product descriptions, keyed by slug (slugs are unique, so this works even without ObjectIDs).
// `id` is the MongoDB _id; where it is filled in, `npm run seed:descriptions` double-checks that the slug and the id belong to the same product.
// Edit the text freely, then run `npm run seed:descriptions`. Plain `npm run seed` also uses these, so re-seeding never reverts them.
// Rules of thumb: a hook line, then the feel of the tee, then fit. The model allows up to 2000 characters.

export const descriptions = [
  {
    slug: 'dream-bigger',
    id: '6affbdda8c34dfb338ce738a',
    description:
      'Dream bigger, wear it louder. This limited-run tee carries a bold screen-printed graphic on a washed black base that looks lived-in from day one. The garment-washed cotton is soft against the skin and gets better with every wear. Drop shoulders and a boxy, oversized fit give it that effortless street silhouette. Pair it with cargos and a cap, or throw it over a long-sleeve. When it is gone, it is gone.',
  },
  {
    slug: 'orbit-club',
    id: '6affbdda8c34dfb338ce738b',
    description:
      'Your invite to the Orbit Club. A clean off-white tee with a crisp screen-printed graphic that stands out without shouting. The garment-washed cotton feels soft and broken-in, and the oversized cut hangs from dropped shoulders with a relaxed, boxy drape. Easy to style: it works with washed denim, olive cargos or shorts. Wash cold and inside out to keep the print sharp for a long time.',
  },
  {
    slug: 'coastal-society',
    id: '6affbdda8c34dfb338ce738c',
    description:
      'Salt-air energy, built for the city. Coastal Society comes in deep navy with a screen-printed graphic that gives off easy, sun-faded holiday vibes all year round. Soft garment-washed cotton, dropped shoulders and a boxy oversized fit keep it comfortable from morning to late night. Wear it open over a plain tee or on its own with light-wash bottoms. A new arrival that is easy to live in.',
  },
  {
    slug: 'wander-more',
    id: '6affbdda8c34dfb338ce738d',
    description:
      'For the ones who always have one more place to go. Wander More is a warm brown tee with a screen-printed graphic that feels like a travel story told in one chest. The garment-washed cotton is soft from the first wear, and the oversized, boxy fit with dropped shoulders leaves room to move. It pairs well with olive, cream and black, so it fits into most wardrobes. Pack it first.',
  },
  {
    slug: 'break-rules',
    description:
      'Not a suggestion. Break Rules is our statement tee in black, with a bold screen-printed graphic that does the talking. The garment-washed cotton gives it a soft, slightly worn-in feel, and the drop shoulders and boxy oversized fit give it the shape street style is built on. It is easy to wear every day and strong enough to be the centre of an outfit. One of the pieces our crew reaches for first.',
  },
  {
    slug: 'compass',
    description:
      'Find your direction, then go the other way. Compass is a new-season tee in earthy olive with a screen-printed graphic and a calm, adventurous feel. The garment-washed cotton is soft and slightly matte, and the oversized cut has dropped shoulders and a boxy, relaxed drape. Olive works with almost everything: black cargos, cream shorts, washed denim. Wash cold, inside out, and it will keep its colour and its print.',
  },
  {
    slug: 'built-different',
    description:
      'Built different, and it shows. This cream tee carries a confident screen-printed graphic that stays clean and easy to style. The soft garment-washed cotton feels comfortable straight out of the packet, and the oversized silhouette with drop shoulders gives you that boxy, premium streetwear fit. Cream is light enough for summer and works just as well layered through the cooler months. Wear it dressed up or down.',
  },
  {
    slug: 'good-times',
    description:
      'Good vibes, on repeat. Good Times is a bone-coloured tee with a screen-printed graphic that feels warm, relaxed and a little nostalgic. Garment-washed cotton gives it a soft, lived-in hand, and the drop shoulders and boxy oversized fit let it sit loose and easy. It is one of our best sellers because it works everywhere: weekend plans, coffee runs, late nights out. Throw it on and go.',
  },
  {
    slug: 'est-2025',
    description:
      'Where it all started. The Isaa Est. 2025 tee is a rich brown piece that marks our beginning, with a screen-printed graphic that keeps it simple and proud. The garment-washed cotton feels soft and broken-in, and the oversized, boxy cut with dropped shoulders hangs comfortably. A new arrival and a piece to keep: wear it today, and in a few years it will still tell the story of day one.',
  },
  {
    slug: 'new-york',
    description:
      'Straight from the walls of the city that never sleeps. New York Graffiti is a limited-run tee in washed black, with a screen-printed graphic inspired by street art and subway-line energy. The garment-washed cotton is soft with a faded, lived-in look, and the drop shoulders and boxy oversized fit give it big-city attitude. One of our best sellers and a limited piece, so grab yours before the run ends.',
  },
  {
    slug: 'los-angeles',
    description:
      'Golden hour, all day. Los Angeles comes in a warm sand colour with a screen-printed graphic that brings West Coast ease to your wardrobe. Soft garment-washed cotton feels relaxed and broken-in, and the oversized cut with dropped shoulders and a boxy body keeps things loose. Sand is a great neutral: pair it with black, olive or washed denim. Wash cold and inside out to keep the print looking fresh.',
  },
  {
    slug: 'racing',
    description:
      'Built for the finish line. Racing Championship is an olive tee with a sporty screen-printed graphic and plenty of motorsport energy. The garment-washed cotton is soft and slightly worn-in, while the drop shoulders and boxy oversized fit give it a relaxed track-day look off the circuit. Pair it with black cargos and chunky sneakers for a full street-racer fit. One of our best sellers for good reason.',
  },
  {
    slug: 'athletic-dept',
    description:
      'Varsity spirit, street attitude. Athletic Dept. is a deep maroon tee with a screen-printed graphic inspired by sports clubs and campus classics. The garment-washed cotton feels soft and comfortable, and the dropped shoulders and boxy, oversized fit keep it easy and relaxed. The rich maroon looks sharp with cream, black or washed denim. A best seller that feels like it has always been in your wardrobe.',
  },
  {
    slug: 'los-angeles-hoodie',
    description:
      'City of angels, sunday-morning comfort. This cream oversized hoodie carries a retro varsity-style Los Angeles print with a palm tree at its centre, faded just enough to look like a favourite. The soft fleece feels cosy, the boxy cut with dropped shoulders sits relaxed, and the big kangaroo pocket keeps your hands warm. Layer it over a tee or wear it alone. Cream goes with olive, black and washed denim.',
  },
  {
    slug: 'break-rules-hoodie',
    description:
      'Not a suggestion, a statement. Break Rules is our black oversized hoodie with a bold distressed print across the chest and a washed finish that looks worn in from day one. The soft fleece, the dropped shoulders and the roomy hood give it a heavy, easy street silhouette, and the kangaroo pocket does the practical work. Pair it with cargos or baggy denim and let the print do the talking.',
  },
  {
    slug: 'orbit-club-hoodie',
    description:
      'Minimal, calm and quietly cool. The Orbit Club hoodie is a heather grey pullover with a thin-line planet and orbit ring on the chest, and the club name in small spaced capitals underneath. Soft fleece, dropped shoulders and a relaxed boxy fit make it an easy everyday layer. Grey works with everything in the Isaa range, so it is the one you will reach for when you do not want to think about the outfit.',
  },
  {
    slug: 'athletic-dept-hoodie',
    description:
      'Campus classic, streetwear attitude. Athletic Dept. is a deep maroon oversized hoodie with college-style lettering arched across the chest and a small Est. 2025 line below it. The soft fleece, the dropped shoulders and the boxy fit keep it comfortable, and the kangaroo pocket and ribbed cuffs finish the sporty look. Wear it with cream, black or washed denim, or over a plain tee for a varsity mood.',
  },
  {
    slug: 'wander-more-zip-hoodie',
    description:
      'For the ones who always have another road to take. The Wander More zip hoodie is a chocolate brown oversized layer with a full-length zip and a small cream compass-star embroidered on the chest. The soft, washed fleece and dropped shoulders give it a relaxed, boxy shape, and the side pockets are ready for the journey. Zip it up for the cold, leave it open over a tee for the in-between days.',
  },
  {
    slug: 'compass-cargo-pants',
    description:
      'Find your direction and keep your hands free. Compass Cargo Pants are relaxed, straight-fit cargos in olive green, with large flap pockets on both thighs and a drawcord at the hem so you can stack or tighten the leg. The cotton twill has a soft, washed, matte finish that feels easy from the first wear. They go with every tee and hoodie in the range, and olive and black together never miss.',
  },
  {
    slug: 'night-shift-cargo-pants',
    description:
      'Made for after dark. Night Shift Cargo Pants are baggy, wide-leg cargos in washed black, with deep side pockets, an adjustable waist drawcord and toggles at the ankle. The faded finish gives them a lived-in look, and the roomy cut keeps them comfortable all day and all night. Pair them with an oversized tee or a cream hoodie for a clean contrast, and finish with chunky sneakers.',
  },
  {
    slug: 'streetline-baggy-jeans',
    description:
      'The street, in denim. Streetline Baggy Jeans are wide-leg jeans in a stone-washed blue with classic five-pocket styling and soft fading and whiskering at the thighs, so they look worn in from the first day. The relaxed, baggy cut stacks naturally at the ankle and sits easily with oversized tees and boxy hoodies. Sizes are waist measurements in inches, so choose your usual waist and expect a loose, roomy fit.',
  },
  {
    slug: 'daily-drift-sweatpants',
    description:
      'The softest part of your day. Daily Drift Sweatpants are oversized, wide straight-leg sweats in charcoal grey with a brushed, cosy feel, an elastic waistband with a flat drawcord and side pockets. The open hem stacks easily over your sneakers, and a small embroidered Isaa script on the thigh keeps it understated. Wear them with a matching hoodie or a boxy tee, for the couch, the commute or anything in between.',
  },
  {
    slug: 'dune-cargo-shorts',
    description:
      'Built for long, warm days. Dune Cargo Shorts are knee-length, relaxed-fit cargos in sand beige, with large flap pockets on both sides and a drawcord waist for an easy fit. The washed cotton twill has a soft, matte finish and plenty of room to move. Sand is a flexible neutral: it looks sharp with black, olive and cream tees. Your go-to shorts for summer and for holidays.',
  },
  {
    slug: 'midnight-star-cap',
    description:
      'Small star, big presence. The Midnight Star Cap is a washed black six-panel cap with a curved brim and a cream five-point star embroidered at the front. It is unstructured and soft, so it sits comfortably from the first wear, and the adjustable strap fits most heads. The dark, faded finish goes with every outfit we make. Wear it low over the eyes for the full midnight mood.',
  },
  {
    slug: 'isaa-script-cap',
    description:
      'Our signature, stitched in script. The Isaa Script Cap is an olive green six-panel cap with the Isaa name embroidered on the front in a hand-written brush style, in cream. The curved brim shades your eyes and the adjustable strap fits most heads. Olive pairs well with black, cream and washed denim, and it is the easiest way to add a little Isaa to any look.',
  },
  {
    slug: 'court-wristband-set',
    description:
      'Sweat, but make it stylish. The Court Wristband Set is a pair of soft terry-cloth wristbands in black, each with a thin olive stripe and a small cream Isaa script wordmark. They are made for the gym, the court or the street, and they soak up sweat while adding a sporty detail to your outfit. A free-size pair that stretches to fit, and a small piece that finishes the look.',
  },
]

export const descriptionBySlug = Object.fromEntries(descriptions.map((d) => [d.slug, d.description]))
