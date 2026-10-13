// ─── Geo utilities (Admin Dashboard — Modal Titik Geofence) ────────────────────
// Helper untuk:
//  • Parse tautan Google Maps (URL penuh DAN pendek) → latitude/longitude.
//    Mendukung: /@lat,lng,zoom · ?q= · /place/…!3d..!4d.. · /dir/ · ll= · center=
//                geo: · teks "lat, lng" mentah · URL pendek maps.app.goo.gl/goo.gl
//  • Resolve URL pendek: (1) resolver server-side (bebas CORS) lalu (2) fetch
//    browser sebagai cadangan.
//  • Map preview (embed tanpa API key) + link buka di Google Maps.

import { api } from './api'

export interface ParsedGeo {
  latitude: number
  longitude: number
  /** Bisa undefined bila link tidak membawa zoom — tidak wajib. */
  zoom?: number
}

/** Cek apakah sebuah URL adalah short-link yang perlu di-resolve dulu. */
export function isShortMapsLink(raw: string): boolean {
  const s = (raw || '').trim()
  if (!/^https?:\/\//i.test(s)) return false
  if (!/goo\.gl|maps\.app|g\.co\/maps|google\.com\/maps\/\?/i.test(s)) return false
  // Kalau koordinat sudah kelihatan di URL, tidak perlu resolve.
  return !/@-?\d|!3d-?\d|[?&](q|ll|center|destination|daddr|lat)=/i.test(s)
}

/**
 * Parse beragam bentuk URL Google Maps jadi koordinat.
 * Urutan pencocokan sengaja: pola paling presisi lebih dulu (!3d/!4d marker
 * place, lalu @lat,lng, lalu query param, lalu pola di body URL, terakhir
 * teks mentah "lat, lng").
 * Return null bila koordinat tidak bisa diekstrak.
 */
export function parseMapsUrl(raw: string): ParsedGeo | null {
  if (!raw) return null
  let url = raw.trim()

  // 0) URL-encoded (mis. hasil salin dari app tertentu)
  try {
    const decoded = decodeURIComponent(url)
    if (decoded !== url) url = decoded
  } catch { /* biarkan apa adanya */ }

  // 1) Marker place data "!3d-6.1891!4d106.8371" — paling presisi pada
  //    URL /maps/place/… (koordinat pin, bukan koordinat viewport).
  const marker = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)
  if (marker) return build(marker[1], marker[2])

  // 1b) Varian "!4d…!3d…" (urutan terbalik pada sebagian tautan Place)
  const markerRev = url.match(/!4d(-?\d+(?:\.\d+)?)!3d(-?\d+(?:\.\d+)?)/)
  if (markerRev) return build(markerRev[2], markerRev[1])

  // 2) Notasi @lat,lng[,zoom] — viewport URL panjang "place/…"
  const at = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,(\d+(?:\.\d+)?)z)?/)
  if (at) return build(at[1], at[2], at[3])

  // 3) Param q / query / destination / daddr / ll / center / sll / near
  const q = url.match(/[?&](?:q|query|destination|daddr|ll|center|sll|near)=([^&#]+)/i)
  if (q) {
    const value = decodeURIComponent(q[1].replace(/\+/g, ' '))
    const loc = value.match(/^loc:\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i)
    if (loc) return build(loc[1], loc[2])
    const pair = value.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/)
    if (pair) return build(pair[1], pair[2])
  }

  // 4) Param eksplisit latitude/longitude
  const lat = url.match(/[?&]lat(?:itude)?=(-?\d+(?:\.\d+)?)/i)
  const lng = url.match(/[?&](?:lng|lon|long|longitude)=(-?\d+(?:\.\d+)?)/i)
  if (lat && lng) return build(lat[1], lng[1])

  // 5) Pola "lat,lng" di body URL (dir/place tanpa @)
  const body = url.match(/(?:^|\/)(-?\d+\.\d+),(-?\d+\.\d+)(?:[/?#]|$)/)
  if (body) return build(body[1], body[2])

  // 6) URI skema "geo:lat,lng" (Android share) atau teks mentah "lat, lng"
  const geo = url.match(/^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i)
  if (geo) return build(geo[1], geo[2])
  const bare = url.match(/^(-?\d+(?:\.\d+)?)\s*[,;]\s*(-?\d+(?:\.\d+)?)$/)
  if (bare) return build(bare[1], bare[2])

  return null
}

function build(latStr: string, lngStr: string, zoomStr?: string): ParsedGeo | null {
  const latitude = parseFloat(latStr)
  const longitude = parseFloat(lngStr)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null
  return {
    latitude,
    longitude,
    zoom: zoomStr ? parseFloat(zoomStr) : undefined,
  }
}

/**
 * Short-link goo.gl / maps.app.goo.gl menaruh koordinat DI BELAKANG redirect —
 * parser biasa tidak bisa membaca. *  * Strategi berlapis (yang pertama berhasil dipakai):
 *   1. Resolver SERVER-SIDE (backend /api/geofences/resolve-link). Bebas CORS.
 *      WAJIB lewat klien `api` (bukan fetch mentah) karena endpoint itu di balik
 *      middleware `authenticate` — tanpa header Authorization responsenya 401,
 *      dan itulah sebabnya auto-isi koordinat dulu selalu gagal di produksi.
 *   2. fetch() browser dengan redirect: 'follow' (cadangan bila backend lama).
 *
 * Return URL final (untuk di-parse ulang) atau null bila gagal.
 */
export async function resolveMapsShortLink(raw: string): Promise<string | null> {
  const url = (raw || '').trim()
  if (!url) return null

  // ── Lapis 1: resolver server-side (dengan token admin) ─────────────────────
  const res = await api.get<{ url?: string; latitude?: number; longitude?: number }>(
    `/geofences/resolve-link?url=${encodeURIComponent(url)}`,
  )
  if (res.ok && res.data) {
    const data = res.data
    // Backend bisa langsung mengembalikan koordinat → encode jadi URL sintetis
    if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
      return `https://www.google.com/maps?q=${data.latitude},${data.longitude}`
    }
    if (typeof data.url === 'string' && data.url) return data.url
  }

  // ── Lapis 2: fetch browser (berhasil bila server mengizinkan CORS) ─────────
  try {
    const res = await fetch(url, { redirect: 'follow', mode: 'cors' })
    if (res.ok) return res.url || null
  } catch { /* gagal total — admin pakai tombol/isian manual */ }

  return null
}

/**
 * Preview peta (embed, tanpa API key) memakai OpenStreetMap export iframe.
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
