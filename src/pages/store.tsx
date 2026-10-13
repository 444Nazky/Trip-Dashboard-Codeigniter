/**
 * Admin-only context for the master data edited in the dashboard tabs
 * (tariffs & officers), mirrored to localStorage so it survives reloads.
 * Session/token handling lives in services/auth.ts.
 */
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react'
import type { TariffRow, Officer } from './admin/components/types'
import { logout as auth_logout } from '../services/auth'

export const AUTH_EVENT = 'admin-login'

const LS_KEYS = {
  tariffs: 'trip.admin.tariffs.v1',
  officers: 'trip.admin.officers.v1',
} as const

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch { return fallback }
}

interface StoreValue {
  logout: () => void
  tariffs: TariffRow[]
  saveTariffs: (rows: TariffRow[]) => void
  officers: Officer[]
  saveOfficers: (rows: Officer[]) => void
}

const defaultCtx = {
  logout: () => { /* override by provider */ },
  tariffs: [] as TariffRow[],
  saveTariffs: (_r: TariffRow[]) => { /* override */ },
  officers: [] as Officer[],
  saveOfficers: (_r: Officer[]) => { /* override */ },
} satisfies StoreValue

const AppContext = createContext<StoreValue>(defaultCtx)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [tariffs, setTariffs] = useState<TariffRow[]>(() => load(LS_KEYS.tariffs, []))
  const [officers, setOfficers] = useState<Officer[]>(() => load(LS_KEYS.officers, []))

  const logout = useCallback(() => { auth_logout() }, [])

  const saveTariffs = useCallback((rows: TariffRow[]) => setTariffs(rows), [])
  const saveOfficers = useCallback((rows: Officer[]) => setOfficers(rows), [])

  // Simpan data master agar tetap ada saat browser ditutup.
  useEffect(() => { try { localStorage.setItem(LS_KEYS.tariffs, JSON.stringify(tariffs)) } catch { /* quota */ } }, [tariffs])
  useEffect(() => { try { localStorage.setItem(LS_KEYS.officers, JSON.stringify(officers)) } catch { /* quota */ } }, [officers])

  const ctx = useMemo<StoreValue>(
    () => ({ logout, tariffs, saveTariffs, officers, saveOfficers }),
    [logout, tariffs, saveTariffs, officers, saveOfficers],
  )

  return <AppContext.Provider value={ctx}>{children}</AppContext.Provider>
}

export function useApp(): StoreValue {
  return useContext(AppContext)
}
