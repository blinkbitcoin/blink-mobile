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
import { useState } from "react";
import { Alert, TextInput, View } from "react-native";
import Modal from "react-native-modal";
import { gql } from "@apollo/client";
import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button";
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button";
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button";
import { CONTACT_EMAIL_ADDRESS } from "@app/config";
import { useAccountDeleteMutation, useSettingsScreenQuery } from "@app/graphql/generated";
import { getBtcWallet, getUsdWallet } from "@app/graphql/wallets-utils";
import { useDisplayCurrency } from "@app/hooks/use-display-currency";
import { useAppConfig } from "@app/hooks";
import useLogout from "@app/hooks/use-logout";
import { useI18nContext } from "@app/i18n/i18n-react";
import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts";
import { useNavigation } from "@react-navigation/native";
import { useTheme, Text, makeStyles } from "@rn-vui/themed";
import { useSwitchToNextProfile } from "@app/hooks/use-switch-to-next-profile";
import { SettingsButton } from "../../button";
import { useAccountDeleteContext } from "../account-delete-context";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  mutation accountDelete {\n    accountDelete {\n      errors {\n        message\n      }\n      success\n    }\n  }\n"], ["\n  mutation accountDelete {\n    accountDelete {\n      errors {\n        message\n      }\n      success\n    }\n  }\n"])));
export var Delete = function () {
    var _a, _b, _c, _d;
    var styles = useStyles();
    var navigation = useNavigation();
    var logout = useLogout().logout;
    var appConfig = useAppConfig().appConfig;
    var switchToNextProfile = useSwitchToNextProfile().switchToNextProfile;
    var LL = useI18nContext().LL;
    var _e = useState(""), text = _e[0], setText = _e[1];
    var _f = useState(false), modalVisible = _f[0], setModalVisible = _f[1];
    var closeModal = function () {
        setModalVisible(false);
        setText("");
    };
    var colors = useTheme().theme.colors;
    var setAccountIsBeingDeleted = useAccountDeleteContext().setAccountIsBeingDeleted;
    var deleteAccount = useAccountDeleteMutation({ fetchPolicy: "no-cache" })[0];
    var _g = useSettingsScreenQuery(), data = _g.data, loading = _g.loading;
    var formatMoneyAmount = useDisplayCurrency().formatMoneyAmount;
    var btcWallet = getBtcWallet((_b = (_a = data === null || data === void 0 ? void 0 : data.me) === null || _a === void 0 ? void 0 : _a.defaultAccount) === null || _b === void 0 ? void 0 : _b.wallets);
    var usdWallet = getUsdWallet((_d = (_c = data === null || data === void 0 ? void 0 : data.me) === null || _c === void 0 ? void 0 : _c.defaultAccount) === null || _d === void 0 ? void 0 : _d.wallets);
    var usdWalletBalance = toUsdMoneyAmount(usdWallet === null || usdWallet === void 0 ? void 0 : usdWallet.balance);
    var btcWalletBalance = toBtcMoneyAmount(btcWallet === null || btcWallet === void 0 ? void 0 : btcWallet.balance);
    var usdBalanceWarning = "";
    var btcBalanceWarning = "";
    var balancePositive = false;
    if (usdWalletBalance.amount > 0) {
        var balance = formatMoneyAmount && formatMoneyAmount({ moneyAmount: usdWalletBalance });
        usdBalanceWarning = LL.AccountScreen.usdBalanceWarning({ balance: balance });
        balancePositive = true;
    }
    if (btcWalletBalance.amount > 0) {
        var balance = formatMoneyAmount && formatMoneyAmount({ moneyAmount: btcWalletBalance });
        btcBalanceWarning = LL.AccountScreen.btcBalanceWarning({ balance: balance });
        balancePositive = true;
    }
    var fullMessage = (usdBalanceWarning +
        "\n" +
        btcBalanceWarning +
        "\n" +
        LL.support.deleteAccountBalanceWarning()).trim();
    var deleteAccountAction = function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (balancePositive) {
                Alert.alert(LL.common.warning(), fullMessage, [
                    { text: LL.common.cancel(), onPress: function () { } },
                    {
                        text: LL.common.yes(),
                        onPress: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, setModalVisible(true)];
                        }); }); },
                    },
                ]);
            }
            else {
                setModalVisible(true);
            }
            return [2 /*return*/];
        });
    }); };
    var deleteUserAccount = function () { return __awaiter(void 0, void 0, void 0, function () {
        var accountToDeleteToken, res, nextProfile_1, err_1;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _e.trys.push([0, 7, , 8]);
                    accountToDeleteToken = appConfig.token;
                    navigation.setOptions({
                        headerLeft: function () { return null; }, // Hides the default back button
                        gestureEnabled: false, // Disables swipe to go back gesture
                    });
                    setAccountIsBeingDeleted(true);
                    return [4 /*yield*/, deleteAccount()];
                case 1:
                    res = _e.sent();
                    if (!((_b = (_a = res.data) === null || _a === void 0 ? void 0 : _a.accountDelete) === null || _b === void 0 ? void 0 : _b.success)) return [3 /*break*/, 5];
                    setAccountIsBeingDeleted(false);
                    return [4 /*yield*/, switchToNextProfile(accountToDeleteToken)];
                case 2:
                    nextProfile_1 = _e.sent();
                    if (!!nextProfile_1) return [3 /*break*/, 4];
                    return [4 /*yield*/, logout({ stateToDefault: true })];
                case 3:
                    _e.sent();
                    _e.label = 4;
                case 4:
                    Alert.alert(LL.support.bye(), LL.support.deleteAccountConfirmation(), [
                        {
                            text: LL.common.ok(),
                            onPress: function () {
                                if (!nextProfile_1) {
                                    navigation.reset({
                                        index: 0,
                                        routes: [{ name: "getStarted" }],
                                    });
                                }
                            },
                        },
                    ]);
                    return [3 /*break*/, 6];
                case 5:
                    Alert.alert(LL.common.error(), LL.support.deleteAccountError({ email: CONTACT_EMAIL_ADDRESS }) +
                        "\n\n" +
                        ((_d = (_c = res.data) === null || _c === void 0 ? void 0 : _c.accountDelete) === null || _d === void 0 ? void 0 : _d.errors[0].message));
                    _e.label = 6;
                case 6: return [3 /*break*/, 8];
                case 7:
                    err_1 = _e.sent();
                    console.error(err_1);
                    Alert.alert(LL.common.error(), LL.support.deleteAccountError({ email: CONTACT_EMAIL_ADDRESS }));
                    return [3 /*break*/, 8];
                case 8: return [2 /*return*/];
            }
        });
    }); };
    var userWroteDelete = text.toLowerCase().trim() === LL.support.delete().toLocaleLowerCase().trim();
    var AccountDeletionModal = (<Modal isVisible={modalVisible} onBackdropPress={closeModal} backdropOpacity={0.8} backdropColor={colors.white} avoidKeyboard={true}>
      <View style={styles.view}>
        <View style={styles.actionButtons}>
          <Text type="h1" bold>
            {LL.support.deleteAccount()}
          </Text>
          <GaloyIconButton name="close" onPress={closeModal} size={"medium"}/>
        </View>
        <Text type="p1">{LL.support.typeDelete({ delete: LL.support.delete() })}</Text>
        <TextInput autoCapitalize="none" style={styles.textInput} onChangeText={setText} value={text} placeholder={LL.support.delete()} placeholderTextColor={colors.grey3}/>
        <View style={styles.actionButtons}>
          <GaloyPrimaryButton title="Confirm" disabled={!userWroteDelete} onPress={function () {
            closeModal();
            Alert.alert(LL.support.finalConfirmationAccountDeletionTitle(), LL.support.finalConfirmationAccountDeletionMessage(), [
                { text: LL.common.cancel(), onPress: function () { } },
                { text: LL.common.ok(), onPress: function () { return deleteUserAccount(); } },
            ]);
        }}/>
          <GaloySecondaryButton title="Cancel" onPress={closeModal}/>
        </View>
      </View>
    </Modal>);
    return (<>
      <SettingsButton loading={loading} title={LL.support.deleteAccount()} variant="critical" onPress={deleteAccountAction}/>
      <Text type="p2" bold style={styles.warningText}>
        {LL.support.deleteAccountWarning()}
      </Text>
      {AccountDeletionModal}
    </>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        view: {
            marginHorizontal: 20,
            backgroundColor: colors.grey5,
            padding: 20,
            borderRadius: 20,
            display: "flex",
            flexDirection: "column",
            rowGap: 20,
        },
        textInput: {
            fontSize: 16,
            backgroundColor: colors.grey4,
            padding: 12,
            color: colors.black,
            borderRadius: 8,
        },
        actionButtons: {
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
        },
        warningText: {
            color: colors.primary,
        },
    });
});
var templateObject_1;
//# sourceMappingURL=delete.js.map