import React from "react"
import { fireEvent, render, screen } from "@testing-library/react-native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import { getCloudProviderName } from "@app/screens/self-custodial/onboarding/utils"
import { StaleCloudBundleBulletin } from "@app/self-custodial/components/stale-cloud-bundle-bulletin"

import { ContextForScreen } from "../../screens/helper"

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

loadLocale("en")
const LL = i18nObject("en")

const renderBulletin = (onDismiss = jest.fn()) =>
  render(
    <ContextForScreen>
      <StaleCloudBundleBulletin onDismiss={onDismiss} />
    </ContextForScreen>,
  )

describe("StaleCloudBundleBulletin", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("names the cloud the emergency bundle stopped updating in", () => {
    renderBulletin()

    expect(screen.getByText(LL.StaleCloudBundleBulletin.title())).toBeTruthy()
    expect(
      screen.getByText(
        LL.StaleCloudBundleBulletin.body({ provider: getCloudProviderName(LL) }),
      ),
    ).toBeTruthy()
  })

  it("sends the user back to the cloud backup", () => {
    renderBulletin()

    fireEvent.press(screen.getByText(LL.StaleCloudBundleBulletin.cta()))

    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialCloudBackup")
  })
})
