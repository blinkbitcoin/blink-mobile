import { ApolloError } from "@apollo/client"
import { act, renderHook } from "@testing-library/react-native"
import { GraphQLError } from "graphql"

import { PlaceSubmission } from "@app/btcmap/submission"
import { useSubmitBtcMapPlace } from "@app/btcmap/use-place-submission"

const mockMutate = jest.fn()

jest.mock("@app/graphql/generated", () => ({
  useBtcMapPlaceSubmitMutation: () => [mockMutate],
}))

// Failures are reported rather than swallowed — expected ones as breadcrumbs,
// the rest as non-fatals. Held onto so the tests can see what would reach
// Crashlytics.
const mockReportError = jest.fn()
jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

const submission: PlaceSubmission = {
  name: "Hope House",
  category: "cafes",
  latitude: 13.496743,
  longitude: -89.439462,
}

const submissionId = "c6f2c4c0-3c41-4f2e-9f0a-9b9c2f0c6f2c"

const renderSubmit = () => renderHook(() => useSubmitBtcMapPlace()).result.current

beforeEach(() => {
  jest.clearAllMocks()
})

describe("useSubmitBtcMapPlace", () => {
  it("sends the place under the attempt's submission id", async () => {
    mockMutate.mockResolvedValue({
      data: {
        btcMapPlaceSubmit: {
          errors: [],
          place: { id: "1" },
        },
      },
    })
    const { submitPlace } = renderSubmit()

    let outcome: Awaited<ReturnType<typeof submitPlace>> | undefined
    await act(async () => {
      outcome = await submitPlace(submission, submissionId)
    })

    expect(mockMutate).toHaveBeenCalledWith({
      variables: {
        input: {
          submissionId,
          name: "Hope House",
          category: "cafes",
          latitude: 13.496743,
          longitude: -89.439462,
        },
      },
    })
    expect(outcome).toEqual({ submitted: true })
    expect(mockReportError).not.toHaveBeenCalled()
  })

  it("calls a payload carrying errors a refusal", async () => {
    // A refusal is not a dropped request: retrying it verbatim would never
    // succeed, so it has to be told apart from one rather than answered with
    // "check your connection". The backend's own wording is not carried up —
    // it only ever comes back in English.
    mockMutate.mockResolvedValue({
      data: {
        btcMapPlaceSubmit: {
          errors: [{ message: "rate limited", __typename: "Error" }],
          place: null,
        },
      },
    })
    const { submitPlace } = renderSubmit()

    let outcome: Awaited<ReturnType<typeof submitPlace>> | undefined
    await act(async () => {
      outcome = await submitPlace(submission, submissionId)
    })

    expect(outcome).toEqual({ submitted: false, refused: true })
    // ...but it is reported: a rate limit and a duplicate read the same on the
    // form, and support can only tell them apart here.
    expect(mockReportError).toHaveBeenCalledWith(
      "btcMapPlaceSubmit",
      expect.objectContaining({ message: "place refused: rate limited" }),
      { expected: true },
    )
  })

  it("does not call a request that never got an answer a refusal", async () => {
    mockMutate.mockRejectedValue(new Error("network down"))
    const { submitPlace } = renderSubmit()

    let outcome: Awaited<ReturnType<typeof submitPlace>> | undefined
    await act(async () => {
      outcome = await submitPlace(submission, submissionId)
    })

    expect(outcome).toEqual({ submitted: false, refused: false })
    expect(mockReportError).toHaveBeenCalledWith("btcMapPlaceSubmit", expect.any(Error))
  })

  it("calls a top-level GraphQL error a refusal, not a dropped request", async () => {
    // Apollo rejects the promise on top-level GraphQL errors too, so a request
    // the server answered and turned down — an unknown mutation, a validation
    // failure — arrives here as a rejection. Answering it with "check your
    // connection" would send the user retrying something that can never go
    // through.
    mockMutate.mockRejectedValue(
      new ApolloError({
        graphQLErrors: [new GraphQLError('Cannot query field "btcMapPlaceSubmit"')],
      }),
    )
    const { submitPlace } = renderSubmit()

    let outcome: Awaited<ReturnType<typeof submitPlace>> | undefined
    await act(async () => {
      outcome = await submitPlace(submission, submissionId)
    })

    expect(outcome).toEqual({ submitted: false, refused: true })
    expect(mockReportError).toHaveBeenCalledWith(
      "btcMapPlaceSubmit",
      expect.any(ApolloError),
      { expected: true },
    )
  })

  it("does not call a bare network failure a refusal", async () => {
    mockMutate.mockRejectedValue(new ApolloError({ networkError: new Error("offline") }))
    const { submitPlace } = renderSubmit()

    let outcome: Awaited<ReturnType<typeof submitPlace>> | undefined
    await act(async () => {
      outcome = await submitPlace(submission, submissionId)
    })

    expect(outcome).toEqual({ submitted: false, refused: false })
    // Reported all the same — connectivity downgrades itself to a breadcrumb,
    // so this never becomes non-fatal noise.
    expect(mockReportError).toHaveBeenCalledWith("btcMapPlaceSubmit", expect.any(Error))
  })

  it("does not call an answer with neither errors nor a place a refusal", async () => {
    // Nothing came back to have refused it, so it counts as the answer that
    // never arrived — which is what it amounts to.
    mockMutate.mockResolvedValue({
      data: {
        btcMapPlaceSubmit: {
          errors: [],
          place: null,
        },
      },
    })
    const { submitPlace } = renderSubmit()

    let outcome: Awaited<ReturnType<typeof submitPlace>> | undefined
    await act(async () => {
      outcome = await submitPlace(submission, submissionId)
    })

    expect(outcome).toEqual({ submitted: false, refused: false })
    // Nothing to report either: an empty answer carries no reason worth logging.
    expect(mockReportError).not.toHaveBeenCalled()
  })
})
