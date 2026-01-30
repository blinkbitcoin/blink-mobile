import React from "react";
import { View } from "react-native";
import { makeStyles, useTheme, Icon } from "@rn-vui/themed";
import { GaloyIcon } from "../atomic/galoy-icon";
export var OptionIcon = function (_a) {
    var ionicon = _a.ionicon, icon = _a.icon, isSelected = _a.isSelected;
    var styles = useStyles();
    var colors = useTheme().theme.colors;
    if (ionicon) {
        return (<View style={styles.iconContainer}>
        <Icon name={ionicon} size={24} type="ionicon" color={isSelected ? colors.primary : colors.grey3}/>
      </View>);
    }
    if (icon) {
        return (<View style={styles.iconContainer}>
        <GaloyIcon name={icon} size={24} color={isSelected ? colors.primary : colors.grey3}/>
      </View>);
    }
};
var useStyles = makeStyles(function () { return ({
    iconContainer: {
        marginLeft: 16,
        alignItems: "center",
        justifyContent: "center",
    },
}); });
//# sourceMappingURL=option-icon.js.map