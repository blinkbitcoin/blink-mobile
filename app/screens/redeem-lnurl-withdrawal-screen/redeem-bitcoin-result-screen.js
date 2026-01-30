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
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useApolloClient } from "@apollo/client";
import { GaloyIcon } from "@app/components/atomic/galoy-icon";
import { Screen } from "@app/components/screen";
import { HomeAuthedDocument, useLnInvoiceCreateMutation, WalletCurrency, } from "@app/graphql/generated";
import { useLnUpdateHashPaid } from "@app/graphql/ln-update-context";
import { useDisplayCurrency } from "@app/hooks/use-display-currency";
import { useI18nContext } from "@app/i18n/i18n-react";
import { useNavigation } from "@react-navigation/native";
import { makeStyles, Text, useTheme } from "@rn-vui/themed";
import { testProps } from "../../utils/testProps";
import { withMyLnUpdateSub } from "../receive-bitcoin-screen/my-ln-updates-sub";
var RedeemBitcoinResultScreen = function (_a) {
    var route = _a.route;
    var navigation = useNavigation();
    var _b = route.params, callback = _b.callback, domain = _b.domain, defaultDescription = _b.defaultDescription, k1 = _b.k1, receivingWalletDescriptor = _b.receivingWalletDescriptor, unitOfAccountAmount = _b.unitOfAccountAmount, settlementAmount = _b.settlementAmount, displayAmount = _b.displayAmount;
    var styles = useStyles();
    var colors = useTheme().theme.colors;
    var formatDisplayAndWalletAmount = useDisplayCurrency().formatDisplayAndWalletAmount;
    var client = useApolloClient();
    var LL = useI18nContext().LL;
    var lastHash = useLnUpdateHashPaid();
    useEffect(function () {
        // TODO: when USD is accepted:
        // if (receivingWalletDescriptor.currency === WalletCurrency.Usd) {
        //   navigation.setOptions({ title: LL.RedeemBitcoinScreen.usdTitle() })
        // }
        if (receivingWalletDescriptor.currency === WalletCurrency.Btc) {
            navigation.setOptions({ title: LL.RedeemBitcoinScreen.title() });
        }
    }, [receivingWalletDescriptor.currency, navigation, LL]);
    var _c = useState(""), err = _c[0], setErr = _c[1];
    var _d = useState(""), lnServiceErrorReason = _d[0], setLnServiceErrorReason = _d[1];
    var _e = useState(null), withdrawalInvoice = _e[0], setInvoice = _e[1];
    var memo = useState(defaultDescription)[0];
    // FIXME: this would be false again if multiple invoice happen to be paid
    // when the user stays on this screen
    var invoicePaid = (withdrawalInvoice === null || withdrawalInvoice === void 0 ? void 0 : withdrawalInvoice.paymentHash) === lastHash;
    var lnInvoiceCreate = useLnInvoiceCreateMutation()[0];
    var createWithdrawRequestInvoice = useCallback(function (satAmount, memo) { return __awaiter(void 0, void 0, void 0, function () {
        var data, _a, invoice, errors, err_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    setInvoice(null);
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, lnInvoiceCreate({
                            variables: {
                                input: { walletId: receivingWalletDescriptor.id, amount: satAmount, memo: memo },
                            },
                        })];
                case 2:
                    data = (_b.sent()).data;
                    if (!data) {
                        throw new Error("No data returned from lnInvoiceCreate");
                    }
                    _a = data.lnInvoiceCreate, invoice = _a.invoice, errors = _a.errors;
                    if (errors && errors.length !== 0) {
                        console.error(errors, "error with lnInvoiceCreate");
                        setErr(LL.RedeemBitcoinScreen.error());
                        return [2 /*return*/];
                    }
                    invoice && setInvoice(invoice);
                    return [3 /*break*/, 4];
                case 3:
                    err_1 = _b.sent();
                    console.error(err_1, "error with AddInvoice");
                    setErr("".concat(err_1));
                    throw err_1;
                case 4: return [2 /*return*/];
            }
        });
    }); }, [lnInvoiceCreate, receivingWalletDescriptor, LL]);
    var submitLNURLWithdrawRequest = useCallback(function (generatedInvoice) { return __awaiter(void 0, void 0, void 0, function () {
        var urlObject, searchParams, url, result, lnurlResponse;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    urlObject = new URL(callback);
                    searchParams = urlObject.searchParams;
                    searchParams.set("k1", k1);
                    searchParams.set("pr", generatedInvoice.paymentRequest);
                    url = urlObject.toString();
                    return [4 /*yield*/, fetch(url)];
                case 1:
                    result = _b.sent();
                    if (!result.ok) return [3 /*break*/, 3];
                    return [4 /*yield*/, result.json()];
                case 2:
                    lnurlResponse = _b.sent();
                    if (((_a = lnurlResponse === null || lnurlResponse === void 0 ? void 0 : lnurlResponse.status) === null || _a === void 0 ? void 0 : _a.toLowerCase()) !== "ok") {
                        console.error(lnurlResponse, "error with redeeming");
                        setErr(LL.RedeemBitcoinScreen.redeemingError());
                        if (lnurlResponse === null || lnurlResponse === void 0 ? void 0 : lnurlResponse.reason) {
                            setLnServiceErrorReason(lnurlResponse.reason);
                        }
                    }
                    return [3 /*break*/, 4];
                case 3:
                    console.error(result.text(), "error with submitting withdrawalRequest");
                    setErr(LL.RedeemBitcoinScreen.submissionError());
                    _b.label = 4;
                case 4: return [2 /*return*/];
            }
        });
    }); }, [callback, LL, k1]);
    useEffect(function () {
        if (withdrawalInvoice) {
            submitLNURLWithdrawRequest(withdrawalInvoice);
        }
        else {
            createWithdrawRequestInvoice(settlementAmount.amount, memo);
        }
    }, [
        withdrawalInvoice,
        memo,
        settlementAmount,
        createWithdrawRequestInvoice,
        submitLNURLWithdrawRequest,
    ]);
    var renderSuccessView = useMemo(function () {
        if (invoicePaid) {
            client.refetchQueries({ include: [HomeAuthedDocument] });
            return (<View style={styles.container}>
          <View {...testProps("Success Icon")} style={styles.container}>
            <GaloyIcon name={"payment-success"} size={128}/>
          </View>
        </View>);
        }
        return null;
    }, [invoicePaid, styles, client]);
    var renderErrorView = useMemo(function () {
        if (err !== "") {
            return (<View style={styles.container}>
          {lnServiceErrorReason && (<Text style={styles.errorText} selectable>
              {lnServiceErrorReason}
            </Text>)}
          <Text style={styles.errorText} selectable>
            {err}
          </Text>
        </View>);
        }
        return null;
    }, [err, lnServiceErrorReason, styles]);
    var renderActivityStatusView = useMemo(function () {
        if (err === "" && !invoicePaid) {
            return (<View style={styles.container}>
          <ActivityIndicator size="large" color={colors.primary}/>
        </View>);
        }
        return null;
    }, [err, invoicePaid, styles, colors.primary]);
    return (<Screen preset="scroll" style={styles.contentContainer}>
      <View style={[styles.inputForm, styles.container]}>
        {defaultDescription && (<Text type={"p1"} style={styles.withdrawableDescriptionText}>
            {defaultDescription}
          </Text>)}
        <View style={styles.currencyInputContainer}>
          <Text>
            {LL.RedeemBitcoinScreen.redeemAmountFrom({
            amountToRedeem: formatDisplayAndWalletAmount({
                primaryAmount: unitOfAccountAmount,
                walletAmount: settlementAmount,
                displayAmount: displayAmount,
            }),
            domain: domain,
        })}
          </Text>
        </View>

        <View style={styles.qr}>
          {renderSuccessView}
          {renderErrorView}
          {renderActivityStatusView}
        </View>
      </View>
    </Screen>);
};
export default withMyLnUpdateSub(RedeemBitcoinResultScreen);
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        container: {
            justifyContent: "center",
            alignItems: "center",
            marginTop: 14,
            marginLeft: 20,
            marginRight: 20,
        },
        inputForm: {
            marginVertical: 20,
        },
        currencyInputContainer: {
            padding: 10,
            marginTop: 10,
            backgroundColor: colors.grey5,
            borderRadius: 10,
        },
        withdrawableDescriptionText: {
            textAlign: "center",
        },
        qr: {
            alignItems: "center",
        },
        errorText: {
            color: colors.error,
            textAlign: "center",
        },
        contentContainer: {
            padding: 20,
            flexGrow: 1,
        },
    });
});
//# sourceMappingURL=redeem-bitcoin-result-screen.js.map