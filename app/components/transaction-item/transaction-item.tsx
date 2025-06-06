import * as React from "react"
import { useState, useEffect } from "react"
import { StackNavigationProp } from "@react-navigation/stack"
import { ListItem, Icon } from "react-native-elements"
import { Text } from "react-native"
import EStyleSheet from "react-native-extended-stylesheet"
// import Icon from "react-native-vector-icons/Ionicons"
import { IconTransaction } from "../icon-transactions"
import { palette } from "../../theme/palette"
import { ParamListBase } from "@react-navigation/native"
import { prefCurrencyVar as primaryCurrencyVar } from "../../graphql/client-only-query"
import { useHideBalance } from "../../hooks"
import * as currency_fmt from "currency.js"
import i18n from "i18n-js"
import moment from "moment"

const styles = EStyleSheet.create({
  container: {
    paddingVertical: 9,
  },

  hiddenBalanceContainer: {
    fontSize: "16rem",
  },

  pending: {
    color: palette.midGrey,
  },

  receive: {
    color: palette.green,
  },

  send: {
    color: palette.darkGrey,
  },

  subtitle: {
    fontSize: "12rem",
    color: palette.darkGrey,
  },
})

export interface TransactionItemProps {
  navigation: StackNavigationProp<ParamListBase>
  tx: WalletTransaction
  subtitle?: boolean
  showFullDate?: boolean
}

moment.locale(i18n.locale)

const dateDisplay = ({ createdAt, showFullDate }) => {
  if (!createdAt || isNaN(createdAt)) {
    console.error("Invalid 'createdAt' value:", createdAt);
    return '';
  }
  const locale = i18n.locale.split('-')[0] || 'en';
  return showFullDate
    ? moment.unix(createdAt).locale(locale).format('L h:mm a')
    : moment.duration(Math.min(0, moment.unix(createdAt).diff(moment()))).humanize(true);
};

const computeCurrencyAmount = (tx: WalletTransaction) => {
  const { settlementAmount, settlementPrice } = tx
  const { base, offset } = settlementPrice
  const usdPerSat = base / 10 ** offset / 100
  return settlementAmount * usdPerSat
}

const amountDisplay = ({ primaryCurrency, settlementAmount, currencyAmount }) => {
  const symbol = primaryCurrency === "USD" ? "₡" : ""
  const precision = primaryCurrency === "USD" ? 0 : Math.abs(currencyAmount) < 0.01 ? 4 : 2

  return currency_fmt
    .default(primaryCurrency != "USD" ? settlementAmount : currencyAmount, {
      separator: ".",
      symbol,
      precision,
      decimal: ","
    })
    .format()
}

const descriptionDisplay = (tx: WalletTransaction) => {
  const { memo, direction, settlementVia } = tx
  if (memo) {
    return memo
  }

  const isReceive = direction === "RECEIVE"

  switch (settlementVia.__typename) {
    case "SettlementViaOnChain":
      return "OnChain Payment"
    case "SettlementViaLn":
      return "Invoice"
    case "SettlementViaIntraLedger":
      return isReceive
        ? `From ${settlementVia.counterPartyUsername || "Bitcoin Jungle Wallet"}`
        : `To ${settlementVia.counterPartyUsername || "Bitcoin Jungle Wallet"}`
  }
}

const amountDisplayStyle = ({ isReceive, isPending }) => {
  if (isPending) {
    return styles.pending
  }

  return isReceive ? styles.receive : styles.send
}

export const TransactionItem: React.FC<TransactionItemProps> = ({
  tx,
  navigation,
  subtitle = false,
  showFullDate = false,
}: TransactionItemProps) => {
  const primaryCurrency = primaryCurrencyVar()
  const hideBalance = useHideBalance()

  const isReceive = tx.direction === "RECEIVE"
  const isPending = tx.status === "PENDING"
  const description = descriptionDisplay(tx)
  const bbOrderNbr = description.match(/Order (\d+)/)?.[1]
  const currencyAmount = computeCurrencyAmount(tx)

  const [txHideBalance, setTxHideBalance] = useState(hideBalance)

  useEffect(() => {
    setTxHideBalance(hideBalance)
  }, [hideBalance])

  const pressTxAmount = () => setTxHideBalance((prev) => !prev)

  return (
    <ListItem
      containerStyle={styles.container}
      onPress={() =>
        navigation.navigate("transactionDetail", {
          ...tx,
          isReceive,
          isPending,
          description,
          currencyAmount,
        })
      }
    >
      <IconTransaction isReceive={isReceive} size={24} pending={isPending} />
      <ListItem.Content>
        <ListItem.Title>{description}</ListItem.Title>
        <ListItem.Subtitle style={styles.subtitle}>
          {subtitle ? dateDisplay({...tx, showFullDate}) : undefined}
          {bbOrderNbr && <Icon name="info-outline" size={16} color={palette.darkGrey} onPress={() => {
            navigation.navigate("sinpeScreen", {
              orderNbr: bbOrderNbr,
            })
          }} />}
        </ListItem.Subtitle>
      </ListItem.Content>
      {txHideBalance ? (
        <Icon style={styles.hiddenBalanceContainer} name="eye" onPress={pressTxAmount} />
      ) : (
        <Text
          style={amountDisplayStyle({ isReceive, isPending })}
          onPress={hideBalance ? pressTxAmount : undefined}
        >
          {amountDisplay({ ...tx, currencyAmount, primaryCurrency })}
        </Text>
      )}
    </ListItem>
  )
}
