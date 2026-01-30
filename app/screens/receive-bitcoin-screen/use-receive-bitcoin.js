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
import fetch from "cross-fetch";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Alert, Share } from "react-native";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import { gql } from "@apollo/client";
import { WalletCurrency, useLnInvoiceCreateMutation, useLnNoAmountInvoiceCreateMutation, useLnUsdInvoiceCreateMutation, useOnChainAddressCurrentMutation, usePaymentRequestQuery, useRealtimePriceQuery, } from "@app/graphql/generated";
import { useIsAuthed } from "@app/graphql/is-authed-context";
import { useLnUpdateHashPaid } from "@app/graphql/ln-update-context";
import { getBtcWallet, getDefaultWallet, getUsdWallet } from "@app/graphql/wallets-utils";
import { useAppConfig, usePriceConversion } from "@app/hooks";
import { useI18nContext } from "@app/i18n/i18n-react";
import { toastShow } from "@app/utils/toast";
import Clipboard from "@react-native-clipboard/clipboard";
import crashlytics from "@react-native-firebase/crashlytics";
import { generateFutureLocalTime, secondsToH, secondsToHMS } from "./payment/helpers";
import { Invoice, PaymentRequestState, } from "./payment/index.types";
import { createPaymentRequest } from "./payment/payment-request";
import { createPaymentRequestCreationData } from "./payment/payment-request-creation-data";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  query paymentRequest {\n    globals {\n      network\n      feesInformation {\n        deposit {\n          minBankFee\n          minBankFeeThreshold\n        }\n      }\n    }\n    me {\n      id\n      username\n      defaultAccount {\n        id\n        wallets {\n          id\n          balance\n          walletCurrency\n        }\n        defaultWalletId\n      }\n    }\n  }\n\n  mutation lnNoAmountInvoiceCreate($input: LnNoAmountInvoiceCreateInput!) {\n    lnNoAmountInvoiceCreate(input: $input) {\n      errors {\n        message\n      }\n      invoice {\n        createdAt\n        paymentHash\n        paymentRequest\n        paymentStatus\n        externalId\n      }\n    }\n  }\n\n  mutation lnInvoiceCreate($input: LnInvoiceCreateInput!) {\n    lnInvoiceCreate(input: $input) {\n      errors {\n        message\n      }\n      invoice {\n        createdAt\n        paymentHash\n        paymentRequest\n        paymentStatus\n        externalId\n        satoshis\n      }\n    }\n  }\n\n  mutation onChainAddressCurrent($input: OnChainAddressCurrentInput!) {\n    onChainAddressCurrent(input: $input) {\n      errors {\n        message\n      }\n      address\n    }\n  }\n\n  mutation lnUsdInvoiceCreate($input: LnUsdInvoiceCreateInput!) {\n    lnUsdInvoiceCreate(input: $input) {\n      errors {\n        message\n      }\n      invoice {\n        createdAt\n        paymentHash\n        paymentRequest\n        paymentStatus\n        externalId\n        satoshis\n      }\n    }\n  }\n"], ["\n  query paymentRequest {\n    globals {\n      network\n      feesInformation {\n        deposit {\n          minBankFee\n          minBankFeeThreshold\n        }\n      }\n    }\n    me {\n      id\n      username\n      defaultAccount {\n        id\n        wallets {\n          id\n          balance\n          walletCurrency\n        }\n        defaultWalletId\n      }\n    }\n  }\n\n  mutation lnNoAmountInvoiceCreate($input: LnNoAmountInvoiceCreateInput!) {\n    lnNoAmountInvoiceCreate(input: $input) {\n      errors {\n        message\n      }\n      invoice {\n        createdAt\n        paymentHash\n        paymentRequest\n        paymentStatus\n        externalId\n      }\n    }\n  }\n\n  mutation lnInvoiceCreate($input: LnInvoiceCreateInput!) {\n    lnInvoiceCreate(input: $input) {\n      errors {\n        message\n      }\n      invoice {\n        createdAt\n        paymentHash\n        paymentRequest\n        paymentStatus\n        externalId\n        satoshis\n      }\n    }\n  }\n\n  mutation onChainAddressCurrent($input: OnChainAddressCurrentInput!) {\n    onChainAddressCurrent(input: $input) {\n      errors {\n        message\n      }\n      address\n    }\n  }\n\n  mutation lnUsdInvoiceCreate($input: LnUsdInvoiceCreateInput!) {\n    lnUsdInvoiceCreate(input: $input) {\n      errors {\n        message\n      }\n      invoice {\n        createdAt\n        paymentHash\n        paymentRequest\n        paymentStatus\n        externalId\n        satoshis\n      }\n    }\n  }\n"])));
export var useReceiveBitcoin = function () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0;
    var lnNoAmountInvoiceCreate = useLnNoAmountInvoiceCreateMutation()[0];
    var lnUsdInvoiceCreate = useLnUsdInvoiceCreateMutation()[0];
    var lnInvoiceCreate = useLnInvoiceCreateMutation()[0];
    var onChainAddressCurrent = useOnChainAddressCurrentMutation()[0];
    var mutations = {
        lnNoAmountInvoiceCreate: lnNoAmountInvoiceCreate,
        lnUsdInvoiceCreate: lnUsdInvoiceCreate,
        lnInvoiceCreate: lnInvoiceCreate,
        onChainAddressCurrent: onChainAddressCurrent,
    };
    var _1 = useState(null), prcd = _1[0], setPRCD = _1[1];
    var _2 = useState(null), pr = _2[0], setPR = _2[1];
    var _3 = useState(null), memoChangeText = _3[0], setMemoChangeText = _3[1];
    var _4 = useState(null), expiresInSeconds = _4[0], setExpiresInSeconds = _4[1];
    var _5 = useState(false), isSetLightningAddressModalVisible = _5[0], setIsSetLightningAddressModalVisible = _5[1];
    var toggleIsSetLightningAddressModalVisible = function () {
        setIsSetLightningAddressModalVisible(!isSetLightningAddressModalVisible);
    };
    var LL = useI18nContext().LL;
    var isAuthed = useIsAuthed();
    var data = usePaymentRequestQuery({
        fetchPolicy: "cache-and-network",
        skip: !isAuthed,
    }).data;
    // forcing price refresh
    useRealtimePriceQuery({
        fetchPolicy: "network-only",
        skip: !isAuthed,
    });
    var defaultWallet = getDefaultWallet((_b = (_a = data === null || data === void 0 ? void 0 : data.me) === null || _a === void 0 ? void 0 : _a.defaultAccount) === null || _b === void 0 ? void 0 : _b.wallets, (_d = (_c = data === null || data === void 0 ? void 0 : data.me) === null || _c === void 0 ? void 0 : _c.defaultAccount) === null || _d === void 0 ? void 0 : _d.defaultWalletId);
    var bitcoinWallet = getBtcWallet((_f = (_e = data === null || data === void 0 ? void 0 : data.me) === null || _e === void 0 ? void 0 : _e.defaultAccount) === null || _f === void 0 ? void 0 : _f.wallets);
    var usdWallet = getUsdWallet((_h = (_g = data === null || data === void 0 ? void 0 : data.me) === null || _g === void 0 ? void 0 : _g.defaultAccount) === null || _h === void 0 ? void 0 : _h.wallets);
    var username = (_j = data === null || data === void 0 ? void 0 : data.me) === null || _j === void 0 ? void 0 : _j.username;
    var appConfig = useAppConfig().appConfig;
    var posUrl = appConfig.galoyInstance.posUrl;
    var lnAddressHostname = appConfig.galoyInstance.lnAddressHostname;
    var _convertMoneyAmount = usePriceConversion().convertMoneyAmount;
    // Initialize Payment Request Creation Data
    useLayoutEffect(function () {
        var _a, _b;
        if (prcd === null &&
            _convertMoneyAmount &&
            defaultWallet &&
            bitcoinWallet &&
            posUrl &&
            ((_a = data === null || data === void 0 ? void 0 : data.globals) === null || _a === void 0 ? void 0 : _a.network)) {
            var defaultWalletDescriptor = {
                currency: defaultWallet.walletCurrency,
                id: defaultWallet.id,
            };
            var bitcoinWalletDescriptor = {
                currency: bitcoinWallet.walletCurrency,
                id: bitcoinWallet.id,
            };
            var initialPRParams = {
                type: Invoice.Lightning,
                defaultWalletDescriptor: defaultWalletDescriptor,
                bitcoinWalletDescriptor: bitcoinWalletDescriptor,
                convertMoneyAmount: _convertMoneyAmount,
                username: username || undefined,
                posUrl: posUrl,
                lnAddressHostname: lnAddressHostname,
                network: (_b = data.globals) === null || _b === void 0 ? void 0 : _b.network,
            };
            setPRCD(createPaymentRequestCreationData(initialPRParams));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [_convertMoneyAmount, defaultWallet, bitcoinWallet, username, lnAddressHostname]);
    // Initialize Payment Request
    useLayoutEffect(function () {
        if (prcd) {
            setPR(createPaymentRequest({
                mutations: mutations,
                creationData: prcd,
            }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        prcd === null || prcd === void 0 ? void 0 : prcd.type,
        prcd === null || prcd === void 0 ? void 0 : prcd.unitOfAccountAmount,
        prcd === null || prcd === void 0 ? void 0 : prcd.expirationTime,
        prcd === null || prcd === void 0 ? void 0 : prcd.memo,
        prcd === null || prcd === void 0 ? void 0 : prcd.receivingWalletDescriptor,
        prcd === null || prcd === void 0 ? void 0 : prcd.username,
        setPR,
    ]);
    // Generate Payment Request
    useLayoutEffect(function () {
        if (pr && pr.state === PaymentRequestState.Idle) {
            setPR(function (pq) { return pq && pq.setState(PaymentRequestState.Loading); });
            pr.generateRequest().then(function (newPR) {
                return setPR(function (currentPR) {
                    // don't override payment request if the request is from different request
                    if ((currentPR === null || currentPR === void 0 ? void 0 : currentPR.creationData) === newPR.creationData)
                        return newPR;
                    return currentPR;
                });
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pr === null || pr === void 0 ? void 0 : pr.state]);
    // Setting it to idle would trigger last useEffect hook to regenerate invoice
    var regenerateInvoice = function () {
        if (expiresInSeconds === 0)
            setPR(function (pq) { return pq && pq.setState(PaymentRequestState.Idle); });
    };
    // If Username updates
    useEffect(function () {
        if (username && username !== null && username !== (prcd === null || prcd === void 0 ? void 0 : prcd.username)) {
            setPRCD(function (prcd) { return prcd && prcd.setUsername(username); });
        }
    }, [username, prcd === null || prcd === void 0 ? void 0 : prcd.username, setPRCD]);
    // For Detecting Paid
    var lastHash = useLnUpdateHashPaid();
    useEffect(function () {
        var _a, _b;
        if ((pr === null || pr === void 0 ? void 0 : pr.state) === PaymentRequestState.Created &&
            ((_b = (_a = pr.info) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.invoiceType) === "Lightning" &&
            lastHash === pr.info.data.paymentHash) {
            setPR(function (pq) { return pq && pq.setState(PaymentRequestState.Paid); });
            ReactNativeHapticFeedback.trigger("notificationSuccess", {
                ignoreAndroidSystemSettings: true,
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lastHash]);
    // For Expires In
    useLayoutEffect(function () {
        var _a, _b, _c, _d;
        if (((_b = (_a = pr === null || pr === void 0 ? void 0 : pr.info) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.invoiceType) === "Lightning" && ((_d = (_c = pr.info) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.expiresAt)) {
            var intervalId_1 = undefined;
            var setExpiresTime = function () {
                var _a, _b, _c, _d;
                var currentTime = new Date();
                var expiresAt = ((_b = (_a = pr === null || pr === void 0 ? void 0 : pr.info) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.invoiceType) === "Lightning" && ((_d = (_c = pr.info) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.expiresAt);
                if (!expiresAt)
                    return;
                var remainingSeconds = Math.floor((expiresAt.getTime() - currentTime.getTime()) / 1000);
                if (remainingSeconds >= 0) {
                    setExpiresInSeconds(remainingSeconds);
                }
                else {
                    clearInterval(intervalId_1);
                    setExpiresInSeconds(0);
                    setPR(function (pq) { return pq && pq.setState(PaymentRequestState.Expired); });
                }
            };
            setExpiresTime();
            intervalId_1 = setInterval(setExpiresTime, 1000);
            return function () {
                clearInterval(intervalId_1);
                setExpiresInSeconds(null);
            };
        }
    }, [(_k = pr === null || pr === void 0 ? void 0 : pr.info) === null || _k === void 0 ? void 0 : _k.data, setExpiresInSeconds]);
    // Clean Memo
    useLayoutEffect(function () {
        if (memoChangeText === "") {
            setPRCD(function (pr) {
                if (pr && pr.setMemo) {
                    return pr.setMemo("");
                }
                return pr;
            });
        }
    }, [memoChangeText, setPRCD]);
    var _6 = useMemo(function () {
        var _a, _b;
        if (!pr) {
            return {};
        }
        var paymentFullUri = (_b = (_a = pr.info) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.getCopyableInvoiceFn();
        var copyToClipboard = function () {
            if (!paymentFullUri)
                return;
            Clipboard.setString(paymentFullUri);
            var msgFn;
            if (pr.creationData.type === Invoice.OnChain)
                msgFn = function (translations) { return translations.ReceiveScreen.copyClipboardBitcoin(); };
            else if (pr.creationData.type === Invoice.PayCode)
                msgFn = function (translations) { return translations.ReceiveScreen.copyClipboardPaycode(); };
            else
                msgFn = function (translations) { return translations.ReceiveScreen.copyClipboard(); };
            toastShow({
                message: msgFn,
                LL: LL,
                type: "success",
            });
        };
        var share = function () { return __awaiter(void 0, void 0, void 0, function () {
            var result, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!paymentFullUri)
                            return [2 /*return*/];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, Share.share({ message: paymentFullUri })];
                    case 2:
                        result = _a.sent();
                        if (result.action === Share.sharedAction) {
                            if (result.activityType) {
                                // shared with activity type of result.activityType
                            }
                            else {
                                // shared
                            }
                        }
                        else if (result.action === Share.dismissedAction) {
                            // dismissed
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        err_1 = _a.sent();
                        if (err_1 instanceof Error) {
                            crashlytics().recordError(err_1);
                            Alert.alert(err_1.message);
                        }
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        }); };
        return {
            copyToClipboard: copyToClipboard,
            share: share,
        };
    }, [pr, LL]), copyToClipboard = _6.copyToClipboard, share = _6.share;
    var receiveViaNFC = useCallback(function (destination) { return __awaiter(void 0, void 0, void 0, function () {
        var _a, callback, k1, urlObject, searchParams, url, result, lnurlResponse;
        var _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    if (((_c = (_b = pr === null || pr === void 0 ? void 0 : pr.info) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.invoiceType) !== "Lightning" || !pr.info.data.paymentRequest) {
                        Alert.alert(LL.RedeemBitcoinScreen.error());
                        return [2 /*return*/];
                    }
                    _a = destination.validDestination, callback = _a.callback, k1 = _a.k1;
                    urlObject = new URL(callback);
                    searchParams = urlObject.searchParams;
                    searchParams.set("k1", k1);
                    searchParams.set("pr", pr.info.data.paymentRequest);
                    url = urlObject.toString();
                    return [4 /*yield*/, fetch(url)];
                case 1:
                    result = _e.sent();
                    if (!result.ok) return [3 /*break*/, 3];
                    return [4 /*yield*/, result.json()];
                case 2:
                    lnurlResponse = _e.sent();
                    if (((_d = lnurlResponse === null || lnurlResponse === void 0 ? void 0 : lnurlResponse.status) === null || _d === void 0 ? void 0 : _d.toLowerCase()) !== "ok") {
                        console.error(lnurlResponse, "error with redeeming");
                        Alert.alert(LL.RedeemBitcoinScreen.redeemingError(), lnurlResponse.reason);
                    }
                    return [3 /*break*/, 4];
                case 3:
                    console.error(result.text(), "error with submitting withdrawalRequest");
                    Alert.alert(LL.RedeemBitcoinScreen.submissionError());
                    _e.label = 4;
                case 4: return [2 /*return*/];
            }
        });
    }); }, [LL.RedeemBitcoinScreen, pr]);
    if (!prcd)
        return null;
    var setType = function (type) {
        setPRCD(function (pr) { return pr && pr.setType(type); });
        setPRCD(function (pr) {
            if (pr && pr.setMemo) {
                return pr.setMemo("");
            }
            return pr;
        });
        setMemoChangeText("");
    };
    var setMemo = function () {
        setPRCD(function (pr) {
            if (pr && memoChangeText && pr.setMemo) {
                return pr.setMemo(memoChangeText);
            }
            return pr;
        });
    };
    var setReceivingWallet = function (walletCurrency) {
        setPRCD(function (pr) {
            if (pr && pr.setReceivingWalletDescriptor) {
                if (walletCurrency === WalletCurrency.Btc && bitcoinWallet) {
                    return pr.setReceivingWalletDescriptor({
                        id: bitcoinWallet.id,
                        currency: WalletCurrency.Btc,
                    });
                }
                else if (walletCurrency === WalletCurrency.Usd && usdWallet) {
                    return pr.setReceivingWalletDescriptor({
                        id: usdWallet.id,
                        currency: WalletCurrency.Usd,
                    });
                }
            }
            return pr;
        });
    };
    var setAmount = function (amount) {
        setPRCD(function (pr) {
            if (pr && pr.setAmount) {
                return pr.setAmount(amount);
            }
            return pr;
        });
    };
    var setExpirationTime = function (expirationTime) {
        setPRCD(function (pr) {
            if (pr && pr.setExpirationTime) {
                return pr.setExpirationTime(expirationTime);
            }
            return pr;
        });
    };
    var extraDetails = "";
    if (prcd.type === "Lightning" &&
        expiresInSeconds !== null &&
        typeof expiresInSeconds === "number" &&
        (pr === null || pr === void 0 ? void 0 : pr.state) !== PaymentRequestState.Paid) {
        if (expiresInSeconds > 60 * 60 * 23)
            extraDetails = "".concat(LL.ReceiveScreen.invoiceValidity.validFor1Day());
        else if (expiresInSeconds > 60 * 60 * 6)
            extraDetails = "".concat(LL.ReceiveScreen.invoiceValidity.validForNext({
                duration: secondsToH(expiresInSeconds),
            }));
        else if (expiresInSeconds > 60 * 2)
            extraDetails = "".concat(LL.ReceiveScreen.invoiceValidity.validBefore({
                time: generateFutureLocalTime(expiresInSeconds),
            }));
        else if (expiresInSeconds > 0)
            extraDetails = "".concat(LL.ReceiveScreen.invoiceValidity.expiresIn({
                duration: secondsToHMS(expiresInSeconds),
            }));
        else if ((pr === null || pr === void 0 ? void 0 : pr.state) === PaymentRequestState.Expired)
            extraDetails = LL.ReceiveScreen.invoiceExpired();
        else
            extraDetails = "".concat(LL.ReceiveScreen.invoiceValidity.expiresNow());
    }
    else if (prcd.type === "Lightning" && (pr === null || pr === void 0 ? void 0 : pr.state) === PaymentRequestState.Paid) {
        extraDetails = LL.ReceiveScreen.invoiceHasBeenPaid();
    }
    else if (prcd.type === "PayCode" && ((_m = (_l = pr === null || pr === void 0 ? void 0 : pr.info) === null || _l === void 0 ? void 0 : _l.data) === null || _m === void 0 ? void 0 : _m.invoiceType) === "PayCode") {
        extraDetails = "LNURL";
    }
    else if (prcd.type === "OnChain" && ((_p = (_o = pr === null || pr === void 0 ? void 0 : pr.info) === null || _o === void 0 ? void 0 : _o.data) === null || _p === void 0 ? void 0 : _p.invoiceType) === "OnChain") {
        extraDetails = LL.ReceiveScreen.btcOnChainAddress();
    }
    var readablePaymentRequest = "";
    if (((_r = (_q = pr === null || pr === void 0 ? void 0 : pr.info) === null || _q === void 0 ? void 0 : _q.data) === null || _r === void 0 ? void 0 : _r.invoiceType) === Invoice.Lightning) {
        var uri = (_t = (_s = pr.info) === null || _s === void 0 ? void 0 : _s.data) === null || _t === void 0 ? void 0 : _t.getFullUriFn({});
        readablePaymentRequest = "".concat(uri.slice(0, 10), "..").concat(uri.slice(-10));
    }
    else if (((_v = (_u = pr === null || pr === void 0 ? void 0 : pr.info) === null || _u === void 0 ? void 0 : _u.data) === null || _v === void 0 ? void 0 : _v.invoiceType) === Invoice.OnChain) {
        var address = ((_x = (_w = pr.info) === null || _w === void 0 ? void 0 : _w.data) === null || _x === void 0 ? void 0 : _x.address) || "";
        readablePaymentRequest = "".concat(address);
    }
    else if (prcd.type === "PayCode" && ((_z = (_y = pr === null || pr === void 0 ? void 0 : pr.info) === null || _y === void 0 ? void 0 : _y.data) === null || _z === void 0 ? void 0 : _z.invoiceType) === "PayCode") {
        readablePaymentRequest = "".concat(pr.info.data.username, "@").concat(lnAddressHostname);
    }
    return __assign(__assign(__assign(__assign({}, prcd), { setType: setType }), pr), { extraDetails: extraDetails, regenerateInvoice: regenerateInvoice, setMemo: setMemo, setReceivingWallet: setReceivingWallet, setAmount: setAmount, setExpirationTime: setExpirationTime, feesInformation: (_0 = data === null || data === void 0 ? void 0 : data.globals) === null || _0 === void 0 ? void 0 : _0.feesInformation, memoChangeText: memoChangeText, setMemoChangeText: setMemoChangeText, copyToClipboard: copyToClipboard, share: share, isSetLightningAddressModalVisible: isSetLightningAddressModalVisible, toggleIsSetLightningAddressModalVisible: toggleIsSetLightningAddressModalVisible, readablePaymentRequest: readablePaymentRequest, receiveViaNFC: receiveViaNFC });
};
var templateObject_1;
//# sourceMappingURL=use-receive-bitcoin.js.map