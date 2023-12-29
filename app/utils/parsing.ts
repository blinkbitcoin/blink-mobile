import * as lightningPayReq from "bolt11"
import moment from "moment"
import url from "url"
import { networks, address } from "bitcoinjs-lib"
import * as bip21 from "bip21"
import { getDescription, getDestination, getUsername } from "./bolt11"
import { utils } from "lnurl-pay"
import type { INetwork } from "../types/network"
import * as parsing from "./parsing"
import { getLnurlEncodedCustomString } from "./bech32"


// TODO: look if we own the address

export type IPaymentType = "lightning" | "onchain" | "username" | "lnurl" | undefined

export interface IValidPaymentReponse {
  valid: boolean
  errorMessage?: string | undefined
  invoice?: string | undefined // for lightning
  address?: string | undefined // for bitcoin
  lnurl?: string | undefined // for lnurl
  amount?: number | undefined
  amountless?: boolean | undefined
  memo?: lightningPayReq.TagData | string | undefined
  paymentType?: IPaymentType
  sameNode?: boolean | undefined
  username?: string | undefined
  staticLnurlIdentifier?: boolean
}

const mappingToBitcoinJs = (input: INetwork) => {
  switch (input) {
    case "mainnet":
      return networks.bitcoin
    case "testnet":
      return networks.testnet
    case "regtest":
      return networks.regtest
  }
}

export const lightningInvoiceHasExpired = (
  payReq: lightningPayReq.PaymentRequestObject,
): boolean => {
  return payReq?.timeExpireDate < moment().unix()
}

// from https://github.com/bitcoin/bips/blob/master/bip-0020.mediawiki#Transfer%20amount/size
const reAmount = /^(([\d.]+)(X(\d+))?|x([\da-f]*)(\.([\da-f]*))?(X([\da-f]+))?)$/i
function parseAmount(txt) {
  const m = txt.match(reAmount)
  return Math.round(
    m[5]
      ? (parseInt(m[5], 16) +
          (m[7] ? parseInt(m[7], 16) * Math.pow(16, -m[7].length) : 0)) *
          (m[9] ? Math.pow(16, parseInt(m[9], 16)) : 0x10000)
      : m[2] * (m[4] ? Math.pow(10, m[4]) : 1e8),
  )
}

export const validPayment = (
  input: string,
  network: INetwork,
  myPubKey: string,
  username: string,
): IValidPaymentReponse => {
  if (!input) {
    return { valid: false }
  }

  // input might start with 'lightning:', 'bitcoin:'
  if (input.toLowerCase().startsWith("lightning:lnurl") || input.toLowerCase().startsWith("lightning://lnurl")) {
    /* eslint-disable no-param-reassign */
    input = input.replace("lightning://", "").replace("LIGHTNING://", "").replace("lightning:", "").replace("LIGHTNING:", "")
  }

  try {
    const bip21Decoded = bip21.decode(input)

    if(bip21Decoded && bip21Decoded.options && bip21Decoded.options.lightning) {
      input = `lightning:${bip21Decoded.options.lightning.toLowerCase()}`
    }
  } catch (e) {
    console.log('error parsing bip21', e)
  }

  // eslint-disable-next-line prefer-const
  let [protocol, data] = input.split(":")
  let paymentType: IPaymentType
  let lnurl: string
  let staticLnurlIdentifier = false

  if (protocol.toLowerCase() === "bitcoin") {
    paymentType = "onchain"

    // TODO manage bitcoin= case
  } else if (protocol.toLowerCase() === "lightning") {
    paymentType = "lightning"
    // some apps encode lightning invoices in UPPERCASE
    data = data.toLowerCase()
  } else if (
    (protocol && protocol.toLowerCase().startsWith("lnurl")) ||
    (data && data.toLowerCase().startsWith("lnurl"))
  ) {
    paymentType = "lnurl"

    if(protocol && data && !data.toLowerCase().startsWith('lnurl')) {
      if(!data.toLowerCase().startsWith('https:')) {
        lnurl = getLnurlEncodedCustomString('https:' + data)
      } else {
        lnurl = getLnurlEncodedCustomString(data)
      }
    } else {
      lnurl = protocol || data
    }
    // no protocol. let's see if this could have an address directly
  } else if (protocol.toLowerCase().startsWith("ln")) {
    // possibly a lightning address?

    paymentType = "lightning"

    if (network === "testnet" && protocol.toLowerCase().startsWith("lnbc")) {
      return {
        valid: false,
        paymentType,
        errorMessage: "This is a mainnet invoice. The wallet is on testnet",
      }
    }

    if (network === "mainnet" && protocol.toLowerCase().startsWith("lntb")) {
      return {
        valid: false,
        paymentType,
        errorMessage: "This is a testnet invoice. The wallet is on mainnet",
      }
    }

    // some apps encode lightning invoices in UPPERCASE
    data = protocol.toLowerCase()
  } else if (utils.isLightningAddress(protocol)) {
    paymentType = "lnurl"
    staticLnurlIdentifier = true
    lnurl = utils.decodeUrlOrAddress(protocol)
  } else if (!utils.isLightningAddress(protocol) && protocol.toLowerCase() === "https") {
    const domain = "//pay.bitcoinjungle.app/"

    if (data.startsWith(domain)) {
      return {
        valid: true,
        paymentType: "username",
        username: data.substring(domain.length),
      }
    }
  } else {
    // no schema
    data = protocol
  }

  if (paymentType === "onchain" || paymentType === undefined) {
    try {
      const decodedData = url.parse(data, true)
      let path = decodedData.pathname // using url node library. the address is exposed as the "host" here
      // some apps encode bech32 addresses in UPPERCASE
      const lowerCasePath = path.toLowerCase()
      if (
        lowerCasePath.startsWith("bc1") ||
        lowerCasePath.startsWith("tb1") ||
        lowerCasePath.startsWith("bcrt1")
      ) {
        path = lowerCasePath
      }

      let amount

      try {
        amount = parseAmount(decodedData.query.amount)
      } catch (err) {
        console.log(`can't decode amount ${err}`)
      }

      // FIXME "toOutputScript" will throw if address is not valid, however bitcoinjs-lib does not currently support
      // taproot addresses so we must bypass this check if the address uese taproot
      const isTaprootAddress = lowerCasePath.startsWith("bc1p")
      if(!isTaprootAddress) {
        // will throw if address is not valid
        address.toOutputScript(path, mappingToBitcoinJs(network))
      }
      
      paymentType = "onchain"
      return {
        valid: true,
        paymentType,
        address: path,
        amount,
        amountless: !amount,
      }
    } catch (e) {
      console.warn(`issue with payment ${e}`)
      return { valid: false }
    }
  } else if (paymentType === "lightning") {
    let payReq
    try {
      payReq = lightningPayReq.decode(data)
    } catch (err) {
      console.log(err)
      return { valid: false }
    }
    // console.log(JSON.stringify({ payReq }, null, 2))

    const sameNode = myPubKey === getDestination(payReq)

    if (sameNode && username === getUsername(payReq)) {
      return {
        valid: false,
        paymentType,
        errorMessage: "invoice needs to be for a different user",
      }
    }

    let amount
    let amountless

    if (payReq.satoshis || payReq.millisatoshis) {
      amount = payReq.satoshis ?? Number(payReq.millisatoshis) / 1000
      amountless = false
    } else {
      amount = 0
      amountless = true
    }

    // TODO: show that the invoice has expired in the popup
    // TODO: manage testnet as well

    if (parsing.lightningInvoiceHasExpired(payReq)) {
      return { valid: false, errorMessage: "invoice has expired", paymentType }
    }

    const memo = getDescription(payReq)
    return {
      valid: true,
      invoice: data,
      amount,
      amountless,
      memo,
      paymentType,
      sameNode,
    }
  } else if (paymentType === "lnurl") {
    return {
      valid: true,
      lnurl,
      amountless: false,
      staticLnurlIdentifier,
    }
  } else {
    return {
      valid: false,
      errorMessage: "We are unable to detect an invoice or payment address",
    }
  }
}
