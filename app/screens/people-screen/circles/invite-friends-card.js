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
import { useState } from "react";
import { Alert, Share, View } from "react-native";
import { gql } from "@apollo/client";
import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button";
import { InviteModal } from "@app/components/invite-modal";
import { PressableCard } from "@app/components/pressable-card";
import { getInviteLink } from "@app/config/appinfo";
import { useInviteQuery } from "@app/graphql/generated";
import { useI18nContext } from "@app/i18n/i18n-react";
import crashlytics from "@react-native-firebase/crashlytics";
import { makeStyles, Text } from "@rn-vui/themed";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  query invite {\n    me {\n      id\n      username\n    }\n  }\n"], ["\n  query invite {\n    me {\n      id\n      username\n    }\n  }\n"])));
export var InviteFriendsCard = function () {
    var styles = useStyles();
    var LL = useI18nContext().LL;
    var _a = useState(false), isInviteModalVisible = _a[0], setIsInviteModalVisible = _a[1];
    var data = useInviteQuery().data;
    var share = function () { return __awaiter(void 0, void 0, void 0, function () {
        var result, err_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, Share.share({ message: getInviteLink((_a = data === null || data === void 0 ? void 0 : data.me) === null || _a === void 0 ? void 0 : _a.username) })];
                case 1:
                    result = _b.sent();
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
                    err_1 = _b.sent();
                    if (err_1 instanceof Error) {
                        crashlytics().recordError(err_1);
                        Alert.alert(err_1.message);
                    }
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); };
    var openInviteModal = function () { return setIsInviteModalVisible(true); };
    return (<PressableCard onPress={openInviteModal}>
      <View style={styles.container}>
        <InviteModal isVisible={isInviteModalVisible} setIsVisible={setIsInviteModalVisible}/>
        <Text type="p1">{LL.Circles.inviteFriends()}</Text>
        <View style={styles.iconContainer}>
          <GaloyIconButton name="share" size="medium" iconOnly onPress={share}/>
          <GaloyIconButton name="qr-code" size="medium" iconOnly onPress={openInviteModal}/>
        </View>
      </View>
    </PressableCard>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        container: {
            backgroundColor: colors.grey5,
            display: "flex",
            flexDirection: "row",
            marginBottom: 20,
            borderRadius: 12,
            padding: 12,
            columnGap: 4,
            alignItems: "center",
            justifyContent: "space-between",
        },
        iconContainer: {
            display: "flex",
            flexDirection: "row",
            columnGap: 10,
        },
    });
});
var templateObject_1;
//# sourceMappingURL=invite-friends-card.js.map