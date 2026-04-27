import React, { useState } from "react"
import { getReadableVersion } from "react-native-device-info"

import ContactModal, {
  SupportChannels,
} from "@app/components/contact-modal/contact-modal"
import { useAppConfig } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useSettingsScreenQuery } from "@app/graphql/generated"
import { isIos } from "@app/utils/helper"

import { SettingsRow } from "../row"

export const NeedHelpSetting: React.FC = () => {
  const { LL } = useI18nContext()
  const { data } = useSettingsScreenQuery()

  const { appConfig } = useAppConfig()
  const bankName = appConfig.galoyInstance.name

  const [isModalVisible, setIsModalVisible] = useState(false)
  const toggleModal = () => setIsModalVisible((x) => !x)

  const accountId = data?.me?.defaultAccount?.id || "Unknown"

  const contactMessageBody = LL.support.defaultSupportMessage({
    accountId,
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
        title={LL.support.contactUs()}
        leftGaloyIcon="headset"
        action={toggleModal}
      />
      <ContactModal
        isVisible={isModalVisible}
        toggleModal={toggleModal}
        messageBody={contactMessageBody}
        messageSubject={contactMessageSubject}
        supportChannels={[
          SupportChannels.Faq,
          SupportChannels.StatusPage,
          SupportChannels.Email,
        ]}
      />
    </>
  )
}
