import React, { useState } from "react"
import { getReadableVersion } from "react-native-device-info"

import ContactModal, {
  SupportChannels,
} from "@app/components/contact-modal/contact-modal"
import { useAppConfig } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { isIos } from "@app/utils/helper"

import { SettingsRow } from "../row"

export const JoinCommunitySetting: React.FC = () => {
  const { LL } = useI18nContext()

  const { appConfig } = useAppConfig()
  const bankName = appConfig.galoyInstance.name

  const [isModalVisible, setIsModalVisible] = useState(false)
  const toggleModal = () => setIsModalVisible((x) => !x)

  const contactMessageBody = LL.support.defaultSupportMessage({
    os: isIos ? "iOS" : "Android",
    version: getReadableVersion(),
    bankName,
  })

  const contactMessageSubject = LL.support.defaultEmailSubject({
    bankName,
  })

  return (
    <>
      <SettingsRow
        title={LL.support.joinTheCommunity()}
        leftGaloyIcon="people"
        rightIcon={null}
        action={toggleModal}
      />
      <ContactModal
        isVisible={isModalVisible}
        toggleModal={toggleModal}
        messageBody={contactMessageBody}
        messageSubject={contactMessageSubject}
        supportChannels={[SupportChannels.Telegram, SupportChannels.Mattermost]}
      />
    </>
  )
}
