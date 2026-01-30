var _a;
import * as React from "react";
import { useMemo } from "react";
import { ActivityIndicator, useWindowDimensions, View, Platform, Pressable, Animated, Easing, } from "react-native";
import QRCode from "react-native-qrcode-svg";
import Logo from "@app/assets/logo/blink-logo-icon.png";
import { GaloyIcon } from "@app/components/atomic/galoy-icon";
import { GaloyTertiaryButton } from "@app/components/atomic/galoy-tertiary-button";
import { SuccessIconAnimation } from "@app/components/success-animation";
import { useI18nContext } from "@app/i18n/i18n-react";
import { makeStyles, Text, useTheme } from "@rn-vui/themed";
import { testProps } from "../../utils/testProps";
import { Invoice } from "./payment/index.types";
var configByType = (_a = {},
    _a[Invoice.Lightning] = {
        copyToClipboardLabel: "ReceiveScreen.copyClipboard",
        shareButtonLabel: "common.shareLightning",
        ecl: "L",
        icon: "flash",
    },
    _a[Invoice.OnChain] = {
        copyToClipboardLabel: "ReceiveScreen.copyClipboardBitcoin",
        shareButtonLabel: "common.shareBitcoin",
        ecl: "M",
        icon: "logo-bitcoin",
    },
    // TODO: Add them
    _a[Invoice.PayCode] = {
        copyToClipboardLabel: "ReceiveScreen.copyClipboardBitcoin",
        shareButtonLabel: "common.shareBitcoin",
        ecl: "M",
        icon: "logo-bitcoin",
    },
    _a);
export var QRView = function (_a) {
    var type = _a.type, getFullUri = _a.getFullUri, loading = _a.loading, completed = _a.completed, err = _a.err, _b = _a.size, size = _b === void 0 ? 280 : _b, style = _a.style, expired = _a.expired, regenerateInvoiceFn = _a.regenerateInvoiceFn, copyToClipboard = _a.copyToClipboard, isPayCode = _a.isPayCode, canUsePayCode = _a.canUsePayCode, toggleIsSetLightningAddressModalVisible = _a.toggleIsSetLightningAddressModalVisible;
    var colors = useTheme().theme.colors;
    var isPayCodeAndCanUsePayCode = isPayCode && canUsePayCode;
    var isReady = (!isPayCodeAndCanUsePayCode || Boolean(getFullUri)) && !loading && !err;
    var displayingQR = !completed && isReady && !expired && (!isPayCode || isPayCodeAndCanUsePayCode);
    var styles = useStyles();
    var scale = useWindowDimensions().scale;
    var LL = useI18nContext().LL;
    var scaleAnim = React.useRef(new Animated.Value(1)).current;
    var breatheIn = function () {
        Animated.timing(scaleAnim, {
            toValue: 0.95,
            duration: 200,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.quad),
        }).start();
    };
    var breatheOut = function () {
        if (!expired && copyToClipboard)
            copyToClipboard();
        Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.quad),
        }).start();
    };
    var renderSuccessView = useMemo(function () {
        if (completed) {
            return (<View {...testProps("Success Icon")} style={[styles.container, style]}>
          <SuccessIconAnimation>
            <GaloyIcon name={"payment-success"} size={128}/>
          </SuccessIconAnimation>
        </View>);
        }
        return null;
    }, [completed, styles, style]);
    var renderQRCode = useMemo(function () {
        var getQrLogo = function () {
            if (type === Invoice.OnChain)
                return Logo;
            if (type === Invoice.Lightning)
                return Logo;
            if (type === Invoice.PayCode)
                return Logo;
            return null;
        };
        var qrSize = Platform.OS === "android" && scale > 3 ? 240 : size;
        if (displayingQR && getFullUri) {
            var uri = getFullUri({ uppercase: true });
            return (<View style={[styles.container, style]} {...testProps("QR-Code")}>
          <QRCode size={qrSize} value={uri} logoBackgroundColor="white" ecl={type && configByType[type].ecl} logo={getQrLogo() || undefined} logoSize={60} logoBorderRadius={10}/>
        </View>);
        }
        return null;
    }, [displayingQR, type, getFullUri, size, scale, styles, style]);
    var renderStatusView = useMemo(function () {
        if (!completed && !isReady) {
            return (<View style={[styles.container, style]}>
          <View style={styles.errorContainer}>
            {(err !== "" && (<Text style={styles.error} selectable>
                {err}
              </Text>)) || <ActivityIndicator size="large" color={colors.primary}/>}
          </View>
        </View>);
        }
        else if (expired) {
            return (<View style={[styles.container, style]}>
          <Text type="p2" style={styles.expiredInvoice}>
            {LL.ReceiveScreen.invoiceHasExpired()}
          </Text>
          <GaloyTertiaryButton title={LL.ReceiveScreen.regenerateInvoiceButtonTitle()} onPress={regenerateInvoiceFn}></GaloyTertiaryButton>
        </View>);
        }
        else if (isPayCode && !canUsePayCode) {
            return (<View style={[styles.container, styles.cantUsePayCode, style]}>
          <Text type="p2" style={styles.cantUsePayCodeText}>
            {LL.ReceiveScreen.setUsernameToAcceptViaPaycode()}
          </Text>
          <GaloyTertiaryButton title={LL.ReceiveScreen.setUsernameButtonTitle()} onPress={toggleIsSetLightningAddressModalVisible}></GaloyTertiaryButton>
        </View>);
        }
        return null;
    }, [
        err,
        isReady,
        completed,
        styles,
        style,
        colors,
        expired,
        isPayCode,
        canUsePayCode,
        LL.ReceiveScreen,
        regenerateInvoiceFn,
        toggleIsSetLightningAddressModalVisible,
    ]);
    return (<View style={styles.qr}>
      <Pressable onPressIn={displayingQR ? breatheIn : function () { }} onPressOut={displayingQR ? breatheOut : function () { }}>
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          {renderSuccessView}
          {renderQRCode}
          {renderStatusView}
        </Animated.View>
      </Pressable>
    </View>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        container: {
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: colors._white,
            width: "100%",
            height: undefined,
            borderRadius: 10,
            aspectRatio: 1,
            alignSelf: "center",
            padding: 16,
        },
        containerSuccess: {
            backgroundColor: colors.white,
        },
        errorContainer: {
            justifyContent: "center",
            height: "100%",
        },
        error: { color: colors.error, alignSelf: "center" },
        qr: {
            alignItems: "center",
        },
        expiredInvoice: {
            marginBottom: 10,
        },
        cantUsePayCode: {
            padding: "10%",
        },
        cantUsePayCodeText: {
            marginBottom: 10,
        },
    });
});
export default React.memo(QRView);
//# sourceMappingURL=qr-view.js.map