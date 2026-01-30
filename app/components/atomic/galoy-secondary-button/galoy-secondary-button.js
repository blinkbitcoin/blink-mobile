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
import { testProps } from "@app/utils/testProps";
import { TouchableHighlight } from "@app/utils/touchable-wrapper";
import { Button, makeStyles, useTheme } from "@rn-vui/themed";
import { GaloyIcon } from "../galoy-icon";
export var GaloySecondaryButton = function (props) {
    var iconName = props.iconName, grey = props.grey, remainingProps = __rest(props, ["iconName", "grey"]);
    var colors = useTheme().theme.colors;
    var styles = useStyles(props);
    var icon = iconName ? (<GaloyIcon name={iconName} size={18} color={grey ? colors.grey3 : colors.primary} style={styles.iconStyle}/>) : null;
    return (<Button {...(typeof props.title === "string" ? testProps(props.title) : {})} {...remainingProps} underlayColor={colors.transparent} activeOpacity={0.7} {...(icon ? { icon: icon } : {})} TouchableComponent={TouchableHighlight} buttonStyle={styles.buttonStyle} disabledStyle={styles.disabledStyle} titleStyle={[styles.buttonTitleStyle, props.titleStyle]} disabledTitleStyle={styles.disabledTitleStyle} loadingProps={{
            color: colors.primary,
        }}/>);
};
var useStyles = makeStyles(function (_a, props) {
    var colors = _a.colors;
    return ({
        disabledStyle: {
            opacity: 0.35,
            backgroundColor: colors.transparent,
        },
        buttonStyle: {
            backgroundColor: colors.transparent,
        },
        buttonTitleStyle: {
            color: props.grey ? colors.grey3 : colors.primary,
            fontSize: 20,
            lineHeight: 24,
            fontWeight: "600",
        },
        disabledTitleStyle: {
            color: props.grey ? colors.grey3 : colors.primary,
        },
        iconStyle: {
            marginRight: props.iconPosition === "right" ? 0 : 10,
            marginLeft: props.iconPosition === "left" ? 0 : 10,
        },
    });
});
//# sourceMappingURL=galoy-secondary-button.js.map