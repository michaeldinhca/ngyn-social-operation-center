// Free Unsplash sample photography, credited. Locations are illustrative and are not Harbourview.
export interface SamplePhoto {
  image: string
  author: string
  source: string
  alt: string
}

export const SAMPLE_PHOTOS: SamplePhoto[] = [
  { image: 'photo-1760276049745-c45e982a8065', author: 'Kristaps Ungurs', source: 'https://unsplash.com/photos/cup7nWOyhAA', alt: 'Autumn woodland path with fallen leaves.' },
  { image: 'photo-1742069207552-287bd7359a50', author: 'Zoshua Colah', source: 'https://unsplash.com/photos/two-buses-are-driving-down-a-street-GTI-duKwNBU', alt: 'City buses travelling along a street.' },
  { image: 'photo-1759237571484-463dd9ed8d12', author: 'Kelsey He', source: 'https://unsplash.com/photos/XdGhGTW_g8w', alt: 'Wooden walkway through a forest of autumn trees.' },
  { image: 'photo-1579970018561-4ceaecacdcec', author: 'Michael Discenza', source: 'https://unsplash.com/photos/gW33MQrtJvM', alt: 'City skyline across a lake at sunset.' },
  { image: 'photo-1558617320-e695f0d420de', author: 'Thomas Park', source: 'https://unsplash.com/photos/swimming-pool-close-up-photography-QGdRrty4054', alt: 'Clear blue swimming pool water over lane markings.' },
]

export function photoUrl(index: number, width = 800, height?: number): string {
  const p = SAMPLE_PHOTOS[index % SAMPLE_PHOTOS.length]
  return `https://images.unsplash.com/${p.image}?auto=format&fit=crop&w=${width}${height ? `&h=${height}` : ''}&q=70`
}
