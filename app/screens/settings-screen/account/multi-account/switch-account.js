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
import React, { useState, useEffect } from "react";
import { useNavigation } from "@react-navigation/native";
import { makeStyles } from "@rn-vui/themed";
import { Screen } from "@app/components/screen";
import { useI18nContext } from "@app/i18n/i18n-react";
import { useAppConfig, useSaveSessionProfile } from "@app/hooks";
import { ProfileScreen } from "./profile";
import { fetchProfiles } from "./utils";
import { ScrollView, View } from "react-native";
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button";
export var SwitchAccount = function () {
    var styles = useStyles();
    var LL = useI18nContext().LL;
    var currentToken = useAppConfig().appConfig.token;
    var saveProfile = useSaveSessionProfile().saveProfile;
    var navigation = useNavigation();
    var _a = useState([]), profiles = _a[0], setProfiles = _a[1];
    var _b = useState(), nextProfileToken = _b[0], setNextProfileToken = _b[1];
    useEffect(function () {
        if (!currentToken)
            return;
        var isMounted = true;
        var loadProfiles = function () { return __awaiter(void 0, void 0, void 0, function () {
            var profilesList;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, fetchProfiles(currentToken)];
                    case 1:
                        profilesList = _b.sent();
                        if (!(profilesList.length === 0)) return [3 /*break*/, 4];
                        return [4 /*yield*/, saveProfile(currentToken)];
                    case 2:
                        _b.sent();
                        return [4 /*yield*/, fetchProfiles(currentToken)];
                    case 3:
                        profilesList = _b.sent();
                        _b.label = 4;
                    case 4:
                        if (isMounted) {
                            setProfiles(profilesList);
                            setNextProfileToken((_a = profilesList.find(function (profile) { return !profile.selected; })) === null || _a === void 0 ? void 0 : _a.token);
                        }
                        return [2 /*return*/];
                }
            });
        }); };
        loadProfiles();
        return function () {
            isMounted = false;
        };
    }, [saveProfile, currentToken]);
    var handleAddNew = function () {
        navigation.navigate("getStarted");
    };
    return (<Screen keyboardShouldPersistTaps="handled">
      <ScrollView contentContainerStyle={styles.outer}>
        {profiles.map(function (profile, index) { return (<ProfileScreen key={profile.accountId || profile.userId || index} {...profile} isFirstItem={index === 0} nextProfileToken={nextProfileToken}/>); })}
      </ScrollView>
      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton onPress={handleAddNew} title={LL.ProfileScreen.addAccount()}/>
      </View>
    </Screen>);
};
export var useStyles = makeStyles(function () { return ({
    outer: {
        marginTop: 4,
        paddingBottom: 20,
        flexDirection: "column",
    },
    buttonsContainer: {
        justifyContent: "flex-end",
        marginBottom: 14,
        marginHorizontal: 20,
    },
}); });
//# sourceMappingURL=switch-account.js.map