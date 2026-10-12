// ─── Shared Types ─────────────────────────────────────────────────────────────



export type AdminTab = 'overview' | 'tariff' | 'plates' | 'routes' | 'officers' | 'reports' | 'geofence' | 'settings'

export interface Region {
  id: string
  name: string
  code: string
}

export interface Dermaga {
  id: string
  region_id: string
  name: string
  code: string
  region_name?: string
  region_code?: string
}

export interface Route {
  id: string
  dermaga_id: string
  name: string
  route_from: string
  route_to: string
  distance?: string | null
  duration?: string | null
}
