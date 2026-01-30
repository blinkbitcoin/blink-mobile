import React from "react";
import { ActivityIndicator, TouchableHighlight } from "react-native";
import { makeStyles, useTheme } from "@rn-vui/themed";
import { GaloyIcon } from "@app/components/atomic/galoy-icon";
export var WalletToggleButton = function (_a) {
    var loading = _a.loading, disabled = _a.disabled, onPress = _a.onPress, containerStyle = _a.containerStyle, testID = _a.testID;
    var colors = useTheme().theme.colors;
    var styles = useStyles();
    return (<TouchableHighlight style={[styles.button, containerStyle, disabled && styles.buttonDisabled]} disabled={disabled} onPress={onPress} underlayColor={colors.grey6} testID={testID}>
      {loading ? (<ActivityIndicator color={colors.primary}/>) : (<GaloyIcon name="transfer" color={colors.primary} size={25}/>)}
    </TouchableHighlight>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        button: {
            height: 50,
            width: 50,
            borderRadius: 50,
            backgroundColor: colors.grey4,
            justifyContent: "center",
            alignItems: "center",
            zIndex: 3,
            elevation: 3,
        },
        buttonDisabled: {
            backgroundColor: colors.grey6,
        },
    });
});
//# sourceMappingURL=wallet-toggle-button.js.map