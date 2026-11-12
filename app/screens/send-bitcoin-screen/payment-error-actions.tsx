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
}

/**
 * What the sender can do about a self-custodial send that did not go out: look at the
 * earlier payment to the destination that did.
 */
export const PaymentErrorActions: React.FC<Props> = ({ failedSend }) => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const earlierPaymentId = failedSend?.earlierPaymentId

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

  return null
}

const useStyles = makeStyles(() => ({
  container: {
    alignItems: "center",
    gap: 12,
    paddingBottom: 20,
  },
}))
