import * as React from "react";
import { View } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { makeStyles } from "@rn-vui/themed";
var useStyles = makeStyles(function () { return ({
    icon: {
        fontSize: 72,
    },
    iconContainer: {
        alignItems: "flex-end",
        padding: 6,
        position: "absolute",
        right: 8,
        top: 16,
    },
}); });
export var CloseCross = function (_a) {
    var onPress = _a.onPress, color = _a.color;
    var styles = useStyles();
    return (<View style={styles.iconContainer}>
      <Icon name="close" style={styles.icon} onPress={onPress} color={color}/>
    </View>);
};
//# sourceMappingURL=close-cross.js.map