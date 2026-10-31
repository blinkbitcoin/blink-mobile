import React from "react"
import { ScrollView, useWindowDimensions, View } from "react-native"
import ViewShot, { type ViewShotRef } from "react-native-view-shot"

import LogoDarkMode from "@app/assets/logo/app-logo-dark.svg"
import LogoLightMode from "@app/assets/logo/blink-logo-light.svg"
import { useSettingsScreenQuery } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import {
  NoteSection,
  PaymentDetailsSection,
} from "@app/screens/send-bitcoin-screen/send-bitcoin-completed-screen"
import { makeStyles, useTheme } from "@rn-vui/themed"

type TransactionReceiptProps = {
  isReceive: boolean
  currencyAmount: string
  satAmount?: string
  currencyFeeAmount?: string
  satFeeAmount?: string
  /** The other side of the payment: a username, an address or an invoice */
  counterParty?: string
  createdAt: number
  paymentType: string
  note?: string
}

/**
 * What Share captures: the send receipt, filled from a transaction. It is drawn off
 * screen at the size of the screen, laid out like the send receipt's screen, and only
 * mounted while the capture runs.
 */
export const TransactionReceipt = React.forwardRef<ViewShotRef, TransactionReceiptProps>(
  (
    {
      isReceive,
      currencyAmount,
      satAmount,
      currencyFeeAmount,
      satFeeAmount,
      counterParty,
      createdAt,
      paymentType,
      note,
    },
    ref,
  ) => {
    const styles = useStyles()
    const window = useWindowDimensions()
    const {
      theme: { mode },
    } = useTheme()
    const { LL } = useI18nContext()
    const { data } = useSettingsScreenQuery({ fetchPolicy: "cache-first" })

    const ownUsername = data?.me?.username || LL.common.blinkUser()
    const Logo = mode === "dark" ? LogoDarkMode : LogoLightMode

    return (
      <ViewShot
        ref={ref}
        style={[
          styles.receipt,
          { left: window.width, width: window.width, height: window.height },
        ]}
      >
        <View style={styles.screenContainer}>
          <Logo height={110} />
          <View style={styles.container}>
            <ScrollView>
              <PaymentDetailsSection
                currencyAmount={currencyAmount}
                satAmount={satAmount}
                currencyFeeAmount={currencyFeeAmount}
                satFeeAmount={satFeeAmount}
                usernameTitle={isReceive ? counterParty ?? "" : ownUsername}
                destination={isReceive ? ownUsername : counterParty}
                createdAt={createdAt}
                paymentType={paymentType}
                LL={LL}
              />
              <NoteSection noteMessage={note?.trim() ?? ""} LL={LL} />
            </ScrollView>
          </View>
        </View>
      </ViewShot>
    )
  },
)

TransactionReceipt.displayName = "TransactionReceipt"

// The send receipt screen's layout: logo on top, cards centred below it
const useStyles = makeStyles(({ colors }) => ({
  receipt: {
    position: "absolute",
    top: 0,
    backgroundColor: colors.white,
  },
  screenContainer: {
    flexGrow: 1,
    marginHorizontal: 20,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },
}))
