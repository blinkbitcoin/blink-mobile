import React from "react"
import { render } from "@testing-library/react-native"

import { DeleteAccountHasFundsModal } from "@app/screens/settings-screen/self-custodial/delete-account-has-funds-modal"
import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"

const lastBodyArgs: { balance?: string } = {}
jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      SelfCustodialDelete: {
        hasFundsWarningTitle: () => "Warning",
        hasFundsWarningBody: ({ balance }: { balance: string }) => {
          lastBodyArgs.balance = balance
          return `Your wallet has a balance of ${balance}.`
        },
        hasFundsWarningHelper: () => "To proceed with deletion, empty the account.",
        hasFundsWarningButton: () => "Go back",
      },
    },
  }),
}))

jest.mock("@rn-vui/themed", () => {
  const colors = { warning: "#f80", _black: "#000", black: "#000" }
  return {
    makeStyles:
      (fn: (theme: { colors: Record<string, string> }) => Record<string, object>) => () =>
        fn({ colors }),
    Text: ({ children }: { children: React.ReactNode }) =>
      React.createElement("Text", null, children),
    useTheme: () => ({ theme: { colors } }),
  }
})

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: () => null,
}))

jest.mock("@app/components/custom-modal/custom-modal", () => {
  const ReactActual = jest.requireActual("react")
  return {
    __esModule: true,
    default: (props: { isVisible: boolean; body: React.ReactNode }) =>
      props.isVisible
        ? ReactActual.createElement("View", { testID: "custom-modal" }, props.body)
        : null,
  }
})

const mockFormatMoneyAmount = jest.fn(
  ({ moneyAmount }: { moneyAmount: { amount: number } }) => `${moneyAmount.amount} SAT`,
)
jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({ formatMoneyAmount: mockFormatMoneyAmount }),
}))

describe("DeleteAccountHasFundsModal", () => {
  beforeEach(() => {
    lastBodyArgs.balance = undefined
    mockFormatMoneyAmount.mockClear()
  })

  it("does not render when isVisible is false", () => {
    const { queryByTestId } = render(
      <DeleteAccountHasFundsModal
        isVisible={false}
        onClose={() => {}}
        wallets={[{ balance: toBtcMoneyAmount(522) }]}
      />,
    )

    expect(queryByTestId("custom-modal")).toBeNull()
  })

  it("renders the modal and feeds the formatted balance into the i18n body template", () => {
    const { getByTestId } = render(
      <DeleteAccountHasFundsModal
        isVisible={true}
        onClose={() => {}}
        wallets={[{ balance: toBtcMoneyAmount(522) }]}
      />,
    )

    expect(getByTestId("custom-modal")).toBeTruthy()
    expect(lastBodyArgs.balance).toBe("522 SAT")
  })

  it("joins multiple funded wallets with ' + ' and skips zero balances", () => {
    render(
      <DeleteAccountHasFundsModal
        isVisible={true}
        onClose={() => {}}
        wallets={[
          { balance: toBtcMoneyAmount(522) },
          { balance: toUsdMoneyAmount(0) },
          { balance: toUsdMoneyAmount(987) },
        ]}
      />,
    )

    expect(lastBodyArgs.balance).toBe("522 SAT + 987 SAT")
  })
})
