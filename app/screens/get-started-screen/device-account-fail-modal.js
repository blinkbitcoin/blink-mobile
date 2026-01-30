import * as React from "react";
import { GaloyIcon } from "@app/components/atomic/galoy-icon";
import CustomModal from "@app/components/custom-modal/custom-modal";
import { useI18nContext } from "@app/i18n/i18n-react";
import { Text, makeStyles } from "@rn-vui/themed";
export var DeviceAccountFailModal = function (_a) {
    var isVisible = _a.isVisible, closeModal = _a.closeModal, navigateToPhoneLogin = _a.navigateToPhoneLogin, navigateToHomeScreen = _a.navigateToHomeScreen;
    var LL = useI18nContext().LL;
    var styles = useStyles();
    return (<CustomModal isVisible={isVisible} toggleModal={closeModal} image={<GaloyIcon name="payment-error" size={100}/>} title={LL.GetStartedScreen.trialAccountCreationFailed()} body={<Text style={styles.errorBodyText} type="h2">
          {LL.GetStartedScreen.trialAccountCreationFailedMessage()}
        </Text>} primaryButtonTitle={LL.GetStartedScreen.registerPhoneAccount()} primaryButtonOnPress={navigateToPhoneLogin} secondaryButtonTitle={LL.GetStartedScreen.exploreWallet()} secondaryButtonOnPress={navigateToHomeScreen}/>);
};
var useStyles = makeStyles(function () { return ({
    errorBodyText: {
        textAlign: "center",
    },
}); });
//# sourceMappingURL=device-account-fail-modal.js.map