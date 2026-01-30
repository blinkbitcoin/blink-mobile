import React, { useState } from "react";
import { getReadableVersion } from "react-native-device-info";
import { useAppConfig } from "@app/hooks";
import { useI18nContext } from "@app/i18n/i18n-react";
import { isIos } from "@app/utils/helper";
import { GaloyTertiaryButton } from "../atomic/galoy-tertiary-button";
import ContactModal, { SupportChannels } from "../contact-modal/contact-modal";
export var ContactSupportButton = function (_a) {
    var containerStyle = _a.containerStyle;
    var _b = useState(false), showContactSupport = _b[0], setShowContactSupport = _b[1];
    var LL = useI18nContext().LL;
    var appConfig = useAppConfig().appConfig;
    var bankName = appConfig.galoyInstance.name;
    var messageBody = LL.support.defaultSupportMessage({
        os: isIos ? "iOS" : "Android",
        version: getReadableVersion(),
        bankName: bankName,
    });
    var messageSubject = LL.support.defaultEmailSubject({
        bankName: bankName,
    });
    return (<>
      <ContactModal messageBody={messageBody} messageSubject={messageSubject} isVisible={showContactSupport} toggleModal={function () { return setShowContactSupport(!showContactSupport); }} supportChannels={[
            SupportChannels.Faq,
            SupportChannels.StatusPage,
            SupportChannels.Email,
        ]}/>
      <GaloyTertiaryButton containerStyle={containerStyle} title={LL.support.contactUs()} onPress={function () { return setShowContactSupport(true); }}/>
    </>);
};
//# sourceMappingURL=contact-support-button.js.map