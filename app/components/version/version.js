import * as React from "react";
import { Pressable } from "react-native";
import DeviceInfo from "react-native-device-info";
import { useI18nContext } from "@app/i18n/i18n-react";
import { useNavigation } from "@react-navigation/native";
import { Text, makeStyles } from "@rn-vui/themed";
import { testProps } from "../../utils/testProps";
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        version: {
            color: colors.grey0,
            marginTop: 18,
            textAlign: "center",
        },
    });
});
export var VersionComponent = function () {
    var styles = useStyles();
    var navigate = useNavigation().navigate;
    var LL = useI18nContext().LL;
    var _a = React.useState(0), secretMenuCounter = _a[0], setSecretMenuCounter = _a[1];
    React.useEffect(function () {
        if (secretMenuCounter > 2) {
            navigate("developerScreen");
            setSecretMenuCounter(0);
        }
    }, [navigate, secretMenuCounter]);
    var readableVersion = DeviceInfo.getReadableVersion();
    return (<Pressable onPress={function () { return setSecretMenuCounter(secretMenuCounter + 1); }}>
      <Text {...testProps("Version Build Text")} style={styles.version}>
        {readableVersion}
        {"\n"}
        {LL.GetStartedScreen.headline()}
      </Text>
    </Pressable>);
};
//# sourceMappingURL=version.js.map