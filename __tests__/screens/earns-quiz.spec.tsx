import React from "react"
import type { ReactTestInstance } from "react-test-renderer"
import { act, fireEvent, render, waitFor } from "@testing-library/react-native"
import { MockedProvider, MockedResponse } from "@apollo/client/testing"
import { RouteProp } from "@react-navigation/native"

import { MyQuizQuestionsDocument, QuizClaimDocument } from "@app/graphql/generated"
import { createCache } from "@app/graphql/cache"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import { EarnQuiz } from "@app/screens/earns-screen/earns-quiz"
import { getQuizQuestionsContent } from "@app/screens/earns-screen/helpers"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { ContextForScreen } from "./helper"

jest.mock("react-native-modal", () => {
  const MockedModal = ({
    isVisible,
    children,
  }: {
    isVisible: boolean
    children: React.ReactNode
  }) => {
    if (!isVisible) return null
    return <>{children}</>
  }
  return MockedModal
})

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

const buildRoute = (
  params: RootStackParamList["earnsQuiz"],
): RouteProp<RootStackParamList, "earnsQuiz"> => ({
  key: "earnsQuiz",
  name: "earnsQuiz",
  params,
})

const buildMocks = ({
  id,
  skipRewards,
  errorCode,
}: {
  id: string
  skipRewards?: boolean
  errorCode: string
}): {
  mocks: MockedResponse[]
  quizClaimResult: jest.Mock
} => {
  const quizClaimResult = jest.fn(() => ({
    data: {
      quizClaim: {
        errors: [
          {
            message: "Reward wallet empty",
            code: errorCode,
          },
        ],
        quizzes: [],
      },
    },
  }))

  const quizClaimMock: MockedResponse = {
    request: {
      query: QuizClaimDocument,
      variables: {
        input: { id, skipRewards: skipRewards ?? false },
      },
    },
    result: quizClaimResult,
  }

  const myQuizQuestionsMock: MockedResponse = {
    request: { query: MyQuizQuestionsDocument },
    result: {
      data: {
        __typename: "Query",
        me: {
          __typename: "User",
          id: "user-id",
          defaultAccount: {
            __typename: "ConsumerAccount",
            id: "account-id",
            quiz: [
              {
                __typename: "Quiz",
                id,
                amount: 100,
                completed: false,
                notBefore: null,
              },
            ],
          },
        },
      },
    },
  }

  return {
    mocks: [myQuizQuestionsMock, quizClaimMock],
    quizClaimResult,
  }
}

const renderEarnQuiz = ({
  routeParams,
  mocks,
}: {
  routeParams: RootStackParamList["earnsQuiz"]
  mocks: MockedResponse[]
}) => {
  const route = buildRoute(routeParams)
  return render(
    <ContextForScreen>
      <MockedProvider mocks={mocks} cache={createCache()} addTypename={true}>
        <EarnQuiz route={route} />
      </MockedProvider>
    </ContextForScreen>,
  )
}

describe("EarnQuiz", () => {
  const quizId = "whatIsBitcoin"
  let LL: ReturnType<typeof i18nObject>

  beforeEach(() => {
    loadLocale("en")
    LL = i18nObject("en")
  })

  it("claims with skipRewards when unavailable and does not show no-rewards modal", async () => {
    const { mocks, quizClaimResult } = buildMocks({
      id: quizId,
      skipRewards: true,
      errorCode: "NOT_ENOUGH_BALANCE_FOR_QUIZ",
    })
    const routeParams: RootStackParamList["earnsQuiz"] = {
      id: quizId,
      isAvailable: false,
    }
    const { getByText, queryByText } = renderEarnQuiz({ routeParams, mocks })

    const answersContent = getQuizQuestionsContent({ LL })
    const answersFlat = answersContent.map((item) => item.content).flatMap((item) => item)
    const card = answersFlat.find((item) => item.id === quizId)
    if (!card) {
      throw new Error("Quiz card not found")
    }

    await act(async () => {
      fireEvent.press(getByText(LL.common.continue()))
    })

    const correctAnswerText = card.answers[0]
    const correctAnswerNode = getByText(correctAnswerText)
    await act(async () => {
      fireEvent.press(findPressableParent(correctAnswerNode))
    })

    await waitFor(() => {
      expect(quizClaimResult).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(queryByText(LL.EarnScreen.continueNoRewards())).toBeNull()
    })
    await waitFor(() => {
      expect(
        queryByText(LL.EarnScreen.customMessages.notEnoughBalanceForQuiz.title()),
      ).toBeNull()
    })
  })

  it("shows no-rewards modal when available and claim returns a skip-reward error", async () => {
    const { mocks, quizClaimResult } = buildMocks({
      id: quizId,
      errorCode: "NOT_ENOUGH_BALANCE_FOR_QUIZ",
    })
    const routeParams: RootStackParamList["earnsQuiz"] = {
      id: quizId,
      isAvailable: true,
    }
    const { getByText } = renderEarnQuiz({ routeParams, mocks })

    const answersContent = getQuizQuestionsContent({ LL })
    const answersFlat = answersContent.map((item) => item.content).flatMap((item) => item)
    const card = answersFlat.find((item) => item.id === quizId)
    if (!card) {
      throw new Error("Quiz card not found")
    }

    const earnButtonLabel = LL.EarnScreen.earnSats({
      formattedNumber: 100,
    })
    await waitFor(() => {
      expect(getByText(earnButtonLabel)).toBeTruthy()
    })
    await act(async () => {
      fireEvent.press(getByText(earnButtonLabel))
    })

    const correctAnswerText = card.answers[0]
    const correctAnswerNode = getByText(correctAnswerText)
    await act(async () => {
      fireEvent.press(findPressableParent(correctAnswerNode))
    })

    await waitFor(() => {
      expect(quizClaimResult).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(getByText(LL.EarnScreen.continueNoRewards())).toBeTruthy()
    })
  })
})
