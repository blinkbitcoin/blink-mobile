import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardDetailsScreen } from "@app/screens/card-screen/card-details-screen"
import { CardStatus, CardType } from "@app/graphql/generated"
import { ContextForScreen } from "../helper"

jest.mock("@react-native-community/blur", () => ({
  BlurView: "BlurView",
}))

jest.mock("react-native-linear-gradient", () => ({
  LinearGradient: "LinearGradient",
}))

jest.mock("react-native-vector-icons/Ionicons", () => "Icon")

const mockGoBack = jest.fn()
const mockSetOptions = jest.fn()
const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({
      goBack: mockGoBack,
      setOptions: mockSetOptions,
      navigate: mockNavigate,
    }),
  }
})

const mockCopyToClipboard = jest.fn()
const mockUseClipboard = jest.fn((_clearAfterMs?: number) => ({
  copyToClipboard: mockCopyToClipboard,
}))
jest.mock("@app/hooks/use-clipboard", () => ({
  useClipboard: (clearAfterMs?: number) => mockUseClipboard(clearAfterMs),
}))

const mockIsSensorAvailable = jest.fn()
const mockAuthenticate = jest.fn()
jest.mock("@app/utils/biometricAuthentication", () => ({
  __esModule: true,
  default: {
    isSensorAvailable: () => mockIsSensorAvailable(),
    authenticate: (...args: unknown[]) => mockAuthenticate(...args),
  },
}))

const mockUseCardData = jest.fn()
jest.mock("@app/screens/card-screen/hooks/use-card-data", () => ({
  useCardData: () => mockUseCardData(),
}))

type CardFixture = {
  id: string
  lastFour: string
  status: CardStatus
  cardType: CardType
  createdAt: string
}

const activeCard: CardFixture = {
  id: "card-1",
  lastFour: "4242",
  status: CardStatus.Active,
  cardType: CardType.Virtual,
  createdAt: "2025-04-23T12:00:00Z",
}

const lockedCard: CardFixture = {
  ...activeCard,
  status: CardStatus.Locked,
}

const defaultCardData = {
  card: activeCard,
  loading: false,
  error: undefined,
  refetch: jest.fn(),
}

const setupMocks = (overrides?: { cardData?: Partial<typeof defaultCardData> }) => {
  mockUseCardData.mockReturnValue({ ...defaultCardData, ...overrides?.cardData })
  mockIsSensorAvailable.mockResolvedValue(false)
}

describe("CardDetailsScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    jest.useFakeTimers()
    setupMocks()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe("biometric authentication", () => {
    it("skips biometric when sensor is not available", async () => {
      mockIsSensorAvailable.mockResolvedValue(false)

      const { getByText } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Card number")).toBeTruthy()
      expect(mockAuthenticate).not.toHaveBeenCalled()
    })

    it("triggers biometric when sensor is available", async () => {
      mockIsSensorAvailable.mockResolvedValue(true)
      mockAuthenticate.mockImplementation(
        (_desc: string, onSuccess: () => void, _onFail: () => void) => {
          onSuccess()
        },
      )

      const { getByText } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(mockAuthenticate).toHaveBeenCalledWith(
        "Authenticate to view card details",
        expect.any(Function),
        expect.any(Function),
      )
      expect(getByText("Card number")).toBeTruthy()
    })

    it("navigates back on biometric failure", async () => {
      mockIsSensorAvailable.mockResolvedValue(true)
      mockAuthenticate.mockImplementation(
        (_desc: string, _onSuccess: () => void, onFail: () => void) => {
          onFail()
        },
      )

      render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(mockGoBack).toHaveBeenCalled()
    })
  })

  describe("loading state", () => {
    it("shows loading indicator when card is loading", async () => {
      setupMocks({ cardData: { loading: true, card: undefined } })

      const { toJSON } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(toJSON()).toBeTruthy()
    })
  })

  describe("card not found", () => {
    it("navigates back when no card", async () => {
      setupMocks({ cardData: { card: undefined, loading: false } })

      render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(mockGoBack).toHaveBeenCalled()
    })
  })

  describe("card data rendering", () => {
    it("renders masked card number", async () => {
      const { getAllByText } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getAllByText("•••• •••• •••• 4242").length).toBeGreaterThanOrEqual(1)
    })

    it("displays placeholder for expiry date", async () => {
      const { getAllByText } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getAllByText("—").length).toBeGreaterThanOrEqual(1)
    })

    it("displays placeholder for CVV", async () => {
      const { getAllByText } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getAllByText("—").length).toBeGreaterThanOrEqual(1)
    })

    it("displays placeholder for cardholder name", async () => {
      const { getAllByText } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const placeholders = getAllByText("—")
      expect(placeholders.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe("card information section", () => {
    it("displays card information title", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Card information")).toBeTruthy()
    })

    it("displays formatted card type", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Virtual Visa debit")).toBeTruthy()
    })

    it("displays physical card type", async () => {
      setupMocks({ cardData: { card: { ...activeCard, cardType: CardType.Physical } } })

      const { getByText } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Physical Visa debit")).toBeTruthy()
    })

    it("displays active status", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Active")).toBeTruthy()
    })

    it("displays frozen status for locked card", async () => {
      setupMocks({ cardData: { card: lockedCard } })

      const { getByText } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Frozen")).toBeTruthy()
    })

    it("displays formatted issued date", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("April 23, 2025")).toBeTruthy()
    })

    it("displays network as Visa", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Visa")).toBeTruthy()
    })
  })

  describe("warning section", () => {
    it("displays keep details safe warning", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Keep your details safe")).toBeTruthy()
    })

    it("displays security warning text", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(
        getByText(
          "Never share your card details with anyone. Blink will never ask for your card information via email or phone.",
        ),
      ).toBeTruthy()
    })
  })

  describe("copy interactions", () => {
    it("copies lastFour when card number field is pressed", async () => {
      const { getByTestId } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      await act(async () => {
        fireEvent.press(getByTestId("card-number-field"))
      })

      expect(mockCopyToClipboard).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "4242",
        }),
      )
    })

    it("initializes clipboard with 60s auto-clear", async () => {
      render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(mockUseClipboard).toHaveBeenCalledWith(60_000)
    })
  })

  describe("field labels", () => {
    it("displays all field labels", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Card number")).toBeTruthy()
      expect(getByText("Expiry date")).toBeTruthy()
      expect(getByText("CVV")).toBeTruthy()
      expect(getByText("Cardholder name")).toBeTruthy()
    })
  })

  describe("info row labels", () => {
    it("displays all info row labels", async () => {
      const { getByText } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Card type")).toBeTruthy()
      expect(getByText("Status")).toBeTruthy()
      expect(getByText("Issued")).toBeTruthy()
      expect(getByText("Network")).toBeTruthy()
    })
  })

  describe("header settings button", () => {
    it("sets headerRight option on mount", async () => {
      render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(mockSetOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          headerRight: expect.any(Function),
        }),
      )
    })
  })

  describe("frozen card rendering", () => {
    it("renders frozen card overlay", async () => {
      setupMocks({ cardData: { card: lockedCard } })

      const { getByText } = render(
        <ContextForScreen>
          <CardDetailsScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      expect(getByText("Card frozen")).toBeTruthy()
    })
  })
})
