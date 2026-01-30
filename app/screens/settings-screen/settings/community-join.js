import React, { useState } from "react";
import { getReadableVersion } from "react-native-device-info";
import ContactModal, { SupportChannels, } from "@app/components/contact-modal/contact-modal";
import { useAppConfig } from "@app/hooks";
import { useI18nContext } from "@app/i18n/i18n-react";
import { isIos } from "@app/utils/helper";
import { SettingsRow } from "../row";
export var JoinCommunitySetting = function () {
    var LL = useI18nContext().LL;
    var appConfig = useAppConfig().appConfig;
    var bankName = appConfig.galoyInstance.name;
    var _a = useState(false), isModalVisible = _a[0], setIsModalVisible = _a[1];
    var toggleModal = function () { return setIsModalVisible(function (x) { return !x; }); };
    var contactMessageBody = LL.support.defaultSupportMessage({
        os: isIos ? "iOS" : "Android",
        version: getReadableVersion(),
        bankName: bankName,
    });
    var contactMessageSubject = LL.support.defaultEmailSubject({
        bankName: bankName,
    });
    return (<>
      <SettingsRow title={LL.support.joinTheCommunity()} leftGaloyIcon="people" action={toggleModal}/>
      <ContactModal isVisible={isModalVisible} toggleModal={toggleModal} messageBody={contactMessageBody} messageSubject={contactMessageSubject} supportChannels={[SupportChannels.Telegram, SupportChannels.Mattermost]}/>
    </>);
};
//# sourceMappingURL=community-join.js.map