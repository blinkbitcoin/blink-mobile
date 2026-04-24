import React from "react"
import { render } from "@testing-library/react-native"

import { AutoConvertListenerMount } from "@app/self-custodial/components/auto-convert-listener-mount"

const mockListener = jest.fn()

jest.mock("@app/self-custodial/hooks/use-auto-convert-listener", () => ({
  useAutoConvertListener: () => mockListener(),
}))

describe("AutoConvertListenerMount", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("mounts the listener hook exactly once per render", () => {
    render(<AutoConvertListenerMount />)
    expect(mockListener).toHaveBeenCalledTimes(1)
  })

  it("renders null so it contributes no UI to the tree", () => {
    const { toJSON } = render(<AutoConvertListenerMount />)
    expect(toJSON()).toBeNull()
  })
})
