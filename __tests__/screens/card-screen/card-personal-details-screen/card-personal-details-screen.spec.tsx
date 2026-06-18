import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardPersonalDetailsScreen } from "@app/screens/card-screen/card-personal-details-screen"
import { OnboardingStatus } from "@app/graphql/generated"
import { ContextForScreen } from "../../helper"

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({
    feedbackEmailAddress: "support@blink.sv",
  }),
}))

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
    }),
  }
})

type PersonalDetailsReturn = {
  firstName: string
  lastName: string
  fullName: string
  onboardingStatus: OnboardingStatus | null
  email: string
  phone: string
  shippingAddress: null
  loading: boolean
  error: Error | undefined
}

const defaultMockData: PersonalDetailsReturn = {
  firstName: "John",
  lastName: "Doe",
  fullName: "John Doe",
  onboardingStatus: OnboardingStatus.Approved,
  email: "john@example.com",
  phone: "+1 (999) 888-7777",
  shippingAddress: null,
  loading: false,
  error: undefined,
}

let mockPersonalDetailsReturn: PersonalDetailsReturn = { ...defaultMockData }

jest.mock(
  "@app/screens/card-screen/card-personal-details-screen/hooks/use-personal-details-data",
  () => ({
    usePersonalDetailsData: () => mockPersonalDetailsReturn,
  }),
)

describe("CardPersonalDetailsScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockPersonalDetailsReturn = { ...defaultMockData }
  })

  describe("rendering", () => {
    it("renders without crashing", async () => {
      const { toJSON } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(toJSON()).toBeTruthy()
    })

    it("displays user full name from hook data", async () => {
      const { getAllByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const nameElements = getAllByText("John Doe")
      expect(nameElements.length).toBeGreaterThanOrEqual(1)
    })

    it("displays cardholder label", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Blink Visa Cardholder")).toBeTruthy()
    })

    it("shows loading state when loading", async () => {
      mockPersonalDetailsReturn = {
        ...mockPersonalDetailsReturn,
        loading: true,
      }

      const { queryByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(queryByText("John Doe")).toBeNull()
      expect(queryByText("First name")).toBeNull()
      expect(queryByText("KYC verified information")).toBeNull()
    })

    it("shows partial name when only firstName is provided", async () => {
      mockPersonalDetailsReturn = {
        ...defaultMockData,
        fullName: "John",
        firstName: "John",
        lastName: "",
        shippingAddress: null,
      }

      const { getAllByText, queryByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getAllByText("John").length).toBeGreaterThanOrEqual(1)
      expect(queryByText("John Doe")).toBeNull()
    })

    it("shows empty name when fullName is empty", async () => {
      mockPersonalDetailsReturn = {
        ...defaultMockData,
        fullName: "",
        firstName: "",
        lastName: "",
        shippingAddress: null,
      }

      const { queryByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(queryByText("John Doe")).toBeNull()
    })
  })

  describe("kyc information section", () => {
    it("displays kyc verified information when approved", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("KYC verified information")).toBeTruthy()
    })

    it("displays kyc verified description when approved", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(
        getByText(
          "Your name, date of birth and address are verified through our KYC process. You can change the information by redoing the KYC process. We don't guarantee an approval.",
        ),
      ).toBeTruthy()
    })

    it("displays pending banner when processing", async () => {
      mockPersonalDetailsReturn = {
        ...mockPersonalDetailsReturn,
        onboardingStatus: OnboardingStatus.Processing,
      }

      const { getByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("KYC verification pending")).toBeTruthy()
    })

    it("displays under review banner when in review", async () => {
      mockPersonalDetailsReturn = {
        ...mockPersonalDetailsReturn,
        onboardingStatus: OnboardingStatus.Review,
      }

      const { getByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("KYC under review")).toBeTruthy()
    })

    it("displays declined banner when declined", async () => {
      mockPersonalDetailsReturn = {
        ...mockPersonalDetailsReturn,
        onboardingStatus: OnboardingStatus.Declined,
      }

      const { getByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("KYC verification declined")).toBeTruthy()
    })

    it("displays not started banner when status is null", async () => {
      mockPersonalDetailsReturn = {
        ...mockPersonalDetailsReturn,
        onboardingStatus: null,
      }

      const { getByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Complete KYC verification")).toBeTruthy()
    })

    it("displays not started banner when not started", async () => {
      mockPersonalDetailsReturn = {
        ...mockPersonalDetailsReturn,
        onboardingStatus: OnboardingStatus.NotStarted,
      }

      const { getByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Complete KYC verification")).toBeTruthy()
    })

    it("displays awaiting input banner", async () => {
      mockPersonalDetailsReturn = {
        ...mockPersonalDetailsReturn,
        onboardingStatus: OnboardingStatus.AwaitingInput,
      }

      const { getByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Continue KYC verification")).toBeTruthy()
    })

    it("displays error banner when error", async () => {
      mockPersonalDetailsReturn = {
        ...mockPersonalDetailsReturn,
        onboardingStatus: OnboardingStatus.Error,
      }

      const { getByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Verification error")).toBeTruthy()
    })

    it("displays error banner when abandoned", async () => {
      mockPersonalDetailsReturn = {
        ...mockPersonalDetailsReturn,
        onboardingStatus: OnboardingStatus.Abandoned,
      }

      const { getByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Verification error")).toBeTruthy()
    })

    it("displays change kyc information button when approved", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Change KYC information")).toBeTruthy()
    })

    it("hides change kyc information button when not approved", async () => {
      mockPersonalDetailsReturn = {
        ...mockPersonalDetailsReturn,
        onboardingStatus: OnboardingStatus.Processing,
      }

      const { queryByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(queryByText("Change KYC information")).toBeNull()
    })
  })

  describe("personal information fields", () => {
    it("displays first name from hook data", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("First name")).toBeTruthy()
      expect(getByText("John")).toBeTruthy()
    })

    it("displays last name from hook data", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Last name")).toBeTruthy()
      expect(getByText("Doe")).toBeTruthy()
    })

    it("shows empty first name when empty", async () => {
      mockPersonalDetailsReturn = {
        ...mockPersonalDetailsReturn,
        firstName: "",
      }

      const { queryByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(queryByText("John")).toBeNull()
    })

    it("shows empty last name when empty", async () => {
      mockPersonalDetailsReturn = {
        ...mockPersonalDetailsReturn,
        lastName: "",
      }

      const { queryByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(queryByText("Doe")).toBeNull()
    })
  })

  describe("contact information section", () => {
    it("displays contact information section title", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Contact information")).toBeTruthy()
    })

    it("displays email from hook data", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("john@example.com")).toBeTruthy()
    })

    it("displays phone from hook data", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("+1 (999) 888-7777")).toBeTruthy()
    })

    it("shows empty email when empty", async () => {
      mockPersonalDetailsReturn = {
        ...mockPersonalDetailsReturn,
        email: "",
      }

      const { queryByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(queryByText("john@example.com")).toBeNull()
    })

    it("shows empty phone when empty", async () => {
      mockPersonalDetailsReturn = {
        ...mockPersonalDetailsReturn,
        phone: "",
      }

      const { queryByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(queryByText("+1 (999) 888-7777")).toBeNull()
    })
  })

  describe("support section", () => {
    it("displays support section title", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Support")).toBeTruthy()
    })

    it("displays contact support row", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Contact Support")).toBeTruthy()
    })
  })

  describe("interactions", () => {
    it("allows pressing change kyc information button", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation()

      const { getByText } = render(
        <ContextForScreen>
          <CardPersonalDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const button = getByText("Change KYC information")
      await act(async () => {
        fireEvent.press(button)
      })

      expect(consoleSpy).toHaveBeenCalledWith("Change KYC information pressed")
      consoleSpy.mockRestore()
    })
  })
})
