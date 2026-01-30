import { View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { makeStyles } from "@rn-vui/themed";
export var QrCodeComponent = function (_a) {
    var otpauth = _a.otpauth;
    var styles = useStyles();
    return (<View style={styles.spacingAround}>
      <QRCode value={otpauth} size={200}/>
    </View>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        spacingAround: {
            padding: 20,
            backgroundColor: colors._white,
            borderRadius: 10,
        },
    });
});
//# sourceMappingURL=totp-qr.js.map