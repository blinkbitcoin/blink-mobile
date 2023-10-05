import * as React from "react"
import { StyleSheet, Dimensions } from "react-native"
import LottieView from "lottie-react-native"
import WhatIsBitcoinSVG from "./01-so-what-exactly-is-bitcoin-01.svg"
import SatSVG from "./02-i-just-earned-a-sat-01.svg"
import WhereBitcoinExistSVG from "./03-where-do-the-bitcoins-exist-01.svg"
import WhoControlsBitcoinSVG from "./04-who-controls-Bitcoin-01.svg"
import CopyBitcoinSVG from "./05-cant-copy-bitcoin-01.svg"

import MoneySocialAggrement from "./01-money-is-a-social-agreement-01.svg"
import MoneySocialAggrementDark from "./01-money-is-a-social-agreement-02.svg"
import CoincidenceOfWants from "./02-coincidence-of-wants-01.svg"
import MoneyEvolution from "./03-money-has-evolved-01.svg"
import WhyStonesShellGold from "./04-why-used-as-money-01.svg"
import WhyStonesShellGoldDark from "./04-why-used-as-money-02.svg"
import MoneyIsImportant from "./05-money-is-important-01.svg"
import MoneyImportantGovernement from "./06-important-to-governments-03.svg"

import WhatIsFiat from "./01-fiat-currency-01.svg"
import GovernementCanPrintMoney from "./03-print-unlimited-money-01.svg"
import GovernementCanPrintMoneyDark from "./03-print-unlimited-money-02.svg"
import FiatLosesValueOverTime from "./04-fiat-money-loses-value-01.svg"
import FiatLosesValueOverTimeDark from "./04-fiat-money-loses-value-02.svg"
import OtherIssues from "./05-are-there-other-issues-01.svg"
import OtherIssuesDark from "./05-are-there-other-issues-02.svg"

import LimitedSupply from "./01-limited-supply-01.svg"
import Decentralized from "./02-decentralized-01.svg"
import DecentralizedDark from "./02-decentralized-02.svg"
import NoCounterfeitMoney from "./03-no-counterfeit-money-01.svg"
import NoCounterfeitMoneyDark from "./03-no-counterfeit-money-02.svg"
import HighlyDivisible from "./04-highly-divisible-01.svg"
import SecurePartOne from "./05-secure-part-i-01.svg"
import SecurePartOneDark from "./05-secure-part-i-02.svg"
import SecurePartTwo from "./06-secure-part-ii-01.svg"
import SecurePartTwoDark from "./06-secure-part-ii-02.svg"

import lottieTest from "./02-i-trust-my-government-02.json"

interface ISVGs {
  name: string
  width?: number
  theme?: "dark" | "light"
}

const styles = StyleSheet.create({
  lottieContainer: { alignSelf: "center" },
})

export const SVGs = ({ name, width, theme }: ISVGs): SVGElement => {
  const { width: screenWidth } = Dimensions.get("window")

  const rWidth = width ?? screenWidth

  switch (name) {
    case "whatIsBitcoin":
      return <WhatIsBitcoinSVG width={rWidth} />
    case "sat":
      return <SatSVG width={rWidth} />
    case "whereBitcoinExist":
      return <WhereBitcoinExistSVG width={rWidth} />
    case "whoControlsBitcoin":
      return <WhoControlsBitcoinSVG width={rWidth} />
    case "copyBitcoin":
      return <CopyBitcoinSVG width={rWidth} />

    case "moneySocialAggrement":
      return theme === "dark" ? (
        <MoneySocialAggrementDark width={rWidth} />
      ) : (
        <MoneySocialAggrement width={rWidth} />
      )
    case "coincidenceOfWants":
      return <CoincidenceOfWants width={rWidth} />
    case "moneyEvolution":
      return <MoneyEvolution width={rWidth} />
    case "whyStonesShellGold":
      return theme === "dark" ? (
        <WhyStonesShellGoldDark width={rWidth} />
      ) : (
        <WhyStonesShellGold width={rWidth} />
      )
    case "moneyIsImportant":
      return <MoneyIsImportant width={rWidth} />
    case "moneyImportantGovernement":
      return <MoneyImportantGovernement width={rWidth} />

    case "WhatIsFiat":
      return <WhatIsFiat width={rWidth} />
    // case "whyCareAboutFiatMoney": return <WhyCareAboutFiatMoney width={rWidth} />
    case "GovernementCanPrintMoney":
      return theme === "dark" ? (
        <GovernementCanPrintMoneyDark width={rWidth} />
      ) : (
        <GovernementCanPrintMoney width={rWidth} />
      )
    case "FiatLosesValueOverTime":
      return theme === "dark" ? (
        <FiatLosesValueOverTimeDark width={rWidth} />
      ) : (
        <FiatLosesValueOverTime width={rWidth} />
      )
    case "OtherIssues":
      return theme === "dark" ? (
        <OtherIssuesDark width={rWidth} />
      ) : (
        <OtherIssues width={rWidth} />
      )

    case "LimitedSupply":
      return <LimitedSupply width={rWidth} />
    case "Decentralized":
      return theme === "dark" ? (
        <DecentralizedDark width={rWidth} />
      ) : (
        <Decentralized width={rWidth} />
      )
    case "NoCounterfeitMoney":
      return theme === "dark" ? (
        <NoCounterfeitMoneyDark width={rWidth} />
      ) : (
        <NoCounterfeitMoney width={rWidth} />
      )
    case "HighlyDivisible":
      return <HighlyDivisible width={rWidth} />
    case "securePartOne":
      return theme === "dark" ? (
        <SecurePartOneDark width={rWidth} />
      ) : (
        <SecurePartOne width={rWidth} />
      )
    case "securePartTwo":
      return theme === "dark" ? (
        <SecurePartTwoDark width={rWidth} />
      ) : (
        <SecurePartTwo width={rWidth} />
      )

    default:
      return (
        // <LottieView
        //   source={lottieTest}
        //   style={[styles.lottieContainer, { width: rWidth }]}
        //   autoPlay
        //   loop
        // />
        <WhatIsBitcoinSVG width={rWidth} />
      )
    // default: return <Text>{name} does not exist</Text>
  }
}
