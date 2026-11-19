import React from "react"

/** Set the moment a send lands, from the screen the offline gate can remove. The
 *  provider sits outside that gate, so the hold survives the refresh that follows
 *  PaymentSucceeded. Absent outside the gated review, so a bare screen is unchanged. */
const HoldSettledSendContext = React.createContext<() => void>(() => {})

export const HoldSettledSendProvider = HoldSettledSendContext.Provider

export const useHoldSettledSend = () => React.useContext(HoldSettledSendContext)
