import React from "react"
import { View } from "react-native"

import { MockedProvider } from "@apollo/client/testing"
import { WalletCurrency } from "@app/graphql/generated"
import { Text, makeStyles } from "@rn-vui/themed"
import { Meta } from "@storybook/react-native"

import { StoryScreen } from "../../../.storybook/views"
import { WalletSummary } from "./wallet-summary"

const useStyles = makeStyles(({ colors }) => ({
  view: { padding: 10, margin: 10, width: 300, backgroundColor: colors.white },
  wrapper: { marginBottom: 10, marginTop: 5 },
  wrapperOutside: { marginVertical: 10 },
}))

export default {
  title: "Wallet Summary",
  decorators: [
    (Story) => (
      <MockedProvider>
        <StoryScreen>{Story()}</StoryScreen>
      </MockedProvider>
    ),
  ],
} as Meta<typeof WalletSummary>

const Wrapper = ({ children, text }) => {
  const styles = useStyles()
  return (
    <View style={styles.view}>
      <View style={styles.wrapperOutside}>
        <Text style={styles.wrapper}>{text}</Text>
        {children}
      </View>
    </View>
  )
}

export const Default = () => (
  <View>
    <Wrapper text="BTC">
      <WalletSummary
        amountType="SEND"
        settlementAmount={{
          currency: WalletCurrency.Btc,
          amount: 2000,
        }}
        txDisplayAmount={129.2}
        txDisplayCurrency="USD"
      />
    </Wrapper>
    <Wrapper text="USD">
      <WalletSummary
        amountType="SEND"
        settlementAmount={{
          currency: WalletCurrency.Usd,
          amount: 2000,
        }}
        txDisplayAmount={200}
        txDisplayCurrency="USD"
      />
    </Wrapper>
  </View>
)
