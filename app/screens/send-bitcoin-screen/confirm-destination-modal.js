import React, { useCallback, useState } from "react";
import { View, TouchableOpacity } from "react-native";
import { GaloyIcon } from "@app/components/atomic/galoy-icon";
import CustomModal from "@app/components/custom-modal/custom-modal";
import { useAppConfig } from "@app/hooks";
import { useI18nContext } from "@app/i18n/i18n-react";
import { CheckBox, Text, makeStyles, useTheme } from "@rn-vui/themed";
import { testProps } from "../../utils/testProps";
import { DestinationState, SendBitcoinActions, } from "./send-bitcoin-reducer";
export var ConfirmDestinationModal = function (_a) {
    var _b;
    var destinationState = _a.destinationState, dispatchDestinationStateAction = _a.dispatchDestinationStateAction;
    var styles = useStyles();
    var colors = useTheme().theme.colors;
    var LL = useI18nContext().LL;
    var appConfig = useAppConfig().appConfig;
    var _c = appConfig.galoyInstance, lnDomain = _c.lnAddressHostname, bankName = _c.name;
    var _d = useState(false), confirmationEnabled = _d[0], setConfirmationEnabled = _d[1];
    var confirmDestination = useCallback(function () {
        dispatchDestinationStateAction({
            type: SendBitcoinActions.SetConfirmed,
            payload: { unparsedDestination: destinationState.unparsedDestination },
        });
    }, [destinationState, dispatchDestinationStateAction]);
    if (destinationState.destinationState !== DestinationState.RequiresUsernameConfirmation)
        return null;
    var lnAddress = ((_b = destinationState === null || destinationState === void 0 ? void 0 : destinationState.confirmationUsernameType) === null || _b === void 0 ? void 0 : _b.username) + "@" + lnDomain;
    var goBack = function () {
        dispatchDestinationStateAction({
            type: SendBitcoinActions.SetUnparsedDestination,
            payload: { unparsedDestination: destinationState.unparsedDestination },
        });
    };
    return (<CustomModal isVisible={destinationState.destinationState ===
            DestinationState.RequiresUsernameConfirmation} toggleModal={goBack} title={LL.SendBitcoinDestinationScreen.confirmUsernameModal.title()} image={<GaloyIcon name="info" size={100} color={colors.primary3}/>} body={<View style={styles.body}>
          <Text type={"p2"} color={colors.warning} style={styles.warningText}>
            {LL.SendBitcoinDestinationScreen.confirmUsernameModal.warning({
                bankName: bankName,
            })}
          </Text>
        </View>} nonScrollingContent={<TouchableOpacity style={styles.checkBoxTouchable} onPress={function () { return setConfirmationEnabled(!confirmationEnabled); }}>
          <View style={styles.checkBoxContainer}>
            <CheckBox {...testProps(LL.SendBitcoinDestinationScreen.confirmUsernameModal.checkBox({
            lnAddress: lnAddress,
        }))} containerStyle={styles.checkBox} checked={confirmationEnabled} iconType="ionicon" checkedIcon={"checkbox"} uncheckedIcon={"square-outline"} onPress={function () { return setConfirmationEnabled(!confirmationEnabled); }}/>
            <Text testID="address-is-right" type={"p2"} style={styles.checkBoxText}>
              {LL.SendBitcoinDestinationScreen.confirmUsernameModal.checkBox({
                lnAddress: lnAddress,
            })}
            </Text>
          </View>
        </TouchableOpacity>} primaryButtonOnPress={confirmDestination} primaryButtonDisabled={!confirmationEnabled} primaryButtonTitle={LL.SendBitcoinDestinationScreen.confirmUsernameModal.confirmButton()} secondaryButtonTitle={LL.common.back()} secondaryButtonOnPress={goBack}/>);
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
        checkBox: {
            paddingLeft: 0,
            backgroundColor: "transparent",
        },
        checkBoxTouchable: {
            marginTop: 12,
        },
        checkBoxContainer: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: colors.grey5,
            borderRadius: 8,
        },
        checkBoxText: {
            flex: 1,
        },
    });
});
//# sourceMappingURL=confirm-destination-modal.js.map