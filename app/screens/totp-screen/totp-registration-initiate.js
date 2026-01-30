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
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { gql } from "@apollo/client";
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button";
import { Screen } from "@app/components/screen";
import { CopySecretComponent, QrCodeComponent } from "@app/components/totp-export";
import { useTotpRegistrationScreenQuery, useUserTotpRegistrationInitiateMutation, } from "@app/graphql/generated";
import { useAppConfig } from "@app/hooks";
import { useI18nContext } from "@app/i18n/i18n-react";
import { useNavigation } from "@react-navigation/native";
import { makeStyles } from "@rn-vui/base";
import { Text, useTheme } from "@rn-vui/themed";
var generateOtpAuthURI = function (accountName, issuer, secret) {
    var encodedAccount = encodeURIComponent(accountName);
    var encodedIssuer = encodeURIComponent(issuer);
    var base = "otpauth://totp/".concat(issuer, ":").concat(encodedAccount, "?");
    var params = "secret=".concat(secret, "&issuer=").concat(encodedIssuer);
    return base + params;
};
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  query totpRegistrationScreen {\n    me {\n      id\n      username\n    }\n  }\n\n  mutation userTotpRegistrationInitiate {\n    userTotpRegistrationInitiate {\n      errors {\n        message\n      }\n      totpRegistrationId\n      totpSecret\n    }\n  }\n"], ["\n  query totpRegistrationScreen {\n    me {\n      id\n      username\n    }\n  }\n\n  mutation userTotpRegistrationInitiate {\n    userTotpRegistrationInitiate {\n      errors {\n        message\n      }\n      totpRegistrationId\n      totpSecret\n    }\n  }\n"])));
export var TotpRegistrationInitiateScreen = function () {
    var _a;
    var navigation = useNavigation();
    var totpRegistrationInitiate = useUserTotpRegistrationInitiateMutation()[0];
    var LL = useI18nContext().LL;
    var colors = useTheme().theme.colors;
    var styles = useStyles();
    var data = useTotpRegistrationScreenQuery().data;
    var username = ((_a = data === null || data === void 0 ? void 0 : data.me) === null || _a === void 0 ? void 0 : _a.username) || "blink";
    var _b = useState(""), secret = _b[0], setSecret = _b[1];
    var _c = useState(true), isLoading = _c[0], setIsLoading = _c[1];
    var _d = useState(""), totpRegistrationId = _d[0], setTotpRegistrationId = _d[1];
    var appConfig = useAppConfig().appConfig;
    var service = appConfig.galoyInstance.name;
    var otpauth = generateOtpAuthURI(username, service, secret);
    useEffect(function () {
        var fn = function () { return __awaiter(void 0, void 0, void 0, function () {
            var res;
            var _a, _b, _c, _d, _e, _f, _g;
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0: return [4 /*yield*/, totpRegistrationInitiate()];
                    case 1:
                        res = _h.sent();
                        if ((_b = (_a = res.data) === null || _a === void 0 ? void 0 : _a.userTotpRegistrationInitiate) === null || _b === void 0 ? void 0 : _b.totpRegistrationId) {
                            setTotpRegistrationId((_d = (_c = res.data) === null || _c === void 0 ? void 0 : _c.userTotpRegistrationInitiate) === null || _d === void 0 ? void 0 : _d.totpRegistrationId);
                        }
                        else {
                            Alert.alert(LL.common.error());
                            return [2 /*return*/];
                        }
                        if ((_f = (_e = res.data) === null || _e === void 0 ? void 0 : _e.userTotpRegistrationInitiate) === null || _f === void 0 ? void 0 : _f.totpSecret) {
                            setSecret((_g = res.data) === null || _g === void 0 ? void 0 : _g.userTotpRegistrationInitiate.totpSecret);
                        }
                        else {
                            Alert.alert(LL.common.error());
                            return [2 /*return*/];
                        }
                        setIsLoading(false);
                        return [2 /*return*/];
                }
            });
        }); };
        fn();
    }, [totpRegistrationInitiate, LL]);
    return (<Screen>
      {isLoading ? (<View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size={"large"}/>
        </View>) : (<>
          <View style={styles.centeredContent}>
            <QrCodeComponent otpauth={otpauth}/>
          </View>
          <CopySecretComponent secret={secret}/>
          <Text style={styles.textStyle} type="p2">
            {LL.TotpRegistrationInitiateScreen.content()}
          </Text>

          <View style={styles.buttonsContainer}>
            <GaloyPrimaryButton containerStyle={styles.buttonContainer} title={LL.common.next()} onPress={function () {
                return navigation.navigate("totpRegistrationValidate", { totpRegistrationId: totpRegistrationId });
            }}/>
          </View>
        </>)}
    </Screen>);
};
var useStyles = makeStyles(function () { return ({
    loadingContainer: {
        justifyContent: "center",
        alignItems: "center",
        flex: 1,
    },
    centeredContent: {
        padding: 20,
        justifyContent: "center",
        alignItems: "center",
    },
    textStyle: {
        textAlign: "center",
        marginTop: 20,
        marginHorizontal: 20,
    },
    buttonContainer: {
        marginTop: 20,
    },
    buttonsContainer: {
        flex: 1,
        justifyContent: "flex-end",
        marginBottom: 14,
        paddingHorizontal: 20,
        paddingBottom: 20,
        zIndex: 2,
    },
}); });
var templateObject_1;
//# sourceMappingURL=totp-registration-initiate.js.map