import { act, renderHook } from "@testing-library/react-native"
import { Platform } from "react-native"

import {
  CredentialError,
  isCredentialBackupAvailable,
  useCredentialBackup,
} from "@app/screens/spark-onboarding/hooks/use-credential-backup"

const mockSignUpWithPassword = jest.fn()
const mockSignIn = jest.fn()

jest.mock("react-native-credentials-manager", () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
  signUpWithPassword: (...args: unknown[]) => mockSignUpWithPassword(...args),
}))

const mockSetInternetCredentials = jest.fn()
const mockGetInternetCredentials = jest.fn()

jest.mock("react-native-keychain", () => ({
  setInternetCredentials: (...args: unknown[]) => mockSetInternetCredentials(...args),
  getInternetCredentials: (...args: unknown[]) => mockGetInternetCredentials(...args),
  ACCESSIBLE: { AFTER_FIRST_UNLOCK: "AccessibleAfterFirstUnlock" },
}))

jest.mock("@app/config/appinfo", () => ({
  BLINK_DOMAIN: "blink.sv",
}))

const setPlatform = (os: typeof Platform.OS) => {
  Object.defineProperty(Platform, "OS", { configurable: true, value: os })
}

describe("useCredentialBackup", () => {
  const originalPlatform = Platform.OS
  const walletIdentifier = "02abcdef0123"
  const mnemonic = "youth indicate void"

  beforeEach(() => {
    jest.clearAllMocks()
    setPlatform(originalPlatform)
  })

  afterAll(() => {
    setPlatform(originalPlatform)
  })

  describe("CredentialError enum", () => {
    it("exposes the four expected error keys", () => {
      expect(CredentialError).toEqual({
        NoProvider: "no-provider",
        UserCancelled: "user-cancelled",
        Unsupported: "unsupported",
        Unknown: "unknown",
      })
    })
  })

  describe("save on Android", () => {
    beforeEach(() => setPlatform("android"))

    it("calls signUpWithPassword and returns success", async () => {
      mockSignUpWithPassword.mockResolvedValue({ type: "password", success: true })

      const { result } = renderHook(() => useCredentialBackup())
      let saveResult
      await act(async () => {
        saveResult = await result.current.save(walletIdentifier, mnemonic)
      })

      expect(mockSignUpWithPassword).toHaveBeenCalledWith({
        username: walletIdentifier,
        password: mnemonic,
      })
      expect(saveResult).toEqual({ success: true })
    })

    it("classifies cancellation errors", async () => {
      mockSignUpWithPassword.mockRejectedValue(new Error("CANCELLED by user"))

      const { result } = renderHook(() => useCredentialBackup())
      let saveResult
      await act(async () => {
        saveResult = await result.current.save(walletIdentifier, mnemonic)
      })

      expect(saveResult).toEqual({
        success: false,
        error: CredentialError.UserCancelled,
      })
    })

    it("classifies CANCELED (American spelling) as user cancellation", async () => {
      mockSignUpWithPassword.mockRejectedValue(new Error("operation CANCELED"))

      const { result } = renderHook(() => useCredentialBackup())
      let saveResult
      await act(async () => {
        saveResult = await result.current.save(walletIdentifier, mnemonic)
      })

      expect(saveResult).toEqual({
        success: false,
        error: CredentialError.UserCancelled,
      })
    })

    it("classifies no-credential errors as no-provider", async () => {
      mockSignUpWithPassword.mockRejectedValue(new Error("NO_CREDENTIAL_AVAILABLE"))

      const { result } = renderHook(() => useCredentialBackup())
      let saveResult
      await act(async () => {
        saveResult = await result.current.save(walletIdentifier, mnemonic)
      })

      expect(saveResult).toEqual({
        success: false,
        error: CredentialError.NoProvider,
      })
    })

    it("falls back to unknown for unrecognised messages", async () => {
      mockSignUpWithPassword.mockRejectedValue(new Error("Some random failure"))

      const { result } = renderHook(() => useCredentialBackup())
      let saveResult
      await act(async () => {
        saveResult = await result.current.save(walletIdentifier, mnemonic)
      })

      expect(saveResult).toEqual({ success: false, error: CredentialError.Unknown })
    })

    it("returns unknown when a non-Error value is thrown", async () => {
      mockSignUpWithPassword.mockRejectedValue("plain string")

      const { result } = renderHook(() => useCredentialBackup())
      let saveResult
      await act(async () => {
        saveResult = await result.current.save(walletIdentifier, mnemonic)
      })

      expect(saveResult).toEqual({ success: false, error: CredentialError.Unknown })
    })
  })

  describe("save on iOS", () => {
    beforeEach(() => setPlatform("ios"))

    it("calls setInternetCredentials with sync-compatible options", async () => {
      mockSetInternetCredentials.mockResolvedValue({ service: "blink.sv" })

      const { result } = renderHook(() => useCredentialBackup())
      let saveResult
      await act(async () => {
        saveResult = await result.current.save(walletIdentifier, mnemonic)
      })

      expect(mockSetInternetCredentials).toHaveBeenCalledWith(
        "blink.sv",
        walletIdentifier,
        mnemonic,
        {
          accessible: "AccessibleAfterFirstUnlock",
          cloudSync: true,
        },
      )
      expect(saveResult).toEqual({ success: true })
    })

    it("returns unknown when keychain returns false", async () => {
      mockSetInternetCredentials.mockResolvedValue(false)

      const { result } = renderHook(() => useCredentialBackup())
      let saveResult
      await act(async () => {
        saveResult = await result.current.save(walletIdentifier, mnemonic)
      })

      expect(saveResult).toEqual({ success: false, error: CredentialError.Unknown })
    })

    it("maps thrown errors via classify", async () => {
      mockSetInternetCredentials.mockRejectedValue(new Error("CANCELLED"))

      const { result } = renderHook(() => useCredentialBackup())
      let saveResult
      await act(async () => {
        saveResult = await result.current.save(walletIdentifier, mnemonic)
      })

      expect(saveResult).toEqual({
        success: false,
        error: CredentialError.UserCancelled,
      })
    })
  })

  describe("save on an unsupported platform", () => {
    beforeEach(() => setPlatform("web"))

    it("returns Unsupported without invoking either backend", async () => {
      const { result } = renderHook(() => useCredentialBackup())
      let saveResult
      await act(async () => {
        saveResult = await result.current.save(walletIdentifier, mnemonic)
      })

      expect(saveResult).toEqual({
        success: false,
        error: CredentialError.Unsupported,
      })
      expect(mockSignUpWithPassword).not.toHaveBeenCalled()
      expect(mockSetInternetCredentials).not.toHaveBeenCalled()
    })
  })

  describe("read on Android", () => {
    beforeEach(() => setPlatform("android"))

    it("calls signIn with password option and returns the credential", async () => {
      mockSignIn.mockResolvedValue({
        type: "password",
        username: walletIdentifier,
        password: mnemonic,
      })

      const { result } = renderHook(() => useCredentialBackup())
      let readResult
      await act(async () => {
        readResult = await result.current.read()
      })

      expect(mockSignIn).toHaveBeenCalledWith(["password"], {})
      expect(readResult).toEqual({
        success: true,
        walletIdentifier,
        mnemonic,
      })
    })

    it("classifies cancellation errors", async () => {
      mockSignIn.mockRejectedValue(new Error("user CANCELLED"))

      const { result } = renderHook(() => useCredentialBackup())
      let readResult
      await act(async () => {
        readResult = await result.current.read()
      })

      expect(readResult).toEqual({
        success: false,
        error: CredentialError.UserCancelled,
      })
    })

    it("classifies no-credential errors as no-provider", async () => {
      mockSignIn.mockRejectedValue(new Error("NO_CREDENTIAL_AVAILABLE"))

      const { result } = renderHook(() => useCredentialBackup())
      let readResult
      await act(async () => {
        readResult = await result.current.read()
      })

      expect(readResult).toEqual({
        success: false,
        error: CredentialError.NoProvider,
      })
    })

    it("falls back to unknown for unrecognised errors", async () => {
      mockSignIn.mockRejectedValue(new Error("network blew up"))

      const { result } = renderHook(() => useCredentialBackup())
      let readResult
      await act(async () => {
        readResult = await result.current.read()
      })

      expect(readResult).toEqual({ success: false, error: CredentialError.Unknown })
    })
  })

  describe("read on iOS", () => {
    beforeEach(() => setPlatform("ios"))

    it("calls getInternetCredentials and returns username + password", async () => {
      mockGetInternetCredentials.mockResolvedValue({
        server: "blink.sv",
        username: walletIdentifier,
        password: mnemonic,
      })

      const { result } = renderHook(() => useCredentialBackup())
      let readResult
      await act(async () => {
        readResult = await result.current.read()
      })

      expect(mockGetInternetCredentials).toHaveBeenCalledWith("blink.sv")
      expect(readResult).toEqual({
        success: true,
        walletIdentifier,
        mnemonic,
      })
    })

    it("returns NoProvider when keychain has no entry", async () => {
      mockGetInternetCredentials.mockResolvedValue(false)

      const { result } = renderHook(() => useCredentialBackup())
      let readResult
      await act(async () => {
        readResult = await result.current.read()
      })

      expect(readResult).toEqual({
        success: false,
        error: CredentialError.NoProvider,
      })
    })

    it("maps thrown errors via classify", async () => {
      mockGetInternetCredentials.mockRejectedValue(new Error("CANCELLED"))

      const { result } = renderHook(() => useCredentialBackup())
      let readResult
      await act(async () => {
        readResult = await result.current.read()
      })

      expect(readResult).toEqual({
        success: false,
        error: CredentialError.UserCancelled,
      })
    })
  })

  describe("read on an unsupported platform", () => {
    beforeEach(() => setPlatform("web"))

    it("returns Unsupported without invoking either backend", async () => {
      const { result } = renderHook(() => useCredentialBackup())
      let readResult
      await act(async () => {
        readResult = await result.current.read()
      })

      expect(readResult).toEqual({
        success: false,
        error: CredentialError.Unsupported,
      })
      expect(mockSignIn).not.toHaveBeenCalled()
      expect(mockGetInternetCredentials).not.toHaveBeenCalled()
    })
  })

  describe("loading state", () => {
    beforeEach(() => setPlatform("android"))

    it("toggles loading around save", async () => {
      let resolvePromise: (value: unknown) => void = () => {}
      mockSignUpWithPassword.mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve
        }),
      )

      const { result } = renderHook(() => useCredentialBackup())
      expect(result.current.loading).toBe(false)

      let savePromise: Promise<unknown>
      act(() => {
        savePromise = result.current.save(walletIdentifier, mnemonic)
      })
      expect(result.current.loading).toBe(true)

      await act(async () => {
        resolvePromise({ type: "password", success: true })
        await savePromise
      })
      expect(result.current.loading).toBe(false)
    })

    it("toggles loading around read", async () => {
      let resolvePromise: (value: unknown) => void = () => {}
      mockSignIn.mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve
        }),
      )

      const { result } = renderHook(() => useCredentialBackup())
      expect(result.current.loading).toBe(false)

      let readPromise: Promise<unknown>
      act(() => {
        readPromise = result.current.read()
      })
      expect(result.current.loading).toBe(true)

      await act(async () => {
        resolvePromise({
          type: "password",
          username: walletIdentifier,
          password: mnemonic,
        })
        await readPromise
      })
      expect(result.current.loading).toBe(false)
    })
  })
})

describe("isCredentialBackupAvailable", () => {
  const originalPlatform = Platform.OS

  afterAll(() => {
    setPlatform(originalPlatform)
  })

  it("is true on Android regardless of count (Credential Manager handles multi-account)", () => {
    setPlatform("android")
    expect(isCredentialBackupAvailable(0)).toBe(true)
    expect(isCredentialBackupAvailable(1)).toBe(true)
    expect(isCredentialBackupAvailable(2)).toBe(true)
    expect(isCredentialBackupAvailable(10)).toBe(true)
  })

  it("is true on iOS at the empty / single-account boundary", () => {
    setPlatform("ios")
    expect(isCredentialBackupAvailable(0)).toBe(true)
    expect(isCredentialBackupAvailable(1)).toBe(true)
  })

  it("is false on iOS once a second account would write under the same domain", () => {
    setPlatform("ios")
    expect(isCredentialBackupAvailable(2)).toBe(false)
    expect(isCredentialBackupAvailable(7)).toBe(false)
  })
})
