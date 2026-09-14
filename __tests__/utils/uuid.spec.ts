import { generateSecureRandom } from "react-native-securerandom"
import { v4 as uuidv4 } from "uuid"

import { generateSecureRandomUUID } from "@app/utils/uuid"

// Root-level module mock, so already a jest.fn returning real random bytes —
// see __mocks__/react-native-securerandom.js.
const mockedSecureRandom = generateSecureRandom as jest.MockedFunction<
  typeof generateSecureRandom
>

describe("generateSecureRandomUUID", () => {
  it("mints a v4 UUID out of exactly the bytes the platform CSPRNG returned", async () => {
    // The bytes must come from react-native-securerandom: under Metro a bare
    // uuidv4() resolves to uuid's browser build, whose RNG is
    // crypto.getRandomValues(), and React Native ships no global crypto — the
    // call throws. The test environment does have one, so only pinning the
    // source of the bytes keeps that regression from going green here.
    const bytes = new Uint8Array(16).fill(7)
    mockedSecureRandom.mockResolvedValueOnce(bytes)

    const id = await generateSecureRandomUUID()

    expect(mockedSecureRandom).toHaveBeenCalledWith(16)
    expect(id).toBe(uuidv4({ random: bytes }))
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })

  it("mints a different id per call", async () => {
    // The whole point per attempt at adding a place: the backend deduplicates
    // on the id, so two attempts must never share one.
    const first = await generateSecureRandomUUID()
    const second = await generateSecureRandomUUID()

    expect(first).not.toBe(second)
  })
})
