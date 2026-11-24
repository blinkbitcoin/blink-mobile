import { renderHook, act } from "@testing-library/react-native"

import {
  BulletinsDocument,
  BulletinsQuery,
  UnacknowledgedBulletinKeysDocument,
} from "@app/graphql/generated"
import { CardInvestmentProgress } from "@app/types/card-investment"

const mockQuery = jest.fn()
const mockRefetchQueries = jest.fn(() => Promise.resolve([]))
const mockClient = { query: mockQuery, refetchQueries: mockRefetchQueries }

jest.mock("@apollo/client", () => ({
  ...jest.requireActual("@apollo/client"),
  useApolloClient: () => mockClient,
}))

const mockAcknowledge = jest.fn(() => Promise.resolve({}))
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useStatefulNotificationAcknowledgeMutation: () => [mockAcknowledge, { loading: false }],
}))

/** The record the home and the signing step share; its own spec covers the writes. */
const mockProgress: { current: CardInvestmentProgress | null } = { current: null }
const mockRecordInvitationBulletin = jest.fn()
const mockClear = jest.fn()
jest.mock("@app/hooks/use-card-investment-progress", () => ({
  useCardInvestmentProgress: () => ({
    progress: mockProgress.current,
    recordInvitationBulletin: mockRecordInvitationBulletin,
    clear: mockClear,
  }),
}))

const mockLogError = jest.fn()
jest.mock("@app/utils/log-error", () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
}))

import {
  INVESTMENT_INVITATION_BULLETIN_KEY,
  findInvestmentInvitationBulletin,
  isAnsweredInvitation,
  useAcknowledgeInvestmentInvitation,
  useAcknowledgeInvitationOnceSigned,
} from "@app/screens/card-screen/onboarding/investment-flow/investment-invitation-bulletin"

type Edge = { node: { id: string; bulletinKey: string | null; createdAt: number } }

const SIGNED_AT = 1_757_700_000_000
/** Server stamps, in seconds: one from before the signature, one from after. */
const INVITED_AT = SIGNED_AT / 1000 - 3600
const REINVITED_AT = SIGNED_AT / 1000 + 3600

/** One page of unacknowledged bulletins, as the server answers it. */
const page = (edges: Edge[], endCursor: string | null = null) => ({
  data: {
    me: {
      id: "user-1",
      unacknowledgedStatefulNotificationsWithBulletinEnabled: {
        pageInfo: { endCursor, hasNextPage: endCursor !== null },
        edges,
      },
    },
  },
})

const INVITATION: Edge = {
  node: {
    id: "notif-invite",
    bulletinKey: INVESTMENT_INVITATION_BULLETIN_KEY,
    createdAt: INVITED_AT,
  },
}
const REINVITATION: Edge = {
  node: {
    id: "notif-reinvite",
    bulletinKey: INVESTMENT_INVITATION_BULLETIN_KEY,
    createdAt: REINVITED_AT,
  },
}
const OTHER: Edge = {
  node: { id: "notif-other", bulletinKey: null, createdAt: INVITED_AT },
}
const KEYED_OTHER: Edge = {
  node: { id: "notif-keyed", bulletinKey: "something-else", createdAt: INVITED_AT },
}

const SIGNED: CardInvestmentProgress = { selectedAmountUsd: 25000, signedAt: SIGNED_AT }
const SIGNED_WITH_ID: CardInvestmentProgress = {
  ...SIGNED,
  invitationBulletinId: "notif-invite",
}

/** The home's own list, of which only whether it is empty matters here. */
const homeBulletins = (count: number): BulletinsQuery =>
  ({
    me: {
      id: "user-1",
      unacknowledgedStatefulNotificationsWithBulletinEnabled: {
        edges: Array.from({ length: count }, (_, index) => ({
          node: { id: `n-${index}` },
        })),
      },
    },
  }) as unknown as BulletinsQuery

const client = mockClient as unknown as Parameters<
  typeof findInvestmentInvitationBulletin
>[0]

const acknowledgedNotification = (id: string) => ({
  variables: { input: { notificationId: id } },
})

beforeEach(() => {
  jest.clearAllMocks()
  mockProgress.current = null
})

describe("findInvestmentInvitationBulletin", () => {
  it("names the bulletin sent under the invitation key, with when it was created", async () => {
    mockQuery.mockResolvedValueOnce(page([OTHER, INVITATION]))

    await expect(findInvestmentInvitationBulletin(client)).resolves.toEqual({
      id: "notif-invite",
      createdAt: INVITED_AT,
    })
  })

  /** Read from the server, not the cache: the answer decides a mutation. */
  it("asks the server rather than the cache, a page at a time", async () => {
    mockQuery.mockResolvedValueOnce(page([INVITATION]))

    await findInvestmentInvitationBulletin(client)

    expect(mockQuery).toHaveBeenCalledTimes(1)
    expect(mockQuery).toHaveBeenCalledWith({
      query: UnacknowledgedBulletinKeysDocument,
      variables: { first: 20, after: null },
      fetchPolicy: "network-only",
    })
  })

  it("turns the pages until it finds the invitation", async () => {
    mockQuery
      .mockResolvedValueOnce(page([OTHER], "cursor-1"))
      .mockResolvedValueOnce(page([KEYED_OTHER], "cursor-2"))
      .mockResolvedValueOnce(page([INVITATION]))

    await expect(findInvestmentInvitationBulletin(client)).resolves.toMatchObject({
      id: "notif-invite",
    })

    expect(mockQuery).toHaveBeenCalledTimes(3)
    expect(mockQuery.mock.calls[1][0].variables).toEqual({ first: 20, after: "cursor-1" })
    expect(mockQuery.mock.calls[2][0].variables).toEqual({ first: 20, after: "cursor-2" })
  })

  it("answers null once every page is read and none is the invitation", async () => {
    mockQuery
      .mockResolvedValueOnce(page([OTHER], "cursor-1"))
      .mockResolvedValueOnce(page([KEYED_OTHER]))

    await expect(findInvestmentInvitationBulletin(client)).resolves.toBeNull()
    expect(mockQuery).toHaveBeenCalledTimes(2)
  })

  it("answers null when there are no bulletins at all", async () => {
    mockQuery.mockResolvedValueOnce(page([]))

    await expect(findInvestmentInvitationBulletin(client)).resolves.toBeNull()
  })

  it("answers null when the server names no user", async () => {
    mockQuery.mockResolvedValueOnce({ data: { me: null } })

    await expect(findInvestmentInvitationBulletin(client)).resolves.toBeNull()
  })

  /** A next page with no cursor to reach it by cannot be turned; better to stop than to
   *  ask for the first page again for ever. */
  it("stops when a next page is announced without a cursor", async () => {
    mockQuery.mockResolvedValueOnce({
      data: {
        me: {
          id: "user-1",
          unacknowledgedStatefulNotificationsWithBulletinEnabled: {
            pageInfo: { endCursor: null, hasNextPage: true },
            edges: [OTHER],
          },
        },
      },
    })

    await expect(findInvestmentInvitationBulletin(client)).resolves.toBeNull()
    expect(mockQuery).toHaveBeenCalledTimes(1)
  })

  /** A cursor that never advances would otherwise be followed for ever. */
  it("gives up after ten pages", async () => {
    mockQuery.mockResolvedValue(page([OTHER], "same-cursor"))

    await expect(findInvestmentInvitationBulletin(client)).resolves.toBeNull()
    expect(mockQuery).toHaveBeenCalledTimes(10)
  })
})

describe("isAnsweredInvitation", () => {
  /** The id the signing step wrote down is the whole test, whatever the dates say. */
  it("matches the bulletin written down at signing, and no other", () => {
    expect(isAnsweredInvitation(INVITATION.node, SIGNED_WITH_ID)).toBe(true)
    expect(isAnsweredInvitation(REINVITATION.node, SIGNED_WITH_ID)).toBe(false)
    expect(
      isAnsweredInvitation({ ...INVITATION.node, id: "notif-else" }, SIGNED_WITH_ID),
    ).toBe(false)
  })

  /** With nothing written down, only a bulletin older than the signature can be the
   *  one it answered; a new invitation is only sent after the old is acknowledged. */
  it("falls back to the bulletin's age when nothing was written down", () => {
    expect(isAnsweredInvitation(INVITATION.node, SIGNED)).toBe(true)
    expect(isAnsweredInvitation(REINVITATION.node, SIGNED)).toBe(false)
    expect(
      isAnsweredInvitation({ ...INVITATION.node, createdAt: SIGNED_AT / 1000 }, SIGNED),
    ).toBe(false)
  })
})

describe("useAcknowledgeInvestmentInvitation", () => {
  const renderAcknowledge = () =>
    renderHook(() => useAcknowledgeInvestmentInvitation()).result.current

  it("writes the invitation down, acknowledges it and refetches the home's bulletins", async () => {
    mockQuery.mockResolvedValueOnce(page([INVITATION]))
    const acknowledgeInvitation = renderAcknowledge()

    await act(() => acknowledgeInvitation())

    expect(mockRecordInvitationBulletin).toHaveBeenCalledWith("notif-invite")
    expect(mockAcknowledge).toHaveBeenCalledWith(acknowledgedNotification("notif-invite"))
    expect(mockRefetchQueries).toHaveBeenCalledWith({ include: [BulletinsDocument] })
    expect(mockLogError).not.toHaveBeenCalled()
  })

  /** The record is what tells this invitation from a later one, so it is written before
   *  the acknowledgement that may fail. */
  it("writes the invitation down before acknowledging it", async () => {
    mockQuery.mockResolvedValueOnce(page([INVITATION]))
    const order: string[] = []
    mockRecordInvitationBulletin.mockImplementationOnce(() => order.push("record"))
    mockAcknowledge.mockImplementationOnce(() => {
      order.push("acknowledge")
      return Promise.resolve({})
    })
    const acknowledgeInvitation = renderAcknowledge()

    await act(() => acknowledgeInvitation())

    expect(order).toEqual(["record", "acknowledge"])
  })

  it("does nothing when no invitation is up", async () => {
    mockQuery.mockResolvedValueOnce(page([OTHER]))
    const acknowledgeInvitation = renderAcknowledge()

    await act(() => acknowledgeInvitation())

    expect(mockRecordInvitationBulletin).not.toHaveBeenCalled()
    expect(mockAcknowledge).not.toHaveBeenCalled()
    expect(mockRefetchQueries).not.toHaveBeenCalled()
  })

  /** Neither the signature nor the payment depends on it, so a failure is logged and
   *  the caller is never made to fail with it. */
  it("stays quiet when the lookup fails", async () => {
    mockQuery.mockRejectedValueOnce(new Error("offline"))
    const acknowledgeInvitation = renderAcknowledge()

    await act(() => acknowledgeInvitation())

    expect(mockRecordInvitationBulletin).not.toHaveBeenCalled()
    expect(mockAcknowledge).not.toHaveBeenCalled()
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "card-investment-invitation",
        error: expect.any(Error),
        expected: true,
      }),
    )
  })

  it("stays quiet when the acknowledgement fails, keeping what it wrote down", async () => {
    mockQuery.mockResolvedValueOnce(page([INVITATION]))
    mockAcknowledge.mockRejectedValueOnce(new Error("refused"))
    const acknowledgeInvitation = renderAcknowledge()

    await act(() => acknowledgeInvitation())

    expect(mockRecordInvitationBulletin).toHaveBeenCalledWith("notif-invite")
    expect(mockRefetchQueries).not.toHaveBeenCalled()
    expect(mockLogError).toHaveBeenCalledTimes(1)
  })

  /** The home asks at the moment of signature too; it joins the signing step's attempt
   *  rather than starting one of its own, and the next call after it settles asks again. */
  it("is joined by the home when both ask at the same time", async () => {
    mockProgress.current = SIGNED
    let answer: (value: unknown) => void = () => {}
    mockQuery.mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve
      }),
    )
    const acknowledgeFromSigning = renderAcknowledge()

    const signing = acknowledgeFromSigning()
    renderHook(() => useAcknowledgeInvitationOnceSigned(homeBulletins(1)))
    await act(async () => {})
    expect(mockQuery).toHaveBeenCalledTimes(1)

    await act(async () => {
      answer(page([INVITATION]))
      await signing
    })
    expect(mockAcknowledge).toHaveBeenCalledTimes(1)

    mockQuery.mockResolvedValueOnce(page([]))
    await act(() => acknowledgeFromSigning())
    expect(mockQuery).toHaveBeenCalledTimes(2)
  })

  /** Two signatures cannot land at once, but a second call while the first is out runs
   *  after it rather than being dropped: it may have something of its own to write. */
  it("queues a second call behind one still in flight", async () => {
    let answer: (value: unknown) => void = () => {}
    mockQuery.mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve
      }),
    )
    const acknowledgeInvitation = renderAcknowledge()

    const first = acknowledgeInvitation()
    const second = acknowledgeInvitation()
    expect(second).not.toBe(first)
    expect(mockQuery).toHaveBeenCalledTimes(1)

    mockQuery.mockResolvedValueOnce(page([]))
    await act(async () => {
      answer(page([INVITATION]))
      await second
    })

    expect(mockQuery).toHaveBeenCalledTimes(2)
    expect(mockAcknowledge).toHaveBeenCalledTimes(1)
  })

  it("keeps the same function across renders", () => {
    const { result, rerender } = renderHook(() => useAcknowledgeInvestmentInvitation())
    const first = result.current

    rerender({})

    expect(result.current).toBe(first)
  })
})

describe("useAcknowledgeInvitationOnceSigned", () => {
  const renderFallback = (bulletins: BulletinsQuery | undefined) =>
    renderHook(
      ({ served }: { served: BulletinsQuery | undefined }) =>
        useAcknowledgeInvitationOnceSigned(served),
      { initialProps: { served: bulletins } },
    )

  it("acknowledges the invitation written down at signing when it is still up", async () => {
    mockProgress.current = SIGNED_WITH_ID
    mockQuery.mockResolvedValueOnce(page([INVITATION]))

    renderFallback(homeBulletins(1))
    await act(async () => {})

    expect(mockAcknowledge).toHaveBeenCalledWith(acknowledgedNotification("notif-invite"))
    expect(mockRefetchQueries).toHaveBeenCalledWith({ include: [BulletinsDocument] })
    expect(mockClear).not.toHaveBeenCalled()
  })

  /** A new invitation is only sent once the old is acknowledged, so a different id is a
   *  fresh one: it stays for the investor to see, and the investment it supersedes goes,
   *  so the flow can be walked again for it. */
  it("leaves a new invitation standing and forgets the investment it supersedes", async () => {
    mockProgress.current = SIGNED_WITH_ID
    mockQuery.mockResolvedValueOnce(page([REINVITATION]))

    renderFallback(homeBulletins(1))
    await act(async () => {})

    expect(mockAcknowledge).not.toHaveBeenCalled()
    expect(mockClear).toHaveBeenCalledTimes(1)
    expect(mockClear).toHaveBeenCalledWith({ onlyIfSignedAt: SIGNED_AT })
    expect(mockLogError).not.toHaveBeenCalled()
  })

  /** A lookup the home started on the old record must not answer for a signature that
   *  lands while it is out: the signing step waits its turn and runs its own, and the
   *  old record's decision is scoped to the old record. */
  it("lets a signature that lands mid-lookup run its own settlement afterwards", async () => {
    mockProgress.current = SIGNED_WITH_ID
    let answerHomeLookup: (value: unknown) => void = () => {}
    mockQuery.mockReturnValueOnce(
      new Promise((resolve) => {
        answerHomeLookup = resolve
      }),
    )
    renderFallback(homeBulletins(1))
    await act(async () => {})
    expect(mockQuery).toHaveBeenCalledTimes(1)

    const acknowledgeFromSigning = renderHook(() => useAcknowledgeInvestmentInvitation())
      .result.current
    mockQuery.mockResolvedValueOnce(page([REINVITATION]))
    const signing = acknowledgeFromSigning()

    await act(async () => {
      answerHomeLookup(page([REINVITATION]))
      await signing
    })

    expect(mockClear).toHaveBeenCalledWith({ onlyIfSignedAt: SIGNED_AT })
    expect(mockQuery).toHaveBeenCalledTimes(2)
    expect(mockRecordInvitationBulletin).toHaveBeenCalledWith("notif-reinvite")
    expect(mockAcknowledge).toHaveBeenCalledWith(
      acknowledgedNotification("notif-reinvite"),
    )
  })

  /** Signed offline: nothing was written down, so the bulletin's age decides. */
  it("acknowledges a bulletin older than the signature when none was written down", async () => {
    mockProgress.current = SIGNED
    mockQuery.mockResolvedValueOnce(page([INVITATION]))

    renderFallback(homeBulletins(1))
    await act(async () => {})

    expect(mockAcknowledge).toHaveBeenCalledWith(acknowledgedNotification("notif-invite"))
    expect(mockClear).not.toHaveBeenCalled()
  })

  /** Neither known to be answered nor known to be new: acknowledging would hide an
   *  invitation, forgetting would lose a payment in progress, so it is left and logged. */
  it("leaves a bulletin newer than the signature alone when none was written down", async () => {
    mockProgress.current = SIGNED
    mockQuery.mockResolvedValueOnce(page([REINVITATION]))

    renderFallback(homeBulletins(1))
    await act(async () => {})

    expect(mockAcknowledge).not.toHaveBeenCalled()
    expect(mockClear).not.toHaveBeenCalled()
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "card-investment-invitation",
        context: { bulletinId: "notif-reinvite" },
        expected: true,
      }),
    )
  })

  it("does nothing when no investment bulletin is up", async () => {
    mockProgress.current = SIGNED_WITH_ID
    mockQuery.mockResolvedValueOnce(page([OTHER]))

    renderFallback(homeBulletins(1))
    await act(async () => {})

    expect(mockAcknowledge).not.toHaveBeenCalled()
    expect(mockClear).not.toHaveBeenCalled()
  })

  it("does nothing while nothing is signed", async () => {
    renderFallback(homeBulletins(1))
    await act(async () => {})

    expect(mockQuery).not.toHaveBeenCalled()
  })

  it("does nothing while the home shows no bulletins", async () => {
    mockProgress.current = SIGNED_WITH_ID

    renderFallback(homeBulletins(0))
    await act(async () => {})

    expect(mockQuery).not.toHaveBeenCalled()
  })

  it("does nothing while the home's bulletins have not loaded", async () => {
    mockProgress.current = SIGNED_WITH_ID

    renderFallback(undefined)
    await act(async () => {})

    expect(mockQuery).not.toHaveBeenCalled()
  })

  it("stays quiet when the lookup fails", async () => {
    mockProgress.current = SIGNED_WITH_ID
    mockQuery.mockRejectedValueOnce(new Error("offline"))

    renderFallback(homeBulletins(1))
    await act(async () => {})

    expect(mockAcknowledge).not.toHaveBeenCalled()
    expect(mockClear).not.toHaveBeenCalled()
    expect(mockLogError).toHaveBeenCalledTimes(1)
  })

  /** The list the home was served is what prompts a look: renders that bring the same
   *  list do not ask again, a new list does, and an empty one has nothing to look at. */
  it("looks once per list served, and again when a new list arrives", async () => {
    mockProgress.current = SIGNED_WITH_ID
    mockQuery.mockResolvedValue(page([OTHER]))
    const served = homeBulletins(2)

    const { rerender } = renderFallback(served)
    await act(async () => {})
    rerender({ served })
    await act(async () => {})
    expect(mockQuery).toHaveBeenCalledTimes(1)

    rerender({ served: homeBulletins(2) })
    await act(async () => {})
    expect(mockQuery).toHaveBeenCalledTimes(2)

    rerender({ served: homeBulletins(0) })
    await act(async () => {})
    expect(mockQuery).toHaveBeenCalledTimes(2)

    rerender({ served: homeBulletins(1) })
    await act(async () => {})
    expect(mockQuery).toHaveBeenCalledTimes(3)
  })
})
