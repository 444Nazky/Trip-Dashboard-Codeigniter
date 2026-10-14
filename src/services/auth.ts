/**
 * Admin Auth Service — admin-only. Tidak mengimpor pages/ atau komponen mobile.
 *
 * Keamanan: sesi = token JWT saja (api.ts sudah persist ke localStorage).
 * Password TIDAK pernah disimpan di browser (localStorage terbaca oleh XSS
 * / siapa pun yang mengakses mesin) dan TIDAK ada fallback kredensial bawaan
 * 'admin/admin123' (backdoor takeover).
 *
 * AUTH_EVENT dipakai juga oleh App.tsx, LoginPage.tsx.
 */

import { api } from './api'

export const AUTH_EVENT = 'admin-login'

/** Kunci sesi lama — hanya untuk dibersihkan setelah migrasi ke token-only. */
export const ADMIN_KEY = 'trip.auth.admin.v1'
/** Kunci kredensial lama (plaintext) — dihapus pada load untuk memigrasi. */
export const ADMIN_CREDS_KEY = 'trip.admin.creds.v1'

export interface AdminSessionResult {
  ok: boolean
  /** True bila server menolak token/kredensial (perlu form login). */
  authDenied: boolean
}

// Migrasi sekali: hapus kredensial plaintext lama dari localStorage.
try {
  localStorage.removeItem(ADMIN_CREDS_KEY)
  localStorage.removeItem(ADMIN_KEY)
} catch { /* quota */ }

/** Akhiri sesi & bersihkan data auth (logout tombol). */
export function logout() {
  try {
    localStorage.removeItem(ADMIN_KEY)
    localStorage.removeItem(ADMIN_CREDS_KEY)
  } catch { /* quota */ }
  api.setToken(null)
}

/**
 * Validasi sesi dari token tersimpan.
 * - Token ada & diterima server → ok.
 * - Token ditolak (401) → authDenied (tampilkan login).
 * - Server tidak terjangkau → offline (bukan authDenied).
 */
export async function ensureAdminSession(): Promise<AdminSessionResult> {
  if (!api.token) return { ok: false, authDenied: true }

  // Endpoint admin murah untuk membuktikan token masih berlaku.
  const probe = await api.get('/tariffs')
  if (probe.ok) return { ok: true, authDenied: false }
  if (probe.error?.code === '401') {
    api.setToken(null)
    return { ok: false, authDenied: true }
  }
  // Network / 5xx → jangan tampilkan login (dashboard tetap bisa offline).
  return { ok: false, authDenied: false }
}

/** Login admin: kirim kredensial, simpan token sesi. */
export async function adminLogin(username: string, password: string): Promise<AdminSessionResult> {
  const result = await api.post<{ token: string }>('/auth/admin-login', { username, password })
  if (result.ok && result.data?.token) {
    api.setToken(result.data.token)
    return { ok: true, authDenied: false }
  }
  if (result.error?.code === '401' || result.error?.code === '503') {
    return { ok: false, authDenied: true }
  }
  return { ok: false, authDenied: false }
}
