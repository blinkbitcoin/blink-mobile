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
export var ExpirationTimeButton = function (_a) {
    var placeholder = _a.placeholder, value = _a.value, iconName = _a.iconName, error = _a.error, disabled = _a.disabled, primaryTextTestProps = _a.primaryTextTestProps, big = _a.big, style = _a.style, props = __rest(_a, ["placeholder", "value", "iconName", "error", "disabled", "primaryTextTestProps", "big", "style"]);
    var colors = useTheme().theme.colors;
    var styles = useStyles({ big: big });
    var pressableStyle = function (_a) {
        var pressed = _a.pressed;
        if (error) {
            return [styles.pressableBase, styles.errorBackground];
        }
        if (disabled || pressed) {
            return [styles.pressableBase, styles.defaultBackground, styles.interactiveOpacity];
        }
        return [styles.pressableBase, styles.defaultBackground];
    };
    return (<View style={style}>
      <Pressable {...props} style={pressableStyle} disabled={disabled}>
        <View style={styles.contentContainerStyle}>
          <Text type="p2" color={error ? colors.error : undefined} numberOfLines={1} ellipsizeMode="middle" {...(primaryTextTestProps ? testProps(primaryTextTestProps) : {})}>
            {"".concat(placeholder).concat(!disabled && value ? ": " + value : "")}
          </Text>
          {iconName && (<GaloyIcon name={iconName} size={20} color={error ? colors.error : colors.primary}/>)}
        </View>
      </Pressable>
    </View>);
};
var useStyles = makeStyles(function (_a, props) {
    var colors = _a.colors;
    return ({
        contentContainerStyle: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
        },
        pressableBase: {
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 8,
            minHeight: props.big ? 60 : 50,
            justifyContent: "center",
        },
        defaultBackground: {
            backgroundColor: colors.grey5,
        },
        errorBackground: {
            backgroundColor: colors.error9,
        },
        interactiveOpacity: {
            opacity: 0.5,
        },
    });
});
//# sourceMappingURL=expiration-time-button.js.map