import { bech32 } from "bech32"

import { i18nObject } from "../app/i18n/i18n-util"
import { loadLocale } from "../app/i18n/i18n-util.sync"
import {
  clickBackButton,
  clickButton,
  clickIcon,
  waitTillOnHomeScreen,
  waitTillTextDisplayed,
  getInvoice,
  selector,
  addSmallAmount,
  waitTillButtonDisplayed,
  waitTillPressableDisplayed,
  swipeButton,
} from "./utils"

loadLocale("en")
const LL = i18nObject("en")
const timeout = 30000

describe("Lightning address flow", () => {
  const lightningAddress = "extheo@testlnurl.netlify.app"

  it("Click Send", async () => {
    await clickIcon(LL.HomeScreen.send())
  })

  it("Paste Lnurl", async () => {
    const lnurlInput = await $(
      selector(LL.SendBitcoinScreen.placeholder(), "Other", "[1]"),
    )
    await lnurlInput.waitForDisplayed({ timeout })
    await lnurlInput.click()
    await lnurlInput.setValue(lightningAddress)
  })

  it("Click Next", async () => {
    await clickButton(LL.common.next())
  })

  it("Checks if on the SendBitcoinDetails screen", async () => {
    await waitTillPressableDisplayed("Key 1")
  })

  it("Go back", async () => {
    await clickBackButton()
    await waitTillTextDisplayed(LL.SendBitcoinScreen.destination())
  })

  it("Go back home", async () => {
    await clickBackButton()
    await waitTillOnHomeScreen()
  })
})

describe("Lnurl Pay Flow", () => {
  // see https://github.com/Extheoisah/lnurl-json for reference to lnurl json
  const words = bech32.toWords(
    Buffer.from("https://testlnurl.netlify.app:443/.well-known/lnurlp/extheo", "utf-8"),
  )
  const lnurlp = bech32.encode("lnurl", words, 1000)
  // lnurl1dp68gurn8ghj7ar9wd6xcmn4wfkzumn9w3kxjene9eshqup6xs6rxtewwajkcmpdddhx7amw9akxuatjd3cz7etcw35x2mcql20cc

  it("Click Send", async () => {
    await clickIcon(LL.HomeScreen.send())
  })

  it("Paste Lnurl", async () => {
    const lnurlInput = await $(
      selector(LL.SendBitcoinScreen.placeholder(), "Other", "[1]"),
    )
    await lnurlInput.waitForDisplayed({ timeout })
    await lnurlInput.click()
    await lnurlInput.setValue(lnurlp)
  })

  it("Click Next", async () => {
    await clickButton(LL.common.next())
  })

  it("Checks if on the SendBitcoinDetails screen", async () => {
    await waitTillPressableDisplayed("Key 1")
  })

  it("Go back", async () => {
    await clickBackButton()
    await waitTillTextDisplayed(LL.SendBitcoinScreen.destination())
  })

  it("Go back home", async () => {
    await clickBackButton()
    await waitTillOnHomeScreen()
  })
})

describe("Lnurl Withdraw Flow", () => {
  // see https://github.com/Extheoisah/lnurl-json for reference to lnurl json
  const words = bech32.toWords(
    Buffer.from(
      "https://testlnurl.netlify.app/lnurl-withdraw/lnwithdrawresponse.json",
      "utf-8",
    ),
  )
  const lnurlWithdraw = bech32.encode("lnurl", words, 1000)

  it("Click Send", async () => {
    await clickIcon(LL.HomeScreen.send())
  })

  it("Paste Lnurl", async () => {
    const lnurlInput = await $(
      selector(LL.SendBitcoinScreen.placeholder(), "Other", "[1]"),
    )
    await lnurlInput.waitForDisplayed({ timeout })
    await lnurlInput.click()
    await lnurlInput.setValue(lnurlWithdraw)
  })

  it("Click Next", async () => {
    await clickButton(LL.common.next())
  })

  it("Checks if lnwithdraw details are displayed", async () => {
    const description = await $(selector("description", "StaticText"))
    await description.waitForDisplayed({ timeout })
    await waitTillButtonDisplayed("Redeem Bitcoin")
  })

  it("Go back", async () => {
    await clickBackButton()
    await waitTillTextDisplayed(LL.SendBitcoinScreen.destination())
  })

  it("Go back home", async () => {
    await clickBackButton()
    await waitTillOnHomeScreen()
  })
})

describe("Lightning Payments Flow", () => {
  let invoice: string

  it("Click Send", async () => {
    await clickIcon(LL.HomeScreen.send())
  })

  it("Create Invoice from API", async () => {
    invoice = await getInvoice()
    expect(invoice).toContain("lntbs")
  })

  it("Paste Invoice", async () => {
    const invoiceInput = await $(
      selector(LL.SendBitcoinScreen.placeholder(), "Other", "[1]"),
    )
    await invoiceInput.waitForDisplayed({ timeout })
    await invoiceInput.click()
    await invoiceInput.setValue(invoice)
  })

  it("Click Next", async () => {
    await clickButton(LL.common.next())
  })

  it("Add amount", async () => {
    await addSmallAmount()
  })

  it("Click Next again", async () => {
    await clickButton(LL.common.next())
  })

  it("Wait for fee calculation to return", async () => {
    const feeDisplay = await $(selector("Successful Fee", "StaticText"))
    await feeDisplay.waitForDisplayed({ timeout })
  })

  it("Slides to confirm payment and navigate to move money screen", async () => {
    await swipeButton(LL.SendBitcoinConfirmationScreen.slideToConfirm())
    await waitTillOnHomeScreen()
  })
})
