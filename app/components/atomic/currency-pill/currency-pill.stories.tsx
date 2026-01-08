import React from "react"

import { WalletCurrency } from "@app/graphql/generated"

import { CurrencyPill } from "./currency-pill"
import { Story, UseCase } from "../../../../.storybook/views"

const UseCaseWrapper = ({ children, text, style }) => (
  <UseCase style={style} text={text}>
    {children}
  </UseCase>
)

const styles = {
  wrapper: { flexDirection: "row", gap: 12 },
}

export default {
  title: "Currency Pill",
  component: CurrencyPill,
}

export const Default = () => (
  <Story>
    <UseCaseWrapper style={styles.wrapper} text="Text Size: p2 (medium)">
      <CurrencyPill textSize="p2" currency={WalletCurrency.Btc} />
      <CurrencyPill textSize="p2" currency={WalletCurrency.Usd} />
    </UseCaseWrapper>
    <UseCaseWrapper style={styles.wrapper} text="Text Size: p1 (large)">
      <CurrencyPill textSize="p1" currency={WalletCurrency.Btc} />
      <CurrencyPill textSize="p1" currency={WalletCurrency.Usd} />
    </UseCaseWrapper>
  </Story>
)
