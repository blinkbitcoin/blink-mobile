import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"

import { insertBounded } from "@app/utils/bounded-collections"

const MAX_TRACKED_INVOICES = 100

export const AutoConvertStatus = {
  Converting: "converting",
  Settled: "settled",
} as const

export type AutoConvertStatusValue =
  (typeof AutoConvertStatus)[keyof typeof AutoConvertStatus]

type ContextValue = {
  getStatus: (invoice: string | undefined) => AutoConvertStatusValue | undefined
  markConverting: (invoice: string) => void
  markSettled: (invoice: string) => void
}

const noop = (): void => undefined

const defaultContextValue: ContextValue = {
  getStatus: () => undefined,
  markConverting: noop,
  markSettled: noop,
}

const AutoConvertStatusContext = createContext<ContextValue>(defaultContextValue)

export const AutoConvertStatusProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [statusByInvoice, setStatusByInvoice] = useState<
    ReadonlyMap<string, AutoConvertStatusValue>
  >(() => new Map())

  const setStatus = useCallback((invoice: string, status: AutoConvertStatusValue) => {
    setStatusByInvoice((prev) => {
      if (prev.get(invoice) === status) return prev
      const next = new Map(prev)
      insertBounded(next, [invoice, status], MAX_TRACKED_INVOICES)
      return next
    })
  }, [])

  const markConverting = useCallback(
    (invoice: string) => setStatus(invoice, AutoConvertStatus.Converting),
    [setStatus],
  )

  const markSettled = useCallback(
    (invoice: string) => setStatus(invoice, AutoConvertStatus.Settled),
    [setStatus],
  )

  const value = useMemo<ContextValue>(
    () => ({
      getStatus: (invoice) => (invoice ? statusByInvoice.get(invoice) : undefined),
      markConverting,
      markSettled,
    }),
    [statusByInvoice, markConverting, markSettled],
  )

  return (
    <AutoConvertStatusContext.Provider value={value}>
      {children}
    </AutoConvertStatusContext.Provider>
  )
}

export const useAutoConvertStatus = (
  invoice: string | undefined,
): AutoConvertStatusValue | undefined => {
  const { getStatus } = useContext(AutoConvertStatusContext)
  return getStatus(invoice)
}

export const useAutoConvertStatusActions = (): Pick<
  ContextValue,
  "markConverting" | "markSettled"
> => {
  const { markConverting, markSettled } = useContext(AutoConvertStatusContext)
  return useMemo(() => ({ markConverting, markSettled }), [markConverting, markSettled])
}
