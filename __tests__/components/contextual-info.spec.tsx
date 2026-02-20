import React from "react"
import { Text as ReactNativeText, View } from "react-native"
import { render, fireEvent } from "@testing-library/react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { ContextualInfo } from "@app/components/contextual-info"
import { Invoice } from "@app/screens/receive-bitcoin-screen/payment/index.types"

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof ReactNativeText>) => (
    <ReactNativeText {...props} />
  ),
  useTheme: () => ({
    theme: {
      colors: {
        grey1: "grey1",
        primary: "primary",
      },
    },
  }),
  makeStyles: () => () => ({
    container: {},
    linkText: {},
  }),
}))

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: ({ name, ...props }: { name: string }) => (
    <View {...props} testID={`galoy-icon-${name}`} />
  ),
}))

jest.mock("@app/components/expiration-time-chooser/expiration-time-modal", () => ({
  ExpirationTimeModal: ({
    isOpen,
    onSetExpirationTime,
  }: {
    isOpen: boolean
    onSetExpirationTime: (time: number) => void
  }) =>
    isOpen ? (
      <View testID="expiration-modal">
        <ReactNativeText
          testID="set-expiration-30"
          onPress={() => onSetExpirationTime(30)}
        >
          30 min
        </ReactNativeText>
      </View>
    ) : null,
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      common: {
        expirationTime: () => "Expiration time",
      },
      ReceiveScreen: {
        depositFee: ({
          fee,
          threshold,
          overFee,
        }: {
          fee: string
          threshold: string
          overFee: string
        }) =>
          `Deposit fee: ${fee} SAT for amounts under ${threshold} SAT or ${overFee} SAT for deposits over ${threshold} SAT`,
      },
    },
  }),
}))

describe("ContextualInfo", () => {
  const mockSetExpirationTime = jest.fn()

  const defaultProps = {
    type: Invoice.Lightning,
    expirationTime: 60,
    setExpirationTime: mockSetExpirationTime,
    walletCurrency: WalletCurrency.Btc,
    canSetExpirationTime: true,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Lightning with canSetExpirationTime", () => {
    it("renders expiration time text", () => {
      const { getByText } = render(<ContextualInfo {...defaultProps} />)

      expect(getByText("Expiration time: 1h")).toBeTruthy()
    })

    it("opens expiration modal on press", () => {
      const { getByText, getByTestId } = render(<ContextualInfo {...defaultProps} />)

      fireEvent.press(getByText("Expiration time: 1h"))

      expect(getByTestId("expiration-modal")).toBeTruthy()
    })

    it("calls setExpirationTime and closes modal when time is selected", () => {
      const { getByText, getByTestId, queryByTestId } = render(
        <ContextualInfo {...defaultProps} />,
      )

      fireEvent.press(getByText("Expiration time: 1h"))
      fireEvent.press(getByTestId("set-expiration-30"))

      expect(mockSetExpirationTime).toHaveBeenCalledWith(30)
      expect(queryByTestId("expiration-modal")).toBeNull()
    })

    it("formats minutes correctly", () => {
      const { getByText } = render(
        <ContextualInfo {...defaultProps} expirationTime={30} />,
      )

      expect(getByText("Expiration time: 30m")).toBeTruthy()
    })

    it("formats single minute correctly", () => {
      const { getByText } = render(
        <ContextualInfo {...defaultProps} expirationTime={1} />,
      )

      expect(getByText("Expiration time: 1m")).toBeTruthy()
    })

    it("formats large hours correctly", () => {
      const { getByText } = render(
        <ContextualInfo {...defaultProps} expirationTime={2880} />,
      )

      expect(getByText("Expiration time: 48h")).toBeTruthy()
    })

    it("shows empty format when expirationTime is 0", () => {
      const { getByText } = render(
        <ContextualInfo {...defaultProps} expirationTime={0} />,
      )

      expect(getByText("Expiration time")).toBeTruthy()
    })
  })

  describe("Lightning without canSetExpirationTime", () => {
    it("returns null", () => {
      const { toJSON } = render(
        <ContextualInfo {...defaultProps} canSetExpirationTime={false} />,
      )

      expect(toJSON()).toBeNull()
    })
  })

  describe("OnChain with feesInformation", () => {
    it("renders deposit fee text", () => {
      const { getByText } = render(
        <ContextualInfo
          {...defaultProps}
          type={Invoice.OnChain}
          canSetExpirationTime={false}
          feesInformation={{
            deposit: { minBankFee: "2500", minBankFeeThreshold: "1000000", ratio: "50" },
          }}
        />,
      )

      expect(
        getByText(
          "Deposit fee: 2,500 SAT for amounts under 1M SAT or 5,000 SAT for deposits over 1M SAT",
        ),
      ).toBeTruthy()
    })

    it("renders warning icon", () => {
      const { getByTestId } = render(
        <ContextualInfo
          {...defaultProps}
          type={Invoice.OnChain}
          canSetExpirationTime={false}
          feesInformation={{
            deposit: { minBankFee: "2500", minBankFeeThreshold: "1000000", ratio: "50" },
          }}
        />,
      )

      expect(getByTestId("galoy-icon-warning")).toBeTruthy()
    })
  })

  describe("OnChain without feesInformation", () => {
    it("returns null", () => {
      const { toJSON } = render(
        <ContextualInfo
          {...defaultProps}
          type={Invoice.OnChain}
          canSetExpirationTime={false}
        />,
      )

      expect(toJSON()).toBeNull()
    })
  })

  describe("PayCode", () => {
    it("returns null", () => {
      const { toJSON } = render(
        <ContextualInfo
          {...defaultProps}
          type={Invoice.PayCode}
          canSetExpirationTime={false}
        />,
      )

      expect(toJSON()).toBeNull()
    })
  })
})
