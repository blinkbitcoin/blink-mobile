import React from "react"
import { ViewStyle } from "react-native"

import { WalletCurrency } from "../../../graphql/generated"
import { Story, UseCase } from "../../../../.storybook/views"
import { GaloyCurrencyBubbleText } from "./galoy-currency-bubble-text"

const STORY_TITLE = "Galoy Currency Bubble"
const TEXT_SIZE_P2_LABEL = "Text Size: p2 (medium)"
const TEXT_SIZE_P1_LABEL = "Text Size: p1 (large)"

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
  title: STORY_TITLE,
  component: GaloyCurrencyBubbleText,
}

export const Default = () => (
  <Story>
    <UseCaseWrapper style={styles.wrapper} text={TEXT_SIZE_P2_LABEL}>
      <GaloyCurrencyBubbleText textSize="p2" currency={WalletCurrency.Btc} />
      <GaloyCurrencyBubbleText textSize="p2" currency={WalletCurrency.Usd} />
    </UseCaseWrapper>
    <UseCaseWrapper style={styles.wrapper} text={TEXT_SIZE_P1_LABEL}>
      <GaloyCurrencyBubbleText textSize="p1" currency={WalletCurrency.Btc} />
      <GaloyCurrencyBubbleText textSize="p1" currency={WalletCurrency.Usd} />
    </UseCaseWrapper>
  </Story>
)
