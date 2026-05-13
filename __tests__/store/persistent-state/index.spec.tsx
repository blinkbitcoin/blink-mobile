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

jest.mock("@app/utils/storage", () => ({
  loadJson: (...args: unknown[]) => mockLoadJson(...args),
  saveJson: (...args: unknown[]) => mockSaveJson(...args),
  saveString: (...args: unknown[]) => mockSaveString(...args),
}))

const mockRecordError = jest.fn()
jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: (...args: unknown[]) => mockRecordError(...args),
}))

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
      <TouchableOpacity testID="reset-btn" onPress={ctx.resetState} />
    </>
  )
}

describe("PersistentStateProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSaveJson.mockResolvedValue(true)
    mockSaveString.mockResolvedValue(true)
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
    mockLoadJson.mockResolvedValue({
      schemaVersion: 6,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "saved-token",
    })

    render(
      <PersistentStateProvider>
        <TestConsumer />
      </PersistentStateProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("token")).toBeTruthy()
    })

    expect(screen.getByTestId("token").props.children).toBe("saved-token")
    expect(screen.getByTestId("schema").props.children).toBe(11)
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

  it("does NOT save state on initial load (no-op write guard)", async () => {
    mockLoadJson.mockResolvedValue({
      schemaVersion: 6,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "existing",
    })

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
  })

  it("saves state after updateState is called", async () => {
    mockLoadJson.mockResolvedValue({
      schemaVersion: 6,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "old-token",
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
      expect(screen.getByTestId("token").props.children).toBe("new-token")
    })

    expect(mockSaveJson).toHaveBeenCalledWith(
      "persistentState",
      expect.objectContaining({ galoyAuthToken: "new-token" }),
    )
  })

  it("saves state after resetState is called", async () => {
    mockLoadJson.mockResolvedValue({
      schemaVersion: 6,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "some-token",
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
      fireEvent.press(screen.getByTestId("reset-btn"))
    })

    await waitFor(() => {
      expect(screen.getByTestId("token").props.children).toBe(
        defaultPersistentState.galoyAuthToken,
      )
    })

    expect(mockSaveJson).toHaveBeenCalledWith(
      "persistentState",
      expect.objectContaining(defaultPersistentState),
    )
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

    it("quarantines the raw input under a timestamped backup key before falling back to defaults", async () => {
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
      expect(JSON.parse(payload)).toEqual(corruptedState3)

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
      mockLoadJson.mockResolvedValue({
        schemaVersion: 6,
        galoyInstance: { id: "Main" },
        galoyAuthToken: "saved",
      })

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
