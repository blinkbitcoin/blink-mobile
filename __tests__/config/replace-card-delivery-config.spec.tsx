import React from "react"
import { render, waitFor } from "@testing-library/react-native"
import { Text } from "react-native"

import {
  FeatureFlagContextProvider,
  defaultRemoteConfig,
  useRemoteConfig,
} from "@app/config/feature-flags-context"

const DELIVERY_KEY = "replaceCardDeliveryConfig"

/** What the console holds for the delivery key, as Firebase hands it back. */
const mockDeliveryJson: { current: string } = { current: "" }
jest.mock("@react-native-firebase/remote-config", () => {
  const instance = {
    setDefaults: jest.fn(),
    setConfigSettings: jest.fn(),
    getValue: (key: string) => ({
      getSource: () => "remote",
      asString: () => (key === DELIVERY_KEY ? mockDeliveryJson.current : ""),
      asBoolean: () => false,
      asNumber: () => 0,
    }),
    fetchAndActivate: jest.fn(async () => true),
  }
  return { __esModule: true, default: () => instance }
})

jest.mock("@app/graphql/level-context", () => ({
  useLevel: () => ({ currentLevel: "ZERO" }),
}))

jest.mock("@app/hooks/use-app-config", () => ({
  useAppConfig: () => ({ appConfig: { galoyInstance: { id: "Main" } } }),
}))

jest.mock("@app/hooks/use-has-custodial-account", () => ({
  useHasCustodialAccount: () => false,
}))

jest.mock("@app/self-custodial/analytics", () => ({
  logSelfCustodialRolloutExposed: jest.fn(),
}))

const mockLogError = jest.fn()
jest.mock("@app/utils/log-error", () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
}))

const DeliveryProbe: React.FC = () => {
  const { replaceCardDeliveryConfig } = useRemoteConfig()
  return <Text testID="delivery">{JSON.stringify(replaceCardDeliveryConfig)}</Text>
}

const readDelivery = async () => {
  const view = render(
    <FeatureFlagContextProvider>
      <DeliveryProbe />
    </FeatureFlagContextProvider>,
  )
  let shown: unknown
  await waitFor(() => {
    shown = JSON.parse(view.getByTestId("delivery").props.children)
    expect(shown).toBeDefined()
  })
  return shown
}

const SHIPPED = defaultRemoteConfig.replaceCardDeliveryConfig

/** The parts each report named as rejected; every read reports again, deduplicated
 *  further down by its dedup key. */
const rejectedParts = () =>
  mockLogError.mock.calls
    .filter(([entry]) => entry?.context?.key === DELIVERY_KEY)
    .map(([entry]) => entry.context.rejected)

/** The order and the replacement read the courier's days and the replacement's price
 *  from here, so whatever the console holds, each field reaches them as a usable number:
 *  a field the console gets wrong keeps its shipped value. */
describe("replaceCardDeliveryConfig remote config", () => {
  beforeEach(() => {
    mockDeliveryJson.current = ""
    mockLogError.mockClear()
  })

  it("takes a whole courier the console sets", async () => {
    mockDeliveryJson.current = JSON.stringify({
      courier: { minDays: 2, maxDays: 5, priceUsd: 100 },
    })

    expect(await readDelivery()).toEqual({
      courier: { minDays: 2, maxDays: 5, priceUsd: 100 },
    })
    expect(rejectedParts()).toEqual([])
  })

  it("keeps the shipped courier when the console sets none", async () => {
    mockDeliveryJson.current = JSON.stringify({ standard: { minDays: 7 } })

    expect(await readDelivery()).toEqual(SHIPPED)
    expect(rejectedParts()).toEqual([])
  })

  it("merges a partial courier over the shipped one, field by field", async () => {
    mockDeliveryJson.current = JSON.stringify({ courier: { priceUsd: 100 } })

    expect(await readDelivery()).toEqual({
      courier: { ...SHIPPED.courier, priceUsd: 100 },
    })
  })

  it("keeps the shipped courier and reports it when the courier is null", async () => {
    mockDeliveryJson.current = JSON.stringify({ courier: null })

    expect(await readDelivery()).toEqual(SHIPPED)
    expect(rejectedParts()[0]).toEqual(["courier"])
  })

  it("keeps the shipped courier and reports it when the courier is not an object", async () => {
    mockDeliveryJson.current = JSON.stringify({ courier: "3-7 days" })

    expect(await readDelivery()).toEqual(SHIPPED)
    expect(rejectedParts()[0]).toEqual(["courier"])
  })

  it("keeps the shipped value for a field the console writes as a string", async () => {
    mockDeliveryJson.current = JSON.stringify({
      courier: { minDays: "3", maxDays: 9, priceUsd: 100 },
    })

    expect(await readDelivery()).toEqual({
      courier: { minDays: SHIPPED.courier.minDays, maxDays: 9, priceUsd: 100 },
    })
    expect(rejectedParts()[0]).toEqual(["minDays"])
  })

  it("keeps the shipped value for a negative field", async () => {
    mockDeliveryJson.current = JSON.stringify({ courier: { priceUsd: -100 } })

    expect(await readDelivery()).toEqual(SHIPPED)
    expect(rejectedParts()[0]).toEqual(["priceUsd"])
  })

  it("keeps the shipped days when the console's are out of order", async () => {
    mockDeliveryJson.current = JSON.stringify({
      courier: { minDays: 9, maxDays: 2, priceUsd: 100 },
    })

    expect(await readDelivery()).toEqual({
      courier: { ...SHIPPED.courier, priceUsd: 100 },
    })
    expect(rejectedParts()[0]).toEqual(["days out of order"])
  })

  it("keeps the shipped days when one valid day ends up past the shipped other", async () => {
    mockDeliveryJson.current = JSON.stringify({ courier: { minDays: 9 } })

    expect(await readDelivery()).toEqual(SHIPPED)
    expect(rejectedParts()[0]).toEqual(["days out of order"])
  })

  /** JSON allows a number too large for a double, which parses to Infinity. */
  it("keeps the shipped value for a field that overflows to Infinity", async () => {
    mockDeliveryJson.current = '{"courier":{"priceUsd":1e309}}'

    expect(await readDelivery()).toEqual(SHIPPED)
    expect(rejectedParts()[0]).toEqual(["priceUsd"])
  })

  /** Only the error's message reaches Crashlytics, so it names what was rejected. */
  it("names the rejected parts in the reported error", async () => {
    mockDeliveryJson.current = JSON.stringify({
      courier: { minDays: "3", priceUsd: -1 },
    })

    await readDelivery()

    const [entry] = mockLogError.mock.calls.find(
      ([logged]) => logged?.context?.key === DELIVERY_KEY,
    )
    expect(entry.error.message).toBe(
      'Rejected minDays, priceUsd in "replaceCardDeliveryConfig"',
    )
  })
})
