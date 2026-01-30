import * as React from "react";
import { SafeAreaView, View } from "react-native";
import ReactNativeModal from "react-native-modal";
import { timing } from "@app/rne-theme/timing";
import { ListItem, makeStyles, useTheme, Text } from "@rn-vui/themed";
import Icon from "react-native-vector-icons/Ionicons";
import { GaloyIconButton } from "../atomic/galoy-icon-button";
import { useI18nContext } from "@app/i18n/i18n-react";
export var ExpirationTimeModal = function (_a) {
    var value = _a.value, onSetExpirationTime = _a.onSetExpirationTime, walletCurrency = _a.walletCurrency, isOpen = _a.isOpen, close = _a.close;
    var colors = useTheme().theme.colors;
    var styles = useStyles();
    var LL = useI18nContext().LL;
    var btcExpirationList = [
        {
            name: "24 ".concat(LL.common.hours()),
            minutes: 24 * 60, // 1440
        },
        {
            name: "12 ".concat(LL.common.hours()),
            minutes: 12 * 60, // 720
        },
        {
            name: "4 ".concat(LL.common.hours()),
            minutes: 4 * 60, // 240
        },
        {
            name: "1 ".concat(LL.common.hour()),
            minutes: 60,
        },
    ];
    var usdExpirationList = [
        {
            name: "5 ".concat(LL.common.minutes()),
            minutes: 5,
        },
    ];
    var expirationList = walletCurrency === "USD" ? usdExpirationList : btcExpirationList;
    return (<ReactNativeModal isVisible={isOpen} coverScreen={true} style={styles.modal} animationInTiming={timing.quick}>
      <SafeAreaView style={styles.amountInputScreenContainer}>
        <View style={styles.headerContainer}>
          <Text type={"h1"}>{LL.common.expirationTime()}</Text>
          <GaloyIconButton iconOnly={true} size={"medium"} name="close" onPress={close}/>
        </View>
        {expirationList.map(function (_a, index) {
            var name = _a.name, minutes = _a.minutes;
            return (<ListItem key={index} onPress={function () { return (onSetExpirationTime ? onSetExpirationTime(minutes) : null); }} bottomDivider>
            {value === minutes ? (<Icon name="checkmark-circle" size={18} color={colors._green}/>) : (<View style={styles.emptySpacer}/>)}
            <ListItem.Content>
              <ListItem.Title>{name}</ListItem.Title>
            </ListItem.Content>
          </ListItem>);
        })}
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
        headerContainer: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            padding: 16,
            borderBottomColor: colors.primary4,
            borderBottomWidth: 1,
        },
        emptySpacer: {
            width: 18,
        },
    });
});
//# sourceMappingURL=expiration-time-modal.js.map