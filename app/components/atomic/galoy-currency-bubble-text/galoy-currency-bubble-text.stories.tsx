import React from "react"
import { ViewStyle } from "react-native"

import { WalletCurrency } from "@app/graphql/generated"

import { GaloyCurrencyBubbleText } from "./galoy-currency-bubble-text"
import { Story, UseCase } from "../../../../.storybook/views"

const UseCaseWrapper = ({
  children,
  text,
  style,
}: {
  children: React.ReactNode
  text: string
  style: ViewStyle
}) => (
  <UseCase style={style} text={text}>
    {children}
  </UseCase>
)

const styles: { wrapper: ViewStyle } = {
  wrapper: { flexDirection: "row", gap: 12 },
}

export default {
  title: "Galoy Currency Bubble",
  component: GaloyCurrencyBubbleText,
}

export const Default = () => (
  <Story>
    <UseCaseWrapper style={styles.wrapper} text="Text Size: p2 (medium)">
      <GaloyCurrencyBubbleText textSize="p2" currency={WalletCurrency.Btc} />
      <GaloyCurrencyBubbleText textSize="p2" currency={WalletCurrency.Usd} />
    </UseCaseWrapper>
    <UseCaseWrapper style={styles.wrapper} text="Text Size: p1 (large)">
      <GaloyCurrencyBubbleText textSize="p1" currency={WalletCurrency.Btc} />
      <GaloyCurrencyBubbleText textSize="p1" currency={WalletCurrency.Usd} />
    </UseCaseWrapper>
  </Story>
)
