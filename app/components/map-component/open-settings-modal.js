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
import { View } from "react-native";
import { openSettings } from "react-native-permissions";
import { GaloyIcon } from "@app/components/atomic/galoy-icon";
import CustomModal from "@app/components/custom-modal/custom-modal";
import { useI18nContext } from "@app/i18n/i18n-react";
import { Text, makeStyles, useTheme } from "@rn-vui/themed";
export var OpenSettingsModal = React.forwardRef(function ConfirmDialog(_, ref) {
    var styles = useStyles();
    var colors = useTheme().theme.colors;
    var LL = useI18nContext().LL;
    var _a = React.useState(false), isVisible = _a[0], toggleVisible = _a[1];
    React.useImperativeHandle(ref, function () { return ({
        toggleVisibility: function () {
            toggleVisible(!isVisible);
        },
    }); });
    function navToSettings() {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        toggleVisible(false);
                        return [4 /*yield*/, openSettings()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    return (<CustomModal isVisible={isVisible} toggleModal={function () { return toggleVisible(!isVisible); }} title={LL.MapScreen.navToSettingsTitle()} image={<GaloyIcon name="info" size={100} color={colors.primary3}/>} body={<View style={styles.body}>
          <Text type={"p2"} style={styles.warningText}>
            {LL.MapScreen.navToSettingsText()}
          </Text>
        </View>} primaryButtonOnPress={navToSettings} primaryButtonTitle={LL.MapScreen.openSettings()} secondaryButtonTitle={LL.common.back()} secondaryButtonOnPress={function () { return toggleVisible(!isVisible); }}/>);
});
var useStyles = makeStyles(function () { return ({
    warningText: {
        textAlign: "center",
    },
    body: {
        rowGap: 12,
    },
}); });
//# sourceMappingURL=open-settings-modal.js.map