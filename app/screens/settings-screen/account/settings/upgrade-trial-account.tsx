import { useState } from "react"
import { View } from "react-native"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { UpgradeAccountModal } from "@app/components/upgrade-account-modal"
import { AccountLevel, useLevel } from "@app/graphql/level-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { makeStyles, Text } from "@rn-vui/themed"

import { useShowWarningSecureAccount } from "../show-warning-secure-account-hook"

export const UpgradeTrialAccount: React.FC = () => {
  const styles = useStyles()
  const { currentLevel } = useLevel()
  const { LL } = useI18nContext()
  const hasBalance = useShowWarningSecureAccount()

  const [upgradeAccountModalVisible, setUpgradeAccountModalVisible] = useState(false)
  const closeUpgradeAccountModal = () => setUpgradeAccountModalVisible(false)
  const openUpgradeAccountModal = () => setUpgradeAccountModalVisible(true)

  if (currentLevel !== AccountLevel.Zero) return <></>

  return (
    <>
      <UpgradeAccountModal
        isVisible={upgradeAccountModalVisible}
        closeModal={closeUpgradeAccountModal}
      />
      <View style={styles.container}>
        <View style={styles.sideBySide}>
          <Text type="h2" bold>
            {LL.common.trialAccount()}
          </Text>
          <GaloyIcon name="warning" size={30} />
        </View>
        <Text type="p3">{LL.AccountScreen.itsATrialAccount()}</Text>
        {hasBalance && (
          <Text type="p3">⚠️ {LL.AccountScreen.fundsMoreThan5Dollars()}</Text>
        )}
        <GaloySecondaryButton
          title={LL.common.backupAccount()}
          iconName="caret-right"
          iconPosition="right"
          containerStyle={styles.selfCenter}
          onPress={openUpgradeAccountModal}
        />
      </View>
    </>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    borderRadius: 20,
    backgroundColor: colors.grey5,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "flex-start",
    rowGap: 10,
  },
  selfCenter: { alignSelf: "center" },
  sideBySide: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 4,
  },
}))
