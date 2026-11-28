import React, { useEffect, useMemo, useRef, useState } from "react"
import { RouteProp } from "@react-navigation/native"

import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { OfflineGate } from "@app/self-custodial/components"

import SendBitcoinConfirmationScreen from "./send-bitcoin-confirmation-screen"
import { SettledSendHoldProvider } from "./settled-send-hold"

type Props = { route: RouteProp<RootStackParamList, "sendBitcoinConfirmation"> }

/** Review sits behind the offline gate, which drops it when a self-custodial refresh
 *  fails. A landed payment stays on this screen for Sent, so the hold lives here, above
 *  the gate, and is set synchronously when success is accepted. This wrapper outlives a
 *  gate drop but not the sender leaving, so it also tells the screen which one happened. */
export const SendBitcoinConfirmationGated: React.FC<Props> = (props) => {
  const [bypass, setBypass] = useState(false)
  const isMountedRef = useRef(false)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const settledSendHold = useMemo(
    () => ({
      hold: () => setBypass(true),
      isRouteLive: () => isMountedRef.current,
    }),
    [],
  )

  return (
    <SettledSendHoldProvider value={settledSendHold}>
      <OfflineGate bypass={bypass}>
        <SendBitcoinConfirmationScreen {...props} />
      </OfflineGate>
    </SettledSendHoldProvider>
  )
}
