import * as React from "react";
import { useNavigation } from "@react-navigation/native";
import { useI18nContext } from "@app/i18n/i18n-react";
import { OnboardingLayout } from "./onboarding-layout";
export var EmailBenefitsScreen = function (_a) {
    var route = _a.route;
    var LL = useI18nContext().LL;
    var navigation = useNavigation();
    var _b = route.params, onboarding = _b.onboarding, _c = _b.hasUsername, hasUsername = _c === void 0 ? false : _c;
    var handlePrimaryAction = function () {
        navigation.navigate("emailRegistrationInitiate", {
            onboarding: onboarding,
            hasUsername: hasUsername,
        });
    };
    var handleSecondaryAction = function () {
        if (hasUsername) {
            navigation.navigate("onboarding", {
                screen: "supportScreen",
            });
            return;
        }
        navigation.navigate("onboarding", {
            screen: "lightningBenefits",
            params: { onboarding: onboarding },
        });
    };
    return (<OnboardingLayout title={LL.OnboardingScreen.emailBenefits.title()} descriptions={[
            LL.OnboardingScreen.emailBenefits.backupDescription(),
            LL.OnboardingScreen.emailBenefits.supportDescription(),
            LL.OnboardingScreen.emailBenefits.securityDescription(),
        ]} primaryLabel={LL.OnboardingScreen.emailBenefits.primaryButton()} onPrimaryAction={handlePrimaryAction} secondaryLabel={LL.UpgradeAccountModal.notNow()} onSecondaryAction={handleSecondaryAction} iconName="email-add"/>);
};
//# sourceMappingURL=email-benefits-screen.js.map