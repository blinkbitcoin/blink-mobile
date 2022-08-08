import { bech32 } from "bech32"
import { GALOY_PAY_DOMAIN } from "../constants/support"

export const getLnurlPayEncodedString = (username: string): string => {
  return bech32.encode(
    "lnurl",
    bech32.toWords(
      Buffer.from(`${GALOY_PAY_DOMAIN}.well-known/lnurlp/${username}`, "utf8"),
    ),
    1500,
  ).toUpperCase()
}

export const getLnurlEncodedCustomString = (str: string): string => {
  return bech32.encode(
    "lnurl",
    bech32.toWords(
      Buffer.from(str, "utf8"),
    ),
    1500,
  ).toUpperCase()
}
