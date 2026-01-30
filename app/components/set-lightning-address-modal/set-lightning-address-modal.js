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
import React, { useState } from "react";
import { View, TextInput } from "react-native";
import { gql } from "@apollo/client";
import { useAppConfig, useSaveSessionProfile } from "@app/hooks";
import { useI18nContext } from "@app/i18n/i18n-react";
import { Text, makeStyles, useTheme } from "@rn-vui/themed";
import { useUserUpdateUsernameMutation, MyUserIdDocument, } from "../../graphql/generated";
import { GaloyErrorBox } from "../atomic/galoy-error-box";
import CustomModal from "../custom-modal/custom-modal";
import { SetUsernameError, validateUsername } from "./username-validation";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  mutation userUpdateUsername($input: UserUpdateUsernameInput!) {\n    userUpdateUsername(input: $input) {\n      errors {\n        code\n      }\n      user {\n        id\n        username\n      }\n    }\n  }\n"], ["\n  mutation userUpdateUsername($input: UserUpdateUsernameInput!) {\n    userUpdateUsername(input: $input) {\n      errors {\n        code\n      }\n      user {\n        id\n        username\n      }\n    }\n  }\n"])));
gql(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n  query myUserId {\n    me {\n      id\n    }\n  }\n"], ["\n  query myUserId {\n    me {\n      id\n    }\n  }\n"])));
export var SetLightningAddressModal = function (_a) {
    var isVisible = _a.isVisible, toggleModal = _a.toggleModal;
    var _b = useState(), error = _b[0], setError = _b[1];
    var _c = useState(""), lnAddress = _c[0], setLnAddress = _c[1];
    var updateCurrentProfile = useSaveSessionProfile().updateCurrentProfile;
    var onChangeLnAddress = function (lightningAddress) {
        setLnAddress(lightningAddress);
        setError(undefined);
    };
    var _d = useUserUpdateUsernameMutation({
        update: function (cache, _a) {
            var _b, _c;
            var data = _a.data;
            if ((_b = data === null || data === void 0 ? void 0 : data.userUpdateUsername) === null || _b === void 0 ? void 0 : _b.user) {
                var userIdQuery = cache.readQuery({
                    query: MyUserIdDocument,
                });
                var userId = (_c = userIdQuery.me) === null || _c === void 0 ? void 0 : _c.id;
                if (userId) {
                    cache.modify({
                        id: cache.identify({
                            id: userId,
                            __typename: "User",
                        }),
                        fields: {
                            username: function () {
                                return lnAddress;
                            },
                        },
                    });
                }
            }
        },
    }), updateUsername = _d[0], loading = _d[1].loading;
    var onSetLightningAddress = function () { return __awaiter(void 0, void 0, void 0, function () {
        var validationResult, data;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    validationResult = validateUsername(lnAddress);
                    if (!validationResult.valid) {
                        setError(validationResult.error);
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, updateUsername({
                            variables: {
                                input: {
                                    username: lnAddress,
                                },
                            },
                        })];
                case 1:
                    data = (_e.sent()).data;
                    if (((_b = (_a = data === null || data === void 0 ? void 0 : data.userUpdateUsername) === null || _a === void 0 ? void 0 : _a.errors) !== null && _b !== void 0 ? _b : []).length > 0) {
                        if (((_d = (_c = data === null || data === void 0 ? void 0 : data.userUpdateUsername) === null || _c === void 0 ? void 0 : _c.errors[0]) === null || _d === void 0 ? void 0 : _d.code) === "USERNAME_ERROR") {
                            setError(SetUsernameError.ADDRESS_UNAVAILABLE);
                        }
                        else {
                            setError(SetUsernameError.UNKNOWN_ERROR);
                        }
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, updateCurrentProfile()];
                case 2:
                    _e.sent();
                    toggleModal();
                    return [2 /*return*/];
            }
        });
    }); };
    return (<SetLightningAddressModalUI isVisible={isVisible} toggleModal={toggleModal} error={error} lnAddress={lnAddress} loading={loading} setLnAddress={onChangeLnAddress} onSetLightningAddress={onSetLightningAddress}/>);
};
export var SetLightningAddressModalUI = function (_a) {
    var isVisible = _a.isVisible, toggleModal = _a.toggleModal, onSetLightningAddress = _a.onSetLightningAddress, lnAddress = _a.lnAddress, setLnAddress = _a.setLnAddress, loading = _a.loading, error = _a.error;
    var _b = useAppConfig().appConfig.galoyInstance, lnAddressHostname = _b.lnAddressHostname, bankName = _b.name;
    var colors = useTheme().theme.colors;
    var LL = useI18nContext().LL;
    var styles = useStyles();
    var setLightningAddress = function () {
        onSetLightningAddress();
    };
    var errorMessage = "";
    switch (error) {
        case SetUsernameError.TOO_SHORT:
            errorMessage = LL.SetAddressModal.Errors.tooShort();
            break;
        case SetUsernameError.TOO_LONG:
            errorMessage = LL.SetAddressModal.Errors.tooLong();
            break;
        case SetUsernameError.INVALID_CHARACTER:
            errorMessage = LL.SetAddressModal.Errors.invalidCharacter();
            break;
        case SetUsernameError.ADDRESS_UNAVAILABLE:
            errorMessage = LL.SetAddressModal.Errors.addressUnavailable();
            break;
        case SetUsernameError.UNKNOWN_ERROR:
            errorMessage = LL.SetAddressModal.Errors.unknownError();
            break;
    }
    return (<CustomModal title={LL.SetAddressModal.setLightningAddress()} minHeight={380} toggleModal={toggleModal} isVisible={isVisible} primaryButtonTitle={LL.SetAddressModal.setLightningAddress()} primaryButtonLoading={loading} primaryButtonOnPress={setLightningAddress} primaryButtonDisabled={!lnAddress} body={<View style={styles.bodyStyle}>
          <View style={styles.textInputContainerStyle}>
            <TextInput autoCorrect={false} autoComplete="off" style={styles.textInputStyle} onChangeText={setLnAddress} value={lnAddress} placeholder={"SatoshiNakamoto"} placeholderTextColor={colors.grey3}/>
            <Text type={"p1"}>{"@".concat(lnAddressHostname)}</Text>
          </View>
          {errorMessage && <GaloyErrorBox errorMessage={errorMessage}/>}
          <Text type={"p1"} style={styles.centerAlign}>
            {LL.SetAddressModal.receiveMoney({ bankName: bankName })}
            <Text color={colors.warning} bold={true}>
              {" "}
              {LL.SetAddressModal.itCannotBeChanged()}
            </Text>
          </Text>
        </View>}/>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        bodyStyle: {
            display: "flex",
            flexDirection: "column",
            flexGrow: 1,
            alignItems: "stretch",
            rowGap: 20,
        },
        textInputContainerStyle: {
            display: "flex",
            flexDirection: "row",
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 8,
            minHeight: 60,
            backgroundColor: colors.grey4,
            alignItems: "center",
            justifyContent: "space-between",
        },
        textInputStyle: {
            paddingTop: 0,
            paddingBottom: 0,
            flex: 1,
            textAlignVertical: "center",
            fontSize: 18,
            lineHeight: 24,
            color: colors.black,
        },
        centerAlign: {
            textAlign: "center",
        },
    });
});
var templateObject_1, templateObject_2;
//# sourceMappingURL=set-lightning-address-modal.js.map