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
import * as React from "react";
import { Alert, Dimensions, Linking, Platform, Pressable, StyleSheet, View, } from "react-native";
import { launchImageLibrary } from "react-native-image-picker";
import Svg, { Circle } from "react-native-svg";
import Icon from "react-native-vector-icons/Ionicons";
import { Camera, CameraType } from "react-native-camera-kit";
import { check, request, PERMISSIONS, RESULTS } from "react-native-permissions";
import RNQRGenerator from "rn-qr-generator";
import { gql } from "@apollo/client";
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button";
import { LNURL_DOMAINS } from "@app/config";
import { useAccountDefaultWalletLazyQuery, useRealtimePriceQuery, useScanningQrCodeScreenQuery, } from "@app/graphql/generated";
import { useIsAuthed } from "@app/graphql/is-authed-context";
import { useDisplayCurrency } from "@app/hooks/use-display-currency";
import { useI18nContext } from "@app/i18n/i18n-react";
import { logParseDestinationResult } from "@app/utils/analytics";
import { toastShow } from "@app/utils/toast";
import Clipboard from "@react-native-clipboard/clipboard";
import crashlytics from "@react-native-firebase/crashlytics";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { Text, makeStyles, useTheme } from "@rn-vui/themed";
import { Screen } from "../../components/screen";
import { parseDestination } from "./payment-destination";
import { DestinationDirection } from "./payment-destination/index.types";
var screenWidth = Dimensions.get("window").width;
var screenHeight = Dimensions.get("window").height;
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  query scanningQRCodeScreen {\n    globals {\n      network\n    }\n    me {\n      id\n      defaultAccount {\n        id\n        wallets {\n          id\n        }\n      }\n      contacts {\n        id\n        handle\n        username\n      }\n    }\n  }\n"], ["\n  query scanningQRCodeScreen {\n    globals {\n      network\n    }\n    me {\n      id\n      defaultAccount {\n        id\n        wallets {\n          id\n        }\n      }\n      contacts {\n        id\n        handle\n        username\n      }\n    }\n  }\n"])));
export var ScanningQRCodeScreen = function () {
    var _a, _b;
    var navigation = useNavigation();
    var isFocused = useIsFocused();
    // forcing price refresh
    useRealtimePriceQuery({ fetchPolicy: "network-only" });
    var colors = useTheme().theme.colors;
    var _c = React.useState(false), pending = _c[0], setPending = _c[1];
    var _d = React.useState(new Set()), scannedCache = _d[0], setScannedCache = _d[1];
    var _e = React.useState(false), hasPermission = _e[0], setHasPermission = _e[1];
    var _f = React.useState(false), isCameraUnavailable = _f[0], setIsCameraUnavailable = _f[1];
    var data = useScanningQrCodeScreenQuery({ skip: !useIsAuthed() }).data;
    var wallets = (_a = data === null || data === void 0 ? void 0 : data.me) === null || _a === void 0 ? void 0 : _a.defaultAccount.wallets;
    var bitcoinNetwork = (_b = data === null || data === void 0 ? void 0 : data.globals) === null || _b === void 0 ? void 0 : _b.network;
    var accountDefaultWalletQuery = useAccountDefaultWalletLazyQuery({
        fetchPolicy: "no-cache",
    })[0];
    var LL = useI18nContext().LL;
    var displayCurrency = useDisplayCurrency().displayCurrency;
    React.useEffect(function () {
        if (!isFocused) {
            setScannedCache(new Set());
        }
    }, [isFocused]);
    React.useEffect(function () {
        var checkPermission = function () { return __awaiter(void 0, void 0, void 0, function () {
            var permission, result, requestResult;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        permission = Platform.OS === "ios" ? PERMISSIONS.IOS.CAMERA : PERMISSIONS.ANDROID.CAMERA;
                        return [4 /*yield*/, check(permission)];
                    case 1:
                        result = _a.sent();
                        if (result === RESULTS.GRANTED) {
                            setHasPermission(true);
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, request(permission)];
                    case 2:
                        requestResult = _a.sent();
                        if (requestResult === RESULTS.UNAVAILABLE) {
                            setIsCameraUnavailable(true);
                            return [2 /*return*/];
                        }
                        setHasPermission(requestResult === RESULTS.GRANTED);
                        return [2 /*return*/];
                }
            });
        }); };
        checkPermission();
    }, []);
    var loadInBrowser = function (url) {
        Linking.openURL(url).catch(function (err) { return Alert.alert(err.toString()); });
    };
    function isValidHttpUrl(input) {
        var url;
        try {
            url = new URL(input);
        }
        catch (_) {
            return false;
        }
        return url.protocol === "http:" || url.protocol === "https:";
    }
    var processInvoice = React.useMemo(function () {
        return function (data) { return __awaiter(void 0, void 0, void 0, function () {
            var destination, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (pending || !wallets || !bitcoinNetwork || !data) {
                            return [2 /*return*/];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        setPending(true);
                        return [4 /*yield*/, parseDestination({
                                rawInput: data,
                                myWalletIds: wallets.map(function (wallet) { return wallet.id; }),
                                bitcoinNetwork: bitcoinNetwork,
                                lnurlDomains: LNURL_DOMAINS,
                                accountDefaultWalletQuery: accountDefaultWalletQuery,
                                inputSource: "qr",
                                displayCurrency: displayCurrency,
                            })];
                    case 2:
                        destination = _a.sent();
                        logParseDestinationResult(destination);
                        if (destination.valid) {
                            if (destination.destinationDirection === DestinationDirection.Send) {
                                navigation.replace("sendBitcoinDetails", {
                                    paymentDestination: destination,
                                });
                                return [2 /*return*/];
                            }
                            navigation.reset({
                                routes: [
                                    {
                                        name: "Primary",
                                    },
                                    {
                                        name: "redeemBitcoinDetail",
                                        params: {
                                            receiveDestination: destination,
                                        },
                                    },
                                ],
                            });
                            return [2 /*return*/];
                        }
                        switch (destination.invalidReason) {
                            case "InvoiceExpired":
                                Alert.alert(LL.ScanningQRCodeScreen.invalidTitle(), LL.ScanningQRCodeScreen.expiredContent({
                                    found: data.toString(),
                                }), [
                                    {
                                        text: LL.common.ok(),
                                        onPress: function () { return setPending(false); },
                                    },
                                ]);
                                break;
                            case "UnknownDestination":
                                if (isValidHttpUrl(data.toString())) {
                                    Alert.alert(LL.ScanningQRCodeScreen.openLinkTitle(), "".concat(data.toString(), "\n\n").concat(LL.ScanningQRCodeScreen.confirmOpenLink()), [
                                        {
                                            text: LL.common.No(),
                                            onPress: function () { return setPending(false); },
                                        },
                                        {
                                            text: LL.common.yes(),
                                            onPress: function () {
                                                setPending(false);
                                                loadInBrowser(data.toString());
                                            },
                                        },
                                    ]);
                                }
                                else {
                                    Alert.alert(LL.ScanningQRCodeScreen.invalidTitle(), LL.ScanningQRCodeScreen.invalidContent({
                                        found: data.toString(),
                                    }), [
                                        {
                                            text: LL.common.ok(),
                                            onPress: function () { return setPending(false); },
                                        },
                                    ]);
                                }
                                break;
                            default:
                                Alert.alert(LL.ScanningQRCodeScreen.invalidTitle(), LL.ScanningQRCodeScreen.invalidContent({
                                    found: data.toString(),
                                }), [
                                    {
                                        text: LL.common.ok(),
                                        onPress: function () { return setPending(false); },
                                    },
                                ]);
                                break;
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        err_1 = _a.sent();
                        if (err_1 instanceof Error) {
                            crashlytics().recordError(err_1);
                            Alert.alert(err_1.toString(), "", [
                                {
                                    text: LL.common.ok(),
                                    onPress: function () { return setPending(false); },
                                },
                            ]);
                        }
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        }); };
    }, [
        LL.ScanningQRCodeScreen,
        LL.common,
        navigation,
        pending,
        bitcoinNetwork,
        wallets,
        accountDefaultWalletQuery,
        displayCurrency,
    ]);
    var handleCodeScanned = React.useCallback(function (data) {
        if (!scannedCache.has(data)) {
            setScannedCache(new Set(scannedCache).add(data));
            processInvoice(data);
        }
    }, [scannedCache, processInvoice]);
    var styles = useStyles();
    var handleInvoicePaste = function () { return __awaiter(void 0, void 0, void 0, function () {
        var data_1, err_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, Clipboard.getString()];
                case 1:
                    data_1 = _a.sent();
                    processInvoice(data_1);
                    return [3 /*break*/, 3];
                case 2:
                    err_2 = _a.sent();
                    if (err_2 instanceof Error) {
                        crashlytics().recordError(err_2);
                        Alert.alert(err_2.toString());
                    }
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); };
    var showImagePicker = function () { return __awaiter(void 0, void 0, void 0, function () {
        var result, uri, qrCodeValues, err_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 4, , 5]);
                    return [4 /*yield*/, launchImageLibrary({ mediaType: "photo" })];
                case 1:
                    result = _a.sent();
                    if (result.errorCode === "permission") {
                        toastShow({
                            message: function (translations) {
                                return translations.ScanningQRCodeScreen.imageLibraryPermissionsNotGranted();
                            },
                            LL: LL,
                        });
                    }
                    if (!(result.assets && result.assets.length > 0)) return [3 /*break*/, 3];
                    uri = result.assets[0].uri;
                    return [4 /*yield*/, RNQRGenerator.detect({ uri: uri })];
                case 2:
                    qrCodeValues = _a.sent();
                    if (qrCodeValues && qrCodeValues.values.length > 0) {
                        processInvoice(qrCodeValues.values[0]);
                        return [2 /*return*/];
                    }
                    Alert.alert(LL.ScanningQRCodeScreen.noQrCode());
                    _a.label = 3;
                case 3: return [3 /*break*/, 5];
                case 4:
                    err_3 = _a.sent();
                    if (err_3 instanceof Error) {
                        crashlytics().recordError(err_3);
                        Alert.alert(err_3.toString());
                    }
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var onError = React.useCallback(function (event) {
        console.error(event.nativeEvent.errorMessage);
    }, []);
    if (isCameraUnavailable) {
        return (<Screen>
        <View style={styles.permissionMissing}>
          <Text type="h1" style={styles.permissionMissingText}>
            {LL.ScanningQRCodeScreen.noCamera()}
          </Text>
        </View>
      </Screen>);
    }
    if (!hasPermission) {
        var openSettings = function () {
            Linking.openSettings().catch(function () {
                Alert.alert(LL.ScanningQRCodeScreen.unableToOpenSettings());
            });
        };
        return (<Screen>
        <View style={styles.permissionMissing}>
          <Text type="h1" style={styles.permissionMissingText}>
            {LL.ScanningQRCodeScreen.permissionCamera()}
          </Text>
          <GaloyPrimaryButton title={LL.ScanningQRCodeScreen.openSettings()} onPress={openSettings}/>
        </View>
      </Screen>);
    }
    return (<Screen unsafe>
      {isFocused && (<Camera cameraType={CameraType.Back} focusMode="on" zoomMode="on" scanBarcode={true} onReadCode={function (event) { return handleCodeScanned(event.nativeEvent.codeStringValue); }} onError={onError} style={StyleSheet.absoluteFill}/>)}
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.rectangleContainer}>
          <View style={styles.rectangle}/>
        </View>
        <Pressable onPress={navigation.goBack}>
          <View style={styles.close}>
            <Svg viewBox="0 0 100 100">
              <Circle cx={50} cy={50} r={50} fill={colors._white} opacity={0.5}/>
            </Svg>
            <Icon name="close" size={64} style={styles.iconClose}/>
          </View>
        </Pressable>
        <View style={styles.openGallery}>
          <Pressable onPress={showImagePicker}>
            <Icon name="image" size={64} color={colors._lightGrey} style={styles.iconGalery}/>
          </Pressable>
          <Pressable onPress={handleInvoicePaste}>
            {/* we could Paste from "FontAwesome" but as svg*/}
            <Icon name="clipboard-outline" size={64} color={colors._lightGrey} style={styles.iconClipboard}/>
          </Pressable>
        </View>
      </View>
    </Screen>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        close: {
            alignSelf: "flex-end",
            height: 64,
            marginRight: 16,
            marginTop: 40,
            width: 64,
        },
        openGallery: {
            height: 128,
            left: 32,
            position: "absolute",
            top: screenHeight - 96,
            width: screenWidth,
        },
        rectangle: {
            borderColor: colors.primary,
            borderWidth: 2,
            height: screenWidth * 0.75,
            width: screenWidth * 0.75,
        },
        rectangleContainer: {
            alignItems: "center",
            bottom: 0,
            justifyContent: "center",
            left: 0,
            position: "absolute",
            right: 0,
            top: 0,
        },
        iconClose: { position: "absolute", top: -2, color: colors._black },
        iconGalery: { opacity: 0.8 },
        iconClipboard: { opacity: 0.8, position: "absolute", bottom: "5%", right: "15%" },
        permissionMissing: {
            alignItems: "center",
            flex: 1,
            justifyContent: "center",
            rowGap: 32,
        },
        permissionMissingText: {
            width: "80%",
            textAlign: "center",
        },
    });
});
var templateObject_1;
//# sourceMappingURL=scanning-qrcode-screen.js.map