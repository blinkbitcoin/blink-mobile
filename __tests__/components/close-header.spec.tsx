import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"

import { CloseHeader } from "@app/components/close-header"

import { ContextForScreen } from "../screens/helper"

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({ navigate: mockNavigate }),
  }
})

const renderHeader = async (props: React.ComponentProps<typeof CloseHeader>) => {
  const utils = render(
    <ContextForScreen>
      <CloseHeader {...props} />
    </ContextForScreen>,
  )

  await act(async () => {})

  return utils
}

describe("CloseHeader", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders under the given test id", async () => {
    const { getByTestId } = await renderHeader({ testID: "flow-close" })

    expect(getByTestId("flow-close")).toBeTruthy()
  })

  /** The default is what every screen in a flow relies on, so it is the load-bearing path. */
  it("leaves the flow for the home tabs when given no handler", async () => {
    const { getByTestId } = await renderHeader({ testID: "flow-close" })

    await act(async () => {
      fireEvent.press(getByTestId("flow-close"))
    })

    expect(mockNavigate).toHaveBeenCalledWith("Primary")
  })

  it("calls the handler instead when one is given", async () => {
    const onClose = jest.fn()
    const { getByTestId } = await renderHeader({ testID: "flow-close", onClose })

    await act(async () => {
      fireEvent.press(getByTestId("flow-close"))
    })

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
