import { Network } from "@breeztech/breez-sdk-spark-react-native"
import { renderHook } from "@testing-library/react-native"

const mockUseAppConfig = jest.fn()

jest.mock("@app/hooks/use-app-config", () => ({
  useAppConfig: () => mockUseAppConfig(),
}))

import { useSparkNetwork } from "@app/self-custodial/hooks/use-spark-network"

const renderForInstance = (id: string): Network => {
  mockUseAppConfig.mockReturnValue({ appConfig: { galoyInstance: { id } } })
  return renderHook(() => useSparkNetwork()).result.current
}

describe("useSparkNetwork", () => {
  it("uses mainnet for the Main instance", () => {
    expect(renderForInstance("Main")).toBe(Network.Mainnet)
  })

  it("uses regtest for the Staging instance", () => {
    expect(renderForInstance("Staging")).toBe(Network.Regtest)
  })

  it("uses regtest for the Local instance", () => {
    expect(renderForInstance("Local")).toBe(Network.Regtest)
  })

  it("uses regtest for a Custom instance", () => {
    expect(renderForInstance("Custom")).toBe(Network.Regtest)
  })
})
