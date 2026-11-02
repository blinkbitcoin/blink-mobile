import "detox"

import { i18nObject } from "../../app/i18n/i18n-util"
import { loadLocale } from "../../app/i18n/i18n-util.sync"
import {
  getExternalLNNoAmountInvoice,
  getLnInvoiceForBob,
  getOnchainAddress,
} from "./utils/commandline"
import { setLocalAndLoginWithAccessToken, waitForHomeScreen } from "./utils/common-flows"
import { timeout, BOB_USERNAME, ALICE_TOKEN } from "./utils/config"
import { addAmount, tap, verifyTextPresent, sleep, slideSlider } from "./utils/controls"

loadLocale("en")
const LL = i18nObject("en")

// Make sure all tests in this file reset back to home screen because tests reuse same session in this file
beforeAll(async () => {
  await device.launchApp({ newInstance: true })
  await setLocalAndLoginWithAccessToken(ALICE_TOKEN, LL)
})

describe("Send: Intraledger using Username - BTC Amount", () => {
  it("send btc to bob using his username", async () => {
    await tap(by.id(LL.HomeScreen.send()))

    const usernameInput = element(by.id(LL.SendBitcoinScreen.placeholder()))
    await waitFor(usernameInput).toBeVisible().withTimeout(timeout)
    await usernameInput.clearText()
    await usernameInput.typeText(BOB_USERNAME)
    await tap(by.id(LL.common.next()), 3)

    try {
      await tap(by.id("address-is-right"))
      await tap(
        by.id(LL.SendBitcoinDestinationScreen.confirmUsernameModal.confirmButton()),
      )
    } catch {
      /* If this was not the first time that the tests were run, 
         then the address is right popup modal won't appear */
    }

    await addAmount("0.02", LL)
    await tap(by.id(LL.common.next()))

    await slideSlider()
    await sleep(3000)

    await tap(by.id(LL.common.back()))
    await waitForHomeScreen(LL)
  })

  it("check if latest transaction has been updated", async () => {
    const tx = element(by.id(`transaction-by-index-0`))
    await waitFor(tx)
      .toBeVisible()
      .withTimeout(timeout * 10)
    await tx.tap()

    await verifyTextPresent(LL.TransactionDetailScreen.sent())
    await verifyTextPresent("-$0.02")

    await tap(by.id("close"))
    await waitForHomeScreen(LL)
  })
})

describe("Send: Intraledger using Username - USD Amount", () => {
  it("send btc to bob using his username", async () => {
    await tap(by.id(LL.HomeScreen.send()))

    const usernameInput = element(by.id(LL.SendBitcoinScreen.placeholder()))
    await waitFor(usernameInput).toBeVisible().withTimeout(timeout)
    await usernameInput.clearText()
    await usernameInput.typeText(BOB_USERNAME)
    await tap(by.id(LL.common.next()), 3)

    try {
      await tap(by.id("address-is-right"))
      await tap(
        by.id(LL.SendBitcoinDestinationScreen.confirmUsernameModal.confirmButton()),
      )
    } catch {
      /* If this was not the first time that the tests were run, 
         then the address is right popup modal won't appear */
    }

    await tap(by.id("choose-wallet-to-send-from"))
    await tap(by.id("USD"))

    await addAmount("0.02", LL)
    await tap(by.id(LL.common.next()))

    await slideSlider()
    await sleep(3000)

    await tap(by.id(LL.common.back()))
    await waitForHomeScreen(LL)
  })

  it("check if latest transaction has been updated", async () => {
    const tx = element(by.id(`transaction-by-index-0`))
    await waitFor(tx)
      .toBeVisible()
      .withTimeout(timeout * 10)
    await tx.tap()

    await verifyTextPresent(LL.TransactionDetailScreen.sent())
    await verifyTextPresent("-$0.02")

    await tap(by.id("close"))
    await waitForHomeScreen(LL)
  })
})

describe("Send: Intraledger using LN Invoice", () => {
  it("send btc to bob using his ln invoice", async () => {
    await tap(by.id(LL.HomeScreen.send()))

    const invoice = await getLnInvoiceForBob()

    const invoiceInput = element(by.id(LL.SendBitcoinScreen.placeholder()))
    await waitFor(invoiceInput).toBeVisible().withTimeout(timeout)
    await invoiceInput.clearText()
    await invoiceInput.typeText(invoice)
    await tap(by.id(LL.common.next()))

    await addAmount("0.02", LL)

    // some bug
    await device.disableSynchronization()
    await tap(by.id(LL.common.next()))
    await device.enableSynchronization()

    await slideSlider()
    await sleep(3000)

    await tap(by.id(LL.common.back()))
    await waitForHomeScreen(LL)
  })

  it("check if latest transaction has been updated", async () => {
    const tx = element(by.id(`transaction-by-index-0`))
    await waitFor(tx)
      .toBeVisible()
      .withTimeout(timeout * 10)
    await tx.tap()

    await verifyTextPresent(LL.TransactionDetailScreen.sent())
    await verifyTextPresent("-$0.02")

    await tap(by.id("close"))
    await waitForHomeScreen(LL)
  })
})

describe("Send: to External LN Invoice", () => {
  it("send btc to an external invoice taken from lnd-outside-1", async () => {
    await tap(by.id(LL.HomeScreen.send()))

    const invoice = await getExternalLNNoAmountInvoice()

    const invoiceInput = element(by.id(LL.SendBitcoinScreen.placeholder()))
    await waitFor(invoiceInput).toBeVisible().withTimeout(timeout)
    await invoiceInput.clearText()
    await invoiceInput.typeText(invoice)
    await tap(by.id(LL.common.next()))

    await addAmount("0.02", LL)
    await tap(by.id(LL.common.next()))

    await slideSlider()
    await sleep(3000)

    await tap(by.id(LL.common.back()))
    await waitForHomeScreen(LL)
  })

  it("check if latest transaction has been updated", async () => {
    const tx = element(by.id(`transaction-by-index-0`))
    await waitFor(tx)
      .toBeVisible()
      .withTimeout(timeout * 10)
    await tx.tap()

    await verifyTextPresent(LL.TransactionDetailScreen.sent())

    await tap(by.id("close"))
    await waitForHomeScreen(LL)
  })
})

describe("Send: to Onchain Address", () => {
  it("send btc to an onchain address from bitcoind", async () => {
    await tap(by.id(LL.HomeScreen.send()))

    const address = await getOnchainAddress()

    const addressInput = element(by.id(LL.SendBitcoinScreen.placeholder()))
    await waitFor(addressInput).toBeVisible().withTimeout(timeout)
    await addressInput.clearText()
    await addressInput.typeText(address)
    await tap(by.id(LL.common.next()))

    await addAmount("25.0", LL)
    await tap(by.id(LL.common.next()))

    await slideSlider()
    await sleep(3000)

    await tap(by.id(LL.common.back()))
    await waitForHomeScreen(LL)
  })

  it("check if latest transaction has been updated", async () => {
    const tx = element(by.id(`transaction-by-index-0`))
    await waitFor(tx)
      .toBeVisible()
      .withTimeout(timeout * 10)
    await tx.tap()

    // can take a bit of time for tx to be confirmed
    await verifyTextPresent(LL.TransactionDetailScreen.sent(), timeout * 30)

    await tap(by.id("close"))
    await waitForHomeScreen(LL)
  })
})
