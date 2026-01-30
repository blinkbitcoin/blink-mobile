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
import { Alert, Platform, Share, TouchableOpacity, View, useWindowDimensions, } from "react-native";
import Modal from "react-native-modal";
import QRCode from "react-native-qrcode-svg";
import Icon from "react-native-vector-icons/Ionicons";
import { gql } from "@apollo/client";
import Logo from "@app/assets/logo/blink-logo-icon.png";
import { getInviteLink } from "@app/config/appinfo";
import { useInviteQuery } from "@app/graphql/generated";
import { useI18nContext } from "@app/i18n/i18n-react";
import { toastShow } from "@app/utils/toast";
import Clipboard from "@react-native-clipboard/clipboard";
import crashlytics from "@react-native-firebase/crashlytics";
import { useNavigation } from "@react-navigation/native";
import { makeStyles, useTheme, Text } from "@rn-vui/themed";
import { GaloyIconButton } from "../atomic/galoy-icon-button";
import { GaloyToast } from "../galoy-toast";
import { PressableCard } from "../pressable-card";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  query invite {\n    me {\n      id\n      username\n    }\n  }\n"], ["\n  query invite {\n    me {\n      id\n      username\n    }\n  }\n"])));
export var InviteModal = function (_a) {
    var _b;
    var isVisible = _a.isVisible, setIsVisible = _a.setIsVisible;
    var LL = useI18nContext().LL;
    var data = useInviteQuery().data;
    var colors = useTheme().theme.colors;
    var styles = useStyles();
    var navigation = useNavigation();
    var acknowledgeModal = function () {
        setIsVisible(false);
    };
    var scale = useWindowDimensions().scale;
    var getQrSize = function () {
        if (Platform.OS === "android") {
            if (scale > 3) {
                return 195;
            }
        }
        return 280;
    };
    var inviteLink = getInviteLink((_b = data === null || data === void 0 ? void 0 : data.me) === null || _b === void 0 ? void 0 : _b.username);
    var copyToClipboard = function () {
        Clipboard.setString(inviteLink);
        toastShow({
            type: "success",
            message: LL.Circles.copiedInviteLink(),
            LL: LL,
        });
    };
    var share = function () { return __awaiter(void 0, void 0, void 0, function () {
        var result, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, Share.share({ message: inviteLink })];
                case 1:
                    result = _a.sent();
                    if (result.action === Share.sharedAction) {
                        if (result.activityType) {
                            // shared with activity type of result.activityType
                        }
                        else {
                            // shared
                        }
                    }
                    else if (result.action === Share.dismissedAction) {
                        // dismissed
                    }
                    return [3 /*break*/, 3];
                case 2:
                    err_1 = _a.sent();
                    if (err_1 instanceof Error) {
                        crashlytics().recordError(err_1);
                        Alert.alert(err_1.message);
                    }
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); };
    return (<Modal isVisible={isVisible} backdropOpacity={0.8} backdropColor={colors.white} backdropTransitionOutTiming={0} onBackdropPress={acknowledgeModal}>
      <View style={styles.modalCard}>
        <View style={styles.container}>
          <View style={styles.cardTitleContainer}>
            <Text type="h1" bold>
              {LL.Circles.inviteFriendToBlink()}
            </Text>
            <View style={styles.cross}>
              <GaloyIconButton name="close" size="medium" onPress={acknowledgeModal}/>
            </View>
          </View>
          <PressableCard onPress={copyToClipboard}>
            <View style={styles.qrCard}>
              <QRCode size={getQrSize()} value={inviteLink} logoBackgroundColor="white" ecl={"M"} logo={Logo} logoSize={60} logoBorderRadius={10}/>
            </View>
          </PressableCard>

          <View style={styles.qrMetadata}>
            <Text type="p3">{inviteLink}</Text>
          </View>

          <View style={styles.actions}>
            <View style={styles.copyContainer}>
              <TouchableOpacity onPress={copyToClipboard}>
                <Text color={colors.grey2}>
                  <Icon color={colors.grey2} name="copy-outline"/>
                  <Text> </Text>
                  {LL.PeopleScreen.copy()}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.shareContainer}>
              <TouchableOpacity onPress={share}>
                <Text color={colors.grey2}>
                  <Icon color={colors.grey2} name="share-outline"/>
                  <Text> </Text>
                  {LL.Circles.share()}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.cardBodyContainer}>
            <Text type="p2" style={styles.textCenter}>
              {LL.Circles.circlesGrowingSatsExplainer.your()}{" "}
              <Text style={styles.underline} onPress={function () {
            setIsVisible(false);
            navigation.navigate("circlesDashboard");
        }}>
                {LL.Circles.titleBlinkCircles()}
              </Text>{" "}
              {LL.Circles.circlesGrowingSatsExplainer.grow()}
            </Text>
          </View>
        </View>
      </View>
      <GaloyToast />
    </Modal>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        container: {
            paddingHorizontal: 12,
            display: "flex",
            flexDirection: "column",
            rowGap: 20,
            justifyContent: "center",
            alignItems: "center",
        },
        cross: {},
        qrCard: {
            backgroundColor: colors._white,
            padding: 20,
            borderRadius: 12,
        },
        modalCard: {
            backgroundColor: colors.grey5,
            borderRadius: 16,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            paddingTop: 30,
        },
        cardTitleContainer: {
            flexDirection: "row",
            justifyContent: "space-evenly",
            width: "100%",
            alignItems: "center",
            columnGap: 20,
        },
        cardBodyContainer: {
            marginBottom: 16,
            paddingHorizontal: 20,
        },
        textCenter: {
            textAlign: "center",
        },
        qrMetadata: {
            marginTop: -10,
        },
        actions: {
            marginTop: -10,
            flexDirection: "row",
            justifyContent: "center",
            minHeight: 20,
        },
        copyContainer: {
            flex: 2,
            marginLeft: 10,
        },
        shareContainer: {
            flex: 2,
            alignItems: "flex-end",
            marginRight: 10,
        },
        underline: {
            textDecorationLine: "underline",
        },
    });
});
var templateObject_1;
//# sourceMappingURL=invite-modal.js.map