import { TextStyle, ViewStyle } from "node_modules/@types/react-native/index"
import * as React from "react"
import {
  ActivityIndicator,
  StyleProp,
  View,
  TextInput,
  type TextInputProps,
} from "react-native"
import { CartesianChart, Line, useChartPressState } from "victory-native"
import Reanimated, {
  useAnimatedProps,
  useDerivedValue,
  type SharedValue,
} from "react-native-reanimated"

import { gql } from "@apollo/client"
import { PricePoint, WalletCurrency, useBtcPriceListQuery } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"
import { Button } from "@rneui/base"
import { Text, makeStyles, useTheme } from "@rneui/themed"
import { Circle } from "@shopify/react-native-skia"
import { GaloyErrorBox } from "../atomic/galoy-error-box"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"

const GraphRange = {
  ONE_DAY: "ONE_DAY",
  ONE_WEEK: "ONE_WEEK",
  ONE_MONTH: "ONE_MONTH",
  ONE_YEAR: "ONE_YEAR",
  FIVE_YEARS: "FIVE_YEARS",
} as const

type GraphRangeType = (typeof GraphRange)[keyof typeof GraphRange]

gql`
  query btcPriceList($range: PriceGraphRange!) {
    btcPriceList(range: $range) {
      timestamp
      price {
        base
        offset
        currencyUnit
      }
    }
  }
`

export const PriceHistory = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const [graphRange, setGraphRange] = React.useState<GraphRangeType>(GraphRange.ONE_DAY)

  const { error, loading, data } = useBtcPriceListQuery({
    fetchPolicy: "no-cache",
    variables: { range: graphRange },
  })
  const priceList = data?.btcPriceList ?? []

  const { state, isActive } = useChartPressState({ x: 0, y: { y: 0 } })

  const { formatMoneyAmount } = useDisplayCurrency()

  function ToolTip({ x, y }: { x: SharedValue<number>; y: SharedValue<number> }) {
    return (
      <>
        <Circle cx={x} cy={y} r={8} color={colors.primary} />
      </>
    )
  }

  const prices = priceList
    .filter((price) => price !== null)
    .map((price) => price as PricePoint)
    .map((index) => {
      const amount = Math.floor(index.price.base / 10 ** index.price.offset)

      return {
        y: amount,
        formattedAmount: formatMoneyAmount({
          moneyAmount: {
            amount,
            currency: WalletCurrency.Usd,
            currencyCode: "USDCENT",
          },
        }),
        timestamp: index.timestamp,
        currencyUnit: index.price.currencyUnit,
      }
    })

  const currentPriceData = prices[prices.length - 1]?.y
  const startPriceData = prices[0]?.y
  const delta =
    currentPriceData && startPriceData
      ? (currentPriceData - startPriceData) / startPriceData
      : 0
  const color = delta > 0 ? { color: colors._green } : { color: colors.red }

  const activePrice = useDerivedValue(() => {
    const price = isActive
      ? prices.find((price) => price.y === state.y.y.value.value)
      : prices[prices.length - 1]

    return price?.formattedAmount ?? ""
  })

  const activeTimestamp = useDerivedValue(() => {
    const timestamp = isActive
      ? prices.find((price) => price.y === state.y.y.value.value)?.timestamp
      : undefined

    return `${timestamp ? new Date(timestamp * 1000).toLocaleString(undefined, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}`
  })

  const label = () => {
    switch (graphRange) {
      case GraphRange.ONE_DAY:
        return LL.PriceHistoryScreen.last24Hours()
      case GraphRange.ONE_WEEK:
        return LL.PriceHistoryScreen.lastWeek()
      case GraphRange.ONE_MONTH:
        return LL.PriceHistoryScreen.lastMonth()
      case GraphRange.ONE_YEAR:
        return LL.PriceHistoryScreen.lastYear()
      case GraphRange.FIVE_YEARS:
        return LL.PriceHistoryScreen.lastFiveYears()
    }
  }

  const buttonStyleForRange = (
    buttonGraphRange: GraphRangeType,
  ): StyleProp<ViewStyle> => {
    return graphRange === buttonGraphRange
      ? styles.buttonStyleTimeActive
      : styles.buttonStyleTime
  }
  const titleStyleForRange = (titleGraphRange: GraphRangeType): StyleProp<TextStyle> => {
    return graphRange === titleGraphRange ? null : styles.titleStyleTime
  }
  return (
    <View style={styles.screen}>
      <View {...testProps(LL.PriceHistoryScreen.satPrice())} style={styles.textView}>
        <AnimText
          // @ts-ignore-next-line
          text={activePrice}
          style={styles.priceText}
          color={colors.black}
        />
        <View style={styles.subtextContainer}>
          {!isActive && !loading ? (
            <Text type="p1" {...testProps("range")}>
              <Text type="p1" style={[styles.delta, color]}>
                {(delta * 100).toFixed(2)}%{" "}
              </Text>
              {label()}
            </Text>
          ) : (
            <AnimText
              // @ts-ignore-next-line
              text={activeTimestamp}
              style={styles.subtext}
              color={colors.black}
            />
          )}
        </View>
      </View>
      <View style={styles.chart}>
        {!loading && data ? (
          /* eslint @typescript-eslint/ban-ts-comment: "off" */
          // @ts-ignore-next-line no-implicit-any error
          <CartesianChart data={prices} yKeys={["y"]} chartPressState={state}>
            {({ points }) => (
              <>
                <Line
                  points={points.y}
                  color={colors.primary}
                  strokeWidth={2}
                  curveType="natural"
                />

                {isActive && (
                  <>
                    <ToolTip x={state.x.position} y={state.y.y.position} />
                  </>
                )}
              </>
            )}
          </CartesianChart>
        ) : (
          <View style={styles.verticalAlignment}>
            <ActivityIndicator animating size="large" color={colors.primary} />
          </View>
        )}
      </View>
      <View style={styles.pricesContainer}>
        <Button
          {...testProps(LL.PriceHistoryScreen.oneDay())}
          title={LL.PriceHistoryScreen.oneDay()}
          /* eslint @typescript-eslint/ban-ts-comment: "off" */
          // @ts-ignore-next-line no-implicit-any error
          buttonStyle={buttonStyleForRange(GraphRange.ONE_DAY)}
          // @ts-ignore-next-line no-implicit-any error
          titleStyle={titleStyleForRange(GraphRange.ONE_DAY)}
          onPress={() => setGraphRange(GraphRange.ONE_DAY)}
        />
        <Button
          {...testProps(LL.PriceHistoryScreen.oneWeek())}
          title={LL.PriceHistoryScreen.oneWeek()}
          // @ts-ignore-next-line no-implicit-any error
          buttonStyle={buttonStyleForRange(GraphRange.ONE_WEEK)}
          // @ts-ignore-next-line no-implicit-any error
          titleStyle={titleStyleForRange(GraphRange.ONE_WEEK)}
          onPress={() => setGraphRange(GraphRange.ONE_WEEK)}
        />
        <Button
          {...testProps(LL.PriceHistoryScreen.oneMonth())}
          title={LL.PriceHistoryScreen.oneMonth()}
          // @ts-ignore-next-line no-implicit-any error
          buttonStyle={buttonStyleForRange(GraphRange.ONE_MONTH)}
          // @ts-ignore-next-line no-implicit-any error
          titleStyle={titleStyleForRange(GraphRange.ONE_MONTH)}
          onPress={() => setGraphRange(GraphRange.ONE_MONTH)}
        />
        <Button
          {...testProps(LL.PriceHistoryScreen.oneYear())}
          title={LL.PriceHistoryScreen.oneYear()}
          // @ts-ignore-next-line no-implicit-any error
          buttonStyle={buttonStyleForRange(GraphRange.ONE_YEAR)}
          // @ts-ignore-next-line no-implicit-any error
          titleStyle={titleStyleForRange(GraphRange.ONE_YEAR)}
          onPress={() => setGraphRange(GraphRange.ONE_YEAR)}
        />
        <Button
          {...testProps(LL.PriceHistoryScreen.fiveYears())}
          title={LL.PriceHistoryScreen.fiveYears()}
          // @ts-ignore-next-line no-implicit-any error
          buttonStyle={buttonStyleForRange(GraphRange.FIVE_YEARS)}
          // @ts-ignore-next-line no-implicit-any error
          titleStyle={titleStyleForRange(GraphRange.FIVE_YEARS)}
          onPress={() => setGraphRange(GraphRange.FIVE_YEARS)}
        />
      </View>
      {error && <GaloyErrorBox errorMessage={error.message} />}
    </View>
  )
}

const AnimText = Reanimated.createAnimatedComponent(TextInput)
Reanimated.addWhitelistedNativeProps({ text: true })

type AnimatedTextProps = Omit<TextInputProps, "editable" | "value"> & {
  text: SharedValue<string>
  style?: React.ComponentProps<typeof AnimText>["style"]
}

export function AnimatedText({ text, ...rest }: AnimatedTextProps) {
  const animProps = useAnimatedProps(() => {
    return {
      text: text.value,
    }
  })

  return (
    <AnimText
      {...rest}
      value={text.value}
      // @ts-ignore
      animatedProps={animProps}
      editable={false}
    />
  )
}

const useStyles = makeStyles(({ colors }) => ({
  buttonStyleTime: {
    backgroundColor: colors.transparent,
    borderRadius: 40,
    width: 48,
    height: 48,
  },
  subtextContainer: {
    height: 24,
  },
  priceText: {
    fontSize: 32,
  },
  subtext: {
    fontSize: 18,
    lineHeight: 24,
  },
  buttonStyleTimeActive: {
    backgroundColor: colors.primary,
    borderRadius: 40,
    width: 48,
    height: 48,
  },

  chart: {
    height: "60%",
  },

  delta: {
    fontWeight: "bold",
  },

  pricesContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 32,
  },

  textView: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  titleStyleTime: {
    color: colors.grey3,
  },
  screen: {
    paddingVertical: 16,
  },
  verticalAlignment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
}))
