import Crypto from "react-native-quick-crypto"

import {
  holdEmergencyPhrase,
  readEmergencyPhrase,
  releaseEmergencyPhrase,
} from "@app/screens/self-custodial/onboarding/restore/emergency/emergency-phrase"

const PHRASE = "abandon abandon about"
const NEXT_PHRASE = "zoo zoo wrong"

describe("emergency phrase holder", () => {
  beforeEach(() => {
    jest
      .mocked(Crypto.randomUUID)
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000001")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000002")
  })

  it("hands back the phrase for the handle it was held under", () => {
    const handle = holdEmergencyPhrase(PHRASE)

    expect(handle).not.toContain("abandon")
    expect(readEmergencyPhrase(handle)).toBe(PHRASE)
  })

  it("reads nothing once the phrase is released", () => {
    const handle = holdEmergencyPhrase(PHRASE)

    releaseEmergencyPhrase(handle)

    expect(readEmergencyPhrase(handle)).toBeNull()
  })

  it("keeps one flow at a time: a new phrase replaces the earlier one", () => {
    const earlier = holdEmergencyPhrase(PHRASE)
    const later = holdEmergencyPhrase(NEXT_PHRASE)

    expect(readEmergencyPhrase(earlier)).toBeNull()
    expect(readEmergencyPhrase(later)).toBe(NEXT_PHRASE)
  })

  it("lets only the flow holding the phrase release it", () => {
    // A screen left over from an earlier flow unmounting late must not wipe
    // the phrase a newer flow is still using.
    const earlier = holdEmergencyPhrase(PHRASE)
    const later = holdEmergencyPhrase(NEXT_PHRASE)

    releaseEmergencyPhrase(earlier)

    expect(readEmergencyPhrase(later)).toBe(NEXT_PHRASE)
    releaseEmergencyPhrase(later)
  })
})
