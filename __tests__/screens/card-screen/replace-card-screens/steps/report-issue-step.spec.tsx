import React from "react"
import { Text as RNText, View } from "react-native"
import { render, fireEvent } from "@testing-library/react-native"

import { ReportIssueStep } from "@app/screens/card-screen/replace-card-screens/steps/report-issue-step"

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof RNText>) => <RNText {...props} />,
  useTheme: () => ({
    theme: {
      colors: {
        black: "#000000",
        primary: "#3B82F6",
        error: "#FF0000",
        warning: "#FFA726",
        grey2: "#666666",
        grey4: "#E0E0E0",
        transparent: "transparent",
      },
    },
  }),
  makeStyles: () => () => ({
    section: {},
    sectionTitle: {},
    settingsGroupContainer: {},
    dividerStyle: {},
  }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      CardFlow: {
        ReplaceCard: {
          ReportIssue: {
            cardManagement: () => "Card management",
            lostCard: () => "Lost card",
            lostCardDescription: () => "I misplaced my card and can't find it anywhere.",
            stolenCard: () => "Stolen card",
            stolenCardDescription: () =>
              "I misplaced my card and can't find it anywhere.",
            damagedCard: () => "Damaged card",
            damagedCardDescription: () =>
              "I misplaced my card and can't find it anywhere.",
            whatHappensNext: () => "What happens next?",
            bullet1: () => "Your current card will be frozen for security",
            bullet2: () => "A new card with different numbers will be issued",
            bullet3: () => "You can unfreeze if you find your card later",
          },
        },
      },
    },
  }),
}))

jest.mock("@app/components/card-screen", () => ({
  SelectableOptionRow: ({
    title,
    subtitle,
    isSelected,
    onPress,
  }: {
    title: string
    subtitle: string
    isSelected: boolean
    onPress: () => void
  }) => (
    <View
      testID={`option-${title}`}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
      onTouchEnd={onPress}
    >
      <RNText>{title}</RNText>
      <RNText>{subtitle}</RNText>
    </View>
  ),
  BulletListCard: ({ title, items }: { title: string; items: string[] }) => (
    <View testID="bullet-list-card">
      <RNText>{title}</RNText>
      {items.map((item: string) => (
        <RNText key={item}>{item}</RNText>
      ))}
    </View>
  ),
}))

jest.mock("@app/screens/settings-screen/group", () => ({
  SettingsGroup: ({ items }: { items: (() => React.ReactNode)[] }) => (
    <View testID="settings-group">
      {items.map((Item: () => React.ReactNode, idx: number) => (
        <View key={idx}>{Item()}</View>
      ))}
    </View>
  ),
}))

describe("ReportIssueStep", () => {
  const defaultProps = {
    selectedIssue: null,
    onSelectIssue: jest.fn(),
  }

  beforeEach(jest.clearAllMocks)

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { toJSON } = render(<ReportIssueStep {...defaultProps} />)

      expect(toJSON()).toBeTruthy()
    })

    it("displays card management section title", () => {
      const { getByText } = render(<ReportIssueStep {...defaultProps} />)

      expect(getByText("Card management")).toBeTruthy()
    })

    it("displays three issue options", () => {
      const { getByText } = render(<ReportIssueStep {...defaultProps} />)

      expect(getByText("Lost card")).toBeTruthy()
      expect(getByText("Stolen card")).toBeTruthy()
      expect(getByText("Damaged card")).toBeTruthy()
    })

    it("displays what happens next bullet list", () => {
      const { getByText } = render(<ReportIssueStep {...defaultProps} />)

      expect(getByText("What happens next?")).toBeTruthy()
      expect(getByText("Your current card will be frozen for security")).toBeTruthy()
      expect(getByText("A new card with different numbers will be issued")).toBeTruthy()
      expect(getByText("You can unfreeze if you find your card later")).toBeTruthy()
    })
  })

  describe("interactions", () => {
    it("calls onSelectIssue with lost when lost card pressed", () => {
      const { getByTestId } = render(<ReportIssueStep {...defaultProps} />)

      fireEvent(getByTestId("option-Lost card"), "touchEnd")

      expect(defaultProps.onSelectIssue).toHaveBeenCalledWith("lost")
    })

    it("calls onSelectIssue with stolen when stolen card pressed", () => {
      const { getByTestId } = render(<ReportIssueStep {...defaultProps} />)

      fireEvent(getByTestId("option-Stolen card"), "touchEnd")

      expect(defaultProps.onSelectIssue).toHaveBeenCalledWith("stolen")
    })

    it("calls onSelectIssue with damaged when damaged card pressed", () => {
      const { getByTestId } = render(<ReportIssueStep {...defaultProps} />)

      fireEvent(getByTestId("option-Damaged card"), "touchEnd")

      expect(defaultProps.onSelectIssue).toHaveBeenCalledWith("damaged")
    })
  })

  describe("selection state", () => {
    it("highlights lost card when selected", () => {
      const { getByTestId } = render(
        <ReportIssueStep {...defaultProps} selectedIssue="lost" />,
      )

      const option = getByTestId("option-Lost card")
      expect(option.props.accessibilityState).toEqual({ selected: true })
    })

    it("highlights stolen card when selected", () => {
      const { getByTestId } = render(
        <ReportIssueStep {...defaultProps} selectedIssue="stolen" />,
      )

      const option = getByTestId("option-Stolen card")
      expect(option.props.accessibilityState).toEqual({ selected: true })
    })

    it("highlights damaged card when selected", () => {
      const { getByTestId } = render(
        <ReportIssueStep {...defaultProps} selectedIssue="damaged" />,
      )

      const option = getByTestId("option-Damaged card")
      expect(option.props.accessibilityState).toEqual({ selected: true })
    })

    it("does not highlight unselected options", () => {
      const { getByTestId } = render(
        <ReportIssueStep {...defaultProps} selectedIssue="lost" />,
      )

      const stolenOption = getByTestId("option-Stolen card")
      expect(stolenOption.props.accessibilityState).toEqual({ selected: false })

      const damagedOption = getByTestId("option-Damaged card")
      expect(damagedOption.props.accessibilityState).toEqual({ selected: false })
    })
  })
})
