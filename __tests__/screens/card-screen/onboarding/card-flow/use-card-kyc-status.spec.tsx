import React, { PropsWithChildren } from "react"
import { act, renderHook } from "@testing-library/react-hooks"
import { MockedProvider, MockedResponse } from "@apollo/client/testing"

import {
  CardKycStatusDocument,
  KycFlowType,
  OnboardingStatus,
} from "@app/graphql/generated"
import {
  isCardKycSubmitted,
  useCardKycStatus,
} from "@app/screens/card-screen/onboarding/card-flow/use-card-kyc-status"

const accountWith = (onboardingStatus: OnboardingStatus, flowType: KycFlowType) => ({
  __typename: "ConsumerAccount" as const,
  id: "account-1",
  onboardingStatus,
  flowType,
})

const statusResponse = (
  onboardingStatus: OnboardingStatus,
  flowType: KycFlowType,
): MockedResponse => ({
  request: { query: CardKycStatusDocument },
  result: {
    data: {
      me: {
        __typename: "User",
        id: "user-1",
        defaultAccount: accountWith(onboardingStatus, flowType),
      },
    },
  },
})

const renderStatus = (mocks: MockedResponse[]) =>
  renderHook(() => useCardKycStatus(), {
    wrapper: ({ children }: PropsWithChildren) => (
      <MockedProvider mocks={mocks} addTypename>
        {children}
      </MockedProvider>
    ),
  })

describe("isCardKycSubmitted", () => {
  const SUBMITTED = [
    OnboardingStatus.Processing,
    OnboardingStatus.Review,
    OnboardingStatus.Approved,
  ]
  const NOT_SUBMITTED = [
    OnboardingStatus.NotStarted,
    OnboardingStatus.AwaitingInput,
    OnboardingStatus.Abandoned,
    OnboardingStatus.Error,
    OnboardingStatus.Declined,
  ]

  SUBMITTED.forEach((status) => {
    it(`reads a card verification in ${status} as submitted`, () => {
      expect(isCardKycSubmitted(accountWith(status, KycFlowType.Card))).toBe(true)
    })
  })

  NOT_SUBMITTED.forEach((status) => {
    it(`reads a card verification in ${status} as not submitted`, () => {
      expect(isCardKycSubmitted(accountWith(status, KycFlowType.Card))).toBe(false)
    })
  })

  it("ignores the level two upgrade's verification", () => {
    expect(
      isCardKycSubmitted(
        accountWith(OnboardingStatus.Approved, KycFlowType.UpgradeLevelTwo),
      ),
    ).toBe(false)
  })

  it("reads an unknown account as not submitted", () => {
    expect(isCardKycSubmitted(undefined)).toBe(false)
  })
})

describe("useCardKycStatus", () => {
  it("reads nothing until asked", () => {
    const { result } = renderStatus([])

    expect(result.current.isKycSubmitted).toBe(false)
    expect(result.current.isCheckingKyc).toBe(false)
  })

  it("reports a submitted card verification once read", async () => {
    const { result, waitForNextUpdate } = renderStatus([
      statusResponse(OnboardingStatus.Processing, KycFlowType.Card),
    ])

    act(() => {
      result.current.readKycStatus()
    })
    expect(result.current.isCheckingKyc).toBe(true)

    await waitForNextUpdate()

    expect(result.current.isCheckingKyc).toBe(false)
    expect(result.current.isKycSubmitted).toBe(true)
  })

  it("reads the review again on each call instead of trusting the last answer", async () => {
    const { result, waitForNextUpdate } = renderStatus([
      statusResponse(OnboardingStatus.AwaitingInput, KycFlowType.Card),
      statusResponse(OnboardingStatus.Review, KycFlowType.Card),
    ])

    act(() => {
      result.current.readKycStatus()
    })
    await waitForNextUpdate()
    expect(result.current.isKycSubmitted).toBe(false)

    act(() => {
      result.current.readKycStatus()
    })
    await waitForNextUpdate()

    expect(result.current.isKycSubmitted).toBe(true)
  })
})
