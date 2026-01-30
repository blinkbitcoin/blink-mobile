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
import { requestInvoice, utils } from "lnurl-pay";
import React, { useEffect, useState } from "react";
import { TouchableOpacity, TouchableWithoutFeedback, View } from "react-native";
import ReactNativeModal from "react-native-modal";
import Icon from "react-native-vector-icons/Ionicons";
import { gql } from "@apollo/client";
import { AmountInput } from "@app/components/amount-input/amount-input";
import { GaloyIcon } from "@app/components/atomic/galoy-icon";
import { CurrencyPill, useEqualPillWidth } from "@app/components/atomic/currency-pill";
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button";
import { GaloyTertiaryButton } from "@app/components/atomic/galoy-tertiary-button";
import { NoteInput } from "@app/components/note-input";
import { PaymentDestinationDisplay } from "@app/components/payment-destination-display";
import { Screen } from "@app/components/screen";
import { HIDDEN_AMOUNT_PLACEHOLDER } from "@app/config";
import { useOnChainTxFeeLazyQuery, useSendBitcoinDetailsScreenQuery, useSendBitcoinInternalLimitsQuery, useSendBitcoinWithdrawalLimitsQuery, WalletCurrency, } from "@app/graphql/generated";
import { useHideAmount } from "@app/graphql/hide-amount-context";
import { useIsAuthed } from "@app/graphql/is-authed-context";
import { useLevel } from "@app/graphql/level-context";
import { getBtcWallet, getDefaultWallet, getUsdWallet } from "@app/graphql/wallets-utils";
import { usePriceConversion } from "@app/hooks";
import { useDisplayCurrency } from "@app/hooks/use-display-currency";
import { useI18nContext } from "@app/i18n/i18n-react";
import { DisplayCurrency, toBtcMoneyAmount, toUsdMoneyAmount, } from "@app/types/amounts";
import { toastShow } from "@app/utils/toast";
import { decodeInvoiceString, } from "@blinkbitcoin/blink-client";
import Clipboard from "@react-native-clipboard/clipboard";
import crashlytics from "@react-native-firebase/crashlytics";
import { useNavigation } from "@react-navigation/native";
import { makeStyles, Text, useTheme } from "@rn-vui/themed";
import { testProps } from "../../utils/testProps";
import { ConfirmFeesModal } from "./confirm-fees-modal";
import { isValidAmount } from "./payment-details";
import { SendBitcoinDetailsExtraInfo } from "./send-bitcoin-details-extra-info";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  query sendBitcoinDetailsScreen {\n    globals {\n      network\n    }\n    me {\n      id\n      defaultAccount {\n        id\n        defaultWalletId\n        wallets {\n          id\n          walletCurrency\n          balance\n        }\n      }\n    }\n  }\n\n  query sendBitcoinWithdrawalLimits {\n    me {\n      id\n      defaultAccount {\n        id\n        limits {\n          withdrawal {\n            totalLimit\n            remainingLimit\n            interval\n          }\n        }\n      }\n    }\n  }\n\n  query sendBitcoinInternalLimits {\n    me {\n      id\n      defaultAccount {\n        id\n        limits {\n          internalSend {\n            totalLimit\n            remainingLimit\n            interval\n          }\n        }\n      }\n    }\n  }\n"], ["\n  query sendBitcoinDetailsScreen {\n    globals {\n      network\n    }\n    me {\n      id\n      defaultAccount {\n        id\n        defaultWalletId\n        wallets {\n          id\n          walletCurrency\n          balance\n        }\n      }\n    }\n  }\n\n  query sendBitcoinWithdrawalLimits {\n    me {\n      id\n      defaultAccount {\n        id\n        limits {\n          withdrawal {\n            totalLimit\n            remainingLimit\n            interval\n          }\n        }\n      }\n    }\n  }\n\n  query sendBitcoinInternalLimits {\n    me {\n      id\n      defaultAccount {\n        id\n        limits {\n          internalSend {\n            totalLimit\n            remainingLimit\n            interval\n          }\n        }\n      }\n    }\n  }\n"])));
var SendBitcoinDetailsScreen = function (_a) {
    var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
    var route = _a.route;
    var colors = useTheme().theme.colors;
    var styles = useStyles();
    var navigation = useNavigation();
    var currentLevel = useLevel().currentLevel;
    var hideAmount = useHideAmount().hideAmount;
    var data = useSendBitcoinDetailsScreenQuery({
        fetchPolicy: "cache-first",
        returnPartialData: true,
        skip: !useIsAuthed(),
    }).data;
    var formatMoneyAmount = useDisplayCurrency().formatMoneyAmount;
    var LL = useI18nContext().LL;
    var _u = useState(false), isLoadingLnurl = _u[0], setIsLoadingLnurl = _u[1];
    var _v = useState(false), modalHighFeesVisible = _v[0], setModalHighFeesVisible = _v[1];
    var _convertMoneyAmount = usePriceConversion().convertMoneyAmount;
    var zeroDisplayAmount = useDisplayCurrency().zeroDisplayAmount;
    var defaultWallet = getDefaultWallet((_c = (_b = data === null || data === void 0 ? void 0 : data.me) === null || _b === void 0 ? void 0 : _b.defaultAccount) === null || _c === void 0 ? void 0 : _c.wallets, (_e = (_d = data === null || data === void 0 ? void 0 : data.me) === null || _d === void 0 ? void 0 : _d.defaultAccount) === null || _e === void 0 ? void 0 : _e.defaultWalletId);
    var btcWallet = getBtcWallet((_g = (_f = data === null || data === void 0 ? void 0 : data.me) === null || _f === void 0 ? void 0 : _f.defaultAccount) === null || _g === void 0 ? void 0 : _g.wallets);
    var usdWallet = getUsdWallet((_j = (_h = data === null || data === void 0 ? void 0 : data.me) === null || _h === void 0 ? void 0 : _h.defaultAccount) === null || _j === void 0 ? void 0 : _j.wallets);
    var network = (_k = data === null || data === void 0 ? void 0 : data.globals) === null || _k === void 0 ? void 0 : _k.network;
    var wallets = (_m = (_l = data === null || data === void 0 ? void 0 : data.me) === null || _l === void 0 ? void 0 : _l.defaultAccount) === null || _m === void 0 ? void 0 : _m.wallets;
    var paymentDestination = route.params.paymentDestination;
    var _w = useState(null), paymentDetail = _w[0], setPaymentDetail = _w[1];
    var withdrawalLimitsData = useSendBitcoinWithdrawalLimitsQuery({
        fetchPolicy: "no-cache",
        skip: !useIsAuthed() ||
            !(paymentDetail === null || paymentDetail === void 0 ? void 0 : paymentDetail.paymentType) ||
            paymentDetail.paymentType === "intraledger",
    }).data;
    var intraledgerLimitsData = useSendBitcoinInternalLimitsQuery({
        fetchPolicy: "no-cache",
        skip: !useIsAuthed() ||
            !(paymentDetail === null || paymentDetail === void 0 ? void 0 : paymentDetail.paymentType) ||
            paymentDetail.paymentType !== "intraledger",
    }).data;
    var _x = useState(false), isModalVisible = _x[0], setIsModalVisible = _x[1];
    var _y = useState(""), asyncErrorMessage = _y[0], setAsyncErrorMessage = _y[1];
    var _z = useEqualPillWidth(), pillWidthStyle = _z.widthStyle, onPillLayout = _z.onPillLayout;
    // we are caching the _convertMoneyAmount when the screen loads.
    // this is because the _convertMoneyAmount can change while the user is on this screen
    // and we don't want to update the payment detail with a new convertMoneyAmount
    useEffect(function () {
        if (!_convertMoneyAmount) {
            return;
        }
        setPaymentDetail(function (paymentDetail) {
            return paymentDetail && paymentDetail.setConvertMoneyAmount(_convertMoneyAmount);
        });
    }, [_convertMoneyAmount, setPaymentDetail]);
    // we set the default values when the screen loads
    // this only run once (doesn't re-run after paymentDetail is set)
    useEffect(function () {
        if (paymentDetail || !defaultWallet || !_convertMoneyAmount) {
            return;
        }
        var initialPaymentDetail = paymentDestination.createPaymentDetail({
            convertMoneyAmount: _convertMoneyAmount,
            sendingWalletDescriptor: {
                id: defaultWallet.id,
                currency: defaultWallet.walletCurrency,
            },
        });
        // Start with usd as the unit of account
        if (initialPaymentDetail.canSetAmount) {
            initialPaymentDetail = initialPaymentDetail.setAmount(zeroDisplayAmount);
        }
        setPaymentDetail(initialPaymentDetail);
    }, [
        setPaymentDetail,
        paymentDestination,
        _convertMoneyAmount,
        paymentDetail,
        defaultWallet,
        btcWallet,
        zeroDisplayAmount,
    ]);
    var alertHighFees = useOnchainFeeAlert(paymentDetail, btcWallet === null || btcWallet === void 0 ? void 0 : btcWallet.id, network);
    if (!paymentDetail) {
        return <></>;
    }
    var sendingWalletDescriptor = paymentDetail.sendingWalletDescriptor, convertMoneyAmount = paymentDetail.convertMoneyAmount;
    var lnurlParams = (paymentDetail === null || paymentDetail === void 0 ? void 0 : paymentDetail.paymentType) === "lnurl" ? paymentDetail === null || paymentDetail === void 0 ? void 0 : paymentDetail.lnurlParams : undefined;
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
    var amountStatus = isValidAmount({
        paymentDetail: paymentDetail,
        usdWalletAmount: usdBalanceMoneyAmount,
        btcWalletAmount: btcBalanceMoneyAmount,
        intraledgerLimits: (_q = (_p = (_o = intraledgerLimitsData === null || intraledgerLimitsData === void 0 ? void 0 : intraledgerLimitsData.me) === null || _o === void 0 ? void 0 : _o.defaultAccount) === null || _p === void 0 ? void 0 : _p.limits) === null || _q === void 0 ? void 0 : _q.internalSend,
        withdrawalLimits: (_t = (_s = (_r = withdrawalLimitsData === null || withdrawalLimitsData === void 0 ? void 0 : withdrawalLimitsData.me) === null || _r === void 0 ? void 0 : _r.defaultAccount) === null || _s === void 0 ? void 0 : _s.limits) === null || _t === void 0 ? void 0 : _t.withdrawal,
    });
    var toggleModal = function () {
        setIsModalVisible(!isModalVisible);
    };
    var copyToClipboard = function () {
        Clipboard.setString(paymentDetail.destination);
        toastShow({
            type: "success",
            message: LL.SendBitcoinScreen.copiedDestination(),
            LL: LL,
        });
    };
    var chooseWallet = function (wallet) {
        var updatedPaymentDetail = paymentDetail.setSendingWalletDescriptor({
            id: wallet.id,
            currency: wallet.walletCurrency,
        });
        // switch back to the display currency
        if (updatedPaymentDetail.canSetAmount) {
            var displayAmount = updatedPaymentDetail.convertMoneyAmount(paymentDetail.unitOfAccountAmount, DisplayCurrency);
            updatedPaymentDetail = updatedPaymentDetail.setAmount(displayAmount);
        }
        setPaymentDetail(updatedPaymentDetail);
        toggleModal();
    };
    var transactionType = function () {
        if ((paymentDetail === null || paymentDetail === void 0 ? void 0 : paymentDetail.paymentType) === "intraledger")
            return LL.common.intraledger();
        if ((paymentDetail === null || paymentDetail === void 0 ? void 0 : paymentDetail.paymentType) === "onchain")
            return LL.common.onchain();
        if ((paymentDetail === null || paymentDetail === void 0 ? void 0 : paymentDetail.paymentType) === "lightning")
            return LL.common.lightning();
        if ((paymentDetail === null || paymentDetail === void 0 ? void 0 : paymentDetail.paymentType) === "lnurl")
            return LL.common.lightning();
    };
    var ChooseWalletModal = wallets && (<ReactNativeModal style={styles.modal} animationIn="fadeInDown" animationOut="fadeOutUp" isVisible={isModalVisible} onBackButtonPress={toggleModal} onBackdropPress={toggleModal}>
      <View>
        {wallets.map(function (wallet) {
            return (<TouchableWithoutFeedback key={wallet.id} {...testProps(wallet.walletCurrency)} onPress={function () {
                    chooseWallet(wallet);
                }}>
              <View style={styles.walletContainer}>
                <View style={styles.walletSelectorTypeContainer}>
                  <CurrencyPill currency={wallet.walletCurrency} containerSize="medium" containerStyle={pillWidthStyle} onLayout={onPillLayout(wallet.walletCurrency)}/>
                </View>
                <View style={styles.walletSelectorInfoContainer}>
                  <View style={styles.walletSelectorTypeTextContainer}>
                    {wallet.walletCurrency === WalletCurrency.Btc ? (<Text style={styles.walletCurrencyText}>
                        {hideAmount ? HIDDEN_AMOUNT_PLACEHOLDER : btcPrimaryText}
                      </Text>) : (<Text style={styles.walletCurrencyText}>
                        {hideAmount ? HIDDEN_AMOUNT_PLACEHOLDER : usdPrimaryText}
                      </Text>)}
                  </View>
                  <View style={styles.walletSelectorBalanceContainer}>
                    {wallet.walletCurrency === WalletCurrency.Btc ? (<Text>
                        {hideAmount ? HIDDEN_AMOUNT_PLACEHOLDER : btcSecondaryText}
                      </Text>) : (<Text>
                        {hideAmount ? HIDDEN_AMOUNT_PLACEHOLDER : usdSecondaryText}
                      </Text>)}
                  </View>
                  <View />
                </View>
              </View>
            </TouchableWithoutFeedback>);
        })}
      </View>
    </ReactNativeModal>);
    var goToNextScreen = (paymentDetail.sendPaymentMutation ||
        (paymentDetail.paymentType === "lnurl" && paymentDetail.unitOfAccountAmount)) &&
        (function () { return __awaiter(void 0, void 0, void 0, function () {
            var paymentDetailForConfirmation, btcAmount, requestInvoiceParams, result, invoice, decodedInvoice, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        paymentDetailForConfirmation = paymentDetail;
                        if (!(paymentDetail.paymentType === "lnurl")) return [3 /*break*/, 4];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        setIsLoadingLnurl(true);
                        btcAmount = paymentDetail.convertMoneyAmount(paymentDetail.unitOfAccountAmount, "BTC");
                        requestInvoiceParams = {
                            lnUrlOrAddress: paymentDetail.destination,
                            tokens: utils.toSats(btcAmount.amount),
                        };
                        if (lnurlParams === null || lnurlParams === void 0 ? void 0 : lnurlParams.commentAllowed) {
                            requestInvoiceParams.comment = paymentDetail.memo;
                        }
                        return [4 /*yield*/, requestInvoice(requestInvoiceParams)];
                    case 2:
                        result = _a.sent();
                        setPaymentDetail(paymentDetail.setSuccessAction(result.successAction));
                        setIsLoadingLnurl(false);
                        invoice = result.invoice;
                        decodedInvoice = decodeInvoiceString(invoice, network);
                        if (Math.round(Number(decodedInvoice.millisatoshis) / 1000) !== btcAmount.amount) {
                            setAsyncErrorMessage(LL.SendBitcoinScreen.lnurlInvoiceIncorrectAmount());
                            return [2 /*return*/];
                        }
                        paymentDetailForConfirmation = __assign(__assign({}, paymentDetail.setInvoice({
                            paymentRequest: invoice,
                            paymentRequestAmount: btcAmount,
                        })), { successAction: result.successAction });
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        setIsLoadingLnurl(false);
                        if (error_1 instanceof Error) {
                            crashlytics().recordError(error_1);
                        }
                        setAsyncErrorMessage(LL.SendBitcoinScreen.failedToFetchLnurlInvoice());
                        return [2 /*return*/];
                    case 4:
                        if (paymentDetailForConfirmation.sendPaymentMutation) {
                            if (alertHighFees) {
                                setModalHighFeesVisible(true);
                            }
                            else {
                                navigation.navigate("sendBitcoinConfirmation", {
                                    paymentDetail: paymentDetailForConfirmation,
                                });
                            }
                        }
                        return [2 /*return*/];
                }
            });
        }); });
    var setAmount = function (moneyAmount) {
        setPaymentDetail(function (paymentDetail) {
            return (paymentDetail === null || paymentDetail === void 0 ? void 0 : paymentDetail.setAmount) ? paymentDetail.setAmount(moneyAmount) : paymentDetail;
        });
    };
    var sendAll = function () {
        var _a, _b;
        var moneyAmount;
        if (paymentDetail.sendingWalletDescriptor.currency === WalletCurrency.Btc) {
            moneyAmount = {
                amount: (_a = btcWallet === null || btcWallet === void 0 ? void 0 : btcWallet.balance) !== null && _a !== void 0 ? _a : 0,
                currency: WalletCurrency.Btc,
                currencyCode: "BTC",
            };
        }
        else {
            moneyAmount = {
                amount: (_b = usdWallet === null || usdWallet === void 0 ? void 0 : usdWallet.balance) !== null && _b !== void 0 ? _b : 0,
                currency: WalletCurrency.Usd,
                currencyCode: "USD",
            };
        }
        setPaymentDetail(function (paymentDetail) {
            return (paymentDetail === null || paymentDetail === void 0 ? void 0 : paymentDetail.setAmount)
                ? paymentDetail.setAmount(moneyAmount, true)
                : paymentDetail;
        });
    };
    return (<Screen preset="scroll" style={styles.screenStyle} keyboardOffset="navigationHeader" keyboardShouldPersistTaps="handled">
      <ConfirmFeesModal action={function () {
            setModalHighFeesVisible(false);
            navigation.navigate("sendBitcoinConfirmation", { paymentDetail: paymentDetail });
        }} isVisible={modalHighFeesVisible} cancel={function () { return setModalHighFeesVisible(false); }}/>
      <View style={styles.sendBitcoinAmountContainer}>
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldTitleText}>
            {LL.SendBitcoinScreen.destination()} - {transactionType()}
          </Text>
          <View style={styles.destinationFieldContainer}>
            <View style={styles.disabledFieldBackground}>
              <PaymentDestinationDisplay destination={paymentDetail.destination} paymentType={paymentDetail.paymentType}/>
            </View>
            <TouchableOpacity style={styles.iconContainer} onPress={copyToClipboard} hitSlop={30}>
              <GaloyIcon name={"copy-paste"} size={18} color={colors.primary}/>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldTitleText}>{LL.common.from()}</Text>
          <TouchableWithoutFeedback {...testProps("choose-wallet-to-send-from")} onPress={toggleModal} accessible={false}>
            <View style={styles.fieldBackground}>
              <View style={styles.walletSelectorTypeContainer}>
                <CurrencyPill currency={sendingWalletDescriptor.currency} containerSize="medium" containerStyle={pillWidthStyle} onLayout={onPillLayout(sendingWalletDescriptor.currency)}/>
              </View>
              <View style={styles.walletSelectorInfoContainer}>
                <View style={styles.walletSelectorTypeTextContainer}>
                  {sendingWalletDescriptor.currency === WalletCurrency.Btc ? (<>
                      <Text style={styles.walletCurrencyText}>
                        {hideAmount ? HIDDEN_AMOUNT_PLACEHOLDER : btcPrimaryText}
                      </Text>
                    </>) : (<>
                      <Text style={styles.walletCurrencyText}>
                        {hideAmount ? HIDDEN_AMOUNT_PLACEHOLDER : usdPrimaryText}
                      </Text>
                    </>)}
                </View>
                <View style={styles.walletSelectorBalanceContainer}>
                  <Text {...testProps("".concat(sendingWalletDescriptor.currency, " Wallet Balance"))}>
                    {hideAmount
            ? HIDDEN_AMOUNT_PLACEHOLDER
            : sendingWalletDescriptor.currency === WalletCurrency.Btc
                ? btcSecondaryText
                : usdSecondaryText}
                  </Text>
                </View>
              </View>

              <View style={styles.pickWalletIcon}>
                <Icon name={"chevron-down"} size={24} color={colors.primary}/>
              </View>
            </View>
          </TouchableWithoutFeedback>
          {ChooseWalletModal}
        </View>
        <View style={styles.fieldContainer}>
          <View style={styles.amountRightMaxField}>
            <Text {...testProps(LL.SendBitcoinScreen.amount())} style={styles.amountText}>
              {LL.SendBitcoinScreen.amount()}
            </Text>
            {paymentDetail.canSendMax && !paymentDetail.isSendingMax && (<GaloyTertiaryButton clear title={LL.SendBitcoinScreen.maxAmount()} onPress={sendAll}/>)}
          </View>
          <View style={styles.currencyInputContainer}>
            <AmountInput unitOfAccountAmount={paymentDetail.unitOfAccountAmount} setAmount={setAmount} convertMoneyAmount={paymentDetail.convertMoneyAmount} walletCurrency={sendingWalletDescriptor.currency} canSetAmount={paymentDetail.canSetAmount} isSendingMax={paymentDetail.isSendingMax} maxAmount={(lnurlParams === null || lnurlParams === void 0 ? void 0 : lnurlParams.max) ? toBtcMoneyAmount(lnurlParams.max) : undefined} minAmount={(lnurlParams === null || lnurlParams === void 0 ? void 0 : lnurlParams.min) ? toBtcMoneyAmount(lnurlParams.min) : undefined}/>
          </View>
        </View>
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldTitleText}>{LL.SendBitcoinScreen.note()}</Text>
          <NoteInput onChangeText={function (text) {
            return paymentDetail.setMemo && setPaymentDetail(paymentDetail.setMemo(text));
        }} value={paymentDetail.memo || ""} editable={paymentDetail.canSetMemo}/>
        </View>
        <SendBitcoinDetailsExtraInfo errorMessage={asyncErrorMessage} amountStatus={amountStatus} currentLevel={currentLevel}/>
        <View style={styles.buttonContainer}>
          <GaloyPrimaryButton onPress={goToNextScreen || undefined} loading={isLoadingLnurl} disabled={!goToNextScreen || !amountStatus.validAmount} title={LL.common.next()}/>
        </View>
      </View>
    </Screen>);
};
export default SendBitcoinDetailsScreen;
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        sendBitcoinAmountContainer: {
            flex: 1,
        },
        fieldBackground: {
            flexDirection: "row",
            borderStyle: "solid",
            overflow: "hidden",
            backgroundColor: colors.grey5,
            borderRadius: 10,
            alignItems: "center",
            padding: 14,
            minHeight: 60,
        },
        destinationFieldContainer: {
            flexDirection: "row",
            borderStyle: "solid",
            overflow: "hidden",
            backgroundColor: colors.grey5,
            borderRadius: 10,
            alignItems: "center",
            padding: 14,
            minHeight: 60,
        },
        disabledFieldBackground: {
            flex: 1,
            opacity: 0.5,
            flexDirection: "row",
            alignItems: "center",
        },
        walletContainer: {
            flexDirection: "row",
            borderStyle: "solid",
            overflow: "hidden",
            backgroundColor: colors.grey5,
            paddingHorizontal: 14,
            borderRadius: 10,
            alignItems: "center",
            marginBottom: 10,
            minHeight: 60,
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
        walletCurrencyText: {
            fontWeight: "bold",
            fontSize: 18,
        },
        walletSelectorTypeTextContainer: {
            flex: 1,
            justifyContent: "flex-end",
        },
        walletSelectorBalanceContainer: {
            flex: 1,
            flexDirection: "row",
        },
        fieldTitleText: {
            fontWeight: "bold",
            marginBottom: 4,
        },
        fieldContainer: {
            marginBottom: 12,
        },
        currencyInputContainer: {
            flexDirection: "column",
        },
        switchCurrencyIconContainer: {
            width: 50,
            justifyContent: "center",
            alignItems: "center",
        },
        buttonContainer: {
            flex: 1,
            justifyContent: "flex-end",
        },
        modal: {
            marginBottom: "90%",
        },
        pickWalletIcon: {
            justifyContent: "center",
            alignItems: "center",
        },
        screenStyle: {
            padding: 20,
            flexGrow: 1,
        },
        amountText: {
            fontWeight: "bold",
        },
        amountRightMaxField: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
        },
        iconContainer: {
            justifyContent: "center",
            alignItems: "flex-start",
            paddingLeft: 20,
        },
    });
});
var useOnchainFeeAlert = function (paymentDetail, walletId, network) {
    var dummyAddress = network === "mainnet"
        ? "bc1qk2cpytjea36ry6vga8wwr7297sl3tdkzwzy2cw"
        : "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx";
    var isOnchainPayment = walletId && paymentDetail && paymentDetail.paymentType === "onchain";
    // we need to have an approximate value for the onchain fees
    // by the time the user tap on the next button
    // so we are fetching some fees when the screen loads
    // the fees are approximate but that doesn't matter for the use case
    // of warning the user if the fees are high compared to the amount sent
    // TODO: check if the BTC wallet is empty, and only USD wallet is used, if the query works
    var getOnChainTxFee = useOnChainTxFeeLazyQuery({
        fetchPolicy: "cache-and-network",
        variables: {
            walletId: walletId,
            amount: 1000,
            address: dummyAddress,
        },
    })[0];
    var _a = useState(0), onChainTxFee = _a[0], setOnChainTxFee = _a[1];
    useEffect(function () {
        if (isOnchainPayment) {
            ;
            (function () { return __awaiter(void 0, void 0, void 0, function () {
                var result, fees;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, getOnChainTxFee()];
                        case 1:
                            result = _b.sent();
                            fees = (_a = result.data) === null || _a === void 0 ? void 0 : _a.onChainTxFee.amount;
                            if (fees) {
                                setOnChainTxFee(fees);
                            }
                            else {
                                console.error("failed to get onchain fees");
                            }
                            return [2 /*return*/];
                    }
                });
            }); })();
        }
    }, [getOnChainTxFee, isOnchainPayment]);
    if (!isOnchainPayment) {
        return false;
    }
    var convertMoneyAmount = paymentDetail.convertMoneyAmount;
    // alert will shows if amount is less than fees * ratioFeesToAmount
    var ratioFeesToAmount = 2;
    var ratioedFees = toBtcMoneyAmount(onChainTxFee * ratioFeesToAmount);
    var alertHighFees = paymentDetail.paymentType === "onchain" &&
        convertMoneyAmount(paymentDetail.settlementAmount, WalletCurrency.Btc).amount <
            ratioedFees.amount;
    return alertHighFees;
};
var templateObject_1;
//# sourceMappingURL=send-bitcoin-details-screen.js.map