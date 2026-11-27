import * as React from "react"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useI18nContext } from "@app/i18n/i18n-react"
import { WindDownReason } from "@app/types/wind-down"
import { formatDayAndMonth } from "@app/utils/date"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import CustomModal from "../custom-modal/custom-modal"

type MigrateNowModalProps = {
  isVisible: boolean
  toggleModal: () => void
  /** Starts the guided migration flow; the caller owns the navigation. */
  onMigrate: () => void
  /** Wind-down final deadline as a Unix timestamp in seconds, served by the backend. */
  deadlineTimestamp: number
  /** IANA timezone the backend defines for rendering region dates. */
  timezone?: string
  /** Why the account is wound down: LEVEL_ZERO gets the trial copy, anything else the
   *  region copy. */
  reason?: WindDownReason
}

export const MigrateNowModal: React.FC<MigrateNowModalProps> = ({
  isVisible,
  toggleModal,
  onMigrate,
  deadlineTimestamp,
  timezone,
  reason,
}) => {
  const { LL, locale } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const deadlineDate = formatDayAndMonth({
    timestampSeconds: deadlineTimestamp,
    locale,
    timezone,
  })

  return (
    <CustomModal
      isVisible={isVisible}
      toggleModal={toggleModal}
      image={<GaloyIcon name="warning" size={80} color={colors.warning} />}
      title={LL.AccountMigration.migrateNowModal.title()}
      body={
        <Text style={styles.body}>
          {reason === WindDownReason.LevelZero
            ? LL.AccountMigration.migrateNowModal.bodyLevelZero({ date: deadlineDate })
            : LL.AccountMigration.migrateNowModal.body({ date: deadlineDate })}
        </Text>
      }
      primaryButtonTitle={LL.AccountMigration.migrateNowModal.migrateCta()}
      primaryButtonOnPress={onMigrate}
      showCloseIconButton={true}
    />
  )
}

const useStyles = makeStyles(({ colors }) => ({
  body: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
    color: colors.textOnBackground,
  },
}))
