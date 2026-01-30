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
import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import { ListItem, makeStyles, Overlay, useTheme, Text } from "@rn-vui/themed";
import Icon from "react-native-vector-icons/Ionicons";
import { useI18nContext } from "@app/i18n/i18n-react";
import { useNavigation } from "@react-navigation/native";
import { useState } from "react";
import { useAppConfig } from "@app/hooks";
import { testProps } from "@app/utils/testProps";
import useLogout from "@app/hooks/use-logout";
import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button/galoy-icon-button";
import Modal from "react-native-modal";
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button";
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button";
import { toastShow } from "@app/utils/toast";
export var ProfileScreen = function (_a) {
    var identifier = _a.identifier, token = _a.token, nextProfileToken = _a.nextProfileToken, selected = _a.selected, isFirstItem = _a.isFirstItem, hasUsername = _a.hasUsername, lnAddressHostname = _a.lnAddressHostname;
    var colors = useTheme().theme.colors;
    var styles = useStyles();
    var LL = useI18nContext().LL;
    var navigation = useNavigation();
    var _b = useState(false), switchLoading = _b[0], setSwitchLoading = _b[1];
    var _c = useState(false), logoutLoading = _c[0], setLogoutLoading = _c[1];
    var _d = useState(false), modalVisible = _d[0], setModalVisible = _d[1];
    var saveToken = useAppConfig().saveToken;
    var logout = useLogout().logout;
    var handleProfileSwitch = function (nextToken) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setSwitchLoading(true);
                    return [4 /*yield*/, saveToken(nextToken || token)];
                case 1:
                    _a.sent();
                    setSwitchLoading(false);
                    toastShow({
                        type: "success",
                        message: LL.ProfileScreen.switchAccount(),
                        LL: LL,
                    });
                    navigation.navigate("Primary");
                    return [2 /*return*/];
            }
        });
    }); };
    var handleLogout = function () { return __awaiter(void 0, void 0, void 0, function () {
        var shouldSwitchProfile, shouldLogoutAndReset;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    closeModal();
                    setLogoutLoading(true);
                    shouldSwitchProfile = selected && nextProfileToken;
                    shouldLogoutAndReset = selected && !nextProfileToken;
                    if (!shouldSwitchProfile) return [3 /*break*/, 3];
                    return [4 /*yield*/, logout({ stateToDefault: false, token: token })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, handleProfileSwitch(nextProfileToken)];
                case 2:
                    _a.sent();
                    toastShow({
                        type: "success",
                        message: LL.ProfileScreen.removedAccount({ identifier: identifier }),
                        LL: LL,
                    });
                    return [2 /*return*/];
                case 3:
                    if (!shouldLogoutAndReset) return [3 /*break*/, 5];
                    return [4 /*yield*/, logout()];
                case 4:
                    _a.sent();
                    navigation.reset({
                        index: 0,
                        routes: [{ name: "getStarted" }],
                    });
                    return [2 /*return*/];
                case 5: return [4 /*yield*/, logout({ stateToDefault: false, token: token })];
                case 6:
                    _a.sent();
                    navigation.navigate("Primary");
                    return [2 /*return*/];
            }
        });
    }); };
    var closeModal = function () {
        setModalVisible(false);
    };
    var openModal = function () {
        setModalVisible(true);
    };
    var logoutModal = (<Modal animationOut="fadeOut" animationIn="fadeIn" isVisible={modalVisible} onBackdropPress={closeModal} backdropColor={colors.white} avoidKeyboard={true} backdropTransitionOutTiming={0}>
      <View style={styles.modalView}>
        <View style={styles.modalText}>
          <Text type="h1" bold>
            {LL.common.logout()}
          </Text>
          <Text type="h1" bold>
            {hasUsername ? "".concat(identifier, "@").concat(lnAddressHostname) : identifier}
          </Text>
          <Text type="h1" bold>
            {LL.ProfileScreen.fromThisDevice()}
          </Text>
        </View>
        <View style={styles.actionButtons}>
          <GaloyPrimaryButton title={LL.common.confirm()} onPress={function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, handleLogout()];
                    case 1:
                        _a.sent();
                        setLogoutLoading(false);
                        return [2 /*return*/];
                }
            });
        }); }}/>
          <GaloySecondaryButton title={LL.common.cancel()} onPress={closeModal}/>
        </View>
      </View>
    </Modal>);
    return (<>
      <TouchableOpacity onPress={function () { return handleProfileSwitch(); }} {...testProps(LL.AccountScreen.switchAccount())}>
        <ListItem bottomDivider containerStyle={[styles.listStyle, isFirstItem && styles.firstItem]}>
          {selected ? (<Icon name="checkmark-circle-outline" size={20} color={colors._green}/>) : (<View style={styles.spacerStyle}/>)}
          <ListItem.Content>
            <ListItem.Title>
              {hasUsername ? "".concat(identifier, "@").concat(lnAddressHostname) : identifier}
            </ListItem.Title>
          </ListItem.Content>
          {logoutLoading ? (<ActivityIndicator size="small" color={colors.primary}/>) : (<GaloyIconButton name="close" size="small" onPress={openModal} backgroundColor={colors.grey4}/>)}
        </ListItem>
      </TouchableOpacity>
      <Overlay isVisible={switchLoading} overlayStyle={styles.overlayStyle}>
        <ActivityIndicator size={50} color={colors.primary}/>
        <Text>{LL.AccountScreen.pleaseWait()}</Text>
      </Overlay>
      {logoutModal}
    </>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        listStyle: {
            borderBottomWidth: 2,
            borderColor: colors.grey5,
            backgroundColor: colors.white,
        },
        firstItem: {
            marginTop: 0,
            borderTopWidth: 2,
        },
        overlayStyle: {
            backgroundColor: "transparent",
            shadowColor: "transparent",
        },
        spacerStyle: {
            width: 20,
        },
        modalView: {
            marginHorizontal: 20,
            backgroundColor: colors.grey5,
            padding: 20,
            borderRadius: 20,
            display: "flex",
            flexDirection: "column",
            rowGap: 20,
        },
        actionButtons: {
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
        },
        modalText: {
            display: "flex",
            flexDirection: "column",
            rowGap: 2,
        },
    });
});
//# sourceMappingURL=profile.js.map