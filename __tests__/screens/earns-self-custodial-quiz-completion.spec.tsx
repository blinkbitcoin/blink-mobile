import React from "react"
import { act, fireEvent, render, waitFor } from "@testing-library/react-native"
import { RouteProp } from "@react-navigation/native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { EarnQuiz } from "@app/screens/earns-screen/earns-quiz"
import { PersistentStateProvider } from "@app/store/persistent-state"

import { ContextForScreen, findPressableParent } from "./helper"

jest.mock("@react-navigation/native", () => {
  const actual = jest.requireActual("@react-navigation/native")
  return {
    ...actual,
    useNavigation: () => ({
      ...actual.useNavigation?.(),
      navigate: jest.fn(),
      setOptions: jest.fn(),
      goBack: jest.fn(),
    }),
  }
})

jest.mock("react-native-modal", () => {
  const MockedModal = ({
    isVisible,
    children,
  }: {
    isVisible: boolean
    children: React.ReactNode
  }) => (isVisible ? <>{children}</> : null)
  return MockedModal
})

const mockUseIsSelfCustodialAccount = jest.fn()
jest.mock("@app/hooks/use-is-self-custodial-account", () => ({
  useIsSelfCustodialAccount: () => mockUseIsSelfCustodialAccount(),
}))

const mockQuizClaim = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useQuizClaimMutation: () => [mockQuizClaim, { loading: false }],
}))

const buildQuizRoute = (
  params: RootStackParamList["earnsQuiz"],
): RouteProp<RootStackParamList, "earnsQuiz"> => ({
  key: "earnsQuiz",
  name: "earnsQuiz",
  params,
})

/**
 * Unlike the sibling learn spec, this one leaves useQuizServer, useQuizCompletions
 * and the persistent-state store unmocked, so the whole completion loop runs for
 * real: answering writes through the provider and the re-read flips the screen.
 */
describe("EarnQuiz completion through the real persistent-state provider", () => {
  const quizId = "whatIsBitcoin"
  let LL: ReturnType<typeof i18nObject>

  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
    LL = i18nObject("en")
    mockUseIsSelfCustodialAccount.mockReturnValue(true)
  })

  it("persists a correct answer and re-renders as completed without claiming", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <PersistentStateProvider>
          <EarnQuiz route={buildQuizRoute({ id: quizId, isAvailable: false })} />
        </PersistentStateProvider>
      </ContextForScreen>,
    )

    const continueButton = await waitFor(() => getByText(LL.common.continue()))

    await act(async () => {
      fireEvent.press(continueButton)
    })

    const correctAnswer =
      LL.EarnScreen.earnSections.bitcoinWhatIsIt.questions.whatIsBitcoin.answers[0]()

    await act(async () => {
      fireEvent.press(findPressableParent(getByText(correctAnswer)))
    })

    await waitFor(() => {
      expect(getByText(LL.EarnScreen.sectionsCompleted())).toBeTruthy()
    })
    expect(mockQuizClaim).not.toHaveBeenCalled()
  })
})
