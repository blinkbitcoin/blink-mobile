import { gql, useQuery } from "@apollo/client"
import * as React from "react"
import { ActivityIndicator, StyleProp, Text, View, Dimensions } from "react-native"
import { Button } from "react-native-elements"
import EStyleSheet from "react-native-extended-stylesheet"
import { VictoryChart, VictoryLine, VictoryVoronoiContainer, VictoryTooltip } from "victory-native"
import * as currency_fmt from "currency.js"
import { parseDate } from "../../utils/date"
import {
  TextStyle,
  ViewStyle,
} from "react-native-vector-icons/node_modules/@types/react-native/index"

import { color } from "../../theme"
import { palette } from "../../theme/palette"
import { translate } from "../../i18n"
import type { ComponentType } from "../../types/jsx"

const BTC_PRICE_LIST = gql`
  query btcPriceList($range: PriceGraphRange!) {
    btcPriceList(range: $range) {
      timestamp
      price {
        base
        offset
        currencyUnit
        formattedAmount
      }
    }
  }
`

const multiple = (currentUnit: string) => {
  switch (currentUnit) {
    case "USDCENT":
      return 10 ** -5
    default:
      return 1
  }
}

const Graph_Range = {
  ONE_DAY: "ONE_DAY",
  ONE_WEEK: "ONE_WEEK",
  ONE_MONTH: "ONE_MONTH",
  ONE_YEAR: "ONE_YEAR",
} as const

type GraphRangeType = typeof Graph_Range[keyof typeof Graph_Range]

type Price = {
  base: number
  offset: number
  currencyUnit: string
  formattedAmount: string
}

type PricePoint = {
  timestamp: number
  price: Price
}

export const PriceGraphDataInjected: ComponentType = () => {
  const [graphRange, setGraphRange] = React.useState<GraphRangeType>(Graph_Range.ONE_DAY)

  const { error, loading, data, refetch } = useQuery(BTC_PRICE_LIST, {
    variables: { range: graphRange },
    notifyOnNetworkStatusChange: true,
  })

  if (loading || data === null) {
    return <ActivityIndicator animating size="large" color={palette.lightBlue} />
  }

  if (error) {
    return <Text>{`${error}`}</Text>
  }

  const lastPrice = data.btcPriceList[data.btcPriceList.length - 1]
  if (!loading) {
    const unixTime = Date.now() / 1000
    if (graphRange === Graph_Range.ONE_DAY) {
      if (unixTime - lastPrice.timestamp > 300) {
        refetch()
      }
    } else if (graphRange === Graph_Range.ONE_WEEK) {
      if (unixTime - lastPrice.timestamp > 1800) {
        refetch()
      }
    } else if (graphRange === Graph_Range.ONE_MONTH) {
      if (unixTime - lastPrice.timestamp > 86400) {
        refetch()
      }
    } else if (graphRange === Graph_Range.ONE_YEAR) {
      if (unixTime - lastPrice.timestamp > 86400) {
        refetch()
      }
    }
  }

  return (
    <PriceGraph
      prices={data.btcPriceList}
      graphRange={graphRange}
      setGraphRange={setGraphRange}
    />
  )
}

type Props = {
  graphRange: GraphRangeType
  prices: PricePoint[]
  setGraphRange: (graphRange: GraphRangeType) => void
}

export const PriceGraph: ComponentType = ({
  graphRange,
  prices,
  setGraphRange,
}: Props) => {
  let price
  let delta
  let color

  const [selectedPrice, setSelectedPrice] = React.useState<Price | null>(null)

  const formatPrice = (price: number) => {
    return currency_fmt
      .default(price, { precision: 2, symbol: "₡", separator: ".", decimal: "," })
      .format()
  }

  try {
    const currentPriceData = prices[prices.length - 1].price
    const startPriceData = prices[0].price

    price =
      (currentPriceData.base / 10 ** currentPriceData.offset) *
      multiple(currentPriceData.currencyUnit)
    delta =
      (price -
        (startPriceData.base / 10 ** startPriceData.offset) *
          multiple(startPriceData.currencyUnit)) /
      price
    color = delta > 0 ? palette.green : palette.red
  } catch (err) {
    return <ActivityIndicator animating size="large" color={palette.lightBlue} />
  }

  const label = () => {
    switch (graphRange) {
      case Graph_Range.ONE_DAY:
        return translate("PriceScreen.today")
      case Graph_Range.ONE_WEEK:
        return translate("PriceScreen.thisWeek")
      case Graph_Range.ONE_MONTH:
        return translate("PriceScreen.thisMonth")
      case Graph_Range.ONE_YEAR:
        return translate("PriceScreen.thisYear")
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
    <View style={styles.container}>
      <View style={styles.topContainer}>
        {!selectedPrice && (
          <View style={styles.textView}>
            <Text style={[styles.delta, { color }]}>{(delta * 100).toFixed(2)}% </Text>
            <Text style={styles.neutral}>{label()}</Text>
          </View>
        )}
        {selectedPrice && (
          <View>
            <Text style={styles.selectedPrice}>
              {parseDate(selectedPrice.timestamp).toDateString()}
            </Text>
            <Text style={styles.selectedPrice}>
              {formatPrice((selectedPrice.base / 10 ** selectedPrice.offset) * multiple(selectedPrice.currencyUnit) * 1000 )}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.chartContainer}>
        <VictoryChart
          width={Dimensions.get("window").width}
          height={Dimensions.get("window").height * 0.7}
          padding={0}
          containerComponent={
            <VictoryVoronoiContainer
              voronoiDimension="x"
              onActivated={(points) => {
                if (points && points.length > 0) {
                  console.log(points[0])
                  setSelectedPrice({
                    timestamp: points[0]["_x"],
                    ...points[0].price
                  })
                }
              }}
              // onDeactivated={() => setSelectedPrice(null)}
            />
          }
        >
          <VictoryLine
            data={prices.map((index) => ({
              x: index.timestamp,
              y: (index.price.base / 10 ** index.price.offset) * multiple(index.price.currencyUnit),
              price: index.price,
            }))}
            interpolation="monotoneX"
            style={{
              data: { 
                stroke: color,
                strokeWidth: 2 
              }
            }}
          />
        </VictoryChart>
      </View>
      <View style={styles.pricesContainer}>
        <Button
          title={translate("PriceScreen.oneDay")}
          buttonStyle={buttonStyleForRange(Graph_Range.ONE_DAY)}
          titleStyle={titleStyleForRange(Graph_Range.ONE_DAY)}
          onPress={() => setGraphRange(Graph_Range.ONE_DAY)}
        />
        <Button
          title={translate("PriceScreen.oneWeek")}
          buttonStyle={buttonStyleForRange(Graph_Range.ONE_WEEK)}
          titleStyle={titleStyleForRange(Graph_Range.ONE_WEEK)}
          onPress={() => setGraphRange(Graph_Range.ONE_WEEK)}
        />
        <Button
          title={translate("PriceScreen.oneMonth")}
          buttonStyle={buttonStyleForRange(Graph_Range.ONE_MONTH)}
          titleStyle={titleStyleForRange(Graph_Range.ONE_MONTH)}
          onPress={() => setGraphRange(Graph_Range.ONE_MONTH)}
        />
        <Button
          title={translate("PriceScreen.oneYear")}
          buttonStyle={buttonStyleForRange(Graph_Range.ONE_YEAR)}
          titleStyle={titleStyleForRange(Graph_Range.ONE_YEAR)}
          onPress={() => setGraphRange(Graph_Range.ONE_YEAR)}
        />
      </View>
    </View>
  )
}

const styles = EStyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    justifyContent: 'space-between',
  },
  
  topContainer: {
    // paddingTop: '10rem',
    // paddingHorizontal: '20rem',
  },

  chartContainer: {
    width: '100%',
    height: Dimensions.get("window").height * 0.7, // Increased height
  },

  buttonStyleTime: {
    backgroundColor: color.transparent,
    borderRadius: '40rem',
    paddingHorizontal: '10rem',
  },

  buttonStyleTimeActive: {
    backgroundColor: palette.lightBlue,
    borderRadius: '40rem',
    paddingHorizontal: '10rem',
  },

  delta: {
    fontSize: '18rem',
    fontWeight: 'bold',
  },

  neutral: {
    color: palette.darkGrey,
    fontSize: '18rem',
  },

  price: {
    color: palette.lightBlue,
    fontSize: '24rem',
    fontWeight: 'bold',
  },

  pricesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: '20rem',
    paddingBottom: '20rem',
  },

  textView: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: '10rem',
  },

  titleStyleTime: {
    color: palette.midGrey,
  },

  selectedPrice: {
    fontSize: '20rem',
    fontWeight: 'bold',
    color: palette.lightBlue,
    textAlign: 'center',
    marginTop: '5rem',
  },
})
