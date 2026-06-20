import React from "react"
import { Network as mockSparkNetwork } from "@breeztech/breez-sdk-spark-react-native"
import { render } from "@testing-library/react-native"

jest.mock("react-native-config", () => ({}))
jest.mock("react-native-fs", () => ({ DocumentDirectoryPath: "/test" }))

const mockUI = jest.fn((_props: Record<string, unknown>) => null)
jest.mock("@app/components/set-lightning-address-modal", () => ({
  SetLightningAddressModalUI: mockUI,
}))

const mockRegister = jest.fn()
const mockSetLnAddress = jest.fn()
let lastOnRegistered: () => void = () => {}
jest.mock("@app/self-custodial/hooks/use-register-lightning-address", () => ({
  useRegisterLightningAddress: (onRegistered: () => void) => {
    lastOnRegistered = onRegistered
    return {
      lnAddress: "alice",
      error: undefined,
      loading: false,
      setLnAddress: mockSetLnAddress,
      register: mockRegister,
    }
  },
}))

let mockNetwork = mockSparkNetwork.Regtest
jest.mock("@app/self-custodial/hooks/use-spark-network", () => ({
  useSparkNetwork: () => mockNetwork,
}))

jest.mock("@app/hooks", () => ({
  useAppConfig: () => ({ appConfig: { galoyInstance: { name: "Blink" } } }),
}))

import { SetSelfCustodialLightningAddressModal } from "@app/screens/settings-screen/self-custodial/set-lightning-address-modal"

const lastProps = (): Record<string, unknown> =>
  (mockUI.mock.calls.at(-1)?.[0] ?? {}) as Record<string, unknown>

describe("SetSelfCustodialLightningAddressModal", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockNetwork = mockSparkNetwork.Regtest
  })

  it("renders the shared modal UI with the staging Blink LNURL host on regtest", () => {
    render(<SetSelfCustodialLightningAddressModal isVisible toggleModal={jest.fn()} />)

    expect(lastProps().hostname).toBe("staging.blink.sv")
    expect(lastProps().bankName).toBe("Blink")
    expect(lastProps().lnAddress).toBe("alice")
    expect(lastProps().loading).toBe(false)
    expect(lastProps().setLnAddress).toBe(mockSetLnAddress)
  })

  it("uses the production Blink LNURL host on mainnet", () => {
    mockNetwork = mockSparkNetwork.Mainnet

    render(<SetSelfCustodialLightningAddressModal isVisible toggleModal={jest.fn()} />)

    expect(lastProps().hostname).toBe("blink.sv")
  })

  it("wires register to the primary action and passes toggleModal as the onRegistered callback", () => {
    const toggleModal = jest.fn()
    render(<SetSelfCustodialLightningAddressModal isVisible toggleModal={toggleModal} />)
    ;(lastProps().onSetLightningAddress as () => void)()
    expect(mockRegister).toHaveBeenCalledTimes(1)

    lastOnRegistered()
    expect(toggleModal).toHaveBeenCalledTimes(1)
  })
})
