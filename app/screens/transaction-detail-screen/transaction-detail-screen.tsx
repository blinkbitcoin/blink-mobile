import { StackNavigationProp } from "@react-navigation/stack"
import { RouteProp } from "@react-navigation/native"
import * as React from "react"
import { Text, View, Linking, TouchableWithoutFeedback } from "react-native"
import { Divider } from "react-native-elements"
import EStyleSheet from "react-native-extended-stylesheet"
import { CloseCross } from "../../components/close-cross"
import {
  colorTypeFromIconType,
  IconTransaction,
} from "../../components/icon-transactions"
import { Screen } from "../../components/screen"
import { TextCurrency } from "../../components/text-currency"
import { translate } from "../../i18n"
import type { ScreenType } from "../../types/jsx"
import type { RootStackParamList } from "../../navigation/stack-param-lists"
import { palette } from "../../theme/palette"
import moment from "moment"
import { formatUsdAmount } from "../../hooks"
import Icon from "react-native-vector-icons/Ionicons"
import { BLOCKCHAIN_EXPLORER_URL } from "../../constants/support"

const viewInExplorer = (hash: string): Promise<Linking> =>
  Linking.openURL(BLOCKCHAIN_EXPLORER_URL + hash)

const styles = EStyleSheet.create({
  amount: {
    color: palette.white,
    fontSize: "32rem",
  },

  amountSecondary: {
    color: palette.white,
    fontSize: "16rem",
  },

  amountText: {
    color: palette.white,
    fontSize: "18rem",
    marginVertical: "6rem",
  },

  amountView: {
    alignItems: "center",
    paddingBottom: "24rem",
    paddingTop: "48rem",
  },

  description: {
    marginVertical: 12,
  },

  divider: {
    backgroundColor: palette.midGrey,
    marginVertical: "12rem",
  },

  entry: {
    color: palette.midGrey,
    marginBottom: "6rem",
  },

  transactionDetailText: {
    color: palette.darkGrey,
    fontSize: "18rem",
    fontWeight: "bold",
  },

  transactionDetailView: {
    marginHorizontal: "24rem",
    marginVertical: "24rem",
  },

  value: {
    color: palette.darkGrey,
    fontSize: "14rem",
    fontWeight: "bold",
  },
})

const Row = ({
  entry,
  value,
  type,
  navigation,
}: {
  entry: string
  value: string
  type?: SettlementViaType
  navigation: StackNavigationProp<RootStackParamList, "transactionDetail">
}) => {
  const bbOrderNbr = value.match(/Order (\d+)/)?.[1]

  return (
    <View style={styles.description}>
      <Text style={styles.entry}>
        {entry + " "}
        {type === "SettlementViaOnChain" && (
          <Icon name="open-outline" size={18} color={palette.darkGrey} />
        )}
        {bbOrderNbr && (
          <Icon name="information-circle-outline" size={18} color={palette.darkGrey} onPress={() => {
            navigation.navigate("sinpeScreen", {
              orderNbr: bbOrderNbr,
            })
          }} />
        )}
      </Text>
      <Text selectable style={styles.value}>
        {value}
      </Text>
    </View>
  )
}

type Props = {
  navigation: StackNavigationProp<RootStackParamList, "transactionDetail">
  route: RouteProp<RootStackParamList, "transactionDetail">
}

const typeDisplay = (type: SettlementViaType) => {
  switch (type) {
    case "SettlementViaOnChain":
      return "OnChain"
    case "SettlementViaLn":
      return "Lightning"
    case "SettlementViaIntraLedger":
      return "BitcoinJungle"
  }
}

export const TransactionDetailScreen: ScreenType = ({ route, navigation }: Props) => {
  const {
    id,
    description,

    settlementAmount,
    settlementFee,
    settlementPrice,
    usdAmount,

    settlementVia,
    initiationVia,

    isReceive,
    isPending,
    createdAt,
  } = route.params

  const spendOrReceiveText = isReceive
    ? translate("TransactionDetailScreen.received")
    : translate("TransactionDetailScreen.spent")

  const { base, offset } = settlementPrice
  const usdPerSat = base / 10 ** offset / 100

  const feeEntry = `${settlementFee} sats (${formatUsdAmount(
    settlementFee * usdPerSat,
  )})`



  const dateDisplay = moment.unix(createdAt).toDate().toLocaleString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  })

  return (
    <Screen backgroundColor={palette.white} unsafe preset="scroll">
      <View
        style={[
          styles.amountView,
          { backgroundColor: colorTypeFromIconType({ isReceive, isPending }) },
        ]}
      >
        <IconTransaction isReceive={isReceive} size={100} transparent />

        <Text style={styles.amountText}>{spendOrReceiveText}</Text>
        <TextCurrency amount={Math.abs(usdAmount)} currency="USD" style={styles.amount} />
        <TextCurrency
          amount={Math.abs(settlementAmount)}
          currency="BTC"
          style={styles.amountSecondary}
        />
      </View>

      <View style={styles.transactionDetailView}>
        <Text style={styles.transactionDetailText}>
          {translate("TransactionDetailScreen.detail")}
        </Text>
        <Divider style={styles.divider} />
        <Row entry={translate("common.date")} value={dateDisplay} navigation={navigation} />
        {!isReceive && <Row entry={translate("common.fees")} value={feeEntry} navigation={navigation} />}
        <Row entry={translate("common.description")} value={description} navigation={navigation} />
        {settlementVia.__typename === "SettlementViaIntraLedger" && (
          <Row
            entry={translate("TransactionDetailScreen.paid")}
            value={settlementVia.counterPartyUsername || "Bitcoin Jungle Wallet"}
            navigation={navigation}
          />
        )}
        <Row
          entry={translate("common.type")}
          value={typeDisplay(settlementVia.__typename)}
          navigation={navigation}
        />
        {settlementVia.__typename === "SettlementViaLn" && (
          <Row entry="Hash" value={initiationVia.paymentHash} navigation={navigation} />
        )}
        {settlementVia.__typename === "SettlementViaOnChain" && (
          <TouchableWithoutFeedback
            onPress={() => viewInExplorer(settlementVia.transactionHash)}
          >
            <View>
              <Row
                entry="Hash"
                value={settlementVia.transactionHash}
                type={settlementVia.__typename}
                navigation={navigation}
              />
            </View>
          </TouchableWithoutFeedback>
        )}
        {id && <Row entry="id" value={id} navigation={navigation} />}
      </View>
      <CloseCross color={palette.white} onPress={() => navigation.goBack()} />
    </Screen>
  )
}
