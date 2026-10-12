// ─── Geo utilities (Admin Dashboard, GeofenceTab) ──────────────────────────────
// Helper untuk:
//  • Parse tautan Google Maps (short goo.gl, /maps?q=, /@lat,lng,zoom, params lat/lng)
//    sehingga admin cukup paste "https://maps.app.goo.gl/..." atau URL Maps penuh —
//    latitude/longitude otomatis terisi ke form.
//  • Map preview (embed tanpa API key) + link buka di Google Maps.

export interface ParsedGeo {
  latitude: number
  longitude: number
  /** Bisa undefined bila link tidak membawa zoom — tidak wajib. */
  zoom?: number
}

/**
 * Parse beragam bentuk URL Google Maps jadi koordinat.
 * Mendukung:
 *   https://www.google.com/maps?q=-6.1891,106.8371          (param q)
 *   https://www.google.com/maps/@-6.1891,106.8371,17z       (notasi @lat,lng,zoom)
 *   https://www.google.com/maps/place/…/@-6.19,106.83,17z
 *   https://maps.google.com/?q=loc:-6.1891,+106.8371
 *   https://www.google.com/maps/dir/…/-6.1891,106.8371/…
 * Return null bila koordinat tidak bisa diekstrak.
 * Untuk short link (maps.app.goo.gl/...) gunakan resolveMapsShortLink() dulu.
 */
export function parseMapsUrl(raw: string): ParsedGeo | null {
  if (!raw) return null
  const url = raw.trim()

  // 1) Notasi @lat,lng[,zoom] — paling umum di URL panjang "place/…"
  const at = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,(\d+(?:\.\d+)?)z)?/)
  if (at) return build(at[1], at[2], at[3])

  // 2) Param q / query / destination (dir links, Place API style) — "lat,lng" atau "loc:lat,lng"
  const q = url.match(/[?&](?:q|query|destination|daddr)=([^&#]+)/)
  if (q) {
    const decoded = decodeURIComponent(q[1].replace(/\+/g, ' '))
    const loc = decoded.match(/^loc:(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/)
    if (loc) return build(loc[1], loc[2])
    const pair = decoded.match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/)
    if (pair) return build(pair[1], pair[2])
  }

  // 3) Param eksplisit latitude/longitude
  const lat = url.match(/[?&]lat(?:itude)?=(-?\d+(?:\.\d+)?)/)
  const lng = url.match(/[?&](?:lng|lon|long|longitude)=(-?\d+(?:\.\d+)?)/)
  if (lat && lng) return build(lat[1], lng[1])

  // 4) Pola "lat,lng" di body URL (dir/place tanpa @)
  const body = url.match(/(?:^|\/)(-?\d+\.\d+),(-?\d+\.\d+)(?:[/?]|$)/)
  if (body) return build(body[1], body[2])

  return null
}

function build(latStr: string, lngStr: string, zoomStr?: string): ParsedGeo | null {
  const latitude = parseFloat(latStr)
  const longitude = parseFloat(lngStr)
  if (isNaN(latitude) || isNaN(longitude)) return null
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null
  return {
    latitude,
    longitude,
    zoom: zoomStr ? parseFloat(zoomStr) : undefined,
  }
}

/**
 * Short-link goo.gl / maps.app.goo.gl menaruh koordinat DI BELAKANG redirect —
 * parser biasa tidak bisa. Ikuti redirect (fetch follow) kembali URL final,
 * lalu parseMapsUrl() pada URL itu. Gagal (CORS/block) → null; admin tetap
 * bisa isi manual.
 */
export async function resolveMapsShortLink(raw: string): Promise<string | null> {
  try {
    const res = await fetch(raw.trim(), { redirect: 'follow', mode: 'cors' })
    if (!res.ok) return null
    return res.url || null
  } catch {
    return null
  }
}

/**
 * Preview peta (embed, tanpa API key) memakai OpenStreetMap export iframe.
 * Radius marker digambarkan sederhana: bbox mengikuti zoom.
 */
export function osmEmbeddedMapUrl(latitude: number, longitude: number): string {
  // bbox ±0.0035° (±~390m) — cukup untuk radius 100–500m di satu frame.
  const delta = 0.0035
  const minLng = longitude - delta
  const maxLng = longitude + delta
  const minLat = latitude - delta
  const maxLat = latitude + delta
  return [
    'https://www.openstreetmap.org/export/embed.html',
    `bbox=${minLng},${minLat},${maxLng},${maxLat}`,
    'layer=mapnik',
    `marker=${latitude},${longitude}`,
  ].join('&')
}

/** Link buka titik ini di Google Maps — dipakai tombol "Buka di Maps". */
export function googleMapsLink(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`
}
