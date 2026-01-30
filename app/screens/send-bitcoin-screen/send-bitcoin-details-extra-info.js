import React, { useRef, useCallback, useState } from "react";
import { GaloyErrorBox } from "@app/components/atomic/galoy-error-box";
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button";
import { TrialAccountLimitsModal } from "@app/components/upgrade-account-modal";
import { useDisplayCurrency } from "@app/hooks/use-display-currency";
import { useI18nContext } from "@app/i18n/i18n-react";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Text, makeStyles } from "@rn-vui/themed";
import { AmountInvalidReason } from "./payment-details";
export var SendBitcoinDetailsExtraInfo = function (_a) {
    var errorMessage = _a.errorMessage, amountStatus = _a.amountStatus, currentLevel = _a.currentLevel;
    var navigation = useNavigation();
    var _b = useState(false), isUpgradeAccountModalVisible = _b[0], setIsUpgradeAccountModalVisible = _b[1];
    var closeModal = function () { return setIsUpgradeAccountModalVisible(false); };
    var openModal = function () { return setIsUpgradeAccountModalVisible(true); };
    var reopenUpgradeModal = useRef(false);
    useFocusEffect(useCallback(function () {
        if (reopenUpgradeModal.current) {
            openModal();
            reopenUpgradeModal.current = false;
        }
    }, []));
    var LL = useI18nContext().LL;
    var formatMoneyAmount = useDisplayCurrency().formatMoneyAmount;
    var styles = useStyles();
    if (errorMessage) {
        return <GaloyErrorBox errorMessage={errorMessage}/>;
    }
    if (amountStatus.validAmount) {
        return null;
    }
    switch (amountStatus.invalidReason) {
        case AmountInvalidReason.InsufficientLimit:
            return (<>
          <GaloyErrorBox errorMessage={LL.SendBitcoinScreen.amountExceedsLimit({
                    limit: formatMoneyAmount({
                        moneyAmount: amountStatus.remainingLimit,
                    }),
                })}/>
          <TrialAccountLimitsModal closeModal={closeModal} isVisible={isUpgradeAccountModalVisible} beforeSubmit={function () {
                    reopenUpgradeModal.current = true;
                }}/>
          {currentLevel === "ZERO" ? (<Text type="p2" style={styles.upgradeAccountText} onPress={openModal}>
              {LL.SendBitcoinScreen.upgradeAccountToIncreaseLimit()}
            </Text>) : null}
          {currentLevel === "ONE" ? (<GaloyPrimaryButton title={LL.TransactionLimitsScreen.increaseLimits()} onPress={function () { return navigation.navigate("fullOnboardingFlow"); }}/>) : null}
        </>);
        case AmountInvalidReason.InsufficientBalance:
            return (<GaloyErrorBox errorMessage={LL.SendBitcoinScreen.amountExceed({
                    balance: formatMoneyAmount({ moneyAmount: amountStatus.balance }),
                })}/>);
        default:
            return null;
    }
};
var useStyles = makeStyles(function () {
    return {
        upgradeAccountText: {
            marginTop: 5,
            textDecorationLine: "underline",
        },
    };
});
//# sourceMappingURL=send-bitcoin-details-extra-info.js.map