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
import { useEffect } from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { makeStyles, useTheme } from "@rn-vui/themed";
import { useApolloClient } from "@apollo/client";
import { useIsAuthed } from "@app/graphql/is-authed-context";
import { updateDeviceSessionCount } from "@app/graphql/client-only-query";
import { useAuthenticationContext } from "@app/navigation/navigation-container-wrapper";
import AppLogoDarkMode from "../../assets/logo/app-logo-dark.svg";
import AppLogoLightMode from "../../assets/logo/blink-logo-light.svg";
import { Screen } from "../../components/screen";
import BiometricWrapper from "../../utils/biometricAuthentication";
import { AuthenticationScreenPurpose, PinScreenPurpose } from "../../utils/enum";
import KeyStoreWrapper from "../../utils/storage/secureStorage";
export var AuthenticationCheckScreen = function () {
    var client = useApolloClient();
    var styles = useStyles();
    var mode = useTheme().theme.mode;
    var AppLogo = mode === "dark" ? AppLogoDarkMode : AppLogoLightMode;
    var navigation = useNavigation();
    var isAuthed = useIsAuthed();
    var setAppUnlocked = useAuthenticationContext().setAppUnlocked;
    useEffect(function () {
        ;
        (function () { return __awaiter(void 0, void 0, void 0, function () {
            var isPinEnabled, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, KeyStoreWrapper.getIsPinEnabled()];
                    case 1:
                        isPinEnabled = _b.sent();
                        return [4 /*yield*/, BiometricWrapper.isSensorAvailable()];
                    case 2:
                        _a = (_b.sent());
                        if (!_a) return [3 /*break*/, 4];
                        return [4 /*yield*/, KeyStoreWrapper.getIsBiometricsEnabled()];
                    case 3:
                        _a = (_b.sent());
                        _b.label = 4;
                    case 4:
                        if (_a) {
                            navigation.replace("authentication", {
                                screenPurpose: AuthenticationScreenPurpose.Authenticate,
                                isPinEnabled: isPinEnabled,
                            });
                        }
                        else if (isPinEnabled) {
                            navigation.replace("pin", { screenPurpose: PinScreenPurpose.AuthenticatePin });
                        }
                        else {
                            setAppUnlocked();
                            updateDeviceSessionCount(client);
                            navigation.replace("Primary");
                        }
                        return [2 /*return*/];
                }
            });
        }); })();
    }, [isAuthed, navigation, setAppUnlocked, client]);
    return (<Screen>
      <View style={styles.container}>
        <View style={styles.logoWrapper}>
          <View style={styles.logoContainer}>
            <AppLogo width={"100%"} height={"100%"}/>
          </View>
        </View>
      </View>
    </Screen>);
};
var useStyles = makeStyles(function () { return ({
    container: {
        flex: 1,
    },
    logoWrapper: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    logoContainer: {
        width: 288,
        height: 288,
    },
}); });
//# sourceMappingURL=authentication-check-screen.js.map