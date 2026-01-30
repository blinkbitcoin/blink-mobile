import React from "react";
import { testProps } from "@app/utils/testProps";
import { TouchableHighlight } from "@app/utils/touchable-wrapper";
import { Button, makeStyles } from "@rn-vui/themed";
export var GaloyPrimaryButton = function (props) {
    var styles = useStyles();
    return (<Button {...(typeof props.title === "string" ? testProps(props.title) : {})} activeOpacity={0.85} TouchableComponent={TouchableHighlight} buttonStyle={styles.buttonStyle} titleStyle={styles.titleStyle} disabledStyle={styles.disabledStyle} disabledTitleStyle={styles.disabledTitleStyle} {...props}/>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        titleStyle: {
            fontSize: 20,
            lineHeight: 24,
            fontWeight: "600",
            color: colors.white,
        },
        disabledTitleStyle: {
            color: colors.grey5,
        },
        buttonStyle: {
            minHeight: 50,
            backgroundColor: colors.primary,
        },
        disabledStyle: {
            opacity: 0.5,
            backgroundColor: colors.primary,
        },
    });
});
//# sourceMappingURL=galoy-primary-button.js.map