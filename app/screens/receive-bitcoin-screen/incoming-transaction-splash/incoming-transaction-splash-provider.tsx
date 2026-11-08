import React, {
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { AppState, Keyboard } from "react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { useHideAmount } from "@app/graphql/hide-amount-context"
import { useHideBalanceSetting } from "@app/hooks/use-hide-balance-setting"
import { useI18nContext } from "@app/i18n/i18n-react"
import { usePriceConversion } from "@app/hooks/use-price-conversion"
import {
  navigationRef,
  useAuthenticationContext,
} from "@app/navigation/navigation-container-wrapper"
import { toUsdMoneyAmount } from "@app/types/amounts"
import { logIncomingTransactionSplashOptedOut } from "@app/utils/analytics"

import { decideSplash } from "./decide-splash"
import { IncomingTransactionSplashContext } from "./incoming-transaction-splash-context"
import { IncomingTransactionSplashOverlay } from "./incoming-transaction-splash-overlay"
import { SplashCandidate } from "./types"
import { toastSplashSetting, useSplashSettings } from "./use-splash-settings"

export type ShownSplash = SplashCandidate & {
  amountSats: number
  /** The balance was hidden when it landed: the amounts stay masked until a tap on the
   *  splash shows them. The tap never changes the hide-balance setting. */
  amountHidden: boolean
}

export const IncomingTransactionSplashProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const [shown, setShown] = useState<ShownSplash | null>(null)

  const { LL } = useI18nContext()
  const settings = useSplashSettings()
  const { hideAmount } = useHideAmount()
  const { alwaysHideBalance } = useHideBalanceSetting()
  const { isAppLocked } = useAuthenticationContext()
  const { convertMoneyAmount } = usePriceConversion()

  const seenIds = useRef(new Set<string>())
  /** Payments that came in one event behind the one on screen, shown in turn on Close. */
  const queued = useRef<ShownSplash[]>([])
  const splashHashes = useRef(new Set<string>())
  const foregroundSince = useRef(Date.now())

  /** Read through a ref so `showSplash` keeps one identity for the subscription effects. */
  const gate = useRef({
    settings,
    balanceHidden: hideAmount || alwaysHideBalance,
    isAppLocked,
    convertMoneyAmount,
  })
  gate.current = {
    settings,
    balanceHidden: hideAmount || alwaysHideBalance,
    isAppLocked,
    convertMoneyAmount,
  }

  const dismiss = useCallback(() => {
    queued.current = []
    setShown(null)
  }, [])

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        foregroundSince.current = Date.now()
        return
      }
      /** Background only: iOS goes "inactive" for a pulled-down notification centre or
       *  a biometric prompt, which should not dismiss it. */
      if (state === "background") dismiss()
    })
    return () => subscription.remove()
  }, [dismiss])

  useEffect(() => {
    if (isAppLocked) dismiss()
  }, [isAppLocked, dismiss])

  const toSats = useCallback((candidate: SplashCandidate): number | null => {
    const { settlementAmount, settlementCurrency } = candidate.transaction
    const amount = Math.abs(settlementAmount)
    if (settlementCurrency === WalletCurrency.Btc) return amount

    /** The transaction carries a display-currency price, not a BTC rate, so a USD
     *  receive is converted at the live rate. Missing price fails closed. */
    const convert = gate.current.convertMoneyAmount
    if (!convert) return null
    return convert(toUsdMoneyAmount(amount), WalletCurrency.Btc).amount
  }, [])

  /** The splash this payment gets, or null when it gets none. */
  const accept = useCallback(
    (candidate: SplashCandidate): ShownSplash | null => {
      const alreadySeen = seenIds.current.has(candidate.transaction.id)

      const routeName = navigationRef.isReady()
        ? navigationRef.getCurrentRoute()?.name
        : undefined
      const current = gate.current
      const decision = decideSplash({
        candidate,
        foregroundSinceMs: foregroundSince.current,
        nowMs: Date.now(),
        appActive: AppState.currentState === "active",
        alreadySeen,
        enabled: current.settings.enabled,
        minSats: current.settings.minSats,
        amountSats: toSats(candidate),
        routeName,
        keyboardVisible: Keyboard.isVisible(),
        appLocked: current.isAppLocked,
      })
      /** Only a live payment is remembered. A restore replays every past one, an outgoing
       *  one never shows: neither can ever pass, so neither is kept for the app's life. */
      const neverShows =
        decision.outcome === "skip" &&
        (decision.reason === "outgoing" ||
          decision.reason === "settled_before_foreground")
      if (!alreadySeen && !neverShows) seenIds.current.add(candidate.transaction.id)
      if (decision.outcome !== "show") return null

      if (candidate.paymentHash) splashHashes.current.add(candidate.paymentHash)
      return {
        ...candidate,
        amountSats: decision.amountSats,
        amountHidden: current.balanceHidden,
      }
    },
    [toSats],
  )

  const showSplash = useCallback(
    (candidate: SplashCandidate) => {
      const next = accept(candidate)
      if (!next) return false
      setShown(next)
      return true
    },
    [accept],
  )

  /** Several payments in one event, such as a batch of deposits: the first goes on
   *  screen and the rest follow it on Close. Payments that arrive one by one still
   *  replace each other. */
  const showSplashes = useCallback(
    (candidates: readonly SplashCandidate[]) => {
      const [first, ...rest] = candidates
        .map(accept)
        .filter((next): next is ShownSplash => next !== null)
      if (!first) return
      setShown(first)
      queued.current.push(...rest)
    },
    [accept],
  )

  const refresh = useCallback((candidate: SplashCandidate) => {
    setShown((current) =>
      current && current.transaction.id === candidate.transaction.id
        ? // Set outright: a candidate without the flag must clear it, not inherit it.
          { ...current, ...candidate, detailsPending: candidate.detailsPending }
        : current,
    )
  }, [])

  const isSplashShownForHash = useCallback(
    (paymentHash: string) => splashHashes.current.has(paymentHash),
    [],
  )

  const close = useCallback(
    ({ optedOut }: { optedOut: boolean }) => {
      if (optedOut) {
        settings.setEnabled(false)
        toastSplashSetting({ enabled: false, LL })
        logIncomingTransactionSplashOptedOut({ source: "splash" })
        queued.current = []
      }
      setShown(queued.current.shift() ?? null)
    },
    [settings, LL],
  )

  const openDetails = useCallback(
    ({ optedOut }: { optedOut: boolean }) => {
      if (!shown || shown.detailsPending) return
      const txid = shown.transaction.id
      const unclaimedDeposit = shown.unclaimedDeposit === true
      // Details leaves the splash: the unclaimed deposits screen lists the rest anyway.
      queued.current = []
      close({ optedOut })
      if (!navigationRef.isReady()) return
      if (unclaimedDeposit) {
        navigationRef.navigate("unclaimedDepositsScreen")
        return
      }
      navigationRef.navigate("transactionDetail", { txid })
    },
    [close, shown],
  )

  const value = useMemo(
    () => ({ showSplash, showSplashes, refresh, isSplashShownForHash }),
    [showSplash, showSplashes, refresh, isSplashShownForHash],
  )

  return (
    <IncomingTransactionSplashContext.Provider value={value}>
      {children}
      {shown && (
        <IncomingTransactionSplashOverlay
          splash={shown}
          onClose={close}
          onDetails={openDetails}
        />
      )}
    </IncomingTransactionSplashContext.Provider>
  )
}
