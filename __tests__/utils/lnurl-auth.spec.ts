jest.mock("react-native-keychain", () => ({
  __esModule: true,
  getGenericPassword: jest.fn(),
  setGenericPassword: jest.fn(),
}))

jest.mock("bip32", () => ({
  __esModule: true,
  BIP32Factory: jest.fn(),
}))

jest.mock("bip39", () => ({
  __esModule: true,
  mnemonicToSeedSync: jest.fn(),
}))

jest.mock("react-native-securerandom", () => ({
  __esModule: true,
  generateSecureRandom: jest.fn(),
}))

jest.mock("tiny-secp256k1", () => ({
  __esModule: true,
}))

jest.mock("react-native-quick-crypto", () => {
  const crypto = jest.requireActual("crypto") as typeof import("crypto")

  return {
    __esModule: true,
    default: {
      createHmac: crypto.createHmac,
    },
  }
})

const {
  assertLnurlAuthCallbackDomainMatch,
  assertValidK1,
  composeLnurlAuthCallbackUrl,
  deriveLinkingKey,
  normalizeLnurlAuthDomain,
  signLnurlChallenge,
} = require("@app/utils/lnurl-auth") as typeof import("@app/utils/lnurl-auth")

const keychain = require("react-native-keychain") as {
  getGenericPassword: jest.Mock
  setGenericPassword: jest.Mock
}

const bip39 = require("bip39") as {
  mnemonicToSeedSync: jest.Mock
}

const bip32 = require("bip32") as {
  BIP32Factory: jest.Mock
}

const secureRandom = require("react-native-securerandom") as {
  generateSecureRandom: jest.Mock
}

const parseDerSignature = (signatureHex: string): Buffer => {
  const signature = Buffer.from(signatureHex, "hex")

  expect(signature[0]).toBe(0x30)
  expect(signature[1]).toBe(signature.length - 2)

  const firstIntegerTagOffset = 2
  expect(signature[firstIntegerTagOffset]).toBe(0x02)

  const firstIntegerLengthOffset = 3
  const firstIntegerLength = signature[firstIntegerLengthOffset]
  const secondIntegerTagOffset = firstIntegerLengthOffset + 1 + firstIntegerLength

  expect(signature[secondIntegerTagOffset]).toBe(0x02)

  const secondIntegerLengthOffset = secondIntegerTagOffset + 1
  const secondIntegerLength = signature[secondIntegerLengthOffset]
  const signatureEndOffset = secondIntegerLengthOffset + 1 + secondIntegerLength

  expect(signatureEndOffset).toBe(signature.length)

  return signature
}

describe("lnurl auth utils", () => {
  describe("assertValidK1", () => {
    it("rejects non-hex k1 values", () => {
      expect(() => assertValidK1("z".repeat(64))).toThrow("Invalid LNURL-auth k1")
    })

    it("rejects k1 values with invalid length", () => {
      expect(() => assertValidK1("a".repeat(63))).toThrow("Invalid LNURL-auth k1")
    })
  })

  describe("normalizeLnurlAuthDomain", () => {
    it("lowercases and strips trailing dot", () => {
      expect(normalizeLnurlAuthDomain("Example.COM.")).toBe("example.com")
    })

    it("trims surrounding whitespace before normalizing", () => {
      expect(normalizeLnurlAuthDomain("  Example.COM.  ")).toBe("example.com")
    })

    it("extracts hostname from URL input and strips port", () => {
      expect(normalizeLnurlAuthDomain(" https://Auth.Example.com:443/path ")).toBe(
        "auth.example.com",
      )
    })

    it("returns empty string when input contains only dots and spaces", () => {
      expect(normalizeLnurlAuthDomain(" ... ")).toBe("")
    })

    it("returns empty string for malformed URL-like input", () => {
      expect(normalizeLnurlAuthDomain("https://bad host")).toBe("")
    })
  })

  describe("assertLnurlAuthCallbackDomainMatch", () => {
    it("accepts callback host that matches normalized domain", () => {
      expect(() =>
        assertLnurlAuthCallbackDomainMatch({
          callback: "https://Example.com/login?tag=login",
          domain: " example.com. ",
        }),
      ).not.toThrow()
    })

    it("rejects callback host that does not match domain", () => {
      expect(() =>
        assertLnurlAuthCallbackDomainMatch({
          callback: "https://evil.com/login?tag=login",
          domain: "example.com",
        }),
      ).toThrow("LNURL-auth callback domain mismatch")
    })

    it("accepts callback subdomain for the same root domain", () => {
      expect(() =>
        assertLnurlAuthCallbackDomainMatch({
          callback: "https://auth.satsai.tools/login?tag=login",
          domain: "satsai.tools",
        }),
      ).not.toThrow()
    })

    it("rejects callback domains that only contain the domain as a suffix", () => {
      expect(() =>
        assertLnurlAuthCallbackDomainMatch({
          callback: "https://satsai.tools.evil.com/login?tag=login",
          domain: "satsai.tools",
        }),
      ).toThrow("LNURL-auth callback domain mismatch")
    })

    it("rejects invalid callback URL", () => {
      expect(() =>
        assertLnurlAuthCallbackDomainMatch({
          callback: "not-a-url",
          domain: "example.com",
        }),
      ).toThrow("Invalid LNURL-auth callback URL")
    })

    it("rejects non-https callback URLs for non-localhost domains", () => {
      expect(() =>
        assertLnurlAuthCallbackDomainMatch({
          callback: "http://example.com/login",
          domain: "example.com",
        }),
      ).toThrow("Invalid LNURL-auth callback protocol")
    })

    it("allows http callback URLs on localhost", () => {
      expect(() =>
        assertLnurlAuthCallbackDomainMatch({
          callback: "http://localhost:3000/login",
          domain: "localhost",
        }),
      ).not.toThrow()
    })
  })

  describe("composeLnurlAuthCallbackUrl", () => {
    it("preserves existing query params and appends auth params", () => {
      const callback = "https://example.com/callback?existing=value"
      const composedUrl = composeLnurlAuthCallbackUrl({
        callback,
        k1: "b".repeat(64),
        sig: "c".repeat(140),
        key: "02".padEnd(66, "1"),
      })

      const composed = new URL(composedUrl)

      expect(composed.searchParams.get("existing")).toBe("value")
      expect(composed.searchParams.get("k1")).toBe("b".repeat(64))
      expect(composed.searchParams.get("sig")).toBe("c".repeat(140))
      expect(composed.searchParams.get("key")).toBe("02".padEnd(66, "1"))
    })
  })

  describe("signLnurlChallenge", () => {
    it("returns DER encoded signature with ASN.1 sequence shape", () => {
      const privateKey = Buffer.from(
        "1e99423a4ed27608a15a2616f8f4f15b8f7f7e3f7f6fd2f489f95b0d7db6b2f0",
        "hex",
      )
      const k1 = "0f".repeat(32)

      const signatureHex = signLnurlChallenge(privateKey, k1)
      const signature = parseDerSignature(signatureHex)

      expect(signatureHex.startsWith("30")).toBe(true)
      expect(signature.length).toBeGreaterThanOrEqual(8)
      expect(signature.length).toBeLessThanOrEqual(72)
    })

    it("matches deterministic DER regression vector", () => {
      const privateKey = Buffer.from(
        "1e99423a4ed27608a15a2616f8f4f15b8f7f7e3f7f6fd2f489f95b0d7db6b2f0",
        "hex",
      )
      const k1 = "0f".repeat(32)

      expect(signLnurlChallenge(privateKey, k1)).toBe(
        "30440220676eab84b6ba7c5cbbcfc5fe0aa1baef6ad14f8ee39993e364e43212c03cd86102201f776d6344a9c1afc72ebc795c8032def1192d7cf37da697de85d6f975471dd2",
      )
    })
  })

  describe("deriveLinkingKey", () => {
    const mnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

    const createDeterministicNode = (path: Array<number | string>) => {
      const crypto = jest.requireActual("crypto") as typeof import("crypto")
      const material = crypto.createHash("sha256").update(path.join("/")).digest()
      const privateKey = Buffer.from(material)
      const publicKey = Buffer.concat([Buffer.from([0x02]), material])

      return {
        privateKey,
        publicKey,
        derive: (index: number) => createDeterministicNode([...path, index]),
        deriveHardened: (index: number) =>
          createDeterministicNode([...path, `h${index}`]),
      }
    }

    beforeEach(() => {
      keychain.getGenericPassword.mockResolvedValue({ username: "", password: mnemonic })
      keychain.setGenericPassword.mockResolvedValue(true)
      bip39.mnemonicToSeedSync.mockReturnValue(Buffer.from("test-seed", "utf8"))
      secureRandom.generateSecureRandom.mockResolvedValue(new Uint8Array(32).fill(7))
      bip32.BIP32Factory.mockReturnValue({
        fromSeed: jest.fn(() => createDeterministicNode(["m"])),
      })
    })

    it("derives deterministic key material for normalized domain", async () => {
      const result = await deriveLinkingKey("  Example.com. ")

      const crypto = jest.requireActual("crypto") as typeof import("crypto")
      const hashingPrivateKey = createDeterministicNode(["m", "h138", 0]).privateKey
      const digest = crypto
        .createHmac("sha256", hashingPrivateKey)
        .update("example.com", "utf8")
        .digest()
      const pathSegments = [0, 4, 8, 12].map((offset) => digest.readUInt32BE(offset))

      const expectedNode = pathSegments.reduce(
        (node, index) => node.derive(index),
        createDeterministicNode(["m", "h138"]),
      )

      expect(result.privateKey.equals(expectedNode.privateKey)).toBe(true)
      expect(result.publicKey).toBe(expectedNode.publicKey.toString("hex"))
    })

    it("throws for empty normalized domain", async () => {
      await expect(deriveLinkingKey(" ... ")).rejects.toThrow("Invalid LNURL-auth domain")
    })

    it("creates and stores fallback LNURL-auth seed when mnemonic is missing", async () => {
      keychain.getGenericPassword
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)

      const result = await deriveLinkingKey("example.com")

      expect(keychain.setGenericPassword).toHaveBeenCalledWith(
        "lnurl-auth-seed",
        "0707070707070707070707070707070707070707070707070707070707070707",
        { service: "lnurl-auth-seed" },
      )
      expect(result.publicKey).toHaveLength(66)
    })
  })
})
