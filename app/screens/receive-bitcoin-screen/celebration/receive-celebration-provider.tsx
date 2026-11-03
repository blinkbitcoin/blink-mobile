import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { AppState, Keyboard } from "react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { useHideAmount } from "@app/graphql/hide-amount-context"
import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { useHideBalanceSetting } from "@app/hooks/use-hide-balance-setting"
import { usePriceConversion } from "@app/hooks/use-price-conversion"
import {
  navigationRef,
  useAuthenticationContext,
} from "@app/navigation/navigation-container-wrapper"
import { toUsdMoneyAmount } from "@app/types/amounts"
import {
  logReceiveCelebrationClosed,
  logReceiveCelebrationReplaced,
  logReceiveCelebrationSettingChanged,
  logReceiveCelebrationShown,
  logReceiveCelebrationSuppressed,
} from "@app/utils/analytics"

import { amountBucket, decideCelebration } from "./decide-celebration"
import { isOverlayCovered } from "./overlay-cover"
import { ReceiveCelebrationOverlay } from "./receive-celebration-overlay"
import { CelebrationCandidate, CelebrationCloseAction } from "./types"
import { useCelebrationSettings } from "./use-celebration-settings"

export type ShownCelebration = CelebrationCandidate & { amountSats: number }

type ReceiveCelebrationContextValue = {
  celebrate: (candidate: CelebrationCandidate) => void
  /** Newer data for the payment on screen, such as a sender's note that landed after it. */
  refresh: (candidate: CelebrationCandidate) => void
  /** Whether this Lightning payment hash was celebrated, so Receive skips its own haptic. */
  isCelebratedHash: (paymentHash: string) => boolean
}

const ReceiveCelebrationContext = createContext<ReceiveCelebrationContextValue>({
  celebrate: () => {},
  refresh: () => {},
  isCelebratedHash: () => false,
})

export const useReceiveCelebration = () => useContext(ReceiveCelebrationContext)

const walletLabel = (
  isSelfCustodial: boolean,
  currency: WalletCurrency,
): "btc" | "usd" | "self_custodial" => {
  if (isSelfCustodial) return "self_custodial"
  return currency === WalletCurrency.Usd ? "usd" : "btc"
}

export const ReceiveCelebrationProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [shown, setShown] = useState<ShownCelebration | null>(null)

  const settings = useCelebrationSettings()
  const { hideAmount } = useHideAmount()
  const { alwaysHideBalance } = useHideBalanceSetting()
  const { isAppLocked } = useAuthenticationContext()
  const { isSelfCustodial } = useActiveWallet()
  const { convertMoneyAmount } = usePriceConversion()

  const seenIds = useRef(new Set<string>())
  const celebratedHashes = useRef(new Set<string>())
  const foregroundSince = useRef(Date.now())
  const shownAt = useRef(0)
  const shownId = useRef<string | null>(null)

  /** Read through a ref so `celebrate` keeps one identity for the subscription effects. */
  const gate = useRef({
    settings,
    balanceHidden: hideAmount || alwaysHideBalance,
    isAppLocked,
    isSelfCustodial,
    convertMoneyAmount,
  })
  gate.current = {
    settings,
    balanceHidden: hideAmount || alwaysHideBalance,
    isAppLocked,
    isSelfCustodial,
    convertMoneyAmount,
  }

  const dismiss = useCallback((action: CelebrationCloseAction) => {
    if (!shownId.current) return
    shownId.current = null
    logReceiveCelebrationClosed({
      action,
      timeOnScreenMs: Date.now() - shownAt.current,
      optedOut: false,
    })
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
      if (state === "background") dismiss(CelebrationCloseAction.Background)
    })
    return () => subscription.remove()
  }, [dismiss])

  useEffect(() => {
    if (isAppLocked) dismiss(CelebrationCloseAction.Background)
  }, [isAppLocked, dismiss])

  const toSats = useCallback((candidate: CelebrationCandidate): number | null => {
    const { settlementAmount, settlementCurrency } = candidate.transaction
    const amount = Math.abs(settlementAmount)
    if (settlementCurrency === WalletCurrency.Btc) return amount

    /** The transaction carries a display-currency price, not a BTC rate, so a USD
     *  receive is converted at the live rate. Missing price fails closed. */
    const convert = gate.current.convertMoneyAmount
    if (!convert) return null
    return convert(toUsdMoneyAmount(amount), WalletCurrency.Btc).amount
  }, [])

  const celebrate = useCallback(
    (candidate: CelebrationCandidate) => {
      const alreadySeen = seenIds.current.has(candidate.transaction.id)
      if (!alreadySeen) seenIds.current.add(candidate.transaction.id)

      const routeName = navigationRef.isReady()
        ? navigationRef.getCurrentRoute()?.name
        : undefined
      const current = gate.current
      const decision = decideCelebration({
        candidate,
        foregroundSinceMs: foregroundSince.current,
        appActive: AppState.currentState === "active",
        alreadySeen,
        enabled: current.settings.enabled,
        balanceHidden: current.balanceHidden,
        minSats: current.settings.minSats,
        amountSats: toSats(candidate),
        routeName,
        keyboardVisible: Keyboard.isVisible(),
        appLocked: current.isAppLocked,
        overlayCovered: isOverlayCovered(),
      })

      if (decision.outcome === "skip") return
      if (decision.outcome === "suppress") {
        logReceiveCelebrationSuppressed({ reason: decision.reason })
        return
      }

      if (candidate.paymentHash) celebratedHashes.current.add(candidate.paymentHash)
      const next: ShownCelebration = { ...candidate, amountSats: decision.amountSats }
      if (shownId.current && shownId.current !== next.transaction.id) {
        logReceiveCelebrationReplaced({
          secondsSincePrevious: Math.round((Date.now() - shownAt.current) / 1000),
          route: routeName ?? "unknown",
        })
      }
      shownId.current = next.transaction.id
      shownAt.current = Date.now()
      logReceiveCelebrationShown({
        route: routeName ?? "unknown",
        wallet: walletLabel(current.isSelfCustodial, next.transaction.settlementCurrency),
        paymentType: next.paymentType,
        amountBucket: amountBucket(next.amountSats),
        hasNote: Boolean(next.transaction.memo),
      })
      setShown(next)
    },
    [toSats],
  )

  const refresh = useCallback((candidate: CelebrationCandidate) => {
    setShown((current) =>
      current && current.transaction.id === candidate.transaction.id
        ? { ...current, transaction: candidate.transaction }
        : current,
    )
  }, [])

  const isCelebratedHash = useCallback(
    (paymentHash: string) => celebratedHashes.current.has(paymentHash),
    [],
  )

  const close = useCallback(
    ({ optedOut, action }: { optedOut: boolean; action: CelebrationCloseAction }) => {
      if (optedOut) {
        settings.setEnabled(false)
        logReceiveCelebrationSettingChanged({
          enabled: false,
          minimumSats: settings.minSats,
          source: "celebration",
        })
      }
      if (shownId.current) {
        logReceiveCelebrationClosed({
          action,
          timeOnScreenMs: Date.now() - shownAt.current,
          optedOut,
        })
      }
      shownId.current = null
      setShown(null)
    },
    [settings],
  )

  const openDetails = useCallback(
    ({ optedOut }: { optedOut: boolean }) => {
      const txid = shown?.transaction.id
      close({ optedOut, action: CelebrationCloseAction.Details })
      if (txid && navigationRef.isReady()) {
        navigationRef.navigate("transactionDetail", { txid })
      }
    },
    [close, shown],
  )

  const value = useMemo(
    () => ({ celebrate, refresh, isCelebratedHash }),
    [celebrate, refresh, isCelebratedHash],
  )

  return (
    <ReceiveCelebrationContext.Provider value={value}>
      {children}
      {shown && (
        <ReceiveCelebrationOverlay
          celebration={shown}
          onClose={close}
          onDetails={openDetails}
        />
      )}
    </ReceiveCelebrationContext.Provider>
  )
}
