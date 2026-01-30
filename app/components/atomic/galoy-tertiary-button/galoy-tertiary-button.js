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
import { makeStyles, Text, useTheme } from "@rn-vui/themed";
export var GaloyTertiaryButton = function (props) {
    var outline = props.outline, clear = props.clear, containerStyle = props.containerStyle, disabled = props.disabled, icon = props.icon, remainingProps = __rest(props, ["outline", "clear", "containerStyle", "disabled", "icon"]);
    var styles = useStyles(props);
    var colors = useTheme().theme.colors;
    var pressableStyle = function (_a) {
        var pressed = _a.pressed;
        var dynamicStyle;
        switch (true) {
            case pressed && outline:
                dynamicStyle = {
                    borderColor: colors.primary,
                    backgroundColor: colors.primary,
                    borderWidth: 1.5,
                };
                break;
            case pressed && !outline && !clear:
                dynamicStyle = {
                    backgroundColor: colors.primary,
                };
                break;
            case pressed && clear:
                dynamicStyle = {
                    opacity: 0.7,
                };
                break;
            case outline:
                dynamicStyle = {
                    opacity: disabled ? 0.7 : 1,
                    backgroundColor: colors.transparent,
                    borderColor: colors.primary5,
                    borderWidth: 1.5,
                };
                break;
            case clear:
                dynamicStyle = {
                    backgroundColor: colors.transparent,
                };
                break;
            default:
                dynamicStyle = {
                    backgroundColor: colors.primary3,
                };
        }
        return [dynamicStyle, containerStyle, styles.pressableStyle];
    };
    var textColor = colors.white;
    if (outline)
        textColor = colors.black;
    if (clear)
        textColor = colors.primary;
    return (<Pressable {...remainingProps} style={pressableStyle} disabled={disabled}>
      <View style={styles.container}>
        <Text color={textColor} style={styles.buttonTitleStyle}>
          {props.title}
        </Text>
        {icon ? icon : null}
      </View>
    </Pressable>);
};
var useStyles = makeStyles(function (_, props) { return ({
    container: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },
    buttonTitleStyle: {
        lineHeight: 20,
        textAlign: "center",
        fontSize: 14,
        fontWeight: props.clear ? "bold" : "600",
        opacity: props.disabled ? 0.7 : 1,
    },
    pressableStyle: {
        paddingHorizontal: props.clear ? 0 : 16,
        paddingVertical: props.clear ? 0 : 4,
        borderRadius: 50,
    },
}); });
//# sourceMappingURL=galoy-tertiary-button.js.map