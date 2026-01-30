import { Linking, Pressable, Share, View } from "react-native";
import { GaloyIcon } from "@app/components/atomic/galoy-icon";
import { useI18nContext } from "@app/i18n/i18n-react";
import { toastShow } from "@app/utils/toast";
import Clipboard from "@react-native-clipboard/clipboard";
import { makeStyles, Text, useTheme } from "@rn-vui/themed";
var addressTypes = {
    lightning: "lightning",
    pos: "pos",
    paycode: "paycode",
};
var AddressComponent = function (_a) {
    var address = _a.address, addressType = _a.addressType, title = _a.title, onToggleDescription = _a.onToggleDescription, useGlobeIcon = _a.useGlobeIcon;
    var LL = useI18nContext().LL;
    var colors = useTheme().theme.colors;
    var styles = useStyles();
    var trimmedUrl = address.includes("https://") || address.includes("http://")
        ? address.replace("https://", "")
        : address;
    var copyToClipboard = function () {
        Clipboard.setString(address);
        toastShow({
            message: function (translations) {
                switch (addressType) {
                    case addressTypes.lightning:
                        return translations.GaloyAddressScreen.copiedLightningAddressToClipboard();
                    case addressTypes.pos:
                        return translations.GaloyAddressScreen.copiedCashRegisterLinkToClipboard();
                    case addressTypes.paycode:
                        return translations.GaloyAddressScreen.copiedPaycodeToClipboard();
                }
            },
            type: "success",
            LL: LL,
        });
    };
    return (<View style={styles.container}>
      <View style={styles.titleContainer}>
        <Text style={styles.addressTitle} type="p1">
          {title}
        </Text>
        <Pressable onPress={onToggleDescription} style={styles.descriptionContainer}>
          <Text style={styles.descriptionText}>{LL.GaloyAddressScreen.howToUseIt()}</Text>
          <GaloyIcon name="question" color={styles.descriptionText.color} size={20}/>
        </Pressable>
      </View>
      <View style={styles.infoContainer}>
        <Text style={styles.address} bold type="p3">
          {trimmedUrl}
        </Text>
        <View style={styles.iconsContainer}>
          {useGlobeIcon && (<Pressable onPress={function () { return Linking.openURL(address); }}>
              <GaloyIcon name="globe" size={20} color={colors.black}/>
            </Pressable>)}
          <Pressable onPress={copyToClipboard}>
            <GaloyIcon name="copy-paste" size={20} color={colors.black}/>
          </Pressable>
          <Pressable onPress={function () {
            Share.share({
                url: address,
                message: address,
            });
        }}>
            <GaloyIcon name="share" size={20} color={colors.black}/>
          </Pressable>
        </View>
      </View>
    </View>);
};
export default AddressComponent;
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        container: {
            display: "flex",
            flexDirection: "column",
            rowGap: 20,
            width: "100%",
        },
        titleContainer: {
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
        },
        addressTitle: {
            fontSize: 16,
            lineHeight: 24,
            flexShrink: 1,
        },
        infoContainer: {
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
            backgroundColor: colors.grey5,
            paddingVertical: 16,
            paddingHorizontal: 8,
            borderRadius: 8,
            columnGap: 20,
        },
        address: {
            color: colors.black,
            fontSize: 14,
            lineHeight: 24,
        },
        descriptionContainer: {
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            columnGap: 5,
        },
        descriptionText: {
            color: colors.primary,
            textDecorationLine: "underline",
            fontSize: 14,
            lineHeight: 18,
            fontWeight: "600",
        },
        iconsContainer: {
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            columnGap: 20,
        },
    });
});
//# sourceMappingURL=address-component.js.map