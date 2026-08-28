import { act, renderHook } from "@testing-library/react-native"

import { PlaceSubmission } from "@app/btcmap/submission"
import { useSubmitBtcMapPlace } from "@app/btcmap/use-place-submission"

const mockMutate = jest.fn()

jest.mock("@app/graphql/generated", () => ({
  useBtcMapPlaceSubmitMutation: () => [mockMutate],
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
  })

  it("hands back the backend's reason when the payload carries errors", async () => {
    // A refusal is not a dropped request: retrying it verbatim would never
    // succeed, so the reason has to reach the user rather than "check your
    // connection".
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

    expect(outcome).toEqual({ submitted: false, message: "rate limited" })
  })

  it("reports no reason when the request never got an answer", async () => {
    mockMutate.mockRejectedValue(new Error("network down"))
    const { submitPlace } = renderSubmit()

    let outcome: Awaited<ReturnType<typeof submitPlace>> | undefined
    await act(async () => {
      outcome = await submitPlace(submission, submissionId)
    })

    expect(outcome).toEqual({ submitted: false, message: null })
  })
})
