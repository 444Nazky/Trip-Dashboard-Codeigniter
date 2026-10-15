import { environment } from '../environments/environment'



const TOKEN_KEY = 'trip.auth.token.v1'
const API_BASE_URL_OVERRIDE_KEY = 'trip.admin.apiBaseUrl'




interface ApiError {
  message: string
  code?: string
}

interface ApiResponse<T> {
  data?: T
  error?: ApiError
  ok: boolean
}




// baca url dinamis (override > env)
export function resolveApiBaseUrl(): string {
  try {
    const override = localStorage.getItem(API_BASE_URL_OVERRIDE_KEY)
    if (override && override.trim()) return normalizeBaseUrl(override)
  } catch {}
  return normalizeBaseUrl(environment.apiBaseUrl)
}




// rapikan format url
export function normalizeBaseUrl(raw: string): string {
  let url = String(raw ?? '').trim().replace(/\/+$/, '')
  if (!url) return url
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) url = `http://${url}`
  if (!/\/api$/i.test(url)) url = `${url}/api`
  return url
}




// simpan url dinamis
export function setApiBaseUrlOverride(url: string | null): void {
  try {
    if (url && url.trim()) localStorage.setItem(API_BASE_URL_OVERRIDE_KEY, url.trim())
    else localStorage.removeItem(API_BASE_URL_OVERRIDE_KEY)
  } catch {}
}




// tes koneksi ke url
export async function pingBaseUrl(raw: string, timeoutMs = 10000): Promise<{ ok: boolean; ms: number }> {
  const base = normalizeBaseUrl(raw)
  const t0 = Date.now()
  try {
    const c = new AbortController()
    const t = setTimeout(() => c.abort(), timeoutMs)
    try {
      const r = await fetch(`${base}/health?_t=${Date.now()}`, { cache: 'no-store', signal: c.signal })
      return { ok: r.ok, ms: Date.now() - t0 }
    } finally {
      clearTimeout(t)
    }
  } catch {
    return { ok: false, ms: Date.now() - t0 }
  }
}



class ApiService {
  private _token: string | null = null

  constructor() {
    try {
      this._token = localStorage.getItem(TOKEN_KEY)
    } catch {}
  }

  get token() { return this._token }

  setToken(token: string | null) {
    this._token = token
    try {
      if (token) {
        localStorage.setItem(TOKEN_KEY, token)
      } else {
        localStorage.removeItem(TOKEN_KEY)
      }
    } catch {}
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (this._token) {
      headers['Authorization'] = `Bearer ${this._token}`
    }

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 12000)
      const base = resolveApiBaseUrl()

      let res: Response
      try {
        res = await fetch(`${base}${path}`, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timer)
      }

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (res.status === 401) {
          this.setToken(null)
        }
        return { ok: false, error: { message: data.error || 'Request failed', code: String(res.status) } }
      }

      return { ok: true, data }
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === 'AbortError'
      const message = aborted
        ? `Server tidak merespon (12 detik timeout) — periksa API ${resolveApiBaseUrl()}`
        : err instanceof Error ? err.message : 'Network error'
      return { ok: false, error: { message } }
    }
  }

  get<T>(path: string) { return this.request<T>('GET', path) }
  post<T>(path: string, body?: unknown) { return this.request<T>('POST', path, body) }
  put<T>(path: string, body?: unknown) { return this.request<T>('PUT', path, body) }
  delete<T>(path: string) { return this.request<T>('DELETE', path) }

  getOk<T>(path: string): Promise<T | null> {
    return this.get<T>(path).then(r => (r.ok && r.data ? r.data : null))
  }
}



export const api = new ApiService()
