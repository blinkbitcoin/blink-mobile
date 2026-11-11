import React from "react"
import { render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import { FeatureRow } from "@app/components/card-screen/feature-row"
import theme from "@app/rne-theme/theme"

const mockIconProps = jest.fn()

jest.mock("@app/components/atomic/galoy-icon", () => {
  const actual = jest.requireActual("@app/components/atomic/galoy-icon")
  const { Text } = jest.requireActual("react-native")
  return {
    ...actual,
    GaloyIcon: (props: { name: string }) => {
      mockIconProps(props)
      return <Text testID={`icon-${props.name}`}>{props.name}</Text>
    },
  }
})

const renderRow = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)

describe("FeatureRow", () => {
  beforeEach(() => {
    mockIconProps.mockClear()
  })

  it("shows the icon and the title", () => {
    const { getByTestId, getByText } = renderRow(
      <FeatureRow icon="card" title="Blink Card" />,
    )

    expect(getByTestId("icon-card")).toBeTruthy()
    expect(getByText("Blink Card")).toBeTruthy()
  })

  it("draws the icon in the design's circle", () => {
    renderRow(<FeatureRow icon="headset" title="Personal account manager" />)

    expect(mockIconProps).toHaveBeenCalledWith(
      expect.objectContaining({ size: 17, containerSize: 26 }),
    )
  })

  it("shows the subtitle under the title when given", () => {
    const { getByText } = renderRow(
      <FeatureRow
        icon="card"
        title="Blink Card"
        subtitle="your Visa card, ready today"
      />,
    )

    expect(getByText("your Visa card, ready today")).toBeTruthy()
  })

  it("shows the badge when given", () => {
    const { getByText } = renderRow(
      <FeatureRow icon="wallet" title="Business accounts" badge="in 12 months" />,
    )

    expect(getByText("in 12 months")).toBeTruthy()
  })

  /** An empty string would otherwise reach the tree as bare text outside a `Text`. */
  it("renders nothing extra for an empty subtitle or badge", () => {
    const { toJSON } = renderRow(
      <FeatureRow icon="wallet" title="Virtual accounts" subtitle="" badge="" />,
    )
    const { toJSON: plain } = renderRow(
      <FeatureRow icon="wallet" title="Virtual accounts" />,
    )

    expect(toJSON()).toEqual(plain())
  })
})
