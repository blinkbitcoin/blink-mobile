import { useMemo } from "react"

import { gql, WatchQueryFetchPolicy } from "@apollo/client"
import { Quiz, useMyQuizQuestionsQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useIsSelfCustodialAccount } from "@app/hooks/use-is-self-custodial-account"
import { useQuizCompletions } from "@app/hooks/use-quiz-completions"
import { earnSections } from "@app/screens/earns-screen/sections"

gql`
  query myQuizQuestions {
    me {
      id
      defaultAccount {
        id
        ... on ConsumerAccount {
          quiz {
            id
            amount
            completed
            notBefore
          }
        }
      }
    }
  }
`

const allQuizIds = Object.values(earnSections).flatMap((section) => section.questions)

/**
 * Quiz progress for the learn/earn screens. Custodial accounts get it from the
 * backend, which also holds the sats rewards. Self-custodial accounts have no
 * backend quiz record, so progress comes from the device and every quiz is worth
 * zero — the content itself ships with the app.
 */
export const useQuizServer = (
  { fetchPolicy }: { fetchPolicy: WatchQueryFetchPolicy } = {
    fetchPolicy: "cache-first",
  },
) => {
  const isAuthed = useIsAuthed()
  const isSelfCustodial = useIsSelfCustodialAccount()
  const { completedQuizIds } = useQuizCompletions()

  const { data, loading } = useMyQuizQuestionsQuery({
    fetchPolicy,
    skip: !isAuthed || isSelfCustodial,
  })

  const selfCustodialQuizData = useMemo<Quiz[]>(() => {
    const completedIds = new Set(completedQuizIds)
    return allQuizIds.map((id) => ({
      __typename: "Quiz",
      id,
      amount: 0,
      completed: completedIds.has(id),
      notBefore: undefined,
    }))
  }, [completedQuizIds])

  let quizServerData: Quiz[]

  if (isSelfCustodial) {
    quizServerData = selfCustodialQuizData
  } else if (isAuthed) {
    quizServerData = data?.me?.defaultAccount.quiz.slice() ?? []
  } else {
    quizServerData = [
      {
        __typename: "Quiz",
        id: "whatIsBitcoin",
        amount: 1,
        completed: false,
        notBefore: undefined,
      },
      {
        __typename: "Quiz",
        id: "sat",
        amount: 1,
        completed: false,
        notBefore: undefined,
      },
      {
        __typename: "Quiz",
        id: "whereBitcoinExist",
        amount: 1,
        completed: false,
        notBefore: undefined,
      },
      {
        __typename: "Quiz",
        id: "whoControlsBitcoin",
        amount: 1,
        completed: false,
        notBefore: undefined,
      },
      {
        __typename: "Quiz",
        id: "copyBitcoin",
        amount: 1,
        completed: false,
        notBefore: undefined,
      },
    ]
  }

  const earnedSats = quizServerData
    .filter((quiz) => quiz.completed)
    .reduce((acc, { amount }) => acc + amount, 0)

  return { loading, quizServerData, earnedSats }
}
