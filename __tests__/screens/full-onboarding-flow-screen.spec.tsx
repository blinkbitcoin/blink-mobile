import React from "react"
import { it } from "@jest/globals"
import { MockedResponse } from "@apollo/client/testing"
import { render, waitFor } from "@testing-library/react-native"

import { FullOnboardingFlowScreen } from "@app/screens/full-onboarding-flow/full-onboarding-flow"
import {
  FullOnboardingScreenDocument,
  KycFlowStartDocument,
  OnboardingStatus,
} from "@app/graphql/generated"
import { ContextForScreen } from "./helper"

let currentMocks: MockedResponse[] = []

jest.mock("@app/utils/helper", () => ({
  ...jest.requireActual("@app/utils/helper"),
  isIos: true,
}))

jest.mock("@app/graphql/mocks", () => ({
  __esModule: true,
  get default() {
    return currentMocks
  },
}))

const mockNavigate = jest.fn()
const mockGoBack = jest.fn()

jest.mock("@react-navigation/native", () => {
  const actual = jest.requireActual("@react-navigation/native")
  return {
    ...actual,
    useNavigation: () => ({
      ...actual.useNavigation?.(),
      navigate: mockNavigate,
      goBack: mockGoBack,
    }),
  }
})

jest.mock("@app/hooks", () => {
  const actual = jest.requireActual("@app/hooks")
  return {
    ...actual,
    useAppConfig: () => ({
      appConfig: {
        galoyInstance: {
          kycUrl: "https://kyc.example.com",
        },
      },
    }),
  }
})

const generateFullOnboardingMock = ({
  onboardingStatus,
}: {
  onboardingStatus: OnboardingStatus
}): MockedResponse[] => {
  return [
    {
      request: { query: FullOnboardingScreenDocument },
      result: {
        data: {
          me: {
            __typename: "User",
            id: "user-id",
            defaultAccount: {
              __typename: "ConsumerAccount",
              id: "account-id",
              onboardingStatus,
            },
          },
        },
      },
    },
    {
      request: {
        query: KycFlowStartDocument,
        variables: {
          input: {
            firstName: "",
            lastName: "",
          },
        },
      },
      result: {
        data: {
          kycFlowStart: {
            __typename: "KycFlowStartPayload",
            workflowRunId: "workflow-123",
            tokenWeb: "test-token-web-123",
          },
        },
      },
    },
  ]
}

describe("FullOnboardingFlowScreen", () => {
  beforeEach(() => {
    currentMocks = []
    jest.clearAllMocks()
  })

  describe("WebView navigation for KYC flow", () => {
    it("should navigate to WebView with correct params when onboardingStatus is AWAITING_INPUT", async () => {
      currentMocks = generateFullOnboardingMock({
        onboardingStatus: OnboardingStatus.AwaitingInput,
      })

      render(
        <ContextForScreen>
          <FullOnboardingFlowScreen />
        </ContextForScreen>,
      )

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          "webView",
          expect.objectContaining({
            url: expect.stringContaining("https://kyc.example.com/webflow"),
            headerTitle: expect.any(String),
          }),
        )
      })

      const navigationCall = mockNavigate.mock.calls[0]
      expect(navigationCall[1].url).toContain("token=test-token-web-123")
    })

    it("should include theme parameter in KYC URL", async () => {
      currentMocks = generateFullOnboardingMock({
        onboardingStatus: OnboardingStatus.AwaitingInput,
      })

      render(
        <ContextForScreen>
          <FullOnboardingFlowScreen />
        </ContextForScreen>,
      )

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalled()
      })

      const navigationCall = mockNavigate.mock.calls[0]
      expect(navigationCall[1].url).toMatch(/theme=(dark|light)/)
    })
  })

  describe("Onboarding status handling", () => {
    it("should not navigate when onboardingStatus is APPROVED", async () => {
      currentMocks = generateFullOnboardingMock({
        onboardingStatus: OnboardingStatus.Approved,
      })

      render(
        <ContextForScreen>
          <FullOnboardingFlowScreen />
        </ContextForScreen>,
      )

      await waitFor(
        () => {
          expect(mockNavigate).not.toHaveBeenCalled()
        },
        { timeout: 500 },
      )
    })

    it("should not navigate when onboardingStatus is PROCESSING", async () => {
      currentMocks = generateFullOnboardingMock({
        onboardingStatus: OnboardingStatus.Processing,
      })

      render(
        <ContextForScreen>
          <FullOnboardingFlowScreen />
        </ContextForScreen>,
      )

      await waitFor(
        () => {
          expect(mockNavigate).not.toHaveBeenCalled()
        },
        { timeout: 500 },
      )
    })

    it("should render properly when onboardingStatus is NOT_STARTED", async () => {
      currentMocks = generateFullOnboardingMock({
        onboardingStatus: OnboardingStatus.NotStarted,
      })

      const { getByTestId } = render(
        <ContextForScreen>
          <FullOnboardingFlowScreen />
        </ContextForScreen>,
      )

      await waitFor(() => {
        expect(getByTestId("RNE_BUTTON_WRAPPER")).toBeTruthy()
      })
    })
  })
})
