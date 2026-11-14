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
import { useCardApplicationSubmit } from "@app/screens/card-screen/onboarding/card-flow/use-card-application-submit"

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

const lostCreate: MockedResponse = {
  request: createRequest(true),
  error: new Error("Network request failed"),
}

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
      {
        request: createRequest(true),
        result: { errors: [new GraphQLError("Account is not invited")] },
      },
      applicationsResponse([]),
    ])

    expect(applicationId).toBeNull()
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

  it("leaves a refused application behind instead of waiting on it", async () => {
    const { applicationId } = await submit([
      kycResponse(OnboardingStatus.Approved),
      lostCreate,
      applicationsResponse([{ id: "application-0", status: ApplicationStatus.Denied }]),
    ])

    expect(applicationId).toBeNull()
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
