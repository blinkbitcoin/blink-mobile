import React from "react"
import { Text as ReactNativeText } from "react-native"
import { render } from "@testing-library/react-native"

import { ErrorBanner } from "@app/components/error-banner/error-banner"

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof ReactNativeText>) => (
    <ReactNativeText {...props} />
  ),
  makeStyles: () => () => ({
    wrapper: {},
    fixedHeight: {},
    inner: {},
    iconColor: { color: "white" },
    textColor: { color: "white" },
  }),
}))

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: ({ name }: { name: string }) => {
    const ReactNative = jest.requireActual("react-native")
    return (
      <ReactNative.View testID="galoy-icon">
        <ReactNative.Text>{name}</ReactNative.Text>
      </ReactNative.View>
    )
  },
}))

describe("ErrorBanner", () => {
  it("renders error message with icon", () => {
    const { getByText, getByTestId } = render(<ErrorBanner message="Error occurred" />)

    expect(getByText("Error occurred")).toBeTruthy()
    expect(getByTestId("galoy-icon")).toBeTruthy()
    expect(getByText("warning")).toBeTruthy()
  })

  it("does not render message when message is null", () => {
    const { queryByText } = render(<ErrorBanner message={null} />)

    expect(queryByText("warning")).toBeNull()
  })

  it("does not render message when message is empty string", () => {
    const { queryByText } = render(<ErrorBanner message="" />)

    expect(queryByText("warning")).toBeNull()
  })

  it("does not render message when message is only whitespace", () => {
    const { queryByText } = render(<ErrorBanner message="   " />)

    expect(queryByText("warning")).toBeNull()
  })

  it("renders message when message has content after trimming", () => {
    const { getByText } = render(<ErrorBanner message="  Error message  " />)

    expect(getByText("Error message")).toBeTruthy()
  })
})
