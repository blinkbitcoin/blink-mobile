var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
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
import React from "react";
import { View, TouchableOpacity, ActivityIndicator } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import Modal from "react-native-modal";
import { gql, useApolloClient } from "@apollo/client";
import { setHasPromptedSetDefaultAccount } from "@app/graphql/client-only-query";
import { WalletCurrency, useAccountUpdateDefaultWalletIdMutation, useSetDefaultAccountModalQuery, } from "@app/graphql/generated";
import { getBtcWallet, getUsdWallet } from "@app/graphql/wallets-utils";
import { useI18nContext } from "@app/i18n/i18n-react";
import crashlytics from "@react-native-firebase/crashlytics";
import { makeStyles, Text, useTheme } from "@rn-vui/themed";
import { CurrencyPill, useEqualPillWidth } from "../atomic/currency-pill";
import { GaloyIconButton } from "../atomic/galoy-icon-button";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  query setDefaultAccountModal {\n    me {\n      id\n      defaultAccount {\n        id\n        defaultWalletId\n        wallets {\n          id\n          balance\n          walletCurrency\n        }\n      }\n    }\n  }\n"], ["\n  query setDefaultAccountModal {\n    me {\n      id\n      defaultAccount {\n        id\n        defaultWalletId\n        wallets {\n          id\n          balance\n          walletCurrency\n        }\n      }\n    }\n  }\n"])));
export var SetDefaultAccountModal = function (_a) {
    var _b, _c, _d, _e;
    var isVisible = _a.isVisible, toggleModal = _a.toggleModal;
    var _f = React.useState(false), btcLoading = _f[0], setBtcLoading = _f[1];
    var _g = React.useState(false), usdLoading = _g[0], setUsdLoading = _g[1];
    var accountUpdateDefaultWallet = useAccountUpdateDefaultWalletIdMutation()[0];
    var data = useSetDefaultAccountModalQuery({
        fetchPolicy: "cache-only",
    }).data;
    var client = useApolloClient();
    var usdWallet = getUsdWallet((_c = (_b = data === null || data === void 0 ? void 0 : data.me) === null || _b === void 0 ? void 0 : _b.defaultAccount) === null || _c === void 0 ? void 0 : _c.wallets);
    var btcWallet = getBtcWallet((_e = (_d = data === null || data === void 0 ? void 0 : data.me) === null || _d === void 0 ? void 0 : _d.defaultAccount) === null || _e === void 0 ? void 0 : _e.wallets);
    var onPressUsdAccount = function () { return __awaiter(void 0, void 0, void 0, function () {
        var err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setUsdLoading(true);
                    if (!usdWallet) return [3 /*break*/, 4];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, accountUpdateDefaultWallet({
                            variables: {
                                input: {
                                    walletId: usdWallet.id,
                                },
                            },
                        })];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    err_1 = _a.sent();
                    if (err_1 instanceof Error) {
                        crashlytics().recordError(err_1);
                    }
                    return [3 /*break*/, 4];
                case 4:
                    setUsdLoading(false);
                    setHasPromptedSetDefaultAccount(client);
                    toggleModal();
                    return [2 /*return*/];
            }
        });
    }); };
    var onPressBtcAccount = function () { return __awaiter(void 0, void 0, void 0, function () {
        var err_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setBtcLoading(true);
                    if (!btcWallet) return [3 /*break*/, 4];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, accountUpdateDefaultWallet({
                            variables: {
                                input: {
                                    walletId: btcWallet.id,
                                },
                            },
                        })];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    err_2 = _a.sent();
                    if (err_2 instanceof Error) {
                        crashlytics().recordError(err_2);
                    }
                    return [3 /*break*/, 4];
                case 4:
                    setBtcLoading(false);
                    setHasPromptedSetDefaultAccount(client);
                    toggleModal();
                    return [2 /*return*/];
            }
        });
    }); };
    return (<SetDefaultAccountModalUI loadingUsdAccount={usdLoading} loadingBtcAccount={btcLoading} isVisible={isVisible} toggleModal={toggleModal} onPressBtcAccount={onPressBtcAccount} onPressUsdAccount={onPressUsdAccount}/>);
};
export var SetDefaultAccountModalUI = function (_a) {
    var isVisible = _a.isVisible, toggleModal = _a.toggleModal, onPressUsdAccount = _a.onPressUsdAccount, onPressBtcAccount = _a.onPressBtcAccount, loadingBtcAccount = _a.loadingBtcAccount, loadingUsdAccount = _a.loadingUsdAccount;
    var styles = useStyles();
    var _b = useTheme().theme, mode = _b.mode, colors = _b.colors;
    var LL = useI18nContext().LL;
    var _c = useEqualPillWidth(), pillWidthStyle = _c.widthStyle, onPillLayout = _c.onPillLayout;
    return (<Modal isVisible={isVisible} backdropOpacity={0.8} backdropColor={colors.white} backdropTransitionOutTiming={0} avoidKeyboard={true} onBackdropPress={toggleModal} onBackButtonPress={toggleModal}>
      <View style={styles.container}>
        <GaloyIconButton style={styles.closeIcon} name="close" size="medium" color={colors.grey0} onPress={toggleModal}/>
        <ScrollView style={styles.modalCard} persistentScrollbar={true} indicatorStyle={mode === "dark" ? "white" : "black"} bounces={false} contentContainerStyle={styles.scrollViewContainer}>
          <View style={styles.modalTitleContainer}>
            <Text style={styles.modalTitleText}>{LL.SetAccountModal.title()}</Text>
          </View>
          <View style={styles.modalBodyContainer}>
            <Text type={"p1"} style={styles.modalBodyText}>
              {LL.SetAccountModal.description()}
            </Text>
          </View>
        </ScrollView>
        <View style={styles.modalActionsContainer}>
          <TouchableOpacity onPress={onPressBtcAccount}>
            <View style={styles.currencyButtonContainer}>
              {loadingBtcAccount ? (<ActivityIndicator size="small" color={colors.primary}/>) : (<>
                  <CurrencyPill currency={WalletCurrency.Btc} containerSize="medium" containerStyle={pillWidthStyle} onLayout={onPillLayout(WalletCurrency.Btc)}/>
                  <View style={styles.currencyButtonTextContainer}>
                    <Text type="p2" style={styles.currencyButtonText}>
                      {LL.SetAccountModal.bitcoinTag()}
                    </Text>
                  </View>
                </>)}
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={onPressUsdAccount}>
            <View style={styles.currencyButtonContainer}>
              {loadingUsdAccount ? (<ActivityIndicator size="small" color={colors.primary}/>) : (<>
                  <CurrencyPill currency={WalletCurrency.Usd} containerSize="medium" containerStyle={pillWidthStyle} onLayout={onPillLayout(WalletCurrency.Usd)}/>
                  <View style={styles.currencyButtonTextContainer}>
                    <Text type="p2" style={styles.currencyButtonText}>
                      {LL.SetAccountModal.stablesatsTag()}
                    </Text>
                  </View>
                </>)}
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        currencyButtonContainer: {
            flexDirection: "row",
            alignItems: "center",
            padding: 12,
            backgroundColor: colors.grey4,
            minHeight: 90,
            borderRadius: 12,
            columnGap: 12,
            justifyContent: "center",
        },
        currencyButtonTextContainer: {
            flex: 1,
            flexDirection: "column",
        },
        currencyButtonText: {
            color: colors.black,
            fontWeight: "400",
            lineHeight: 22,
        },
        container: {
            backgroundColor: colors.grey5,
            maxHeight: "80%",
            minHeight: "auto",
            borderRadius: 16,
            padding: 20,
        },
        modalCard: {
            width: "100%",
        },
        modalTitleContainer: {
            justifyContent: "center",
            alignItems: "center",
            marginBottom: 10,
        },
        modalTitleText: {
            fontSize: 24,
            fontWeight: "700",
            lineHeight: 32,
            maxWidth: "80%",
            textAlign: "center",
            color: colors.black,
            marginBottom: 10,
        },
        modalBodyContainer: {
            flex: 1,
            flexGrow: 1,
        },
        scrollViewContainer: { flexGrow: 1 },
        modalBodyText: {
            textAlign: "center",
            color: colors.black,
        },
        modalActionsContainer: {
            width: "100%",
            height: "auto",
            flexDirection: "column",
            rowGap: 12,
            marginTop: 20,
        },
        closeIcon: {
            width: "100%",
            justifyContent: "flex-end",
            alignItems: "flex-end",
        },
    });
});
var templateObject_1;
//# sourceMappingURL=set-default-account-modal.js.map