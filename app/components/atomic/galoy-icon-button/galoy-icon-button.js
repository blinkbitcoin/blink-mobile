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
import { Pressable } from "react-native";
import { testProps } from "@app/utils/testProps";
import { useTheme, Text } from "@rn-vui/themed";
import { GaloyIcon, circleDiameterThatContainsSquare, } from "../galoy-icon/galoy-icon";
var sizeMapping = {
    small: 16,
    medium: 24,
    large: 36,
};
export var GaloyIconButton = function (_a) {
    var size = _a.size, name = _a.name, text = _a.text, iconOnly = _a.iconOnly, disabled = _a.disabled, color = _a.color, backgroundColor = _a.backgroundColor, remainingProps = __rest(_a, ["size", "name", "text", "iconOnly", "disabled", "color", "backgroundColor"]);
    var colors = useTheme().theme.colors;
    var iconContainerSize = circleDiameterThatContainsSquare(sizeMapping[size]);
    var pressableStyle = function () {
        if (text) {
            return {
                alignItems: "center",
            };
        }
        return {
            width: iconContainerSize,
            height: iconContainerSize,
        };
    };
    var iconProps = function (pressed, iconOnly, disabled) {
        switch (true) {
            case iconOnly && disabled:
                return {
                    opacity: 0.7,
                    color: color || colors.primary,
                    backgroundColor: colors.transparent,
                };
            case iconOnly && pressed:
                return {
                    opacity: 0.7,
                    color: color || colors.primary,
                    backgroundColor: backgroundColor || colors.grey4,
                };
            case iconOnly && !pressed:
                return {
                    color: color || colors.primary,
                    backgroundColor: colors.transparent,
                };
            case !iconOnly && disabled:
                return {
                    opacity: 0.7,
                    color: color || colors.primary,
                    backgroundColor: backgroundColor || colors.grey4,
                };
            case !iconOnly && pressed:
                return {
                    opacity: 0.7,
                    color: color || colors.primary,
                    backgroundColor: backgroundColor || colors.grey4,
                };
            case !iconOnly && !pressed:
                return {
                    color: color || colors.primary,
                    backgroundColor: backgroundColor || colors.grey4,
                };
            default:
                return {};
        }
    };
    var fontStyle = function (disabled) {
        return {
            marginTop: 8,
            opacity: disabled ? 0.7 : 1,
            textAlign: "center",
            fontSize: 11,
        };
    };
    var testPropId = text || name;
    return (<Pressable hitSlop={text ? 0 : iconContainerSize / 2} style={pressableStyle} disabled={disabled} {...testProps(testPropId)} {...remainingProps}>
      {function (_a) {
            var pressed = _a.pressed;
            return (<>
            <GaloyIcon name={name} size={sizeMapping[size]} {...iconProps(pressed, Boolean(iconOnly), Boolean(disabled))}/>
            {text && <Text style={fontStyle(Boolean(disabled))}>{text}</Text>}
          </>);
        }}
    </Pressable>);
};
export var GaloyEditButton = function (_a) {
    var disabled = _a.disabled, remainingProps = __rest(_a, ["disabled"]);
    var colors = useTheme().theme.colors;
    var pressableStyle = function (_a) {
        var pressed = _a.pressed;
        return {
            width: 32,
            height: 32,
            borderRadius: 8,
            opacity: disabled ? 0.7 : 1,
            backgroundColor: pressed ? colors.grey4 : colors.grey5,
            alignItems: "center",
            justifyContent: "center",
        };
    };
    return (<Pressable {...remainingProps} hitSlop={16} style={pressableStyle} disabled={disabled}>
      {function (_a) {
            var pressed = _a.pressed;
            return (<GaloyIcon name="pencil" size={20} color={colors.primary} opacity={pressed ? 0.7 : 1}/>);
        }}
    </Pressable>);
};
//# sourceMappingURL=galoy-icon-button.js.map