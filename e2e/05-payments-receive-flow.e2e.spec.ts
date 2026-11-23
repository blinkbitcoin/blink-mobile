/* eslint-disable jest/no-disabled-tests */
import jimp from "jimp"
import jsQR from "jsqr"

import { i18nObject } from "../app/i18n/i18n-util"
import { loadLocale } from "../app/i18n/i18n-util.sync"
import {
  enter2CentsIntoNumberPad,
  scrollDown,
  selector,
  clickBackButton,
  clickButton,
  clickIcon,
  payAmountInvoice,
  payNoAmountInvoice,
  clickPressable,
  waitTillPressableDisplayed,
  waitTillOnHomeScreen,
  scrollUp,
  clickByTestId,
  testIdSelector,
} from "./utils"

loadLocale("en")
const LL = i18nObject("en")
const timeout = 30000

describe("Receive BTC Amount Payment Flow", () => {
  let invoice: string
  const memo = "memo"

  it("Click Receive", async () => {
    await clickIcon(LL.HomeScreen.receive())
  })

  it("Click Request Specific Amount", async () => {
    await waitTillPressableDisplayed("Amount Input Button")
    await clickPressable("Amount Input Button")

    // we need to wait for the notifications permissions pop up
    // and click allow before we can continue
    await browser.pause(4000)
  })

  it("Enter Amount", async () => {
    await enter2CentsIntoNumberPad(LL)
  })

  it("Checks that the invoice is updated", async () => {
    const lnInvoiceReadableText = await $(selector("readable-payment-request", "Other"))
    await lnInvoiceReadableText.waitForDisplayed({ timeout })
    expect(lnInvoiceReadableText).toBeDisplayed()
  })

  it("clicks on set a note button", async () => {
    await scrollDown()
    await clickByTestId("add-note")
  })

  it("sets a memo or note", async () => {
    const memoInput = await $(testIdSelector("add-note"))
    await memoInput.setValue(memo)

    // tap outside
    await browser.touchAction({ action: "tap", x: 10, y: 250 })

    // updating memo takes a little time for the qr code to be updated
    await browser.pause(5000)
  })

  it("Click Copy BTC Invoice", async () => {
    // wait for qr to load
    const qrCode = await $(selector("QR-Code", "Other"))
    await qrCode.waitForDisplayed({ timeout })
    expect(qrCode).toBeDisplayed()

    const copyInvoiceButton = await $(selector("Copy Invoice", "StaticText"))
    await copyInvoiceButton.waitForDisplayed({ timeout })
    await copyInvoiceButton.click()
  })

  it("Get BTC Invoice from clipboard (android) or share link (ios)", async () => {
    if (process.env.E2E_DEVICE === "ios") {
      // on ios, get invoice from share link because copy does not
      // work on physical device for security reasons
      const shareButton = await $(selector("Share Invoice", "StaticText"))
      await shareButton.waitForDisplayed({ timeout })
      await shareButton.click()
      const invoiceSharedScreen = await $('//*[contains(@name,"lntbs")]')
      await invoiceSharedScreen.waitForDisplayed({
        timeout: 8000,
      })
      invoice = await invoiceSharedScreen.getAttribute("name")
      await clickButton("Close")
    } else {
      // get from clipboard in android
      const invoiceBase64 = await browser.getClipboard()
      invoice = Buffer.from(invoiceBase64, "base64").toString()
      expect(invoice).toContain("lntbs")
    }
  })

  it.skip("Capture screenshot and decode QR code to match with invoice", async () => {
    await scrollUp()

    const screenshot = await browser.takeScreenshot()
    const buffer = Buffer.from(screenshot, "base64")
    const image = await jimp.read(buffer)

    const imageData = {
      data: new Uint8ClampedArray(image.bitmap.data),
      height: image.bitmap.height,
      width: image.bitmap.width,
    }

    const code = jsQR(imageData.data, imageData.width, imageData.height)
    expect(code).not.toBeNull()
    expect(code?.data).toBe(invoice.toUpperCase())
  })

  it("External User Pays the BTC Invoice through API", async () => {
    const { result, paymentStatus } = await payAmountInvoice({ invoice, memo })
    expect(paymentStatus).toBe("SUCCESS")
    expect(result).toBeTruthy()
  })

  it("Wait for Green check for BTC Payment", async () => {
    const successCheck = await $(selector("Success Icon", "Other"))
    await successCheck.waitForDisplayed({ timeout })
  })

  it("Go back to main screen", async () => {
    await clickBackButton()
  })
})

describe("Receive BTC Amountless Invoice Payment Flow", () => {
  let invoice: string

  it("Click Receive", async () => {
    await clickIcon(LL.HomeScreen.receive())
  })

  it("Click Copy BTC Invoice", async () => {
    // wait for qr to load
    const qrCode = await $(selector("QR-Code", "Other"))
    await qrCode.waitForDisplayed({ timeout })
    expect(qrCode).toBeDisplayed()

    const copyInvoiceButton = await $(selector("Copy Invoice", "StaticText"))
    await copyInvoiceButton.waitForDisplayed({ timeout })
    await copyInvoiceButton.click()
  })

  it("Get BTC Invoice from clipboard (android) or share link (ios)", async () => {
    if (process.env.E2E_DEVICE === "ios") {
      // on ios, get invoice from share link because copy does not
      // work on physical device for security reasons
      const shareButton = await $(selector("Share Invoice", "StaticText"))
      await shareButton.waitForDisplayed({ timeout })
      await shareButton.click()

      const invoiceSharedScreen = await $('//*[contains(@name,"lntbs")]')
      await invoiceSharedScreen.waitForDisplayed({
        timeout: 8000,
      })
      invoice = await invoiceSharedScreen.getAttribute("name")
      const closeShareButton = await $(selector("Close", "Button"))
      await closeShareButton.waitForDisplayed({ timeout })
      await closeShareButton.click()
    } else {
      // get from clipboard in android
      const invoiceBase64 = await browser.getClipboard()
      invoice = Buffer.from(invoiceBase64, "base64").toString()
      expect(invoice).toContain("lntbs")
    }
  })

  it.skip("Capture screenshot and decode QR code to match with invoice", async () => {
    await scrollUp()

    const screenshot = await browser.takeScreenshot()
    const buffer = Buffer.from(screenshot, "base64")
    const image = await jimp.read(buffer)

    const imageData = {
      data: new Uint8ClampedArray(image.bitmap.data),
      height: image.bitmap.height,
      width: image.bitmap.width,
    }

    const code = jsQR(imageData.data, imageData.width, imageData.height)
    expect(code).not.toBeNull()
    expect(code?.data).toBe(invoice.toUpperCase())
  })

  it("External User Pays the BTC Invoice through API", async () => {
    const { result, paymentStatus } = await payNoAmountInvoice({
      invoice,
      walletCurrency: "BTC",
    })
    expect(paymentStatus).toBe("SUCCESS")
    expect(result).toBeTruthy()
  })

  it("Wait for Green check for BTC Payment", async () => {
    const successCheck = await $(selector("Success Icon", "Other"))
    await successCheck.waitForExist({ timeout })
  })
})

describe("Receive USD Payment Flow", () => {
  let invoice: string

  it("Click Receive", async () => {
    await clickIcon(LL.HomeScreen.receive())
  })

  it("Click USD invoice button", async () => {
    const usdInvoiceButton = await $(selector("Stablesats", "Other"))
    await usdInvoiceButton.waitForDisplayed({ timeout })
    await usdInvoiceButton.click()
  })

  it("Click Copy BTC Invoice", async () => {
    // wait for qr to load
    const qrCode = await $(selector("QR-Code", "Other"))
    await qrCode.waitForDisplayed({ timeout })
    expect(qrCode).toBeDisplayed()

    const copyInvoiceButton = await $(selector("Copy Invoice", "StaticText"))
    await copyInvoiceButton.waitForDisplayed({ timeout })
    await copyInvoiceButton.click()
  })

  it("Get BTC Invoice from clipboard (android) or share link (ios)", async () => {
    if (process.env.E2E_DEVICE === "ios") {
      // on ios, get invoice from share link because copy does not
      // work on physical device for security reasons
      const shareButton = await $(selector("Share Invoice", "StaticText"))
      await shareButton.waitForDisplayed({ timeout })
      await shareButton.click()

      const invoiceSharedScreen = await $('//*[contains(@name,"lntbs")]')
      await invoiceSharedScreen.waitForDisplayed({
        timeout: 8000,
      })
      invoice = await invoiceSharedScreen.getAttribute("name")
      const closeShareButton = await $(selector("Close", "Button"))
      await closeShareButton.waitForDisplayed({ timeout })
      await closeShareButton.click()
    } else {
      // get from clipboard in android
      const invoiceBase64 = await browser.getClipboard()
      invoice = Buffer.from(invoiceBase64, "base64").toString()
      expect(invoice).toContain("lntbs")
    }
  })

  it.skip("Capture screenshot and decode QR code to match with invoice", async () => {
    await scrollUp()

    const screenshot = await browser.takeScreenshot()
    const buffer = Buffer.from(screenshot, "base64")
    const image = await jimp.read(buffer)

    const imageData = {
      data: new Uint8ClampedArray(image.bitmap.data),
      height: image.bitmap.height,
      width: image.bitmap.width,
    }

    const code = jsQR(imageData.data, imageData.width, imageData.height)
    expect(code).not.toBeNull()
    expect(code?.data).toBe(invoice.toUpperCase())
  })

  it("External User Pays the BTC Invoice through API", async () => {
    const { result, paymentStatus } = await payNoAmountInvoice({
      invoice,
      walletCurrency: "BTC",
    })
    expect(paymentStatus).toBe("SUCCESS")
    expect(result).toBeTruthy()
  })

  it("Wait for Green check for BTC Payment", async () => {
    const successCheck = await $(selector("Success Icon", "Other"))
    await successCheck.waitForExist({ timeout })
  })

  it("Go back to main screen", async () => {
    await clickBackButton()
    await waitTillOnHomeScreen()
  })
})

describe("Receive via Onchain", () => {
  let invoice: string

  it("Click Receive", async () => {
    await clickIcon(LL.HomeScreen.receive())
  })

  it("Click Onchain button", async () => {
    // flaky on android
    if (process.env.E2E_DEVICE === "android") {
      await browser.pause(100)
    }

    const onchainButton = await $(selector("Onchain", "StaticText"))
    await onchainButton.waitForDisplayed({ timeout })
    await onchainButton.click()
  })

  it("Click Copy BTC Invoice", async () => {
    // wait for qr to load
    const qrCode = await $(selector("QR-Code", "Other"))
    await qrCode.waitForDisplayed({ timeout })
    expect(qrCode).toBeDisplayed()

    const copyInvoiceButton = await $(selector("Copy Invoice", "StaticText"))
    await copyInvoiceButton.waitForDisplayed({ timeout })
    await copyInvoiceButton.click()
  })

  it("Get BTC Invoice from clipboard (android) or skip test (ios)", async () => {
    if (process.env.E2E_DEVICE === "android") {
      // get from clipboard in android
      const invoiceBase64 = await browser.getClipboard()
      invoice = Buffer.from(invoiceBase64, "base64").toString()
      expect(invoice).toContain("tb1")
    }
  })

  it.skip("Capture screenshot and decode QR code", async () => {
    await scrollUp()

    const screenshot = await browser.takeScreenshot()
    const buffer = Buffer.from(screenshot, "base64")
    const image = await jimp.read(buffer)

    const imageData = {
      data: new Uint8ClampedArray(image.bitmap.data),
      height: image.bitmap.height,
      width: image.bitmap.width,
    }

    const code = jsQR(imageData.data, imageData.width, imageData.height)
    expect(code).not.toBeNull()
  })

  it("Go back to main screen", async () => {
    await clickBackButton()
    await waitTillOnHomeScreen()
  })
})

describe("Receive via Onchain on USD", () => {
  let invoice: string

  it("Click Receive", async () => {
    await clickIcon(LL.HomeScreen.receive())
  })

  it("Click Onchain button", async () => {
    // flaky on android
    if (process.env.E2E_DEVICE === "android") {
      await browser.pause(100)
    }

    const onchainButton = await $(selector("Onchain", "StaticText"))
    await onchainButton.waitForDisplayed({ timeout })
    await onchainButton.click()
  })

  it("Click USD invoice button", async () => {
    const usdInvoiceButton = await $(selector("Stablesats", "Other"))
    await usdInvoiceButton.waitForDisplayed({ timeout })
    await usdInvoiceButton.click()
  })

  it("Click Copy BTC Invoice", async () => {
    // wait for qr to load
    const qrCode = await $(selector("QR-Code", "Other"))
    await qrCode.waitForDisplayed({ timeout })
    expect(qrCode).toBeDisplayed()

    const copyInvoiceButton = await $(selector("Copy Invoice", "StaticText"))
    await copyInvoiceButton.waitForDisplayed({ timeout })
    await copyInvoiceButton.click()
  })

  it("Get BTC Invoice from clipboard (android) or skip test (ios)", async () => {
    if (process.env.E2E_DEVICE === "android") {
      // get from clipboard in android
      const invoiceBase64 = await browser.getClipboard()
      invoice = Buffer.from(invoiceBase64, "base64").toString()
      expect(invoice).toContain("tb1")
    }
  })

  it.skip("Capture screenshot and decode QR code", async () => {
    await scrollUp()

    const screenshot = await browser.takeScreenshot()
    const buffer = Buffer.from(screenshot, "base64")
    const image = await jimp.read(buffer)

    const imageData = {
      data: new Uint8ClampedArray(image.bitmap.data),
      height: image.bitmap.height,
      width: image.bitmap.width,
    }

    const code = jsQR(imageData.data, imageData.width, imageData.height)
    expect(code).not.toBeNull()
  })

  it("Go back to main screen", async () => {
    await clickBackButton()
    await waitTillOnHomeScreen()
  })
})

describe("Receive via Paycode", () => {
  it("Click Receive", async () => {
    await clickIcon(LL.HomeScreen.receive())
  })

  it("Click Paycode button", async () => {
    const paycodeButton = await $(selector("Paycode", "StaticText"))
    await paycodeButton.waitForDisplayed({ timeout })
    await paycodeButton.click()
  })

  // we can't reliably test paycode qr because username needs to have been set
  // which is conditional - can be set or for new accounts might not be set

  it("Go back to main screen", async () => {
    await clickBackButton()
    await waitTillOnHomeScreen()
  })
})
