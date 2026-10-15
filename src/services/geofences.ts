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



export async function fetchGeofenceRules(): Promise<GeofenceRule[] | null> {
  const rules = await api.getOk<GeofenceRule[]>('/geofences')
  if (!rules) return null
  return rules.map(r => ({
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
  const res = await api.put(`/geofences/${id}`, data)
  return res.ok
}



export async function deleteGeofenceRule(id: string): Promise<boolean> {
  const res = await api.delete(`/geofences/${id}`)
  return res.ok
}



export interface RouteGeofencePoint {
  id: string
  locationName: string
  latitude: number
  longitude: number
  radiusMeters: number
  description?: string
}



export async function fetchGeofencePointsForRoute(routeCode: string): Promise<RouteGeofencePoint[]> {
  const all = await fetchGeofenceRules()
  if (!all) return []
  return all.filter(g => g.allowedRouteCodes.includes(routeCode))
}



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
