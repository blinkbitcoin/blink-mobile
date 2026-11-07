import { createContext, useContext } from "react"

import { SplashCandidate } from "./types"

/** Apart from the provider, so the screens and hooks that offer payments do not load
 *  the navigation container and the overlay with it. */
type IncomingTransactionSplashContextValue = {
  /** Whether it went on screen. */
  showSplash: (candidate: SplashCandidate) => boolean
  /** Newer data for the payment on screen, such as a sender's note that landed after it,
   *  or the wallet list catching up so Details can open it. */
  refresh: (candidate: SplashCandidate) => void
  /** Whether this Lightning payment hash got the splash, so Receive skips its own haptic. */
  isSplashShownForHash: (paymentHash: string) => boolean
}

export const IncomingTransactionSplashContext =
  createContext<IncomingTransactionSplashContextValue>({
    showSplash: () => false,
    refresh: () => {},
    isSplashShownForHash: () => false,
  })

export const useIncomingTransactionSplash = () =>
  useContext(IncomingTransactionSplashContext)
