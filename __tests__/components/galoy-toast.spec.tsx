import React from "react"
import { Platform, StyleSheet, TextStyle } from "react-native"
import { ReactTestInstance } from "react-test-renderer"
import { fireEvent, render } from "@testing-library/react-native"
import { createTheme, ThemeProvider } from "@rn-vui/themed"

import { GaloyToast } from "@app/components/galoy-toast/galoy-toast"
import { dark, light } from "@app/rne-theme/colors"
import theme from "@app/rne-theme/theme"

const mockWindow = { width: 360, height: 800, scale: 2, fontScale: 1 }
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => mockWindow,
}))

type ToastRenderer = (params: {
  text1?: string
  text2?: string
  onPress?: () => void
  hide?: () => void
}) => React.ReactNode

const mockToastProps: {
  config?: Record<string, ToastRenderer>
  topOffset?: number
} = {}

jest.mock("react-native-toast-message", () => {
  const { View } = jest.requireActual("react-native")
  const MockToast = (props: {
    config: Record<string, ToastRenderer>
    topOffset: number
  }) => {
    mockToastProps.config = props.config
    mockToastProps.topOffset = props.topOffset
    return <View testID="toast" />
  }
  MockToast.show = jest.fn()
  MockToast.hide = jest.fn()

  return { __esModule: true, default: MockToast }
})

const mockInsets = { top: 24, bottom: 0, left: 0, right: 0 }
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => mockInsets,
}))

jest.mock("@app/components/atomic/galoy-icon", () => {
  const { View } = jest.requireActual("react-native")
  return {
    __esModule: true,
    GaloyIcon: (props: { name: string; color: string; size: number }) => (
      <View testID="toast-icon" {...props} />
    ),
  }
})

const MESSAGE = "Address copied"

const renderToast = (
  type: string,
  mode: "light" | "dark" = "dark",
  params: { text1?: string; text2?: string } = { text1: "Title", text2: MESSAGE },
) => {
  render(<GaloyToast />)
  return render(
    // The production theme, so its Text config (font family, type scale weights)
    // applies exactly as it does in the app.
    <ThemeProvider theme={createTheme({ ...theme, mode })}>
      {mockToastProps.config?.[type](params)}
    </ThemeProvider>,
  )
}

const flatStyle = (element: ReactTestInstance): TextStyle =>
  StyleSheet.flatten(element.props.style)

describe("GaloyToast", () => {
  const platform = Platform.OS

  beforeEach(() => {
    mockInsets.top = 24
    mockInsets.left = 0
    mockInsets.right = 0
    mockWindow.width = 360
    Platform.OS = platform
  })

  afterAll(() => {
    Platform.OS = platform
  })

  it("renders without crashing", () => {
    const { getByTestId } = render(<GaloyToast />)
    expect(getByTestId("toast")).toBeTruthy()
  })

  it("registers a renderer for success, error and warning", () => {
    render(<GaloyToast />)
    expect(Object.keys(mockToastProps.config ?? {}).sort()).toEqual([
      "error",
      "success",
      "warning",
    ])
  })

  describe("top offset", () => {
    const cases = [
      { device: "no inset", top: 0, expected: 40 },
      { device: "Android status bar", top: 24, expected: 64 },
      { device: "iPhone Dynamic Island", top: 59, expected: 99 },
    ]

    cases.forEach(({ device, top, expected }) => {
      it(`sits 40 below the safe-area inset (${device})`, () => {
        mockInsets.top = top
        render(<GaloyToast />)
        expect(mockToastProps.topOffset).toBe(expected)
      })
    })
  })

  it("does not add the status bar again inside an Android modal", () => {
    mockInsets.top = 24
    Platform.OS = "android"
    render(<GaloyToast inModal />)
    expect(mockToastProps.topOffset).toBe(40)
  })

  it("pulls a modal toast out to the window so the inset is not the modal's percent margin", () => {
    const { getByTestId } = render(<GaloyToast inModal />)

    expect(flatStyle(getByTestId("toast-host"))).toMatchObject({
      position: "absolute",
      top: -18,
      left: -18,
      right: -18,
      bottom: -18,
    })
    expect(getByTestId("toast-host").props.pointerEvents).toBe("box-none")
  })

  it("dismisses when the row is pressed", () => {
    const hide = jest.fn()
    const onPress = jest.fn()
    render(<GaloyToast />)
    const { getByTestId } = render(
      <ThemeProvider theme={createTheme({ ...theme, mode: "dark" })}>
        {mockToastProps.config?.success({
          text1: "Title",
          text2: MESSAGE,
          hide,
          onPress,
        })}
      </ThemeProvider>,
    )

    fireEvent.press(getByTestId("toast-success"))

    expect(onPress).toHaveBeenCalledTimes(1)
    expect(hide).toHaveBeenCalledTimes(1)
  })

  it("caps and centres the row on a tablet", () => {
    mockWindow.width = 768
    render(<GaloyToast />)
    const { getByTestId } = render(
      <ThemeProvider theme={createTheme({ ...theme, mode: "dark" })}>
        {mockToastProps.config?.success({ text1: "Title", text2: MESSAGE })}
      </ThemeProvider>,
    )

    expect(flatStyle(getByTestId("toast-success"))).toMatchObject({
      marginLeft: 144,
      marginRight: 144,
    })
  })

  const variants = [
    { type: "success", icon: "check-circle", accent: "_green" },
    { type: "error", icon: "warning-circle", accent: "red" },
    { type: "warning", icon: "warning", accent: "warning" },
  ] as const

  variants.forEach(({ type, icon, accent }) => {
    describe(`${type} toast`, () => {
      it("renders the message as a row with no title", () => {
        const { getByTestId, getByText, queryByText } = renderToast(type)

        expect(getByTestId(`toast-${type}`)).toBeTruthy()
        expect(getByText(MESSAGE)).toBeTruthy()
        expect(queryByText("Title")).toBeNull()
      })

      it("announces the title and message as one alert", () => {
        const { getByTestId } = renderToast(type)
        const row = getByTestId(`toast-${type}`)

        expect(row.props.accessible).toBe(true)
        expect(row.props.accessibilityRole).toBe("alert")
        expect(row.props.accessibilityLabel).toBe(`Title. ${MESSAGE}`)
      })

      it("shows the title when the message is empty", () => {
        const { getByTestId, getByText } = renderToast(type, "dark", {
          text1: "Title",
          text2: "",
        })

        expect(getByText("Title")).toBeTruthy()
        expect(getByTestId(`toast-${type}`).props.accessibilityLabel).toBe("Title")
      })

      it("shows the whole message without a line limit", () => {
        const { getByText } = renderToast(type)

        expect(getByText(MESSAGE).props.numberOfLines).toBeUndefined()
      })

      it("wraps a long message inside the row instead of running past the border", () => {
        const { getByText } = renderToast(type)

        expect(flatStyle(getByText(MESSAGE)).flex).toBe(1)
      })

      it("drops Android font padding so the message centres on the icon", () => {
        const { getByText } = renderToast(type)

        expect(flatStyle(getByText(MESSAGE)).includeFontPadding).toBe(false)
      })

      it(`uses the ${icon} icon at 18, in the accent colour`, () => {
        const { getByTestId } = renderToast(type)
        const iconElement = getByTestId("toast-icon")

        expect(iconElement.props.name).toBe(icon)
        expect(iconElement.props.size).toBe(18)
        expect(iconElement.props.color).toBe(dark[accent])
      })

      it("draws the row with its geometry, border and background", () => {
        const { getByTestId } = renderToast(type)

        expect(flatStyle(getByTestId(`toast-${type}`))).toMatchObject({
          flexDirection: "row",
          alignItems: "center",
          alignSelf: "stretch",
          gap: 12,
          marginLeft: 20,
          marginRight: 20,
          paddingHorizontal: 12,
          paddingVertical: 14,
          borderWidth: 1,
          borderRadius: 8,
          borderColor: dark[accent],
          backgroundColor: dark.grey7,
        })
      })

      it("always sets the message in Source Sans Pro Bold, without a synthesised weight", () => {
        const { getByText } = renderToast(type)
        const style = flatStyle(getByText(MESSAGE))

        expect(style).toMatchObject({
          fontFamily: "SourceSansPro-Bold",
          fontSize: 16,
          lineHeight: 22,
        })
        expect(style.fontWeight).toBeUndefined()
      })

      it("keeps the message in the foreground colour, not the accent", () => {
        const { getByText } = renderToast(type)

        expect(flatStyle(getByText(MESSAGE)).color).toBe(dark.black)
      })

      it("follows the light theme", () => {
        const { getByTestId, getByText } = renderToast(type, "light")

        expect(flatStyle(getByTestId(`toast-${type}`))).toMatchObject({
          backgroundColor: light.grey7,
          borderColor: light[accent],
        })
        expect(getByTestId("toast-icon").props.color).toBe(light[accent])
        expect(flatStyle(getByText(MESSAGE)).color).toBe(light.black)
      })
    })
  })
})
