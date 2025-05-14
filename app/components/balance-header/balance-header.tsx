import * as React from "react"
import { useCallback, useEffect, useState } from "react"
import ContentLoader, { Rect } from "react-content-loader/native"
import { StyleProp, Text, TouchableHighlight, View, ViewStyle } from "react-native"
import EStyleSheet from "react-native-extended-stylesheet"
import { Icon } from 'react-native-elements'
import Tooltip from "react-native-walkthrough-tooltip"
import { translate } from "../../i18n"
import { palette } from "../../theme/palette"
import { TextCurrency } from "../text-currency/text-currency"
import { useIsFocused } from "@react-navigation/native"
import { useWalletBalance, useHiddenBalanceToolTip, useHideBalance } from "../../hooks"
import { saveHiddenBalanceToolTip } from "../../graphql/client-only-query"
import { useApolloClient } from "@apollo/client"

const styles = EStyleSheet.create({
  amount: {
    alignItems: "center",
    flexDirection: "column",
    height: 42, // FIXME should be dynamic?
    position: "absolute",
    top: "25rem",
    width: "250rem",
  },

  balanceText: {
    color: palette.midGrey,
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
  },

  container: {
    alignItems: "flex-end",
    flexDirection: "row",
  },

  header: {
    alignItems: "center",
    marginBottom: "12rem",
    marginTop: "32rem",
    minHeight: "75rem",
  },

  hiddenBalanceContainer: {
    alignItems: "center",
    flexGrow: 1,
    justifyContent: "center",
  },

  hiddenBalanceIcon: {
    fontSize: "25rem",
  },

  subCurrencyText: {
    color: palette.darkGrey,
    fontSize: "16rem",
  },

  text: {
    color: palette.darkGrey,
    fontSize: 32,
  },
  touchableHighlightColor: "#ffffff00",
})

export interface BalanceHeaderProps {
  showSecondaryCurrency?: boolean
  loading?: boolean
  style?: StyleProp<ViewStyle>
}

const Loader = () => (
  <ContentLoader
    height={40}
    width={120}
    speed={1.2}
    backgroundColor="#f3f3f3"
    foregroundColor="#ecebeb"
  >
    <Rect x="0" y="12" rx="4" ry="4" width="120" height="28" />
    {/* <Rect x="30" y="35" rx="4" ry="4" width="60" height="10" /> */}
  </ContentLoader>
)

export const BalanceHeader: React.FC<BalanceHeaderProps> = ({
  showSecondaryCurrency = true,
  loading = false,
  style,
}: BalanceHeaderProps) => {
  return (
    <View style={[styles.header, style]}>
      <Text style={styles.balanceText}>{translate("BalanceHeader.currentBalance")}</Text>
      {loading ? (
        <Loader />
      ) : (
        <BalanceHeaderDisplay showSecondaryCurrency={showSecondaryCurrency} />
      )}
    </View>
  )
}

export const BalanceHeaderDisplay: React.FC<BalanceHeaderProps> = ({
  showSecondaryCurrency = true,
}: BalanceHeaderProps) => {
  const client = useApolloClient()
  const { satBalance, usdBalance } = useWalletBalance()
  const hideBalance = useHideBalance()
  const hiddenBalanceToolTip = useHiddenBalanceToolTip()
  const isFocused = useIsFocused()
  const [showToolTip, setShowToolTip] = useState<boolean>(false)
  const [mHideBalance, setHideBalance] = useState<boolean>(hideBalance)

  const closeToolTip = useCallback(async () => {
    setShowToolTip(await saveHiddenBalanceToolTip(client, false))
  }, [client])

  useEffect((): void | (() => void) => {
    // Need to wait for the component to be in focus
    if (isFocused) {
      const timerId = setTimeout(function () {
        if (isFocused) {
          setShowToolTip(hiddenBalanceToolTip)
        }
      }, 1000)
      return () => clearTimeout(timerId)
    }
  }, [hiddenBalanceToolTip, isFocused, showToolTip])

  useEffect(() => {
    if (showToolTip && !isFocused) {
      closeToolTip()
    }
  }, [closeToolTip, isFocused, showToolTip])

  useEffect(() => {
    setHideBalance(hideBalance)
  }, [hideBalance, isFocused])

  const currency = "CRC"
  const otherCurrency = "BTC"

  const hiddenBalanceSet = () => {
    return (
      <>
        <Tooltip
          isVisible={showToolTip}
          content={<Text>{translate("BalanceHeader.hiddenBalanceToolTip")}</Text>}
          placement="bottom"
          onClose={closeToolTip}
        >
          <TouchableHighlight
            underlayColor={styles.touchableHighlightColor}
            onPress={() => {
              if (showToolTip) {
                closeToolTip()
              }
              setHideBalance(false)
            }}
            style={styles.hiddenBalanceTouchableHighlight}
          >
            <Icon style={styles.hiddenBalanceIcon} name="eye" />
          </TouchableHighlight>
        </Tooltip>
      </>
    )
  }

  const defaultBalanceHeader = () => {
    const amountOtherCurrency = satBalance
    const subHeader = showSecondaryCurrency && (
      <TextCurrency
        amount={amountOtherCurrency}
        currency={otherCurrency}
        style={styles.subCurrencyText}
      />
    )

    return (
      <View style={styles.amount}>
        <View style={styles.container}>
          <TouchableHighlight
            underlayColor={styles.touchableHighlightColor}
            onPress={() => {
              if (hideBalance) {
                setHideBalance(true)
              }
            }}
          >
            <TextCurrency amount={usdBalance} currency={currency} style={styles.text} />
          </TouchableHighlight>
        </View>
        {subHeader}
      </View>
    )
  }

  return (
    <>
      {!mHideBalance && defaultBalanceHeader()}
      <View style={styles.hiddenBalanceContainer}>
        {mHideBalance && hiddenBalanceSet()}
      </View>
    </>
  )
}
