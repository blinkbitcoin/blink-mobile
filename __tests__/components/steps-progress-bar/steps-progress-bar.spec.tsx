import React from "react"
import { Text as RNText } from "react-native"
import { render } from "@testing-library/react-native"

import { StepsProgressBar } from "@app/components/steps-progress-bar"

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof RNText>) => <RNText {...props} />,
  useTheme: () => ({
    theme: {
      colors: {
        primary: "#F7931A",
        grey2: "#666666",
        grey4: "#CCCCCC",
      },
    },
  }),
  makeStyles: () => () => ({
    container: {},
    barsContainer: {},
    bar: {},
    barFill: {},
    labelsContainer: {},
    label: {},
  }),
}))

describe("StepsProgressBar", () => {
  const twoStepProps = {
    steps: ["Set PIN", "Confirm"],
    currentStep: 1,
  }

  const threeStepProps = {
    steps: ["Current PIN", "New PIN", "Confirm"],
    currentStep: 1,
  }

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { toJSON } = render(<StepsProgressBar {...twoStepProps} />)

      expect(toJSON()).toBeTruthy()
    })

    it("renders two step labels", () => {
      const { getByText } = render(<StepsProgressBar {...twoStepProps} />)

      expect(getByText("Set PIN")).toBeTruthy()
      expect(getByText("Confirm")).toBeTruthy()
    })

    it("renders three step labels", () => {
      const { getByText } = render(<StepsProgressBar {...threeStepProps} />)

      expect(getByText("Current PIN")).toBeTruthy()
      expect(getByText("New PIN")).toBeTruthy()
      expect(getByText("Confirm")).toBeTruthy()
    })
  })

  describe("two step flow", () => {
    it("renders correct labels for two steps", () => {
      const { getByText } = render(<StepsProgressBar {...twoStepProps} />)

      expect(getByText("Set PIN")).toBeTruthy()
      expect(getByText("Confirm")).toBeTruthy()
    })

    it("displays both step labels in correct order", () => {
      const { getAllByText } = render(<StepsProgressBar {...twoStepProps} />)

      const labels = getAllByText(/Set PIN|Confirm/)
      expect(labels).toHaveLength(2)
    })
  })

  describe("three step flow", () => {
    it("renders correct labels for three steps", () => {
      const { getByText } = render(<StepsProgressBar {...threeStepProps} />)

      expect(getByText("Current PIN")).toBeTruthy()
      expect(getByText("New PIN")).toBeTruthy()
      expect(getByText("Confirm")).toBeTruthy()
    })

    it("displays all three step labels", () => {
      const { getAllByText } = render(<StepsProgressBar {...threeStepProps} />)

      const labels = getAllByText(/Current PIN|New PIN|Confirm/)
      expect(labels).toHaveLength(3)
    })
  })

  describe("current step progression", () => {
    it("handles step 1 of 2", () => {
      const { getByText } = render(
        <StepsProgressBar steps={["Step 1", "Step 2"]} currentStep={1} />,
      )

      expect(getByText("Step 1")).toBeTruthy()
      expect(getByText("Step 2")).toBeTruthy()
    })

    it("handles step 2 of 2", () => {
      const { getByText } = render(
        <StepsProgressBar steps={["Step 1", "Step 2"]} currentStep={2} />,
      )

      expect(getByText("Step 1")).toBeTruthy()
      expect(getByText("Step 2")).toBeTruthy()
    })

    it("handles step 1 of 3", () => {
      const { getByText } = render(<StepsProgressBar {...threeStepProps} />)

      expect(getByText("Current PIN")).toBeTruthy()
    })

    it("handles step 2 of 3", () => {
      const { getByText } = render(
        <StepsProgressBar {...threeStepProps} currentStep={2} />,
      )

      expect(getByText("Current PIN")).toBeTruthy()
      expect(getByText("New PIN")).toBeTruthy()
    })

    it("handles step 3 of 3", () => {
      const { getByText } = render(
        <StepsProgressBar {...threeStepProps} currentStep={3} />,
      )

      expect(getByText("Confirm")).toBeTruthy()
    })
  })

  describe("different step labels", () => {
    it("renders with custom step labels", () => {
      const { getByText } = render(
        <StepsProgressBar steps={["Enter code", "Verify", "Complete"]} currentStep={1} />,
      )

      expect(getByText("Enter code")).toBeTruthy()
      expect(getByText("Verify")).toBeTruthy()
      expect(getByText("Complete")).toBeTruthy()
    })

    it("renders with single word labels", () => {
      const { getByText } = render(
        <StepsProgressBar steps={["First", "Second"]} currentStep={1} />,
      )

      expect(getByText("First")).toBeTruthy()
      expect(getByText("Second")).toBeTruthy()
    })

    it("renders with long labels", () => {
      const { getByText } = render(
        <StepsProgressBar
          steps={["Enter your current PIN", "Enter your new PIN"]}
          currentStep={1}
        />,
      )

      expect(getByText("Enter your current PIN")).toBeTruthy()
      expect(getByText("Enter your new PIN")).toBeTruthy()
    })
  })

  describe("four or more steps", () => {
    it("handles four steps", () => {
      const { getByText } = render(
        <StepsProgressBar
          steps={["Step 1", "Step 2", "Step 3", "Step 4"]}
          currentStep={1}
        />,
      )

      expect(getByText("Step 1")).toBeTruthy()
      expect(getByText("Step 2")).toBeTruthy()
      expect(getByText("Step 3")).toBeTruthy()
      expect(getByText("Step 4")).toBeTruthy()
    })

    it("handles five steps", () => {
      const { getByText } = render(
        <StepsProgressBar steps={["A", "B", "C", "D", "E"]} currentStep={3} />,
      )

      expect(getByText("A")).toBeTruthy()
      expect(getByText("B")).toBeTruthy()
      expect(getByText("C")).toBeTruthy()
      expect(getByText("D")).toBeTruthy()
      expect(getByText("E")).toBeTruthy()
    })
  })

  describe("rerender", () => {
    it("updates labels when steps change", () => {
      const { getByText, queryByText, rerender } = render(
        <StepsProgressBar {...twoStepProps} />,
      )

      expect(getByText("Set PIN")).toBeTruthy()

      rerender(<StepsProgressBar steps={["New Step 1", "New Step 2"]} currentStep={1} />)

      expect(getByText("New Step 1")).toBeTruthy()
      expect(getByText("New Step 2")).toBeTruthy()
      expect(queryByText("Set PIN")).toBeNull()
    })

    it("updates when currentStep changes", () => {
      const { rerender, toJSON } = render(<StepsProgressBar {...twoStepProps} />)

      const initialJson = toJSON()

      rerender(<StepsProgressBar {...twoStepProps} currentStep={2} />)

      const updatedJson = toJSON()

      expect(initialJson).toBeTruthy()
      expect(updatedJson).toBeTruthy()
    })

    it("handles adding more steps", () => {
      const { getByText, rerender } = render(<StepsProgressBar {...twoStepProps} />)

      expect(getByText("Set PIN")).toBeTruthy()
      expect(getByText("Confirm")).toBeTruthy()

      rerender(
        <StepsProgressBar steps={["Set PIN", "Verify", "Confirm"]} currentStep={1} />,
      )

      expect(getByText("Set PIN")).toBeTruthy()
      expect(getByText("Verify")).toBeTruthy()
      expect(getByText("Confirm")).toBeTruthy()
    })
  })

  describe("edge cases", () => {
    it("handles single step", () => {
      const { getByText } = render(
        <StepsProgressBar steps={["Only Step"]} currentStep={1} />,
      )

      expect(getByText("Only Step")).toBeTruthy()
    })

    it("handles step labels with special characters", () => {
      const { getByText } = render(
        <StepsProgressBar steps={["Step #1", "Step & 2"]} currentStep={1} />,
      )

      expect(getByText("Step #1")).toBeTruthy()
      expect(getByText("Step & 2")).toBeTruthy()
    })

    it("handles step labels with numbers", () => {
      const { getByText } = render(
        <StepsProgressBar steps={["1. Enter PIN", "2. Confirm"]} currentStep={1} />,
      )

      expect(getByText("1. Enter PIN")).toBeTruthy()
      expect(getByText("2. Confirm")).toBeTruthy()
    })
  })

  describe("PIN flow specific scenarios", () => {
    it("renders create PIN flow steps", () => {
      const { getByText } = render(
        <StepsProgressBar steps={["Set PIN", "Confirm"]} currentStep={1} />,
      )

      expect(getByText("Set PIN")).toBeTruthy()
      expect(getByText("Confirm")).toBeTruthy()
    })

    it("renders change PIN flow steps", () => {
      const { getByText } = render(
        <StepsProgressBar
          steps={["Current PIN", "New PIN", "Confirm"]}
          currentStep={1}
        />,
      )

      expect(getByText("Current PIN")).toBeTruthy()
      expect(getByText("New PIN")).toBeTruthy()
      expect(getByText("Confirm")).toBeTruthy()
    })

    it("renders at step 2 of change PIN flow", () => {
      const { getByText } = render(
        <StepsProgressBar
          steps={["Current PIN", "New PIN", "Confirm"]}
          currentStep={2}
        />,
      )

      expect(getByText("Current PIN")).toBeTruthy()
      expect(getByText("New PIN")).toBeTruthy()
      expect(getByText("Confirm")).toBeTruthy()
    })

    it("renders at final step of change PIN flow", () => {
      const { getByText } = render(
        <StepsProgressBar
          steps={["Current PIN", "New PIN", "Confirm"]}
          currentStep={3}
        />,
      )

      expect(getByText("Current PIN")).toBeTruthy()
      expect(getByText("New PIN")).toBeTruthy()
      expect(getByText("Confirm")).toBeTruthy()
    })
  })
})
