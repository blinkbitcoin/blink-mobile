import "detox"

import { TranslationFunctions } from "../../app/i18n/i18n-types"
import { i18nObject } from "../../app/i18n/i18n-util"
import { loadLocale } from "../../app/i18n/i18n-util.sync"
import { getKratosCode } from "./utils/commandline"
import { waitForAccountScreen, waitForSettingsScreen } from "./utils/common-flows"
import { timeout, ALICE_PHONE, ALICE_EMAIL, otp } from "./utils/config"
import { tap } from "./utils/controls"

export const setLocalEnvironment = async () => {
  const buildBtn = element(by.id("logo-button"))
  await waitFor(buildBtn)
    .toBeVisible()
    // Wait for 5 mins because metro bundler might not finish sync
    .withTimeout(5 * 600000)
  await buildBtn.multiTap(5)

  const logoutBtn = element(by.id("logout button"))
  await waitFor(logoutBtn).toBeVisible().withTimeout(timeout)

  const envBtn = element(by.id("Local Button"))
  const developerScreenSV = by.id("developer-screen-scroll-view")

  await waitFor(envBtn)
    .toBeVisible()
    .whileElement(developerScreenSV)
    .scroll(400, "down", NaN, 0.85)
  await envBtn.tap()

  const saveChangesBtn = element(by.id("Save Changes"))
  await saveChangesBtn.tap()

  const stagingInstanceText = element(by.text(`Galoy Instance: Local`))
  await waitFor(stagingInstanceText).toBeVisible().withTimeout(10000)

  await device.pressBack()
}

export const loginAs = (phone: string, LL: TranslationFunctions) => async () => {
  await tap(by.id(LL.GetStartedScreen.createAccount()))
  await tap(by.id(LL.AcceptTermsAndConditionsScreen.accept()))

  const telephoneInput = element(by.id("telephoneNumber"))
  await waitFor(telephoneInput).toBeVisible().withTimeout(timeout)
  await telephoneInput.clearText()
  await telephoneInput.typeText(phone)
  await tap(by.id(LL.PhoneLoginInitiateScreen.sms()))

  const otpInput = element(by.id("oneTimeCode"))
  try {
    await waitFor(otpInput).toBeVisible().withTimeout(timeout)
    await otpInput.clearText()
    await otpInput.typeText(otp)
  } catch {
    /* empty because sometimes the page just moves to the next page coz 000000 is default */
  }

  await waitFor(element(by.text(LL.HomeScreen.myAccounts())))
    .toBeVisible()
    .withTimeout(timeout)
}

describe("Login/Register Flow", () => {
  loadLocale("en")
  const LL = i18nObject("en")

  beforeAll(async () => {
    await device.launchApp({ newInstance: true })
  })

  it("set environment", setLocalEnvironment)

  it("login as an user", loginAs(ALICE_PHONE, LL))

  it("add an email", async () => {
    await tap(by.id("menu"))
    await tap(by.id(LL.AccountScreen.tapToAddEmail()))

    const emailInput = element(by.id(LL.EmailRegistrationInitiateScreen.placeholder()))
    await waitFor(emailInput).toBeVisible().withTimeout(timeout)
    await emailInput.clearText()
    await emailInput.typeText(ALICE_EMAIL)
    await tap(by.id(LL.EmailRegistrationInitiateScreen.send()))

    const codeInput = element(by.id("code-input"))
    await waitFor(codeInput).toBeVisible().withTimeout(timeout)

    const code = await getKratosCode(ALICE_EMAIL)
    await codeInput.clearText()
    await codeInput.typeText(code)

    await tap(by.text(LL.common.ok()))
  })

  it("logout", async () => {
    await waitForSettingsScreen(LL)
    await tap(by.id(LL.common.account()))
    await waitForAccountScreen(LL)

    const logoutBtn = element(by.id(LL.AccountScreen.logOutAndDeleteLocalData()))
    const accountScreenSV = by.id("account-screen-scroll-view")

    await waitFor(logoutBtn)
      .toBeVisible()
      .whileElement(accountScreenSV)
      .scroll(400, "down", NaN, 0.85)
    await logoutBtn.tap()

    await tap(by.text(LL.AccountScreen.IUnderstand()))
    await tap(by.text(LL.common.ok()))
  })

  it("reset to local environment", setLocalEnvironment)

  it("log back in, with the new email", async () => {
    await tap(by.id("email-button"))

    const emailInput = element(by.id(LL.EmailRegistrationInitiateScreen.placeholder()))
    await waitFor(emailInput).toBeVisible().withTimeout(timeout)
    await emailInput.clearText()
    await emailInput.typeText(ALICE_EMAIL)
    await tap(by.id(LL.EmailRegistrationInitiateScreen.send()))

    const codeInput = element(by.id("code-input"))
    await waitFor(codeInput).toBeVisible().withTimeout(timeout)

    const code = await getKratosCode(ALICE_EMAIL)
    await codeInput.clearText()
    await codeInput.typeText(code)
  })

  it("verify we are in the same account as we started with", async () => {
    await tap(by.id("menu"))

    const phoneNumber = element(by.text(ALICE_PHONE))
    await waitFor(phoneNumber).toBeVisible().withTimeout(timeout)
  })
})
