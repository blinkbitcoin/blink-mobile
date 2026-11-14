import { TranslationFunctions } from "../../../app/i18n/i18n-types"
import { timeout } from "./config"

export const tap = async (match: Detox.NativeMatcher, timeoutMultiplier = 1) => {
  const el = element(match)
  await waitFor(el)
    .toBeVisible()
    .withTimeout(timeout * timeoutMultiplier)
  await el.tap()
}

export const addAmount = async (amount: string, LL: TranslationFunctions) => {
  await tap(by.id("Amount Input Button"))
  for (const char of amount) {
    await tap(by.id(`Key ${char}`))
  }
  await tap(by.id(LL.AmountInputScreen.setAmount()))
  await waitFor(element(by.id("Amount Input Button")))
    .toBeVisible()
    .withTimeout(timeout)
}

/** The send amount step types on its in-screen keypad; there is no modal to confirm. */
export const typeSendAmount = async (amount: string) => {
  for (const char of amount) {
    await tap(by.id(`Key ${char}`))
  }
}

export const slideSlider = async () => {
  const slider = element(by.id("slider"))
  await waitFor(slider).toBeVisible().withTimeout(timeout)
  await slider.swipe("right", "fast", 0.9, 0.5, 0.5)
}

export const verifyTextPresent = async (text: string, waitTime?: number) => {
  const el = element(by.text(text))
  await waitFor(el)
    .toBeVisible()
    .withTimeout(waitTime || timeout)
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
