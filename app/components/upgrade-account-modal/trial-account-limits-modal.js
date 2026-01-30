import * as React from "react";
import { View } from "react-native";
import { useI18nContext } from "@app/i18n/i18n-react";
import { GaloyIcon } from "@app/components/atomic/galoy-icon";
import CustomModal from "@app/components/custom-modal/custom-modal";
import { PhoneLoginInitiateType } from "@app/screens/phone-auth-screen";
import { useNavigation } from "@react-navigation/native";
import { Text, makeStyles, useTheme } from "@rn-vui/themed";
var UPGRADE_TO = 1;
export var TrialAccountLimitsModal = function (_a) {
    var isVisible = _a.isVisible, closeModal = _a.closeModal, beforeSubmit = _a.beforeSubmit;
    var LL = useI18nContext().LL;
    var styles = useStyles();
    var colors = useTheme().theme.colors;
    var navigation = useNavigation();
    var navigateToPhoneLogin = function () {
        if (beforeSubmit)
            beforeSubmit();
        navigation.navigate("login", {
            type: PhoneLoginInitiateType.CreateAccount,
            title: LL.UpgradeAccountModal.upgradeToLevel({ level: UPGRADE_TO }),
            onboarding: true,
        });
        closeModal();
    };
    return (<CustomModal isVisible={isVisible} toggleModal={closeModal} image={<GaloyIcon name="upgrade" color={colors.primary} size={100}/>} title={LL.GetStartedScreen.trialAccountLimits.modalTitle()} titleFontSize={21} body={<View style={styles.modalBody}>
          <LimitItem text={LL.GetStartedScreen.trialAccountLimits.recoveryOption()}/>
          <LimitItem text={LL.GetStartedScreen.trialAccountLimits.dailyLimit()}/>
          <LimitItem text={LL.GetStartedScreen.trialAccountLimits.onchainReceive()}/>
        </View>} primaryButtonTitle={LL.UpgradeAccountModal.upgradeToLevel({ level: UPGRADE_TO })} primaryButtonOnPress={navigateToPhoneLogin} secondaryButtonTitle={LL.UpgradeAccountModal.notNow()} secondaryButtonOnPress={closeModal}/>);
};
var LimitItem = function (_a) {
    var text = _a.text;
    var styles = useStyles();
    return (<View style={styles.limitRow}>
      <Text type="h2" style={styles.limitText}>
        - {text}
      </Text>
    </View>);
};
var useStyles = makeStyles(function () { return ({
    limitRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    limitText: {
        marginLeft: 12,
    },
    modalBody: {
        marginTop: 5,
        rowGap: 8,
    },
}); });
//# sourceMappingURL=trial-account-limits-modal.js.map