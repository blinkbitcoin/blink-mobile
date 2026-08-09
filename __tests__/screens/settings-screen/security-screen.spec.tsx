import React from "react"
import { fireEvent, render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"
import { SecurityScreen } from "@app/screens/settings-screen/security-screen"
import { PersistentStateContext } from "@app/store/persistent-state"
import { PersistentState } from "@app/store/persistent-state/state-migrations"

jest.mock("react-native-reanimated", () => {
  const RNView = jest.requireActual<typeof import("react-native")>("react-native").View
  return {
    __esModule: true,
    default: {
      View: RNView,
      createAnimatedComponent: (component: React.ComponentType) => component,
    },
    useSharedValue: (initial: number) => ({ value: initial }),
    useAnimatedStyle: () => ({}),
    withTiming: (value: number) => value,
    interpolateColor: () => "transparent",
    View: RNView,
  }
})

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: jest.fn(),
}))

// Native module, untranspiled ESM under jest — the screen only imports it for biometrics.
jest.mock("@app/utils/biometricAuthentication", () => ({
  __esModule: true,
  default: {
    isSensorAvailable: jest.fn().mockResolvedValue(false),
    authenticate: jest.fn(),
  },
}))

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    getIsBiometricsEnabled: jest.fn().mockResolvedValue(false),
    getIsPinEnabled: jest.fn().mockResolvedValue(false),
  },
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      common: { switch: () => "switch" },
      SecurityScreen: {
        biometricTitle: () => "Biometric",
        biometricDescription: () => "Biometric description",
        pinTitle: () => "PIN code",
        pinDescription: () => "PIN description",
        hideBalanceTitle: () => "Always hide balance",
      },
    },
  }),
}))

const baseState: PersistentState = {
  schemaVersion: 16,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
}

const renderScreen = (initialState: PersistentState = baseState) => {
  const updateState = jest.fn()

  const Harness: React.FC = () => {
    const [persistentState, setPersistentState] = React.useState(initialState)

    return (
      <PersistentStateContext.Provider
        value={{
          persistentState,
          updateState: (update) => {
            updateState(update)
            setPersistentState((prev) => update(prev) ?? prev)
          },
          resetState: jest.fn(),
        }}
      >
        <ThemeProvider theme={theme}>
          <SecurityScreen
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            navigation={{ navigate: jest.fn() } as any}
            route={
              {
                params: { mIsBiometricsEnabled: false, mIsPinEnabled: false },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
              } as any
            }
          />
        </ThemeProvider>
      </PersistentStateContext.Provider>
    )
  }

  return { updateState, ...render(<Harness />) }
}

describe("SecurityScreen — always hide balance", () => {
  it("reflects the stored setting", () => {
    const { getByTestId } = renderScreen({ ...baseState, alwaysHideBalance: true })

    expect(
      getByTestId("always-hide-balance-switch").props.accessibilityState.checked,
    ).toBe(true)
  })

  it("is off when nothing is stored", () => {
    const { getByTestId } = renderScreen()

    expect(
      getByTestId("always-hide-balance-switch").props.accessibilityState.checked,
    ).toBe(false)
  })

  it("persists the setting and follows the stored value, not a local copy", () => {
    const { getByTestId, updateState } = renderScreen()

    fireEvent(getByTestId("always-hide-balance-switch"), "pressIn")

    expect(updateState).toHaveBeenCalledTimes(1)
    expect(updateState.mock.calls[0][0](baseState)).toEqual(
      expect.objectContaining({ alwaysHideBalance: true }),
    )
    expect(
      getByTestId("always-hide-balance-switch").props.accessibilityState.checked,
    ).toBe(true)
  })

  it("turns the setting back off", () => {
    const { getByTestId, updateState } = renderScreen({
      ...baseState,
      alwaysHideBalance: true,
    })

    fireEvent(getByTestId("always-hide-balance-switch"), "pressIn")

    expect(updateState.mock.calls[0][0](baseState)).toEqual(
      expect.objectContaining({ alwaysHideBalance: false }),
    )
    expect(
      getByTestId("always-hide-balance-switch").props.accessibilityState.checked,
    ).toBe(false)
  })
})
