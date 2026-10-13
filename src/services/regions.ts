// ─── Regions API Service ──────────────────────────────────────────────────────
// Daftar region (wilayah) — dipakai form admin & pemilihan region asal plat.

import { api } from './api'

export interface Region {
  id: string
  name: string
  code: string
}

/** null = server tidak terjangkau. */
export async function fetchRegions(): Promise<Region[] | null> {
  return api.getOk<Region[]>('/regions')
}
