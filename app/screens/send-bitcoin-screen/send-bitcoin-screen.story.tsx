import * as React from "react"
import { withKnobs } from "@storybook/addon-knobs"
import { storiesOf } from "@storybook/react-native"

import { StoryScreen } from "../../../storybook/views"
import { SendBitcoinScreenJSX } from "./send-bitcoin-screen"
import { formatUsdAmount } from "../../hooks"

const noop = () => null
const defaultParams = {
  setStatus: noop,
  setAmount: noop,
  goBack: noop,
  pay: noop,
  price: 10000,
  prefCurrency: "BTC",
  nextPrefCurrency: noop,
  invoice:
    "lnbc1p0kxle6pp5f936pgsmu7qjk0tph7uw8v9vhqlq3k37k3w6tulhy3rkf9ecqqcsdqu2askcmr9wssx7e3q2dshgmmndp5scqzpgxqyz5vqsp5z2hre6tcqrs67emaqvlewhf8klzm7hx5ly3scs7lkd4xlrgp52gs9qy9qsq0k704xkrj82sueam0zthx95luwdpeg60307x48gq3mrrwdnz6g0y2vpluy5z8keep463gdenrfy23f23mayhevs27ffjvu5nh0napacqjdeesl",
  address: "bcrt1qttw6a49hcayl0nx0xm7yur4pw9szftaanxpmd5",
  destination: "test",
}

declare let module

storiesOf("Send bitcoin Screen", module)
  .addDecorator(withKnobs)
  .addDecorator((fn) => <StoryScreen>{fn()}</StoryScreen>)
  .add("Loading", () => (
    <SendBitcoinScreenJSX
      status="loading"
      paymentType="lightning"
      amountless={false}
      initAmount={1000}
      note=""
      err=""
      amount={1000}
      primaryAmount={{
        value: 1000,
        currency: "BTC",
      }}
      secondaryAmount={{
        value: 1000,
        currency: "USD",
      }}
      {...defaultParams}
    />
  ))
  .add("Idle", () => (
    <SendBitcoinScreenJSX
      status="idle"
      paymentType="lightning"
      amountless={false}
      initAmount={1000}
      note="this is my note"
      err={null}
      amount={1000}
      primaryAmount={{
        value: 1000,
        currency: "BTC",
      }}
      secondaryAmount={{
        value: 1000,
        currency: "USD",
      }}
      {...defaultParams}
    />
  ))
  .add("success", () => (
    <SendBitcoinScreenJSX
      status="success"
      paymentType="lightning"
      amountless={false}
      initAmount={1000}
      note={null}
      err={null}
      amount={1000}
      primaryAmount={{
        value: 1000,
        currency: "BTC",
      }}
      secondaryAmount={{
        value: 1000,
        currency: "USD",
      }}
      {...defaultParams}
    />
  ))
  .add("bitcoin", () => (
    <SendBitcoinScreenJSX
      status="idle"
      paymentType="onchain"
      amountless={false}
      initAmount={1000}
      note={null}
      err={null}
      amount={1000}
      primaryAmount={{
        value: 1000,
        currency: "BTC",
      }}
      secondaryAmount={{
        value: 1000,
        currency: "USD",
      }}
      fee={formatUsdAmount(1234 * 9.3927e-5)}
      {...defaultParams}
    />
  ))
  .add("bitcoin fee loading", () => (
    <SendBitcoinScreenJSX
      status="idle"
      paymentType="onchain"
      amountless={false}
      initAmount={1000}
      note={null}
      err={null}
      amount={1000}
      fee={undefined}
      primaryAmount={{
        value: 1000,
        currency: "BTC",
      }}
      secondaryAmount={{
        value: 1000,
        currency: "USD",
      }}
      {...defaultParams}
    />
  ))
