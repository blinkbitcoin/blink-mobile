import { LocalizedString } from "typesafe-i18n"

import { Quiz } from "@app/graphql/generated"
import { TranslationFunctions } from "@app/i18n/i18n-types"

import { QuizQuestion, QuizQuestionContent, QuizSectionContent } from "./earns-section"
import {
  EarnSectionType,
  ValidateQuizCodeErrorsType,
  earnSections,
  validateQuizCodeErrors,
} from "./sections"

export const getCardsFromSection = ({
  section,
  quizQuestionsContent,
}: {
  section: EarnSectionType
  quizQuestionsContent: QuizSectionContent[]
}) => {
  const quizzes = quizQuestionsContent.find((content) => section === content.section.id)
  return quizzes?.content.map((card) => card) || []
}

export const augmentCardWithGqlData = ({
  card,
  quizServerData,
}: {
  card: QuizQuestionContent
  quizServerData: Quiz[]
}): QuizQuestion => {
  const myQuiz = quizServerData.find((quiz) => quiz.id === card.id)
  const notBefore = myQuiz?.notBefore ? new Date(myQuiz.notBefore * 1000) : undefined
  return {
    ...card,
    amount: myQuiz?.amount || 0,
    completed: myQuiz?.completed || false,
    notBefore,
  }
}

export const getQuizQuestionsContent = ({
  LL,
}: {
  LL: TranslationFunctions
}): QuizSectionContent[] => {
  const LLEarn = LL.EarnScreen.earnSections

  const quizSectionContent = (Object.keys(earnSections) as EarnSectionType[]).map(
    (sectionId) => ({
      section: {
        id: sectionId,
        title: LLEarn[sectionId].title(),
      },
      content: earnSections[sectionId].questions.map((question) => {
        // we would need more precise type to infer correctly the type here
        // because we are filtering with EarnSectionType, we are only looking through one section
        // at a time. but the questions are from all the types, so typescript
        // cant infer the type correctly
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const questions = (LLEarn[sectionId].questions as any)[question] as {
          answers: {
            "0": () => LocalizedString
            "1": () => LocalizedString
            "2": () => LocalizedString
          }
          feedback: {
            "0": () => LocalizedString
            "1": () => LocalizedString
            "2": () => LocalizedString
          }
          question: () => LocalizedString
          text: () => LocalizedString
          title: () => LocalizedString
          type: () => LocalizedString
        }

        return {
          id: question,
          title: questions.title(),
          text: questions.text(),
          question: questions.question(),
          answers: Object.values(questions.answers).map(
            // need to execute the function to get the value
            (answer) => (answer as () => LocalizedString)(),
          ),
          feedback: Object.values(questions.feedback).map(
            // need to execute the function to get the value
            (feedback) => (feedback as () => LocalizedString)(),
          ),
        }
      }),
    }),
  )
  return quizSectionContent
}

const shownErrorCodes = new Set<ValidateQuizCodeErrorsType>()

export const skipRewardErrorCodes = (code?: string | null): boolean =>
  Boolean(code) && validateQuizCodeErrors.includes(code as ValidateQuizCodeErrorsType)

export const errorCodeAlertAlreadyShown = (code?: string | null): boolean =>
  Boolean(code) &&
  skipRewardErrorCodes(code) &&
  shownErrorCodes.has(code as ValidateQuizCodeErrorsType)

export const markErrorCodeAlertAsShown = (code?: string | null): void => {
  if (!code) return
  shownErrorCodes.add(code as ValidateQuizCodeErrorsType)
}
