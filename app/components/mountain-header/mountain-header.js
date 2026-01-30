import * as React from "react";
import { View, Text } from "react-native";
import { useI18nContext } from "@app/i18n/i18n-react";
import { makeStyles } from "@rn-vui/themed";
import Montain from "./mointains-cloud-01.svg";
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        amountContainer: {
            alignItems: "center",
            paddingBottom: 16,
        },
        headerSection: {
            color: colors._white,
            fontSize: 16,
            paddingTop: 18,
        },
        mountainView: {
            alignItems: "center",
        },
        titleSection: {
            color: colors._white,
            fontSize: 24,
            fontWeight: "bold",
            paddingTop: 6,
        },
        topView: {
            marginTop: 80,
        },
    });
});
export var MountainHeader = function (_a) {
    var amount = _a.amount, color = _a.color, isAvailable = _a.isAvailable;
    var styles = useStyles();
    var LL = useI18nContext().LL;
    return (<View style={{ backgroundColor: color }}>
      <View style={styles.topView}>
        {isAvailable ? (<View style={styles.amountContainer}>
            <Text style={styles.headerSection}>{LL.EarnScreen.youEarned()}</Text>
            <Text style={styles.titleSection}>{amount} sats</Text>
          </View>) : (<></>)}
      </View>
      <View style={styles.mountainView}>
        <Montain />
      </View>
    </View>);
};
//# sourceMappingURL=mountain-header.js.map