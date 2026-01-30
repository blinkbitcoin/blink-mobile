import * as React from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useI18nContext } from "@app/i18n/i18n-react";
import { OnboardingLayout } from "./onboarding-layout";
export var LightningBenefitsScreen = function (_a) {
    var route = _a.route;
    var LL = useI18nContext().LL;
    var navigation = useNavigation();
    var _b = route.params, onboarding = _b.onboarding, _c = _b.canGoBack, canGoBack = _c === void 0 ? true : _c;
    var handlePrimaryAction = function () {
        navigation.navigate("setLightningAddress", {
            onboarding: onboarding,
        });
    };
    var handleSecondaryAction = function () {
        navigation.navigate("onboarding", {
            screen: "supportScreen",
        });
    };
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
    return (<OnboardingLayout title={LL.OnboardingScreen.lightningBenefits.title()} descriptions={[
            LL.OnboardingScreen.lightningBenefits.staticAddressDescription(),
            LL.OnboardingScreen.lightningBenefits.easyToShareDescription(),
            LL.OnboardingScreen.lightningBenefits.blinkToolsDescription(),
        ]} primaryLabel={LL.OnboardingScreen.lightningBenefits.primaryButton()} onPrimaryAction={handlePrimaryAction} secondaryLabel={LL.UpgradeAccountModal.notNow()} onSecondaryAction={handleSecondaryAction} iconName="lightning-address"/>);
};
//# sourceMappingURL=lightning-address-benefits-screen.js.map