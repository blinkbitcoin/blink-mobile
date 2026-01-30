import React from "react";
import { View } from "react-native";
import { makeStyles } from "@rn-vui/themed";
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button";
import { PhoneCodeChannelType } from "@app/graphql/generated";
import { useI18nContext } from "@app/i18n/i18n-react";
export var PhoneChannelButton = function (_a) {
    var _b;
    var phoneCodeChannel = _a.phoneCodeChannel, captchaLoading = _a.captchaLoading, isDisabled = _a.isDisabled, submit = _a.submit, customStyle = _a.customStyle;
    var styles = useStyles();
    var LL = useI18nContext().LL;
    var channelLabels = (_b = {},
        _b[PhoneCodeChannelType.Telegram] = LL.PhoneLoginInitiateScreen.telegram(),
        _b[PhoneCodeChannelType.Sms] = LL.PhoneLoginInitiateScreen.sms(),
        _b[PhoneCodeChannelType.Whatsapp] = LL.PhoneLoginInitiateScreen.whatsapp(),
        _b);
    return (<View style={[styles.container, customStyle]}>
      <GaloyPrimaryButton title={channelLabels[phoneCodeChannel]} loading={captchaLoading} onPress={function () { return submit(phoneCodeChannel); }} disabled={isDisabled}/>
    </View>);
};
var useStyles = makeStyles(function () { return ({
    container: {
        flex: 1,
        justifyContent: "flex-end",
    },
}); });
//# sourceMappingURL=phone-channel-buttons.js.map