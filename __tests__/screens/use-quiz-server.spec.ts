import { renderHook } from "@testing-library/react-native"

import { useQuizServer } from "@app/screens/earns-map-screen/use-quiz-server"
import { earnSections } from "@app/screens/earns-screen/sections"

const mockUseMyQuizQuestionsQuery = jest.fn()
const mockUseIsAuthed = jest.fn()
const mockUseIsSelfCustodialAccount = jest.fn()
const mockUseQuizCompletions = jest.fn()

jest.mock("@app/graphql/generated", () => ({
  useMyQuizQuestionsQuery: (options: unknown) => mockUseMyQuizQuestionsQuery(options),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => mockUseIsAuthed(),
}))

jest.mock("@app/hooks/use-is-self-custodial-account", () => ({
  useIsSelfCustodialAccount: () => mockUseIsSelfCustodialAccount(),
}))

jest.mock("@app/hooks/use-quiz-completions", () => ({
  useQuizCompletions: () => mockUseQuizCompletions(),
}))

const allQuizIds = Object.values(earnSections).flatMap((section) => section.questions)

describe("useQuizServer", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseIsAuthed.mockReturnValue(true)
    mockUseIsSelfCustodialAccount.mockReturnValue(false)
    mockUseQuizCompletions.mockReturnValue({ completedQuizIds: [] })
    mockUseMyQuizQuestionsQuery.mockReturnValue({ data: undefined, loading: false })
  })

  describe("self-custodial", () => {
    beforeEach(() => {
      mockUseIsSelfCustodialAccount.mockReturnValue(true)
    })

    it("skips the backend query", () => {
      renderHook(() => useQuizServer())

      expect(mockUseMyQuizQuestionsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ skip: true }),
      )
    })

    it("exposes every locally bundled quiz so the full map is walkable", () => {
      const { result } = renderHook(() => useQuizServer())

      expect(result.current.quizServerData.map((quiz) => quiz.id)).toEqual(allQuizIds)
    })

    it("marks the device-recorded quizzes as completed and the rest as pending", () => {
      mockUseQuizCompletions.mockReturnValue({
        completedQuizIds: ["whatIsBitcoin", "sat"],
      })

      const { result } = renderHook(() => useQuizServer())

      const completed = result.current.quizServerData
        .filter((quiz) => quiz.completed)
        .map((quiz) => quiz.id)

      expect(completed).toEqual(["whatIsBitcoin", "sat"])
    })

    it("reports no rewards, since sats are paid by the custodial backend", () => {
      mockUseQuizCompletions.mockReturnValue({
        completedQuizIds: ["whatIsBitcoin", "sat"],
      })

      const { result } = renderHook(() => useQuizServer())

      expect(result.current.earnedSats).toBe(0)
      expect(result.current.quizServerData.every((quiz) => quiz.amount === 0)).toBe(true)
    })

    it("never withholds a section behind a notBefore date", () => {
      const { result } = renderHook(() => useQuizServer())

      expect(
        result.current.quizServerData.every((quiz) => quiz.notBefore === undefined),
      ).toBe(true)
    })

    it("ignores a stale custodial token on the device", () => {
      mockUseIsAuthed.mockReturnValue(true)
      mockUseMyQuizQuestionsQuery.mockReturnValue({
        data: {
          me: {
            defaultAccount: {
              quiz: [
                {
                  __typename: "Quiz",
                  id: "whatIsBitcoin",
                  amount: 1,
                  completed: true,
                  notBefore: null,
                },
              ],
            },
          },
        },
        loading: false,
      })

      const { result } = renderHook(() => useQuizServer())

      expect(result.current.earnedSats).toBe(0)
      expect(result.current.quizServerData).toHaveLength(allQuizIds.length)
    })
  })

  describe("custodial", () => {
    it("still reads quiz progress and rewards from the backend", () => {
      mockUseMyQuizQuestionsQuery.mockReturnValue({
        data: {
          me: {
            defaultAccount: {
              quiz: [
                {
                  __typename: "Quiz",
                  id: "whatIsBitcoin",
                  amount: 5,
                  completed: true,
                  notBefore: null,
                },
              ],
            },
          },
        },
        loading: false,
      })

      const { result } = renderHook(() => useQuizServer())

      expect(mockUseMyQuizQuestionsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ skip: false }),
      )
      expect(result.current.quizServerData).toHaveLength(1)
      expect(result.current.earnedSats).toBe(5)
    })

    it("keeps the signed-out preview list", () => {
      mockUseIsAuthed.mockReturnValue(false)

      const { result } = renderHook(() => useQuizServer())

      expect(result.current.quizServerData.map((quiz) => quiz.id)).toEqual([
        "whatIsBitcoin",
        "sat",
        "whereBitcoinExist",
        "whoControlsBitcoin",
        "copyBitcoin",
      ])
    })
  })
})
