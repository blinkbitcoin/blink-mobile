import React from "react"

type SettledSendHold = {
  /** Set the moment a send lands, from the screen the offline gate can remove. */
  hold: () => void
  /** True while review's route is still mounted, so an unmounted screen can tell the
   *  gate dropping it from the sender leaving. */
  isRouteLive: () => boolean
}

/** The provider sits outside that gate, so the hold survives the refresh that follows
 *  PaymentSucceeded. Absent outside the gated review, so a bare screen is unchanged and
 *  never counts as dropped by the gate. */
const SettledSendHoldContext = React.createContext<SettledSendHold>({
  hold: () => {},
  isRouteLive: () => false,
})

export const SettledSendHoldProvider = SettledSendHoldContext.Provider

export const useSettledSendHold = () => React.useContext(SettledSendHoldContext)
