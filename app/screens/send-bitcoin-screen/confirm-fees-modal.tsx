import React from "react"
import { View } from "react-native"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import CustomModal from "@app/components/custom-modal/custom-modal"
import { useI18nContext } from "@app/i18n/i18n-react"
import { Text, makeStyles, useTheme } from "@rneui/themed"

export type ConfirmFeesModalProps = {
  isVisible: boolean
  action: () => void
  cancel: () => void
}

export const ConfirmFeesModal: React.FC<ConfirmFeesModalProps> = ({
  action,
  cancel,
  isVisible,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()

  return (
    <CustomModal
      isVisible={isVisible}
      toggleModal={cancel}
      title={LL.SendBitcoinScreen.confirmFeesModal.title()}
      image={<GaloyIcon name="info" size={80} color={colors.primary3} />}
      body={
        <View style={styles.body}>
          <Text type={"p2"} style={styles.warningText}>
            {LL.SendBitcoinScreen.confirmFeesModal.content()}
          </Text>
        </View>
      }
      primaryButtonOnPress={cancel}
      primaryButtonTitle={LL.common.cancel()}
      secondaryButtonTitle={LL.SendBitcoinScreen.confirmFeesModal.confirmButton()}
      secondaryButtonOnPress={action}
    />
  )
}

const useStyles = makeStyles(({ colors }) => ({
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 18,
  },
  warningText: {
    textAlign: "center",
  },
  body: {
    rowGap: 12,
  },
  buttonContainer: {
    rowGap: 12,
  },
  titleContainer: {
    marginBottom: 12,
  },
}))
