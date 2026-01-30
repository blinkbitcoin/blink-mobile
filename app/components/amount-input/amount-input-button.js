var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
import React from "react";
import { Pressable, View } from "react-native";
import { GaloyIcon } from "@app/components/atomic/galoy-icon";
import { testProps } from "@app/utils/testProps";
import { useTheme, Text, makeStyles } from "@rn-vui/themed";
export var AmountInputButton = function (_a) {
    var placeholder = _a.placeholder, value = _a.value, iconName = _a.iconName, error = _a.error, disabled = _a.disabled, secondaryValue = _a.secondaryValue, primaryTextTestProps = _a.primaryTextTestProps, _b = _a.showValuesIfDisabled, showValuesIfDisabled = _b === void 0 ? true : _b, _c = _a.big, big = _c === void 0 ? true : _c, props = __rest(_a, ["placeholder", "value", "iconName", "error", "disabled", "secondaryValue", "primaryTextTestProps", "showValuesIfDisabled", "big"]);
    var colors = useTheme().theme.colors;
    var styles = useStyles();
    var pressableStyle = function (_a) {
        var pressed = _a.pressed;
        var colorStyles = {};
        switch (true) {
            case error:
                colorStyles = {
                    backgroundColor: colors.error9,
                };
                break;
            case pressed:
                colorStyles = {
                    opacity: 0.5,
                    backgroundColor: colors.grey5,
                };
                break;
            case disabled:
                colorStyles = {
                    backgroundColor: colors.grey5,
                    opacity: 0.5,
                };
                break;
            default:
                colorStyles = {
                    backgroundColor: colors.grey5,
                };
        }
        var sizeStyles = {
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 8,
            minHeight: big ? 60 : 50,
            justifyContent: "center",
        };
        return [colorStyles, sizeStyles];
    };
    /* eslint-disable no-param-reassign */
    // hide values if disabled
    if (!showValuesIfDisabled) {
        value = "";
        secondaryValue = "";
    }
    var primaryText = value || placeholder || "";
    return (<Pressable {...props} style={pressableStyle} disabled={disabled}>
      <View style={styles.contentContainerStyle}>
        <Text type="p2" color={error ? colors.error : undefined} numberOfLines={1} ellipsizeMode="middle" {...(primaryTextTestProps ? testProps(primaryTextTestProps) : {})}>
          {primaryText}
        </Text>
        {iconName && (<GaloyIcon name={iconName} size={20} color={error ? colors.error : colors.primary}/>)}
      </View>
      {secondaryValue && (<Text type="p4" color={error ? colors.error : undefined}>
          {secondaryValue}
        </Text>)}
    </Pressable>);
};
var useStyles = makeStyles(function () { return ({
    contentContainerStyle: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
}); });
//# sourceMappingURL=amount-input-button.js.map