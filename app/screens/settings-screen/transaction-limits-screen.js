var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
import React, { useRef, useState, useCallback } from "react";
import { ActivityIndicator, Button, View } from "react-native";
import { gql } from "@apollo/client";
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button";
import { Screen } from "@app/components/screen";
import { TrialAccountLimitsModal } from "@app/components/upgrade-account-modal";
import { useAccountLimitsQuery } from "@app/graphql/generated";
import { useIsAuthed } from "@app/graphql/is-authed-context";
import { AccountLevel, useLevel } from "@app/graphql/level-context";
import { useAppConfig, usePriceConversion } from "@app/hooks";
import { useDisplayCurrency } from "@app/hooks/use-display-currency";
import { useI18nContext } from "@app/i18n/i18n-react";
import { DisplayCurrency, toUsdMoneyAmount } from "@app/types/amounts";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { makeStyles, Text, useTheme } from "@rn-vui/themed";
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        limitWrapper: {
            padding: 20,
            backgroundColor: colors.white,
        },
        increaseLimitsButtonContainer: {
            marginVertical: 20,
            marginHorizontal: 20,
        },
        contentTextBox: {
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 5,
        },
        valueFieldType: {
            fontWeight: "bold",
            fontSize: 15,
            paddingBottom: 8,
        },
        valueRemaining: {
            fontWeight: "bold",
            color: colors._green,
            maxWidth: "50%",
        },
        valueTotal: {
            fontWeight: "bold",
            color: colors.grey3,
            maxWidth: "50%",
        },
        divider: {
            marginVertical: 0,
            borderWidth: 1,
            borderColor: colors.grey4,
        },
        errorWrapper: {
            justifyContent: "center",
            alignItems: "center",
            marginTop: "50%",
            marginBottom: "50%",
        },
        errorText: {
            color: colors.error,
            fontWeight: "bold",
            fontSize: 18,
            marginBottom: 20,
        },
        loadingWrapper: {
            justifyContent: "center",
            alignItems: "center",
            marginTop: "50%",
            marginBottom: "50%",
        },
        increaseLimitsContainer: {
            flexDirection: "row",
            alignItems: "center",
            columnGap: 5,
            padding: 20,
        },
        increaseLimitsText: {
            color: colors.primary,
            fontWeight: "600",
            fontSize: 15,
            textDecorationLine: "underline",
        },
    });
});
var accountLimitsPeriodInHrs = {
    DAILY: "24",
    WEEKLY: "168",
};
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  query accountLimits {\n    me {\n      id\n      defaultAccount {\n        id\n        limits {\n          withdrawal {\n            totalLimit\n            remainingLimit\n            interval\n          }\n          internalSend {\n            totalLimit\n            remainingLimit\n            interval\n          }\n          convert {\n            totalLimit\n            remainingLimit\n            interval\n          }\n        }\n      }\n    }\n  }\n"], ["\n  query accountLimits {\n    me {\n      id\n      defaultAccount {\n        id\n        limits {\n          withdrawal {\n            totalLimit\n            remainingLimit\n            interval\n          }\n          internalSend {\n            totalLimit\n            remainingLimit\n            interval\n          }\n          convert {\n            totalLimit\n            remainingLimit\n            interval\n          }\n        }\n      }\n    }\n  }\n"])));
export var TransactionLimitsScreen = function () {
    var _a, _b, _c, _d, _e, _f;
    var navigation = useNavigation();
    var styles = useStyles();
    var colors = useTheme().theme.colors;
    var LL = useI18nContext().LL;
    var _g = useAccountLimitsQuery({
        fetchPolicy: "no-cache",
        skip: !useIsAuthed(),
    }), data = _g.data, loading = _g.loading, error = _g.error, refetch = _g.refetch;
    var appConfig = useAppConfig().appConfig;
    var bankName = appConfig.galoyInstance.name;
    var currentLevel = useLevel().currentLevel;
    var _h = useState(false), isUpgradeModalVisible = _h[0], setIsUpgradeModalVisible = _h[1];
    var reopenUpgradeModal = useRef(false);
    var closeUpgradeModal = function () { return setIsUpgradeModalVisible(false); };
    var openUpgradeModal = function () { return setIsUpgradeModalVisible(true); };
    useFocusEffect(useCallback(function () {
        if (reopenUpgradeModal.current) {
            openUpgradeModal();
            reopenUpgradeModal.current = false;
        }
    }, []));
    if (error) {
        return (<Screen>
        <View style={styles.errorWrapper}>
          <Text adjustsFontSizeToFit style={styles.errorText}>
            {LL.TransactionLimitsScreen.error()}
          </Text>
          <Button title="reload" disabled={loading} color={colors.error} onPress={function () { return refetch(); }}/>
        </View>
      </Screen>);
    }
    if (loading) {
        return (<Screen>
        <View style={styles.loadingWrapper}>
          <ActivityIndicator animating size="large" color={colors.primary}/>
        </View>
      </Screen>);
    }
    return (<Screen preset="scroll">
      <View style={styles.limitWrapper}>
        <Text adjustsFontSizeToFit style={styles.valueFieldType}>
          {LL.TransactionLimitsScreen.receive()}
        </Text>
        <View>
          <View style={styles.contentTextBox}>
            <Text adjustsFontSizeToFit style={styles.valueRemaining}>
              {LL.TransactionLimitsScreen.unlimited()}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.divider}></View>

      <View style={styles.limitWrapper}>
        <Text adjustsFontSizeToFit style={styles.valueFieldType}>
          {LL.TransactionLimitsScreen.withdraw()}
        </Text>
        {(_b = (_a = data === null || data === void 0 ? void 0 : data.me) === null || _a === void 0 ? void 0 : _a.defaultAccount.limits) === null || _b === void 0 ? void 0 : _b.withdrawal.map(function (data, index) { return (<TransactionLimitsPeriod key={index} {...data}/>); })}
      </View>

      <View style={styles.divider}></View>

      <View style={styles.limitWrapper}>
        <Text adjustsFontSizeToFit style={styles.valueFieldType}>
          {LL.TransactionLimitsScreen.internalSend({ bankName: bankName })}
        </Text>
        {(_d = (_c = data === null || data === void 0 ? void 0 : data.me) === null || _c === void 0 ? void 0 : _c.defaultAccount.limits) === null || _d === void 0 ? void 0 : _d.internalSend.map(function (data, index) { return (<TransactionLimitsPeriod key={index} {...data}/>); })}
      </View>

      <View style={styles.divider}></View>

      <View style={styles.limitWrapper}>
        <Text adjustsFontSizeToFit style={styles.valueFieldType}>
          {LL.TransactionLimitsScreen.stablesatTransfers()}
        </Text>
        {(_f = (_e = data === null || data === void 0 ? void 0 : data.me) === null || _e === void 0 ? void 0 : _e.defaultAccount.limits) === null || _f === void 0 ? void 0 : _f.convert.map(function (data, index) { return (<TransactionLimitsPeriod key={index} {...data}/>); })}
      </View>
      {currentLevel === AccountLevel.Zero && (<GaloyPrimaryButton title={LL.TransactionLimitsScreen.increaseLimits()} onPress={function () {
                openUpgradeModal();
            }} containerStyle={styles.increaseLimitsButtonContainer}/>)}
      {currentLevel === AccountLevel.One && (<GaloyPrimaryButton title={LL.TransactionLimitsScreen.increaseLimits()} onPress={function () { return navigation.navigate("fullOnboardingFlow"); }} containerStyle={styles.increaseLimitsButtonContainer}/>)}

      <TrialAccountLimitsModal isVisible={isUpgradeModalVisible} closeModal={closeUpgradeModal} beforeSubmit={function () {
            reopenUpgradeModal.current = true;
        }}/>
    </Screen>);
};
var TransactionLimitsPeriod = function (_a) {
    var totalLimit = _a.totalLimit, remainingLimit = _a.remainingLimit, interval = _a.interval;
    var formatMoneyAmount = useDisplayCurrency().formatMoneyAmount;
    var convertMoneyAmount = usePriceConversion().convertMoneyAmount;
    var LL = useI18nContext().LL;
    var styles = useStyles();
    if (!convertMoneyAmount) {
        return null;
    }
    var usdTotalLimitMoneyAmount = convertMoneyAmount(toUsdMoneyAmount(totalLimit), DisplayCurrency);
    var usdRemainingLimitMoneyAmount = typeof remainingLimit === "number"
        ? convertMoneyAmount(toUsdMoneyAmount(remainingLimit), DisplayCurrency)
        : null;
    var remainingLimitText = usdRemainingLimitMoneyAmount
        ? "".concat(formatMoneyAmount({
            moneyAmount: usdRemainingLimitMoneyAmount,
        }), " ").concat(LL.TransactionLimitsScreen.remaining().toLocaleLowerCase())
        : "";
    var getLimitDuration = function (period) {
        var interval = (period / (60 * 60)).toString();
        switch (interval) {
            case accountLimitsPeriodInHrs.DAILY:
                return LL.TransactionLimitsScreen.perDay();
            case accountLimitsPeriodInHrs.WEEKLY:
                return LL.TransactionLimitsScreen.perWeek();
            default:
                return null;
        }
    };
    var totalLimitText = "".concat(formatMoneyAmount({
        moneyAmount: usdTotalLimitMoneyAmount,
    }), " ").concat(interval && getLimitDuration(interval));
    return (<View>
      <View style={styles.contentTextBox}>
        <Text adjustsFontSizeToFit style={styles.valueRemaining}>
          {remainingLimitText}
        </Text>
        <Text adjustsFontSizeToFit style={styles.valueTotal}>
          {totalLimitText}
        </Text>
      </View>
    </View>);
};
var templateObject_1;
//# sourceMappingURL=transaction-limits-screen.js.map