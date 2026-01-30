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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import * as React from "react";
import { useEffect, useRef } from "react";
import { Linking } from "react-native";
import RNBootSplash from "react-native-bootsplash";
import analytics from "@react-native-firebase/analytics";
import { NavigationContainer, DarkTheme, } from "@react-navigation/native";
import { useTheme } from "@rn-vui/themed";
import { useIsAuthed } from "../graphql/is-authed-context";
import { PREFIX_LINKING, TELEGRAM_CALLBACK_PATH } from "@app/config";
import { Action, useActionsContext } from "@app/components/actions";
// The initial value will never be null because the provider will always pass a non null value
// eslint-disable-next-line
// @ts-ignore
var AuthenticationContext = React.createContext(null);
export var AuthenticationContextProvider = AuthenticationContext.Provider;
export var useAuthenticationContext = function () { return React.useContext(AuthenticationContext); };
var processLinkForAction = function (url) {
    // grab action query param
    var urlObj = new URL(url);
    var action = urlObj.searchParams.get("action");
    switch ((action || "").toLocaleLowerCase()) {
        case "set-ln-address":
            return Action.SetLnAddress;
        case "set-default-account":
            return Action.SetDefaultAccount;
        case "upgrade-account":
            return Action.UpgradeAccount;
    }
    return null;
};
export var NavigationContainerWrapper = function (_a) {
    var children = _a.children;
    var isAuthed = useIsAuthed();
    var _b = React.useState(true), isAppLocked = _b[0], setIsAppLocked = _b[1];
    var _c = React.useState(null), urlAfterUnlockAndAuth = _c[0], setUrlAfterUnlockAndAuth = _c[1];
    var setActiveAction = useActionsContext().setActiveAction;
    useEffect(function () {
        if (isAuthed && !isAppLocked && urlAfterUnlockAndAuth) {
            Linking.openURL(urlAfterUnlockAndAuth);
            setUrlAfterUnlockAndAuth(null);
        }
    }, [isAuthed, isAppLocked, urlAfterUnlockAndAuth]);
    var setAppUnlocked = React.useMemo(function () { return function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            setIsAppLocked(false);
            return [2 /*return*/];
        });
    }); }; }, []);
    var setAppLocked = React.useMemo(function () { return function () { return setIsAppLocked(true); }; }, []);
    var routeName = useRef("Initial");
    var mode = useTheme().theme.mode;
    var getActiveRouteName = function (state) {
        if (!state || typeof state.index !== "number") {
            return "Unknown";
        }
        var route = state.routes[state.index];
        if (route.state) {
            return getActiveRouteName(route.state);
        }
        return route.name;
    };
    var linking = {
        prefixes: __spreadArray(__spreadArray([], PREFIX_LINKING, true), [
            "bitcoin://",
            "lightning://",
            "lapp://",
            "lnurlw://",
            "lnurlp://",
            "lnurl://",
        ], false),
        config: {
            screens: {
                Primary: {
                    screens: {
                        Home: "home",
                        People: {
                            path: "people",
                            initialRouteName: "peopleHome",
                            screens: {
                                circlesDashboard: "circles",
                            },
                        },
                        Earn: "earn",
                        Map: "map",
                    },
                },
                priceHistory: "price",
                receiveBitcoin: "receive",
                conversionDetails: "convert",
                scanningQRCode: "scan-qr",
                totpRegistrationInitiate: "settings/2fa",
                currency: "settings/display-currency",
                defaultWallet: "settings/default-account",
                language: "settings/language",
                theme: "settings/theme",
                security: "settings/security",
                accountScreen: "settings/account",
                transactionLimitsScreen: "settings/tx-limits",
                notificationSettingsScreen: "settings/notifications",
                emailRegistrationInitiate: "settings/email",
                settings: "settings",
                transactionDetail: {
                    path: "transaction/:txid",
                },
                sendBitcoinDestination: ":payment",
            },
        },
        getInitialURL: function () { return __awaiter(void 0, void 0, void 0, function () {
            var url;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Linking.getInitialURL()];
                    case 1:
                        url = _a.sent();
                        setUrlAfterUnlockAndAuth(url);
                        return [2 /*return*/, null];
                }
            });
        }); },
        subscribe: function (listener) {
            var onReceiveURL = function (_a) {
                var url = _a.url;
                if (url.includes(TELEGRAM_CALLBACK_PATH))
                    return;
                if (!isAppLocked && isAuthed) {
                    var maybeAction = processLinkForAction(url);
                    if (maybeAction) {
                        setActiveAction(maybeAction);
                    }
                    listener(url);
                }
                else {
                    setUrlAfterUnlockAndAuth(url);
                }
            };
            // Listen to incoming links from deep linking
            var subscription = Linking.addEventListener("url", onReceiveURL);
            return function () {
                // Clean up the event listeners
                subscription.remove();
            };
        },
    };
    return (<AuthenticationContextProvider value={{ isAppLocked: isAppLocked, setAppUnlocked: setAppUnlocked, setAppLocked: setAppLocked }}>
      <NavigationContainer {...(mode === "dark" ? { theme: DarkTheme } : {})} linking={linking} onReady={function () {
            RNBootSplash.hide({ fade: true });
            console.log("NavigationContainer onReady");
        }} onStateChange={function (state) {
            var currentRouteName = getActiveRouteName(state);
            if (routeName.current !== currentRouteName && currentRouteName) {
                /* eslint-disable camelcase */
                analytics().logScreenView({
                    screen_name: currentRouteName,
                    screen_class: currentRouteName,
                    is_manual_log: true,
                });
                routeName.current = currentRouteName;
            }
        }}>
        {children}
      </NavigationContainer>
    </AuthenticationContextProvider>);
};
//# sourceMappingURL=navigation-container-wrapper.js.map