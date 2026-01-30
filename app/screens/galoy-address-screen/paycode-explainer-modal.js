import React from "react";
import { View, TouchableOpacity } from "react-native";
import Modal from "react-native-modal";
import { GaloyIcon } from "@app/components/atomic/galoy-icon";
import { useI18nContext } from "@app/i18n/i18n-react";
import { makeStyles, Text, useTheme } from "@rn-vui/themed";
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        modalView: {
            backgroundColor: colors.white,
            maxFlex: 1,
            maxHeight: "75%",
            borderRadius: 16,
            padding: 20,
        },
        titleContainer: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
        },
        walletsContainer: {
            paddingLeft: 10,
        },
        bodyText: {
            fontSize: 18,
            fontWeight: "400",
        },
    });
});
var wallets = ["Muun", "Chivo", "Strike"];
export var PayCodeExplainerModal = function (_a) {
    var modalVisible = _a.modalVisible, toggleModal = _a.toggleModal;
    var LL = useI18nContext().LL;
    var colors = useTheme().theme.colors;
    var styles = useStyles();
    return (<Modal isVisible={modalVisible} backdropOpacity={0.3} backdropColor={colors.grey3} onBackdropPress={toggleModal} swipeDirection={modalVisible ? ["down"] : ["up"]}>
      <View style={styles.modalView}>
        <View style={styles.titleContainer}>
          <Text type="h1" bold>
            {LL.GaloyAddressScreen.howToUseYourPaycode()}
          </Text>
          <TouchableOpacity onPress={toggleModal}>
            <GaloyIcon name="close" size={32} color={colors.black}/>
          </TouchableOpacity>
        </View>
        <Text style={styles.bodyText}>
          {LL.GaloyAddressScreen.howToUseYourPaycodeExplainer()}
        </Text>
        <Text style={styles.bodyText}>
          {wallets.map(function (wallet) { return (<Text key={wallet} style={styles.bodyText}>
              {"\n\u2022 "}
              {wallet}
            </Text>); })}
        </Text>
      </View>
    </Modal>);
};
//# sourceMappingURL=paycode-explainer-modal.js.map