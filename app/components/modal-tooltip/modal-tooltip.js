import * as React from "react";
import { View, TouchableOpacity } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import Modal from "react-native-modal";
import Icon from "react-native-vector-icons/Ionicons";
import { useAppConfig } from "@app/hooks";
import { useI18nContext } from "@app/i18n/i18n-react";
import { Text, makeStyles, useTheme } from "@rn-vui/themed";
export var ModalTooltip = function (_a) {
    var size = _a.size, type = _a.type, title = _a.title, text = _a.text;
    var colors = useTheme().theme.colors;
    var LL = useI18nContext().LL;
    var bankName = useAppConfig().appConfig.galoyInstance.name;
    var _b = React.useState(false), isVisible = _b[0], setIsVisible = _b[1];
    var toggleModal = function () { return setIsVisible(!isVisible); };
    var styles = useStyles();
    var iconParams;
    var defaultTitle;
    switch (type) {
        case "info":
            iconParams = {
                name: "information-circle-outline",
                type: "ionicons",
            };
            defaultTitle = LL.common.bankInfo({ bankName: bankName });
            break;
        case "advice":
            iconParams = {
                name: "bulb-outline",
                type: "ionicon",
            };
            defaultTitle = LL.common.bankAdvice({ bankName: bankName });
            break;
    }
    var modalTitle = title || defaultTitle;
    return (<>
      <Icon color={type === "info" ? colors.black : colors.error} size={size} {...iconParams} onPress={toggleModal}/>
      <Modal isVisible={isVisible} onBackdropPress={toggleModal} coverScreen style={styles.modalStyle} backdropOpacity={0.3} backdropColor={colors.grey3}>
        <TouchableOpacity style={styles.fillerOpacity} onPress={toggleModal}/>
        <View style={styles.modalCard}>
          <View style={styles.modalTitleContainer}>
            <Icon size={24} {...iconParams} style={styles.iconContainer}/>
            <Text type={"h1"}>{modalTitle}</Text>
          </View>
          <ScrollView>
            <Text type={"p1"}>{text}</Text>
          </ScrollView>
        </View>
      </Modal>
    </>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        modalStyle: {
            margin: 0,
            flexDirection: "column",
            justifyContent: "flex-end",
        },
        fillerOpacity: {
            flex: 1,
        },
        modalCard: {
            backgroundColor: colors.white,
            maxFlex: 2,
            borderTopLeftRadius: 40,
            borderTopRightRadius: 40,
            padding: 24,
        },
        modalTitleContainer: {
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 10,
        },
        iconContainer: {
            color: colors.black,
            marginRight: 12,
        },
    });
});
//# sourceMappingURL=modal-tooltip.js.map