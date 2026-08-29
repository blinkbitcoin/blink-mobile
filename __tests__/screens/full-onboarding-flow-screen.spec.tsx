import React from "react"
import { ActivityIndicator, Alert } from "react-native"
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

// Trap: the screen must never start a KYC flow the user did not ask for -- not
// with the empty names it mounts with, and not with the partial names it holds
// while the user is still typing. The matcher is deliberately total: an
// unrequested start whose variables match no mock misses the mock link, gets
// swallowed by the hook's catch, and never navigates -- so a "did not start"
// test would pass for the wrong reason. It is listed last because MockLink
// takes the first entry that matches, which keeps the John/Doe mock in play.
const kycFlowStartTrap: MockedResponse = {
  request: { query: KycFlowStartDocument },
  variableMatcher: () => true,
  maxUsageCount: Number.POSITIVE_INFINITY,
  result: {
    data: {
      kycFlowStart: {
        __typename: "KycFlowStartPayload",
        workflowRunId: "workflow-trap",
        tokenWeb: "test-token-web-trap",
      },
    },
  },
}

const generateFullOnboardingMock = ({
  onboardingStatus,
  statusMock,
  kycMock,
}: {
  onboardingStatus: OnboardingStatus | null
  statusMock?: Partial<MockedResponse>
  kycMock?: Partial<MockedResponse>
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
      ...statusMock,
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
      ...kycMock,
    },
    kycFlowStartTrap,
  ]
}

type AlertSpy = jest.SpyInstance<void, Parameters<typeof Alert.alert>>

const flushAsync = () =>
  act(
    () =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, 0)
      }),
  )

describe("FullOnboardingFlowScreen", () => {
  let alertSpy: AlertSpy

  beforeEach(() => {
    loadLocale("en")
    currentMocks = []
    jest.clearAllMocks()
    alertSpy = jest.spyOn(Alert, "alert")
  })

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

  // waitFor returns on its first non-throwing evaluation, so anchoring on a
  // render alone can win the race against a request the screen already sent.
  // MockLink replies on a macrotask: one turn lands the reply, the next lands
  // whatever it triggered. Every "did not navigate" below runs after this.
  const settleNetwork = async () => {
    await flushAsync()
    await flushAsync()
  }

  // Next only opens the confirmation alert; startKyc runs from its Yes handler.
  const openConfirmation = async (screen: Awaited<ReturnType<typeof renderScreen>>) => {
    fireEvent.changeText(screen.getByPlaceholderText("First name"), "John")
    fireEvent.changeText(screen.getByPlaceholderText("Last name"), "Doe")
    fireEvent.press(screen.getByTestId("Next"))

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalled()
    })
  }

  const pressAlertButton = async (index: number) => {
    const button = alertSpy.mock.calls[0][2]?.[index]
    await act(async () => {
      button?.onPress?.()
    })
  }

  describe("WebView navigation for KYC flow", () => {
    const submitNames = async (screen: Awaited<ReturnType<typeof renderScreen>>) => {
      await openConfirmation(screen)
      await pressAlertButton(1)
    }

    it("should not start the KYC flow on its own when onboardingStatus is AWAITING_INPUT", async () => {
      currentMocks = generateFullOnboardingMock({
        onboardingStatus: OnboardingStatus.AwaitingInput,
      })

      await renderScreen()
      await settleNetwork()

      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it("should not start the KYC flow while the user is typing their name", async () => {
      currentMocks = generateFullOnboardingMock({
        onboardingStatus: OnboardingStatus.AwaitingInput,
      })

      const screen = await renderScreen()

      // One character at a time on purpose: startKyc is re-memoised on every
      // keystroke, and partial names are exactly what an effect watching it
      // would leak to the KYC provider.
      const firstNameInput = screen.getByPlaceholderText("First name")
      for (const value of ["J", "Jo", "Joh", "John"]) {
        fireEvent.changeText(firstNameInput, value)
      }
      const lastNameInput = screen.getByPlaceholderText("Last name")
      for (const value of ["D", "Do", "Doe"]) {
        fireEvent.changeText(lastNameInput, value)
      }

      await waitFor(() => {
        expect(screen.getByDisplayValue("Doe")).toBeTruthy()
      })
      await settleNetwork()

      expect(alertSpy).not.toHaveBeenCalled()
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it("should ask the user to confirm the names they typed", async () => {
      currentMocks = generateFullOnboardingMock({
        onboardingStatus: OnboardingStatus.AwaitingInput,
      })

      const screen = await renderScreen()
      await openConfirmation(screen)

      const [title, content, buttons] = alertSpy.mock.calls[0]
      expect(title).toBe("Name confirmation")
      // Only the interpolation is a contract; the copy around it is product
      // wording that gets reworded across 28 locales.
      expect(content).toContain("John Doe")
      // The Cancel and Yes tests reach for these by position.
      expect(buttons?.map((button) => button.text)).toEqual(["Cancel", "Yes"])
    })

    it("should not start the KYC flow when the user cancels the confirmation", async () => {
      currentMocks = generateFullOnboardingMock({
        onboardingStatus: OnboardingStatus.AwaitingInput,
      })

      const screen = await renderScreen()
      await openConfirmation(screen)
      await pressAlertButton(0)
      await settleNetwork()

      expect(mockNavigate).not.toHaveBeenCalled()
      expect(mockGoBack).not.toHaveBeenCalled()
      expect(screen.getByDisplayValue("John")).toBeTruthy()
      expect(screen.getByTestId("Next")).toBeEnabled()
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

    it("should not ask again while a KYC flow is already starting", async () => {
      currentMocks = generateFullOnboardingMock({
        onboardingStatus: OnboardingStatus.AwaitingInput,
        // Never settles, so the button stays mid-flight for the rest of the
        // test with no real delay for a slow runner to race past.
        kycMock: { delay: Number.POSITIVE_INFINITY },
      })

      const screen = await renderScreen()
      await submitNames(screen)

      // The button swaps its title for a spinner while it is busy, and that
      // same flag is what makes it swallow presses.
      expect(screen.queryByText("Next")).toBeNull()
      expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy()

      fireEvent.press(screen.getByTestId("Next"))
      await settleNetwork()

      expect(alertSpy).toHaveBeenCalledTimes(1)
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })

  describe("Name form", () => {
    it("should keep Next disabled until both names hold more than whitespace", async () => {
      currentMocks = generateFullOnboardingMock({
        onboardingStatus: OnboardingStatus.NotStarted,
      })

      const screen = await renderScreen()

      fireEvent.changeText(screen.getByPlaceholderText("First name"), "   ")
      fireEvent.changeText(screen.getByPlaceholderText("Last name"), "\t\n ")
      expect(screen.getByTestId("Next")).toBeDisabled()

      // Pressing by title routes through the button's own disabled guard;
      // pressing the RNE wrapper's pressable parent bypasses it.
      fireEvent.press(screen.getByTestId("Next"))
      expect(alertSpy).not.toHaveBeenCalled()

      fireEvent.changeText(screen.getByPlaceholderText("First name"), "John")
      expect(screen.getByTestId("Next")).toBeDisabled()

      fireEvent.changeText(screen.getByPlaceholderText("Last name"), "Doe")
      expect(screen.getByTestId("Next")).toBeEnabled()
    })
  })

  describe("Onboarding status handling", () => {
    it.each([
      { onboardingStatus: OnboardingStatus.Abandoned, label: "Abandoned" },
      { onboardingStatus: OnboardingStatus.Approved, label: "Approved" },
      { onboardingStatus: OnboardingStatus.Declined, label: "Declined" },
      { onboardingStatus: OnboardingStatus.Error, label: "Error" },
      { onboardingStatus: OnboardingStatus.Processing, label: "Processing" },
      { onboardingStatus: OnboardingStatus.Review, label: "Review" },
    ])(
      "should show the status and contact support instead of the form when $onboardingStatus",
      async ({ onboardingStatus, label }) => {
        currentMocks = generateFullOnboardingMock({ onboardingStatus })

        const screen = render(
          <ContextForScreen>
            <FullOnboardingFlowScreen />
          </ContextForScreen>,
        )

        await waitFor(() => {
          expect(screen.getByText(`Your onboarding status is: ${label}.`)).toBeTruthy()
        })
        expect(screen.getByText("Need help? Contact us.")).toBeTruthy()
        expect(screen.queryByPlaceholderText("First name")).toBeNull()
        expect(screen.queryByTestId("Next")).toBeNull()

        await settleNetwork()
        expect(mockNavigate).not.toHaveBeenCalled()
      },
    )

    it.each([
      { onboardingStatus: OnboardingStatus.NotStarted, name: "NOT_STARTED" },
      { onboardingStatus: OnboardingStatus.AwaitingInput, name: "AWAITING_INPUT" },
      { onboardingStatus: null, name: "no status at all" },
    ])(
      "should render the name form with Next disabled when $name",
      async ({ onboardingStatus }) => {
        currentMocks = generateFullOnboardingMock({ onboardingStatus })

        const screen = await renderScreen()

        expect(screen.getByPlaceholderText("Last name")).toBeTruthy()
        expect(screen.getByTestId("Next")).toBeDisabled()
        expect(screen.queryByText("Need help? Contact us.")).toBeNull()
      },
    )

    it("should render the name form when the status query fails", async () => {
      currentMocks = generateFullOnboardingMock({
        onboardingStatus: OnboardingStatus.NotStarted,
        // A MockedResponse carries either a result or an error, never both.
        statusMock: { result: undefined, error: new Error("network down") },
      })

      const screen = await renderScreen()

      expect(screen.getByTestId("Next")).toBeDisabled()
      expect(screen.queryByText("Need help? Contact us.")).toBeNull()
    })

    it("should show a spinner while the status query is in flight", async () => {
      currentMocks = generateFullOnboardingMock({
        onboardingStatus: OnboardingStatus.NotStarted,
        statusMock: { delay: 60 },
      })

      const screen = render(
        <ContextForScreen>
          <FullOnboardingFlowScreen />
        </ContextForScreen>,
      )

      // Synchronous on purpose: the point is that the form does not paint
      // before the status is known.
      expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy()
      expect(screen.queryByPlaceholderText("First name")).toBeNull()

      await waitFor(() => {
        expect(screen.getByPlaceholderText("First name")).toBeTruthy()
      })
      expect(screen.UNSAFE_queryByType(ActivityIndicator)).toBeNull()
    })
  })
})
