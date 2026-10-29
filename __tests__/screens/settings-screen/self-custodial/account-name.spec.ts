import { selfCustodialAccountName } from "@app/screens/settings-screen/self-custodial/account-name"

const ANONYMOUS = "Anon user"

describe("selfCustodialAccountName", () => {
  it("names the active account from its live address", () => {
    expect(
      selfCustodialAccountName({
        isActive: true,
        liveLightningAddress: "live@breez.tips",
        persistedLightningAddress: "persisted@breez.tips",
        anonymousName: ANONYMOUS,
      }),
    ).toBe("live")
  })

  /** The live address is empty until the wallet has loaded it, offline or on a slow
   *  connection; the account still has its saved name. */
  it("falls back to the saved address while the live one has not loaded", () => {
    expect(
      selfCustodialAccountName({
        isActive: true,
        liveLightningAddress: null,
        persistedLightningAddress: "persisted@breez.tips",
        anonymousName: ANONYMOUS,
      }),
    ).toBe("persisted")
  })

  /** The live address belongs to whichever account is active, never to this one. */
  it("ignores the live address for an inactive account", () => {
    expect(
      selfCustodialAccountName({
        isActive: false,
        liveLightningAddress: "active@breez.tips",
        persistedLightningAddress: "persisted@breez.tips",
        anonymousName: ANONYMOUS,
      }),
    ).toBe("persisted")
  })

  it("calls an account with no address anonymous", () => {
    expect(
      selfCustodialAccountName({
        isActive: true,
        liveLightningAddress: null,
        persistedLightningAddress: null,
        anonymousName: ANONYMOUS,
      }),
    ).toBe(ANONYMOUS)
  })
})
