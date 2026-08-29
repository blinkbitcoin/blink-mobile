import React from "react"
import { Alert } from "react-native"
import { it } from "@jest/globals"
import { MockedResponse } from "@apollo/client/testing"
import { act, fireEvent, render, waitFor } from "@testing-library/react-native"

import { FullOnboardingFlowScreen } from "@app/screens/full-onboarding-flow/full-onboarding-flow"
import {
  FullOnboardingScreenDocument,
  KycFlowStartDocument,
  OnboardingStatus,
} from "@app/graphql/generated"
import { loadLocale } from "@app/i18n/i18n-util.sync"
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

jest.mock("@app/hooks/use-app-config", () => ({
  useAppConfig: () => ({
    appConfig: {
      galoyInstance: {
        kycUrl: "https://kyc.example.com",
      },
    },
  }),
}))

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
            firstName: "John",
            lastName: "Doe",
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
    // Trap: the screen must never start a KYC flow with the empty names it
    // mounts with. Without this mock an unrequested start would miss the mock
    // link entirely, get swallowed by the hook's catch, and never navigate --
    // so the "does not start on its own" test would pass for the wrong reason.
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
            workflowRunId: "workflow-trap",
            tokenWeb: "test-token-web-trap",
          },
        },
      },
    },
  ]
}

describe("FullOnboardingFlowScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    currentMocks = []
    jest.clearAllMocks()
  })

  describe("WebView navigation for KYC flow", () => {
    const renderScreen = async () => {
      const screen = render(
        <ContextForScreen>
          <FullOnboardingFlowScreen />
        </ContextForScreen>,
      )

      // The form only paints once the status query has resolved, so waiting on
      // it is what makes a later "did not navigate" assertion meaningful.
      await waitFor(() => {
        expect(screen.getByPlaceholderText("First name")).toBeTruthy()
      })

      return screen
    }

    // Next only opens the confirmation alert; startKyc runs from its Yes handler.
    const submitNames = async (screen: Awaited<ReturnType<typeof renderScreen>>) => {
      const alertSpy = jest.spyOn(Alert, "alert")

      fireEvent.changeText(screen.getByPlaceholderText("First name"), "John")
      fireEvent.changeText(screen.getByPlaceholderText("Last name"), "Doe")
      fireEvent.press(screen.getByTestId("Next"))

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalled()
      })

      const confirmButton = alertSpy.mock.calls[0][2]?.[1]
      await act(async () => {
        confirmButton?.onPress?.()
      })
    }

    it("should not start the KYC flow on its own when onboardingStatus is AWAITING_INPUT", async () => {
      currentMocks = generateFullOnboardingMock({
        onboardingStatus: OnboardingStatus.AwaitingInput,
      })

      await renderScreen()

      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it("should navigate to WebView with correct params when the user submits their name", async () => {
      currentMocks = generateFullOnboardingMock({
        onboardingStatus: OnboardingStatus.AwaitingInput,
      })

      const screen = await renderScreen()
      await submitNames(screen)

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
      expect(navigationCall[1].url).toContain("workflow_run_id=workflow-123")
    })

    it("should include theme parameter in KYC URL", async () => {
      currentMocks = generateFullOnboardingMock({
        onboardingStatus: OnboardingStatus.NotStarted,
      })

      const screen = await renderScreen()
      await submitNames(screen)

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
