import React from "react"
import { Text, TouchableOpacity } from "react-native"
import { render, act, screen, waitFor, fireEvent } from "@testing-library/react-native"

import {
  PersistentStateProvider,
  PersistentStateContext,
} from "@app/store/persistent-state"
import { defaultPersistentState } from "@app/store/persistent-state/state-migrations"

const mockLoadJson = jest.fn()
const mockSaveJson = jest.fn()
const mockSaveString = jest.fn()
const mockLoadString = jest.fn()
const mockGetAllKeys = jest.fn()

jest.mock("@app/utils/storage", () => ({
  loadJson: (...args: unknown[]) => mockLoadJson(...args),
  saveJson: (...args: unknown[]) => mockSaveJson(...args),
  saveString: (...args: unknown[]) => mockSaveString(...args),
  loadString: (...args: unknown[]) => mockLoadString(...args),
  getAllKeys: (...args: unknown[]) => mockGetAllKeys(...args),
}))

const mockGetActiveToken = jest.fn()
const mockSetActiveToken = jest.fn()
const mockRemoveActiveToken = jest.fn()

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    getActiveToken: (...args: unknown[]) => mockGetActiveToken(...args),
    setActiveToken: (...args: unknown[]) => mockSetActiveToken(...args),
    removeActiveToken: (...args: unknown[]) => mockRemoveActiveToken(...args),
  },
}))

const mockRecordError = jest.fn()
jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: (...args: unknown[]) => mockRecordError(...args),
  log: jest.fn(),
}))

// A persisted blob as new builds write it: the token lives in the keychain, not here.
const scrubbedBlob = {
  schemaVersion: 6,
  galoyInstance: { id: "Main" },
}

const { galoyAuthToken: _defaultToken, ...defaultStateWithoutToken } =
  defaultPersistentState

const TestConsumer: React.FC = () => {
  const ctx = React.useContext(PersistentStateContext)
  if (!ctx) return <Text testID="loading">Loading</Text>

  return (
    <>
      <Text testID="token">{ctx.persistentState.galoyAuthToken}</Text>
      <Text testID="schema">{ctx.persistentState.schemaVersion}</Text>
      <TouchableOpacity
        testID="update-btn"
        onPress={() =>
          ctx.updateState((prev) =>
            prev ? { ...prev, galoyAuthToken: "new-token" } : prev,
          )
        }
      />
      <TouchableOpacity
        testID="update-other-btn"
        onPress={() =>
          ctx.updateState((prev) => (prev ? { ...prev, balanceHidden: true } : prev))
        }
      />
      <TouchableOpacity testID="reset-btn" onPress={ctx.resetState} />
    </>
  )
}

describe("PersistentStateProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSaveJson.mockResolvedValue(undefined)
    mockSaveString.mockResolvedValue(true)
    mockLoadString.mockResolvedValue(null)
    mockGetAllKeys.mockResolvedValue([])
    mockGetActiveToken.mockResolvedValue("")
    mockSetActiveToken.mockResolvedValue(true)
    mockRemoveActiveToken.mockResolvedValue(true)
  })

  it("renders nothing (null) while state is loading", async () => {
    // Never resolve — keeps the provider in loading state
    mockLoadJson.mockReturnValue(new Promise(() => {}))

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    // Children should not render while loading
    expect(screen.queryByTestId("token")).toBeNull()
    expect(screen.queryByTestId("loading")).toBeNull()
  })

  it("loads persisted state and renders children", async () => {
    mockLoadJson.mockResolvedValue(scrubbedBlob)
    mockGetActiveToken.mockResolvedValue("saved-token")

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("token")).toBeTruthy()
    })

    expect(screen.getByTestId("token").props.children).toBe("saved-token")
    // The point is that an old state migrates all the way up, so track the latest
    // version rather than a literal that every schema bump would have to chase.
    expect(screen.getByTestId("schema").props.children).toBe(
      defaultPersistentState.schemaVersion,
    )
  })

  it("falls back to default state when no persisted data exists", async () => {
    mockLoadJson.mockResolvedValue(null)

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("token")).toBeTruthy()
    })

    expect(screen.getByTestId("token").props.children).toBe(
      defaultPersistentState.galoyAuthToken,
    )
  })

  it("removes a leftover keychain token when no persisted data exists (reinstall)", async () => {
    // The iOS keychain survives uninstall; a fresh install must not resurrect
    // the previous session.
    mockLoadJson.mockResolvedValue(null)
    mockGetActiveToken.mockResolvedValue("token-from-before-uninstall")

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("token")).toBeTruthy()
    })

    expect(mockRemoveActiveToken).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId("token").props.children).toBe("")
  })

  it("does NOT save state on initial load (no-op write guard)", async () => {
    mockLoadJson.mockResolvedValue(scrubbedBlob)
    mockGetActiveToken.mockResolvedValue("existing")

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("token")).toBeTruthy()
    })

    // Wait an extra tick to ensure no save was triggered
    await act(async () => {
      await new Promise<void>((r) => {
        setTimeout(r, 50)
      })
    })

    expect(mockSaveJson).not.toHaveBeenCalled()
    expect(mockSetActiveToken).not.toHaveBeenCalled()
  })

  it("saves state after updateState is called, splitting the token into the keychain", async () => {
    mockLoadJson.mockResolvedValue(scrubbedBlob)
    mockGetActiveToken.mockResolvedValue("old-token")

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("token")).toBeTruthy()
    })

    await act(async () => {
      fireEvent.press(screen.getByTestId("update-btn"))
    })

    await waitFor(() => {
      expect(screen.getByTestId("token").props.children).toBe("new-token")
    })

    expect(mockSaveJson).toHaveBeenCalledTimes(1)
    const [key, payload] = mockSaveJson.mock.calls[0]
    expect(key).toBe("persistentState")
    expect(payload).not.toHaveProperty("galoyAuthToken")
    expect(payload.schemaVersion).toBe(defaultPersistentState.schemaVersion)
    expect(mockSetActiveToken).toHaveBeenCalledWith("new-token")
  })

  it("does not touch the keychain when a state change leaves the token unchanged", async () => {
    mockLoadJson.mockResolvedValue(scrubbedBlob)
    mockGetActiveToken.mockResolvedValue("stable-token")

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("token")).toBeTruthy()
    })

    await act(async () => {
      fireEvent.press(screen.getByTestId("update-other-btn"))
    })

    await waitFor(() => {
      expect(mockSaveJson).toHaveBeenCalledTimes(1)
    })

    expect(mockSetActiveToken).not.toHaveBeenCalled()
    expect(mockRemoveActiveToken).not.toHaveBeenCalled()
  })

  it("saves state after resetState is called, removing the keychain token", async () => {
    mockLoadJson.mockResolvedValue(scrubbedBlob)
    mockGetActiveToken.mockResolvedValue("some-token")

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("token")).toBeTruthy()
    })

    await act(async () => {
      fireEvent.press(screen.getByTestId("reset-btn"))
    })

    await waitFor(() => {
      expect(screen.getByTestId("token").props.children).toBe(
        defaultPersistentState.galoyAuthToken,
      )
    })

    expect(mockSaveJson).toHaveBeenCalledWith(
      "persistentState",
      expect.objectContaining(defaultStateWithoutToken),
    )
    expect(mockSaveJson.mock.calls[0][1]).not.toHaveProperty("galoyAuthToken")
    await waitFor(() => {
      expect(mockRemoveActiveToken).toHaveBeenCalledTimes(1)
    })
  })

  it("reports a failed save to crashlytics instead of crashing, keeping the update in memory", async () => {
    mockLoadJson.mockResolvedValue(scrubbedBlob)
    mockGetActiveToken.mockResolvedValue("old-token")
    mockSaveJson.mockRejectedValueOnce(new Error("saveJson timed out"))

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("token")).toBeTruthy()
    })

    await act(async () => {
      fireEvent.press(screen.getByTestId("update-btn"))
    })

    // The write rejected, but the guard swallows it: surfaced to crashlytics, never thrown.
    await waitFor(() => {
      expect(mockRecordError).toHaveBeenCalledTimes(1)
    })
    expect(mockRecordError.mock.calls[0][0]).toBeInstanceOf(Error)
    expect(mockRecordError.mock.calls[0][0].message).toBe("saveJson timed out")

    // The in-memory update survives the failed persist, so the app keeps working.
    expect(screen.getByTestId("token").props.children).toBe("new-token")
  })

  it("reports a failed keychain write and retries it on the next state change", async () => {
    mockLoadJson.mockResolvedValue(scrubbedBlob)
    mockGetActiveToken.mockResolvedValue("old-token")
    mockSetActiveToken.mockResolvedValueOnce(false)

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("token")).toBeTruthy()
    })

    await act(async () => {
      fireEvent.press(screen.getByTestId("update-btn"))
    })

    await waitFor(() => {
      expect(mockRecordError).toHaveBeenCalledTimes(1)
    })
    expect(mockRecordError.mock.calls[0][0].message).toContain("keystore write failed")

    // The tracked last-persisted token stays stale, so an unrelated state
    // change retries the keychain write.
    await act(async () => {
      fireEvent.press(screen.getByTestId("update-other-btn"))
    })

    await waitFor(() => {
      expect(mockSetActiveToken).toHaveBeenCalledTimes(2)
    })
    expect(mockSetActiveToken).toHaveBeenLastCalledWith("new-token")
  })

  describe("legacy blob token adoption", () => {
    const legacyBlob = {
      schemaVersion: 6,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "legacy-token",
    }

    it("adopts a legacy blob token into the keychain and re-saves the blob without it", async () => {
      mockLoadJson.mockResolvedValue(legacyBlob)

      render(
        <PersistentStateProvider>
          <TestConsumer />
        </PersistentStateProvider>,
      )

      await waitFor(() => {
        expect(screen.getByTestId("token")).toBeTruthy()
      })

      expect(screen.getByTestId("token").props.children).toBe("legacy-token")
      expect(mockSetActiveToken).toHaveBeenCalledWith("legacy-token")

      // The plaintext copy dies immediately, not on the next state change.
      expect(mockSaveJson).toHaveBeenCalledTimes(1)
      const [key, payload] = mockSaveJson.mock.calls[0]
      expect(key).toBe("persistentState")
      expect(payload).not.toHaveProperty("galoyAuthToken")
    })

    it("does not scrub the blob when keychain adoption fails", async () => {
      mockLoadJson.mockResolvedValue(legacyBlob)
      mockSetActiveToken.mockResolvedValue(false)

      render(
        <PersistentStateProvider>
          <TestConsumer />
        </PersistentStateProvider>,
      )

      await waitFor(() => {
        expect(screen.getByTestId("token")).toBeTruthy()
      })

      // Scrubbing now would destroy the only surviving copy of the credential.
      expect(mockSaveJson).not.toHaveBeenCalled()
      expect(mockRecordError).toHaveBeenCalledTimes(1)
      expect(mockRecordError.mock.calls[0][0].message).toContain(
        "keychain adoption failed",
      )

      // The session still works in memory this boot.
      expect(screen.getByTestId("token").props.children).toBe("legacy-token")
    })

    it("retries the keychain write on the first save after a failed boot adoption", async () => {
      mockLoadJson.mockResolvedValue(legacyBlob)
      mockSetActiveToken.mockResolvedValue(false)

      render(
        <PersistentStateProvider>
          <TestConsumer />
        </PersistentStateProvider>,
      )

      await waitFor(() => {
        expect(screen.getByTestId("token")).toBeTruthy()
      })
      expect(screen.getByTestId("token").props.children).toBe("legacy-token")

      // Keystore recovers; the user changes an unrelated setting.
      mockSetActiveToken.mockResolvedValue(true)
      mockSetActiveToken.mockClear()
      await act(async () => {
        fireEvent.press(screen.getByTestId("update-other-btn"))
      })

      // The save must retry the keychain write (the ref was seeded "" on the
      // failed adoption, so the token no longer matches it)…
      await waitFor(() => {
        expect(mockSetActiveToken).toHaveBeenCalledWith("legacy-token")
      })
      // …while the blob it writes stays token-free.
      const lastBlob = mockSaveJson.mock.calls[mockSaveJson.mock.calls.length - 1][1]
      expect(lastBlob).not.toHaveProperty("galoyAuthToken")
    })

    it("reports but survives a saveJson failure during the boot-time blob scrub", async () => {
      mockLoadJson.mockResolvedValue(legacyBlob)
      mockSaveJson.mockRejectedValueOnce(new Error("disk full"))

      render(
        <PersistentStateProvider>
          <TestConsumer />
        </PersistentStateProvider>,
      )

      await waitFor(() => {
        expect(screen.getByTestId("token")).toBeTruthy()
      })

      // The adoption itself succeeded, so the session is live…
      expect(screen.getByTestId("token").props.children).toBe("legacy-token")
      // …and the failed scrub write was surfaced, not swallowed.
      expect(mockRecordError).toHaveBeenCalledTimes(1)
      expect(mockRecordError.mock.calls[0][0].message).toBe("disk full")
    })

    it("prefers the keychain token over a stale blob token and still scrubs the blob", async () => {
      mockLoadJson.mockResolvedValue(legacyBlob)
      mockGetActiveToken.mockResolvedValue("keychain-token")

      render(
        <PersistentStateProvider>
          <TestConsumer />
        </PersistentStateProvider>,
      )

      await waitFor(() => {
        expect(screen.getByTestId("token")).toBeTruthy()
      })

      expect(screen.getByTestId("token").props.children).toBe("keychain-token")
      expect(mockSetActiveToken).not.toHaveBeenCalled()
      expect(mockSaveJson).toHaveBeenCalledTimes(1)
      expect(mockSaveJson.mock.calls[0][1]).not.toHaveProperty("galoyAuthToken")
    })
  })

  describe("quarantine token hygiene", () => {
    it("redacts the token from pre-existing quarantine keys at load", async () => {
      mockLoadJson.mockResolvedValue(scrubbedBlob)
      mockGetAllKeys.mockResolvedValue(["persistentStateQuarantine.123", "unrelatedKey"])
      mockLoadString.mockResolvedValue(
        JSON.stringify({ schemaVersion: 5, galoyAuthToken: "old-secret" }),
      )

      render(
        <PersistentStateProvider>
          <TestConsumer />
        </PersistentStateProvider>,
      )

      await waitFor(() => {
        expect(mockSaveString).toHaveBeenCalledWith(
          "persistentStateQuarantine.123",
          JSON.stringify({ schemaVersion: 5, galoyAuthToken: "[REDACTED]" }),
        )
      })
      expect(mockLoadString).toHaveBeenCalledTimes(1)
      expect(mockLoadString).toHaveBeenCalledWith("persistentStateQuarantine.123")
    })

    it("leaves already-redacted quarantine keys alone", async () => {
      mockLoadJson.mockResolvedValue(scrubbedBlob)
      mockGetAllKeys.mockResolvedValue(["persistentStateQuarantine.123"])
      mockLoadString.mockResolvedValue(
        JSON.stringify({ schemaVersion: 5, galoyAuthToken: "[REDACTED]" }),
      )

      render(
        <PersistentStateProvider>
          <TestConsumer />
        </PersistentStateProvider>,
      )

      await waitFor(() => {
        expect(screen.getByTestId("token")).toBeTruthy()
      })
      await act(async () => {
        await new Promise<void>((r) => {
          setTimeout(r, 50)
        })
      })

      expect(mockSaveString).not.toHaveBeenCalled()
    })
  })

  describe("migration failure handling", () => {
    const corruptedState3 = {
      schemaVersion: 3,
      hasShownStableSatsWelcome: false,
      isUsdDisabled: false,
      galoyInstance: { id: "Main", name: "DefinitelyNotARealInstance" },
      galoyAuthToken: "token-v3",
      isAnalyticsEnabled: true,
    }

    it("reports the migration error to crashlytics instead of silently logging to console", async () => {
      mockLoadJson.mockResolvedValue(corruptedState3)

      render(
        <PersistentStateProvider>
          <TestConsumer />
        </PersistentStateProvider>,
      )

      await waitFor(() => {
        expect(screen.getByTestId("token")).toBeTruthy()
      })

      expect(mockRecordError).toHaveBeenCalledTimes(1)
      expect(mockRecordError.mock.calls[0][0]).toBeInstanceOf(Error)
      expect(mockRecordError.mock.calls[0][0].message).toContain(
        "Galoy instance not found",
      )
    })

    it("quarantines the raw input with the token redacted before falling back to defaults", async () => {
      mockLoadJson.mockResolvedValue(corruptedState3)
      const before = Date.now()

      render(
        <PersistentStateProvider>
          <TestConsumer />
        </PersistentStateProvider>,
      )

      await waitFor(() => {
        expect(screen.getByTestId("token")).toBeTruthy()
      })
      const after = Date.now()

      expect(mockSaveString).toHaveBeenCalledTimes(1)
      const [key, payload] = mockSaveString.mock.calls[0]
      expect(key).toMatch(/^persistentStateQuarantine\.\d+$/)
      const timestamp = Number(key.split(".").pop())
      expect(timestamp).toBeGreaterThanOrEqual(before)
      expect(timestamp).toBeLessThanOrEqual(after)
      // The quarantine copy keeps everything except the credential itself.
      expect(JSON.parse(payload)).toEqual({
        ...corruptedState3,
        galoyAuthToken: "[REDACTED]",
      })

      // Provider must still mount with defaults so the app can launch.
      expect(screen.getByTestId("token").props.children).toBe(
        defaultPersistentState.galoyAuthToken,
      )
    })

    it("records a second error when the quarantine write itself fails, but still mounts with defaults", async () => {
      mockLoadJson.mockResolvedValue(corruptedState3)
      mockSaveString.mockResolvedValueOnce(false)

      render(
        <PersistentStateProvider>
          <TestConsumer />
        </PersistentStateProvider>,
      )

      await waitFor(() => {
        expect(screen.getByTestId("token")).toBeTruthy()
      })

      // First recordError = the migration throw; second = the quarantine write
      // failure. Both surfaced to crashlytics — neither silent.
      expect(mockRecordError).toHaveBeenCalledTimes(2)
      expect(mockRecordError.mock.calls[1][0].message).toContain(
        "Quarantine write failed",
      )
      expect(screen.getByTestId("token").props.children).toBe(
        defaultPersistentState.galoyAuthToken,
      )
    })

    it("does NOT touch crashlytics or the quarantine key on a successful migration", async () => {
      mockLoadJson.mockResolvedValue(scrubbedBlob)
      mockGetActiveToken.mockResolvedValue("saved")

      render(
        <PersistentStateProvider>
          <TestConsumer />
        </PersistentStateProvider>,
      )

      await waitFor(() => {
        expect(screen.getByTestId("token")).toBeTruthy()
      })

      expect(mockRecordError).not.toHaveBeenCalled()
      expect(mockSaveString).not.toHaveBeenCalled()
    })

    it("does NOT touch crashlytics or the quarantine key for null persisted data", async () => {
      mockLoadJson.mockResolvedValue(null)

      render(
        <PersistentStateProvider>
          <TestConsumer />
        </PersistentStateProvider>,
      )

      await waitFor(() => {
        expect(screen.getByTestId("token")).toBeTruthy()
      })

      expect(mockRecordError).not.toHaveBeenCalled()
      expect(mockSaveString).not.toHaveBeenCalled()
    })
  })
})
