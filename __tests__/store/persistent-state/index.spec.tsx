import React from "react"
import { Text, TouchableOpacity } from "react-native"
import { render, act, screen, waitFor, fireEvent } from "@testing-library/react-native"

import {
  PersistentStateProvider,
  PersistentStateContext,
} from "@app/store/persistent-state"
import { defaultPersistentState } from "@app/store/persistent-state/state-migrations"

const mockSaveJson = jest.fn()
const mockSaveString = jest.fn()
const mockLoadString = jest.fn()
const mockGetAllKeys = jest.fn()

jest.mock("@app/utils/storage", () => ({
  saveJson: (...args: unknown[]) => mockSaveJson(...args),
  saveString: (...args: unknown[]) => mockSaveString(...args),
  loadString: (...args: unknown[]) => mockLoadString(...args),
  getAllKeys: (...args: unknown[]) => mockGetAllKeys(...args),
}))

const mockGetActiveToken = jest.fn()
const mockReadActiveToken = jest.fn()
const mockSetActiveToken = jest.fn()
const mockRemoveActiveToken = jest.fn()
const mockClearUninstallSurvivingCredentials = jest.fn()

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    getActiveToken: (...args: unknown[]) => mockGetActiveToken(...args),
    readActiveToken: (...args: unknown[]) => mockReadActiveToken(...args),
    setActiveToken: (...args: unknown[]) => mockSetActiveToken(...args),
    removeActiveToken: (...args: unknown[]) => mockRemoveActiveToken(...args),
    clearUninstallSurvivingCredentials: (...args: unknown[]) =>
      mockClearUninstallSurvivingCredentials(...args),
  },
}))

const PERSISTENT_STATE_KEY = "persistentState"

// Every string the fake storage holds, keyed the way production asks for it:
// the blob under persistentState plus whatever quarantine entries a test seeds.
// The provider reads the blob as text and parses it itself, so a fixture is a
// JSON string, and a test can hand it bytes that do not parse.
const storedStrings = new Map<string, string>()

const setPersistedBlob = (value: unknown) => {
  storedStrings.set(PERSISTENT_STATE_KEY, JSON.stringify(value))
}

const setRawPersistedBlob = (raw: string) => {
  storedStrings.set(PERSISTENT_STATE_KEY, raw)
}

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
      <TouchableOpacity testID="clear-token-btn" onPress={() => ctx.clearToken()} />
    </>
  )
}

// Shared across the top-level describes (split to satisfy max-lines-per-function)
const setupStorageMockDefaults = () => {
  jest.clearAllMocks()
  storedStrings.clear()
  mockSaveJson.mockResolvedValue(undefined)
  mockSaveString.mockResolvedValue(true)
  mockLoadString.mockImplementation(async (key: string) => storedStrings.get(key) ?? null)
  mockGetAllKeys.mockResolvedValue([])
  mockGetActiveToken.mockResolvedValue("")
  // Derived from getActiveToken so the plain fixtures keep working; tests that
  // care about miss-vs-error override readActiveToken directly.
  mockReadActiveToken.mockImplementation(async () => {
    const token = await mockGetActiveToken()
    return token ? { status: "found", token } : { status: "absent" }
  })
  mockSetActiveToken.mockResolvedValue(true)
  mockRemoveActiveToken.mockResolvedValue(true)
  mockClearUninstallSurvivingCredentials.mockResolvedValue(undefined)
}

describe("PersistentStateProvider", () => {
  beforeEach(setupStorageMockDefaults)

  it("renders nothing (null) while state is loading", async () => {
    // Never resolve — keeps the provider in loading state
    mockLoadString.mockReturnValue(new Promise(() => {}))

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
    setPersistedBlob(scrubbedBlob)
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
    storedStrings.delete(PERSISTENT_STATE_KEY)

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

  it("clears uninstall-surviving credentials when no persisted data exists (reinstall)", async () => {
    // The iOS keychain survives uninstall; a fresh install must not resurrect
    // the previous session. Which credentials are wiped (and the retry
    // behavior) is owned and tested by secureStorage — this locks the trigger.
    storedStrings.delete(PERSISTENT_STATE_KEY)
    mockGetActiveToken.mockResolvedValue("token-from-before-uninstall")

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("token")).toBeTruthy()
    })

    expect(mockClearUninstallSurvivingCredentials).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId("token").props.children).toBe("")
  })

  it("reports each failed credential wipe to crashlytics by name", async () => {
    storedStrings.delete(PERSISTENT_STATE_KEY)
    // The loader supplies the reporting callback; a wipe failure surfaces
    // through it, named, and never throws into the boot path.
    mockClearUninstallSurvivingCredentials.mockImplementation(
      async (onFailure: (what: string) => void) => {
        onFailure("active token")
      },
    )

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("token")).toBeTruthy()
    })

    expect(mockRecordError).toHaveBeenCalledTimes(1)
    expect(mockRecordError.mock.calls[0][0].message).toBe(
      "Reinstall keychain cleanup failed: active token",
    )
  })

  it("does not clear credentials for an unrecognized schema version", async () => {
    // A downgrade from a future build is not a reinstall: the blob exists but
    // can't be read. The session must survive the round trip.
    setPersistedBlob({ schemaVersion: 99, galoyInstance: { id: "Main" } })
    mockGetActiveToken.mockResolvedValue("kc-token")

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("token")).toBeTruthy()
    })

    expect(mockClearUninstallSurvivingCredentials).not.toHaveBeenCalled()
    // Downgrade boots keep the session (Failed → keychain recovery).
    expect(screen.getByTestId("token").props.children).toBe("kc-token")
  })

  it("does NOT save state on initial load (no-op write guard)", async () => {
    setPersistedBlob(scrubbedBlob)
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
    setPersistedBlob(scrubbedBlob)
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
    setPersistedBlob(scrubbedBlob)
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
    setPersistedBlob(scrubbedBlob)
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
    setPersistedBlob(scrubbedBlob)
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
    setPersistedBlob(scrubbedBlob)
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

  it("serializes saves: a queued save waits for the slow one before it", async () => {
    setPersistedBlob(scrubbedBlob)
    mockGetActiveToken.mockResolvedValue("old-token")

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId("token")).toBeTruthy()
    })

    // First save hangs on its blob write…
    let releaseFirstSave = () => {}
    mockSaveJson.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseFirstSave = resolve
        }),
    )
    await act(async () => {
      fireEvent.press(screen.getByTestId("update-btn"))
    })
    await waitFor(() => {
      expect(mockSaveJson).toHaveBeenCalledTimes(1)
    })

    // …a second state change arrives while it is still in flight.
    await act(async () => {
      fireEvent.press(screen.getByTestId("update-other-btn"))
    })

    // The queued save must NOT start while the first is unresolved.
    expect(mockSaveJson).toHaveBeenCalledTimes(1)

    await act(async () => {
      releaseFirstSave()
    })
    await waitFor(() => {
      expect(mockSaveJson).toHaveBeenCalledTimes(2)
    })
  })

  describe("legacy blob token adoption", () => {
    const legacyBlob = {
      schemaVersion: 6,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "legacy-token",
    }

    it("adopts a legacy blob token into the keychain and re-saves the blob without it", async () => {
      setPersistedBlob(legacyBlob)

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
      setPersistedBlob(legacyBlob)
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
      setPersistedBlob(legacyBlob)
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
      setPersistedBlob(legacyBlob)
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
      setPersistedBlob(legacyBlob)
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
})

describe("PersistentStateProvider quarantine token hygiene", () => {
  beforeEach(setupStorageMockDefaults)

  const SCRUB_DONE_KEY = "persistentStateQuarantineScrubDone"

  // The sweep reads the done-marker first; answer per key so the marker
  // lookup stays null while quarantine keys return their payloads.
  const mockQuarantineEntries = (entries: Record<string, string>) => {
    Object.entries(entries).forEach(([key, value]) => storedStrings.set(key, value))
  }

  it("redacts the token from pre-existing quarantine keys at load", async () => {
    setPersistedBlob(scrubbedBlob)
    mockGetAllKeys.mockResolvedValue(["persistentStateQuarantine.123", "unrelatedKey"])
    mockQuarantineEntries({
      "persistentStateQuarantine.123": JSON.stringify({
        schemaVersion: 5,
        galoyAuthToken: "old-secret",
      }),
    })

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
    expect(mockLoadString).toHaveBeenCalledWith("persistentStateQuarantine.123")
    expect(mockLoadString).not.toHaveBeenCalledWith("unrelatedKey")
  })

  it("leaves already-redacted quarantine keys alone and marks the sweep done", async () => {
    setPersistedBlob(scrubbedBlob)
    mockGetAllKeys.mockResolvedValue(["persistentStateQuarantine.123"])
    mockQuarantineEntries({
      "persistentStateQuarantine.123": JSON.stringify({
        schemaVersion: 5,
        galoyAuthToken: "[REDACTED]",
      }),
    })

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

    // No rewrite of the already-clean entry — only the done-marker write.
    expect(mockSaveString).not.toHaveBeenCalledWith(
      "persistentStateQuarantine.123",
      expect.anything(),
    )
    expect(mockSaveString).toHaveBeenCalledWith(SCRUB_DONE_KEY, "1")
  })

  it("scrubs remaining quarantine entries even when one is corrupt", async () => {
    setPersistedBlob(scrubbedBlob)
    mockGetAllKeys.mockResolvedValue([
      "persistentStateQuarantine.100", // corrupt — iterated first
      "persistentStateQuarantine.200", // healthy, still holds a raw token
    ])
    mockQuarantineEntries({
      "persistentStateQuarantine.100": "{truncated",
      "persistentStateQuarantine.200": JSON.stringify({ galoyAuthToken: "raw-token" }),
    })

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    await waitFor(() => {
      expect(mockSaveString).toHaveBeenCalledWith(
        "persistentStateQuarantine.200",
        JSON.stringify({ galoyAuthToken: "[REDACTED]" }),
      )
    })
    // The corrupt entry was reported, and an unclean sweep is never marked done.
    expect(mockRecordError).toHaveBeenCalledTimes(1)
    expect(mockSaveString).not.toHaveBeenCalledWith(SCRUB_DONE_KEY, expect.anything())
  })

  it("reports a failed redaction write and withholds the done-marker", async () => {
    setPersistedBlob(scrubbedBlob)
    mockGetAllKeys.mockResolvedValue(["persistentStateQuarantine.100"])
    mockQuarantineEntries({
      "persistentStateQuarantine.100": JSON.stringify({ galoyAuthToken: "raw-token" }),
    })
    mockSaveString.mockResolvedValue(false)

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    await waitFor(() => {
      expect(mockRecordError).toHaveBeenCalledTimes(1)
    })
    expect(mockRecordError.mock.calls[0][0].message).toContain(
      "Quarantine redaction write failed",
    )
    // An unclean sweep must never be marked done, or the raw token would
    // survive forever behind the skip.
    expect(mockSaveString).not.toHaveBeenCalledWith(SCRUB_DONE_KEY, expect.anything())
  })

  it("skips the sweep entirely once the done-marker exists", async () => {
    setPersistedBlob(scrubbedBlob)
    mockQuarantineEntries({ [SCRUB_DONE_KEY]: "1" })

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

    expect(mockGetAllKeys).not.toHaveBeenCalled()
  })
})

describe("PersistentStateProvider migration failure handling", () => {
  beforeEach(setupStorageMockDefaults)

  const corruptedState3 = {
    schemaVersion: 3,
    hasShownStableSatsWelcome: false,
    isUsdDisabled: false,
    galoyInstance: { id: "Main", name: "DefinitelyNotARealInstance" },
    galoyAuthToken: "token-v3",
    isAnalyticsEnabled: true,
  }

  it("recovers the session from the keychain when migration fails", async () => {
    setPersistedBlob(corruptedState3)
    mockGetActiveToken.mockResolvedValue("kc-token")

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("token")).toBeTruthy()
    })

    // Settings fall back to defaults, but the session survives…
    expect(screen.getByTestId("token").props.children).toBe("kc-token")
    expect(screen.getByTestId("schema").props.children).toBe(
      defaultPersistentState.schemaVersion,
    )
    // …and the credential is neither removed nor re-written.
    expect(mockRemoveActiveToken).not.toHaveBeenCalled()
    expect(mockSetActiveToken).not.toHaveBeenCalled()
  })

  it("reports the migration error to crashlytics instead of silently logging to console", async () => {
    setPersistedBlob(corruptedState3)

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
    expect(mockRecordError.mock.calls[0][0].message).toContain("Galoy instance not found")
  })

  it("quarantines the raw input with the token redacted before falling back to defaults", async () => {
    setPersistedBlob(corruptedState3)
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

    // Ignore the scrub sweep's done-marker write; only quarantine writes count.
    const quarantineCalls = mockSaveString.mock.calls.filter(([k]) =>
      String(k).startsWith("persistentStateQuarantine."),
    )
    expect(quarantineCalls).toHaveLength(1)
    const [key, payload] = quarantineCalls[0]
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
    setPersistedBlob(corruptedState3)
    // Fail the quarantine write specifically — a blanket mockResolvedValueOnce
    // could be consumed by the concurrent scrub sweep's done-marker write.
    mockSaveString.mockImplementation((key: string) =>
      Promise.resolve(!key.startsWith("persistentStateQuarantine.")),
    )

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
    expect(mockRecordError.mock.calls[1][0].message).toContain("Quarantine write failed")
    expect(screen.getByTestId("token").props.children).toBe(
      defaultPersistentState.galoyAuthToken,
    )
  })

  it("does NOT touch crashlytics or the quarantine key on a successful migration", async () => {
    setPersistedBlob(scrubbedBlob)
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
    expect(
      mockSaveString.mock.calls.filter(([k]) =>
        String(k).startsWith("persistentStateQuarantine."),
      ),
    ).toHaveLength(0)
  })

  it("does NOT touch crashlytics or the quarantine key for null persisted data", async () => {
    storedStrings.delete(PERSISTENT_STATE_KEY)

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("token")).toBeTruthy()
    })

    expect(mockRecordError).not.toHaveBeenCalled()
    expect(
      mockSaveString.mock.calls.filter(([k]) =>
        String(k).startsWith("persistentStateQuarantine."),
      ),
    ).toHaveLength(0)
  })
})

// An absent blob means a fresh install and wipes every credential that outlives
// uninstall. A blob that is present but unreadable means damage — and the whole
// point of moving the token into the keychain was that damage to the blob must
// not cost the session.
describe("PersistentStateProvider unreadable blob handling", () => {
  beforeEach(setupStorageMockDefaults)

  const truncatedBlob = '{"schemaVersion":16,"galoyInstance":{"id":"Main"},"galoyAu'

  it("keeps the keychain session when the blob does not parse", async () => {
    setRawPersistedBlob(truncatedBlob)
    mockGetActiveToken.mockResolvedValue("live-session-token")

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("token")).toBeTruthy()
    })

    // Not a reinstall: the credentials that survive uninstall stay put.
    expect(mockClearUninstallSurvivingCredentials).not.toHaveBeenCalled()
    expect(screen.getByTestId("token").props.children).toBe("live-session-token")
    expect(mockRecordError).toHaveBeenCalled()
    expect(mockRecordError.mock.calls[0][0]).toBeInstanceOf(Error)
  })

  it("quarantines a description of an unparseable blob, never its bytes", async () => {
    // The parsed path can redact a known field; here the bytes may be cut
    // mid-token, so nothing can promise a redaction pass caught the credential.
    setRawPersistedBlob(`{"galoyAuthToken":"super-secret-token`)

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("token")).toBeTruthy()
    })

    const [, payload] = mockSaveString.mock.calls.find(([k]) =>
      String(k).startsWith("persistentStateQuarantine."),
    )
    expect(payload).not.toContain("super-secret-token")
    const quarantined = JSON.parse(payload)
    expect(quarantined.unparseable).toBe(true)
    expect(quarantined.byteLength).toBe(`{"galoyAuthToken":"super-secret-token`.length)
    expect(typeof quarantined.parseError).toBe("string")
  })

  it("treats an empty blob as damage rather than a fresh install", async () => {
    // A zero-length value is not how an absent key reads, so it is a write that
    // went wrong — and must not be answered by deleting the user's credentials.
    setRawPersistedBlob("")
    mockGetActiveToken.mockResolvedValue("live-session-token")

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("token")).toBeTruthy()
    })

    expect(mockClearUninstallSurvivingCredentials).not.toHaveBeenCalled()
    expect(screen.getByTestId("token").props.children).toBe("live-session-token")
  })

  it("withholds the quarantine done-marker when the key listing fails", async () => {
    // An empty listing and a failed listing are different facts: marking the
    // sweep done on a failure would retire it while raw tokens are still there.
    setPersistedBlob(scrubbedBlob)
    mockGetAllKeys.mockResolvedValue(null)

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

    expect(mockSaveString).not.toHaveBeenCalledWith(
      "persistentStateQuarantineScrubDone",
      "1",
    )
    expect(
      mockRecordError.mock.calls.some(([err]) =>
        String(err?.message).includes("could not list storage keys"),
      ),
    ).toBe(true)
  })
})

describe("PersistentStateProvider keychain read and removal failures", () => {
  beforeEach(setupStorageMockDefaults)

  const legacyBlob = {
    schemaVersion: 16,
    galoyInstance: { id: "Main" },
    galoyAuthToken: "legacy-blob-token",
  }

  it("skips adoption when the keychain read fails, leaving both copies intact", async () => {
    // A failed read looks exactly like an empty slot. Adopting on it would
    // overwrite a newer keychain token with the older blob copy and then scrub
    // the blob, destroying the only record of the newer one.
    setPersistedBlob(legacyBlob)
    mockReadActiveToken.mockResolvedValue({
      status: "failed",
      err: new Error("keystore locked"),
    })

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("token")).toBeTruthy()
    })

    expect(mockSetActiveToken).not.toHaveBeenCalled()
    expect(mockSaveJson).not.toHaveBeenCalled()
    expect(
      mockRecordError.mock.calls.some(([err]) =>
        String(err?.message).includes("keychain read failed"),
      ),
    ).toBe(true)
    // The blob copy still backs the session in memory, so the user stays in.
    expect(screen.getByTestId("token").props.children).toBe("legacy-blob-token")
  })

  it("retries the keychain write on the next save after a skipped adoption", async () => {
    setPersistedBlob(legacyBlob)
    mockReadActiveToken.mockResolvedValue({
      status: "failed",
      err: new Error("keystore locked"),
    })

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

    // Seeded from what the keychain durably holds (nothing), so the very next
    // save carries the token across instead of assuming it is already there.
    await waitFor(() => {
      expect(mockSetActiveToken).toHaveBeenCalledWith("legacy-blob-token")
    })
  })

  it("clearToken drops the keychain token and leaves the ref agreeing with it", async () => {
    setPersistedBlob(scrubbedBlob)
    mockGetActiveToken.mockResolvedValue("session-token")

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId("token")).toBeTruthy()
    })

    await act(async () => {
      fireEvent.press(screen.getByTestId("clear-token-btn"))
    })

    await waitFor(() => {
      expect(mockRemoveActiveToken).toHaveBeenCalledTimes(1)
    })
    expect(screen.getByTestId("token").props.children).toBe("")

    // The ref learned the slot is empty, so an unrelated change does not
    // re-remove — and, more to the point, a later token WOULD be written
    // rather than skipped as "already persisted".
    await act(async () => {
      fireEvent.press(screen.getByTestId("update-other-btn"))
    })
    expect(mockRemoveActiveToken).toHaveBeenCalledTimes(1)

    await act(async () => {
      fireEvent.press(screen.getByTestId("update-btn"))
    })
    await waitFor(() => {
      expect(mockSetActiveToken).toHaveBeenCalledWith("new-token")
    })
  })

  it("retries a refused removal once and reports it instead of swallowing it", async () => {
    setPersistedBlob(scrubbedBlob)
    mockGetActiveToken.mockResolvedValue("session-token")
    mockRemoveActiveToken.mockResolvedValue(false)

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId("token")).toBeTruthy()
    })

    await act(async () => {
      fireEvent.press(screen.getByTestId("clear-token-btn"))
    })

    // Four attempts, and the shape matters: two from clearToken (the immediate
    // retry) and two more from the save its state change queues, which tries
    // again precisely because the ref was left stale. Without the retry this
    // would be two.
    await waitFor(() => {
      expect(mockRemoveActiveToken).toHaveBeenCalledTimes(4)
    })
    expect(
      mockRecordError.mock.calls.some(([err]) =>
        String(err?.message).includes("keystore remove failed"),
      ),
    ).toBe(true)

    // Ref left stale on purpose, so the next state change tries again…
    const callsWhileFailing = mockRemoveActiveToken.mock.calls.length
    mockRemoveActiveToken.mockResolvedValue(true)
    await act(async () => {
      fireEvent.press(screen.getByTestId("update-other-btn"))
    })
    await waitFor(() => {
      expect(mockRemoveActiveToken.mock.calls.length).toBeGreaterThan(callsWhileFailing)
    })

    // …and stops trying once the keystore finally accepts it.
    const callsAfterSuccess = mockRemoveActiveToken.mock.calls.length
    await act(async () => {
      fireEvent.press(screen.getByTestId("update-other-btn"))
    })
    expect(mockRemoveActiveToken).toHaveBeenCalledTimes(callsAfterSuccess)
  })

  it("writes the blob before the keychain within one save", async () => {
    // Documented order, pinned: the crash window between the two writes leaves
    // new settings beside the old token, and whoever changes this should have
    // to change the test that says so.
    setPersistedBlob(scrubbedBlob)
    mockGetActiveToken.mockResolvedValue("old-token")

    const order: string[] = []
    mockSaveJson.mockImplementation(async () => {
      order.push("blob")
    })
    mockSetActiveToken.mockImplementation(async () => {
      order.push("keychain")
      return true
    })

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
      expect(order).toEqual(["blob", "keychain"])
    })
  })
})
