import React from "react"
import { render } from "@testing-library/react-native"
import { Network } from "@breeztech/breez-sdk-spark-react-native"

// React 19 react-test-renderer calls window.dispatchEvent for error
// reporting which doesn't exist in React Native jest environment.
if (typeof window !== "undefined" && !window.dispatchEvent) {
  window.dispatchEvent = jest.fn()
}

import { TelemetryContextMount } from "@app/self-custodial/components/telemetry-context-mount"
import { type FiatRate } from "@app/types/price"

const mockSetBandingPrice = jest.fn()
jest.mock("@app/self-custodial/measurement", () => ({
  setMeasurementContext: jest.fn(),
  setBandingPrice: (...args: unknown[]) => mockSetBandingPrice(...args),
}))

const mockRates: { current: FiatRate[] } = { current: [] }
jest.mock("@app/self-custodial/providers/fiat-rates", () => ({
  useFiatRates: () => ({ rates: mockRates.current }),
}))

const mockNetwork = { current: Network.Regtest }
jest.mock("@app/self-custodial/hooks/use-spark-network", () => ({
  useSparkNetwork: () => mockNetwork.current,
}))

const mockTokenIdentifier = jest.fn((_network: Network): string | null => "btkn1usdb")
jest.mock("@app/self-custodial/config", () => ({
  networkLabelFor: () => "regtest",
  sparkTokenIdentifierFor: (network: Network) => mockTokenIdentifier(network),
}))

jest.mock("@app/self-custodial/hooks/use-analytics-collection-gate", () => ({
  useAnalyticsCollectionGate: jest.fn(),
}))
jest.mock("@app/self-custodial/hooks/use-self-custodial-account-mode", () => ({
  useSelfCustodialAccountMode: () => ({ accountMode: null }),
}))
jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({ persistentState: null }),
}))

describe("TelemetryContextMount banding price", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRates.current = []
    mockNetwork.current = Network.Regtest
  })

  it("hands the gate the USD price and the dollar token", () => {
    mockRates.current = [
      { coin: "EUR", value: 90_000 },
      { coin: "USD", value: 100_000 },
    ]

    render(<TelemetryContextMount />)

    expect(mockSetBandingPrice).toHaveBeenLastCalledWith({
      usdPerBtc: 100_000,
      usdTokenIdentifier: "btkn1usdb",
    })
  })

  it("hands over no price while the feed has none", () => {
    render(<TelemetryContextMount />)

    expect(mockSetBandingPrice).toHaveBeenLastCalledWith({
      usdPerBtc: undefined,
      usdTokenIdentifier: "btkn1usdb",
    })
  })

  it("follows the feed when a price arrives", () => {
    const view = render(<TelemetryContextMount />)
    mockRates.current = [{ coin: "USD", value: 120_000 }]

    view.rerender(<TelemetryContextMount />)

    expect(mockSetBandingPrice).toHaveBeenLastCalledWith({
      usdPerBtc: 120_000,
      usdTokenIdentifier: "btkn1usdb",
    })
  })

  it("leaves dollar payments unbanded when the build has no token, rather than throwing", () => {
    mockNetwork.current = Network.Mainnet
    mockTokenIdentifier.mockImplementationOnce(() => {
      throw new Error("SPARK_TOKEN_IDENTIFIER is not configured for this build")
    })

    render(<TelemetryContextMount />)

    expect(mockTokenIdentifier).toHaveBeenCalledWith(Network.Mainnet)
    expect(mockSetBandingPrice).toHaveBeenLastCalledWith({
      usdPerBtc: undefined,
      usdTokenIdentifier: null,
    })
  })
})
