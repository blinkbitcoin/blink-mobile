import React from "react"
import { render } from "@testing-library/react-native"
import { Text } from "react-native"

import { HideAmountContainer } from "@app/graphql/hide-amount-component"
import { useHideAmount } from "@app/graphql/hide-amount-context"

jest.mock("@apollo/client", () => ({
  useApolloClient: () => ({ writeQuery: jest.fn() }),
}))

jest.mock("@app/graphql/generated", () => ({
  useHideBalanceQuery: jest.fn(),
}))

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
    it("calls saveHideBalance with toggled value when hideAmount is false", () => {
      mockUseHideBalanceQuery.mockReturnValue({ data: { hideBalance: false } })

      render(
        <HideAmountContainer>
          <ContextCapture />
        </HideAmountContainer>,
      )

      capturedContext?.switchMemoryHideAmount()

      expect(mockSaveHideBalance).toHaveBeenCalledWith(expect.anything(), true)
    })

    it("calls saveHideBalance with toggled value when hideAmount is true", () => {
      mockUseHideBalanceQuery.mockReturnValue({ data: { hideBalance: true } })

      render(
        <HideAmountContainer>
          <ContextCapture />
        </HideAmountContainer>,
      )

      capturedContext?.switchMemoryHideAmount()

      expect(mockSaveHideBalance).toHaveBeenCalledWith(expect.anything(), false)
    })

    it("calls saveHiddenBalanceToolTip with toggled value when hideAmount is false", () => {
      mockUseHideBalanceQuery.mockReturnValue({ data: { hideBalance: false } })

      render(
        <HideAmountContainer>
          <ContextCapture />
        </HideAmountContainer>,
      )

      capturedContext?.switchMemoryHideAmount()

      expect(mockSaveHiddenBalanceToolTip).toHaveBeenCalledWith(expect.anything(), true)
    })

    it("calls saveHiddenBalanceToolTip with toggled value when hideAmount is true", () => {
      mockUseHideBalanceQuery.mockReturnValue({ data: { hideBalance: true } })

      render(
        <HideAmountContainer>
          <ContextCapture />
        </HideAmountContainer>,
      )

      capturedContext?.switchMemoryHideAmount()

      expect(mockSaveHiddenBalanceToolTip).toHaveBeenCalledWith(expect.anything(), false)
    })
  })
})
