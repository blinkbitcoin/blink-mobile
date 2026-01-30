import React from "react";
import { View } from "react-native";
import { makeStyles, Text, useTheme } from "@rn-vui/themed";
import { GaloyIcon } from "../galoy-icon";
export var GaloyErrorBox = function (_a) {
    var errorMessage = _a.errorMessage, noIcon = _a.noIcon;
    var _b = useTheme().theme, colors = _b.colors, mode = _b.mode;
    var styles = useStyles();
    var color = mode === "light" ? colors.error : colors.black;
    return (<View style={styles.container}>
      {!noIcon && <GaloyIcon name="warning" size={14} color={color}/>}
      <Text style={styles.textContainer} type={"p3"} color={color}>
        {errorMessage}
      </Text>
    </View>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        container: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "flex-start",
            paddingHorizontal: 8,
            paddingVertical: 6,
            borderRadius: 8,
            backgroundColor: colors.error9,
            zIndex: 1,
        },
        textContainer: {
            overflow: "hidden",
            marginLeft: 4,
            flex: 1,
        },
    });
});
//# sourceMappingURL=galoy-error-box.js.map