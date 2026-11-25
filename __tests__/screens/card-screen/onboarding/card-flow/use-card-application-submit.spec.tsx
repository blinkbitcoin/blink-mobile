import React, { PropsWithChildren } from "react"
import { act, renderHook } from "@testing-library/react-hooks"
import { MockedProvider, MockedResponse } from "@apollo/client/testing"
import { GraphQLError } from "graphql"

import {
  ApplicationStatus,
  CardApplicationStatusDocument,
  CardConsumerApplicationCreateDocument,
  CardKycStatusDocument,
  KycFlowType,
  OnboardingStatus,
} from "@app/graphql/generated"
import { useCardApplicationApproval } from "@app/screens/card-screen/onboarding/card-flow/use-card-application-approval"
import { useCardApplicationSubmit } from "@app/screens/card-screen/onboarding/card-flow/use-card-application-submit"

const mockLogError = jest.fn()

jest.mock("@app/utils/log-error", () => ({
  logError: (args: unknown) => mockLogError(args),
}))

const ANSWERS = {
  occupation: "15-1132",
  annualSalary: "50,000 - 74,999",
  accountPurpose: "Personal spending",
  expectedMonthlyVolume: "1,000 - 1,999",
}

const kycResponse = (onboardingStatus: OnboardingStatus): MockedResponse => ({
  request: { query: CardKycStatusDocument },
  result: {
    data: {
      me: {
        __typename: "User",
        id: "user-1",
        defaultAccount: {
          __typename: "ConsumerAccount",
          id: "account-1",
          onboardingStatus,
          flowType: KycFlowType.Card,
        },
      },
    },
  },
})

const kycFailure: MockedResponse = {
  request: { query: CardKycStatusDocument },
  error: new Error("Network request failed"),
}

const createRequest = (isL2Verified: boolean) => ({
  query: CardConsumerApplicationCreateDocument,
  variables: {
    input: { ...ANSWERS, isL2Verified, isTermsOfServiceAccepted: true },
  },
})

const createResponse = (isL2Verified: boolean): MockedResponse => ({
  request: createRequest(isL2Verified),
  result: {
    data: {
      cardConsumerApplicationCreate: {
        __typename: "ConsumerApplication",
        id: "application-1",
        applicationStatus: ApplicationStatus.Pending,
      },
    },
  },
})

const applicationsResponse = (
  applications: Array<{ id: string; status: ApplicationStatus }>,
): MockedResponse => ({
  request: { query: CardApplicationStatusDocument },
  result: {
    data: {
      me: {
        __typename: "User",
        id: "user-1",
        defaultAccount: {
          __typename: "ConsumerAccount",
          id: "account-1",
          cardConsumerApplications: applications.map(({ id, status }) => ({
            __typename: "ConsumerApplication",
            id,
            applicationStatus: status,
          })),
        },
      },
    },
  },
})

const failedApplicationsRead: MockedResponse = {
  request: { query: CardApplicationStatusDocument },
  error: new Error("Network request failed"),
}

const lostCreate: MockedResponse = {
  request: createRequest(true),
  error: new Error("Network request failed"),
}

const rejectedCreate = (message: string): MockedResponse => ({
  request: createRequest(true),
  result: { errors: [new GraphQLError(message)] },
})

const renderSubmit = (mocks: MockedResponse[]) =>
  renderHook(() => useCardApplicationSubmit(), {
    wrapper: ({ children }: PropsWithChildren) => (
      <MockedProvider mocks={mocks} addTypename>
        {children}
      </MockedProvider>
    ),
  })

const submit = async (mocks: MockedResponse[]) => {
  const { result } = renderSubmit(mocks)
  let applicationId: string | null = null
  await act(async () => {
    applicationId = await result.current.submitApplication(ANSWERS)
  })
  return { applicationId, result }
}

describe("useCardApplicationSubmit", () => {
  beforeEach(() => {
    mockLogError.mockClear()
  })

  it("records nothing when the create lands", async () => {
    await submit([kycResponse(OnboardingStatus.Approved), createResponse(true)])

    expect(mockLogError).not.toHaveBeenCalled()
  })

  it("records a lost create without the answers, and still follows the landed application", async () => {
    const { applicationId } = await submit([
      kycResponse(OnboardingStatus.Approved),
      lostCreate,
      applicationsResponse([{ id: "application-1", status: ApplicationStatus.Pending }]),
    ])

    expect(applicationId).toBe("application-1")
    expect(mockLogError).toHaveBeenCalledTimes(1)
    expect(mockLogError).toHaveBeenCalledWith({
      scope: "card-application-create",
      error: expect.objectContaining({ message: "Network request failed" }),
    })
    const recorded = JSON.stringify(mockLogError.mock.calls)
    Object.values(ANSWERS).forEach((answer) => expect(recorded).not.toContain(answer))
  })

  it("records the read-back too when it fails, and answers null", async () => {
    const { applicationId } = await submit([
      kycResponse(OnboardingStatus.Approved),
      lostCreate,
      failedApplicationsRead,
    ])

    expect(applicationId).toBeNull()
    expect(mockLogError).toHaveBeenCalledTimes(2)
    expect(mockLogError).toHaveBeenLastCalledWith({
      scope: "card-application-read-back",
      error: expect.objectContaining({ message: "Network request failed" }),
    })
  })
  it("sends an approved verification to the issuer at once", async () => {
    const { applicationId } = await submit([
      kycResponse(OnboardingStatus.Approved),
      createResponse(true),
    ])

    expect(applicationId).toBe("application-1")
  })

  it("has the backend hold the application while the verification is under review", async () => {
    const { applicationId } = await submit([
      kycResponse(OnboardingStatus.Processing),
      createResponse(false),
    ])

    expect(applicationId).toBe("application-1")
  })

  it("still sends the application, held, when the verification cannot be read", async () => {
    const { applicationId } = await submit([kycFailure, createResponse(false)])

    expect(applicationId).toBe("application-1")
  })

  it("answers null when the issuer refuses the application and none is live", async () => {
    const { applicationId } = await submit([
      kycResponse(OnboardingStatus.Approved),
      rejectedCreate("Account is not invited"),
      applicationsResponse([]),
    ])

    expect(applicationId).toBeNull()
  })

  /** Apollo logs the missing field; the hook still answers null. */
  it("answers null when the create answers without an application", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {})
    const { applicationId } = await submit([
      kycResponse(OnboardingStatus.Approved),
      { request: createRequest(true), result: {} },
    ])

    expect(applicationId).toBeNull()
    consoleError.mockRestore()
  })

  it("answers null when the application never reaches the server", async () => {
    const { applicationId } = await submit([
      kycResponse(OnboardingStatus.Approved),
      lostCreate,
      applicationsResponse([]),
    ])

    expect(applicationId).toBeNull()
  })

  it("follows the application that landed when the answer to its create was lost", async () => {
    const { applicationId } = await submit([
      kycResponse(OnboardingStatus.Approved),
      lostCreate,
      applicationsResponse([{ id: "application-9", status: ApplicationStatus.Pending }]),
    ])

    expect(applicationId).toBe("application-9")
  })

  /** Without an id the terms would show a generic error and offer Accept again, which
   *  the issuer refuses: the user sees the decline instead. */
  it("follows a landed application the issuer already refused, so the wait ends on the decline", async () => {
    const refusedApplication = () =>
      applicationsResponse([{ id: "application-0", status: ApplicationStatus.Denied }])
    const { applicationId } = await submit([
      kycResponse(OnboardingStatus.Approved),
      lostCreate,
      refusedApplication(),
    ])

    expect(applicationId).toBe("application-0")

    const { result, waitFor, unmount } = renderHook(
      () => useCardApplicationApproval("application-0"),
      {
        wrapper: ({ children }: PropsWithChildren) => (
          <MockedProvider mocks={[refusedApplication()]} addTypename>
            {children}
          </MockedProvider>
        ),
      },
    )
    await waitFor(() => result.current === "declined")
    expect(result.current).toBe("declined")
    unmount()
  })

  it("waits on the live application rather than an earlier refused one", async () => {
    const { applicationId } = await submit([
      kycResponse(OnboardingStatus.Approved),
      lostCreate,
      applicationsResponse([
        { id: "application-0", status: ApplicationStatus.Denied },
        { id: "application-9", status: ApplicationStatus.Pending },
      ]),
    ])

    expect(applicationId).toBe("application-9")
  })

  it("follows a locked application, which the issuer keeps on the account too", async () => {
    const { applicationId } = await submit([
      kycResponse(OnboardingStatus.Approved),
      lostCreate,
      applicationsResponse([{ id: "application-0", status: ApplicationStatus.Locked }]),
    ])

    expect(applicationId).toBe("application-0")
  })

  /** blink-card takes a new application after a cancellation, so an old one is no sign
   *  that this create landed: the user stays on the terms and can try again. */
  it("leaves the terms open after a cancelled application when the create never lands", async () => {
    const { applicationId } = await submit([
      kycResponse(OnboardingStatus.Approved),
      lostCreate,
      applicationsResponse([{ id: "application-0", status: ApplicationStatus.Canceled }]),
    ])

    expect(applicationId).toBeNull()
  })

  it("leaves the terms open after a cancelled application when the issuer rejects the create", async () => {
    const { applicationId } = await submit([
      kycResponse(OnboardingStatus.Approved),
      rejectedCreate("Account is not invited"),
      applicationsResponse([{ id: "application-0", status: ApplicationStatus.Canceled }]),
    ])

    expect(applicationId).toBeNull()
  })

  it("follows the application already on record when the issuer turns down a second one", async () => {
    const { applicationId } = await submit([
      kycResponse(OnboardingStatus.Approved),
      rejectedCreate("An application has already been submitted for this account"),
      applicationsResponse([{ id: "application-9", status: ApplicationStatus.Pending }]),
    ])

    expect(applicationId).toBe("application-9")
  })

  it("answers null when the applications cannot be read either", async () => {
    const { applicationId } = await submit([
      kycResponse(OnboardingStatus.Approved),
      lostCreate,
      { request: { query: CardApplicationStatusDocument }, error: new Error("offline") },
    ])

    expect(applicationId).toBeNull()
  })

  it("reports the sending only while it lasts", async () => {
    const { result } = renderSubmit([
      kycResponse(OnboardingStatus.Approved),
      createResponse(true),
    ])
    expect(result.current.isSubmitting).toBe(false)

    let pending: Promise<string | null> = Promise.resolve(null)
    act(() => {
      pending = result.current.submitApplication(ANSWERS)
    })
    expect(result.current.isSubmitting).toBe(true)

    await act(async () => {
      await pending
    })
    expect(result.current.isSubmitting).toBe(false)
  })
})
