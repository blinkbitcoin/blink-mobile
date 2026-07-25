import React, { useCallback } from "react"
import { Linking } from "react-native"

import { useI18nContext } from "@app/i18n/i18n-react"
import { reportError } from "@app/utils/error-logging"

import { NotificationCardUI } from "../notifications/notification-card-ui"

const BLOG_URL = "https://www.blink.sv/blog/non-custodial-accounts-in-blink-wallet"

type SelfCustodialInfoBulletinProps = {
  onDismiss: () => void
}

export const SelfCustodialInfoBulletin: React.FC<SelfCustodialInfoBulletinProps> = ({
  onDismiss,
}) => {
  const { LL } = useI18nContext()

  const handleAction = useCallback(async () => {
    onDismiss()
    try {
      await Linking.openURL(BLOG_URL)
    } catch (err) {
      reportError("Open self-custodial info bulletin link", err)
    }
  }, [onDismiss])

  return (
    <NotificationCardUI
      title={LL.NonCustodialInfoBulletin.title()}
      text={LL.NonCustodialInfoBulletin.body()}
      action={handleAction}
      dismissAction={onDismiss}
      buttonLabel={LL.NonCustodialInfoBulletin.cta()}
    />
  )
}
