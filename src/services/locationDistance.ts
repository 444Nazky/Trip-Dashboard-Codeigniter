// ─── Geolokasi laporan: jarak koordinat foto ke titik geofence terdekat ────────
// Kolom "Lokasi" di dashboard (ReportSheet & ReportsTab) kini menampilkan
// "<jarak>m dari <nama titik>" (contoh: "80m dari SBDZ") alih-alih pasangan
// koordinat mentah — koordinat tetap tersedia sebagai tooltip & link Google Maps.
import type { GeofenceRule } from './geofences'

/** Jarak great-circle (haversine) dalam meter. */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const R = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}

export interface LocationDistance {
  /** Jarak pembulatan ke bawah (meter) dari foto ke titik geofence terdekat. */
  meters: number
  /** Kode/nama titik geofence — locationName ("SBDZ") atau fallback nama panjang. */
  label: string
  /** Nama lengkap titik (untuk tooltip). */
  pointName: string
  /** Koordinat titik geofence (tooltip & pembanding). */
  pointLat: number
  pointLng: number
}

interface Coords {
  latitude?: number | null
  longitude?: number | null
}

/**
 * Cari titik geofence TERDEKAT dari koordinat sebuah dokumentasi foto.
 * Return null bila koordinat kosong/invalid atau daftar titik kosong.
 */
export function nearestGeofence(
  coords: Coords,
  rules: GeofenceRule[],
): LocationDistance | null {
  const lat = Number(coords?.latitude)
  const lng = Number(coords?.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || rules.length === 0) return null

  let best: LocationDistance | null = null
  for (const r of rules) {
    const plat = Number(r.latitude)
    const plng = Number(r.longitude)
    if (!Number.isFinite(plat) || !Number.isFinite(plng)) continue
    const meters = haversineMeters(lat, lng, plat, plng)
    if (!best || meters < best.meters) {
      best = {
        // Bulatkan ke bawah (conservative — jangan mengebesarkan jarak)
        meters: Math.floor(meters),
        label: r.locationName,
        pointName: r.locationName,
        pointLat: plat,
        pointLng: plng,
      }
    }
  }
  return best
}

/** Teks kolom Lokasi: "80m dari SBDZ" — atau null bila tak bisa dihitung. */
export function locationDistanceText(
  coords: Coords,
  rules: GeofenceRule[],
): string | null {
  const nd = nearestGeofence(coords, rules)
  if (!nd) return null
  return `${nd.meters}m dari ${nd.label}`
}
