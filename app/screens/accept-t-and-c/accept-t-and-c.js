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
import { Alert, View } from "react-native";
import { Text, makeStyles } from "@rn-vui/themed";
import InAppBrowser from "react-native-inappbrowser-reborn";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useI18nContext } from "@app/i18n/i18n-react";
import { useFeatureFlags } from "@app/config/feature-flags-context";
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button";
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button";
import { Screen } from "../../components/screen";
import { PhoneLoginInitiateType } from "../phone-auth-screen";
import useAppCheckToken from "../get-started-screen/use-device-token";
import { useCreateDeviceAccount } from "../get-started-screen/use-create-device-account";
export var AcceptTermsAndConditionsScreen = function () {
    var styles = useStyles();
    var LL = useI18nContext().LL;
    var navigation = useNavigation();
    var route = useRoute();
    var flow = (route.params || { flow: "phone" }).flow;
    var deviceAccountEnabled = useFeatureFlags().deviceAccountEnabled;
    var appCheckToken = useAppCheckToken({ skip: !deviceAccountEnabled });
    var _a = useCreateDeviceAccount(), createDeviceAccountAndLogin = _a.createDeviceAccountAndLogin, loading = _a.loading;
    var fallbackToPhoneLogin = function () {
        navigation.navigate("login", {
            type: PhoneLoginInitiateType.CreateAccount,
        });
    };
    var action = function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (flow === "phone" || !appCheckToken) {
                fallbackToPhoneLogin();
                return [2 /*return*/];
            }
            if (flow === "trial") {
                createDeviceAccountAndLogin(appCheckToken).catch(fallbackToPhoneLogin);
                return [2 /*return*/];
            }
            Alert.alert("unknown flow");
            return [2 /*return*/];
        });
    }); };
    return (<Screen preset="scroll" style={styles.screenStyle} keyboardOffset="navigationHeader" keyboardShouldPersistTaps="handled">
      <View style={styles.viewWrapper}>
        <View style={styles.textContainer}>
          <Text type={"p1"}>{LL.AcceptTermsAndConditionsScreen.text()}</Text>
        </View>

        <View style={styles.textContainer}>
          <GaloySecondaryButton title={LL.AcceptTermsAndConditionsScreen.termsAndConditions()} onPress={function () { return InAppBrowser.open("https://www.blink.sv/en/terms-conditions"); }}/>
        </View>
        <View style={styles.textContainer}>
          <GaloySecondaryButton title={LL.AcceptTermsAndConditionsScreen.prohibitedCountry()} onPress={function () {
            return InAppBrowser.open("https://faq.blink.sv/creating-a-blink-account/which-countries-are-unable-to-download-and-activate-blink");
        }}/>
        </View>

        <View style={styles.buttonsContainer}>
          <GaloyPrimaryButton title={LL.AcceptTermsAndConditionsScreen.accept()} onPress={action} loading={loading} disabled={loading}/>
        </View>
      </View>
    </Screen>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        screenStyle: {
            padding: 20,
            flexGrow: 1,
        },
        buttonsContainer: {
            flex: 1,
            justifyContent: "flex-end",
            marginBottom: 14,
        },
        inputContainer: {
            marginBottom: 20,
            flexDirection: "row",
            alignItems: "stretch",
            minHeight: 48,
        },
        textContainer: {
            marginBottom: 20,
        },
        viewWrapper: { flex: 1 },
        inputContainerStyle: {
            flex: 1,
            borderWidth: 2,
            borderBottomWidth: 2,
            paddingHorizontal: 10,
            borderColor: colors.primary5,
            borderRadius: 8,
        },
        errorContainer: {
            marginBottom: 20,
        },
    });
});
//# sourceMappingURL=accept-t-and-c.js.map