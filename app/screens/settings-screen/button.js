import React from "react";
import { testProps } from "@app/utils/testProps";
import { Button, Skeleton, makeStyles } from "@rn-vui/themed";
export var SettingsButton = function (_a) {
    var title = _a.title, onPress = _a.onPress, variant = _a.variant, loading = _a.loading;
    var styles = useStyles(variant);
    if (loading)
        return <Skeleton style={styles.containerStyle}/>;
    return (<Button title={title} {...testProps(title)} onPress={onPress} titleStyle={styles.titleStyle} containerStyle={styles.containerStyle} buttonStyle={styles.buttonStyle}/>);
};
var useStyles = makeStyles(function (_a, variant) {
    var colors = _a.colors;
    return ({
        containerStyle: {
            height: 42,
            borderRadius: 12,
        },
        buttonStyle: {
            height: 42,
            borderRadius: 12,
            backgroundColor: variant === "critical" ? colors.red : colors.grey5,
        },
        titleStyle: {
            color: variant === "critical"
                ? "white"
                : variant === "warning"
                    ? colors.primary
                    : colors.red,
        },
    });
});
//# sourceMappingURL=button.js.map