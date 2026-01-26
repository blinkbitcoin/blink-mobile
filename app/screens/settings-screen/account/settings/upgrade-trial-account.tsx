import { useRef, useState, useCallback } from "react"
import { View } from "react-native"

import { useI18nContext } from "@app/i18n/i18n-react"
import { makeStyles, Text } from "@rn-vui/themed"
import { useFocusEffect } from "@react-navigation/native"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { TrialAccountLimitsModal } from "@app/components/upgrade-account-modal"
import { AccountLevel, useLevel } from "@app/graphql/level-context"

import { useShowWarningSecureAccount } from "../show-warning-secure-account-hook"

export const UpgradeTrialAccount: React.FC = () => {
  const styles = useStyles()
  const { currentLevel } = useLevel()
  const { LL } = useI18nContext()
  const hasBalance = useShowWarningSecureAccount()
  const reopenUpgradeModal = useRef(false)

  const [upgradeAccountModalVisible, setUpgradeAccountModalVisible] = useState(false)
  const closeUpgradeAccountModal = () => setUpgradeAccountModalVisible(false)
  const openUpgradeAccountModal = () => setUpgradeAccountModalVisible(true)

  useFocusEffect(
    useCallback(() => {
      if (reopenUpgradeModal.current) {
        openUpgradeAccountModal()
        reopenUpgradeModal.current = false
      }
    }, []),
  )

  if (currentLevel !== AccountLevel.Zero) return <></>

  return (
    <>
      <TrialAccountLimitsModal
        isVisible={upgradeAccountModalVisible}
        closeModal={closeUpgradeAccountModal}
        beforeSubmit={() => {
          reopenUpgradeModal.current = true
        }}
      />
      <View style={styles.container}>
        <View style={styles.sideBySide}>
          <Text type="h2" bold>
            {LL.common.trialAccount()}
          </Text>
          <GaloyIcon name="warning" size={20} />
        </View>
        <Text type="p3">{LL.AccountScreen.itsATrialAccount()}</Text>
        {hasBalance && (
          <Text type="p3">⚠️ {LL.AccountScreen.fundsMoreThan5Dollars()}</Text>
        )}
        <GaloySecondaryButton
          title={LL.common.backupAccount()}
          iconName="caret-right"
          iconPosition="right"
          size="sm"
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
