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
import { Alert, DevSettings, Linking, View, Share } from "react-native";
import DeviceInfo from "react-native-device-info";
import { ScrollView } from "react-native-gesture-handler";
import InAppReview from "react-native-in-app-review";
import { InAppBrowser } from "react-native-inappbrowser-reborn";
import { gql, useApolloClient } from "@apollo/client";
import { GaloyInput } from "@app/components/atomic/galoy-input";
import { GALOY_INSTANCES, possibleGaloyInstanceNames } from "@app/config";
import { activateBeta } from "@app/graphql/client-only-query";
import { useBetaQuery, useDebugScreenQuery, useLevelQuery } from "@app/graphql/generated";
import { useIsAuthed } from "@app/graphql/is-authed-context";
import { useAppConfig } from "@app/hooks/use-app-config";
import Clipboard from "@react-native-clipboard/clipboard";
import crashlytics from "@react-native-firebase/crashlytics";
import { useNavigation } from "@react-navigation/native";
import { Button, Text, makeStyles } from "@rn-vui/themed";
import { Screen } from "../../components/screen";
import { usePriceConversion, useSaveSessionProfile } from "@app/hooks";
import useLogout from "../../hooks/use-logout";
import { addDeviceToken } from "../../utils/notifications";
import { testProps } from "../../utils/testProps";
import useAppCheckToken from "../get-started-screen/use-device-token";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  query debugScreen {\n    me {\n      id\n      defaultAccount {\n        id\n      }\n    }\n  }\n"], ["\n  query debugScreen {\n    me {\n      id\n      defaultAccount {\n        id\n      }\n    }\n  }\n"])));
var usingHermes = typeof HermesInternal === "object" && HermesInternal !== null;
export var DeveloperScreen = function () {
    var _a, _b, _c, _d, _e, _f;
    var styles = useStyles();
    var client = useApolloClient();
    var usdPerSat = usePriceConversion().usdPerSat;
    var logout = useLogout().logout;
    var saveProfile = useSaveSessionProfile().saveProfile;
    var navigate = useNavigation().navigate;
    var _g = useAppConfig(), appConfig = _g.appConfig, saveTokenAndInstance = _g.saveTokenAndInstance;
    var token = appConfig.token;
    var dataLevel = useLevelQuery({ fetchPolicy: "cache-only" }).data;
    var level = String((_b = (_a = dataLevel === null || dataLevel === void 0 ? void 0 : dataLevel.me) === null || _a === void 0 ? void 0 : _a.defaultAccount) === null || _b === void 0 ? void 0 : _b.level);
    var dataDebug = useDebugScreenQuery().data;
    var accountId = (_d = (_c = dataDebug === null || dataDebug === void 0 ? void 0 : dataDebug.me) === null || _c === void 0 ? void 0 : _c.defaultAccount) === null || _d === void 0 ? void 0 : _d.id;
    var currentGaloyInstance = appConfig.galoyInstance;
    var _h = React.useState(currentGaloyInstance.fiatUrl), urlWebView = _h[0], setUrlWebView = _h[1];
    var _j = React.useState(currentGaloyInstance.kycUrl), urlInAppBrowser = _j[0], setUrlInAppBrowser = _j[1];
    React.useEffect(function () {
        setUrlWebView("".concat(currentGaloyInstance.fiatUrl, "?accountId=").concat(accountId));
        setUrlInAppBrowser("".concat(currentGaloyInstance.kycUrl, "?accountId=").concat(accountId));
    }, [accountId, currentGaloyInstance.fiatUrl, currentGaloyInstance.kycUrl]);
    var _k = React.useState(token), newToken = _k[0], setNewToken = _k[1];
    var _l = React.useState(undefined), hasFlowFinishedSuccessfully = _l[0], setHasFlowFinishedSuccessfully = _l[1];
    var _m = React.useState(currentGaloyInstance.id === "Custom" ? currentGaloyInstance.graphqlUri : ""), newGraphqlUri = _m[0], setNewGraphqlUri = _m[1];
    var _o = React.useState(currentGaloyInstance.id === "Custom" ? currentGaloyInstance.graphqlWsUri : ""), newGraphqlWslUri = _o[0], setNewGraphqlWslUri = _o[1];
    var _p = React.useState(currentGaloyInstance.id === "Custom" ? currentGaloyInstance.posUrl : ""), newPosUrl = _p[0], setNewPosUrl = _p[1];
    var _q = React.useState(currentGaloyInstance.id === "Custom" ? currentGaloyInstance.kycUrl : ""), newKycUrl = _q[0], setNewKycUrl = _q[1];
    var _r = React.useState(currentGaloyInstance.id === "Custom" ? currentGaloyInstance.fiatUrl : ""), newFiatUrl = _r[0], setNewFiatUrl = _r[1];
    var _s = React.useState(currentGaloyInstance.id === "Custom" ? currentGaloyInstance.authUrl : ""), newRestUrl = _s[0], setNewRestUrl = _s[1];
    var _t = React.useState(currentGaloyInstance.id === "Custom" ? currentGaloyInstance.lnAddressHostname : ""), newLnAddressHostname = _t[0], setNewLnAddressHostname = _t[1];
    var _u = React.useState(currentGaloyInstance.id), newGaloyInstance = _u[0], setNewGaloyInstance = _u[1];
    var isAuthed = useIsAuthed();
    var dataBeta = useBetaQuery({ skip: !isAuthed });
    var beta = (_f = (_e = dataBeta.data) === null || _e === void 0 ? void 0 : _e.beta) !== null && _f !== void 0 ? _f : false;
    var changesHaveBeenMade = newToken !== token ||
        (newGaloyInstance !== currentGaloyInstance.id && newGaloyInstance !== "Custom") ||
        (newGaloyInstance === "Custom" &&
            Boolean(newGraphqlUri) &&
            Boolean(newGraphqlWslUri) &&
            Boolean(newPosUrl) &&
            Boolean(newRestUrl) &&
            (newGraphqlUri !== currentGaloyInstance.graphqlUri ||
                newGraphqlWslUri !== currentGaloyInstance.graphqlWsUri ||
                newPosUrl !== currentGaloyInstance.posUrl ||
                newKycUrl !== currentGaloyInstance.kycUrl ||
                newFiatUrl !== currentGaloyInstance.fiatUrl ||
                newRestUrl !== currentGaloyInstance.authUrl ||
                newLnAddressHostname !== currentGaloyInstance.lnAddressHostname));
    React.useEffect(function () {
        if (newGaloyInstance === currentGaloyInstance.id) {
            setNewToken(token);
        }
        else {
            setNewToken("");
        }
    }, [newGaloyInstance, currentGaloyInstance, token]);
    var appCheckToken = useAppCheckToken({});
    var openInAppBrowser = function () { return __awaiter(void 0, void 0, void 0, function () {
        var result, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 5, , 6]);
                    return [4 /*yield*/, InAppBrowser.isAvailable()];
                case 1:
                    if (!_a.sent()) return [3 /*break*/, 3];
                    return [4 /*yield*/, InAppBrowser.open(urlInAppBrowser, {
                            // iOS Properties
                            dismissButtonStyle: "cancel",
                            preferredBarTintColor: "#453AA4",
                            preferredControlTintColor: "white",
                            readerMode: false,
                            animated: true,
                            modalPresentationStyle: "fullScreen",
                            modalTransitionStyle: "coverVertical",
                            modalEnabled: true,
                            enableBarCollapsing: false,
                            // Android Properties
                            showTitle: true,
                            toolbarColor: "#6200EE",
                            secondaryToolbarColor: "black",
                            navigationBarColor: "black",
                            navigationBarDividerColor: "white",
                            enableUrlBarHiding: true,
                            enableDefaultShare: true,
                            forceCloseOnRedirection: false,
                            // Specify full animation resource identifier(package:anim/name)
                            // or only resource name(in case of animation bundled with app).
                            animations: {
                                startEnter: "slide_in_right",
                                startExit: "slide_out_left",
                                endEnter: "slide_in_left",
                                endExit: "slide_out_right",
                            },
                            headers: {
                                "my-custom-header": "my custom header value",
                            },
                            hasBackButton: true,
                        })
                        // await this.sleep(800)
                    ];
                case 2:
                    result = _a.sent();
                    // await this.sleep(800)
                    Alert.alert(JSON.stringify(result));
                    return [3 /*break*/, 4];
                case 3:
                    Linking.openURL(urlInAppBrowser);
                    _a.label = 4;
                case 4: return [3 /*break*/, 6];
                case 5:
                    error_1 = _a.sent();
                    if (error_1 instanceof Error) {
                        Alert.alert(error_1.message);
                    }
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    var handleSave = function () { return __awaiter(void 0, void 0, void 0, function () {
        var newGaloyInstanceObject;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, logout({ stateToDefault: false })];
                case 1:
                    _a.sent();
                    if (!(newGaloyInstance === "Custom")) return [3 /*break*/, 4];
                    return [4 /*yield*/, saveTokenAndInstance({
                            instance: {
                                id: "Custom",
                                graphqlUri: newGraphqlUri,
                                graphqlWsUri: newGraphqlWslUri,
                                authUrl: newRestUrl,
                                posUrl: newPosUrl,
                                kycUrl: newKycUrl,
                                fiatUrl: newFiatUrl,
                                lnAddressHostname: newLnAddressHostname,
                                name: "Custom", // TODO: make configurable
                                blockExplorer: "https://mempool.space/tx/", // TODO make configurable
                            },
                            token: newToken || "",
                        })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, saveProfile(newToken || "")];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    newGaloyInstanceObject = GALOY_INSTANCES.find(function (instance) { return instance.id === newGaloyInstance; });
                    if (!newGaloyInstanceObject) return [3 /*break*/, 7];
                    return [4 /*yield*/, saveTokenAndInstance({
                            instance: newGaloyInstanceObject,
                            token: newToken || "",
                        })];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, saveProfile(newToken || "")];
                case 6:
                    _a.sent();
                    return [2 /*return*/];
                case 7: return [4 /*yield*/, saveProfile(newToken || "")];
                case 8:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    return (<Screen>
      <ScrollView {...testProps("developer-screen-scroll-view")}>
        <View style={styles.screenContainer}>
          <Button title="Log out" containerStyle={styles.button} onPress={function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, logout()];
                    case 1:
                        _a.sent();
                        Alert.alert("state successfully deleted. Restart your app");
                        return [2 /*return*/];
                }
            });
        }); }} {...testProps("logout button")}/>
          <Button title="Send device token" containerStyle={styles.button} onPress={function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (token && client) {
                    addDeviceToken(client);
                }
                return [2 /*return*/];
            });
        }); }}/>
          <Button title={"Beta features: ".concat(beta)} containerStyle={styles.button} onPress={function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/, activateBeta(client, !beta)];
    }); }); }}/>
          {__DEV__ && (<>
              <Button title="Reload" containerStyle={styles.button} onPress={function () { return DevSettings.reload(); }}/>
              <Button title="Crash test" containerStyle={styles.button} onPress={function () {
                crashlytics().log("Testing crash");
                crashlytics().crash();
            }}/>
            </>)}
          <GaloyInput {...testProps("Url in app browser")} label="Url in app browser" value={urlInAppBrowser} onChangeText={setUrlInAppBrowser} selectTextOnFocus/>
          <Button title="Open in app browser" containerStyle={styles.button} {...testProps("Open in app browser")} onPress={openInAppBrowser}/>
          <GaloyInput {...testProps("Url webview")} label="Url webview" value={urlWebView} onChangeText={setUrlWebView} selectTextOnFocus/>
          <Button title="Navigate to webview" containerStyle={styles.button} {...testProps("Navigate to webview")} onPress={function () {
            return navigate("webView", {
                url: urlWebView,
            });
        }}/>
          <Text>InAppReview available: {String(InAppReview.isAvailable())}</Text>
          <Text>result InAppReview: {String(hasFlowFinishedSuccessfully)}</Text>
          <Button title="Rate us" containerStyle={styles.button} {...testProps("Rate us")} onPress={function () {
            return InAppReview.RequestInAppReview().then(setHasFlowFinishedSuccessfully);
        }}/>
          <View>
            <Text style={styles.textHeader}>{DeviceInfo.getReadableVersion()}</Text>
            <Text style={styles.textHeader}>Account info</Text>
            <Text>AccountId: </Text>
            <Text selectable>{accountId}</Text>
            <Text>Level: {level}</Text>
            <Text>Token Present: {String(Boolean(token))}</Text>
            <Text style={styles.textHeader}>Environment Information</Text>
            <Text selectable>Galoy Instance: {appConfig.galoyInstance.id}</Text>
            <Text selectable>GQL_URL: {appConfig.galoyInstance.graphqlUri}</Text>
            <Text selectable>GQL_WS_URL: {appConfig.galoyInstance.graphqlWsUri}</Text>
            <Text selectable>POS URL: {appConfig.galoyInstance.posUrl}</Text>
            <Text selectable>
              LN Address Hostname: {appConfig.galoyInstance.lnAddressHostname}
            </Text>
            <Text selectable>
              USD per 1 sat: {usdPerSat ? "$".concat(usdPerSat) : "No price data"}
            </Text>
            <Text>Hermes: {String(Boolean(usingHermes))}</Text>
            <Button {...testProps("Save Changes")} title="Save changes" style={styles.button} onPress={handleSave} disabled={!changesHaveBeenMade}/>
            <Text style={styles.textHeader}>Update Environment</Text>
            {possibleGaloyInstanceNames.map(function (instanceName) { return (<Button key={instanceName} title={instanceName} onPress={function () {
                setNewGaloyInstance(instanceName);
            }} {...testProps("".concat(instanceName, " button"))} buttonStyle={instanceName === newGaloyInstance
                ? styles.selectedInstanceButton
                : styles.notSelectedInstanceButton} titleStyle={instanceName === newGaloyInstance
                ? styles.selectedInstanceButton
                : styles.notSelectedInstanceButton} containerStyle={instanceName === newGaloyInstance
                ? styles.selectedInstanceButton
                : styles.notSelectedInstanceButton} {...testProps("".concat(instanceName, " Button"))}/>); })}
            <GaloyInput {...testProps("Input access token")} label="Access Token" placeholder={"Access token"} value={newToken} secureTextEntry={true} onChangeText={setNewToken} selectTextOnFocus/>
            <Button {...testProps("Copy access token")} title="Copy access token" containerStyle={styles.button} onPress={function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                Clipboard.setString(newToken || "");
                Alert.alert("Token copied in clipboard.");
                return [2 /*return*/];
            });
        }); }} disabled={!newToken}/>
            <Button {...testProps("Share access token")} title="Share access token" containerStyle={styles.button} onPress={function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                Share.share({ message: newToken || "" });
                return [2 /*return*/];
            });
        }); }} disabled={!newToken}/>
            {newGaloyInstance === "Custom" && (<>
                <GaloyInput label="Graphql Uri" placeholder={"Graphql Uri"} autoCapitalize="none" autoCorrect={false} value={newGraphqlUri} onChangeText={setNewGraphqlUri} selectTextOnFocus/>
                <GaloyInput label="Graphql Ws Uri" placeholder={"Graphql Ws Uri"} autoCapitalize="none" autoCorrect={false} value={newGraphqlWslUri} onChangeText={setNewGraphqlWslUri} selectTextOnFocus/>
                <GaloyInput label="POS Url" placeholder={"POS Url"} autoCapitalize="none" autoCorrect={false} value={newPosUrl} onChangeText={setNewPosUrl} selectTextOnFocus/>
                <GaloyInput label="Kyc Url" placeholder={"Kyc Url"} autoCapitalize="none" autoCorrect={false} value={newKycUrl} onChangeText={setNewKycUrl} selectTextOnFocus/>
                <GaloyInput label="Fiat Url" placeholder={"Fiat Url"} autoCapitalize="none" autoCorrect={false} value={newFiatUrl} onChangeText={setNewFiatUrl} selectTextOnFocus/>
                <GaloyInput label="Rest Url" placeholder={"Rest Url"} autoCapitalize="none" autoCorrect={false} value={newRestUrl} onChangeText={setNewRestUrl} selectTextOnFocus/>
                <GaloyInput label="LN Address Hostname" placeholder={"LN Address Hostname"} autoCapitalize="none" autoCorrect={false} value={newLnAddressHostname} onChangeText={setNewLnAddressHostname} selectTextOnFocus/>
              </>)}
            <Text selectable>{appCheckToken}</Text>
          </View>
        </View>
      </ScrollView>
    </Screen>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        button: {
            marginVertical: 6,
        },
        screenContainer: {
            marginHorizontal: 12,
            marginBottom: 40,
        },
        textHeader: {
            fontSize: 18,
            marginVertical: 12,
        },
        selectedInstanceButton: {
            backgroundColor: colors.grey5,
            color: colors.white,
        },
        notSelectedInstanceButton: {
            backgroundColor: colors.white,
            color: colors.grey3,
        },
    });
});
var templateObject_1;
//# sourceMappingURL=developer-screen.js.map