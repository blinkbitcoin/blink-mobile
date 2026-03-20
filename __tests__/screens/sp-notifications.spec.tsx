import React from "react"
import { fireEvent, render, screen } from "@testing-library/react-native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import { NotificationSetting } from "@app/screens/settings-screen/settings/sp-notifications"

import { ContextForScreen } from "./helper"

let mockedQueryResult: Record<string, unknown> = {}

const buildQueryResult = (disabledCategories: string[]) => ({
  data: {
    me: {
      defaultAccount: {
        notificationSettings: {
          push: {
            enabled: true,
            disabledCategories,
          },
        },
      },
    },
  },
})

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useNotificationSettingsQuery: jest.fn(() => mockedQueryResult),
}))

jest.mock("@app/hooks/use-app-config", () => ({
  useAppConfig: () => ({
    appConfig: {
      galoyInstance: { lnAddressHostname: "blink.sv", name: "Blink" },
    },
  }),
}))

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}))

describe("NotificationSetting", () => {
  let LL: ReturnType<typeof i18nObject>

  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
    LL = i18nObject("en")
    mockedQueryResult = buildQueryResult([])
  })

  it("shows 'All' when no categories are disabled", () => {
    mockedQueryResult = buildQueryResult([])

    render(
      <ContextForScreen>
        <NotificationSetting />
      </ContextForScreen>,
    )

    expect(
      screen.getByText(
        `${LL.common.notifications()}: ${LL.NotificationSettingsScreen.statusAll()}`,
      ),
    ).toBeTruthy()
  })

  it("shows 'None' when all categories are disabled", () => {
    mockedQueryResult = buildQueryResult(["Payments", "Circles", "Price", "Marketing"])

    render(
      <ContextForScreen>
        <NotificationSetting />
      </ContextForScreen>,
    )

    expect(
      screen.getByText(
        `${LL.common.notifications()}: ${LL.NotificationSettingsScreen.statusNone()}`,
      ),
    ).toBeTruthy()
  })

  it("shows 'Some' when only some categories are disabled", () => {
    mockedQueryResult = buildQueryResult(["Marketing"])

    render(
      <ContextForScreen>
        <NotificationSetting />
      </ContextForScreen>,
    )

    expect(
      screen.getByText(
        `${LL.common.notifications()}: ${LL.NotificationSettingsScreen.statusSome()}`,
      ),
    ).toBeTruthy()
  })

  it("shows 'All' when query data is unavailable", () => {
    mockedQueryResult = { data: undefined }

    render(
      <ContextForScreen>
        <NotificationSetting />
      </ContextForScreen>,
    )

    expect(
      screen.getByText(
        `${LL.common.notifications()}: ${LL.NotificationSettingsScreen.statusAll()}`,
      ),
    ).toBeTruthy()
  })

  it("navigates to notificationSettingsScreen on press", () => {
    mockedQueryResult = buildQueryResult([])

    render(
      <ContextForScreen>
        <NotificationSetting />
      </ContextForScreen>,
    )

    fireEvent.press(
      screen.getByText(
        `${LL.common.notifications()}: ${LL.NotificationSettingsScreen.statusAll()}`,
      ),
    )

    expect(mockNavigate).toHaveBeenCalledWith("notificationSettingsScreen")
  })
})
