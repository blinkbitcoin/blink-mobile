import React from "react";
import { GaloyIcon } from "@app/components/atomic/galoy-icon";
import { testProps } from "@app/utils/testProps";
import { TouchableHighlight } from "@app/utils/touchable-wrapper";
import { Button, makeStyles } from "@rn-vui/themed";
export var TelegramLoginButton = function (props) {
    var styles = useStyles();
    var icon = (<GaloyIcon name="telegram" size={26} color={styles.titleStyle.color} style={styles.iconStyle}/>);
    return (<Button {...(typeof props.title === "string" ? testProps(props.title) : {})} activeOpacity={0.85} TouchableComponent={TouchableHighlight} icon={icon} iconRight={false} buttonStyle={[styles.buttonStyle, props.buttonStyle]} titleStyle={[styles.titleStyle, props.titleStyle]} disabled={props.loading} disabledStyle={styles.disabledStyle} disabledTitleStyle={styles.disabledTitleStyle} {...props}/>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        buttonStyle: {
            minHeight: 50,
            backgroundColor: "#229ED9",
            borderRadius: 8,
            paddingHorizontal: 16,
        },
        titleStyle: {
            fontSize: 20,
            lineHeight: 24,
            fontWeight: "600",
            color: colors.white,
        },
        disabledTitleStyle: {
            color: colors.grey3,
        },
        disabledStyle: {
            opacity: 1,
            backgroundColor: "#A1CFE6",
        },
        iconStyle: {
            marginRight: 10,
        },
    });
});
//# sourceMappingURL=telegram-button.js.map