import React from "react"
import { Text as RNText, View } from "react-native"
import { render, fireEvent } from "@testing-library/react-native"

import { CardActionButtons } from "@app/components/card-screen/card-action-buttons"

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      CardFlow: {
        CardDashboard: {
          Actions: {
            details: () => "Details",
            freeze: () => "Freeze",
            setLimits: () => "Set limits",
            statements: () => "Statements",
          },
        },
      },
    },
  }),
}))

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof RNText>) => <RNText {...props} />,
  useTheme: () => ({
    theme: {
      colors: {
        primary: "#F7931A",
        error: "#FF0000",
        error9: "#FFE0E0",
        grey4: "#E0E0E0",
      },
    },
  }),
  makeStyles: () => () => ({
    container: {},
    actionButton: {},
  }),
}))

jest.mock("@app/components/atomic/galoy-icon-button/galoy-icon-button", () => ({
  GaloyIconButton: ({
    text,
    onPress,
  }: {
    text: string
    onPress: () => void
    name: string
    size: number
    iconSize: number
    color: string
    backgroundColor: string
  }) => (
    <View testID={`icon-button-${text}`} onTouchEnd={onPress}>
      <RNText>{text}</RNText>
    </View>
  ),
}))

const renderWithProviders = (component: React.ReactElement) => {
  return render(component)
}

describe("CardActionButtons", () => {
  const mockOnDetails = jest.fn()
  const mockOnFreeze = jest.fn()
  const mockOnSetLimits = jest.fn()
  const mockOnStatements = jest.fn()

  const defaultProps = {
    isFrozen: false,
    onDetails: mockOnDetails,
    onFreeze: mockOnFreeze,
    onSetLimits: mockOnSetLimits,
    onStatements: mockOnStatements,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { toJSON } = renderWithProviders(<CardActionButtons {...defaultProps} />)

      expect(toJSON()).toBeTruthy()
    })

    it("displays all four action buttons", () => {
      const { getByText } = renderWithProviders(<CardActionButtons {...defaultProps} />)

      expect(getByText("Details")).toBeTruthy()
      expect(getByText("Freeze")).toBeTruthy()
      expect(getByText("Set limits")).toBeTruthy()
      expect(getByText("Statements")).toBeTruthy()
    })

    it("renders when card is frozen", () => {
      const { toJSON, getByText } = renderWithProviders(
        <CardActionButtons {...defaultProps} isFrozen={true} />,
      )

      expect(toJSON()).toBeTruthy()
      expect(getByText("Freeze")).toBeTruthy()
    })
  })

  describe("interactions", () => {
    it("calls onDetails when Details button is pressed", () => {
      const { getByText } = renderWithProviders(<CardActionButtons {...defaultProps} />)

      const detailsButton = getByText("Details")
      fireEvent.press(detailsButton)

      expect(mockOnDetails).toHaveBeenCalledTimes(1)
    })

    it("calls onFreeze when Freeze button is pressed", () => {
      const { getByText } = renderWithProviders(<CardActionButtons {...defaultProps} />)

      const freezeButton = getByText("Freeze")
      fireEvent.press(freezeButton)

      expect(mockOnFreeze).toHaveBeenCalledTimes(1)
    })

    it("calls onSetLimits when Set limits button is pressed", () => {
      const { getByText } = renderWithProviders(<CardActionButtons {...defaultProps} />)

      const setLimitsButton = getByText("Set limits")
      fireEvent.press(setLimitsButton)

      expect(mockOnSetLimits).toHaveBeenCalledTimes(1)
    })

    it("calls onStatements when Statements button is pressed", () => {
      const { getByText } = renderWithProviders(<CardActionButtons {...defaultProps} />)

      const statementsButton = getByText("Statements")
      fireEvent.press(statementsButton)

      expect(mockOnStatements).toHaveBeenCalledTimes(1)
    })

    it("allows pressing all buttons in sequence", () => {
      const { getByText } = renderWithProviders(<CardActionButtons {...defaultProps} />)

      fireEvent.press(getByText("Details"))
      fireEvent.press(getByText("Freeze"))
      fireEvent.press(getByText("Set limits"))
      fireEvent.press(getByText("Statements"))

      expect(mockOnDetails).toHaveBeenCalledTimes(1)
      expect(mockOnFreeze).toHaveBeenCalledTimes(1)
      expect(mockOnSetLimits).toHaveBeenCalledTimes(1)
      expect(mockOnStatements).toHaveBeenCalledTimes(1)
    })

    it("allows pressing the same button multiple times", () => {
      const { getByText } = renderWithProviders(<CardActionButtons {...defaultProps} />)

      const freezeButton = getByText("Freeze")
      fireEvent.press(freezeButton)
      fireEvent.press(freezeButton)
      fireEvent.press(freezeButton)

      expect(mockOnFreeze).toHaveBeenCalledTimes(3)
    })
  })

  describe("frozen state", () => {
    it("renders correctly when frozen", () => {
      const { getByText } = renderWithProviders(
        <CardActionButtons {...defaultProps} isFrozen={true} />,
      )

      expect(getByText("Details")).toBeTruthy()
      expect(getByText("Freeze")).toBeTruthy()
      expect(getByText("Set limits")).toBeTruthy()
      expect(getByText("Statements")).toBeTruthy()
    })

    it("still calls onFreeze when card is frozen and Freeze button is pressed", () => {
      const { getByText } = renderWithProviders(
        <CardActionButtons {...defaultProps} isFrozen={true} />,
      )

      const freezeButton = getByText("Freeze")
      fireEvent.press(freezeButton)

      expect(mockOnFreeze).toHaveBeenCalledTimes(1)
    })

    it("still calls other actions when card is frozen", () => {
      const { getByText } = renderWithProviders(
        <CardActionButtons {...defaultProps} isFrozen={true} />,
      )

      fireEvent.press(getByText("Details"))
      fireEvent.press(getByText("Set limits"))
      fireEvent.press(getByText("Statements"))

      expect(mockOnDetails).toHaveBeenCalledTimes(1)
      expect(mockOnSetLimits).toHaveBeenCalledTimes(1)
      expect(mockOnStatements).toHaveBeenCalledTimes(1)
    })
  })

  describe("callback references", () => {
    it("calls updated callback when reference changes", () => {
      const firstOnDetails = jest.fn()
      const secondOnDetails = jest.fn()

      const { getByText, rerender } = renderWithProviders(
        <CardActionButtons {...defaultProps} onDetails={firstOnDetails} />,
      )

      fireEvent.press(getByText("Details"))
      expect(firstOnDetails).toHaveBeenCalledTimes(1)

      rerender(<CardActionButtons {...defaultProps} onDetails={secondOnDetails} />)

      fireEvent.press(getByText("Details"))
      expect(secondOnDetails).toHaveBeenCalledTimes(1)
      expect(firstOnDetails).toHaveBeenCalledTimes(1)
    })
  })
})
