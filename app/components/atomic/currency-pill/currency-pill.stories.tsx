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
    <UseCaseWrapper style={styles.wrapper} text="Default (p3)">
      <CurrencyPill currency={WalletCurrency.Btc} />
      <CurrencyPill currency={WalletCurrency.Usd} />
    </UseCaseWrapper>
  </Story>
)
