import reel1 from '../assets/instagram/reel-01.webp'
import reel2 from '../assets/instagram/reel-02.webp'
import reel3 from '../assets/instagram/reel-03.webp'
import reel4 from '../assets/instagram/reel-04.webp'
import reel5 from '../assets/instagram/reel-05.webp'

export const HANDLE = (import.meta.env.VITE_INSTAGRAM_HANDLE || 'isaa.store').replace(/^@/, '')
export const PROFILE_URL = `https://www.instagram.com/${HANDLE}/`

export const fallbackReels = [
  { id: 'f1', url: PROFILE_URL, poster: reel1, video: null, caption: 'Oversized, washed and ready for the street.', tag: 'On the street', accent: '#c9a27a' },
  { id: 'f2', url: PROFILE_URL, poster: reel2, video: null, caption: 'Up close with the Good Times print.', tag: 'Print detail', accent: '#9a9a35' },
  { id: 'f3', url: PROFILE_URL, poster: reel3, video: null, caption: 'Heavyweight cotton with a soft garment wash.', tag: 'Fabric and wash', accent: '#e0c9a0' },
  { id: 'f4', url: PROFILE_URL, poster: reel4, video: null, caption: 'Every order folded and packed by hand.', tag: 'Packing orders', accent: '#a3aa50' },
  { id: 'f5', url: PROFILE_URL, poster: reel5, video: null, caption: 'New drops land here first.', tag: 'New drop', accent: '#d8b98a' },
]
