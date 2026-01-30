import * as React from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Text, makeStyles } from "@rn-vui/themed";
import { useI18nContext } from "@app/i18n/i18n-react";
import { useRemoteConfig } from "@app/config/feature-flags-context";
import { OnboardingLayout } from "./onboarding-layout";
export var SupportOnboardingScreen = function (_a) {
    var _b, _c;
    var route = _a.route;
    var LL = useI18nContext().LL;
    var styles = useStyles();
    var navigation = useNavigation();
    var feedbackEmailAddress = useRemoteConfig().feedbackEmailAddress;
    var canGoBack = (_c = (_b = route.params) === null || _b === void 0 ? void 0 : _b.canGoBack) !== null && _c !== void 0 ? _c : true;
    var handlePrimaryAction = function () {
        navigation.replace("Primary");
    };
    var contactInfoString = LL.OnboardingScreen.supportScreen.description({
        email: feedbackEmailAddress,
    });
    var _d = contactInfoString.split(feedbackEmailAddress), prefix = _d[0], suffix = _d[1];
    // Prevent back navigation
    useFocusEffect(React.useCallback(function () {
        if (canGoBack)
            return;
        var unsubscribe = navigation.addListener("beforeRemove", function (e) {
            if (e.data.action.type === "POP" || e.data.action.type === "GO_BACK") {
                e.preventDefault();
            }
        });
        return unsubscribe;
    }, [navigation, canGoBack]));
    return (<OnboardingLayout title={LL.OnboardingScreen.supportScreen.title()} customContent={<Text type="h2" style={styles.descriptionText}>
          {prefix}
          <Text style={styles.linkText}>{feedbackEmailAddress}</Text>
          {suffix}
        </Text>} primaryLabel={LL.OnboardingScreen.supportScreen.primaryButton()} onPrimaryAction={handlePrimaryAction} iconName="support"/>);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        descriptionText: {
            color: colors.grey2,
            marginBottom: 15,
        },
        linkText: {
            color: colors.primary,
        },
    });
});
//# sourceMappingURL=support-screen.js.map