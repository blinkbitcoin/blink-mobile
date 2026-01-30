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
import { useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { useI18nContext } from "@app/i18n/i18n-react";
import { useAuthenticationContext } from "@app/navigation/navigation-container-wrapper";
import { useNavigation } from "@react-navigation/native";
import { Button } from "@rn-vui/base";
import { makeStyles } from "@rn-vui/themed";
import { Screen } from "../../components/screen";
import useLogout from "../../hooks/use-logout";
import { PinScreenPurpose } from "../../utils/enum";
import { sleep } from "../../utils/sleep";
import KeyStoreWrapper from "../../utils/storage/secureStorage";
export var PinScreen = function (_a) {
    var route = _a.route;
    var styles = useStyles();
    var navigation = useNavigation();
    var logout = useLogout().logout;
    var screenPurpose = route.params.screenPurpose;
    var setAppUnlocked = useAuthenticationContext().setAppUnlocked;
    var LL = useI18nContext().LL;
    var _b = useState(""), enteredPIN = _b[0], setEnteredPIN = _b[1];
    var _c = useState(screenPurpose === PinScreenPurpose.SetPin ? LL.PinScreen.setPin() : ""), helperText = _c[0], setHelperText = _c[1];
    var _d = useState(""), previousPIN = _d[0], setPreviousPIN = _d[1];
    var _e = useState(0), pinAttempts = _e[0], setPinAttempts = _e[1];
    var MAX_PIN_ATTEMPTS = 3;
    useEffect(function () {
        ;
        (function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setPinAttempts;
                        return [4 /*yield*/, KeyStoreWrapper.getPinAttemptsOrZero()];
                    case 1:
                        _a.apply(void 0, [_b.sent()]);
                        return [2 /*return*/];
                }
            });
        }); })();
    }, []);
    var handleCompletedPinForAuthenticatePin = function (newEnteredPIN) { return __awaiter(void 0, void 0, void 0, function () {
        var _a, newPinAttempts, attemptsRemaining;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = newEnteredPIN;
                    return [4 /*yield*/, KeyStoreWrapper.getPinOrEmptyString()];
                case 1:
                    if (!(_a === (_b.sent()))) return [3 /*break*/, 2];
                    KeyStoreWrapper.resetPinAttempts();
                    setAppUnlocked();
                    navigation.reset({
                        index: 0,
                        routes: [{ name: "Primary" }],
                    });
                    return [3 /*break*/, 6];
                case 2:
                    if (!(pinAttempts < MAX_PIN_ATTEMPTS - 1)) return [3 /*break*/, 3];
                    newPinAttempts = pinAttempts + 1;
                    KeyStoreWrapper.setPinAttempts(newPinAttempts.toString());
                    setPinAttempts(newPinAttempts);
                    setEnteredPIN("");
                    if (newPinAttempts === MAX_PIN_ATTEMPTS - 1) {
                        setHelperText(LL.PinScreen.oneAttemptRemaining());
                    }
                    else {
                        attemptsRemaining = MAX_PIN_ATTEMPTS - newPinAttempts;
                        setHelperText(LL.PinScreen.attemptsRemaining({ attemptsRemaining: attemptsRemaining }));
                    }
                    return [3 /*break*/, 6];
                case 3:
                    setHelperText(LL.PinScreen.tooManyAttempts());
                    return [4 /*yield*/, logout()];
                case 4:
                    _b.sent();
                    return [4 /*yield*/, sleep(1000)];
                case 5:
                    _b.sent();
                    navigation.reset({
                        index: 0,
                        routes: [{ name: "Primary" }],
                    });
                    _b.label = 6;
                case 6: return [2 /*return*/];
            }
        });
    }); };
    var handleCompletedPinForSetPin = function (newEnteredPIN) {
        if (previousPIN.length === 0) {
            setPreviousPIN(newEnteredPIN);
            setHelperText(LL.PinScreen.verifyPin());
            setEnteredPIN("");
        }
        else {
            verifyPINCodeMatches(newEnteredPIN);
        }
    };
    var addDigit = function (digit) {
        if (enteredPIN.length < 4) {
            var newEnteredPIN = enteredPIN + digit;
            setEnteredPIN(newEnteredPIN);
            if (newEnteredPIN.length === 4) {
                if (screenPurpose === PinScreenPurpose.AuthenticatePin) {
                    handleCompletedPinForAuthenticatePin(newEnteredPIN);
                }
                else if (screenPurpose === PinScreenPurpose.SetPin) {
                    handleCompletedPinForSetPin(newEnteredPIN);
                }
            }
        }
    };
    var verifyPINCodeMatches = function (newEnteredPIN) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(previousPIN === newEnteredPIN)) return [3 /*break*/, 2];
                    return [4 /*yield*/, KeyStoreWrapper.setPin(previousPIN)];
                case 1:
                    if (_a.sent()) {
                        KeyStoreWrapper.resetPinAttempts();
                        navigation.goBack();
                    }
                    else {
                        returnToSetPin();
                        Alert.alert(LL.PinScreen.storePinFailed());
                    }
                    return [3 /*break*/, 3];
                case 2:
                    returnToSetPin();
                    _a.label = 3;
                case 3: return [2 /*return*/];
            }
        });
    }); };
    var returnToSetPin = function () {
        setPreviousPIN("");
        setHelperText(LL.PinScreen.setPinFailedMatch());
        setEnteredPIN("");
    };
    var circleComponentForDigit = function (digit) {
        return (<View style={styles.circleContainer}>
        <View style={enteredPIN.length > digit ? styles.filledCircle : styles.emptyCircle}/>
      </View>);
    };
    var buttonComponentForDigit = function (digit) {
        return (<View style={styles.pinPadButtonContainer}>
        <Button buttonStyle={styles.pinPadButton} titleStyle={styles.pinPadButtonTitle} title={digit} onPress={function () { return addDigit(digit); }}/>
      </View>);
    };
    return (<Screen style={styles.container}>
      <View style={styles.topSpacer}/>
      <View style={styles.circles}>
        {circleComponentForDigit(0)}
        {circleComponentForDigit(1)}
        {circleComponentForDigit(2)}
        {circleComponentForDigit(3)}
      </View>
      <View style={styles.helperTextContainer}>
        <Text style={styles.helperText}>{helperText}</Text>
      </View>
      <View style={styles.pinPad}>
        <View style={styles.pinPadRow}>
          {buttonComponentForDigit("1")}
          {buttonComponentForDigit("2")}
          {buttonComponentForDigit("3")}
        </View>
        <View style={styles.pinPadRow}>
          {buttonComponentForDigit("4")}
          {buttonComponentForDigit("5")}
          {buttonComponentForDigit("6")}
        </View>
        <View style={styles.pinPadRow}>
          {buttonComponentForDigit("7")}
          {buttonComponentForDigit("8")}
          {buttonComponentForDigit("9")}
        </View>
        <View style={styles.pinPadRow}>
          <View style={styles.pinPadButtonContainer}/>
          {buttonComponentForDigit("0")}
          <View style={styles.pinPadButtonContainer}>
            <Button buttonStyle={styles.pinPadButton} icon={<Icon style={styles.pinPadButtonIcon} name="arrow-back"/>} onPress={function () { return setEnteredPIN(enteredPIN.slice(0, -1)); }}/>
          </View>
        </View>
      </View>
      <View style={styles.bottomSpacer}/>
    </Screen>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        bottomSpacer: {
            flex: 1,
        },
        circleContainer: {
            alignItems: "center",
            justifyContent: "center",
            width: "25%",
        },
        circles: {
            flex: 2,
            flexDirection: "row",
            width: "33.33%",
        },
        container: {
            alignItems: "center",
            flex: 1,
            width: "100%",
            backgroundColor: colors.primary,
        },
        emptyCircle: {
            backgroundColor: colors.primary,
            borderColor: colors.white,
            borderRadius: 16 / 2,
            borderWidth: 2,
            height: 16,
            width: 16,
        },
        filledCircle: {
            backgroundColor: colors.white,
            borderRadius: 16 / 2,
            height: 16,
            width: 16,
        },
        helperText: {
            color: colors.white,
            fontSize: 20,
        },
        helperTextContainer: {
            flex: 1,
        },
        pinPad: {
            alignItems: "center",
            flexDirection: "column",
            flex: 6,
        },
        pinPadButton: {
            backgroundColor: colors.primary,
            width: "100%",
            height: "100%",
        },
        pinPadButtonContainer: {
            width: "33.33%",
        },
        pinPadButtonIcon: {
            color: colors.white,
            fontSize: 32,
        },
        pinPadButtonTitle: {
            color: colors.white,
            fontSize: 26,
            fontWeight: "500",
        },
        pinPadRow: {
            flex: 1,
            flexDirection: "row",
            paddingHorizontal: "10%",
        },
        topSpacer: {
            flex: 1,
        },
    });
});
//# sourceMappingURL=pin-screen.js.map