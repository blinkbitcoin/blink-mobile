import React from "react"
import { act, render } from "@testing-library/react-native"
import { Text } from "react-native"

import { HideAmountContainer } from "@app/graphql/hide-amount-component"
import { useHideAmount } from "@app/graphql/hide-amount-context"
import { PersistentStateContext } from "@app/store/persistent-state"
import { PersistentState } from "@app/store/persistent-state/state-migrations"

const mockReadQuery = jest.fn()

// requireActual: generated.ts builds its documents with the real gql at import time.
jest.mock("@apollo/client", () => ({
  ...jest.requireActual("@apollo/client"),
  useApolloClient: () => ({ readQuery: mockReadQuery }),
}))

const baseState: PersistentState = {
  schemaVersion: 21,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
}

let capturedContext: ReturnType<typeof useHideAmount> | null = null

const ContextCapture: React.FC = () => {
  capturedContext = useHideAmount()
  return <Text testID="child">child</Text>
}

/**
 * Real PersistentStateContext with live state, so a write is visible to the next
 * render exactly as it is in the app. `updateState` doubles as the spy for the
 * assertions about what does and does not get persisted.
 */
const updateState = jest.fn()
let writeState: (update: (prev: PersistentState) => PersistentState) => void = () => {}

const Harness: React.FC<{ initialState: PersistentState }> = ({ initialState }) => {
  const [persistentState, setPersistentState] = React.useState(initialState)

  const contextValue = React.useMemo(
    () => ({
      persistentState,
      updateState: (update: (state?: PersistentState) => PersistentState | undefined) => {
        updateState(update)
        setPersistentState((prev) => update(prev) ?? prev)
      },
      resetState: jest.fn(),
      clearToken: jest.fn().mockResolvedValue(undefined),
    }),
    [persistentState],
  )

  writeState = (update) => setPersistentState((prev) => update(prev))

  return (
    <PersistentStateContext.Provider value={contextValue}>
      <HideAmountContainer>
        <ContextCapture />
      </HideAmountContainer>
    </PersistentStateContext.Provider>
  )
}

const renderContainer = (initialState: PersistentState = baseState) =>
  render(<Harness initialState={initialState} />)

const settingChangedTo = (alwaysHideBalance: boolean) => (prev: PersistentState) => ({
  ...prev,
  alwaysHideBalance,
})

const tokenChanged = (prev: PersistentState) => ({ ...prev, galoyAuthToken: "new-token" })

/** What the container actually persisted, in call order. */
const persistedWrites = () =>
  updateState.mock.calls.map(([update]) => update(baseState) as PersistentState)

beforeEach(() => {
  jest.clearAllMocks()
  capturedContext = null
  mockReadQuery.mockReturnValue({ hideBalance: false })
})

describe("HideAmountContainer", () => {
  describe("seeding at mount", () => {
    it("starts visible when nothing is stored", () => {
      renderContainer()

      expect(capturedContext?.hideAmount).toBe(false)
    })

    it("restores the last remembered visibility when always-hide is off", () => {
      renderContainer({ ...baseState, alwaysHideBalance: false, balanceHidden: true })

      expect(capturedContext?.hideAmount).toBe(true)
    })

    it("starts hidden when always-hide is on, whatever was last remembered", () => {
      renderContainer({ ...baseState, alwaysHideBalance: true, balanceHidden: false })

      expect(capturedContext?.hideAmount).toBe(true)
    })

    it("writes nothing on mount", () => {
      renderContainer({ ...baseState, alwaysHideBalance: false, balanceHidden: true })

      expect(updateState).not.toHaveBeenCalled()
    })
  })

  describe("toggleHideAmount", () => {
    it("persists the new visibility while always-hide is off", () => {
      renderContainer({ ...baseState, alwaysHideBalance: false })

      act(() => capturedContext?.toggleHideAmount())

      expect(capturedContext?.hideAmount).toBe(true)
      expect(persistedWrites()).toEqual([
        expect.objectContaining({ balanceHidden: true }),
      ])

      act(() => capturedContext?.toggleHideAmount())

      expect(capturedContext?.hideAmount).toBe(false)
      expect(persistedWrites()[1]).toEqual(
        expect.objectContaining({ balanceHidden: false }),
      )
    })

    it("keeps a peek session-only while always-hide is on", () => {
      renderContainer({ ...baseState, alwaysHideBalance: true })

      act(() => capturedContext?.toggleHideAmount())

      expect(capturedContext?.hideAmount).toBe(false)
      expect(updateState).not.toHaveBeenCalled()
    })
  })

  describe("reacting to the always-hide setting", () => {
    it("hides without remembering when the setting is turned on", () => {
      renderContainer({ ...baseState, alwaysHideBalance: false })

      act(() => writeState(settingChangedTo(true)))

      expect(capturedContext?.hideAmount).toBe(true)
      expect(updateState).not.toHaveBeenCalled()
    })

    it("reveals and remembers that choice when the setting is turned off", () => {
      renderContainer({ ...baseState, alwaysHideBalance: true, balanceHidden: true })

      act(() => writeState(settingChangedTo(false)))

      expect(capturedContext?.hideAmount).toBe(false)
      expect(persistedWrites()).toEqual([
        expect.objectContaining({ balanceHidden: false }),
      ])
    })

    it("does not write when an unrelated part of the state changes", () => {
      renderContainer({ ...baseState, alwaysHideBalance: false, balanceHidden: true })

      act(() => writeState(tokenChanged))

      expect(capturedContext?.hideAmount).toBe(true)
      expect(updateState).not.toHaveBeenCalled()
    })
  })

  describe("adopting the legacy Apollo setting", () => {
    it("starts hidden and stores the setting once", () => {
      mockReadQuery.mockReturnValue({ hideBalance: true })

      renderContainer(baseState)

      expect(capturedContext?.hideAmount).toBe(true)
      expect(persistedWrites()).toEqual([
        expect.objectContaining({ alwaysHideBalance: true }),
      ])
    })

    it("treats the adopted value as the setting, so a peek is not remembered", () => {
      mockReadQuery.mockReturnValue({ hideBalance: true })
      renderContainer(baseState)
      updateState.mockClear()

      act(() => capturedContext?.toggleHideAmount())

      expect(capturedContext?.hideAmount).toBe(false)
      expect(updateState).not.toHaveBeenCalled()
    })

    it("ignores the legacy value once the setting has been stored", () => {
      mockReadQuery.mockReturnValue({ hideBalance: true })

      renderContainer({ ...baseState, alwaysHideBalance: false })

      expect(capturedContext?.hideAmount).toBe(false)
      expect(updateState).not.toHaveBeenCalled()
    })

    it("survives a cache that cannot answer the legacy query", () => {
      mockReadQuery.mockImplementation(() => {
        throw new Error("missing field")
      })

      renderContainer(baseState)

      expect(capturedContext?.hideAmount).toBe(false)
      expect(updateState).not.toHaveBeenCalled()
    })
  })
})
