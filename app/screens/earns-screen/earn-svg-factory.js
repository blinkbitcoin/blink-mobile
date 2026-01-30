import * as React from "react";
import { Dimensions, Text } from "react-native";
import WhatIsFiat from "./01-fiat-currency-01.svg";
import LimitedSupply from "./01-limited-supply-01.svg";
import MoneySocialAgreement from "./01-money-is-a-social-agreement-01.svg";
import MoneySocialAgreementDark from "./01-money-is-a-social-agreement-02.svg";
import WhatIsBitcoinSVG from "./01-so-what-exactly-is-bitcoin-01.svg";
import CoincidenceOfWants from "./02-coincidence-of-wants-01.svg";
import Decentralized from "./02-decentralized-01.svg";
import DecentralizedDark from "./02-decentralized-02.svg";
import SatSVG from "./02-i-just-earned-a-sat-01.svg";
import WhyCareAboutFiatMoney from "./02-i-trust-my-government-01.svg";
import MoneyEvolution from "./03-money-has-evolved-01.svg";
import NoCounterfeitMoney from "./03-no-counterfeit-money-01.svg";
import NoCounterfeitMoneyDark from "./03-no-counterfeit-money-02.svg";
import GovernementCanPrintMoney from "./03-print-unlimited-money-01.svg";
import GovernementCanPrintMoneyDark from "./03-print-unlimited-money-02.svg";
import WhereBitcoinExistSVG from "./03-where-do-the-bitcoins-exist-01.svg";
import FiatLosesValueOverTime from "./04-fiat-money-loses-value-01.svg";
import FiatLosesValueOverTimeDark from "./04-fiat-money-loses-value-02.svg";
import HighlyDivisible from "./04-highly-divisible-01.svg";
import WhoControlsBitcoinSVG from "./04-who-controls-Bitcoin-01.svg";
import WhyStonesShellGold from "./04-why-used-as-money-01.svg";
import WhyStonesShellGoldDark from "./04-why-used-as-money-02.svg";
import OtherIssues from "./05-are-there-other-issues-01.svg";
import OtherIssuesDark from "./05-are-there-other-issues-02.svg";
import CopyBitcoinSVG from "./05-cant-copy-bitcoin-01.svg";
import MoneyIsImportant from "./05-money-is-important-01.svg";
import SecurePartOne from "./05-secure-part-i-01.svg";
import SecurePartOneDark from "./05-secure-part-i-02.svg";
import MoneyImportantGovernement from "./06-important-to-governments-03.svg";
import SecurePartTwo from "./06-secure-part-ii-01.svg";
import SecurePartTwoDark from "./06-secure-part-ii-02.svg";
import OriginsOfMoney from "./201-01-origins-of-money.svg";
import PrimitiveMoney from "./201-02-primitive-money.svg";
import AnticipatingDemand from "./201-03-anticipating-demand.svg";
import NashEquilibrium from "./201-04-nash-equilibrium.svg";
import SingleStoreOfValue from "./201-05-single-store-of-value.svg";
import WhatIsGoodSOV from "./202-01-what-is-good-sov.svg";
import Durability from "./202-02-durability.svg";
import Portability from "./202-03-portability.svg";
import Fungibility from "./202-04-fungibility.svg";
import Verifiability from "./202-05-verifiability.svg";
import Divisibility from "./202-06-devisibility.svg";
import Scarce from "./202-07-scarce.svg";
import EstablishedHistory from "./202-08-established-history.svg";
import CensorshipResistance from "./202-09-censorship-resistance.svg";
import EvolutionMoney from "./203-01-evolution-money.svg";
import Collectible from "./203-02-collectible.svg";
import StoreOfValue from "./203-03-store-of-value.svg";
import MediumOfExchange from "./203-04-medium-of-exchange.svg";
import UnitOfAccount from "./203-05-unit-of-account.svg";
import PartlyMonetized from "./203-06-partly-monetized.svg";
import MonetizationStage from "./203-07-monetization-stage.svg";
import NotFromGovernment from "./204-01-not-from-government.svg";
import PrimaryFunction from "./204-02-primary-function.svg";
import MonetaryMetals from "./204-03-monetary-metals.svg";
import StockToFlow from "./204-05-stock-to-flow.svg";
import HardMoney from "./204-06-hard-money.svg";
import ConvergingOnGold from "./205-01-converging-on-gold.svg";
import OriginsOfPaperMoney from "./205-02-origins-of-paper-money.svg";
import FractionalReserve from "./205-03-fractional-reserve.svg";
import BankRun from "./205-04-bank-run.svg";
import ModernCentralBanking from "./205-05-modern-central-banking.svg";
import GoldBacked from "./205-06-gold-backed.svg";
import BrettonWoods from "./205-07-bretton-woods.svg";
import GlobalReserve from "./205-08-global-reserve.svg";
import NixonShock from "./206-01-nixon-shock.svg";
import FiatEra from "./206-02-fiat-era.svg";
import DigitalFiat from "./206-03-digital-fiat.svg";
import PlasticCredit from "./206-04-plastic-credit.svg";
import DoubleSpendProblem from "./206-05-double-spend-problem.svg";
import SatoshisBreakthrough from "./206-06-Satoshis-breakthrough.svg";
import NativelyDigital from "./206-07-natively-digital.svg";
import CBDCs from "./206-08-CBDCs.svg";
import RootProblem from "./301-01-root-problem.svg";
import BitcoinCreator from "./301-02-bitcoin-creator.svg";
import FiatRequiresTrust from "./301-02b-fiat-requires-trust.svg";
import MoneyPrinting from "./301-03-money-printing.svg";
import GenesisBlock from "./301-04-genesis-block.svg";
import Cypherpunks from "./301-05-cypherpunks.svg";
import Peer2Peer from "./302-01-peer-to-peer.svg";
import Blockchain from "./302-02-blockchain.svg";
import PrivateKey from "./302-03-private-key.svg";
import PublicKey from "./302-04-public-key.svg";
import Mining from "./302-05-mining.svg";
import ProofOfWork from "./302-06-proof-of-work.svg";
import DifficultyAdjustment from "./302-07-difficulty-adjustment.svg";
import Halving from "./302-08-halving.svg";
import BitcoinDrawbacks from "./401-01-bitcoin-drawbacks.svg";
import BlocksizeWars from "./401-02-blocksize-wars.svg";
import LightningNetwork from "./401-03-lightning-network.svg";
import InstantPayments from "./401-04-instant-payments.svg";
import Micropayments from "./401-05-micro-payments.svg";
import Scalability from "./401-06-scalability.svg";
import PaymentChannels from "./401-07-payment-channels.svg";
import Routing from "./401-08-routing.svg";
import ItsaBubble from "./501-01-its-a-bubble.svg";
import ItstooVolatile from "./501-02-its-too-volatile.svg";
import ItsnotBacked from "./501-03-its-not-backed.svg";
import WillbecomeObsolete from "./501-04-will-become-obsolete.svg";
import ToomuchEnergy from "./501-05-too-much-energy.svg";
import StrandedEnergy from "./501-06-stranded-energy.svg";
import InternetDependent from "./502-01-internet-dependent.svg";
import ForcrimeOnly from "./502-02-for-crime-only.svg";
import PonziScheme from "./502-03-ponzi-scheme.svg";
import BitcoinisTooSlow from "./502-04-bitcoin-is-too-slow.svg";
import SupplyLimit from "./502-05-supply-limit.svg";
import GovernmentBan from "./502-06-government-ban.svg";
import ConcentratedOwnership from "./503-01-concentrated-ownership.svg";
import CentralizedMining from "./503-02-centralized-mining.svg";
import TooExpensive from "./503-03-too-expensive.svg";
import ProhibitivelyHigh from "./503-04-prohibitively-high.svg";
import WillBeHoarded from "./503-05-will-be-hoarded.svg";
import CanBeDuplicated from "./503-06-can-be-duplicated.svg";
import Scarcity from "./601-01-scarcity.svg";
import MonetaryPremium from "./601-02-monetary-premium.svg";
import GreshamsLaw from "./601-03-greshams-law.svg";
import ThiersLaw from "./601-04-thiers-law.svg";
import CantillonEffect from "./601-05-cantillon-effect.svg";
import SchellingPoint from "./601-06-schelling-point.svg";
import OpportunityCost from "./602-01-opportunity-cost.svg";
import TimePreference from "./602-02-time-preference.svg";
import ImpossibleTrinity from "./602-03-impossible-trinity.svg";
import JevonsParadox from "./602-04-jevons-paradox.svg";
import PowerLaws from "./602-05-power-laws.svg";
import WinnerTakeAll from "./602-06-winner-take-all.svg";
import UnitBias from "./603-01-unit-bias.svg";
import VeblenGood from "./603-02-veblen-good.svg";
import Malinvestment from "./603-03-malinvestment.svg";
import AsymmetricPayoff from "./603-04-asymmetric-payoff.svg";
import AnsoffMatrix from "./603-05-ansoff-matrix.svg";
export var SVGs = function (_a) {
    var name = _a.name, width = _a.width, theme = _a.theme;
    var screenWidth = Dimensions.get("window").width;
    var rWidth = width !== null && width !== void 0 ? width : screenWidth;
    switch (name) {
        case "whatIsBitcoin":
            return <WhatIsBitcoinSVG width={rWidth}/>;
        case "sat":
            return <SatSVG width={rWidth}/>;
        case "whereBitcoinExist":
            return <WhereBitcoinExistSVG width={rWidth}/>;
        case "whoControlsBitcoin":
            return <WhoControlsBitcoinSVG width={rWidth}/>;
        case "copyBitcoin":
            return <CopyBitcoinSVG width={rWidth}/>;
        case "moneySocialAgreement":
            return theme === "dark" ? (<MoneySocialAgreementDark width={rWidth}/>) : (<MoneySocialAgreement width={rWidth}/>);
        case "coincidenceOfWants":
            return <CoincidenceOfWants width={rWidth}/>;
        case "moneyEvolution":
            return <MoneyEvolution width={rWidth}/>;
        case "whyStonesShellGold":
            return theme === "dark" ? (<WhyStonesShellGoldDark width={rWidth}/>) : (<WhyStonesShellGold width={rWidth}/>);
        case "moneyIsImportant":
            return <MoneyIsImportant width={rWidth}/>;
        case "moneyImportantGovernement":
            return <MoneyImportantGovernement width={rWidth}/>;
        case "WhatIsFiat":
            return <WhatIsFiat width={rWidth}/>;
        case "whyCareAboutFiatMoney":
            return <WhyCareAboutFiatMoney width={rWidth}/>;
        case "GovernementCanPrintMoney":
            return theme === "dark" ? (<GovernementCanPrintMoneyDark width={rWidth}/>) : (<GovernementCanPrintMoney width={rWidth}/>);
        case "FiatLosesValueOverTime":
            return theme === "dark" ? (<FiatLosesValueOverTimeDark width={rWidth}/>) : (<FiatLosesValueOverTime width={rWidth}/>);
        case "OtherIssues":
            return theme === "dark" ? (<OtherIssuesDark width={rWidth}/>) : (<OtherIssues width={rWidth}/>);
        case "LimitedSupply":
            return <LimitedSupply width={rWidth}/>;
        case "Decentralized":
            return theme === "dark" ? (<DecentralizedDark width={rWidth}/>) : (<Decentralized width={rWidth}/>);
        case "NoCounterfeitMoney":
            return theme === "dark" ? (<NoCounterfeitMoneyDark width={rWidth}/>) : (<NoCounterfeitMoney width={rWidth}/>);
        case "HighlyDivisible":
            return <HighlyDivisible width={rWidth}/>;
        case "securePartOne":
            return theme === "dark" ? (<SecurePartOneDark width={rWidth}/>) : (<SecurePartOne width={rWidth}/>);
        case "securePartTwo":
            return theme === "dark" ? (<SecurePartTwoDark width={rWidth}/>) : (<SecurePartTwo width={rWidth}/>);
        case "originsOfMoney":
            return <OriginsOfMoney width={rWidth}/>;
        case "primitiveMoney":
            return <PrimitiveMoney width={rWidth}/>;
        case "anticipatingDemand":
            return <AnticipatingDemand width={rWidth}/>;
        case "nashEquilibrium":
            return <NashEquilibrium width={rWidth}/>;
        case "singleStoreOfValue":
            return <SingleStoreOfValue width={rWidth}/>;
        case "whatIsGoodSOV":
            return <WhatIsGoodSOV width={rWidth}/>;
        case "durability":
            return <Durability width={rWidth}/>;
        case "portability":
            return <Portability width={rWidth}/>;
        case "fungibility":
            return <Fungibility width={rWidth}/>;
        case "verifiability":
            return <Verifiability width={rWidth}/>;
        case "divisibility":
            return <Divisibility width={rWidth}/>;
        case "scarce":
            return <Scarce width={rWidth}/>;
        case "establishedHistory":
            return <EstablishedHistory width={rWidth}/>;
        case "censorshipResistance":
            return <CensorshipResistance width={rWidth}/>;
        case "evolutionMoney":
            return <EvolutionMoney width={rWidth}/>;
        case "collectible":
            return <Collectible width={rWidth}/>;
        case "storeOfValue":
            return <StoreOfValue width={rWidth}/>;
        case "mediumOfExchange":
            return <MediumOfExchange width={rWidth}/>;
        case "unitOfAccount":
            return <UnitOfAccount width={rWidth}/>;
        case "partlyMonetized":
            return <PartlyMonetized width={rWidth}/>;
        case "monetizationStage":
            return <MonetizationStage width={rWidth}/>;
        case "notFromGovernment":
            return <NotFromGovernment width={rWidth}/>;
        case "primaryFunction":
            return <PrimaryFunction width={rWidth}/>;
        case "monetaryMetals":
            return <MonetaryMetals width={rWidth}/>;
        case "stockToFlow":
            return <StockToFlow width={rWidth}/>;
        case "hardMoney":
            return <HardMoney width={rWidth}/>;
        case "convergingOnGold":
            return <ConvergingOnGold width={rWidth}/>;
        case "originsOfPaperMoney":
            return <OriginsOfPaperMoney width={rWidth}/>;
        case "fractionalReserve":
            return <FractionalReserve width={rWidth}/>;
        case "bankRun":
            return <BankRun width={rWidth}/>;
        case "modernCentralBanking":
            return <ModernCentralBanking width={rWidth}/>;
        case "goldBacked":
            return <GoldBacked width={rWidth}/>;
        case "brettonWoods":
            return <BrettonWoods width={rWidth}/>;
        case "globalReserve":
            return <GlobalReserve width={rWidth}/>;
        case "nixonShock":
            return <NixonShock width={rWidth}/>;
        case "fiatEra":
            return <FiatEra width={rWidth}/>;
        case "digitalFiat":
            return <DigitalFiat width={rWidth}/>;
        case "plasticCredit":
            return <PlasticCredit width={rWidth}/>;
        case "doubleSpendProblem":
            return <DoubleSpendProblem width={rWidth}/>;
        case "satoshisBreakthrough":
            return <SatoshisBreakthrough width={rWidth}/>;
        case "nativelyDigital":
            return <NativelyDigital width={rWidth}/>;
        case "CBDCs":
            return <CBDCs width={rWidth}/>;
        case "rootProblem":
            return <RootProblem width={rWidth}/>;
        case "bitcoinCreator":
            return <BitcoinCreator width={rWidth}/>;
        case "fiatRequiresTrust":
            return <FiatRequiresTrust width={rWidth}/>;
        case "moneyPrinting":
            return <MoneyPrinting width={rWidth}/>;
        case "genesisBlock":
            return <GenesisBlock width={rWidth}/>;
        case "cypherpunks":
            return <Cypherpunks width={rWidth}/>;
        case "peer2Peer":
            return <Peer2Peer width={rWidth}/>;
        case "blockchain":
            return <Blockchain width={rWidth}/>;
        case "privateKey":
            return <PrivateKey width={rWidth}/>;
        case "publicKey":
            return <PublicKey width={rWidth}/>;
        case "mining":
            return <Mining width={rWidth}/>;
        case "proofOfWork":
            return <ProofOfWork width={rWidth}/>;
        case "difficultyAdjustment":
            return <DifficultyAdjustment width={rWidth}/>;
        case "halving":
            return <Halving width={rWidth}/>;
        case "bitcoinDrawbacks":
            return <BitcoinDrawbacks width={rWidth}/>;
        case "blocksizeWars":
            return <BlocksizeWars width={rWidth}/>;
        case "lightningNetwork":
            return <LightningNetwork width={rWidth}/>;
        case "instantPayments":
            return <InstantPayments width={rWidth}/>;
        case "micropayments":
            return <Micropayments width={rWidth}/>;
        case "scalability":
            return <Scalability width={rWidth}/>;
        case "paymentChannels":
            return <PaymentChannels width={rWidth}/>;
        case "routing":
            return <Routing width={rWidth}/>;
        case "itsaBubble":
            return <ItsaBubble width={rWidth}/>;
        case "itstooVolatile":
            return <ItstooVolatile width={rWidth}/>;
        case "itsnotBacked":
            return <ItsnotBacked width={rWidth}/>;
        case "willbecomeObsolete":
            return <WillbecomeObsolete width={rWidth}/>;
        case "toomuchEnergy":
            return <ToomuchEnergy width={rWidth}/>;
        case "strandedEnergy":
            return <StrandedEnergy width={rWidth}/>;
        case "internetDependent":
            return <InternetDependent width={rWidth}/>;
        case "forcrimeOnly":
            return <ForcrimeOnly width={rWidth}/>;
        case "ponziScheme":
            return <PonziScheme width={rWidth}/>;
        case "bitcoinisTooSlow":
            return <BitcoinisTooSlow width={rWidth}/>;
        case "supplyLimit":
            return <SupplyLimit width={rWidth}/>;
        case "governmentBan":
            return <GovernmentBan width={rWidth}/>;
        case "concentratedOwnership":
            return <ConcentratedOwnership width={rWidth}/>;
        case "centralizedMining":
            return <CentralizedMining width={rWidth}/>;
        case "tooExpensive":
            return <TooExpensive width={rWidth}/>;
        case "prohibitivelyHigh":
            return <ProhibitivelyHigh width={rWidth}/>;
        case "willBeHoarded":
            return <WillBeHoarded width={rWidth}/>;
        case "canBeDuplicated":
            return <CanBeDuplicated width={rWidth}/>;
        case "scarcity":
            return <Scarcity width={rWidth}/>;
        case "monetaryPremium":
            return <MonetaryPremium width={rWidth}/>;
        case "greshamsLaw":
            return <GreshamsLaw width={rWidth}/>;
        case "thiersLaw":
            return <ThiersLaw width={rWidth}/>;
        case "cantillonEffect":
            return <CantillonEffect width={rWidth}/>;
        case "schellingPoint":
            return <SchellingPoint width={rWidth}/>;
        case "opportunityCost":
            return <OpportunityCost width={rWidth}/>;
        case "timePreference":
            return <TimePreference width={rWidth}/>;
        case "impossibleTrinity":
            return <ImpossibleTrinity width={rWidth}/>;
        case "jevonsParadox":
            return <JevonsParadox width={rWidth}/>;
        case "powerLaws":
            return <PowerLaws width={rWidth}/>;
        case "winnerTakeAll":
            return <WinnerTakeAll width={rWidth}/>;
        case "unitBias":
            return <UnitBias width={rWidth}/>;
        case "veblenGood":
            return <VeblenGood width={rWidth}/>;
        case "malinvestment":
            return <Malinvestment width={rWidth}/>;
        case "asymmetricPayoff":
            return <AsymmetricPayoff width={rWidth}/>;
        case "ansoffMatrix":
            return <AnsoffMatrix width={rWidth}/>;
        default:
            return <Text>{name} does not exist</Text>;
    }
};
//# sourceMappingURL=earn-svg-factory.js.map