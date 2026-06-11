import { TranslationFunctions } from "../../../app/i18n/i18n-types"
import { timeout } from "./config"
import { tap } from "./controls"

export const waitForSettingsScreen = async (LL: TranslationFunctions) => {
  const el = element(by.text(LL.SettingsScreen.addressScreen()))
  await waitFor(el)
    .toBeVisible()
    .withTimeout(timeout * 3)
}

export const waitForAccountScreen = async (LL: TranslationFunctions) => {
  const el = element(by.text(LL.AccountScreen.accountId()))
  await waitFor(el)
    .toBeVisible()
    .withTimeout(timeout * 3)
}

export const waitForHomeScreen = async (LL: TranslationFunctions) => {
  const el = element(by.id(LL.HomeScreen.myAccounts()))
  await waitFor(el)
    .toBeVisible()
    .withTimeout(timeout * 3)
}

export const setLocalAndLoginWithAccessToken = async (
  accessToken: string,
  LL: TranslationFunctions,
) => {
  const buildBtn = element(by.id("logo-button"))
  await waitFor(buildBtn)
    .toBeVisible()
    // Wait for 5 mins because metro bundler might not finish sync
    .withTimeout(5 * 600000)
  await buildBtn.multiTap(5)

  const logoutBtn = element(by.id("logout button"))
  await waitFor(logoutBtn).toBeVisible().withTimeout(timeout)

  const accessTokenInput = element(by.id("Input access token"))
  const developerScreenSV = by.id("developer-screen-scroll-view")

  await waitFor(accessTokenInput)
    .toBeVisible()
    .whileElement(developerScreenSV)
    .scroll(400, "down", NaN, 0.85)

  const envBtn = element(by.id("Local Button"))
  await envBtn.tap()

  await accessTokenInput.clearText()
  await accessTokenInput.typeText(accessToken + "\n")

  const saveChangesBtn = element(by.id("Save Changes"))
  await saveChangesBtn.tap()

  const localInstanceText = element(by.text(`Galoy Instance: Local`))
  await waitFor(localInstanceText)
    .toBeVisible()
    .whileElement(developerScreenSV)
    .scroll(100, "up", NaN, 0.85)

  await device.pressBack()

  // Sometimes prompt to save password to keychain appears which need to be dismissed
  await device.sendToHome()
  await device.launchApp({ newInstance: false })

  await tap(by.id(LL.GetStartedScreen.exploreWallet()))

  const balanceHeader = element(by.id("balance-header"))
  await waitFor(balanceHeader)
    .toBeVisible()
    .withTimeout(timeout * 3)

  await device.setURLBlacklist([".*127.0.0.1.*", ".*localhost.*"])
}
