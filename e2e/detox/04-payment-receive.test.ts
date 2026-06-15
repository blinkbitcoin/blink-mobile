import "detox"
import jimp from "jimp"
import jsQR from "jsqr"

import { i18nObject } from "../../app/i18n/i18n-util"
import { loadLocale } from "../../app/i18n/i18n-util.sync"
import { sendBtcTo, sendLnPaymentFromBob } from "./utils/commandline"
import { setLocalAndLoginWithAccessToken, waitForHomeScreen } from "./utils/common-flows"
import { timeout, ALICE_TOKEN } from "./utils/config"
import { tap, sleep, addAmount } from "./utils/controls"

const decodeQRCode = async (imgPath: string): Promise<string> => {
  const image = await jimp.read(imgPath)
  const { data, width, height } = image.bitmap

  const clampedArray = new Uint8ClampedArray(
    data.buffer,
    data.byteOffset,
    data.byteLength / Uint8ClampedArray.BYTES_PER_ELEMENT,
  )

  const qrCode = jsQR(clampedArray, width, height)

  if (qrCode) {
    return qrCode.data
  }
  throw new Error("QR code could not be decoded.")
}

loadLocale("en")
const LL = i18nObject("en")

// TODO:
// Transaction list doesn't get updated in the local setup because somehow websocket
// is broken. Thereby, the received animation is not happening. This needs debugging.

// Make sure all tests in this file reset back to home screen because tests reuse same session in this file
beforeAll(async () => {
  await device.launchApp({ newInstance: true, permissions: { notifications: "YES" } })
  await setLocalAndLoginWithAccessToken(ALICE_TOKEN, LL)
})

describe("Receive: LN BTC Amountless", () => {
  it("receive", async () => {
    await tap(by.id(LL.HomeScreen.receive()))

    const amountInput = element(by.id("Amount Input Button"))
    await waitFor(amountInput).toBeVisible().withTimeout(timeout)

    const readablePaymentRequest = element(by.id("readable-payment-request"))
    await waitFor(readablePaymentRequest)
      .toBeVisible()
      .withTimeout(timeout * 60)

    const qrCode = element(by.id("QR-Code"))
    await waitFor(qrCode).toBeVisible().withTimeout(timeout)
    const imgPath = await qrCode.takeScreenshot("qr-code")
    const paymentRequest = await decodeQRCode(imgPath)

    await sendLnPaymentFromBob({ paymentRequest, amount: 2 })

    await device.pressBack()
    await waitForHomeScreen(LL)
  })
})

describe("Receive: LN BTC $0.02 Amount", () => {
  it("receive", async () => {
    await tap(by.id(LL.HomeScreen.receive()))

    const amountInput = element(by.id("Amount Input Button"))
    await waitFor(amountInput).toBeVisible().withTimeout(timeout)

    await addAmount("0.02", LL)

    const readablePaymentRequest = element(by.id("readable-payment-request"))
    await waitFor(readablePaymentRequest)
      .toBeVisible()
      .withTimeout(timeout * 60)

    const qrCode = element(by.id("QR-Code"))
    await waitFor(qrCode).toBeVisible().withTimeout(timeout)
    const imgPath = await qrCode.takeScreenshot("qr-code")
    const paymentRequest = await decodeQRCode(imgPath)

    await sendLnPaymentFromBob({ paymentRequest })

    await device.pressBack()
    await waitForHomeScreen(LL)
  })
})

describe("Receive: LN Stablesats Amountless", () => {
  it("receive", async () => {
    await tap(by.id(LL.HomeScreen.receive()))

    const amountInput = element(by.id("Amount Input Button"))
    await waitFor(amountInput).toBeVisible().withTimeout(timeout)

    await tap(by.id("Dollar"))
    await sleep(1000)

    const readablePaymentRequest = element(by.id("readable-payment-request"))
    await waitFor(readablePaymentRequest)
      .toBeVisible()
      .withTimeout(timeout * 60)

    const qrCode = element(by.id("QR-Code"))
    await waitFor(qrCode).toBeVisible().withTimeout(timeout)
    const imgPath = await qrCode.takeScreenshot("qr-code")
    const paymentRequest = await decodeQRCode(imgPath)

    await sendLnPaymentFromBob({ paymentRequest, amount: 2 })

    await device.pressBack()
    await waitForHomeScreen(LL)
  })
})

describe("Receive: LN Stablesats $0.02 Amount", () => {
  it("receive", async () => {
    await tap(by.id(LL.HomeScreen.receive()))

    const amountInput = element(by.id("Amount Input Button"))
    await waitFor(amountInput).toBeVisible().withTimeout(timeout)

    await tap(by.id("Dollar"))
    await sleep(1000)

    // await element(by.id("receive-screen")).scroll(400, "down", NaN, 0.85)
    await addAmount("0.02", LL)

    const readablePaymentRequest = element(by.id("readable-payment-request"))
    await waitFor(readablePaymentRequest)
      .toBeVisible()
      .withTimeout(timeout * 60)

    const qrCode = element(by.id("QR-Code"))
    await waitFor(qrCode).toBeVisible().withTimeout(timeout)
    const imgPath = await qrCode.takeScreenshot("qr-code")
    const paymentRequest = await decodeQRCode(imgPath)

    await sendLnPaymentFromBob({ paymentRequest })

    await device.pressBack()
    await waitForHomeScreen(LL)
  })
})

describe("Receive: Onchain BTC", () => {
  it("receive", async () => {
    await tap(by.id(LL.HomeScreen.receive()))

    const amountInput = element(by.id("Amount Input Button"))
    await waitFor(amountInput).toBeVisible().withTimeout(timeout)

    await tap(by.id("Onchain"), 30)
    await sleep(500)
    await tap(by.id("Bitcoin"))
    await sleep(500)

    const qrCode = element(by.id("QR-Code"))
    await waitFor(qrCode).toBeVisible().withTimeout(timeout)
    const imgPath = await qrCode.takeScreenshot("qr-code")
    const addressQR = await decodeQRCode(imgPath)
    const address = addressQR.split(":")[1].split("?")[0]

    await sendBtcTo({ address })

    await device.pressBack()
    await waitForHomeScreen(LL)
  })
})

describe("Receive: Onchain Stablesats", () => {
  it("receive", async () => {
    await tap(by.id(LL.HomeScreen.receive()))

    const amountInput = element(by.id("Amount Input Button"))
    await waitFor(amountInput).toBeVisible().withTimeout(timeout)

    await tap(by.id("Onchain"), 30)
    await sleep(500)
    await tap(by.id("Dollar"))
    await sleep(500)

    const qrCode = element(by.id("QR-Code"))
    await waitFor(qrCode).toBeVisible().withTimeout(timeout)
    const imgPath = await qrCode.takeScreenshot("qr-code")
    const addressQR = await decodeQRCode(imgPath)
    const address = addressQR.split(":")[1].split("?")[0]

    await sendBtcTo({ address })

    await device.pressBack()
    await waitForHomeScreen(LL)
  })
})
