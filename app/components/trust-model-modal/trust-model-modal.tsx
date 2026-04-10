import React from "react"

import { makeStyles, Text } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { InfoBanner } from "@app/components/info-banner"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"

import CustomModal from "../custom-modal/custom-modal"

type TrustModelModalProps = {
  isVisible: boolean
  onDismiss: () => void
}

export const TrustModelModal: React.FC<TrustModelModalProps> = ({
  isVisible,
  onDismiss,
}) => {
  const { LL } = useI18nContext()
  const styles = useStyles()

  return (
    <CustomModal
      isVisible={isVisible}
      toggleModal={onDismiss}
      showCloseIconButton={false}
      image={<GaloyIcon name="key-outline" size={40} />}
      title={LL.BackupNudge.trustModelTitle()}
      body={
        <>
          <Text style={styles.description}>{LL.BackupNudge.trustModelDescription()}</Text>
          <InfoBanner icon="warning" title={LL.BackupScreen.CloudBackup.importantTitle()}>
            {LL.BackupNudge.trustModelWarning()}
          </InfoBanner>
        </>
      }
      primaryButtonTitle={LL.BackupNudge.trustModelDismiss()}
      primaryButtonOnPress={onDismiss}
      {...testProps("trust-model-modal")}
    />
  )
}

const useStyles = makeStyles(({ colors }) => ({
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.black,
    textAlign: "center",
    marginBottom: 16,
  },
}))
