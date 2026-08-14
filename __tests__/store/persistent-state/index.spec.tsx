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
const mockRemoveSessionProfiles = jest.fn()

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    getActiveToken: (...args: unknown[]) => mockGetActiveToken(...args),
    setActiveToken: (...args: unknown[]) => mockSetActiveToken(...args),
    removeActiveToken: (...args: unknown[]) => mockRemoveActiveToken(...args),
    removeSessionProfiles: (...args: unknown[]) => mockRemoveSessionProfiles(...args),
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

// Shared across the top-level describes (split to satisfy max-lines-per-function)
const setupStorageMockDefaults = () => {
  jest.clearAllMocks()
  mockSaveJson.mockResolvedValue(undefined)
  mockSaveString.mockResolvedValue(true)
  mockLoadString.mockResolvedValue(null)
  mockGetAllKeys.mockResolvedValue([])
  mockGetActiveToken.mockResolvedValue("")
  mockSetActiveToken.mockResolvedValue(true)
  mockRemoveActiveToken.mockResolvedValue(true)
  mockRemoveSessionProfiles.mockResolvedValue(true)
}

describe("PersistentStateProvider", () => {
  beforeEach(setupStorageMockDefaults)

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

  it("wipes session profiles as well as the active token on a fresh install", async () => {
    // sessionProfiles survive uninstall in the same keychain and are reachable
    // through the account switcher — wiping only the active token would let a
    // new device owner restore the previous owner's session with one tap.
    mockLoadJson.mockResolvedValue(null)

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("token")).toBeTruthy()
    })

    expect(mockRemoveActiveToken).toHaveBeenCalled()
    expect(mockRemoveSessionProfiles).toHaveBeenCalled()
  })

  it("retries a failed reinstall wipe once and reports if it still fails", async () => {
    mockLoadJson.mockResolvedValue(null)
    mockRemoveActiveToken.mockResolvedValue(false)

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("token")).toBeTruthy()
    })

    expect(mockRemoveActiveToken).toHaveBeenCalledTimes(2)
    expect(mockRecordError).toHaveBeenCalledTimes(1)
    expect(mockRecordError.mock.calls[0][0].message).toContain(
      "Reinstall keychain cleanup failed",
    )
  })

  it("retries and reports a failed session-profile wipe independently", async () => {
    // Each credential gets its own retry+report: a regression that unwrapped
    // the second removeWithRetry call would otherwise pass the suite.
    mockLoadJson.mockResolvedValue(null)
    mockRemoveSessionProfiles.mockResolvedValue(false)

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("token")).toBeTruthy()
    })

    expect(mockRemoveSessionProfiles).toHaveBeenCalledTimes(2)
    expect(mockRecordError).toHaveBeenCalledTimes(1)
    expect(mockRecordError.mock.calls[0][0].message).toContain("session profiles")
  })

  it("does not report when the reinstall wipe succeeds on the retry", async () => {
    mockLoadJson.mockResolvedValue(null)
    mockRemoveActiveToken.mockResolvedValueOnce(false)

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("token")).toBeTruthy()
    })

    expect(mockRemoveActiveToken).toHaveBeenCalledTimes(2)
    expect(mockRecordError).not.toHaveBeenCalled()
  })

  it("does not wipe the keychain for an unrecognized schema version", async () => {
    // A downgrade from a future build is not a reinstall: the blob exists but
    // can't be read. The session must survive the round trip.
    mockLoadJson.mockResolvedValue({ schemaVersion: 99, galoyInstance: { id: "Main" } })
    mockGetActiveToken.mockResolvedValue("kc-token")

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("token")).toBeTruthy()
    })

    expect(mockRemoveActiveToken).not.toHaveBeenCalled()
    expect(mockRemoveSessionProfiles).not.toHaveBeenCalled()
    // Downgrade boots keep the session (Failed → keychain recovery).
    expect(screen.getByTestId("token").props.children).toBe("kc-token")
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

  it("serializes saves: a queued save waits for the slow one before it", async () => {
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
})

describe("PersistentStateProvider quarantine token hygiene", () => {
  beforeEach(setupStorageMockDefaults)

  const SCRUB_DONE_KEY = "persistentStateQuarantineScrubDone"

  // The sweep reads the done-marker first; answer per key so the marker
  // lookup stays null while quarantine keys return their payloads.
  const mockQuarantineEntries = (entries: Record<string, string>) => {
    mockLoadString.mockImplementation((key: string) =>
      Promise.resolve(entries[key] ?? null),
    )
  }

  it("redacts the token from pre-existing quarantine keys at load", async () => {
    mockLoadJson.mockResolvedValue(scrubbedBlob)
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
    mockLoadJson.mockResolvedValue(scrubbedBlob)
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
    mockLoadJson.mockResolvedValue(scrubbedBlob)
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
    mockLoadJson.mockResolvedValue(scrubbedBlob)
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
    mockLoadJson.mockResolvedValue(scrubbedBlob)
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
    mockLoadJson.mockResolvedValue(corruptedState3)
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
    expect(mockRecordError.mock.calls[0][0].message).toContain("Galoy instance not found")
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
    mockLoadJson.mockResolvedValue(corruptedState3)
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
    expect(
      mockSaveString.mock.calls.filter(([k]) =>
        String(k).startsWith("persistentStateQuarantine."),
      ),
    ).toHaveLength(0)
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
    expect(
      mockSaveString.mock.calls.filter(([k]) =>
        String(k).startsWith("persistentStateQuarantine."),
      ),
    ).toHaveLength(0)
  })
})
