import { TouchableOpacity, View } from "react-native";
import { RESULTS } from "react-native-permissions";
import { makeStyles } from "@rn-vui/themed";
import CenterLocationAndroid from "../../assets/icons/center-location-android.svg";
export default function LocationButtonCopy(_a) {
    var permissionStatus = _a.permissionStatus, centerOnUser = _a.centerOnUser, requestPermissions = _a.requestPermissions;
    var styles = useStyles();
    return (<View style={styles.button}>
      <TouchableOpacity style={styles.android} onPress={permissionStatus === RESULTS.GRANTED ? centerOnUser : requestPermissions}>
        <CenterLocationAndroid height={22} width={22} fill={"#656565"}/>
      </TouchableOpacity>
    </View>);
}
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        button: {
            position: "absolute",
            bottom: 28,
            left: 8,
            zIndex: 99,
        },
        android: {
            borderRadius: 2,
            opacity: 0.99,
            backgroundColor: colors.white,
            padding: 8,
            shadowColor: colors.black,
            shadowOffset: {
                width: 0,
                height: 2,
            },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
        },
    });
});
//# sourceMappingURL=location-button-copy.js.map