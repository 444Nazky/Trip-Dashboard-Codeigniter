import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface CurrencyContextValue {
  revealed: boolean
  toggle: () => void
}

const CurrencyContext = createContext<CurrencyContextValue>({
  revealed: false,
  toggle: () => {},
})

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [revealed, setRevealed] = useState(false)
  const toggle = useCallback(() => setRevealed(r => !r), [])
  return (
    <CurrencyContext.Provider value={{ revealed, toggle }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrencyReveal() {
  return useContext(CurrencyContext)
}

interface CurrencyDisplayProps {
  amount: number
  className?: string
  prefix?: string
}

export function CurrencyDisplay({ amount, className = '', prefix = 'Rp ' }: CurrencyDisplayProps) {
  const { revealed, toggle } = useCurrencyReveal()
  const formatted = `${prefix}${amount.toLocaleString('id-ID')}`

  return (
    <span
      className={`cursor-pointer select-none font-bold tabular-nums transition-colors ${className}`}
      onClick={toggle}
      title={revealed ? 'Klik untuk sembunyikan' : 'Klik untuk lihat nominal'}
    >
      {revealed ? (
        <span className="text-emerald-600">{formatted}</span>
      ) : (
        <span className="text-slate-400">Rp ••••••</span>
      )}
    </span>
  )
}
