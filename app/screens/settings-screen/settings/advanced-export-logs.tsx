import React, { useRef, useState } from "react"

import { Text } from "@rn-vui/themed"

import CustomModal from "@app/components/custom-modal/custom-modal"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useI18nContext } from "@app/i18n/i18n-react"
import {
  ExportLogsOutcome,
  useExportSdkLogs,
} from "@app/self-custodial/hooks/use-export-sdk-logs"
import { AccountType } from "@app/types/wallet"
import { reportError } from "@app/utils/error-logging"
import { testProps } from "@app/utils/testProps"
import { toastShow } from "@app/utils/toast"

import { SettingsRow } from "../row"

/** The SDK log only exists for self-custodial wallets; the row shows in every account
 *  mode, Incognito included, so support can give one instruction. */
export const ExportLogsSetting: React.FC = () => {
  const { activeAccount } = useAccountRegistry()
  if (activeAccount?.type !== AccountType.SelfCustodial) return null
  return <ExportLogsRow />
}

const ExportLogsRow: React.FC = () => {
  const { LL } = useI18nContext()
  const { exportLogs, loading } = useExportSdkLogs()
  const [isDisclosureVisible, setIsDisclosureVisible] = useState(false)
  /** Set by the confirm button and read once the disclosure is off the screen: iOS will
   *  not present the share sheet over a modal that is still animating out. */
  const shouldExportOnHide = useRef(false)

  const confirm = () => {
    shouldExportOnHide.current = true
    setIsDisclosureVisible(false)
  }

  const close = () => setIsDisclosureVisible(false)

  const exportAfterHide = async () => {
    if (!shouldExportOnHide.current) return
    shouldExportOnHide.current = false
    try {
      const outcome = await exportLogs()
      if (outcome === ExportLogsOutcome.NoLogs) {
        toastShow({ message: (tr) => tr.support.noLogsYet(), LL, type: "warning" })
      }
    } catch (err: unknown) {
      reportError("self-custodial-export-logs", err)
      toastShow({ message: (tr) => tr.support.exportLogsError(), LL })
    }
  }

  return (
    <>
      <SettingsRow
        spinner={loading}
        title={LL.support.downloadLogs()}
        leftGaloyIcon="document-outline"
        rightIcon={"download"}
        action={() => setIsDisclosureVisible(true)}
      />
      <CustomModal
        isVisible={isDisclosureVisible}
        toggleModal={close}
        title={LL.support.exportLogsTitle()}
        body={<Text type="p2">{LL.support.exportLogsBody()}</Text>}
        primaryButtonTitle={LL.support.exportLogsConfirm()}
        primaryButtonOnPress={confirm}
        secondaryButtonTitle={LL.common.cancel()}
        secondaryButtonOnPress={close}
        onModalHide={exportAfterHide}
        {...testProps("export-logs-disclosure")}
      />
    </>
  )
}
