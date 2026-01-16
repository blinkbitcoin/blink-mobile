import React from "react"
import type { ReactTestInstance } from "react-test-renderer"
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import { EarnMapScreen } from "@app/screens/earns-map-screen"
import { useQuizServer } from "@app/screens/earns-map-screen/use-quiz-server"

import { ContextForScreen } from "./helper"

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => {
  const actual = jest.requireActual("@react-navigation/native")
  return {
    ...actual,
    useNavigation: () => ({
      ...actual.useNavigation?.(),
      navigate: mockNavigate,
    }),
  }
})
jest.mock("@app/screens/earns-map-screen/use-quiz-server", () => ({
  useQuizServer: jest.fn(),
}))
const findPressableParent = (node: ReactTestInstance | null): ReactTestInstance => {
  let current: ReactTestInstance | null = node
  while (current && !current.props?.onPress) {
    current = current.parent
  }
  if (!current) {
    throw new Error("Pressable parent not found")
  }
  return current
}
describe("EarnMapScreen", () => {
  const mockedUseQuizServer = useQuizServer as jest.MockedFunction<typeof useQuizServer>
  let LL: ReturnType<typeof i18nObject>
  beforeEach(() => {
    loadLocale("en")
    LL = i18nObject("en")
    mockNavigate.mockClear()
  })
  it("closes the one-section-per-day modal when continuing without rewards", async () => {
    const futureSeconds = Math.floor(Date.now() / 1000) + 3600
    mockedUseQuizServer.mockReturnValue({
      loading: false,
      earnedSats: 5,
      quizServerData: [
        {
          __typename: "Quiz",
          id: "whatIsBitcoin",
          amount: 1,
          completed: true,
          notBefore: undefined,
        },
        {
          __typename: "Quiz",
          id: "sat",
          amount: 1,
          completed: true,
          notBefore: undefined,
        },
        {
          __typename: "Quiz",
          id: "whereBitcoinExist",
          amount: 1,
          completed: true,
          notBefore: undefined,
        },
        {
          __typename: "Quiz",
          id: "whoControlsBitcoin",
          amount: 1,
          completed: true,
          notBefore: undefined,
        },
        {
          __typename: "Quiz",
          id: "copyBitcoin",
          amount: 1,
          completed: true,
          notBefore: undefined,
        },
        {
          __typename: "Quiz",
          id: "moneySocialAgreement",
          amount: 1,
          completed: false,
          notBefore: undefined,
        },
        {
          __typename: "Quiz",
          id: "coincidenceOfWants",
          amount: 1,
          completed: false,
          notBefore: undefined,
        },
        {
          __typename: "Quiz",
          id: "moneyEvolution",
          amount: 1,
          completed: false,
          notBefore: undefined,
        },
        {
          __typename: "Quiz",
          id: "whyStonesShellGold",
          amount: 1,
          completed: false,
          notBefore: undefined,
        },
        {
          __typename: "Quiz",
          id: "moneyIsImportant",
          amount: 1,
          completed: false,
          notBefore: undefined,
        },
        {
          __typename: "Quiz",
          id: "moneyImportantGovernement",
          amount: 1,
          completed: false,
          notBefore: futureSeconds,
        },
      ],
    })
    render(
      <ContextForScreen>
        <EarnMapScreen />
      </ContextForScreen>,
    )
    const sectionTitle = LL.EarnScreen.earnSections.WhatIsMoney.title()
    const oneSectionTitle = LL.EarnScreen.customMessages.oneSectionADay.title()
    await waitFor(() => {
      expect(screen.getByText(sectionTitle)).toBeTruthy()
    })
    const sectionTitleNode = screen.getByText(sectionTitle)
    fireEvent.press(findPressableParent(sectionTitleNode))
    await waitFor(() => {
      expect(screen.getByText(oneSectionTitle)).toBeTruthy()
    })
    fireEvent.press(screen.getByText(LL.EarnScreen.continueNoRewards()))
    await waitFor(() => {
      expect(screen.queryByText(oneSectionTitle)).toBeNull()
    })
  })
})
