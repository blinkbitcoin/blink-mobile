import React from "react"
import { fireEvent, render } from "@testing-library/react-native"

import { WalletAmountRow } from "@app/components/wallet-selector"
import { WalletCurrency } from "@app/graphql/generated"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { CARD } from "@app/types/amounts"

import { ContextForScreen } from "../../screens/helper"

const rowWith = (props: Partial<React.ComponentProps<typeof WalletAmountRow>> = {}) =>
  render(
    <ContextForScreen>
      <WalletAmountRow
        inputRef={React.createRef()}
        value=""
        placeholder="0 SAT"
        selection={{ start: 0, end: 0 }}
        isLocked={false}
        onOverlayPress={jest.fn()}
        onFocus={jest.fn()}
        currency={WalletCurrency.Btc}
        balancePrimary="22 SAT"
        {...props}
      />
    </ContextForScreen>,
  )

describe("WalletAmountRow", () => {
  beforeEach(() => {
    loadLocale("en")
  })

  it("shows the Card Balance's pill", () => {
    const { getByText } = rowWith({ currency: CARD })

    expect(getByText("Card")).toBeTruthy()
  })

  it("switches the balance when its pill is tapped", () => {
    const onPillPress = jest.fn()
    const { getByTestId } = rowWith({ onPillPress })

    fireEvent.press(getByTestId(`wallet-switch-${WalletCurrency.Btc}`))

    expect(onPillPress).toHaveBeenCalledTimes(1)
  })

  it("keeps the pill still when the row has no other balance", () => {
    const { getByTestId } = rowWith()

    expect(getByTestId(`wallet-switch-${WalletCurrency.Btc}`)).toBeDisabled()
  })
})
