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
import axios, { isAxiosError } from "axios";
import * as React from "react";
import { View } from "react-native";
import validator from "validator";
import { GaloyErrorBox } from "@app/components/atomic/galoy-error-box";
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button";
import { useAppConfig } from "@app/hooks";
import { useI18nContext } from "@app/i18n/i18n-react";
import { testProps } from "@app/utils/testProps";
import { useNavigation } from "@react-navigation/native";
import { Input, Text, makeStyles } from "@rn-vui/themed";
import { Screen } from "../../components/screen";
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
            marginBottom: 10,
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
export var EmailLoginInitiateScreen = function () {
    var styles = useStyles();
    var authUrl = useAppConfig().appConfig.galoyInstance.authUrl;
    var navigation = useNavigation();
    var _a = React.useState(""), emailInput = _a[0], setEmailInput = _a[1];
    var _b = React.useState(""), errorMessage = _b[0], setErrorMessage = _b[1];
    var _c = React.useState(false), loading = _c[0], setLoading = _c[1];
    var updateInput = function (text) {
        setEmailInput(text);
        setErrorMessage("");
    };
    var LL = useI18nContext().LL;
    var submit = function () { return __awaiter(void 0, void 0, void 0, function () {
        var url, res, emailLoginId, err_1;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    if (!validator.isEmail(emailInput)) {
                        setErrorMessage(LL.EmailLoginInitiateScreen.invalidEmail());
                        return [2 /*return*/];
                    }
                    setLoading(true);
                    url = "".concat(authUrl, "/auth/email/code");
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, axios({
                            url: url,
                            method: "POST",
                            data: {
                                email: emailInput,
                            },
                        })
                        // TODO: manage error on ip rate limit
                        // TODO: manage error when trying the same email too often
                    ];
                case 2:
                    res = _d.sent();
                    emailLoginId = res.data.result;
                    if (emailLoginId) {
                        console.log({ emailLoginId: emailLoginId });
                        navigation.navigate("emailLoginValidate", { emailLoginId: emailLoginId, email: emailInput });
                    }
                    else {
                        console.warn("no flow returned");
                    }
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _d.sent();
                    console.error(err_1, "error in setEmailMutation");
                    if (isAxiosError(err_1)) {
                        console.log(err_1.message); // Gives you the basic error message
                        console.log((_a = err_1.response) === null || _a === void 0 ? void 0 : _a.data); // Gives you the response payload from the server
                        console.log((_b = err_1.response) === null || _b === void 0 ? void 0 : _b.status); // Gives you the HTTP status code
                        console.log((_c = err_1.response) === null || _c === void 0 ? void 0 : _c.headers); // Gives you the response headers
                        // If the request was made but no response was received
                        if (!err_1.response) {
                            console.log(err_1.request);
                        }
                        setErrorMessage(err_1.message);
                    }
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    return (<Screen preset="scroll" style={styles.screenStyle} keyboardOffset="navigationHeader" keyboardShouldPersistTaps="handled">
      <View style={styles.viewWrapper}>
        <View style={styles.textContainer}>
          <Text type={"h2"}>{LL.EmailLoginInitiateScreen.header()}</Text>
        </View>

        <View style={styles.inputContainer}>
          <Input {...testProps(LL.EmailRegistrationInitiateScreen.placeholder())} placeholder={LL.EmailRegistrationInitiateScreen.placeholder()} autoCapitalize="none" inputContainerStyle={styles.inputContainerStyle} renderErrorMessage={false} textContentType="emailAddress" keyboardType="email-address" value={emailInput} onChangeText={updateInput} autoFocus={true}/>
        </View>
        {errorMessage && (<View style={styles.errorContainer}>
            <GaloyErrorBox errorMessage={errorMessage}/>
          </View>)}

        <View style={styles.buttonsContainer}>
          <GaloyPrimaryButton title={LL.EmailLoginInitiateScreen.send()} loading={loading} disabled={!emailInput} onPress={submit}/>
        </View>
      </View>
    </Screen>);
};
//# sourceMappingURL=email-login-initiate.js.map