import React from "react";
import { View } from "react-native";
import { GaloyIcon } from "@app/components/atomic/galoy-icon";
import CustomModal from "@app/components/custom-modal/custom-modal";
import { useI18nContext } from "@app/i18n/i18n-react";
import { Text, makeStyles, useTheme } from "@rn-vui/themed";
export var ConfirmFeesModal = function (_a) {
    var action = _a.action, cancel = _a.cancel, isVisible = _a.isVisible;
    var styles = useStyles();
    var colors = useTheme().theme.colors;
    var LL = useI18nContext().LL;
    return (<CustomModal isVisible={isVisible} toggleModal={cancel} title={LL.SendBitcoinScreen.confirmFeesModal.title()} image={<GaloyIcon name="info" size={80} color={colors.primary3}/>} body={<View style={styles.body}>
          <Text type={"p2"} style={styles.warningText}>
            {LL.SendBitcoinScreen.confirmFeesModal.content()}
          </Text>
        </View>} primaryButtonOnPress={cancel} primaryButtonTitle={LL.common.cancel()} secondaryButtonTitle={LL.SendBitcoinScreen.confirmFeesModal.confirmButton()} secondaryButtonOnPress={action}/>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        modalCard: {
            backgroundColor: colors.white,
            borderRadius: 16,
            padding: 18,
        },
        warningText: {
            textAlign: "center",
        },
        body: {
            rowGap: 12,
        },
        buttonContainer: {
            rowGap: 12,
        },
        titleContainer: {
            marginBottom: 12,
        },
    });
});
//# sourceMappingURL=confirm-fees-modal.js.map