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
import { useTheme, Text, makeStyles } from "@rn-vui/themed";
import { GaloyIcon } from "../galoy-icon";
export var GaloyButtonField = function (_a) {
    var placeholder = _a.placeholder, value = _a.value, iconName = _a.iconName, error = _a.error, disabled = _a.disabled, secondaryValue = _a.secondaryValue, style = _a.style, highlightEnding = _a.highlightEnding, props = __rest(_a, ["placeholder", "value", "iconName", "error", "disabled", "secondaryValue", "style", "highlightEnding"]);
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
                    backgroundColor: colors.primary4,
                };
                break;
            case disabled:
                colorStyles = {
                    opacity: 0.3,
                    backgroundColor: colors.primary5,
                };
                break;
            default:
                colorStyles = {
                    backgroundColor: colors.primary5,
                };
        }
        var sizeStyles = {
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 8,
            minHeight: secondaryValue ? 60 : 40,
        };
        return [style, colorStyles, sizeStyles];
    };
    var primaryText = value || placeholder || "";
    var indexToStartHighlight = primaryText.length - (highlightEnding ? 5 : 0);
    return (<Pressable {...props} style={pressableStyle} disabled={disabled}>
      <View style={styles.contentContainerStyle}>
        <Text type="p1" color={error ? colors.error : undefined} style={styles.primaryTextStyle} numberOfLines={1} ellipsizeMode="middle">
          {primaryText.slice(0, indexToStartHighlight)}
          <Text type="p1" color={error ? colors.error : undefined} bold>
            {primaryText.slice(indexToStartHighlight)}
          </Text>
        </Text>
        {iconName && (<GaloyIcon style={styles.iconStyle} name={iconName} size={20} color={error ? colors.error : colors.primary}/>)}
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
    iconStyle: {
        marginLeft: 8,
        flex: 1,
    },
    primaryTextStyle: {
        flex: 1,
    },
}); });
//# sourceMappingURL=galoy-button-field.js.map