import { buildNwcConnectionCreateInput } from "@app/screens/nostr-wallet-connect/nwc-service"
import { parseNwcUri } from "@app/screens/nostr-wallet-connect/nwc-uri"

const PUBKEY = "a".repeat(64)
const SECRET = "b".repeat(64)

describe("nwc-service", () => {
  it("builds a GraphQL-shaped create input with budget when pay_invoice is requested", () => {
    const parsedUri = parseNwcUri(
      `nostr+walletconnect://${PUBKEY}?relay=wss%3A%2F%2Frelay.blink.sv&secret=${SECRET}&required_commands=get_info,pay_invoice,notifications:payment_sent`,
    )

    expect(parsedUri.valid).toBe(true)
    if (!parsedUri.valid) return

    expect(
      buildNwcConnectionCreateInput({
        parsedUri,
        alias: "Amethyst",
        budgetSats: 10_000,
        budgetPeriod: "WEEKLY",
      }),
    ).toEqual({
      nwcUri: parsedUri.raw,
      alias: "Amethyst",
      permissions: ["GET_INFO", "PAY_INVOICE", "NOTIFICATIONS_PAYMENT_SENT"],
      budgets: [
        {
          amountSats: 10_000,
          period: "WEEKLY",
        },
      ],
    })
  })

  it("omits budgets when pay_invoice is not requested", () => {
    const parsedUri = parseNwcUri(
      `nostr+walletconnect://${PUBKEY}?relay=wss%3A%2F%2Frelay.blink.sv&secret=${SECRET}&required_commands=get_info,get_balance`,
    )

    expect(parsedUri.valid).toBe(true)
    if (!parsedUri.valid) return

    expect(
      buildNwcConnectionCreateInput({
        parsedUri,
        alias: "Read only",
        budgetSats: 10_000,
        budgetPeriod: "DAILY",
      }),
    ).toEqual({
      nwcUri: parsedUri.raw,
      alias: "Read only",
      permissions: ["GET_INFO", "GET_BALANCE"],
      budgets: undefined,
    })
  })
})
