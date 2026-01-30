import * as React from "react";
import { Linking, View } from "react-native";
import Modal from "react-native-modal";
import { useI18nContext } from "@app/i18n/i18n-react";
import { useCirclesCard } from "@app/screens/people-screen/circles/use-circles-card";
import { makeStyles, useTheme, Text } from "@rn-vui/themed";
import { GaloyIcon } from "../atomic/galoy-icon";
import { GaloyIconButton } from "../atomic/galoy-icon-button";
import { GaloyPrimaryButton } from "../atomic/galoy-primary-button";
import { GaloyToast } from "../galoy-toast";
var CHALLENGE_PAGE = "blink.sv/circles";
var CHALLENGE_PAGE_URL = "https://www.blink.sv/circles";
var SOCIAL_LINK_TREE = "https://linktr.ee/blinkbtc";
export var MayChallengeModal = function (_a) {
    var isVisible = _a.isVisible, setIsVisible = _a.setIsVisible;
    var LL = useI18nContext().LL;
    var colors = useTheme().theme.colors;
    var styles = useStyles();
    var acknowledgeModal = function () {
        setIsVisible(false);
    };
    var _b = useCirclesCard(), ShareImg = _b.ShareImg, share = _b.share;
    return (<Modal isVisible={isVisible} backdropOpacity={0.8} backdropTransitionOutTiming={0} backdropColor={colors.white} onBackdropPress={acknowledgeModal}>
      <View style={styles.modalCard}>
        <View style={styles.container}>
          <GaloyIconButton style={styles.cross} name="close" size="medium" onPress={acknowledgeModal}/>
          <GaloyIcon style={styles.top} name="rank" size={40} color={colors.primary}/>
          <Text type="h1" bold>
            {LL.Circles.mayChallenge.title()}
          </Text>
          <Text type="p1" style={styles.details}>
            {LL.Circles.mayChallenge.details()}
          </Text>
          {ShareImg}
          <GaloyPrimaryButton onPress={share} title={LL.Circles.shareCircles()}/>
          <Text style={styles.reminder} type="p3" color={colors.grey3}>
            {LL.Circles.connectOnSocial()}
            <Text style={styles.underline} color={colors.grey3} onPress={function () { return Linking.openURL(SOCIAL_LINK_TREE); }}>
              {SOCIAL_LINK_TREE}
            </Text>
          </Text>
          <Text style={styles.reminder} type="p3">
            {LL.Circles.fullDetails()}
            <Text style={styles.underline} color={colors.grey3} onPress={function () { return Linking.openURL(CHALLENGE_PAGE_URL); }}>
              {CHALLENGE_PAGE}
            </Text>
          </Text>
        </View>
      </View>
      <GaloyToast />
    </Modal>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        container: {
            paddingHorizontal: 12,
            display: "flex",
            flexDirection: "column",
            rowGap: 20,
            justifyContent: "center",
            alignItems: "center",
        },
        cross: {
            position: "absolute",
            right: 20,
            top: -10,
        },
        top: { marginTop: 40 },
        modalCard: {
            backgroundColor: colors.grey5,
            borderRadius: 16,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            paddingVertical: 30,
        },
        details: {
            textAlign: "center",
            paddingHorizontal: 20,
        },
        reminder: {
            textAlign: "center",
            paddingHorizontal: 20,
            color: colors.grey2,
        },
        underline: {
            textDecorationLine: "underline",
        },
        containerData: {
            display: "flex",
            flexDirection: "column",
            rowGap: 2,
            justifyContent: "center",
            alignItems: "center",
        },
    });
});
//# sourceMappingURL=modal.js.map