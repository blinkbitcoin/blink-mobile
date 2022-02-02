import { bech32 } from "bech32"
import { LN_PAGE_DOMAIN } from "../constants/support"

export const getLnurlPayEncodedString = (username: string): string => {
  return bech32.encode(
    "lnurl",
    bech32.toWords(
      Buffer.from(`${LN_PAGE_DOMAIN}/.well-known/lnurlp/${username}`, "utf8"),
    ),
    1500,
  )
}
