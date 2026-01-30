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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import React, { useState, createContext, useContext, useCallback, useMemo } from "react";
import { Text, makeStyles, useTheme } from "@rn-vui/themed";
import { GaloyIcon } from "../atomic/galoy-icon";
import CustomModal from "../custom-modal/custom-modal";
export var NotificationModalContext = createContext({
    notifyModal: function () { },
    notifyCard: function () { },
    cardInfo: undefined,
});
export var NotificationsProvider = function (_a) {
    var children = _a.children;
    var _b = useState([]), modalNotifications = _b[0], setModalNotifications = _b[1];
    var _c = useState(false), modalPrimaryIsLoading = _c[0], setModalPrimaryIsLoading = _c[1];
    var _d = useState(false), modalSecondaryIsLoading = _d[0], setModalSecondaryIsLoading = _d[1];
    var _e = useState([]), cardNotifications = _e[0], setCardNotifications = _e[1];
    var _f = useState(false), cardIsLoading = _f[0], setCardIsLoading = _f[1];
    var colors = useTheme().theme.colors;
    var styles = useStyles();
    var notifyModal = useCallback(function (args) {
        setModalNotifications(function (notifications) { return __spreadArray(__spreadArray([], notifications, true), [args], false); });
    }, [setModalNotifications]);
    var dismissModal = useCallback(function () {
        setModalNotifications(function (notifications) { return notifications.slice(1); });
    }, [setModalNotifications]);
    var notifyCard = useCallback(function (args) {
        setCardNotifications(function (notifications) { return __spreadArray(__spreadArray([], notifications, true), [args], false); });
    }, [setCardNotifications]);
    var dismissCard = useCallback(function () {
        setCardNotifications(function (notifications) { return notifications.slice(1); });
    }, [setCardNotifications]);
    var activeCard = cardNotifications[0];
    var activeNotification = modalNotifications[0];
    var modalInfo = useMemo(function () {
        if (!activeNotification) {
            return null;
        }
        var toggleModal = function () {
            dismissModal();
            if (activeNotification.dismissAction) {
                activeNotification.dismissAction();
            }
        };
        var primaryButtonAction = function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!activeNotification.primaryButtonAction) return [3 /*break*/, 2];
                        setModalPrimaryIsLoading(true);
                        return [4 /*yield*/, activeNotification.primaryButtonAction()];
                    case 1:
                        _a.sent();
                        setModalPrimaryIsLoading(false);
                        _a.label = 2;
                    case 2:
                        dismissModal();
                        return [2 /*return*/];
                }
            });
        }); };
        var secondaryButtonAction = function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!activeNotification.secondaryButtonAction) return [3 /*break*/, 2];
                        setModalSecondaryIsLoading(true);
                        return [4 /*yield*/, activeNotification.secondaryButtonAction()];
                    case 1:
                        _a.sent();
                        setModalSecondaryIsLoading(false);
                        _a.label = 2;
                    case 2:
                        dismissModal();
                        return [2 /*return*/];
                }
            });
        }); };
        return {
            title: activeNotification.title,
            isVisible: Boolean(activeNotification),
            toggleModal: toggleModal,
            showCloseIcon: Boolean(activeNotification.dismissAction),
            primaryButtonTitle: activeNotification.primaryButtonTitle,
            primaryButtonAction: primaryButtonAction,
            secondaryButtonTitle: activeNotification.secondaryButtonTitle,
            secondaryButtonAction: secondaryButtonAction,
            text: activeNotification.text,
            icon: activeNotification.icon,
        };
    }, [
        activeNotification,
        dismissModal,
        setModalPrimaryIsLoading,
        setModalSecondaryIsLoading,
    ]);
    var cardInfo = useMemo(function () {
        if (!activeCard) {
            return undefined;
        }
        var action = function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        setCardIsLoading(true);
                        return [4 /*yield*/, activeCard.action()];
                    case 1:
                        _a.sent();
                        dismissCard();
                        setCardIsLoading(false);
                        return [2 /*return*/];
                }
            });
        }); };
        var dismissAction = function () {
            dismissCard();
            if (activeCard.dismissAction) {
                activeCard.dismissAction();
            }
        };
        return {
            title: activeCard.title,
            text: activeCard.text,
            icon: activeCard.icon,
            action: action,
            loading: cardIsLoading,
            dismissAction: dismissAction,
        };
    }, [activeCard, dismissCard, cardIsLoading]);
    return (<NotificationModalContext.Provider value={{
            notifyModal: notifyModal,
            notifyCard: notifyCard,
            cardInfo: cardInfo,
        }}>
      {children}

      {modalInfo && (<CustomModal isVisible={modalInfo.isVisible} toggleModal={modalInfo.toggleModal} title={modalInfo.title} showCloseIconButton={modalInfo.showCloseIcon} primaryButtonTitle={modalInfo.primaryButtonTitle} primaryButtonOnPress={modalInfo.primaryButtonAction} primaryButtonLoading={modalPrimaryIsLoading} secondaryButtonOnPress={modalInfo.secondaryButtonAction} secondaryButtonTitle={modalInfo.secondaryButtonTitle} secondaryButtonLoading={modalSecondaryIsLoading} image={modalInfo.icon && (<GaloyIcon name={modalInfo.icon} size={100} color={colors.primary3}/>)} body={<Text type="h2" style={styles.bodyText}>
              {modalInfo.text}
            </Text>}/>)}
    </NotificationModalContext.Provider>);
};
var useStyles = makeStyles(function () { return ({
    bodyText: {
        textAlign: "center",
    },
}); });
export var useNotifications = function () { return useContext(NotificationModalContext); };
//# sourceMappingURL=index.js.map