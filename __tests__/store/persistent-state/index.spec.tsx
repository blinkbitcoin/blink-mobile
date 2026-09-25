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
const mockReadString = jest.fn()
const mockGetAllKeys = jest.fn()

jest.mock("@app/utils/storage", () => ({
  saveJson: (...args: unknown[]) => mockSaveJson(...args),
  saveString: (...args: unknown[]) => mockSaveString(...args),
  loadString: (...args: unknown[]) => mockLoadString(...args),
  readString: (...args: unknown[]) => mockReadString(...args),
  getAllKeys: (...args: unknown[]) => mockGetAllKeys(...args),
}))

const mockSweepMnemonicMigration = jest.fn()
const mockReadSelfCustodialIndexPresence = jest.fn()
// Scheduled off the boot path once the state has loaded; its own spec covers
// what it does, and here it must not add reports to the ones under assertion.
// The account index is the second witness the key-material wipe waits for.
jest.mock("@app/self-custodial/storage/account-index", () => ({
  sweepMnemonicMigration: (...args: unknown[]) => mockSweepMnemonicMigration(...args),
  readSelfCustodialIndexPresence: (...args: unknown[]) =>
    mockReadSelfCustodialIndexPresence(...args),
  SelfCustodialIndexPresence: {
    Absent: "absent",
    Present: "present",
    Unknown: "unknown",
  },
  SWEEP_IDLE_TIMEOUT_MS: 5000,
}))

const mockGetActiveToken = jest.fn()
const mockReadActiveToken = jest.fn()
const mockSetActiveToken = jest.fn()
const mockRemoveActiveToken = jest.fn()
const mockClearUninstallSurvivingCredentials = jest.fn()
const mockClearUninstallSurvivingKeyMaterial = jest.fn()
const mockClearLegacyKeyStore = jest.fn()

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    getActiveToken: (...args: unknown[]) => mockGetActiveToken(...args),
    readActiveToken: (...args: unknown[]) => mockReadActiveToken(...args),
    setActiveToken: (...args: unknown[]) => mockSetActiveToken(...args),
    removeActiveToken: (...args: unknown[]) => mockRemoveActiveToken(...args),
    clearLegacyKeyStore: (...args: unknown[]) => mockClearLegacyKeyStore(...args),
    clearUninstallSurvivingKeyMaterial: (...args: unknown[]) =>
      mockClearUninstallSurvivingKeyMaterial(...args),
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
  mockSweepMnemonicMigration.mockResolvedValue({ status: "ok", migrated: 0 })
  // A real reinstall clears the index, so absence is the default here.
  mockReadSelfCustodialIndexPresence.mockResolvedValue("absent")
  mockSaveJson.mockResolvedValue(undefined)
  mockSaveString.mockResolvedValue(true)
  mockLoadString.mockImplementation(async (key: string) => storedStrings.get(key) ?? null)
  // The blob is read through readString so that an absent key and a failed
  // read stay apart; the quarantine sweep still uses loadString.
  mockReadString.mockImplementation(async (key: string) => {
    const value = storedStrings.get(key)
    return value === undefined ? { status: "absent" } : { status: "found", value }
  })
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
    mockReadString.mockReturnValue(new Promise(() => {}))

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

  it("runs the mnemonic migration sweep once the boot interactions settle", async () => {
    // The sweep is the only thing that records the mnemonics of an upgrading
    // install, and the reinstall wipe reaches nothing without those records, so
    // losing this call would quietly strand every seed it was meant to reach.
    setPersistedBlob(scrubbedBlob)

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    await waitFor(() => {
      expect(mockSweepMnemonicMigration).toHaveBeenCalledTimes(1)
    })
  })

  /**
   * The bound is what keeps this equivalent to the InteractionManager call it
   * replaced. An idle callback with no timeout can be starved for a whole
   * launch on a busy boot, and a launch that never sweeps is a launch whose
   * mnemonics never migrate.
   */
  it("bounds the idle wait, so a busy boot still sweeps", async () => {
    const scheduleIdle = jest.spyOn(global, "requestIdleCallback")
    setPersistedBlob(scrubbedBlob)

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    await waitFor(() => {
      expect(mockSweepMnemonicMigration).toHaveBeenCalled()
    })

    expect(scheduleIdle).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ timeout: expect.any(Number) }),
    )
    scheduleIdle.mockRestore()
  })

  it("boots through a sweep that rejects, which is a migration detail and not a boot failure", async () => {
    setPersistedBlob(scrubbedBlob)
    mockGetActiveToken.mockResolvedValue("saved-token")
    mockSweepMnemonicMigration.mockRejectedValue(new Error("keychain unavailable"))

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("token").props.children).toBe("saved-token")
    })
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

describe("PersistentStateProvider reinstall wipe", () => {
  beforeEach(setupStorageMockDefaults)

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

  /**
   * The verdict that reaches here is a heuristic, and it is wrong often enough
   * that the half which destroys key material waits for a second witness. The
   * account index lives in AsyncStorage, which a real reinstall clears, so
   * accounts still listed prove this device is not one.
   */
  it("does not erase key material when the account index still lists accounts", async () => {
    storedStrings.delete(PERSISTENT_STATE_KEY)
    mockReadSelfCustodialIndexPresence.mockResolvedValue("present")

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("token")).toBeTruthy()
    })

    // The session half still runs: a wrong verdict there costs a re-login.
    expect(mockClearUninstallSurvivingCredentials).toHaveBeenCalledTimes(1)
    expect(mockClearUninstallSurvivingKeyMaterial).not.toHaveBeenCalled()
    expect(mockRecordError.mock.calls.map(([err]) => err.message)).toContain(
      "Reinstall key-material wipe skipped: account index is populated",
    )
  })

  /**
   * Withholding the blob used to be how the erase stayed owed — but the blob's
   * absence is also what re-triggers the session wipe, so the user was signed
   * out on every launch with nothing to end the loop. The marker carries the
   * owed work instead, and the blob is written.
   */
  it("records the erase as owed and still writes the blob when the index cannot answer", async () => {
    storedStrings.delete(PERSISTENT_STATE_KEY)
    mockReadSelfCustodialIndexPresence.mockResolvedValue("unknown")

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("token")).toBeTruthy()
    })

    expect(mockClearUninstallSurvivingKeyMaterial).not.toHaveBeenCalled()
    expect(mockRecordError.mock.calls.map(([err]) => err.message)).toContain(
      "Reinstall key-material wipe deferred: account index unreadable",
    )

    // Nothing is pressed on purpose. The blob is normally written because the
    // user changed something, and a launch that just signed them out is the
    // launch where they change nothing — so a marker that waits for a change
    // is a marker that never lands, and the loop it ends never ends.
    await waitFor(() => {
      expect(mockSaveJson).toHaveBeenCalled()
    })
    expect(mockSaveJson.mock.calls.at(-1)?.[1]).toMatchObject({
      pendingReinstallKeyMaterialWipe: true,
    })
  })

  /**
   * An erase that ran and failed is as owed as one that never ran: the seeds are
   * still in the keychain, and once the blob lands this branch never runs again,
   * so nothing would ever reach them.
   */
  it("records the erase as owed when it ran and failed", async () => {
    storedStrings.delete(PERSISTENT_STATE_KEY)
    // Once, not for the file: clearAllMocks resets calls but not
    // implementations, so this would otherwise fail every later wipe.
    mockClearUninstallSurvivingKeyMaterial.mockImplementationOnce(
      async (onFailure: (what: string) => void) => {
        onFailure("mnemonic")
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

    // Unprompted, as above: the marker only means something once written.
    await waitFor(() => {
      expect(mockSaveJson).toHaveBeenCalled()
    })
    expect(mockSaveJson.mock.calls.at(-1)?.[1]).toMatchObject({
      pendingReinstallKeyMaterialWipe: true,
    })
  })

  /**
   * The legacy store holds the pre-migration copies of the very mnemonics this
   * erase is for, so a clear that failed is a reinstall that left seeds behind.
   * Reporting it is not enough — without the marker, the next boot reads a blob
   * that says the wipe is done.
   */
  it("records the erase as owed when the legacy store cannot be cleared", async () => {
    storedStrings.delete(PERSISTENT_STATE_KEY)
    mockClearLegacyKeyStore.mockImplementationOnce(
      async (onFailure: (what: string) => void) => {
        onFailure("legacy key store")
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

    await waitFor(() => {
      expect(mockSaveJson).toHaveBeenCalled()
    })
    expect(mockSaveJson.mock.calls.at(-1)?.[1]).toMatchObject({
      pendingReinstallKeyMaterialWipe: true,
    })
  })

  /**
   * The only shape that shows the bug this marker replaced. Within one boot,
   * "nothing was written" is also what a correct implementation looks like; it
   * takes a second boot to see that the loop does not end. The keychain is
   * modelled as a variable so the second render sees what the first left.
   */
  it("stops wiping the session on the second boot, and finishes the erase it owed", async () => {
    storedStrings.delete(PERSISTENT_STATE_KEY)
    mockClearUninstallSurvivingKeyMaterial.mockImplementationOnce(
      async (onFailure: (what: string) => void) => {
        onFailure("mnemonic")
      },
    )

    const first = render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId("token")).toBeTruthy()
    })
    // Written without anyone touching the app, which is the only way this
    // sequence happens on a real device.
    await waitFor(() => {
      expect(mockSaveJson).toHaveBeenCalled()
    })
    // The blob the first boot wrote is what the second one reads.
    const written = mockSaveJson.mock.calls.at(-1)?.[1]
    storedStrings.set(PERSISTENT_STATE_KEY, JSON.stringify(written))
    first.unmount()

    mockClearUninstallSurvivingCredentials.mockClear()
    mockClearUninstallSurvivingKeyMaterial.mockClear()
    mockSaveJson.mockClear()

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId("token")).toBeTruthy()
    })

    // The loop is over: the session is not wiped a second time, which is what
    // used to sign the user out on every launch.
    expect(mockClearUninstallSurvivingCredentials).not.toHaveBeenCalled()
    // And the erase that was owed is retried, not forgotten.
    await waitFor(() => {
      expect(mockClearUninstallSurvivingKeyMaterial).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(mockSaveJson.mock.calls.at(-1)?.[1]).not.toHaveProperty(
        "pendingReinstallKeyMaterialWipe",
      )
    })
  })

  /**
   * The marker is recorded on an "unknown" verdict, and that boot skips the
   * legacy clear along with everything else it holds back. The retry is
   * therefore the first time it runs at all — a retry that only erased the new
   * store would retire the marker with every pre-migration copy still there.
   */
  it("clears the legacy store when it retries the owed erase", async () => {
    storedStrings.set(
      PERSISTENT_STATE_KEY,
      JSON.stringify({ ...scrubbedBlob, pendingReinstallKeyMaterialWipe: true }),
    )
    mockReadSelfCustodialIndexPresence.mockResolvedValue("absent")

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("token")).toBeTruthy()
    })

    await waitFor(() => {
      expect(mockClearLegacyKeyStore).toHaveBeenCalledTimes(1)
    })
    expect(mockClearUninstallSurvivingKeyMaterial).toHaveBeenCalledTimes(1)
    // Only then is the marker retired.
    await waitFor(() => {
      expect(mockSaveJson.mock.calls.at(-1)?.[1]).not.toHaveProperty(
        "pendingReinstallKeyMaterialWipe",
      )
    })
  })

  /**
   * The retry's own legacy clear is held to the same rule as the first one: it
   * failed, so the seeds it covers are still there and the marker stays.
   */
  it("keeps the marker when the retry cannot clear the legacy store", async () => {
    storedStrings.set(
      PERSISTENT_STATE_KEY,
      JSON.stringify({ ...scrubbedBlob, pendingReinstallKeyMaterialWipe: true }),
    )
    mockReadSelfCustodialIndexPresence.mockResolvedValue("absent")
    mockClearLegacyKeyStore.mockImplementationOnce(
      async (onFailure: (what: string) => void) => {
        onFailure("legacy key store")
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

    mockSaveJson.mockClear()
    await act(async () => {
      fireEvent.press(screen.getByTestId("update-btn"))
    })

    await waitFor(() => {
      expect(mockSaveJson).toHaveBeenCalled()
    })
    expect(mockSaveJson.mock.calls.at(-1)?.[1]).toMatchObject({
      pendingReinstallKeyMaterialWipe: true,
    })
  })

  it("abandons the owed erase once the device has an account of its own", async () => {
    storedStrings.set(
      PERSISTENT_STATE_KEY,
      JSON.stringify({ ...scrubbedBlob, pendingReinstallKeyMaterialWipe: true }),
    )
    mockReadSelfCustodialIndexPresence.mockResolvedValue("present")

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("token")).toBeTruthy()
    })

    // The tracked list now names this user's mnemonic too, so the erase can no
    // longer tell whose seeds it would take.
    expect(mockClearUninstallSurvivingKeyMaterial).not.toHaveBeenCalled()
    expect(mockRecordError.mock.calls.map(([err]) => err.message)).toContain(
      "Reinstall key-material wipe abandoned: an account now exists",
    )
  })

  it("leaves no marker when the erase completed", async () => {
    storedStrings.delete(PERSISTENT_STATE_KEY)

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("token")).toBeTruthy()
    })

    mockSaveJson.mockClear()
    await act(async () => {
      fireEvent.press(screen.getByTestId("update-btn"))
    })

    await waitFor(() => {
      expect(mockSaveJson).toHaveBeenCalled()
    })
    expect(mockSaveJson.mock.calls[0][1]).not.toHaveProperty(
      "pendingReinstallKeyMaterialWipe",
    )
  })

  it("saves normally once the erase has actually completed", async () => {
    storedStrings.delete(PERSISTENT_STATE_KEY)

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("token")).toBeTruthy()
    })

    mockSaveJson.mockClear()
    await act(async () => {
      fireEvent.press(screen.getByTestId("update-btn"))
    })

    await waitFor(() => {
      expect(mockSaveJson).toHaveBeenCalled()
    })
  })

  it("saves normally once the index says this is not a reinstall", async () => {
    storedStrings.delete(PERSISTENT_STATE_KEY)
    mockReadSelfCustodialIndexPresence.mockResolvedValue("present")

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("token")).toBeTruthy()
    })

    mockSaveJson.mockClear()
    await act(async () => {
      fireEvent.press(screen.getByTestId("update-btn"))
    })

    // Nothing is owed, so holding the blob back would strand this user on
    // defaults for every future boot.
    await waitFor(() => {
      expect(mockSaveJson).toHaveBeenCalled()
    })
  })

  /**
   * Gap the session half used to have. `removeThrough` refuses to empty the new
   * store until the legacy copy is provably gone, so a legacy store that cannot
   * answer failed every session slot too — and a reinstall could leave the
   * previous owner signed in. Clearing it by service first unblocks both halves,
   * so it has to run before either.
   */
  it("clears the legacy store before either half, so neither is blocked by it", async () => {
    storedStrings.delete(PERSISTENT_STATE_KEY)
    const order: string[] = []
    mockClearLegacyKeyStore.mockImplementation(async () => {
      order.push("legacy store")
    })
    mockClearUninstallSurvivingCredentials.mockImplementation(async () => {
      order.push("session")
    })
    mockClearUninstallSurvivingKeyMaterial.mockImplementation(async () => {
      order.push("key material")
    })

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("token")).toBeTruthy()
    })

    expect(order).toEqual(["legacy store", "session", "key material"])
  })

  /**
   * Held back on a false positive: the legacy mnemonic copies are the rollback
   * insurance, and a re-login is not worth taking them.
   */
  it("leaves the legacy store alone when the index says this is no reinstall", async () => {
    storedStrings.delete(PERSISTENT_STATE_KEY)
    mockReadSelfCustodialIndexPresence.mockResolvedValue("present")

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("token")).toBeTruthy()
    })

    expect(mockClearLegacyKeyStore).not.toHaveBeenCalled()
    // The session half still runs, because being wrong there costs a re-login.
    expect(mockClearUninstallSurvivingCredentials).toHaveBeenCalledTimes(1)
  })

  it("erases key material once the index corroborates the fresh install", async () => {
    storedStrings.delete(PERSISTENT_STATE_KEY)

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("token")).toBeTruthy()
    })

    expect(mockClearUninstallSurvivingKeyMaterial).toHaveBeenCalledTimes(1)
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

  /**
   * `migratePersistentState`'s guard is `if (!data)`, so a stored "null", "0" or
   * "false" parses to something it scores as no data at all and would reach the
   * fresh-install branch — spending a wipe that now destroys seed phrases on a
   * device that never reinstalled. A key that is present is evidence against a
   * fresh install whatever it holds.
   */
  it("does not treat a blob that parses to an empty value as a fresh install", async () => {
    for (const stored of ["null", "0", "false", '""']) {
      setupStorageMockDefaults()
      storedStrings.set(PERSISTENT_STATE_KEY, stored)

      const view = render(
        <PersistentStateProvider>
          <TestConsumer />
        </PersistentStateProvider>,
      )

      await waitFor(() => {
        expect(screen.getByTestId("token")).toBeTruthy()
      })

      expect(mockClearUninstallSurvivingCredentials).not.toHaveBeenCalled()
      expect(mockClearUninstallSurvivingKeyMaterial).not.toHaveBeenCalled()
      view.unmount()
    }
  })

  it("quarantines a blob that parsed to an empty value, rather than discarding it", async () => {
    storedStrings.set(PERSISTENT_STATE_KEY, "null")

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("token")).toBeTruthy()
    })

    expect(
      mockSaveString.mock.calls.filter(([k]) =>
        String(k).startsWith("persistentStateQuarantine."),
      ),
    ).toHaveLength(1)
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

  // The third case, and the one that costs the most to get wrong: the store
  // could not answer at all. An absent blob wipes every credential that
  // outlives an uninstall, mnemonics included, so a throwing read scored as
  // absent would take a user's key material on a device nobody reinstalled.
  describe("a read that failed", () => {
    const readFailed = { status: "failed", err: new Error("storage unavailable") }

    /**
     * Most of these faults last an instant. Without the second attempt a
     * persistent one would mean a session that never persists, on every launch,
     * which is worse for the user than the one-time loss it replaces.
     */
    it("tries the read a second time before giving up on it", async () => {
      setPersistedBlob(scrubbedBlob)
      const succeed = mockReadString.getMockImplementation()
      mockReadString
        .mockResolvedValueOnce(readFailed)
        .mockImplementation(succeed as (key: string) => Promise<unknown>)
      mockGetActiveToken.mockResolvedValue("saved-token")

      render(
        <PersistentStateProvider>
          <TestConsumer />
        </PersistentStateProvider>,
      )

      await waitFor(() => {
        expect(screen.getByTestId("token").props.children).toBe("saved-token")
      })

      // The retry answered, so this boot is a normal one: the state loaded and
      // nothing was treated as unreadable.
      expect(mockRecordError).not.toHaveBeenCalled()
    })

    /**
     * The state in memory is defaults, not anything loaded, so saving would put
     * those defaults over a blob that is still intact and would have read fine
     * next launch. That is how a momentary fault becomes permanent loss of every
     * preference — the very next tap that selects a wallet triggers a save.
     */
    it("stops saving the blob for the session, so a tap cannot overwrite it", async () => {
      mockReadString.mockResolvedValue(readFailed)

      render(
        <PersistentStateProvider>
          <TestConsumer />
        </PersistentStateProvider>,
      )

      await waitFor(() => {
        expect(screen.getByTestId("token")).toBeTruthy()
      })

      mockSaveJson.mockClear()
      await act(async () => {
        fireEvent.press(screen.getByTestId("update-btn"))
      })

      expect(mockSaveJson).not.toHaveBeenCalled()
    })

    /**
     * Only the blob is held back. The two stores failed independently: the
     * session is whatever the keychain says, and a login during this boot has to
     * survive it.
     */
    it("keeps saving the keychain token, which the blob failure says nothing about", async () => {
      mockReadString.mockResolvedValue(readFailed)
      mockGetActiveToken.mockResolvedValue("")

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
        expect(mockSetActiveToken).toHaveBeenCalled()
      })
      expect(mockSaveJson).not.toHaveBeenCalled()
    })

    it("does not wipe the credentials a fresh install would clear", async () => {
      mockReadString.mockResolvedValue(readFailed)

      render(
        <PersistentStateProvider>
          <TestConsumer />
        </PersistentStateProvider>,
      )

      await waitFor(() => {
        expect(screen.getByTestId("token")).toBeTruthy()
      })

      expect(mockClearUninstallSurvivingCredentials).not.toHaveBeenCalled()
    })

    it("keeps the keychain session rather than booting signed out", async () => {
      mockReadString.mockResolvedValue(readFailed)
      mockGetActiveToken.mockResolvedValue("live-session-token")

      render(
        <PersistentStateProvider>
          <TestConsumer />
        </PersistentStateProvider>,
      )

      await waitFor(() => {
        expect(screen.getByTestId("token")).toBeTruthy()
      })

      expect(screen.getByTestId("token").props.children).toBe("live-session-token")
    })

    it("reports the failure to crashlytics instead of passing for a fresh install", async () => {
      mockReadString.mockResolvedValue(readFailed)

      render(
        <PersistentStateProvider>
          <TestConsumer />
        </PersistentStateProvider>,
      )

      await waitFor(() => {
        expect(mockRecordError).toHaveBeenCalled()
      })
      expect(mockRecordError.mock.calls[0][0].message).toBe("storage unavailable")
    })

    it("names a rejection that is not an Error rather than reporting nothing", async () => {
      mockReadString.mockResolvedValue({ status: "failed", err: "not even an error" })

      render(
        <PersistentStateProvider>
          <TestConsumer />
        </PersistentStateProvider>,
      )

      await waitFor(() => {
        expect(mockRecordError).toHaveBeenCalled()
      })
      expect(mockRecordError.mock.calls[0][0].message).toBe(
        "Persistent state read failed: not even an error",
      )
    })

    it("quarantines nothing: there is no blob to describe", async () => {
      mockReadString.mockResolvedValue(readFailed)

      render(
        <PersistentStateProvider>
          <TestConsumer />
        </PersistentStateProvider>,
      )

      await waitFor(() => {
        expect(screen.getByTestId("token")).toBeTruthy()
      })

      expect(
        mockSaveString.mock.calls.filter(([k]) =>
          String(k).startsWith("persistentStateQuarantine."),
        ),
      ).toHaveLength(0)
    })

    it("still wipes on the absent key it is kept apart from", async () => {
      // The guard must not cost the reinstall wipe its actual trigger.
      mockReadString.mockResolvedValue({ status: "absent" })

      render(
        <PersistentStateProvider>
          <TestConsumer />
        </PersistentStateProvider>,
      )

      await waitFor(() => {
        expect(screen.getByTestId("token")).toBeTruthy()
      })

      expect(mockClearUninstallSurvivingCredentials).toHaveBeenCalledTimes(1)
    })
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
