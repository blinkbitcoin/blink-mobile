import * as React from "react";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useI18nContext } from "@app/i18n/i18n-react";
import { useSettingsScreenQuery } from "@app/graphql/generated";
import { OnboardingLayout } from "./onboarding-layout";
export var WelcomeLevel1Screen = function (_a) {
    var route = _a.route;
    var LL = useI18nContext().LL;
    var navigation = useNavigation();
    var _b = useSettingsScreenQuery(), data = _b.data, loading = _b.loading;
    var onboarding = route.params.onboarding;
    // Prevent back navigation
    useFocusEffect(React.useCallback(function () {
        var unsubscribe = navigation.addListener("beforeRemove", function (e) {
            if (e.data.action.type === "POP" || e.data.action.type === "GO_BACK") {
                e.preventDefault();
            }
        });
        return unsubscribe;
    }, [navigation]));
    var handlePrimaryAction = function () {
        var _a;
        navigation.navigate("onboarding", {
            screen: "emailBenefits",
            params: { onboarding: onboarding, hasUsername: Boolean((_a = data === null || data === void 0 ? void 0 : data.me) === null || _a === void 0 ? void 0 : _a.username) },
        });
    };
    return (<OnboardingLayout title={LL.OnboardingScreen.welcomeLevel1.title()} descriptions={[
            LL.OnboardingScreen.welcomeLevel1.receiveBitcoinDescription(),
            LL.OnboardingScreen.welcomeLevel1.dailyLimitDescription(),
            LL.OnboardingScreen.welcomeLevel1.onchainDescription(),
        ]} primaryLabel={LL.common.next()} primaryLoading={loading} onPrimaryAction={handlePrimaryAction} iconName="welcome"/>);
};
//# sourceMappingURL=welcome-level1-screen.js.map