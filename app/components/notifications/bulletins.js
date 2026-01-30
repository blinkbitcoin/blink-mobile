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
import React from "react";
import { Linking } from "react-native";
import { useNotifications } from ".";
import { NotificationCardUI } from "./notification-card-ui";
import { BulletinsDocument, useStatefulNotificationAcknowledgeMutation, } from "@app/graphql/generated";
import { BLINK_DEEP_LINK_PREFIX } from "@app/config";
export var BulletinsCard = function (_a) {
    var _b, _c, _d, _e, _f, _g;
    var loading = _a.loading, bulletins = _a.bulletins;
    var cardInfo = useNotifications().cardInfo;
    var _h = useStatefulNotificationAcknowledgeMutation({
        refetchQueries: [BulletinsDocument],
    }), ack = _h[0], ackLoading = _h[1].loading;
    if (loading)
        return null;
    if (bulletins &&
        ((_c = (_b = bulletins.me) === null || _b === void 0 ? void 0 : _b.unacknowledgedStatefulNotificationsWithBulletinEnabled) === null || _c === void 0 ? void 0 : _c.edges) &&
        ((_e = (_d = bulletins.me) === null || _d === void 0 ? void 0 : _d.unacknowledgedStatefulNotificationsWithBulletinEnabled) === null || _e === void 0 ? void 0 : _e.edges.length) > 0) {
        return (<>
        {(_g = (_f = bulletins.me) === null || _f === void 0 ? void 0 : _f.unacknowledgedStatefulNotificationsWithBulletinEnabled) === null || _g === void 0 ? void 0 : _g.edges.map(function (_a) {
                var bulletin = _a.node;
                return (<NotificationCardUI icon={bulletin.icon
                        ? bulletin.icon.toLowerCase().replace("_", "-")
                        : undefined} key={bulletin.id} title={bulletin.title} text={bulletin.body} action={function () { return __awaiter(void 0, void 0, void 0, function () {
                        var _a, _b;
                        return __generator(this, function (_c) {
                            ack({ variables: { input: { notificationId: bulletin.id } } });
                            if (((_a = bulletin.action) === null || _a === void 0 ? void 0 : _a.__typename) === "OpenDeepLinkAction")
                                Linking.openURL(BLINK_DEEP_LINK_PREFIX + bulletin.action.deepLink);
                            else if (((_b = bulletin.action) === null || _b === void 0 ? void 0 : _b.__typename) === "OpenExternalLinkAction")
                                Linking.openURL(bulletin.action.url);
                            return [2 /*return*/];
                        });
                    }); }} dismissAction={function () {
                        return ack({ variables: { input: { notificationId: bulletin.id } } });
                    }} loading={ackLoading}/>);
            })}
      </>);
    }
    if (!cardInfo) {
        return null;
    }
    return (<NotificationCardUI title={cardInfo.title} text={cardInfo.text} icon={cardInfo.icon} action={cardInfo.action} loading={cardInfo.loading} dismissAction={cardInfo.dismissAction}/>);
};
//# sourceMappingURL=bulletins.js.map