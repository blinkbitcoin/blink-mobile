import moment from "moment"
import { validPayment } from "../app/utils/parsing"

// more test address can be found at: https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/fixtures/address.json

beforeAll(() => {
  moment.now = function () {
    return 1598110996000 // Aug 22 2020 10:43
  }
})

const client = {
  readQuery: () => "",
}

const checkOnChain = (address, network) => {
  const { valid, paymentType } = validPayment(address, network, "", "")
  expect(valid).toBeTruthy()
  expect(paymentType).toBe("onchain")
}

const checkOnChainFail = (address, network) => {
  const { valid } = validPayment(address, network, "", "")
  expect(valid).toBeFalsy()
}

const p2pkh = "1KP2uzAZYoNF6U8BkMBRdivLNujwSjtAQV"
const p2sh = "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy"
const bech32 = "bc1qdx09anw82zhujxzzsn56mruv8qvd33czzy9apt"
const bech32_caps = "BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4"
const p2pkh_prefix = "bitcoin:1KP2uzAZYoNF6U8BkMBRdivLNujwSjtAQV"
const p2sh_prefix = "bitcoin:3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy"
const bech32_prefix = "bitcoin:bc1qdx09anw82zhujxzzsn56mruv8qvd33czzy9apt"
const bech32_caps_prefix = "bitcoin:BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4"

const bech32_regtest = "bcrt1qam64av6cyhjsgdwajjpe0l9z8ju4w7rjryecf3"

const bech32_testnet = "tb1q0g444vcyy53pza03zsel3tcwdejt9z5kq3w385aqgazpfxjhsr0qhds7p5"

it("bitcoin address mainnet", () => {
  const network = "mainnet"

  checkOnChain(p2pkh, network)
  checkOnChain(p2sh, network)
  checkOnChain(bech32, network)
  checkOnChain(bech32_caps, network)
  checkOnChain(p2pkh_prefix, network)
  checkOnChain(p2sh_prefix, network)
  checkOnChain(bech32_prefix, network)
  checkOnChain(bech32_caps_prefix, network)

  checkOnChainFail(bech32_regtest, network)
  checkOnChainFail(bech32_testnet, network)
})

it("bitcoin address testnet", () => {
  const network = "testnet"

  checkOnChain(bech32_testnet, network)

  checkOnChainFail(bech32_regtest, network)
  checkOnChainFail(bech32, network)
})

it("bitcoin address regtest", () => {
  const network = "regtest"

  checkOnChain(bech32_regtest, network)

  checkOnChainFail(p2pkh, network)
  checkOnChainFail(bech32_testnet, network)
})

describe("Onchain", () => {
  const network = "mainnet"

  it("amount", () => {
    const address_amount = "bc1qdx09anw82zhujxzzsn56mruv8qvd33czzy9apt?amount=0.00122"

    const { valid, paymentType, amountless, amount } = validPayment(
      address_amount,
      network,
      "",
      "",
    )
    expect(valid).toBeTruthy()
    expect(paymentType).toBe("onchain")
    expect(amount).toBe(122000)
    expect(amountless).toBe(false)
  })

  it("amountless", () => {
    const address_no_amount = "bc1qdx09anw82zhujxzzsn56mruv8qvd33czzy9apt"

    const { valid, paymentType, amountless, amount } = validPayment(
      address_no_amount,
      network,
      "",
      "",
    )
    expect(valid).toBeTruthy()
    expect(paymentType).toBe("onchain")
    expect(amount).toBeFalsy()
    expect(amountless).toBe(true)
  })

  it("prefix", () => {
    const prefix_address =
      "bitcoin:bc1qdx09anw82zhujxzzsn56mruv8qvd33czzy9apt?amount=0.00122"

    const { valid, paymentType, amountless, amount } = validPayment(
      prefix_address,
      network,
      "",
      "",
    )
    expect(valid).toBeTruthy()
    expect(paymentType).toBe("onchain")
    expect(amount).toBe(122000)
    expect(amountless).toBe(false)
  })
})

describe("Lightning", () => {
  const network = "mainnet"

  it("opennode", () => {
    const address =
      "LNBC6864270N1P05ZVJJPP5FPEHVLV3DD2R76065R9V0L3N8QV9MFWU9RYHVPJ5XSZ3P4HY734QDZHXYSV89EQYVMZQSNFW3PXCMMRDDPX7MMDYPP8YATWVD5ZQMMWYPQH2EM4WD6ZQVESYQ5YYUN4DE3KSGZ0DEK8J2GCQZPGXQRRSS6LQA5JLLVUGLW5TPSUG4S2TMT5C8FNERR95FUH8HTCSYX52CP3WZSWJ32XJ5GEWYFN7MG293V6JLA9CZ8ZNDHWDHCNNKUL2QKF6PJLSPJ2NL3J"

    const { valid, paymentType, errorMessage } = validPayment(address, network, "", "")
    expect(valid).toBeTruthy()
    expect(paymentType).toBe("lightning")
    expect(errorMessage).not.toBe("invoice has expired")
  })

  it("opennode_expired", () => {
    const address =
      "LNBC11245410N1P05Z2LTPP52W2GX57TZVLM09SWZ8M0CAWGQPVTL3KUWZA836H5LG6HK2N2PRYQDPHXYSV89EQYVMJQSNFW3PXCMMRDDZXJMNWV4EZQST4VA6HXAPQXGU8G6QCQZPGXQRRSSVS7S2WT4GX90MQC9CVMA8UYDSTX5P0FA68V03U96HQDPFCT9DGDQQSENNAAGAXND6664CTKV88GMQ689LS0J7FFAD4DRN6SPLXAXZ0CQYZAU9Q"

    const { valid, paymentType, errorMessage } = validPayment(address, network, "", "")
    expect(valid).toBeFalsy()
    expect(paymentType).toBe("lightning")
    expect(errorMessage).toBe("invoice has expired")
  })

  it("prefix", () => {
    const address =
      "LIGHTNING:LNBC6864270N1P05ZVJJPP5FPEHVLV3DD2R76065R9V0L3N8QV9MFWU9RYHVPJ5XSZ3P4HY734QDZHXYSV89EQYVMZQSNFW3PXCMMRDDPX7MMDYPP8YATWVD5ZQMMWYPQH2EM4WD6ZQVESYQ5YYUN4DE3KSGZ0DEK8J2GCQZPGXQRRSS6LQA5JLLVUGLW5TPSUG4S2TMT5C8FNERR95FUH8HTCSYX52CP3WZSWJ32XJ5GEWYFN7MG293V6JLA9CZ8ZNDHWDHCNNKUL2QKF6PJLSPJ2NL3J"

    const { valid, paymentType, errorMessage } = validPayment(address, network, "", "")
    expect(valid).toBeTruthy()
    expect(paymentType).toBe("lightning")
    expect(errorMessage).not.toBe("invoice has expired")
  })
})

//
// FIXME:
// need to mockup
//
// const myPubKey = getPubKey(client)
// const username = getMyUsername(client)
//
//
// it('lightning username', () => {
//   const invoice = "lnbcrt1p06472cpp5p3gfqm90wcj9zg7kdy8arvwxwnnuem5juazdaxgpl5awygn4ackq9qy9qsqxq92fjuqdq9v93xxsp54fwkhugr4lv2r3v5jp35d3jk4emfmxske6yt7mewv4xgj2c7uklqcqzpulq2v93xxer9vcu740zxh4qwamnkvw7q056x7fypqntpkf29kqushvf22yq297vc7hl0umxnszpgkc9w5xafuefusfjhmshak8can3f08gk3rrfm4nnrsq6r04nh"

//   const checkValidLightning = (destination, username) => {
//     const {valid, paymentType} = validPayment(invoice, "regtest", client)
//     expect(valid).toBeTruthy()
//     expect(paymentType).toBe("lightning")
//     // console.log(errorMessage)
//   }

//   const checkInvalidLightning = (destination, username) => {
//     const {valid, paymentType, errorMessage} = validPayment(invoice, "regtest", client)
//     expect(valid).toBeFalsy()
//     expect(paymentType).toBe("lightning")
//     expect(errorMessage).toBe("invoice needs to be for a different user")
//   }

//   checkValidLightning("032569bb72737c1c1e50f5babf763b56e0a36046f960d67e4273bddc632607cb1f", "abc")
//   checkValidLightning("032569bb72737c1c1e50f5babf763b56e0a36046f960d67e4273bddc63260aaaaa", "abcdef")
//   checkInvalidLightning("032569bb72737c1c1e50f5babf763b56e0a36046f960d67e4273bddc632607cb1f", "abcdef")

// })
