import { resolveGaloyInstanceOrDefault, GALOY_INSTANCES } from "@app/config"

it("get a full object with BBW", () => {
  const res = resolveGaloyInstanceOrDefault({ id: "Main" })

  expect(res).toBe(GALOY_INSTANCES[0])
})

it("get a full object with Staging", () => {
  const res = resolveGaloyInstanceOrDefault({ id: "Staging" })

  expect(res).toBe(GALOY_INSTANCES[1])
})

it("get a full object with Custom", () => {
  const CustomInstance = {
    id: "Custom",
    name: "Custom",
    graphqlUri: "https://api.custom.com/graphql",
    graphqlWsUri: "ws://ws.custom.com/graphql",
    authUrl: "https://api.custom.com",
    posUrl: "https://pay.custom.com/",
    kycUrl: "https://kyc.custom.com/",
    fiatUrl: "https://fiat.custom.com/",
    lnAddressHostname: "custom.com",
    blockExplorer: "https://mempool.space/tx/",
    sparkExplorer: "https://sparkscan.io/tx/",
  } as const

  const res = resolveGaloyInstanceOrDefault(CustomInstance)

  expect(res).toEqual(CustomInstance)
})

it("backfills fields missing from a persisted Custom instance with Main defaults", () => {
  // A Custom instance saved by an older app version predates newly added
  // fields (fiatUrl, sparkExplorer, ...) and so lacks those keys entirely.
  const staleCustomInstance = {
    id: "Custom",
    name: "Custom",
    graphqlUri: "https://api.custom.com/graphql",
    graphqlWsUri: "ws://ws.custom.com/graphql",
    authUrl: "https://api.custom.com",
    posUrl: "https://pay.custom.com/",
    kycUrl: "https://kyc.custom.com/",
    lnAddressHostname: "custom.com",
    blockExplorer: "https://mempool.space/tx/",
  } as never

  const res = resolveGaloyInstanceOrDefault(staleCustomInstance)

  expect(res.sparkExplorer).toBe(GALOY_INSTANCES[0].sparkExplorer)
  expect(res.fiatUrl).toBe(GALOY_INSTANCES[0].fiatUrl)
  // the persisted custom values are kept
  expect(res.id).toBe("Custom")
  expect(res.name).toBe("Custom")
  expect(res.graphqlUri).toBe("https://api.custom.com/graphql")
  expect(res.blockExplorer).toBe("https://mempool.space/tx/")
})

it("backfills fields persisted as undefined on a Custom instance", () => {
  const customInstanceWithUndefined = {
    id: "Custom",
    name: "Custom",
    graphqlUri: "https://api.custom.com/graphql",
    graphqlWsUri: "ws://ws.custom.com/graphql",
    authUrl: "https://api.custom.com",
    posUrl: "https://pay.custom.com/",
    kycUrl: "https://kyc.custom.com/",
    lnAddressHostname: "custom.com",
    blockExplorer: "https://mempool.space/tx/",
    sparkExplorer: undefined,
    fiatUrl: undefined,
  } as never

  const res = resolveGaloyInstanceOrDefault(customInstanceWithUndefined)

  expect(res.sparkExplorer).toBe(GALOY_INSTANCES[0].sparkExplorer)
  expect(res.fiatUrl).toBe(GALOY_INSTANCES[0].fiatUrl)
})
