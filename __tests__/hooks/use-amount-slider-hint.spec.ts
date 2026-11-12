import { act, renderHook } from "@testing-library/react-native"

import { useAmountSliderHint } from "@app/hooks/use-amount-slider-hint"
import { PersistentState } from "@app/store/persistent-state/state-migrations"

const mockUpdateState = jest.fn()
let mockPersistentState: PersistentState

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({
    persistentState: mockPersistentState,
    updateState: mockUpdateState,
  }),
}))

const baseState: PersistentState = {
  schemaVersion: 23,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
}

/** Runs the updater the hook handed to `updateState` against a state. */
const applyLastUpdate = (state: PersistentState | undefined) =>
  mockUpdateState.mock.calls[mockUpdateState.mock.calls.length - 1][0](state)

describe("useAmountSliderHint", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPersistentState = { ...baseState }
  })

  it("shows the hint while the flag is unset", () => {
    const { result } = renderHook(() => useAmountSliderHint())

    expect(result.current.showAmountSliderHint).toBe(true)
  })

  it("hides the hint once the slider is learned", () => {
    mockPersistentState = { ...baseState, hasLearnedAmountSlider: true }

    const { result } = renderHook(() => useAmountSliderHint())

    expect(result.current.showAmountSliderHint).toBe(false)
  })

  it("stores the flag device-wide, keeping the rest of the state", () => {
    mockPersistentState = { ...baseState, activeAccountId: "self-custodial-1" }
    const { result } = renderHook(() => useAmountSliderHint())

    act(() => result.current.markAmountSliderLearned())

    expect(applyLastUpdate(mockPersistentState)).toEqual({
      ...mockPersistentState,
      hasLearnedAmountSlider: true,
    })
  })

  it("leaves a state that hasn't loaded yet alone", () => {
    const { result } = renderHook(() => useAmountSliderHint())

    act(() => result.current.markAmountSliderLearned())

    expect(applyLastUpdate(undefined)).toBeUndefined()
  })
})
