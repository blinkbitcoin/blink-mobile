import React from "react"

import { fireEvent, render, waitFor } from "@testing-library/react-native"

import { GALOY_INSTANCES, SPARK_EXPLORER_TX_URL } from "@app/config"
import { DeveloperScreen } from "@app/screens/developer-screen/developer-screen"

jest.mock("@rn-vui/themed", () => {
  const ReactActual = jest.requireActual<typeof React>("react")
  const { Pressable } = jest.requireActual("react-native")
  const colors: Record<string, string> = {
    grey3: "#999",
    grey5: "#f5f5f5",
    white: "#fff",
  }
  return {
    makeStyles:
      (
        fn: (
          theme: { colors: Record<string, string> },
          params: Record<string, unknown>,
        ) => Record<string, object>,
      ) =>
      (params: Record<string, unknown> = {}) =>
        fn({ colors }, params),
    Text: ({ children, ...props }: { children: React.ReactNode }) =>
      ReactActual.createElement("Text", props, children),
    Button: ({
      title,
      onPress,
      disabled,
      testID,
    }: {
      title: string
      onPress: () => void
      disabled?: boolean
      testID?: string
    }) =>
      ReactActual.createElement(Pressable, {
        testID: testID ?? title,
        onPress: disabled ? undefined : onPress,
      }),
  }
})

// GaloyInput reduced to a bare TextInput addressable by its label
jest.mock("@app/components/atomic/galoy-input", () => {
  const ReactActual = jest.requireActual<typeof React>("react")
  const { TextInput } = jest.requireActual("react-native")
  return {
    GaloyInput: ({
      label,
      value,
      onChangeText,
    }: {
      label: string
      value: string
      onChangeText: (text: string) => void
    }) => ReactActual.createElement(TextInput, { testID: label, value, onChangeText }),
  }
})

jest.mock("@app/components/screen", () => ({
  Screen: ({ children }: { children: React.ReactNode }) =>
    React.createElement("View", { testID: "screen" }, children),
}))

jest.mock("react-native-in-app-review", () => ({
  isAvailable: () => false,
  RequestInAppReview: jest.fn(),
}))

jest.mock("react-native-inappbrowser-reborn", () => ({
  InAppBrowser: { isAvailable: jest.fn(), open: jest.fn() },
}))

jest.mock("@apollo/client", () => ({
  ...jest.requireActual("@apollo/client"),
  useApolloClient: () => ({}),
}))

jest.mock("@app/components/notifications/test-bulletins-store", () => ({
  testBulletinsStore: { add: jest.fn(), clear: jest.fn() },
  useTestBulletins: () => [],
}))

jest.mock("@app/graphql/client-only-query", () => ({
  activateBeta: jest.fn(),
}))

jest.mock("@app/graphql/generated", () => ({
  useBetaQuery: () => ({ data: { beta: false } }),
  useDebugScreenQuery: () => ({ data: undefined }),
  useLevelQuery: () => ({ data: undefined }),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => true,
}))

const mockSaveTokenAndInstance = jest.fn().mockResolvedValue(undefined)
jest.mock("@app/hooks/use-app-config", () => ({
  useAppConfig: () => ({
    appConfig: {
      token: "current-token",
      galoyInstance: {
        id: "Main",
        name: "Blink",
        graphqlUri: "https://api.blink.sv/graphql",
        graphqlWsUri: "wss://ws.blink.sv/graphql",
        authUrl: "https://api.blink.sv",
        posUrl: "https://pay.blink.sv",
        kycUrl: "https://kyc.blink.sv",
        lnAddressHostname: "blink.sv",
        blockExplorer: "https://mempool.space/tx/",
        sparkExplorer: "https://sparkscan.io/tx/",
        fiatUrl: "https://fiat.blink.sv",
      },
    },
    saveTokenAndInstance: mockSaveTokenAndInstance,
  }),
}))

const mockSaveProfile = jest.fn().mockResolvedValue(undefined)
jest.mock("@app/hooks", () => ({
  usePriceConversion: () => ({ usdPerSat: undefined }),
  useSaveSessionProfile: () => ({ saveProfile: mockSaveProfile }),
}))

const mockLogout = jest.fn().mockResolvedValue(undefined)
jest.mock("@app/hooks/use-logout", () => ({
  __esModule: true,
  default: () => ({ logout: mockLogout }),
}))

jest.mock("@app/utils/notifications", () => ({
  addDeviceToken: jest.fn(),
}))

jest.mock("@app/screens/get-started-screen/use-device-token", () => ({
  __esModule: true,
  default: () => "",
}))

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}))

describe("DeveloperScreen custom instance save", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const fillCustomInstanceAndSave = () => {
    const screen = render(<DeveloperScreen />)

    fireEvent.press(screen.getByTestId("Custom Button"))
    fireEvent.changeText(
      screen.getByTestId("Graphql Uri"),
      "https://api.custom.com/graphql",
    )
    fireEvent.changeText(
      screen.getByTestId("Graphql Ws Uri"),
      "wss://ws.custom.com/graphql",
    )
    fireEvent.changeText(screen.getByTestId("POS Url"), "https://pay.custom.com")
    fireEvent.changeText(screen.getByTestId("Kyc Url"), "https://kyc.custom.com")
    fireEvent.changeText(screen.getByTestId("Fiat Url"), "https://fiat.custom.com")
    fireEvent.changeText(screen.getByTestId("Rest Url"), "https://api.custom.com")
    fireEvent.changeText(screen.getByTestId("LN Address Hostname"), "custom.com")
    fireEvent.press(screen.getByTestId("Save Changes"))

    return screen
  }

  it("saves a Custom instance with the spark explorer preset", async () => {
    fillCustomInstanceAndSave()

    await waitFor(() => {
      expect(mockSaveTokenAndInstance).toHaveBeenCalledTimes(1)
    })

    expect(mockSaveTokenAndInstance).toHaveBeenCalledWith({
      instance: {
        id: "Custom",
        name: "Custom",
        graphqlUri: "https://api.custom.com/graphql",
        graphqlWsUri: "wss://ws.custom.com/graphql",
        authUrl: "https://api.custom.com",
        posUrl: "https://pay.custom.com",
        kycUrl: "https://kyc.custom.com",
        fiatUrl: "https://fiat.custom.com",
        lnAddressHostname: "custom.com",
        blockExplorer: "https://mempool.space/tx/",
        sparkExplorer: SPARK_EXPLORER_TX_URL,
      },
      token: "",
    })
  })

  it("saves a standard instance straight from GALOY_INSTANCES", async () => {
    const screen = render(<DeveloperScreen />)

    fireEvent.press(screen.getByTestId("Staging Button"))
    fireEvent.press(screen.getByTestId("Save Changes"))

    await waitFor(() => {
      expect(mockSaveTokenAndInstance).toHaveBeenCalledTimes(1)
    })

    expect(mockSaveTokenAndInstance).toHaveBeenCalledWith({
      instance: GALOY_INSTANCES.find((instance) => instance.id === "Staging"),
      token: "",
    })
  })
})
