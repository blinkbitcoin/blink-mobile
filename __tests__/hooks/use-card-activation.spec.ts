import { act, renderHook } from "@testing-library/react-native"
import { NavigationState } from "@react-navigation/native"

import { CardActivationStep, CardType } from "@app/graphql/generated"
import { useCardActivation } from "@app/hooks/use-card-activation"

const mockUseIsAuthed = jest.fn()
jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => mockUseIsAuthed(),
}))

type MutationOptions = {
  update: (cache: FakeCache, result: { data?: Record<string, unknown> | null }) => void
}

const mockUseCardActivationQuery = jest.fn()
const mockUpdateStep = jest.fn()
const mockComplete = jest.fn()
let mockIsCompleting = false
let mockStepUpdateOptions: MutationOptions | undefined
let mockCompleteOptions: MutationOptions | undefined
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useCardActivationQuery: (options: Record<string, unknown>) =>
    mockUseCardActivationQuery(options),
  useCardActivationStepUpdateMutation: (options: MutationOptions) => {
    mockStepUpdateOptions = options
    return [mockUpdateStep]
  },
  useCardActivationCompleteMutation: (options: MutationOptions) => {
    mockCompleteOptions = options
    return [mockComplete, { loading: mockIsCompleting }]
  },
}))

const mockNavigate = jest.fn()
const mockReplace = jest.fn()
const mockDispatch = jest.fn()
const mockNavigation = {
  navigate: mockNavigate,
  replace: mockReplace,
  dispatch: mockDispatch,
}
/** Runs the effect only while the screen is in front, as react-navigation does, so a
 *  screen left under another is told apart from the one the member sees. */
let mockIsFocused = true
jest.mock("@react-navigation/native", () => {
  const ReactActual = jest.requireActual("react")
  return {
    ...jest.requireActual("@react-navigation/native"),
    useNavigation: () => mockNavigation,
    useFocusEffect: (effect: () => void) => {
      const isFocused = mockIsFocused
      ReactActual.useEffect(() => {
        if (isFocused) effect()
      }, [effect, isFocused])
    },
  }
})

const mockToastShow = jest.fn()
jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: unknown[]) => mockToastShow(...args),
}))

const mockRecordAppError = jest.fn()
jest.mock("@app/utils/error-reporting", () => ({
  ...jest.requireActual("@app/utils/error-reporting"),
  recordAppError: (...args: unknown[]) => mockRecordAppError(...args),
}))

const mockLL = { errors: { unexpectedError: () => "Something went wrong" } }
jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({ LL: mockLL }),
}))

type FakeCache = {
  identify: jest.Mock
  modify: jest.Mock
}

type CardRow = {
  __typename: "Card"
  id: string
  cardType: CardType
  pinSetAt: string | null
  walletAddedAt: string | null
}

const virtualCard: CardRow = {
  __typename: "Card",
  id: "card-virtual",
  cardType: CardType.Virtual,
  pinSetAt: null,
  walletAddedAt: null,
}

/** A card the app told blink-card it added to Apple Pay or Google Pay. */
const virtualCardInWallet: CardRow = {
  ...virtualCard,
  walletAddedAt: "2026-11-01T00:00:00Z",
}

/** A member past the PIN step has set it on the card the app shows. */
const virtualCardWithPin: CardRow = { ...virtualCard, pinSetAt: "2026-11-01T00:00:00Z" }

const physicalCard: CardRow = {
  __typename: "Card",
  id: "card-physical",
  cardType: CardType.Physical,
  pinSetAt: null,
  walletAddedAt: null,
}

type ActivationData = {
  step?: CardActivationStep
  setupCompletedAt?: string | null
  cards?: CardRow[]
  hasActivation?: boolean
}

const dataWith = ({
  step = CardActivationStep.Activated,
  setupCompletedAt = null,
  cards = [virtualCard],
  hasActivation = true,
}: ActivationData = {}) => ({
  me: {
    __typename: "User" as const,
    id: "user-1",
    defaultAccount: {
      __typename: "ConsumerAccount" as const,
      id: "acct-1",
      cardActivation: hasActivation
        ? { __typename: "CardActivation" as const, step, setupCompletedAt }
        : null,
      cards,
    },
  },
})

const answerWith = (data: ReturnType<typeof dataWith> | undefined, loading = false) =>
  mockUseCardActivationQuery.mockReturnValue({ data, loading })

const stackState = (names: string[]): NavigationState =>
  ({
    key: "root",
    index: names.length - 1,
    routeNames: names,
    routes: names.map((name) => ({ name, key: `${name}-key` })),
    type: "stack",
    stale: false,
  }) as NavigationState

type ResetAction = {
  type: string
  payload: { index: number; routes: { name: string; params?: object }[] }
}

const resetOn = (names: string[], call = 0): ResetAction =>
  mockDispatch.mock.calls[call][0](stackState(names))

const routeNamesOf = (action: ResetAction) =>
  action.payload.routes.map(({ name }) => name)

const fakeCache = (): FakeCache => ({
  identify: jest.fn(() => "ConsumerAccount:acct-1"),
  modify: jest.fn(),
})

describe("useCardActivation", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseIsAuthed.mockReturnValue(true)
    mockIsFocused = true
    mockIsCompleting = false
    mockStepUpdateOptions = undefined
    mockCompleteOptions = undefined
    mockUpdateStep.mockResolvedValue({ data: {} })
    mockComplete.mockResolvedValue({ data: {} })
  })

  describe("reading the activation", () => {
    it("reads nothing without a session, or when asked to skip", () => {
      answerWith(undefined)
      mockUseIsAuthed.mockReturnValue(false)
      renderHook(() => useCardActivation())

      expect(mockUseCardActivationQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ skip: true }),
      )

      mockUseIsAuthed.mockReturnValue(true)
      renderHook(() => useCardActivation({ skip: true }))

      expect(mockUseCardActivationQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ skip: true }),
      )
    })

    it("asks the network on every mount", () => {
      answerWith(undefined)
      renderHook(() => useCardActivation())

      expect(mockUseCardActivationQuery).toHaveBeenCalledWith({
        skip: false,
        fetchPolicy: "network-only",
        nextFetchPolicy: "cache-first",
      })
    })

    it("waits while the first read is out", () => {
      answerWith(undefined, true)
      const { result } = renderHook(() => useCardActivation())

      expect(result.current.isWaiting).toBe(true)
      expect(result.current.isPending).toBe(false)
    })

    it("leaves the activation unknown when the member has none", () => {
      answerWith(dataWith({ hasActivation: false }))
      const { result } = renderHook(() => useCardActivation())

      expect(result.current.isWaiting).toBe(false)
      expect(result.current.isPending).toBe(false)
      expect(result.current.isComplete).toBe(false)
      expect(result.current.place).toBeUndefined()
    })

    it("places a member mid-activation past the steps they took", () => {
      answerWith(dataWith({ cards: [physicalCard, virtualCard] }))
      const { result } = renderHook(() => useCardActivation())

      expect(result.current.isPending).toBe(true)
      expect(result.current.place).toBe(CardActivationStep.Pin)
    })

    it("reads the PIN from the newest card, the one the app shows", () => {
      answerWith(dataWith({ step: CardActivationStep.Pin, cards: [virtualCardWithPin] }))
      const withPin = renderHook(() => useCardActivation())

      expect(withPin.result.current.place).toBe(CardActivationStep.OfferOtherWay)

      answerWith(
        dataWith({
          step: CardActivationStep.Pin,
          cards: [physicalCard, virtualCardWithPin],
        }),
      )
      const orderedSince = renderHook(() => useCardActivation())

      expect(orderedSince.result.current.place).toBe(CardActivationStep.Pin)
    })

    it("counts a card in the wallet as the first way taken", () => {
      answerWith(dataWith({ cards: [virtualCardInWallet] }))
      const { result } = renderHook(() => useCardActivation())

      expect(result.current.place).toBe(CardActivationStep.Pin)
    })

    it("is complete once the setup has a date", () => {
      answerWith(dataWith({ setupCompletedAt: "2026-11-20T00:00:00Z" }))
      const { result } = renderHook(() => useCardActivation())

      expect(result.current.isComplete).toBe(true)
      expect(result.current.isPending).toBe(false)
      expect(result.current.place).toBe("DONE")
    })
  })

  describe("resume", () => {
    it("opens the screen of the member's place", () => {
      answerWith(
        dataWith({ step: CardActivationStep.TopUp, cards: [virtualCardWithPin] }),
      )
      const { result } = renderHook(() => useCardActivation())

      act(() => result.current.resume())

      expect(mockNavigate).toHaveBeenCalledWith("cardActivationTopUpScreen")
    })

    it("opens the wallet offer for a member who ordered the physical card first", () => {
      answerWith(
        dataWith({
          step: CardActivationStep.OfferOtherWay,
          cards: [{ ...physicalCard, pinSetAt: "2026-11-02T00:00:00Z" }, virtualCard],
        }),
      )
      const { result } = renderHook(() => useCardActivation())

      act(() => result.current.resume())

      expect(mockNavigate).toHaveBeenCalledWith("cardActivationWalletOfferScreen")
    })

    it("opens the dashboard with the activation unknown", () => {
      answerWith(undefined)
      const { result } = renderHook(() => useCardActivation())

      act(() => result.current.resume())

      expect(mockNavigate).toHaveBeenCalledWith("cardDashboardScreen")
    })
  })

  describe("redirect", () => {
    it("replaces only the asking screen with the member's place", () => {
      answerWith(
        dataWith({ step: CardActivationStep.OfferOtherWay, cards: [virtualCardWithPin] }),
      )
      const { result } = renderHook(() => useCardActivation())

      act(() => result.current.redirect())

      expect(mockReplace).toHaveBeenCalledWith("cardActivationOrderOfferScreen")
      expect(mockDispatch).not.toHaveBeenCalled()
    })

    it("sends the member once, however often it is asked", () => {
      answerWith(dataWith())
      const { result } = renderHook(() => useCardActivation())

      act(() => {
        result.current.redirect()
        result.current.redirect()
      })

      expect(mockReplace).toHaveBeenCalledTimes(1)
    })

    it("falls back to the dashboard with the activation unknown", () => {
      answerWith(undefined)
      const { result } = renderHook(() => useCardActivation())

      act(() => result.current.redirect())

      expect(mockReplace).toHaveBeenCalledWith("cardDashboardScreen")
      expect(mockDispatch).not.toHaveBeenCalled()
    })
  })

  describe("moveOn", () => {
    it("keeps a skipped step under the next one", () => {
      answerWith(dataWith())
      const { result } = renderHook(() => useCardActivation())

      act(() => result.current.moveOn(CardActivationStep.Activated))

      const action = resetOn(["Primary", "cardOnboardingApprovedScreen"])
      expect(routeNamesOf(action)).toEqual([
        "Primary",
        "cardOnboardingApprovedScreen",
        "cardCreatePinScreen",
      ])
    })

    it("counts what the member just did before the cards are read again", () => {
      answerWith(dataWith({ step: CardActivationStep.Pin }))
      const { result } = renderHook(() => useCardActivation())

      act(() => result.current.moveOn(CardActivationStep.Pin, { isPinSet: true }))

      const action = resetOn([
        "Primary",
        "cardOnboardingApprovedScreen",
        "cardCreatePinScreen",
      ])
      expect(routeNamesOf(action)).toEqual([
        "Primary",
        "cardOnboardingApprovedScreen",
        "cardActivationOrderOfferScreen",
      ])
    })

    it("goes on to the PIN once the wallet took the card", () => {
      answerWith(dataWith())
      const { result } = renderHook(() => useCardActivation())

      act(() =>
        result.current.moveOn(CardActivationStep.Activated, { isWalletAdded: true }),
      )

      const action = resetOn(["Primary", "cardOnboardingApprovedScreen"])
      expect(routeNamesOf(action)).toEqual(["Primary", "cardCreatePinScreen"])
    })

    it("falls back to the dashboard with the activation unknown", () => {
      answerWith(undefined)
      const { result } = renderHook(() => useCardActivation())

      act(() => result.current.moveOn(CardActivationStep.Activated))

      expect(mockReplace).toHaveBeenCalledWith("cardDashboardScreen")
    })
  })

  describe("showOrderPlaced", () => {
    const orderPlaced = {
      title: "Your physical card is on the way!",
      subtitle: "Order submitted",
      buttonLabel: "Create PIN",
      navigateTo: "cardCreatePinScreen" as const,
      iconName: "delivery" as const,
      lastFour: "2121",
      cardId: "card-physical",
    }

    it("shows the confirmation with the steps the order settled gone", () => {
      answerWith(dataWith())
      const { result } = renderHook(() => useCardActivation())

      act(() => result.current.showOrderPlaced(orderPlaced))

      const action = resetOn([
        "Primary",
        "cardOnboardingApprovedScreen",
        "orderCardScreen",
      ])
      expect(routeNamesOf(action)).toEqual(["Primary", "cardStatusScreen"])
      expect(action.payload.routes[1].params).toBe(orderPlaced)
    })

    it("replaces the order with the confirmation with the activation unknown", () => {
      answerWith(undefined)
      const { result } = renderHook(() => useCardActivation())

      act(() => result.current.showOrderPlaced(orderPlaced))

      expect(mockReplace).toHaveBeenCalledWith("cardStatusScreen", orderPlaced)
    })
  })

  describe("complete", () => {
    it("completes the activation and opens the dashboard alone", async () => {
      answerWith(
        dataWith({ step: CardActivationStep.TopUp, cards: [virtualCardWithPin] }),
      )
      const { result } = renderHook(() => useCardActivation())

      await act(async () => {
        await result.current.complete()
      })

      expect(mockComplete).toHaveBeenCalledTimes(1)
      const action = resetOn([
        "Primary",
        "cardActivationOrderOfferScreen",
        "cardActivationTopUpScreen",
      ])
      expect(routeNamesOf(action)).toEqual(["Primary", "cardDashboardScreen"])
    })

    it("stays on the step and says why when the completion fails", async () => {
      answerWith(
        dataWith({ step: CardActivationStep.TopUp, cards: [virtualCardWithPin] }),
      )
      mockComplete.mockRejectedValue(new Error("Card service unavailable"))
      const { result } = renderHook(() => useCardActivation())

      await act(async () => {
        await result.current.complete()
      })

      expect(mockToastShow).toHaveBeenCalledWith({
        message: "Card service unavailable",
        LL: mockLL,
      })
      expect(mockDispatch).not.toHaveBeenCalled()
    })

    it("falls back to a generic message for a failure without one", async () => {
      answerWith(
        dataWith({ step: CardActivationStep.TopUp, cards: [virtualCardWithPin] }),
      )
      mockComplete.mockRejectedValue("offline")
      const { result } = renderHook(() => useCardActivation())

      await act(async () => {
        await result.current.complete()
      })

      expect(mockToastShow).toHaveBeenCalledWith({
        message: "Something went wrong",
        LL: mockLL,
      })
    })

    it("opens the dashboard with the activation unknown", async () => {
      answerWith(undefined)
      const { result } = renderHook(() => useCardActivation())

      await act(async () => {
        await result.current.complete()
      })

      expect(mockReplace).toHaveBeenCalledWith("cardDashboardScreen")
    })

    it("completes once while a completion is out", async () => {
      answerWith(
        dataWith({ step: CardActivationStep.TopUp, cards: [virtualCardWithPin] }),
      )
      let answer: (value: { data: object }) => void = () => undefined
      mockComplete.mockReturnValue(
        new Promise((resolve) => {
          answer = resolve
        }),
      )
      const { result } = renderHook(() => useCardActivation())

      await act(async () => {
        const first = result.current.complete()
        const second = result.current.complete()
        answer({ data: {} })
        await Promise.all([first, second])
      })

      expect(mockComplete).toHaveBeenCalledTimes(1)
      expect(mockDispatch).toHaveBeenCalledTimes(1)
    })

    it("tells while the completion is out", () => {
      mockIsCompleting = true
      answerWith(
        dataWith({ step: CardActivationStep.TopUp, cards: [virtualCardWithPin] }),
      )
      const { result } = renderHook(() => useCardActivation())

      expect(result.current.isCompleting).toBe(true)
    })
  })

  describe("the activation in the cache", () => {
    const activation = {
      __typename: "CardActivation" as const,
      step: CardActivationStep.Pin,
      setupCompletedAt: null,
    }

    it("writes the answer of a step update onto the member's account", () => {
      answerWith(dataWith())
      renderHook(() => useCardActivation())
      const cache = fakeCache()

      mockStepUpdateOptions?.update(cache, {
        data: { cardActivationStepUpdate: activation },
      })

      expect(cache.identify).toHaveBeenCalledWith({
        __typename: "ConsumerAccount",
        id: "acct-1",
      })
      expect(cache.modify).toHaveBeenCalledWith({
        id: "ConsumerAccount:acct-1",
        fields: { cardActivation: expect.any(Function) },
      })
      const { fields } = cache.modify.mock.calls[0][0]
      expect(fields.cardActivation()).toBe(activation)
    })

    it("writes the answer of the completion onto the member's account", () => {
      answerWith(dataWith())
      renderHook(() => useCardActivation())
      const cache = fakeCache()
      const completed = { ...activation, setupCompletedAt: "2026-11-24T00:00:00Z" }

      mockCompleteOptions?.update(cache, { data: { cardActivationComplete: completed } })

      const { fields } = cache.modify.mock.calls[0][0]
      expect(fields.cardActivation()).toBe(completed)
    })

    it("writes nothing without an answer or an account", () => {
      answerWith(undefined)
      renderHook(() => useCardActivation())
      const cache = fakeCache()

      mockStepUpdateOptions?.update(cache, { data: null })
      mockCompleteOptions?.update(cache, { data: null })
      mockStepUpdateOptions?.update(cache, {
        data: { cardActivationStepUpdate: activation },
      })

      expect(cache.modify).not.toHaveBeenCalled()
    })
  })

  describe("a step screen in front", () => {
    it("brings the member's step to the screen they are on", () => {
      answerWith(
        dataWith({ step: CardActivationStep.TopUp, cards: [virtualCardWithPin] }),
      )
      renderHook(() => useCardActivation({ step: CardActivationStep.OfferOtherWay }))

      expect(mockUpdateStep).toHaveBeenCalledWith({
        variables: { input: { step: CardActivationStep.OfferOtherWay } },
      })
    })

    it("leaves the step alone when it already is the screen's", () => {
      answerWith(
        dataWith({ step: CardActivationStep.TopUp, cards: [virtualCardWithPin] }),
      )
      renderHook(() => useCardActivation({ step: CardActivationStep.TopUp }))

      expect(mockUpdateStep).not.toHaveBeenCalled()
      expect(mockDispatch).not.toHaveBeenCalled()
    })

    it("sends the member on from a step already behind them", () => {
      answerWith(dataWith({ cards: [physicalCard, virtualCard] }))
      renderHook(() => useCardActivation({ step: CardActivationStep.Activated }))

      expect(mockUpdateStep).not.toHaveBeenCalled()
      expect(mockReplace).toHaveBeenCalledWith("cardCreatePinScreen")
    })

    it("does nothing while the screen is not in front", () => {
      mockIsFocused = false
      answerWith(
        dataWith({ step: CardActivationStep.TopUp, cards: [virtualCardWithPin] }),
      )
      renderHook(() => useCardActivation({ step: CardActivationStep.OfferOtherWay }))

      answerWith(dataWith({ cards: [physicalCard, virtualCard] }))
      renderHook(() => useCardActivation({ step: CardActivationStep.Activated }))

      expect(mockUpdateStep).not.toHaveBeenCalled()
      expect(mockReplace).not.toHaveBeenCalled()
    })

    it("does nothing out of the flow", () => {
      answerWith(dataWith({ setupCompletedAt: "2026-11-20T00:00:00Z" }))
      renderHook(() => useCardActivation({ step: CardActivationStep.Pin }))

      expect(mockUpdateStep).not.toHaveBeenCalled()
      expect(mockDispatch).not.toHaveBeenCalled()
    })

    it("does nothing for a screen that is no step", () => {
      answerWith(
        dataWith({ step: CardActivationStep.TopUp, cards: [virtualCardWithPin] }),
      )
      renderHook(() => useCardActivation())

      expect(mockUpdateStep).not.toHaveBeenCalled()
      expect(mockDispatch).not.toHaveBeenCalled()
    })

    it("reports a step it could not record, and tries again on the next focus", async () => {
      const failure = new Error("Card service unavailable")
      mockUpdateStep.mockRejectedValue(failure)
      answerWith(
        dataWith({ step: CardActivationStep.TopUp, cards: [virtualCardWithPin] }),
      )

      const { rerender } = renderHook(() =>
        useCardActivation({ step: CardActivationStep.OfferOtherWay }),
      )
      await act(async () => {})

      expect(mockRecordAppError).toHaveBeenCalledWith(failure)

      mockIsFocused = false
      rerender({})
      mockIsFocused = true
      rerender({})
      await act(async () => {})

      expect(mockUpdateStep).toHaveBeenCalledTimes(2)
    })

    it("records the step once while the write is out", async () => {
      let answer: (value: { data: object }) => void = () => undefined
      mockUpdateStep.mockReturnValue(
        new Promise((resolve) => {
          answer = resolve
        }),
      )
      answerWith(
        dataWith({ step: CardActivationStep.TopUp, cards: [virtualCardWithPin] }),
      )
      const { rerender } = renderHook(() =>
        useCardActivation({ step: CardActivationStep.OfferOtherWay }),
      )

      mockIsFocused = false
      rerender({})
      mockIsFocused = true
      rerender({})
      await act(async () => {
        answer({ data: {} })
      })

      expect(mockUpdateStep).toHaveBeenCalledTimes(1)
    })
  })
})
