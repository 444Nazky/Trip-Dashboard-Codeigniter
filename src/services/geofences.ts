// ─── Geofence Config Service (Admin Dashboard) ──────────────────────────────────
import { api } from './api'

export interface GeofenceRule {
  id: string
  locationName: string
  latitude: number
  longitude: number
  radiusMeters: number
  allowedRouteCodes: string[]
  allowedDirections: string[]
  description: string
}

export interface GeofenceConfig {
  maxAccuracyMeters: number
  defaultRadiusMeters: number
  rules: GeofenceRule[]
}

export async function fetchGeofenceRules(): Promise<GeofenceRule[] | null> {
  const res = await api.get<GeofenceRule[]>('/geofences')
  if (!res.ok || !res.data) return null
  return res.data.map(r => ({
    ...r,
    allowedRouteCodes: Array.isArray(r.allowedRouteCodes) ? r.allowedRouteCodes : String(r.allowedRouteCodes ?? '').split(',').filter(Boolean),
    allowedDirections: Array.isArray(r.allowedDirections) ? r.allowedDirections : String(r.allowedDirections ?? '').split(',').filter(Boolean),
  }))
}

export async function createGeofenceRule(
  data: Omit<GeofenceRule, 'id'>
): Promise<string | null> {
  const res = await api.post<{ id: string }>('/geofences', {
    locationName: data.locationName,
    latitude: data.latitude,
    longitude: data.longitude,
    radiusMeters: data.radiusMeters,
    allowedRouteCodes: data.allowedRouteCodes,
    allowedDirections: data.allowedDirections,
    description: data.description,
  })
  return res.data?.id ?? null
}

export async function updateGeofenceRule(
  id: string,
  data: Partial<GeofenceRule>
): Promise<boolean> {
  const res = await api.put(`/geofences/${id}`, {
    ...(data.locationName !== undefined ? { locationName: data.locationName } : {}),
    ...(data.latitude !== undefined ? { latitude: data.latitude } : {}),
    ...(data.longitude !== undefined ? { longitude: data.longitude } : {}),
    ...(data.radiusMeters !== undefined ? { radiusMeters: data.radiusMeters } : {}),
    ...(data.allowedRouteCodes !== undefined ? { allowedRouteCodes: data.allowedRouteCodes } : {}),
    ...(data.allowedDirections !== undefined ? { allowedDirections: data.allowedDirections } : {}),
    ...(data.description !== undefined ? { description: data.description } : {}),
  })
  return res.ok
}

export async function deleteGeofenceRule(id: string): Promise<boolean> {
  const res = await api.delete(`/geofences/${id}`)
  return res.ok
}

// ─── Route-linked Geofence Points ────────────────────────────────────────────
// Functions for managing geofence points associated with a specific route.

export interface RouteGeofencePoint {
  id: string
  locationName: string
  latitude: number
  longitude: number
  radiusMeters: number
  description?: string
}

/**
 * Fetch geofence points that apply to a specific route code.
 * Returns geofences where allowed_route_codes contains the route code.
 */
export async function fetchGeofencePointsForRoute(routeCode: string): Promise<RouteGeofencePoint[]> {
  const all = await fetchGeofenceRules()
  if (!all) return []
  return all.filter(g => g.allowedRouteCodes.includes(routeCode))
}

/**
 * Create a geofence point linked to a route.
 */
export async function createRouteGeofencePoint(
  routeCode: string,
  data: Omit<GeofenceRule, 'id' | 'allowedRouteCodes' | 'allowedDirections'>
): Promise<string | null> {
  return createGeofenceRule({
    ...data,
    allowedRouteCodes: [routeCode],
    allowedDirections: [],
  })
}

/**
 * Delete geofence points by route code.
 */
export async function deleteGeofencePointsForRoute(routeCode: string): Promise<boolean> {
  const points = await fetchGeofencePointsForRoute(routeCode)
  if (points.length === 0) return true

  for (const point of points) {
    await deleteGeofenceRule(point.id)
  }
  return true
}
