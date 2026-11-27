import { bounceInAnimation } from "@app/components/animations"

/** Each animation reads back as what it was asked for, so a sequence lists its steps. */
jest.mock("react-native-reanimated", () => ({
  Easing: { out: () => "out", inOut: () => "inOut", quad: "quad" },
  withSequence: (...steps: unknown[]) => ({ sequence: steps }),
  withTiming: (toValue: number, config: { duration: number }) => ({
    timing: toValue,
    duration: config.duration,
  }),
  withSpring: (toValue: number) => ({ spring: toValue }),
}))

describe("bounceInAnimation", () => {
  it("grows from a shrink and springs back by default", () => {
    const scale = { value: 1 }

    bounceInAnimation({ scale: scale as never, duration: 120 })

    expect(scale.value).toEqual({
      sequence: [{ timing: 1.22, duration: 120 }, { spring: 1 }],
    })
  })

  it("grows, shrinks and comes back to size once for a single bounce", () => {
    const scale = { value: 1 }

    bounceInAnimation({ scale: scale as never, duration: 60, isSingleBounce: true })

    expect(scale.value).toEqual({
      sequence: [
        { timing: 1.22, duration: 60 },
        { timing: 0.88, duration: 60 },
        { timing: 1, duration: 60 },
      ],
    })
  })
})
