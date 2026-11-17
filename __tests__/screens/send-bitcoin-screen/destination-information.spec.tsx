import React from "react"
import { render } from "@testing-library/react-native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { DestinationInformation } from "@app/screens/send-bitcoin-screen/destination-information"
import { InvalidDestinationReason } from "@app/screens/send-bitcoin-screen/payment-destination/index.types"
import {
  DestinationState,
  SendBitcoinDestinationState,
} from "@app/screens/send-bitcoin-screen/send-bitcoin-reducer"
import { PaymentType } from "@blinkbitcoin/blink-client"

import { flushEffects } from "../../helpers/flush-effects"
import { ContextForScreen } from "../helper"

beforeAll(() => {
  loadLocale("en")
})

const invalidState = (
  invalidReason: InvalidDestinationReason,
): SendBitcoinDestinationState => ({
  unparsedDestination: "https://za.wigroup.co/bill/172366037",
  destinationState: DestinationState.Invalid,
  invalidDestination: {
    valid: false,
    invalidReason,
    invalidPaymentDestination: {
      paymentType: PaymentType.Lnurl,
      valid: true,
      lnurl: "https%3A%2F%2Fza.wigroup.co%2Fbill%2F172366037@cryptoqr.net",
      isMerchant: false,
    },
  },
})

const renderFor = async (invalidReason: InvalidDestinationReason) => {
  const screen = render(
    <ContextForScreen>
      <DestinationInformation destinationState={invalidState(invalidReason)} />
    </ContextForScreen>,
  )
  await flushEffects()
  return screen
}

describe("DestinationInformation", () => {
  /**
   * A pasted merchant code takes the same path as a scanned one, so it earned the
   * same wrong message: the generic "enter a valid destination" advice, for a code
   * the app parsed correctly and a service that simply could not answer.
   */
  it("says the code could not be processed when the lnurl service failed", async () => {
    const { getByText } = await renderFor(InvalidDestinationReason.LnurlServiceError)

    expect(
      getByText(
        "We could not process this code. It may have expired, or the service may be temporarily unavailable.",
      ),
    ).toBeTruthy()
  })

  it("keeps the lightning address message for an unreachable address", async () => {
    const { getByText } = await renderFor(InvalidDestinationReason.LnurlError)

    expect(
      getByText(
        "We can't reach this Lightning address. If you are sure it exists, you can try again later.",
      ),
    ).toBeTruthy()
  })

  it("keeps the generic advice for a destination it cannot recognise", async () => {
    const { getByText } = await renderFor(InvalidDestinationReason.UnknownDestination)

    expect(getByText("Enter a valid destination")).toBeTruthy()
  })
})
