import * as React from "react"
import { Text as ReactNativeText } from "react-native"
import { fireEvent, render } from "@testing-library/react-native"

import { UnseenTxAmountBadge } from "@app/components/unseen-tx-amount-badge"

jest.mock("@app/components/animations", () => {
  return {
    useDropInAnimation: () => ({ opacity: 1, translateY: 0 }),
  }
})

type RnThemedTextProps = React.ComponentProps<typeof ReactNativeText>

type MakeStylesFn = (
  theme: {
    colors: {
      grey2: string
      _green: string
    }
  },
  props: unknown,
) => Record<string, unknown>

jest.mock("@rn-vui/themed", () => {
  return {
    Text: (props: RnThemedTextProps) => <ReactNativeText {...props} />,
    makeStyles: (stylesFn: MakeStylesFn) => (props: unknown) =>
      stylesFn(
        {
          colors: {
            grey2: "grey2",
            _green: "green",
          },
        },
        props,
      ),
  }
})

describe("UnseenTxAmountBadge", () => {
  it("renders the amount text when visible", () => {
    const { getByText } = render(
      <UnseenTxAmountBadge amountText={"+USD 5"} visible={true} />,
    )

    expect(getByText("+USD 5")).toBeTruthy()
  })

  it("does not render text when not visible", () => {
    const { queryByText } = render(
      <UnseenTxAmountBadge amountText={"+USD 5"} visible={false} />,
    )

    expect(queryByText("+USD 5")).toBeNull()
  })

  it("calls onPress when pressed", () => {
    const onPress = jest.fn()

    const { getByLabelText } = render(
      <UnseenTxAmountBadge amountText={"+USD 5"} visible={true} onPress={onPress} />,
    )

    fireEvent.press(getByLabelText("+USD 5"))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it("uses outgoing styling when isOutgoing is true", () => {
    const { getByText: getByTextOutgoing } = render(
      <UnseenTxAmountBadge amountText={"-BTC 1"} visible={true} isOutgoing={true} />,
    )

    expect(getByTextOutgoing("-BTC 1")).toHaveStyle({ color: "grey2" })

    const { getByText: getByTextIncoming } = render(
      <UnseenTxAmountBadge amountText={"+BTC 1"} visible={true} isOutgoing={false} />,
    )

    expect(getByTextIncoming("+BTC 1")).toHaveStyle({ color: "green" })
  })
})
