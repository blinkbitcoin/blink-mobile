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
import { Linking, Platform, Pressable, View } from "react-native";
import DeviceInfo from "react-native-device-info";
import ReactNativeModal from "react-native-modal";
import { gql } from "@apollo/client";
import { VersionComponent } from "@app/components/version";
import { APP_STORE_LINK, PLAY_STORE_LINK } from "@app/config";
import { useMobileUpdateQuery } from "@app/graphql/generated";
import { useI18nContext } from "@app/i18n/i18n-react";
import { Text, makeStyles, useTheme } from "@rn-vui/themed";
import { isIos } from "../../utils/helper";
import { GaloyPrimaryButton } from "../atomic/galoy-primary-button";
import { isUpdateAvailableOrRequired } from "./app-update.logic";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  query mobileUpdate {\n    mobileVersions {\n      platform\n      currentSupported\n      minSupported\n    }\n  }\n"], ["\n  query mobileUpdate {\n    mobileVersions {\n      platform\n      currentSupported\n      minSupported\n    }\n  }\n"])));
var useStyles = makeStyles(function () { return ({
    bottom: {
        alignItems: "center",
    },
    lightningText: {
        fontSize: 20,
        marginBottom: 12,
        textAlign: "center",
    },
    versionComponent: { flex: 1, justifyContent: "flex-end", marginVertical: 48 },
    main: { flex: 5, justifyContent: "center" },
    button: { marginVertical: 12 },
}); });
export var AppUpdate = function () {
    var styles = useStyles();
    var LL = useI18nContext().LL;
    var data = useMobileUpdateQuery({ fetchPolicy: "no-cache" }).data;
    var buildNumber = Number(DeviceInfo.getBuildNumber());
    var mobileVersions = data === null || data === void 0 ? void 0 : data.mobileVersions;
    var _a = isUpdateAvailableOrRequired({
        buildNumber: buildNumber,
        mobileVersions: mobileVersions,
        OS: Platform.OS,
    }), available = _a.available, required = _a.required;
    var openInStore = function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (isIos) {
                Linking.openURL(APP_STORE_LINK);
            }
            else {
                // TODO: differentiate between PlayStore and Huawei AppGallery
                Linking.openURL(PLAY_STORE_LINK);
            }
            return [2 /*return*/];
        });
    }); };
    var linkUpgrade = function () {
        return openInStore().catch(function (err) {
            console.log({ err: err }, "error app link on link");
        });
    };
    if (available) {
        return (<View style={styles.bottom}>
        <Pressable onPress={linkUpgrade}>
          <Text style={styles.lightningText}>{LL.HomeScreen.updateAvailable()}</Text>
        </Pressable>
      </View>);
    }
    return <AppUpdateModal isVisible={required} linkUpgrade={linkUpgrade}/>;
};
export var AppUpdateModal = function (_a) {
    var linkUpgrade = _a.linkUpgrade, isVisible = _a.isVisible;
    var colors = useTheme().theme.colors;
    var LL = useI18nContext().LL;
    var styles = useStyles();
    return (<ReactNativeModal isVisible={isVisible} backdropColor={colors.white} backdropOpacity={0.92}>
      <View style={styles.main}>
        <Text style={styles.lightningText}>{LL.AppUpdate.versionNotSupported()}</Text>
        <Text style={styles.lightningText}>{LL.AppUpdate.updateMandatory()}</Text>
        <GaloyPrimaryButton buttonStyle={styles.button} onPress={linkUpgrade} title={LL.AppUpdate.tapHereUpdate()}/>
      </View>
      <View style={styles.versionComponent}>
        <VersionComponent />
      </View>
    </ReactNativeModal>);
};
var templateObject_1;
//# sourceMappingURL=app-update.js.map