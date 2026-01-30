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
import React, { useState, createContext, useContext, useEffect } from "react";
import { useLevel } from "@app/graphql/level-context";
import { useAppConfig } from "@app/hooks/use-app-config";
import remoteConfigInstance from "@react-native-firebase/remote-config";
var DeviceAccountEnabledKey = "deviceAccountEnabledRestAuth";
var BalanceLimitToTriggerUpgradeModalKey = "balanceLimitToTriggerUpgradeModal";
var FeedbackEmailKey = "feedbackEmailAddress";
var UpgradeModalCooldownDaysKey = "upgradeModalCooldownDays";
var UpgradeModalShowAtSessionNumberKey = "upgradeModalShowAtSessionNumber";
var FeeReimbursementMemoKey = "feeReimbursementMemo";
var SuccessIconDurationKey = "successIconDuration";
var defaultRemoteConfig = {
    deviceAccountEnabledRestAuth: false,
    balanceLimitToTriggerUpgradeModal: 2100,
    feedbackEmailAddress: "feedback@blink.sv",
    upgradeModalCooldownDays: 7,
    upgradeModalShowAtSessionNumber: 1,
    feeReimbursementMemo: "fee reimbursement",
    successIconDuration: 2300,
};
var defaultFeatureFlags = {
    deviceAccountEnabled: false,
};
remoteConfigInstance().setDefaults(defaultRemoteConfig);
remoteConfigInstance().setConfigSettings({
    minimumFetchIntervalMillis: 0,
});
export var FeatureFlagContext = createContext(defaultFeatureFlags);
export var RemoteConfigContext = createContext(defaultRemoteConfig);
export var FeatureFlagContextProvider = function (_a) {
    var children = _a.children;
    var _b = useState(defaultRemoteConfig), remoteConfig = _b[0], setRemoteConfig = _b[1];
    var currentLevel = useLevel().currentLevel;
    var _c = useState(false), remoteConfigReady = _c[0], setRemoteConfigReady = _c[1];
    var galoyInstance = useAppConfig().appConfig.galoyInstance;
    useEffect(function () {
        ;
        (function () { return __awaiter(void 0, void 0, void 0, function () {
            var deviceAccountEnabledRestAuth, balanceLimitToTriggerUpgradeModal, feedbackEmailAddress, upgradeModalCooldownDays, upgradeModalShowAtSessionNumber, feeReimbursementMemo, successIconDuration, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, 3, 4]);
                        return [4 /*yield*/, remoteConfigInstance().fetchAndActivate()];
                    case 1:
                        _a.sent();
                        deviceAccountEnabledRestAuth = remoteConfigInstance()
                            .getValue(DeviceAccountEnabledKey)
                            .asBoolean();
                        balanceLimitToTriggerUpgradeModal = remoteConfigInstance()
                            .getValue(BalanceLimitToTriggerUpgradeModalKey)
                            .asNumber();
                        feedbackEmailAddress = remoteConfigInstance()
                            .getValue(FeedbackEmailKey)
                            .asString();
                        upgradeModalCooldownDays = remoteConfigInstance()
                            .getValue(UpgradeModalCooldownDaysKey)
                            .asNumber();
                        upgradeModalShowAtSessionNumber = remoteConfigInstance()
                            .getValue(UpgradeModalShowAtSessionNumberKey)
                            .asNumber();
                        feeReimbursementMemo = remoteConfigInstance()
                            .getValue(FeeReimbursementMemoKey)
                            .asString();
                        successIconDuration = remoteConfigInstance()
                            .getValue(SuccessIconDurationKey)
                            .asNumber();
                        setRemoteConfig({
                            deviceAccountEnabledRestAuth: deviceAccountEnabledRestAuth,
                            balanceLimitToTriggerUpgradeModal: balanceLimitToTriggerUpgradeModal,
                            feedbackEmailAddress: feedbackEmailAddress,
                            upgradeModalCooldownDays: upgradeModalCooldownDays,
                            upgradeModalShowAtSessionNumber: upgradeModalShowAtSessionNumber,
                            feeReimbursementMemo: feeReimbursementMemo,
                            successIconDuration: successIconDuration,
                        });
                        return [3 /*break*/, 4];
                    case 2:
                        err_1 = _a.sent();
                        console.error("Error fetching remote config:", err_1);
                        return [3 /*break*/, 4];
                    case 3:
                        setRemoteConfigReady(true);
                        return [7 /*endfinally*/];
                    case 4: return [2 /*return*/];
                }
            });
        }); })();
    }, []);
    var featureFlags = {
        deviceAccountEnabled: remoteConfig.deviceAccountEnabledRestAuth || galoyInstance.id === "Local",
    };
    if (!remoteConfigReady && currentLevel === "NonAuth") {
        return null;
    }
    return (<FeatureFlagContext.Provider value={featureFlags}>
      <RemoteConfigContext.Provider value={remoteConfig}>
        {children}
      </RemoteConfigContext.Provider>
    </FeatureFlagContext.Provider>);
};
export var useFeatureFlags = function () { return useContext(FeatureFlagContext); };
export var useRemoteConfig = function () { return useContext(RemoteConfigContext); };
//# sourceMappingURL=feature-flags-context.js.map