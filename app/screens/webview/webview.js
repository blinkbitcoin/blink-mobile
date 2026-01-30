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
import { Alert, TouchableOpacity } from "react-native";
import { injectJs, onMessageHandler } from "react-native-webln";
import { WebView } from "react-native-webview";
import { GaloyIcon } from "@app/components/atomic/galoy-icon";
import { useI18nContext } from "@app/i18n/i18n-react";
import { useNavigation } from "@react-navigation/native";
import { makeStyles, useTheme } from "@rn-vui/themed";
import { Screen } from "../../components/screen";
export var WebViewScreen = function (_a) {
    var route = _a.route;
    var styles = useStyles();
    var navigate = useNavigation().navigate;
    var _b = route.params, url = _b.url, initialTitle = _b.initialTitle, headerTitle = _b.headerTitle;
    var LL = useI18nContext().LL;
    var webview = React.useRef(null);
    var _c = React.useState(false), jsInjected = _c[0], setJsInjected = _c[1];
    var navigation = useNavigation();
    var _d = React.useState(false), canGoBack = _d[0], setCanGoBack = _d[1];
    var _e = useTheme().theme, colors = _e.colors, mode = _e.mode;
    var handleBackPress = React.useCallback(function () {
        if (webview.current && canGoBack) {
            webview.current.goBack();
            return;
        }
        navigation.goBack();
    }, [canGoBack, navigation]);
    React.useEffect(function () {
        if (headerTitle) {
            navigation.setOptions({ title: headerTitle });
            return;
        }
        if (!initialTitle)
            return;
        navigation.setOptions({ title: initialTitle });
    }, [navigation, initialTitle, headerTitle]);
    React.useEffect(function () {
        navigation.setOptions({
            headerLeft: function () { return (<TouchableOpacity style={styles.iconContainer} onPress={handleBackPress}>
          <GaloyIcon name="caret-left" size={20} color={colors.black}/>
        </TouchableOpacity>); },
        });
    }, [navigation, handleBackPress, LL, styles.iconContainer, colors.black]);
    var handleWebViewNavigationStateChange = function (newNavState) {
        setCanGoBack(newNavState.canGoBack);
        if (!headerTitle && newNavState.title) {
            navigation.setOptions({ title: newNavState.title });
        }
    };
    var injectThemeJs = function () {
        return "\n      document.body.setAttribute(\"data-theme\", \"".concat(mode, "\");\n    ");
    };
    return (<Screen>
      <WebView ref={webview} source={{ uri: url }} onLoadStart={function () { return setJsInjected(false); }} onLoadProgress={function (e) {
            if (!jsInjected && e.nativeEvent.progress > 0.75) {
                if (webview.current) {
                    webview.current.injectJavaScript(injectThemeJs());
                    webview.current.injectJavaScript(injectJs());
                    setJsInjected(true);
                }
                else
                    Alert.alert("Error", "Webview not ready");
            }
        }} onNavigationStateChange={handleWebViewNavigationStateChange} onMessage={onMessageHandler(webview, {
            enable: function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/];
                });
            }); },
            getInfo: function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    /* Your implementation goes here */
                    return [2 /*return*/, { node: { alias: "alias", color: "color", pubkey: "pubkey" } }];
                });
            }); },
            makeInvoice: function (_args) { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    /* Your implementation goes here */
                    return [2 /*return*/, { paymentRequest: "paymentRequest" }];
                });
            }); },
            sendPayment: function (paymentRequestStr) { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    navigate("sendBitcoinDestination", {
                        payment: paymentRequestStr,
                    });
                    return [2 /*return*/, { preimage: "preimage" }
                        /* Your implementation goes here */
                    ];
                });
            }); },
            signMessage: function (_message) { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    /* Your implementation goes here */
                    return [2 /*return*/, { signature: "signature", message: "message" }];
                });
            }); },
            verifyMessage: function (_signature, _message) { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/];
                });
            }); },
            keysend: function (_args) { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    /* Your implementation goes here */
                    return [2 /*return*/, { preimage: "preimage" }];
                });
            }); },
            // Non-WebLN
            // Called when an a-tag containing a `lightning:` uri is found on a page
            // foundInvoice: async (paymentRequestStr) => {
            //   /* Your implementation goes here */
            // },
        })} style={styles.full} allowsInlineMediaPlayback/>
    </Screen>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        full: { width: "100%", height: "100%", flex: 1, backgroundColor: colors.transparent },
        iconContainer: {
            marginLeft: 10,
        },
    });
});
//# sourceMappingURL=webview.js.map