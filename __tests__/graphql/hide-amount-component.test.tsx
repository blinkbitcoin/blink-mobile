import React from "react"
import { act, render } from "@testing-library/react-native"
import { Text } from "react-native"

import { HideAmountContainer } from "@app/graphql/hide-amount-component"
import { useHideAmount } from "@app/graphql/hide-amount-context"

jest.mock("@app/graphql/generated", () => ({
  useHideBalanceQuery: jest.fn(),
}))

// Mocked only to assert the container never persists — a peek must not write
// the hideBalance setting (that is the Security screen's job).
jest.mock("@app/graphql/client-only-query", () => ({
  saveHideBalance: jest.fn(),
  saveHiddenBalanceToolTip: jest.fn(),
}))

import { useHideBalanceQuery } from "@app/graphql/generated"
import { saveHideBalance, saveHiddenBalanceToolTip } from "@app/graphql/client-only-query"

const mockUseHideBalanceQuery = useHideBalanceQuery as jest.Mock
const mockSaveHideBalance = saveHideBalance as jest.Mock
const mockSaveHiddenBalanceToolTip = saveHiddenBalanceToolTip as jest.Mock

let capturedContext: ReturnType<typeof useHideAmount> | null = null

const ContextCapture: React.FC = () => {
  capturedContext = useHideAmount()
  return <Text testID="child">child</Text>
}

beforeEach(() => {
  jest.clearAllMocks()
  capturedContext = null
})

describe("HideAmountContainer", () => {
  describe("context value from query", () => {
    it("provides hideAmount: false when hideBalance is false", () => {
      mockUseHideBalanceQuery.mockReturnValue({ data: { hideBalance: false } })

      render(
        <HideAmountContainer>
          <ContextCapture />
        </HideAmountContainer>,
      )

      expect(capturedContext?.hideAmount).toBe(false)
    })

    it("provides hideAmount: true when hideBalance is true", () => {
      mockUseHideBalanceQuery.mockReturnValue({ data: { hideBalance: true } })

      render(
        <HideAmountContainer>
          <ContextCapture />
        </HideAmountContainer>,
      )

      expect(capturedContext?.hideAmount).toBe(true)
    })

    it("defaults hideAmount to false when data is undefined", () => {
      mockUseHideBalanceQuery.mockReturnValue({ data: undefined })

      render(
        <HideAmountContainer>
          <ContextCapture />
        </HideAmountContainer>,
      )

      expect(capturedContext?.hideAmount).toBe(false)
    })
  })

  describe("switchMemoryHideAmount", () => {
    it("flips hideAmount in memory without persisting", () => {
      mockUseHideBalanceQuery.mockReturnValue({ data: { hideBalance: false } })

      render(
        <HideAmountContainer>
          <ContextCapture />
        </HideAmountContainer>,
      )

      act(() => capturedContext?.switchMemoryHideAmount())

      expect(capturedContext?.hideAmount).toBe(true)
      expect(mockSaveHideBalance).not.toHaveBeenCalled()
      expect(mockSaveHiddenBalanceToolTip).not.toHaveBeenCalled()
    })

    it("peeking while the persisted setting is enabled leaves it untouched", () => {
      mockUseHideBalanceQuery.mockReturnValue({ data: { hideBalance: true } })

      render(
        <HideAmountContainer>
          <ContextCapture />
        </HideAmountContainer>,
      )

      act(() => capturedContext?.switchMemoryHideAmount())

      expect(capturedContext?.hideAmount).toBe(false)
      expect(mockSaveHideBalance).not.toHaveBeenCalled()
      expect(mockSaveHiddenBalanceToolTip).not.toHaveBeenCalled()

      act(() => capturedContext?.switchMemoryHideAmount())

      expect(capturedContext?.hideAmount).toBe(true)
    })
  })

  describe("re-sync with the persisted hideBalance setting", () => {
    it("follows a mid-session change of the persisted value", () => {
      mockUseHideBalanceQuery.mockReturnValue({ data: { hideBalance: false } })

      const { rerender } = render(
        <HideAmountContainer>
          <ContextCapture />
        </HideAmountContainer>,
      )

      expect(capturedContext?.hideAmount).toBe(false)

      mockUseHideBalanceQuery.mockReturnValue({ data: { hideBalance: true } })
      rerender(
        <HideAmountContainer>
          <ContextCapture />
        </HideAmountContainer>,
      )

      expect(capturedContext?.hideAmount).toBe(true)
    })

    it("a persisted change overrides an earlier session peek", () => {
      mockUseHideBalanceQuery.mockReturnValue({ data: { hideBalance: true } })

      const { rerender } = render(
        <HideAmountContainer>
          <ContextCapture />
        </HideAmountContainer>,
      )

      act(() => capturedContext?.switchMemoryHideAmount())
      expect(capturedContext?.hideAmount).toBe(false)

      mockUseHideBalanceQuery.mockReturnValue({ data: { hideBalance: false } })
      rerender(
        <HideAmountContainer>
          <ContextCapture />
        </HideAmountContainer>,
      )
      expect(capturedContext?.hideAmount).toBe(false)

      mockUseHideBalanceQuery.mockReturnValue({ data: { hideBalance: true } })
      rerender(
        <HideAmountContainer>
          <ContextCapture />
        </HideAmountContainer>,
      )
      expect(capturedContext?.hideAmount).toBe(true)
    })
  })
})
