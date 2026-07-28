import React from "react"
import type { ReactTestInstance } from "react-test-renderer"
import { Alert } from "react-native"
import { act, fireEvent, render, waitFor } from "@testing-library/react-native"
import { RouteProp } from "@react-navigation/native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { EarnMapScreen } from "@app/screens/earns-map-screen"
import { useQuizServer } from "@app/screens/earns-map-screen/use-quiz-server"
import { EarnQuiz } from "@app/screens/earns-screen/earns-quiz"
import { EarnSection } from "@app/screens/earns-screen/earns-section"
import { earnSections } from "@app/screens/earns-screen/sections"

import { ContextForScreen } from "./helper"

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => {
  const actual = jest.requireActual("@react-navigation/native")
  return {
    ...actual,
    useNavigation: () => ({
      ...actual.useNavigation?.(),
      navigate: mockNavigate,
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

jest.mock("react-native-reanimated-carousel", () => {
  const ReactNs = jest.requireActual<typeof import("react")>("react")
  const RNs = jest.requireActual<typeof import("react-native")>("react-native")
  const MockedCarousel = <T,>({
    data,
    renderItem,
  }: {
    data: T[]
    renderItem: (info: { item: T; index: number }) => React.ReactNode
  }) =>
    ReactNs.createElement(
      RNs.View,
      null,
      data.map((item, index) =>
        ReactNs.createElement(
          RNs.View,
          { key: index },
          renderItem({ item, index }) as React.ReactNode,
        ),
      ),
    )
  return MockedCarousel
})

jest.mock("@app/screens/earns-map-screen/use-quiz-server", () => ({
  useQuizServer: jest.fn(),
}))

const mockUseIsAuthed = jest.fn()
jest.mock("@app/graphql/is-authed-context", () => ({
  ...jest.requireActual("@app/graphql/is-authed-context"),
  useIsAuthed: () => mockUseIsAuthed(),
}))

const mockUseIsSelfCustodialAccount = jest.fn()
jest.mock("@app/hooks/use-is-self-custodial-account", () => ({
  useIsSelfCustodialAccount: () => mockUseIsSelfCustodialAccount(),
}))

const mockMarkQuizCompleted = jest.fn()
jest.mock("@app/hooks/use-quiz-completions", () => ({
  useQuizCompletions: () => ({
    completedQuizIds: [],
    markQuizCompleted: mockMarkQuizCompleted,
  }),
}))

const mockQuizClaim = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useQuizClaimMutation: () => [mockQuizClaim, { loading: false }],
}))

const mockUseLevel = jest.fn()
jest.mock("@app/graphql/level-context", () => ({
  ...jest.requireActual("@app/graphql/level-context"),
  useLevel: () => mockUseLevel(),
}))

const allQuizIds = Object.values(earnSections).flatMap((section) => section.questions)

const localQuizzes = (completedIds: string[] = []) =>
  allQuizIds.map((id) => ({
    __typename: "Quiz" as const,
    id,
    amount: 0,
    completed: completedIds.includes(id),
    notBefore: undefined,
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

const buildQuizRoute = (
  params: RootStackParamList["earnsQuiz"],
): RouteProp<RootStackParamList, "earnsQuiz"> => ({
  key: "earnsQuiz",
  name: "earnsQuiz",
  params,
})

const buildSectionRoute = (
  params: RootStackParamList["earnsSection"],
): RouteProp<RootStackParamList, "earnsSection"> => ({
  key: "earnsSection",
  name: "earnsSection",
  params,
})

describe("learn screens on a self-custodial account", () => {
  const mockedUseQuizServer = useQuizServer as jest.MockedFunction<typeof useQuizServer>
  let LL: ReturnType<typeof i18nObject>

  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
    LL = i18nObject("en")
    mockUseIsAuthed.mockReturnValue(false)
    mockUseIsSelfCustodialAccount.mockReturnValue(true)
    // Self-custodial accounts never reach level one, which is the custodial
    // phone-verification level that unlocks rewards.
    mockUseLevel.mockReturnValue({ isAtLeastLevelOne: false })
    mockedUseQuizServer.mockReturnValue({
      loading: false,
      earnedSats: 0,
      quizServerData: localQuizzes(),
    })
  })

  describe("EarnMapScreen", () => {
    it("renders the map instead of the custodial-account gate", () => {
      const { queryByTestId, getByText } = render(
        <ContextForScreen>
          <EarnMapScreen />
        </ContextForScreen>,
      )

      expect(queryByTestId("backend-feature-gate")).toBeNull()
      expect(getByText(LL.EarnScreen.earnSections.bitcoinWhatIsIt.title())).toBeTruthy()
    })

    it("still gates a signed-out custodial account", () => {
      mockUseIsSelfCustodialAccount.mockReturnValue(false)

      const { queryByTestId, queryByText } = render(
        <ContextForScreen>
          <EarnMapScreen />
        </ContextForScreen>,
      )

      expect(queryByTestId("backend-feature-gate")).toBeTruthy()
      expect(queryByText(LL.EarnScreen.earnSections.bitcoinWhatIsIt.title())).toBeNull()
    })

    it("hides the sats counter and promises lessons rather than rewards", () => {
      const { queryByText, getByText } = render(
        <ContextForScreen>
          <EarnMapScreen />
        </ContextForScreen>,
      )

      expect(queryByText(LL.EarnScreen.youEarned())).toBeNull()
      expect(getByText(LL.EarnScreen.motivatingBadgerNoRewards())).toBeTruthy()
    })

    it("opens a section in no-rewards mode", () => {
      const { getByText } = render(
        <ContextForScreen>
          <EarnMapScreen />
        </ContextForScreen>,
      )

      fireEvent.press(
        findPressableParent(
          getByText(LL.EarnScreen.earnSections.bitcoinWhatIsIt.title()),
        ),
      )

      expect(mockNavigate).toHaveBeenCalledWith("earnsSection", {
        section: "bitcoinWhatIsIt",
        isAvailable: false,
      })
    })
  })

  describe("EarnSection", () => {
    it("opens a lesson without asking for a phone number", () => {
      const { getAllByText } = render(
        <ContextForScreen>
          <EarnSection
            route={buildSectionRoute({
              section: "bitcoinWhatIsIt",
              isAvailable: false,
            })}
          />
        </ContextForScreen>,
      )

      const alertSpy = jest.spyOn(Alert, "alert")
      fireEvent.press(getAllByText(LL.common.continue())[0])

      expect(alertSpy).not.toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith("earnsQuiz", {
        id: "whatIsBitcoin",
        isAvailable: false,
      })
      alertSpy.mockRestore()
    })
  })

  describe("EarnQuiz", () => {
    const quizId = "whatIsBitcoin"

    const answerCorrectly = async (getByText: (text: string) => ReactTestInstance) => {
      await act(async () => {
        fireEvent.press(getByText(LL.common.continue()))
      })

      const correctAnswer =
        LL.EarnScreen.earnSections.bitcoinWhatIsIt.questions.whatIsBitcoin.answers[0]()

      await act(async () => {
        fireEvent.press(findPressableParent(getByText(correctAnswer)))
      })
    }

    it("records the completed quiz on the device instead of claiming a reward", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <EarnQuiz route={buildQuizRoute({ id: quizId, isAvailable: false })} />
        </ContextForScreen>,
      )

      await answerCorrectly(getByText)

      await waitFor(() => {
        expect(mockMarkQuizCompleted).toHaveBeenCalledWith(quizId)
      })
      expect(mockQuizClaim).not.toHaveBeenCalled()
    })

    it("shows the completed state once the device has recorded the quiz", async () => {
      mockedUseQuizServer.mockReturnValue({
        loading: false,
        earnedSats: 0,
        quizServerData: localQuizzes([quizId]),
      })

      const { getByText, queryByText } = render(
        <ContextForScreen>
          <EarnQuiz route={buildQuizRoute({ id: quizId, isAvailable: false })} />
        </ContextForScreen>,
      )

      expect(getByText(LL.EarnScreen.sectionsCompleted())).toBeTruthy()
      expect(queryByText(LL.EarnScreen.earnSats({ formattedNumber: 0 }))).toBeNull()
    })
  })
})
