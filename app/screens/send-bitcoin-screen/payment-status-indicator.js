import * as React from "react";
import { GaloyIcon } from "@app/components/atomic/galoy-icon";
import { useI18nContext } from "@app/i18n/i18n-react";
import { Text, makeStyles } from "@rn-vui/themed";
export var PaymentStatusIndicator = function (_a) {
    var errs = _a.errs, status = _a.status;
    var styles = useStyles();
    var LL = useI18nContext().LL;
    if (status === "success") {
        return (<>
        <GaloyIcon name={"payment-success"} size={128}/>
        <Text type={"p1"} style={styles.successText}>
          {LL.SendBitcoinScreen.success()}
        </Text>
      </>);
    }
    if (status === "error") {
        return (<>
        <GaloyIcon name={"payment-error"} size={128}/>
        {errs.map(function (_a, item) {
                var message = _a.message;
                return (<Text type={"p1"} key={"error-".concat(item)} style={styles.errorText}>
            {message}
          </Text>);
            })}
      </>);
    }
    if (status === "pending") {
        return (<>
        <GaloyIcon name={"payment-pending"} size={128}/>
        <Text type={"p1"} style={styles.pendingText}>
          {LL.SendBitcoinScreen.notConfirmed()}
        </Text>
      </>);
    }
    return <></>;
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        errorText: {
            color: colors.error,
            fontSize: 18,
            textAlign: "center",
        },
        pendingText: {
            textAlign: "center",
        },
        successText: {
            textAlign: "center",
        },
    });
});
//# sourceMappingURL=payment-status-indicator.js.map