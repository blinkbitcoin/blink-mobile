import React from "react"
import { View } from "react-native"

import { GaloyTertiaryButton } from "@app/components/atomic/galoy-tertiary-button"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { makeStyles } from "@rn-vui/themed"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { PaymentSendExtraInfo } from "./payment-details/index.types"

type Props = {
  /** What a send that did not go out said about itself. */
  failedSend: PaymentSendExtraInfo | undefined
  /** Whether the screen could send now: "send anyway" sends in its place, so it is offered
   *  only then. */
  canSendAnyway: boolean
  /** Sends again, once the sender chose to send anyway and the destination was released. */
  onSendAnyway: () => void
}

/**
 * What the sender can do about a self-custodial send that did not go out: look at the
 * earlier payment to the destination that did, or check their history and, once they
 * have, send anyway.
 */
export const PaymentErrorActions: React.FC<Props> = ({
  failedSend,
  canSendAnyway,
  onSendAnyway,
}) => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const earlierPaymentId = failedSend?.earlierPaymentId
  const sendAnyway = failedSend?.sendAnyway
  const isSendAnywayOffered = Boolean(sendAnyway) && canSendAnyway

  if (earlierPaymentId) {
    return (
      <View style={styles.container}>
        <GaloyTertiaryButton
          title={LL.common.viewTransaction()}
          onPress={() =>
            navigation.navigate("transactionDetail", { txid: earlierPaymentId })
          }
        />
      </View>
    )
  }

  if (failedSend?.checkHistory) {
    const handleSendAnyway = () => {
      sendAnyway?.()
      onSendAnyway()
    }
    return (
      <View style={styles.container}>
        <GaloyTertiaryButton
          title={LL.TransactionScreen.transactionHistoryTitle()}
          onPress={() => navigation.navigate("transactionHistory")}
        />
        {isSendAnywayOffered ? (
          <GaloyTertiaryButton
            title={LL.SendBitcoinConfirmationScreen.sendAnyway()}
            onPress={handleSendAnyway}
          />
        ) : null}
      </View>
    )
  }

  return null
}

const useStyles = makeStyles(() => ({
  container: {
    alignItems: "center",
    gap: 12,
    paddingBottom: 20,
  },
}))
