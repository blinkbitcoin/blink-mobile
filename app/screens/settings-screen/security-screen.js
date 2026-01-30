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
import * as React from "react";
import { useState } from "react";
import { View } from "react-native";
import { useApolloClient } from "@apollo/client";
import { useHideBalanceQuery } from "@app/graphql/generated";
import { useI18nContext } from "@app/i18n/i18n-react";
import { useFocusEffect } from "@react-navigation/native";
import { makeStyles, ListItem } from "@rn-vui/themed";
import { Screen } from "../../components/screen";
import { saveHiddenBalanceToolTip, saveHideBalance, } from "../../graphql/client-only-query";
import BiometricWrapper from "../../utils/biometricAuthentication";
import { PinScreenPurpose } from "../../utils/enum";
import KeyStoreWrapper from "../../utils/storage/secureStorage";
import { toastShow } from "../../utils/toast";
import { Switch } from "@app/components/atomic/switch";
export var SecurityScreen = function (_a) {
    var route = _a.route, navigation = _a.navigation;
    var styles = useStyles();
    var client = useApolloClient();
    var _b = route.params, mIsBiometricsEnabled = _b.mIsBiometricsEnabled, mIsPinEnabled = _b.mIsPinEnabled;
    var _c = useHideBalanceQuery().data, _d = _c === void 0 ? { hideBalance: false } : _c, hideBalance = _d.hideBalance;
    var LL = useI18nContext().LL;
    var _e = useState(mIsBiometricsEnabled), isBiometricsEnabled = _e[0], setIsBiometricsEnabled = _e[1];
    var _f = useState(mIsPinEnabled), isPinEnabled = _f[0], setIsPinEnabled = _f[1];
    var _g = useState(hideBalance), isHideBalanceEnabled = _g[0], setIsHideBalanceEnabled = _g[1];
    useFocusEffect(function () {
        getIsBiometricsEnabled();
        getIsPinEnabled();
    });
    var getIsBiometricsEnabled = function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setIsBiometricsEnabled;
                    return [4 /*yield*/, KeyStoreWrapper.getIsBiometricsEnabled()];
                case 1:
                    _a.apply(void 0, [_b.sent()]);
                    return [2 /*return*/];
            }
        });
    }); };
    var getIsPinEnabled = function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setIsPinEnabled;
                    return [4 /*yield*/, KeyStoreWrapper.getIsPinEnabled()];
                case 1:
                    _a.apply(void 0, [_b.sent()]);
                    return [2 /*return*/];
            }
        });
    }); };
    var onBiometricsValueChanged = function (value) { return __awaiter(void 0, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!value) return [3 /*break*/, 5];
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, BiometricWrapper.isSensorAvailable()];
                case 2:
                    if (_b.sent()) {
                        // Presents the OS specific authentication prompt
                        BiometricWrapper.authenticate(LL.AuthenticationScreen.setUpAuthenticationDescription(), handleAuthenticationSuccess, handleAuthenticationFailure);
                    }
                    else {
                        toastShow({
                            message: function (translations) { return translations.SecurityScreen.biometryNotAvailable(); },
                            LL: LL,
                        });
                    }
                    return [3 /*break*/, 4];
                case 3:
                    _a = _b.sent();
                    toastShow({
                        message: function (translations) { return translations.SecurityScreen.biometryNotEnrolled(); },
                        LL: LL,
                    });
                    return [3 /*break*/, 4];
                case 4: return [3 /*break*/, 7];
                case 5: return [4 /*yield*/, KeyStoreWrapper.removeIsBiometricsEnabled()];
                case 6:
                    if (_b.sent()) {
                        setIsBiometricsEnabled(false);
                    }
                    _b.label = 7;
                case 7: return [2 /*return*/];
            }
        });
    }); };
    var handleAuthenticationSuccess = function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, KeyStoreWrapper.setIsBiometricsEnabled()];
                case 1:
                    if (_a.sent()) {
                        setIsBiometricsEnabled(true);
                    }
                    return [2 /*return*/];
            }
        });
    }); };
    var handleAuthenticationFailure = function () {
        // This is called when a user cancels or taps out of the authentication prompt,
        // so no action is necessary.
    };
    var onPinValueChanged = function (value) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (value) {
                navigation.navigate("pin", { screenPurpose: PinScreenPurpose.SetPin });
            }
            else {
                removePin();
            }
            return [2 /*return*/];
        });
    }); };
    var onHideBalanceValueChanged = function (value) {
        if (value) {
            setIsHideBalanceEnabled(saveHideBalance(client, true));
            saveHiddenBalanceToolTip(client, true);
        }
        else {
            setIsHideBalanceEnabled(saveHideBalance(client, false));
            saveHiddenBalanceToolTip(client, false);
        }
    };
    var removePin = function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, KeyStoreWrapper.removePin()];
                case 1:
                    if (_a.sent()) {
                        KeyStoreWrapper.removePinAttempts();
                        setIsPinEnabled(false);
                    }
                    return [2 /*return*/];
            }
        });
    }); };
    return (<Screen style={styles.container} preset="scroll">
      <View style={styles.settingContainer}>
        <ListItem containerStyle={styles.listItemContainer}>
          <ListItem.Content>
            <ListItem.Title>{LL.SecurityScreen.biometricTitle()}</ListItem.Title>
            <ListItem.Subtitle style={styles.textContainer}>
              {LL.SecurityScreen.biometricDescription()}
            </ListItem.Subtitle>
          </ListItem.Content>
          <Switch value={isBiometricsEnabled} onValueChange={onBiometricsValueChanged}/>
        </ListItem>
      </View>

      <View style={styles.settingContainer}>
        <ListItem containerStyle={styles.listItemContainer}>
          <ListItem.Content>
            <ListItem.Title>{LL.SecurityScreen.pinTitle()}</ListItem.Title>
            <ListItem.Subtitle style={styles.textContainer}>
              {LL.SecurityScreen.pinDescription()}
            </ListItem.Subtitle>
          </ListItem.Content>
          <Switch value={isPinEnabled} onValueChange={onPinValueChanged}/>
        </ListItem>
      </View>

      <View style={styles.settingContainer}>
        <ListItem containerStyle={styles.listItemContainer}>
          <ListItem.Content>
            <ListItem.Title>{LL.SecurityScreen.hideBalanceTitle()}</ListItem.Title>
          </ListItem.Content>
          <Switch value={isHideBalanceEnabled} onValueChange={onHideBalanceValueChanged}/>
        </ListItem>
      </View>
    </Screen>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        container: {
            margin: 24,
            display: "flex",
            flexDirection: "column",
            rowGap: 20,
        },
        settingContainer: {
            backgroundColor: colors.grey5,
            borderRadius: 12,
        },
        textContainer: {
            color: colors.grey3,
        },
        listItemContainer: {
            backgroundColor: colors.transparent,
        },
    });
});
//# sourceMappingURL=security-screen.js.map