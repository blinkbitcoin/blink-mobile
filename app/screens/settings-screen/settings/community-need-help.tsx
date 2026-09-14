import React, { useState } from "react"
import { getReadableVersion } from "react-native-device-info"

import ContactModal, {
  SupportChannels,
} from "@app/components/contact-modal/contact-modal"
import { DisabledFeature } from "@app/components/disabled-feature"
import { useEnhancedModePrompt } from "@app/components/enhanced-mode-prompt"
import { useAppConfig } from "@app/hooks"
import { useSelfCustodialAccountMode } from "@app/self-custodial/hooks/use-self-custodial-account-mode"
import { useI18nContext } from "@app/i18n/i18n-react"
import { isIos } from "@app/utils/helper"

import { SettingsRow } from "../row"

export const NeedHelpSetting: React.FC = () => {
  const { LL } = useI18nContext()
  const { isAnonMode } = useSelfCustodialAccountMode()
  const { promptEnhancedMode } = useEnhancedModePrompt()

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
      <DisabledFeature
        disabled={isAnonMode}
        onDisabledPress={promptEnhancedMode}
        accessibilityLabel={LL.support.contactUs()}
      >
        <SettingsRow
          title={LL.support.contactUs()}
          leftGaloyIcon="headset"
          action={toggleModal}
        />
      </DisabledFeature>
      <ContactModal
        isVisible={isModalVisible}
        toggleModal={toggleModal}
        messageBody={contactMessageBody}
        messageSubject={contactMessageSubject}
        supportChannels={[
          SupportChannels.Faq,
          SupportChannels.StatusPage,
          SupportChannels.EmailCopy,
        ]}
      />
    </>
  )
}
