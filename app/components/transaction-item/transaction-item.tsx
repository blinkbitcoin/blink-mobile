import React from "react"
import { View } from "react-native"

import { useFragment } from "@apollo/client"
import {
  TransactionFragment,
  TransactionFragmentDoc,
  WalletCurrency,
} from "@app/graphql/generated"
import { useHideAmount } from "@app/graphql/hide-amount-context"
import { useAppConfig } from "@app/hooks"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { toWalletAmount } from "@app/types/amounts"
import { testProps } from "@app/utils/testProps"
import { useNavigation, useIsFocused } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { Text, makeStyles, ListItem } from "@rn-vui/themed"
import Animated, { useSharedValue, useAnimatedStyle } from "react-native-reanimated"

import { IconTransaction } from "../icon-transactions"
import { TransactionDate } from "../transaction-date"
import { DeepPartialObject } from "./index.types"
import { useBounceInAnimation } from "@app/components/notification-badge/bounce-in-animation"

// This should extend the Transaction directly from the cache
export const useDescriptionDisplay = ({
  tx,
  bankName,
}: {
  tx: TransactionFragment | DeepPartialObject<TransactionFragment>
  bankName: string
}) => {
  const { LL } = useI18nContext()

  if (!tx) {
    return ""
  }

  const { memo, direction, settlementVia } = tx
  if (memo) {
    return memo
  }

  const isReceive = direction === "RECEIVE"

  switch (settlementVia?.__typename) {
    case "SettlementViaOnChain":
      return "OnChain Payment"
    case "SettlementViaLn":
      return "Invoice"
    case "SettlementViaIntraLedger":
      return isReceive
        ? `${LL.common.from()} ${
            settlementVia.counterPartyUsername || bankName + " User"
          }`
        : `${LL.common.to()} ${settlementVia.counterPartyUsername || bankName + " User"}`
  }
}

type Props = {
  txid: string
  subtitle?: boolean
  isFirst?: boolean
  isLast?: boolean
  isOnHomeScreen?: boolean
  testId?: string
  highlight?: boolean
  onPressHighlight?: (txid: string) => void
}

const TransactionItem: React.FC<Props> = ({
  txid,
  subtitle = false,
  isFirst = false,
  isLast = false,
  isOnHomeScreen = false,
  testId = "transaction-item",
  highlight = false,
  onPressHighlight,
}) => {
  const styles = useStyles({
    isFirst,
    isLast,
    isOnHomeScreen,
    highlight,
  })

  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const { data: tx } = useFragment<TransactionFragment>({
    fragment: TransactionFragmentDoc,
    fragmentName: "Transaction",
    from: {
      __typename: "Transaction",
      id: txid,
    },
  })

  const {
    appConfig: { galoyInstance },
  } = useAppConfig()
  const { formatMoneyAmount, formatCurrency } = useDisplayCurrency()

  const { hideAmount } = useHideAmount()

  const description = useDescriptionDisplay({
    tx,
    bankName: galoyInstance.name,
  })

  const isFocused = useIsFocused()
  const scale = useSharedValue(1)
  useBounceInAnimation({
    isFocused,
    visible: highlight,
    scale,
    delay: 300,
    duration: 120,
  })
  const animatedStyle = useAnimatedStyle(
    () => ({ transform: [{ scale: scale.value }] }),
    [scale],
  )

  if (!tx || Object.keys(tx).length === 0) {
    return null
  }

  if (
    !tx.settlementCurrency ||
    !tx.settlementDisplayAmount ||
    !tx.settlementDisplayCurrency ||
    !tx.id ||
    !tx.createdAt ||
    !tx.status
  ) {
    return null
  }

  const isReceive = tx.direction === "RECEIVE"
  const isPending = tx.status === "PENDING"

  const amountStyle = isPending
    ? styles.pending
    : isReceive
      ? styles.receive
      : styles.send

  const walletCurrency = tx.settlementCurrency as WalletCurrency

  const formattedSettlementAmount = formatMoneyAmount({
    moneyAmount: toWalletAmount({
      amount: tx.settlementAmount,
      currency: tx.settlementCurrency,
    }),
  })

  const formattedDisplayAmount = formatCurrency({
    amountInMajorUnits: tx.settlementDisplayAmount,
    currency: tx.settlementDisplayCurrency,
  })

  const formattedSecondaryAmount =
    tx.settlementDisplayCurrency === tx.settlementCurrency
      ? undefined
      : formattedSettlementAmount

  return (
    <Animated.View style={animatedStyle}>
      <ListItem
        {...testProps(testId)}
        containerStyle={styles.container}
        onPress={() => {
          if (highlight && onPressHighlight) onPressHighlight(txid)

          navigation.navigate("transactionDetail", {
            txid,
          })
        }}
      >
        <IconTransaction
          onChain={tx.settlementVia?.__typename === "SettlementViaOnChain"}
          isReceive={isReceive}
          pending={isPending}
          walletCurrency={walletCurrency}
        />
        <ListItem.Content {...testProps("list-item-content")}>
          <ListItem.Title
            numberOfLines={1}
            ellipsizeMode="tail"
            {...testProps("tx-description")}
          >
            {description}
          </ListItem.Title>
          <ListItem.Subtitle>
            {subtitle ? (
              <TransactionDate
                createdAt={tx.createdAt}
                status={tx.status}
                includeTime={false}
              />
            ) : undefined}
          </ListItem.Subtitle>
        </ListItem.Content>

        {hideAmount ? (
          <Text>****</Text>
        ) : (
          <View>
            <Text style={amountStyle}>{formattedDisplayAmount}</Text>
            {formattedSecondaryAmount && (
              <Text style={amountStyle}>{formattedSecondaryAmount}</Text>
            )}
          </View>
        )}
      </ListItem>
    </Animated.View>
  )
}

export const MemoizedTransactionItem = React.memo(TransactionItem)

type UseStyleProps = {
  isFirst?: boolean
  isLast?: boolean
  isOnHomeScreen?: boolean
  highlight?: boolean
}

const useStyles = makeStyles(({ colors }, props: UseStyleProps) => ({
  container: {
    height: 60,
    paddingVertical: 9,
    borderColor: colors.grey4,
    overflow: "hidden",
    backgroundColor: props.highlight ? colors.grey4 : colors.grey5,
    borderTopWidth: (props.isFirst && props.isOnHomeScreen) || !props.isFirst ? 1 : 0,
    borderBottomLeftRadius: props.isLast && props.isOnHomeScreen ? 12 : 0,
    borderBottomRightRadius: props.isLast && props.isOnHomeScreen ? 12 : 0,
  },
  hiddenBalanceContainer: {
    fontSize: 16,
    color: colors.grey0,
  },
  pending: {
    color: colors.grey1,
    textAlign: "right",
    flexWrap: "wrap",
  },
  receive: {
    color: colors._green,
    textAlign: "right",
    flexWrap: "wrap",
  },
  send: {
    color: colors.grey0,
    textAlign: "right",
    flexWrap: "wrap",
  },
}))
