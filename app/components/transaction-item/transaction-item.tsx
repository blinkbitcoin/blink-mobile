import React from "react"
import { View } from "react-native"
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated"
import { useIsFocused } from "@react-navigation/native"
import { Text, makeStyles, ListItem } from "@rn-vui/themed"
import { useFragment } from "@apollo/client"

import {
  TransactionFragment,
  TransactionFragmentDoc,
  WalletCurrency,
} from "@app/graphql/generated"
import { HiddenBalancePlaceholder } from "@app/components/hidden-balance-placeholder/hidden-balance-placeholder"
import { useHideAmount } from "@app/graphql/hide-amount-context"
import { useAppConfig } from "@app/hooks"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useBounceInAnimation } from "@app/components/animations"
import { toWalletAmount } from "@app/types/amounts"
import { testProps } from "@app/utils/testProps"

import { IconTransaction } from "../icon-transactions"
import { TransactionDate } from "../transaction-date"
import { DeepPartialObject } from "./index.types"

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

const BOUNCE_DELAY_MS = 300
const BOUNCE_DURATION_MS = 120

/**
 * Window size for the lists that render these rows.
 *
 * RN's default of 21 keeps roughly ten screens of rows mounted on either side
 * of the viewport; 7 still leaves three screens of headroom for fast scrolling.
 * If a fast fling ever shows blank cells, raise this to 9 rather than reverting.
 * Shared so the two transaction lists cannot drift apart.
 */
export const TRANSACTION_LIST_WINDOW_SIZE = 7

/**
 * Owns the navigation focus subscription that drives a row's bounce-in.
 *
 * It renders nothing and is mounted as a sibling of the row, only once that row
 * has been highlighted. `useIsFocused` re-renders every subscriber on each
 * navigation focus change, so keeping it out of the rows that never bounce is
 * what stops opening a transaction from re-rendering the whole mounted list.
 */
const BounceOnFocus: React.FC<{
  visible: boolean
  scale: SharedValue<number>
}> = ({ visible, scale }) => {
  const isFocused = useIsFocused()

  useBounceInAnimation({
    isFocused,
    visible,
    scale,
    delay: BOUNCE_DELAY_MS,
    duration: BOUNCE_DURATION_MS,
  })

  return null
}

type Props = {
  txid: string
  subtitle?: boolean
  isFirst?: boolean
  isLast?: boolean
  isOnHomeScreen?: boolean
  testId?: string
  highlight?: boolean
  onPress?: (txid: string) => void
}

const TransactionItem: React.FC<Props> = ({
  txid,
  subtitle = false,
  isFirst = false,
  isLast = false,
  isOnHomeScreen = false,
  testId = "transaction-item",
  highlight = false,
  onPress,
}) => {
  // makeStyles memoizes on the props object identity, so an object literal here
  // would rebuild every stylesheet in this file on every render of every row.
  const styleProps = React.useMemo(
    () => ({ isFirst, isLast, isOnHomeScreen, highlight }),
    [isFirst, isLast, isOnHomeScreen, highlight],
  )
  const styles = useStyles(styleProps)

  const scale = useSharedValue(1)
  const animatedStyle = useAnimatedStyle(
    () => ({ transform: [{ scale: scale.value }] }),
    [scale],
  )

  // Once a row has been highlighted, keep the subscriber mounted for the life of
  // the row rather than dropping it when the highlight clears. useBounceInAnimation
  // resets `scale` from its `visible: false` branch, not from its cleanup, so a
  // highlight clearing mid-bounce would otherwise leave the row frozen at
  // whatever scale the animation had reached. Rows that are never highlighted
  // never mount it, so they never subscribe to navigation focus.
  const everHighlighted = React.useRef(highlight)
  if (highlight) everHighlighted.current = true

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

  const handlePress = React.useCallback(() => onPress?.(txid), [onPress, txid])

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
    // Always wrapped, so the element type at this position never depends on
    // `highlight`: React does not diff across a type change, and swapping the
    // wrapper in or out would unmount and rebuild the whole row subtree at the
    // exact moment the user is looking at that row. Only the focus subscriber
    // below is conditional, and it sits in its own child slot so toggling it
    // leaves the row beside it untouched.
    <Animated.View style={animatedStyle}>
      {everHighlighted.current ? (
        <BounceOnFocus visible={highlight} scale={scale} />
      ) : null}
      <ListItem
        {...testProps(testId)}
        containerStyle={styles.container}
        // handlePress is always defined, so it is only handed over when the
        // caller actually passed an onPress — otherwise the row would become
        // pressable.
        onPress={onPress ? handlePress : undefined}
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
            style={styles.title}
            {...testProps("tx-description")}
          >
            {description}
          </ListItem.Title>
          <ListItem.Subtitle style={styles.subtitle}>
            {subtitle ? (
              <TransactionDate
                createdAt={tx.createdAt}
                status={tx.status}
                includeTime={false}
              />
            ) : undefined}
          </ListItem.Subtitle>
        </ListItem.Content>

        <View style={styles.amountWrapper}>
          {hideAmount ? (
            <HiddenBalancePlaceholder size="small" />
          ) : (
            <>
              <Text style={amountStyle}>{formattedDisplayAmount}</Text>
              {formattedSecondaryAmount && (
                <Text style={amountStyle}>{formattedSecondaryAmount}</Text>
              )}
            </>
          )}
        </View>
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
  title: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "400",
  },
  subtitle: {
    color: colors.grey2,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
  },
  amountWrapper: {
    alignItems: "flex-end",
    justifyContent: "center",
    minHeight: 40,
  },
}))
