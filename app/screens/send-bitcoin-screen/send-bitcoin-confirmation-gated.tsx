import React, { useCallback, useState } from "react"
import { RouteProp } from "@react-navigation/native"

import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { OfflineGate } from "@app/self-custodial/components"

import SendBitcoinConfirmationScreen from "./send-bitcoin-confirmation-screen"
import { HoldSettledSendProvider } from "./settled-send-hold"

type Props = { route: RouteProp<RootStackParamList, "sendBitcoinConfirmation"> }

/** Review sits behind the offline gate, which drops it when a self-custodial refresh
 *  fails. A landed payment stays on this screen for Sent, so the hold lives here, above
 *  the gate, and is set synchronously when success is accepted. */
export const SendBitcoinConfirmationGated: React.FC<Props> = (props) => {
  const [bypass, setBypass] = useState(false)
  const holdSettledSend = useCallback(() => setBypass(true), [])

  return (
    <HoldSettledSendProvider value={holdSettledSend}>
      <OfflineGate bypass={bypass}>
        <SendBitcoinConfirmationScreen {...props} />
      </OfflineGate>
    </HoldSettledSendProvider>
  )
}
