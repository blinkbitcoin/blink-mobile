var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
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
import React, { useState } from "react";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import { PanGestureHandler } from "react-native-gesture-handler";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import { gql } from "@apollo/client";
import { CurrencyPill, useEqualPillWidth } from "@app/components/atomic/currency-pill";
import { GaloyIcon } from "@app/components/atomic/galoy-icon";
import GaloySliderButton from "@app/components/atomic/galoy-slider-button/galoy-slider-button";
import { PaymentDestinationDisplay } from "@app/components/payment-destination-display";
import { Screen } from "@app/components/screen";
import { HIDDEN_AMOUNT_PLACEHOLDER } from "@app/config";
import { useSendBitcoinConfirmationScreenQuery, WalletCurrency, } from "@app/graphql/generated";
import { useHideAmount } from "@app/graphql/hide-amount-context";
import { useIsAuthed } from "@app/graphql/is-authed-context";
import { getBtcWallet, getUsdWallet } from "@app/graphql/wallets-utils";
import { useDisplayCurrency } from "@app/hooks/use-display-currency";
import { useI18nContext } from "@app/i18n/i18n-react";
import { addMoneyAmounts, DisplayCurrency, greaterThan, lessThanOrEqualTo, moneyAmountIsCurrencyType, multiplyMoneyAmounts, toBtcMoneyAmount, toUsdMoneyAmount, ZeroUsdMoneyAmount, } from "@app/types/amounts";
import { logPaymentAttempt, logPaymentResult } from "@app/utils/analytics";
import { toastShow } from "@app/utils/toast";
import Clipboard from "@react-native-clipboard/clipboard";
import crashlytics from "@react-native-firebase/crashlytics";
import { CommonActions, useNavigation } from "@react-navigation/native";
import { makeStyles, Text, useTheme } from "@rn-vui/themed";
import { testProps } from "../../utils/testProps";
import useFee from "./use-fee";
import { useSendPayment } from "./use-send-payment";
import { useSaveLnAddressContact } from "./use-save-lnaddress-contact";
import { ellipsizeMiddle } from "@app/utils/helper";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  query sendBitcoinConfirmationScreen {\n    me {\n      id\n      defaultAccount {\n        id\n        wallets {\n          id\n          balance\n          walletCurrency\n        }\n      }\n    }\n  }\n"], ["\n  query sendBitcoinConfirmationScreen {\n    me {\n      id\n      defaultAccount {\n        id\n        wallets {\n          id\n          balance\n          walletCurrency\n        }\n      }\n    }\n  }\n"])));
var SendBitcoinConfirmationScreen = function (_a) {
    var _b, _c, _d, _e;
    var route = _a.route;
    var colors = useTheme().theme.colors;
    var styles = useStyles();
    var navigation = useNavigation();
    var hideAmount = useHideAmount().hideAmount;
    var _f = useEqualPillWidth(), pillWidthStyle = _f.widthStyle, onPillLayout = _f.onPillLayout;
    var paymentDetail = route.params.paymentDetail;
    var destination = paymentDetail.destination, paymentType = paymentDetail.paymentType, sendingWalletDescriptor = paymentDetail.sendingWalletDescriptor, sendPaymentMutation = paymentDetail.sendPaymentMutation, getFee = paymentDetail.getFee, settlementAmount = paymentDetail.settlementAmount, note = paymentDetail.memo, unitOfAccountAmount = paymentDetail.unitOfAccountAmount, convertMoneyAmount = paymentDetail.convertMoneyAmount, isSendingMax = paymentDetail.isSendingMax;
    var _g = useDisplayCurrency(), formatDisplayAndWalletAmount = _g.formatDisplayAndWalletAmount, getSecondaryAmountIfCurrencyIsDifferent = _g.getSecondaryAmountIfCurrencyIsDifferent, formatMoneyAmount = _g.formatMoneyAmount;
    var saveLnAddressContact = useSaveLnAddressContact();
    var data = useSendBitcoinConfirmationScreenQuery({ skip: !useIsAuthed() }).data;
    var btcWallet = getBtcWallet((_c = (_b = data === null || data === void 0 ? void 0 : data.me) === null || _b === void 0 ? void 0 : _b.defaultAccount) === null || _c === void 0 ? void 0 : _c.wallets);
    var usdWallet = getUsdWallet((_e = (_d = data === null || data === void 0 ? void 0 : data.me) === null || _d === void 0 ? void 0 : _d.defaultAccount) === null || _e === void 0 ? void 0 : _e.wallets);
    var btcBalanceMoneyAmount = toBtcMoneyAmount(btcWallet === null || btcWallet === void 0 ? void 0 : btcWallet.balance);
    var usdBalanceMoneyAmount = toUsdMoneyAmount(usdWallet === null || usdWallet === void 0 ? void 0 : usdWallet.balance);
    var btcPrimaryText = formatMoneyAmount({ moneyAmount: btcBalanceMoneyAmount });
    var btcSecondaryText = formatMoneyAmount({
        moneyAmount: convertMoneyAmount(btcBalanceMoneyAmount, DisplayCurrency),
        isApproximate: true,
    });
    var usdPrimaryText = formatMoneyAmount({ moneyAmount: usdBalanceMoneyAmount });
    var usdSecondaryText = formatMoneyAmount({
        moneyAmount: convertMoneyAmount(usdBalanceMoneyAmount, WalletCurrency.Btc),
        isApproximate: true,
    });
    var _h = useState(undefined), paymentError = _h[0], setPaymentError = _h[1];
    var LL = useI18nContext().LL;
    var fee = useFee(getFee);
    var defaultAmount = formatMoneyAmount({ moneyAmount: ZeroUsdMoneyAmount });
    var currencyFeeAmount = defaultAmount;
    var satFeeAmount = defaultAmount;
    var _j = useSendPayment(sendPaymentMutation), sendPaymentLoading = _j.loading, sendPayment = _j.sendPayment, hasAttemptedSend = _j.hasAttemptedSend;
    var feeErrorText = String(LL.SendBitcoinConfirmationScreen.feeError());
    var feeDisplayText = feeErrorText;
    currencyFeeAmount = feeErrorText;
    satFeeAmount = feeErrorText;
    if (fee.amount) {
        var feeDisplayAmount = paymentDetail.convertMoneyAmount(fee.amount, DisplayCurrency);
        feeDisplayText = formatDisplayAndWalletAmount({
            displayAmount: feeDisplayAmount,
            walletAmount: fee.amount,
        });
        currencyFeeAmount = formatMoneyAmount({
            moneyAmount: feeDisplayAmount,
        });
        var secondaryFeeAmount = getSecondaryAmountIfCurrencyIsDifferent({
            primaryAmount: feeDisplayAmount,
            walletAmount: paymentDetail.convertMoneyAmount(fee.amount, WalletCurrency.Btc),
            displayAmount: paymentDetail.convertMoneyAmount(fee.amount, DisplayCurrency),
        });
        satFeeAmount = formatMoneyAmount({
            moneyAmount: secondaryFeeAmount !== null && secondaryFeeAmount !== void 0 ? secondaryFeeAmount : ZeroUsdMoneyAmount,
        });
    }
    var displayAmount = paymentDetail.convertMoneyAmount(settlementAmount, DisplayCurrency);
    var currencyAmount = formatMoneyAmount({
        moneyAmount: displayAmount,
    });
    var secondaryAmount = getSecondaryAmountIfCurrencyIsDifferent({
        primaryAmount: displayAmount,
        walletAmount: paymentDetail.convertMoneyAmount(settlementAmount, WalletCurrency.Btc),
        displayAmount: paymentDetail.convertMoneyAmount(settlementAmount, DisplayCurrency),
    });
    var satAmount = formatMoneyAmount({
        moneyAmount: secondaryAmount !== null && secondaryAmount !== void 0 ? secondaryAmount : ZeroUsdMoneyAmount,
    });
    var handleSendPayment = React.useCallback(function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, status_1, errorsMessage, extraInfo_1, transaction_1, err_1, indempotencyErrorPattern;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!sendPayment || !(sendingWalletDescriptor === null || sendingWalletDescriptor === void 0 ? void 0 : sendingWalletDescriptor.currency)) {
                        return [2 /*return*/, sendPayment];
                    }
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 5, , 6]);
                    logPaymentAttempt({
                        paymentType: paymentDetail.paymentType,
                        sendingWallet: sendingWalletDescriptor.currency,
                    });
                    return [4 /*yield*/, sendPayment()];
                case 2:
                    _a = _b.sent(), status_1 = _a.status, errorsMessage = _a.errorsMessage, extraInfo_1 = _a.extraInfo, transaction_1 = _a.transaction;
                    logPaymentResult({
                        paymentType: paymentDetail.paymentType,
                        paymentStatus: status_1,
                        sendingWallet: sendingWalletDescriptor.currency,
                    });
                    if (!(status_1 === "SUCCESS" || status_1 === "PENDING")) return [3 /*break*/, 4];
                    return [4 /*yield*/, saveLnAddressContact({
                            paymentType: paymentType,
                            destination: destination,
                            isMerchant: paymentDetail.paymentType === "lnurl" ? paymentDetail.isMerchant : undefined,
                        })];
                case 3:
                    _b.sent();
                    navigation.dispatch(function (state) {
                        var routes = [
                            { name: "Primary" },
                            {
                                name: "sendBitcoinCompleted",
                                params: {
                                    arrivalAtMempoolEstimate: extraInfo_1 === null || extraInfo_1 === void 0 ? void 0 : extraInfo_1.arrivalAtMempoolEstimate,
                                    status: status_1,
                                    successAction: paymentDetail === null || paymentDetail === void 0 ? void 0 : paymentDetail.successAction,
                                    preimage: extraInfo_1 === null || extraInfo_1 === void 0 ? void 0 : extraInfo_1.preimage,
                                    currencyAmount: currencyAmount,
                                    satAmount: satAmount,
                                    currencyFeeAmount: currencyFeeAmount,
                                    satFeeAmount: satFeeAmount,
                                    destination: (paymentDetail === null || paymentDetail === void 0 ? void 0 : paymentDetail.paymentType) === "intraledger"
                                        ? destination
                                        : ellipsizeMiddle(destination, {
                                            maxLength: 50,
                                            maxResultLeft: 13,
                                            maxResultRight: 8,
                                        }),
                                    paymentType: paymentDetail === null || paymentDetail === void 0 ? void 0 : paymentDetail.paymentType,
                                    createdAt: transaction_1 === null || transaction_1 === void 0 ? void 0 : transaction_1.createdAt,
                                },
                            },
                        ];
                        return CommonActions.reset(__assign(__assign({}, state), { routes: routes, index: routes.length - 1 }));
                    });
                    ReactNativeHapticFeedback.trigger("notificationSuccess", {
                        ignoreAndroidSystemSettings: true,
                    });
                    return [2 /*return*/];
                case 4:
                    if (status_1 === "ALREADY_PAID") {
                        setPaymentError(LL.SendBitcoinConfirmationScreen.invoiceAlreadyPaid());
                        ReactNativeHapticFeedback.trigger("notificationError", {
                            ignoreAndroidSystemSettings: true,
                        });
                        return [2 /*return*/];
                    }
                    setPaymentError(errorsMessage || LL.SendBitcoinConfirmationScreen.somethingWentWrong());
                    ReactNativeHapticFeedback.trigger("notificationError", {
                        ignoreAndroidSystemSettings: true,
                    });
                    return [3 /*break*/, 6];
                case 5:
                    err_1 = _b.sent();
                    if (err_1 instanceof Error) {
                        crashlytics().recordError(err_1);
                        indempotencyErrorPattern = /409: Conflict/i;
                        if (indempotencyErrorPattern.test(err_1.message)) {
                            setPaymentError(LL.SendBitcoinConfirmationScreen.paymentAlreadyAttempted());
                            return [2 /*return*/];
                        }
                        setPaymentError(err_1.message || err_1.toString());
                    }
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    }); }, [
        LL,
        navigation,
        paymentDetail,
        sendPayment,
        setPaymentError,
        sendingWalletDescriptor === null || sendingWalletDescriptor === void 0 ? void 0 : sendingWalletDescriptor.currency,
        paymentType,
        destination,
        saveLnAddressContact,
        currencyAmount,
        satAmount,
        currencyFeeAmount,
        satFeeAmount,
    ]);
    var validAmount = true;
    var invalidAmountErrorMessage = "";
    var totalAmount = addMoneyAmounts({
        a: settlementAmount,
        b: fee.amount || ZeroUsdMoneyAmount,
    });
    if (moneyAmountIsCurrencyType(settlementAmount, WalletCurrency.Btc) &&
        btcBalanceMoneyAmount &&
        !isSendingMax) {
        validAmount = lessThanOrEqualTo({
            value: totalAmount,
            lessThanOrEqualTo: btcBalanceMoneyAmount,
        });
        if (!validAmount) {
            invalidAmountErrorMessage = LL.SendBitcoinScreen.amountExceed({
                balance: hideAmount ? HIDDEN_AMOUNT_PLACEHOLDER : btcPrimaryText,
            });
        }
    }
    if (moneyAmountIsCurrencyType(settlementAmount, WalletCurrency.Usd) &&
        usdBalanceMoneyAmount &&
        !isSendingMax) {
        validAmount = lessThanOrEqualTo({
            value: totalAmount,
            lessThanOrEqualTo: usdBalanceMoneyAmount,
        });
        if (!validAmount) {
            invalidAmountErrorMessage = LL.SendBitcoinScreen.amountExceed({
                balance: hideAmount ? HIDDEN_AMOUNT_PLACEHOLDER : usdPrimaryText,
            });
        }
    }
    var copyToClipboard = function () {
        Clipboard.setString(destination);
        toastShow({
            type: "success",
            message: LL.SendBitcoinConfirmationScreen.copiedDestination(),
            LL: LL,
        });
    };
    var errorMessage = paymentError || invalidAmountErrorMessage;
    var transactionType = function () {
        if (paymentType === "intraledger")
            return LL.common.intraledger();
        if (paymentType === "onchain")
            return LL.common.onchain();
        if (paymentType === "lightning")
            return LL.common.lightning();
        if (paymentType === "lnurl")
            return LL.common.lightning();
    };
    var isLightningRecommended = function () {
        var ratioFeeToAmount = 50; // 2%
        if (!fee.amount)
            return false;
        var feeMultiplied = multiplyMoneyAmounts({
            value: fee.amount,
            multiplier: ratioFeeToAmount,
        });
        if (paymentType === "onchain" &&
            greaterThan({ value: feeMultiplied, greaterThan: totalAmount }))
            return true;
        return false;
    };
    var LightningRecommendedComponent = isLightningRecommended() ? (<View style={styles.feeWarning}>
      <GaloyIcon name="warning" size={18} color={colors.warning}/>
      <Text type="p3" style={styles.feeWarningText} numberOfLines={1} ellipsizeMode="tail">
        {" "}
        {LL.SendBitcoinConfirmationScreen.lightningRecommended()}
      </Text>
    </View>) : (<></>);
    return (<Screen preset="scroll" style={styles.screenStyle} keyboardOffset="navigationHeader">
      <View style={styles.sendBitcoinConfirmationContainer}>
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldTitleText}>
            {LL.SendBitcoinScreen.destination()} - {transactionType()}
          </Text>
          <View style={styles.fieldBackground}>
            <PaymentDestinationDisplay destination={destination} paymentType={paymentType}/>
            <TouchableOpacity style={styles.iconContainer} onPress={copyToClipboard} hitSlop={30}>
              <GaloyIcon name={"copy-paste"} size={18} color={colors.primary}/>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldTitleText}>{LL.common.from()}</Text>
          <View style={styles.fieldBackground}>
            <View style={styles.walletSelectorTypeContainer}>
              <CurrencyPill currency={sendingWalletDescriptor.currency} containerSize="medium" containerStyle={pillWidthStyle} onLayout={onPillLayout(sendingWalletDescriptor.currency)}/>
            </View>
            <View style={styles.walletSelectorInfoContainer}>
              <View style={styles.walletSelectorTypeTextContainer}>
                {sendingWalletDescriptor.currency === WalletCurrency.Btc ? (<Text style={styles.walletCurrencyText}>
                    {hideAmount ? HIDDEN_AMOUNT_PLACEHOLDER : btcPrimaryText}
                  </Text>) : (<Text style={styles.walletCurrencyText}>
                    {hideAmount ? HIDDEN_AMOUNT_PLACEHOLDER : usdPrimaryText}
                  </Text>)}
              </View>
              <View style={styles.walletSelectorBalanceContainer}>
                {sendingWalletDescriptor.currency === WalletCurrency.Btc ? (<Text>{hideAmount ? HIDDEN_AMOUNT_PLACEHOLDER : btcSecondaryText}</Text>) : (<Text>{hideAmount ? HIDDEN_AMOUNT_PLACEHOLDER : usdSecondaryText}</Text>)}
              </View>
              <View />
            </View>
          </View>
        </View>
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldTitleText}>{LL.SendBitcoinScreen.amount()}</Text>
          <View style={styles.fieldBackground}>
            <Text type="p2">
              {formatDisplayAndWalletAmount({
            primaryAmount: unitOfAccountAmount,
            displayAmount: displayAmount,
            walletAmount: settlementAmount,
        })}
            </Text>
          </View>
        </View>
        {note ? (<View style={styles.fieldContainer}>
            <Text style={styles.fieldTitleText}>{LL.SendBitcoinScreen.note()}</Text>
            <View style={styles.fieldBackground}>
              <Text type="p2" style={styles.noteText}>
                {note}
              </Text>
            </View>
          </View>) : null}
        <View style={styles.fieldContainer}>
          <View style={styles.feeTextContainer}>
            <Text style={styles.fieldTitleText}>
              {LL.SendBitcoinConfirmationScreen.feeLabel()}
            </Text>
            {LightningRecommendedComponent}
          </View>
          <View style={[
            styles.fieldBackground,
            isLightningRecommended() ? styles.warningOutline : undefined,
        ]}>
            {fee.status === "loading" && <ActivityIndicator />}
            {fee.status === "set" && (<Text type="p2" {...testProps("Successful Fee")}>
                {feeDisplayText}
              </Text>)}
            {fee.status === "error" && Boolean(fee.amount) && (<Text type="p2">{feeDisplayText} *</Text>)}
            {fee.status === "error" && !fee.amount && (<Text type="p2">{LL.SendBitcoinConfirmationScreen.feeError()}</Text>)}
          </View>
          {fee.status === "error" && Boolean(fee.amount) && (<Text type="p2" style={styles.maxFeeWarningText}>
              {"*" + LL.SendBitcoinConfirmationScreen.maxFeeSelected()}
            </Text>)}
        </View>

        {errorMessage ? (<View style={styles.errorContainer}>
            <Text type="p2" style={styles.errorText}>
              {errorMessage}
            </Text>
          </View>) : null}
        <View style={styles.buttonContainer}>
          {/* disable slide gestures in area around the slider button */}
          <PanGestureHandler>
            <View style={styles.sliderContainer}>
              <GaloySliderButton isLoading={sendPaymentLoading} initialText={LL.SendBitcoinConfirmationScreen.slideToConfirm()} loadingText={LL.SendBitcoinConfirmationScreen.slideConfirming()} onSwipe={handleSendPayment} disabled={!validAmount || hasAttemptedSend}/>
            </View>
          </PanGestureHandler>
        </View>
      </View>
    </Screen>);
};
export default SendBitcoinConfirmationScreen;
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        sendBitcoinConfirmationContainer: {
            flex: 1,
        },
        fieldContainer: {
            paddingHorizontal: 20,
            marginBottom: 12,
        },
        noteText: {
            flex: 1,
        },
        fieldBackground: {
            flexDirection: "row",
            borderStyle: "solid",
            overflow: "hidden",
            backgroundColor: colors.grey5,
            padding: 14,
            minHeight: 60,
            borderRadius: 10,
            alignItems: "center",
        },
        warningOutline: {
            borderColor: colors.warning,
            borderWidth: 2,
        },
        fieldTitleText: {
            fontWeight: "bold",
            marginBottom: 4,
        },
        walletSelectorTypeContainer: {
            justifyContent: "center",
            alignItems: "flex-start",
            marginRight: 28,
        },
        walletSelectorInfoContainer: {
            flex: 1,
            flexDirection: "column",
        },
        walletSelectorTypeTextContainer: {
            flex: 1,
            justifyContent: "flex-end",
        },
        walletCurrencyText: {
            fontWeight: "bold",
            fontSize: 18,
        },
        walletSelectorBalanceContainer: {
            flex: 1,
            flexDirection: "row",
        },
        buttonContainer: {
            flex: 1,
            justifyContent: "flex-end",
        },
        errorContainer: {
            marginVertical: 20,
            flex: 1,
        },
        errorText: {
            color: colors.error,
            textAlign: "center",
        },
        maxFeeWarningText: {
            color: colors.warning,
            fontWeight: "bold",
        },
        noteIconContainer: {
            marginRight: 12,
            justifyContent: "center",
            alignItems: "flex-start",
        },
        noteIcon: {
            justifyContent: "center",
            alignItems: "center",
        },
        screenStyle: {
            paddingTop: 20,
            flexGrow: 1,
        },
        iconContainer: {
            justifyContent: "center",
            alignItems: "flex-start",
            paddingLeft: 20,
        },
        feeWarning: {
            paddingBottom: 4,
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            flex: 0.95,
        },
        feeWarningText: {
            color: colors.warning,
        },
        feeTextContainer: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
        },
        sliderContainer: {
            padding: 20,
        },
    });
});
var templateObject_1;
//# sourceMappingURL=send-bitcoin-confirmation-screen.js.map