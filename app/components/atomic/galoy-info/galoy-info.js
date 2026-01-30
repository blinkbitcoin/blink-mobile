import React from "react";
import { View } from "react-native";
import { makeStyles, Text, useTheme } from "@rn-vui/themed";
export var GaloyInfo = function (_a) {
    var children = _a.children, isWarning = _a.isWarning;
    var colors = useTheme().theme.colors;
    var styles = useStyles({ isWarning: isWarning });
    return (<View style={styles.container}>
      <View style={styles.verticalLine}/>
      <View style={styles.infoContainer}>
        <Text style={styles.textContainer} type={"p3"} color={isWarning ? colors.warning : colors.blue5}>
          {children}
        </Text>
      </View>
    </View>);
};
var useStyles = makeStyles(function (_a, props) {
    var colors = _a.colors;
    return ({
        container: {
            flexDirection: "row",
        },
        infoContainer: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "flex-start",
            paddingHorizontal: 8,
            paddingVertical: 6,
            borderTopRightRadius: 8,
            borderBottomRightRadius: 8,
            backgroundColor: colors.grey5,
        },
        verticalLine: {
            width: 3,
            borderTopLeftRadius: 3,
            borderBottomLeftRadius: 3,
            backgroundColor: props.isWarning ? colors.warning : colors.blue5,
            height: "100%",
        },
        textContainer: {
            overflow: "hidden",
        },
    });
});
//# sourceMappingURL=galoy-info.js.map