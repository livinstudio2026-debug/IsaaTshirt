// ──────────────────────────────────────────────────────────────────────────────────────────
// SAMPLE DATA. These are made-up placeholder reviews so the section can be designed and tested.
// Do NOT ship them to customers. Replace the array with real reviews (or an API fetch), then set
// SAMPLE_REVIEWS to false: that removes the "Sample reviews" tag from the page.
// `verified: true` shows a "Verified buyer" tick; only set it for reviews tied to a real order.
// ──────────────────────────────────────────────────────────────────────────────────────────
export const SAMPLE_REVIEWS = true

export const reviews = [
  { id: 1, name: 'Arjun', city: 'Chennai', rating: 5, tee: 'Wander More', hex: '#5a3b2c', verified: false,
    text: 'The fit is exactly what I wanted: boxy, dropped shoulders, and the wash makes it feel like I have owned it for years. The print looks even better in person.' },
  { id: 2, name: 'Meera', city: 'Bengaluru', rating: 5, tee: 'Coastal Society', hex: '#2c3f63', verified: false,
    text: 'Wore it twice in one week. Soft from the very first wear, and the wave print has so much detail up close.' },
  { id: 3, name: 'Rohan', city: 'Hyderabad', rating: 4, tee: 'Orbit Club', hex: '#efece6', verified: false,
    text: 'Love the oversized cut. I went one size down for a closer fit and it still drapes well. Delivery took a day longer than I expected, but worth the wait.' },
  { id: 4, name: 'Sana', city: 'Mumbai', rating: 5, tee: 'Dream Bigger', hex: '#2b2b2b', verified: false,
    text: 'The washed black is perfect: not too faded, not flat. Three people asked where I got it.' },
  { id: 5, name: 'Karthik', city: 'Coimbatore', rating: 5, tee: 'Compass', hex: '#55612a', verified: false,
    text: 'COD made it easy to try the brand for the first time. The olive is rich and the compass graphic is crisp.' },
  { id: 6, name: 'Ishita', city: 'Pune', rating: 4, tee: 'Los Angeles', hex: '#cdbfa6', verified: false,
    text: 'Great everyday tee and the sand colour goes with everything. I wish my size had been in stock for more colours.' },
  { id: 7, name: 'Dev', city: 'Delhi', rating: 5, tee: 'New York Graffiti', hex: '#2b2b2b', verified: false,
    text: 'Picked up the limited New York tee and I am glad I did. The print has real texture. Already eyeing the next drop.' },
]
