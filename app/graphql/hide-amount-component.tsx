import * as React from "react"
import {
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { useApolloClient } from "@apollo/client"

import { useHideBalanceSetting } from "@app/hooks/use-hide-balance-setting"
import { usePersistentStateContext } from "@app/store/persistent-state"
import {
  getBalanceHidden,
  withBalanceHidden,
} from "@app/store/persistent-state/hide-balance"

import { HideBalanceDocument, HideBalanceQuery } from "./generated"
import { HideAmountContextProvider } from "./hide-amount-context"

/**
 * Legacy source for the "always hide balance" setting, which lived on the Apollo cache
 * before #4124. Read once so users who set it on an older build keep it; the field can
 * be dropped from the local schema after a couple of releases.
 */
const readLegacyAlwaysHideBalance = (
  client: ReturnType<typeof useApolloClient>,
): boolean => {
  try {
    return Boolean(
      client.readQuery<HideBalanceQuery>({ query: HideBalanceDocument })?.hideBalance,
    )
  } catch {
    return false
  }
}

export const HideAmountContainer: React.FC<PropsWithChildren> = ({ children }) => {
  const client = useApolloClient()
  const { persistentState, updateState } = usePersistentStateContext()
  const { alwaysHideBalance, setAlwaysHideBalance } = useHideBalanceSetting()

  // Falls back to the legacy value only while the persisted setting is still unset.
  const effectiveAlwaysHideAtMount = useRef(
    persistentState.alwaysHideBalance ?? readLegacyAlwaysHideBalance(client),
  ).current

  // PersistentStateProvider renders nothing until it has loaded and GaloyClient renders
  // nothing until the cache is restored, so this seed is already final: no loading state
  // and no frame where a hidden balance flashes into view.
  const [hideAmount, setHideAmount] = useState(
    () => effectiveAlwaysHideAtMount || getBalanceHidden(persistentState),
  )

  const persistBalanceHidden = useCallback(
    (value: boolean) => {
      updateState((prev) => prev && withBalanceHidden(prev, value))
    },
    [updateState],
  )

  const toggleHideAmount = useCallback(() => {
    const next = !hideAmount
    // Local state stays the render source of truth so a tap never waits on storage.
    setHideAmount(next)
    // While "always hide balance" is on, revealing is a peek: it must not be remembered.
    if (!alwaysHideBalance) {
      persistBalanceHidden(next)
    }
  }, [hideAmount, alwaysHideBalance, persistBalanceHidden])

  // One-shot: make the legacy value durable. The seed above already used it, so this
  // write is invisible on screen.
  const hasAdoptedLegacy = useRef(false)
  useEffect(() => {
    if (hasAdoptedLegacy.current) return
    hasAdoptedLegacy.current = true
    if (persistentState.alwaysHideBalance === undefined && effectiveAlwaysHideAtMount) {
      setAlwaysHideBalance(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // React to real changes of the setting only. Seeded with the stored value, not the
  // legacy one: adoption then reads as "turned on", which re-hides a balance the seed
  // already hid and writes nothing — whereas seeding with the legacy value would make
  // the very first run look like the user had just turned the setting off.
  const previousAlwaysHideBalance = useRef(alwaysHideBalance)
  useEffect(() => {
    if (previousAlwaysHideBalance.current === alwaysHideBalance) return
    previousAlwaysHideBalance.current = alwaysHideBalance

    setHideAmount(alwaysHideBalance)
    // Turning the setting off reveals the balance, and that becomes the remembered
    // choice; turning it on writes nothing, since the setting itself is what hides.
    if (!alwaysHideBalance) {
      persistBalanceHidden(false)
    }
  }, [alwaysHideBalance, persistBalanceHidden])

  const contextValue = useMemo(
    () => ({ hideAmount, toggleHideAmount }),
    [hideAmount, toggleHideAmount],
  )

  return (
    <HideAmountContextProvider value={contextValue}>{children}</HideAmountContextProvider>
  )
}
