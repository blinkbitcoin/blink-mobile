var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
import * as React from "react";
import { ActivityIndicator, View, TextInput, } from "react-native";
import { CartesianChart, Line, useChartPressState } from "victory-native";
import Reanimated, { useAnimatedProps, useDerivedValue, } from "react-native-reanimated";
import { gql } from "@apollo/client";
import { WalletCurrency, useBtcPriceListQuery } from "@app/graphql/generated";
import { useI18nContext } from "@app/i18n/i18n-react";
import { testProps } from "@app/utils/testProps";
import { Button } from "@rn-vui/base";
import { Text, makeStyles, useTheme } from "@rn-vui/themed";
import { Circle } from "@shopify/react-native-skia";
import { GaloyErrorBox } from "../atomic/galoy-error-box";
import { useDisplayCurrency } from "@app/hooks/use-display-currency";
var GraphRange = {
    ONE_DAY: "ONE_DAY",
    ONE_WEEK: "ONE_WEEK",
    ONE_MONTH: "ONE_MONTH",
    ONE_YEAR: "ONE_YEAR",
    FIVE_YEARS: "FIVE_YEARS",
};
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  query btcPriceList($range: PriceGraphRange!) {\n    btcPriceList(range: $range) {\n      timestamp\n      price {\n        base\n        offset\n        currencyUnit\n      }\n    }\n  }\n"], ["\n  query btcPriceList($range: PriceGraphRange!) {\n    btcPriceList(range: $range) {\n      timestamp\n      price {\n        base\n        offset\n        currencyUnit\n      }\n    }\n  }\n"])));
export var PriceHistory = function () {
    var _a, _b, _c;
    var styles = useStyles();
    var colors = useTheme().theme.colors;
    var LL = useI18nContext().LL;
    var _d = React.useState(GraphRange.ONE_DAY), graphRange = _d[0], setGraphRange = _d[1];
    var _e = useBtcPriceListQuery({
        fetchPolicy: "no-cache",
        variables: { range: graphRange },
    }), error = _e.error, loading = _e.loading, data = _e.data;
    var priceList = (_a = data === null || data === void 0 ? void 0 : data.btcPriceList) !== null && _a !== void 0 ? _a : [];
    var _f = useChartPressState({ x: 0, y: { y: 0 } }), state = _f.state, isActive = _f.isActive;
    var formatMoneyAmount = useDisplayCurrency().formatMoneyAmount;
    function ToolTip(_a) {
        var x = _a.x, y = _a.y;
        return (<>
        <Circle cx={x} cy={y} r={8} color={colors.primary}/>
      </>);
    }
    var prices = priceList
        .filter(function (price) { return price !== null; })
        .map(function (price) { return price; })
        .map(function (index) {
        var amount = Math.floor(index.price.base / Math.pow(10, index.price.offset));
        return {
            y: amount,
            formattedAmount: formatMoneyAmount({
                moneyAmount: {
                    amount: amount,
                    currency: WalletCurrency.Usd,
                    currencyCode: "USDCENT",
                },
            }),
            timestamp: index.timestamp,
            currencyUnit: index.price.currencyUnit,
        };
    });
    var currentPriceData = (_b = prices[prices.length - 1]) === null || _b === void 0 ? void 0 : _b.y;
    var startPriceData = (_c = prices[0]) === null || _c === void 0 ? void 0 : _c.y;
    var delta = currentPriceData && startPriceData
        ? (currentPriceData - startPriceData) / startPriceData
        : 0;
    var color = delta > 0 ? { color: colors._green } : { color: colors.red };
    var activePrice = useDerivedValue(function () {
        var _a;
        var price = isActive
            ? prices.find(function (price) { return price.y === state.y.y.value.value; })
            : prices[prices.length - 1];
        return (_a = price === null || price === void 0 ? void 0 : price.formattedAmount) !== null && _a !== void 0 ? _a : "";
    });
    var activeTimestamp = useDerivedValue(function () {
        var _a;
        var timestamp = isActive
            ? (_a = prices.find(function (price) { return price.y === state.y.y.value.value; })) === null || _a === void 0 ? void 0 : _a.timestamp
            : undefined;
        return "".concat(timestamp ? new Date(timestamp * 1000).toLocaleString(undefined, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");
    });
    var label = function () {
        switch (graphRange) {
            case GraphRange.ONE_DAY:
                return LL.PriceHistoryScreen.last24Hours();
            case GraphRange.ONE_WEEK:
                return LL.PriceHistoryScreen.lastWeek();
            case GraphRange.ONE_MONTH:
                return LL.PriceHistoryScreen.lastMonth();
            case GraphRange.ONE_YEAR:
                return LL.PriceHistoryScreen.lastYear();
            case GraphRange.FIVE_YEARS:
                return LL.PriceHistoryScreen.lastFiveYears();
        }
    };
    var buttonStyleForRange = function (buttonGraphRange) {
        return graphRange === buttonGraphRange
            ? styles.buttonStyleTimeActive
            : styles.buttonStyleTime;
    };
    var titleStyleForRange = function (titleGraphRange) {
        return graphRange === titleGraphRange ? null : styles.titleStyleTime;
    };
    return (<View style={styles.screen}>
      <View {...testProps(LL.PriceHistoryScreen.satPrice())} style={styles.textView}>
        <AnimText 
    // @ts-ignore-next-line
    text={activePrice} style={styles.priceText} color={colors.black}/>
        <View style={styles.subtextContainer}>
          {!isActive && !loading ? (<Text type="p1" {...testProps("range")}>
              <Text type="p1" style={[styles.delta, color]}>
                {(delta * 100).toFixed(2)}%{" "}
              </Text>
              {label()}
            </Text>) : (<AnimText 
        // @ts-ignore-next-line
        text={activeTimestamp} style={styles.subtext} color={colors.black}/>)}
        </View>
      </View>
      <View style={styles.chart}>
        {!loading && data ? (
        /* eslint @typescript-eslint/ban-ts-comment: "off" */
        // @ts-ignore-next-line no-implicit-any error
        <CartesianChart data={prices} yKeys={["y"]} chartPressState={state}>
            {function (_a) {
                var points = _a.points;
                return (<>
                <Line points={points.y} color={colors.primary} strokeWidth={2} curveType="natural"/>

                {isActive && (<>
                    <ToolTip x={state.x.position} y={state.y.y.position}/>
                  </>)}
              </>);
            }}
          </CartesianChart>) : (<View style={styles.verticalAlignment}>
            <ActivityIndicator animating size="large" color={colors.primary}/>
          </View>)}
      </View>
      <View style={styles.pricesContainer}>
        <Button {...testProps(LL.PriceHistoryScreen.oneDay())} title={LL.PriceHistoryScreen.oneDay()} 
    /* eslint @typescript-eslint/ban-ts-comment: "off" */
    // @ts-ignore-next-line no-implicit-any error
    buttonStyle={buttonStyleForRange(GraphRange.ONE_DAY)} 
    // @ts-ignore-next-line no-implicit-any error
    titleStyle={titleStyleForRange(GraphRange.ONE_DAY)} onPress={function () { return setGraphRange(GraphRange.ONE_DAY); }}/>
        <Button {...testProps(LL.PriceHistoryScreen.oneWeek())} title={LL.PriceHistoryScreen.oneWeek()} 
    // @ts-ignore-next-line no-implicit-any error
    buttonStyle={buttonStyleForRange(GraphRange.ONE_WEEK)} 
    // @ts-ignore-next-line no-implicit-any error
    titleStyle={titleStyleForRange(GraphRange.ONE_WEEK)} onPress={function () { return setGraphRange(GraphRange.ONE_WEEK); }}/>
        <Button {...testProps(LL.PriceHistoryScreen.oneMonth())} title={LL.PriceHistoryScreen.oneMonth()} 
    // @ts-ignore-next-line no-implicit-any error
    buttonStyle={buttonStyleForRange(GraphRange.ONE_MONTH)} 
    // @ts-ignore-next-line no-implicit-any error
    titleStyle={titleStyleForRange(GraphRange.ONE_MONTH)} onPress={function () { return setGraphRange(GraphRange.ONE_MONTH); }}/>
        <Button {...testProps(LL.PriceHistoryScreen.oneYear())} title={LL.PriceHistoryScreen.oneYear()} 
    // @ts-ignore-next-line no-implicit-any error
    buttonStyle={buttonStyleForRange(GraphRange.ONE_YEAR)} 
    // @ts-ignore-next-line no-implicit-any error
    titleStyle={titleStyleForRange(GraphRange.ONE_YEAR)} onPress={function () { return setGraphRange(GraphRange.ONE_YEAR); }}/>
        <Button {...testProps(LL.PriceHistoryScreen.fiveYears())} title={LL.PriceHistoryScreen.fiveYears()} 
    // @ts-ignore-next-line no-implicit-any error
    buttonStyle={buttonStyleForRange(GraphRange.FIVE_YEARS)} 
    // @ts-ignore-next-line no-implicit-any error
    titleStyle={titleStyleForRange(GraphRange.FIVE_YEARS)} onPress={function () { return setGraphRange(GraphRange.FIVE_YEARS); }}/>
      </View>
      {error && <GaloyErrorBox errorMessage={error.message}/>}
    </View>);
};
var AnimText = Reanimated.createAnimatedComponent(TextInput);
Reanimated.addWhitelistedNativeProps({ text: true });
export function AnimatedText(_a) {
    var text = _a.text, rest = __rest(_a, ["text"]);
    var animProps = useAnimatedProps(function () {
        return {
            text: text.value,
        };
    });
    return (<AnimText {...rest} value={text.value} 
    // @ts-ignore
    animatedProps={animProps} editable={false}/>);
}
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
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
    });
});
var templateObject_1;
//# sourceMappingURL=price-history.js.map