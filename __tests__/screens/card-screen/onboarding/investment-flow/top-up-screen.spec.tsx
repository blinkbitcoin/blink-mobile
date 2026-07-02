import React from "react"
import { render, act, fireEvent } from "@testing-library/react-native"
import { FlatList, ViewToken } from "react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { TopUpScreen } from "@app/screens/card-screen/onboarding/investment-flow"
import { MOCK_QR_ITEMS } from "@app/screens/card-screen/onboarding/onboarding-mock-data"
import { ContextForScreen } from "../../../helper"

jest.mock("@react-native-community/blur", () => ({
  BlurView: "BlurView",
}))

jest.mock("react-native-linear-gradient", () => ({
  LinearGradient: "LinearGradient",
}))

jest.mock("react-native-qrcode-svg", () => {
  const { View } = jest.requireActual("react-native")
  return {
    __esModule: true,
    default: (props: { value: string }) => <View testID={`qrcode-${props.value}`} />,
  }
})

jest.mock("react-native-vector-icons/Ionicons", () => {
  const { Text } = jest.requireActual("react-native")
  return {
    __esModule: true,
    default: (props: { name: string }) => <Text>{props.name}</Text>,
  }
})

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

const [firstQr, secondQr] = MOCK_QR_ITEMS

const asViewToken = (index: number | null): ViewToken =>
  ({ item: null, key: `${index}`, index, isViewable: true }) as ViewToken

const renderScreen = async () => {
  const utils = render(
    <ContextForScreen>
      <TopUpScreen />
    </ContextForScreen>,
  )
  await act(async () => {})
  return utils
}

const changeViewableItems = (utils: ReturnType<typeof render>, tokens: ViewToken[]) => {
  const flatList = utils.UNSAFE_getByType(FlatList)
  act(() => {
    flatList.props.onViewableItemsChanged?.({ viewableItems: tokens, changed: [] })
  })
}

describe("TopUpScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
  })

  it("renders without crashing", async () => {
    const { toJSON } = await renderScreen()
    expect(toJSON()).toBeTruthy()
  })

  it("displays instruction text with min amount", async () => {
    const { getByText } = await renderScreen()
    expect(getByText(/Top-up minimum of \$999/)).toBeTruthy()
  })

  it("displays Copy button", async () => {
    const { getByText } = await renderScreen()
    expect(getByText("Copy")).toBeTruthy()
  })

  it("displays Share button", async () => {
    const { getByText } = await renderScreen()
    expect(getByText("Share")).toBeTruthy()
  })

  it("displays BTC currency badge", async () => {
    const { getByText } = await renderScreen()
    expect(getByText("BTC")).toBeTruthy()
  })

  it("shows the first address by default", async () => {
    const { getByText } = await renderScreen()
    expect(getByText(firstQr.address)).toBeTruthy()
  })

  it("shows the newly viewable address when the carousel scrolls", async () => {
    const utils = await renderScreen()
    changeViewableItems(utils, [asViewToken(1)])
    expect(utils.getByText(secondQr.address)).toBeTruthy()
  })

  it("falls back to the first address when the viewable index is missing", async () => {
    const utils = await renderScreen()
    changeViewableItems(utils, [asViewToken(1)])
    changeViewableItems(utils, [asViewToken(null)])
    expect(utils.getByText(firstQr.address)).toBeTruthy()
  })

  it("keeps the current address when no items are viewable", async () => {
    const utils = await renderScreen()
    changeViewableItems(utils, [asViewToken(1)])
    changeViewableItems(utils, [])
    expect(utils.getByText(secondQr.address)).toBeTruthy()
  })

  it("hides the address when the viewable index has no matching item", async () => {
    const utils = await renderScreen()
    changeViewableItems(utils, [asViewToken(5)])
    expect(utils.queryByText(firstQr.address)).toBeNull()
    expect(utils.queryByText(secondQr.address)).toBeNull()
  })

  it("runs the copy action when the Copy button is pressed", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {})
    const { getByText } = await renderScreen()
    fireEvent.press(getByText("Copy"))
    expect(logSpy).toHaveBeenCalled()
    logSpy.mockRestore()
  })

  it("runs the share action when the Share button is pressed", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {})
    const { getByText } = await renderScreen()
    fireEvent.press(getByText("Share"))
    expect(logSpy).toHaveBeenCalled()
    logSpy.mockRestore()
  })
})
