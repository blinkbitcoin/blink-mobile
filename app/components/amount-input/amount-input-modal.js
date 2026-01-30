import * as React from "react";
import { SafeAreaView } from "react-native";
import ReactNativeModal from "react-native-modal";
import { timing } from "@app/rne-theme/timing";
import { makeStyles } from "@rn-vui/themed";
import { AmountInputScreen } from "../amount-input-screen";
export var AmountInputModal = function (_a) {
    var moneyAmount = _a.moneyAmount, walletCurrency = _a.walletCurrency, onSetAmount = _a.onSetAmount, maxAmount = _a.maxAmount, minAmount = _a.minAmount, convertMoneyAmount = _a.convertMoneyAmount, isOpen = _a.isOpen, close = _a.close;
    var styles = useStyles();
    return (<ReactNativeModal isVisible={isOpen} coverScreen={true} style={styles.modal} animationInTiming={timing.quick}>
      <SafeAreaView style={styles.amountInputScreenContainer}>
        <AmountInputScreen initialAmount={moneyAmount} convertMoneyAmount={convertMoneyAmount} walletCurrency={walletCurrency} setAmount={onSetAmount} maxAmount={maxAmount} minAmount={minAmount} goBack={close} compact/>
      </SafeAreaView>
    </ReactNativeModal>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        amountInputScreenContainer: {
            flex: 1,
        },
        modal: {
            backgroundColor: colors.white,
            margin: 0,
        },
    });
});
//# sourceMappingURL=amount-input-modal.js.map