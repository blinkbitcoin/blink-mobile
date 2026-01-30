import { AccountLevel, useLevel } from "@app/graphql/level-context";
import { useI18nContext } from "@app/i18n/i18n-react";
import { useNavigation } from "@react-navigation/native";
import { SettingsRow } from "../../row";
export var UpgradeAccountLevelOne = function () {
    var currentLevel = useLevel().currentLevel;
    var LL = useI18nContext().LL;
    var navigate = useNavigation().navigate;
    if (currentLevel !== AccountLevel.One)
        return <></>;
    return (<SettingsRow title={LL.AccountScreen.identityVerification()} leftGaloyIcon="upgrade" action={function () { return navigate("fullOnboardingFlow"); }}/>);
};
//# sourceMappingURL=upgrade.js.map