import React from "react";
import { ActivityIndicator } from "react-native";
import { useAppConfig } from "@app/hooks";
import { Text, makeStyles } from "@rn-vui/themed";
var useStyles = makeStyles(function () { return ({
    highlight: {
        fontWeight: "800",
        fontSize: 15,
    },
    primaryTextStyle: {
        flex: 1,
    },
}); });
export var PaymentDestinationDisplay = function (_a) {
    var destination = _a.destination, paymentType = _a.paymentType;
    var styles = useStyles();
    var lnDomain = useAppConfig().appConfig.galoyInstance.lnAddressHostname;
    if (!destination) {
        return <ActivityIndicator />;
    }
    if (destination.length < 40) {
        return (<Text type="p1" numberOfLines={1} ellipsizeMode={"middle"} style={styles.primaryTextStyle}>
        {destination}
        {paymentType === "intraledger" ? "@".concat(lnDomain) : ""}
      </Text>);
    }
    // we assume this is a bitcoin address or lightning invoice
    // not a username
    var firstSix = destination.slice(0, 6);
    var middle = destination.slice(6, -6);
    var lastSix = destination.slice(-6);
    return (<Text type="p2" style={styles.primaryTextStyle} numberOfLines={1} ellipsizeMode={"middle"}>
      <Text type="p2" style={styles.highlight}>
        {firstSix}
      </Text>
      {middle}
      <Text type="p2" style={styles.highlight}>
        {lastSix}
      </Text>
    </Text>);
};
//# sourceMappingURL=payment-destination-display.js.map