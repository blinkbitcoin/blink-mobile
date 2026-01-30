var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import React, { useMemo, useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { makeStyles, useTheme, Text } from "@rn-vui/themed";
import Icon from "react-native-vector-icons/Ionicons";
import { PanGestureHandler, ScrollView } from "react-native-gesture-handler";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import crashlytics from "@react-native-firebase/crashlytics";
import { CommonActions, useNavigation, } from "@react-navigation/native";
import { HomeAuthedDocument, useConversionScreenQuery, useIntraLedgerPaymentSendMutation, useIntraLedgerUsdPaymentSendMutation, WalletCurrency, } from "@app/graphql/generated";
import { useIsAuthed } from "@app/graphql/is-authed-context";
import { getErrorMessages } from "@app/graphql/utils";
import { getBtcWallet, getUsdWallet } from "@app/graphql/wallets-utils";
import { SATS_PER_BTC, usePriceConversion } from "@app/hooks";
import { useDisplayCurrency } from "@app/hooks/use-display-currency";
import { useI18nContext } from "@app/i18n/i18n-react";
import { toBtcMoneyAmount } from "@app/types/amounts";
import { logConversionAttempt, logConversionResult } from "@app/utils/analytics";
import { toastShow } from "@app/utils/toast";
import { Screen } from "@app/components/screen";
import { CurrencyPill, useEqualPillWidth } from "@app/components/atomic/currency-pill";
import GaloySliderButton from "@app/components/atomic/galoy-slider-button/galoy-slider-button";
export var ConversionConfirmationScreen = function (_a) {
    var _b, _c, _d, _e;
    var route = _a.route;
    var colors = useTheme().theme.colors;
    var styles = useStyles();
    var navigation = useNavigation();
    var _f = useDisplayCurrency(), formatMoneyAmount = _f.formatMoneyAmount, displayCurrency = _f.displayCurrency, moneyAmountToDisplayCurrencyString = _f.moneyAmountToDisplayCurrencyString;
    var convertMoneyAmount = usePriceConversion().convertMoneyAmount;
    var _g = route.params, fromWalletCurrency = _g.fromWalletCurrency, moneyAmount = _g.moneyAmount;
    var _h = useState(), errorMessage = _h[0], setErrorMessage = _h[1];
    var isAuthed = useIsAuthed();
    var _j = useIntraLedgerPaymentSendMutation(), intraLedgerPaymentSend = _j[0], intraLedgerPaymentSendLoading = _j[1].loading;
    var _k = useIntraLedgerUsdPaymentSendMutation(), intraLedgerUsdPaymentSend = _k[0], intraLedgerUsdPaymentSendLoading = _k[1].loading;
    var isLoading = intraLedgerPaymentSendLoading || intraLedgerUsdPaymentSendLoading;
    var LL = useI18nContext().LL;
    var _l = useEqualPillWidth(), pillWidthStyle = _l.widthStyle, onPillLayout = _l.onPillLayout;
    var data = useConversionScreenQuery({
        fetchPolicy: "cache-first",
        skip: !isAuthed,
    }).data;
    var btcWallet = getBtcWallet((_c = (_b = data === null || data === void 0 ? void 0 : data.me) === null || _b === void 0 ? void 0 : _b.defaultAccount) === null || _c === void 0 ? void 0 : _c.wallets);
    var usdWallet = getUsdWallet((_e = (_d = data === null || data === void 0 ? void 0 : data.me) === null || _d === void 0 ? void 0 : _d.defaultAccount) === null || _e === void 0 ? void 0 : _e.wallets);
    var btcToUsdRate = useMemo(function () {
        if (!convertMoneyAmount)
            return null;
        var oneBtc = toBtcMoneyAmount(SATS_PER_BTC);
        var usdEquivalent = convertMoneyAmount(oneBtc, WalletCurrency.Usd);
        return formatMoneyAmount({
            moneyAmount: usdEquivalent,
            isApproximate: false,
        });
    }, [convertMoneyAmount, formatMoneyAmount]);
    if (!(data === null || data === void 0 ? void 0 : data.me) || !usdWallet || !btcWallet || !convertMoneyAmount) {
        // TODO: handle errors and or provide some loading state
        return null;
    }
    var fromWallet = fromWalletCurrency === WalletCurrency.Btc
        ? { id: btcWallet.id, currency: WalletCurrency.Btc }
        : { id: usdWallet.id, currency: WalletCurrency.Usd };
    var toWallet = fromWalletCurrency === WalletCurrency.Btc
        ? { id: usdWallet.id, currency: WalletCurrency.Usd }
        : { id: btcWallet.id, currency: WalletCurrency.Btc };
    var fromWalletLabel = fromWallet.currency === WalletCurrency.Btc ? LL.common.bitcoin() : LL.common.dollar();
    var toWalletLabel = toWallet.currency === WalletCurrency.Btc ? LL.common.bitcoin() : LL.common.dollar();
    var fromAmount = convertMoneyAmount(moneyAmount, fromWallet.currency);
    var toAmount = convertMoneyAmount(moneyAmount, toWallet.currency);
    var fromWalletBalanceFormatted = formatMoneyAmount({ moneyAmount: fromAmount });
    var fromSatsFormatted = fromWallet.currency === WalletCurrency.Usd && displayCurrency === WalletCurrency.Usd
        ? null
        : moneyAmountToDisplayCurrencyString({
            moneyAmount: fromAmount,
            isApproximate: true,
        });
    var toWalletBalanceFormatted = formatMoneyAmount({
        moneyAmount: toAmount,
        isApproximate: true,
    });
    var toSatsFormatted = toWallet.currency === WalletCurrency.Usd && displayCurrency === WalletCurrency.Usd
        ? null
        : moneyAmountToDisplayCurrencyString({
            moneyAmount: toAmount,
            isApproximate: true,
        });
    var handlePaymentReturn = function (status, errorsMessage) {
        if (status === "SUCCESS") {
            // navigate to next screen
            navigation.dispatch(function (state) {
                var routes = [{ name: "Primary" }, { name: "conversionSuccess" }];
                return CommonActions.reset(__assign(__assign({}, state), { routes: routes, index: routes.length - 1 }));
            });
            ReactNativeHapticFeedback.trigger("notificationSuccess", {
                ignoreAndroidSystemSettings: true,
            });
        }
        if (typeof errorsMessage === "string") {
            setErrorMessage(errorsMessage);
            ReactNativeHapticFeedback.trigger("notificationError", {
                ignoreAndroidSystemSettings: true,
            });
        }
        else if (errorsMessage === null || errorsMessage === void 0 ? void 0 : errorsMessage.length) {
            setErrorMessage(getErrorMessages(errorsMessage));
            ReactNativeHapticFeedback.trigger("notificationError", {
                ignoreAndroidSystemSettings: true,
            });
        }
    };
    var handlePaymentError = function (error) {
        toastShow({ message: error.message, LL: LL });
    };
    var payWallet = function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, data_1, errors, status_1, err_1, _b, data_2, errors, status_2, err_2;
        var _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    if (!(fromWallet.currency === WalletCurrency.Btc)) return [3 /*break*/, 4];
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 3, , 4]);
                    logConversionAttempt({
                        sendingWallet: fromWallet.currency,
                        receivingWallet: toWallet.currency,
                    });
                    return [4 /*yield*/, intraLedgerPaymentSend({
                            variables: {
                                input: {
                                    walletId: fromWallet.id,
                                    recipientWalletId: toWallet.id,
                                    amount: fromAmount.amount,
                                },
                            },
                            refetchQueries: [HomeAuthedDocument],
                        })];
                case 2:
                    _a = _e.sent(), data_1 = _a.data, errors = _a.errors;
                    status_1 = data_1 === null || data_1 === void 0 ? void 0 : data_1.intraLedgerPaymentSend.status;
                    if (!status_1) {
                        throw new Error("Conversion failed");
                    }
                    logConversionResult({
                        sendingWallet: fromWallet.currency,
                        receivingWallet: toWallet.currency,
                        paymentStatus: status_1,
                    });
                    handlePaymentReturn(status_1, errors || ((_c = data_1 === null || data_1 === void 0 ? void 0 : data_1.intraLedgerPaymentSend.errors[0]) === null || _c === void 0 ? void 0 : _c.message));
                    return [3 /*break*/, 4];
                case 3:
                    err_1 = _e.sent();
                    if (err_1 instanceof Error) {
                        crashlytics().recordError(err_1);
                        handlePaymentError(err_1);
                    }
                    return [3 /*break*/, 4];
                case 4:
                    if (!(fromWallet.currency === WalletCurrency.Usd)) return [3 /*break*/, 8];
                    _e.label = 5;
                case 5:
                    _e.trys.push([5, 7, , 8]);
                    logConversionAttempt({
                        sendingWallet: fromWallet.currency,
                        receivingWallet: toWallet.currency,
                    });
                    return [4 /*yield*/, intraLedgerUsdPaymentSend({
                            variables: {
                                input: {
                                    walletId: fromWallet.id,
                                    recipientWalletId: toWallet.id,
                                    amount: fromAmount.amount,
                                },
                            },
                            refetchQueries: [HomeAuthedDocument],
                        })];
                case 6:
                    _b = _e.sent(), data_2 = _b.data, errors = _b.errors;
                    status_2 = data_2 === null || data_2 === void 0 ? void 0 : data_2.intraLedgerUsdPaymentSend.status;
                    if (!status_2) {
                        throw new Error("Conversion failed");
                    }
                    logConversionResult({
                        sendingWallet: fromWallet.currency,
                        receivingWallet: toWallet.currency,
                        paymentStatus: status_2,
                    });
                    handlePaymentReturn(status_2, errors || ((_d = data_2 === null || data_2 === void 0 ? void 0 : data_2.intraLedgerUsdPaymentSend.errors[0]) === null || _d === void 0 ? void 0 : _d.message));
                    return [3 /*break*/, 8];
                case 7:
                    err_2 = _e.sent();
                    if (err_2 instanceof Error) {
                        crashlytics().recordError(err_2);
                        handlePaymentError(err_2);
                    }
                    return [3 /*break*/, 8];
                case 8: return [2 /*return*/];
            }
        });
    }); };
    return (<Screen>
      <ScrollView style={styles.scrollViewContainer}>
        <View style={styles.conversionRate}>
          <Text type="p2" style={styles.conversionRateText}>
            1 BTC = {btcToUsdRate}
          </Text>
        </View>
        <View style={styles.conversionInfoCard}>
          <View style={styles.fromFieldContainer}>
            <CurrencyPill currency={fromWallet.currency} containerSize="medium" containerStyle={pillWidthStyle} onLayout={onPillLayout(fromWallet.currency)}/>

            <View style={styles.walletSelectorBalanceContainer}>
              <Text style={styles.conversionInfoFieldValue}>
                {fromWalletBalanceFormatted}
              </Text>
              <Text style={styles.conversionInfoFieldConvertValue}>
                {fromSatsFormatted}
              </Text>
            </View>
          </View>
          <View style={styles.walletSeparator}>
            <View style={styles.line}></View>
            <TouchableOpacity style={styles.switchButton} disabled>
              <Icon name="arrow-down-outline" color={colors.grey3} size={25}/>
            </TouchableOpacity>
          </View>
          <View style={styles.toFieldContainer}>
            <CurrencyPill currency={toWallet.currency} containerSize="medium" containerStyle={pillWidthStyle} onLayout={onPillLayout(toWallet.currency)}/>
            <View style={styles.walletSelectorBalanceContainer}>
              <Text style={styles.conversionInfoFieldValue}>
                {toWalletBalanceFormatted}
              </Text>
              <Text style={styles.conversionInfoFieldConvertValue}>
                {toSatsFormatted}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.infoContainer}>
          <Text style={styles.conversionInfoFieldTitle}>
            {toWallet.currency === WalletCurrency.Btc
            ? LL.ConversionConfirmationScreen.infoBitcoin()
            : LL.ConversionConfirmationScreen.infoDollar()}
          </Text>
        </View>
        {errorMessage && (<View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>)}
      </ScrollView>
      <PanGestureHandler>
        <View style={styles.sliderContainer}>
          <GaloySliderButton isLoading={isLoading} initialText={LL.ConversionConfirmationScreen.transferButtonText({
            fromWallet: fromWalletLabel,
            toWallet: toWalletLabel,
        })} loadingText={LL.SendBitcoinConfirmationScreen.slideConfirming()} onSwipe={payWallet} disabled={isLoading}/>
        </View>
      </PanGestureHandler>
    </Screen>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        scrollViewContainer: {
            flexDirection: "column",
        },
        conversionInfoCard: {
            margin: 20,
            backgroundColor: colors.grey5,
            borderRadius: 13,
            padding: 20,
        },
        conversionRate: {
            marginHorizontal: 20,
            padding: 20,
            paddingBottom: 0,
            marginBottom: 0,
        },
        conversionRateText: {
            color: colors.grey0,
        },
        conversionInfoField: {
            marginBottom: 20,
        },
        conversionInfoFieldTitle: { color: colors.grey1, lineHeight: 25, fontWeight: "400" },
        conversionInfoFieldValue: {
            color: colors.grey1,
            fontWeight: "bold",
            fontSize: 20,
        },
        conversionInfoFieldConvertValue: {
            color: colors.grey2,
            fontSize: 14,
            fontWeight: "normal",
        },
        buttonContainer: { marginHorizontal: 20, marginBottom: 20 },
        errorContainer: {
            marginBottom: 10,
        },
        errorText: {
            color: colors.error,
            textAlign: "center",
        },
        walletSelectorContainer: {
            flexDirection: "column",
            backgroundColor: colors.grey5,
            borderRadius: 10,
            padding: 15,
            marginBottom: 15,
        },
        fromFieldContainer: {
            flexDirection: "row",
            marginBottom: 15,
            alignItems: "center",
        },
        walletSelectorBalanceContainer: {
            marginTop: 5,
            flex: 1,
            flexDirection: "column",
            alignItems: "flex-end",
            justifyContent: "flex-end",
        },
        walletSeparator: {
            flexDirection: "row",
            height: 1,
            justifyContent: "center",
            alignItems: "center",
            position: "relative",
        },
        line: {
            backgroundColor: colors.grey4,
            height: 1,
            flex: 1,
        },
        switchButton: {
            position: "absolute",
            left: 100,
            height: 43,
            width: 43,
            borderRadius: 50,
            backgroundColor: colors.grey4,
            justifyContent: "center",
            alignItems: "center",
        },
        toFieldContainer: {
            flexDirection: "row",
            marginTop: 15,
            alignItems: "center",
        },
        infoContainer: {
            marginHorizontal: 20,
            backgroundColor: colors.grey5,
            borderRadius: 6,
            padding: 20,
            paddingVertical: 12,
            borderLeftWidth: 2,
            borderLeftColor: colors.black,
        },
        sliderContainer: {
            padding: 20,
        },
    });
});
//# sourceMappingURL=conversion-confirmation-screen.js.map