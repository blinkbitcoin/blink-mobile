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
import { IncomingTransactionSplashOverlay } from "./incoming-transaction-splash-overlay"
import { SplashCandidate } from "./types"
import { toastSplashSetting, useSplashSettings } from "./use-splash-settings"

export type ShownSplash = SplashCandidate & {
  amountSats: number
  /** The balance was hidden when it landed: the amounts stay masked until a tap on the
   *  splash shows them. The tap never changes the hide-balance setting. */
  amountHidden: boolean
}

type IncomingTransactionSplashContextValue = {
  showSplash: (candidate: SplashCandidate) => void
  /** Newer data for the payment on screen, such as a sender's note that landed after it,
   *  or the wallet list catching up so Details can open it. */
  refresh: (candidate: SplashCandidate) => void
  /** Whether this Lightning payment hash got the splash, so Receive skips its own haptic. */
  isSplashShownForHash: (paymentHash: string) => boolean
}

const IncomingTransactionSplashContext =
  createContext<IncomingTransactionSplashContextValue>({
    showSplash: () => {},
    refresh: () => {},
    isSplashShownForHash: () => false,
  })

export const useIncomingTransactionSplash = () =>
  useContext(IncomingTransactionSplashContext)

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

  const dismiss = useCallback(() => setShown(null), [])

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

  const showSplash = useCallback(
    (candidate: SplashCandidate) => {
      const alreadySeen = seenIds.current.has(candidate.transaction.id)
      if (!alreadySeen) seenIds.current.add(candidate.transaction.id)

      const routeName = navigationRef.isReady()
        ? navigationRef.getCurrentRoute()?.name
        : undefined
      const current = gate.current
      const decision = decideSplash({
        candidate,
        foregroundSinceMs: foregroundSince.current,
        appActive: AppState.currentState === "active",
        alreadySeen,
        enabled: current.settings.enabled,
        minSats: current.settings.minSats,
        amountSats: toSats(candidate),
        routeName,
        keyboardVisible: Keyboard.isVisible(),
        appLocked: current.isAppLocked,
      })
      if (decision.outcome !== "show") return

      if (candidate.paymentHash) splashHashes.current.add(candidate.paymentHash)
      const next: ShownSplash = {
        ...candidate,
        amountSats: decision.amountSats,
        amountHidden: current.balanceHidden,
      }
      setShown(next)
    },
    [toSats],
  )

  const refresh = useCallback((candidate: SplashCandidate) => {
    setShown((current) =>
      current && current.transaction.id === candidate.transaction.id
        ? { ...current, ...candidate }
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
      }
      setShown(null)
    },
    [settings, LL],
  )

  const openDetails = useCallback(
    ({ optedOut }: { optedOut: boolean }) => {
      if (!shown || shown.detailsPending) return
      const txid = shown.transaction.id
      const unclaimedDeposit = shown.unclaimedDeposit === true
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
    () => ({ showSplash, refresh, isSplashShownForHash }),
    [showSplash, refresh, isSplashShownForHash],
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
