import { i18nObject } from "../app/i18n/i18n-util"
import { loadLocale } from "../app/i18n/i18n-util.sync"
import {
  clickBackButton,
  clickButton,
  clickIcon,
  waitTillOnHomeScreen,
  waitTillTextDisplayed,
  checkContact,
  selector,
  addSmallAmount,
  swipeButton,
} from "./utils"

loadLocale("en")
const LL = i18nObject("en")
const timeout = 30000

describe("Validate Username Flow", () => {
  const username = "unclesamtoshi"
  const lnAddress = "unclesamtoshi@pay.staging.blink.sv"

  it("Click Send", async () => {
    await clickIcon(LL.HomeScreen.send())
  })

  it("Paste Username", async () => {
    const usernameInput = await $(
      selector(LL.SendBitcoinScreen.placeholder(), "Other", "[1]"),
    )
    await usernameInput.waitForDisplayed({ timeout })
    await usernameInput.click()
    await usernameInput.setValue(username)
    await clickButton(LL.common.next())
  })

  it("Confirm Username", async () => {
    // Some kind of bug with the component
    const selectorValue =
      process.env.E2E_DEVICE === "ios"
        ? `${LL.SendBitcoinDestinationScreen.confirmUsernameModal.checkBox({
            lnAddress,
          })} ${LL.SendBitcoinDestinationScreen.confirmUsernameModal.checkBox({
            lnAddress,
          })}`
        : LL.SendBitcoinDestinationScreen.confirmUsernameModal.checkBox({ lnAddress })
    const checkBoxButton = await $(selector(selectorValue, "Other"))
    await checkBoxButton.waitForEnabled({ timeout })
    await checkBoxButton.click()

    const { isContactAvailable } = await checkContact(username)
    expect(isContactAvailable).toBe(false)

    await clickButton(
      LL.SendBitcoinDestinationScreen.confirmUsernameModal.confirmButton(),
    )
    await waitTillTextDisplayed(LL.SendBitcoinScreen.amount())
    await clickBackButton()
    await waitTillTextDisplayed(LL.SendBitcoinScreen.destination())
  })

  it("Go back home", async () => {
    await clickBackButton()
    await waitTillOnHomeScreen()
  })
})

describe("Username Payment Flow", () => {
  const username = "galoytest"

  it("Click Send", async () => {
    await clickIcon(LL.HomeScreen.send())
  })

  it("Paste Username", async () => {
    const usernameInput = await $(
      selector(LL.SendBitcoinScreen.placeholder(), "Other", "[1]"),
    )
    await usernameInput.waitForDisplayed({ timeout })
    await usernameInput.click()
    await usernameInput.setValue(username)
  })

  it("Click Next", async () => {
    const { isContactAvailable } = await checkContact(username)
    expect(isContactAvailable).toBeTruthy()

    await clickButton(LL.common.next())
  })

  it("Wallet contains balances", async () => {
    const btcWalletBalance = await $(selector("BTC Wallet Balance", "StaticText"))
    await btcWalletBalance.waitForDisplayed({ timeout })
    expect(btcWalletBalance).toBeDisplayed()
    const btcWalletBalanceInUsdValue = await btcWalletBalance.getText()
    expect(btcWalletBalanceInUsdValue).toHaveText(
      new RegExp(
        "^\\$\\d{1,3}(,\\d{3})*(\\.\\d{1,2})?\\s\\(\\d{1,3}(,\\d{3})*\\ssats\\)$",
      ),
    )
  })

  it("Add amount", async () => {
    await addSmallAmount(LL)
  })

  it("Click Next again", async () => {
    await clickButton(LL.common.next())
  })

  it("Slides to confirm payment and get Green Checkmark success", async () => {
    await swipeButton(LL.SendBitcoinConfirmationScreen.slideToConfirm())
  })

  it("Clicks on not enjoying app", async () => {
    await browser.pause(3000)
    const contexts = await browser.getContexts()
    const nativeContext = contexts.find((context) =>
      context.toString().toLowerCase().includes("native"),
    )
    await browser.pause(3000)
    if (nativeContext) {
      await browser.switchContext(nativeContext.toString())
    }

    if (process.env.E2E_DEVICE === "android") {
      await driver.back()
    }

    const appContext = contexts.find((context) =>
      context.toString().toLowerCase().includes("webview"),
    )
    if (appContext) {
      await browser.switchContext(appContext.toString())
    }
  })

  it("Checks for suggestion modal and skips", async () => {
    const suggestionInput = await $(
      selector(LL.SendBitcoinScreen.suggestionInput(), "TextView"),
    )

    try {
      await suggestionInput.waitForDisplayed({ timeout })
      await suggestionInput.click()
      await suggestionInput.setValue("e2e test suggestion")
      await clickButton(LL.AuthenticationScreen.skip())

      // FIXME: this is a bug. we should not have to double tap here.
      await browser.pause(1000)
      await clickButton(LL.AuthenticationScreen.skip())
    } catch {
      // Sometimes the suggestion box is not displayed so it's okay to ignore
    }
  })
})

describe("Conversion Flow", () => {
  if (process.env.E2E_DEVICE === "ios") {
    return
  }

  it("Click on Transfer Button", async () => {
    await clickIcon(LL.ConversionDetailsScreen.title())
  })

  it("Add amount", async () => {
    await addSmallAmount(LL)
  })

  it("Click Next", async () => {
    await clickButton(LL.common.next())
  })

  it("Click on Convert", async () => {
    await clickButton(LL.common.convert())
  })

  it("Get Green Checkmark Success Icon and Navigate to HomeScreen", async () => {
    await waitTillOnHomeScreen()
  })
})
