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
import React, { useEffect } from "react";
import { Alert, View } from "react-native";
import { getReadableVersion } from "react-native-device-info";
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button";
import ContactModal, { SupportChannels, } from "@app/components/contact-modal/contact-modal";
import { Screen } from "@app/components/screen";
import { useAppConfig } from "@app/hooks";
import useLogout from "@app/hooks/use-logout";
import { useI18nContext } from "@app/i18n/i18n-react";
import { isIos } from "@app/utils/helper";
import crashlytics from "@react-native-firebase/crashlytics";
import { makeStyles, Text } from "@rn-vui/themed";
import HoneyBadgerShovel from "./honey-badger-shovel-01.svg";
export var ErrorScreen = function (_a) {
    var error = _a.error, resetError = _a.resetError;
    var _b = React.useState(false), isContactModalVisible = _b[0], setIsContactModalVisible = _b[1];
    var logout = useLogout().logout;
    var LL = useI18nContext().LL;
    var appConfig = useAppConfig().appConfig;
    var bankName = appConfig.galoyInstance.name;
    var styles = useStyles();
    useEffect(function () { return crashlytics().recordError(error); }, [error]);
    var resetApp = function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, logout()];
                case 1:
                    _a.sent();
                    resetError();
                    return [2 /*return*/];
            }
        });
    }); };
    var toggleIsContactModalVisible = function () {
        setIsContactModalVisible(!isContactModalVisible);
    };
    var contactMessageBody = LL.support.defaultSupportMessage({
        os: isIos ? "iOS" : "Android",
        version: getReadableVersion(),
        bankName: bankName,
    });
    var contactMessageSubject = LL.support.defaultEmailSubject({
        bankName: bankName,
    });
    return (<Screen preset="scroll" style={styles.screenStyle}>
      <View style={styles.imageContainer}>
        <HoneyBadgerShovel />
      </View>
      <Text type="p1">{LL.errors.fatalError()}</Text>
      <GaloyPrimaryButton title={LL.errors.showError()} onPress={function () { return Alert.alert(LL.common.error(), String(error)); }} containerStyle={styles.buttonContainer}/>
      <GaloyPrimaryButton title={LL.support.contactUs()} onPress={function () { return toggleIsContactModalVisible(); }} containerStyle={styles.buttonContainer}/>
      <GaloyPrimaryButton title={LL.common.tryAgain()} onPress={function () { return resetError(); }} containerStyle={styles.buttonContainer}/>
      <GaloyPrimaryButton title={LL.errors.clearAppData()} onPress={function () { return resetApp(); }} containerStyle={styles.buttonContainer}/>
      <ContactModal isVisible={isContactModalVisible} toggleModal={toggleIsContactModalVisible} messageBody={contactMessageBody} messageSubject={contactMessageSubject} supportChannels={[
            SupportChannels.Faq,
            SupportChannels.StatusPage,
            SupportChannels.Email,
            SupportChannels.Telegram,
            SupportChannels.Mattermost,
        ]}/>
    </Screen>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        buttonContainer: {
            marginTop: 20,
        },
        container: {
            flex: 1,
            flexDirection: "column",
            justifyContent: "center",
        },
        screenStyle: {
            flexGrow: 1,
            padding: 20,
        },
        imageContainer: {
            alignSelf: "center",
            backgroundColor: colors.grey3,
            padding: 20,
            borderRadius: 20,
            marginBottom: 20,
        },
    });
});
//# sourceMappingURL=error-screen.js.map