import React from "react"
import { View, TouchableOpacity } from "react-native"
import Modal from "react-native-modal"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useI18nContext } from "@app/i18n/i18n-react"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

const useStyles = makeStyles(({ colors }) => ({
  modalView: {
    backgroundColor: colors.white,
    maxFlex: 1,
    maxHeight: "75%",
    borderRadius: 16,
    padding: 20,
  },
  titleContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  walletsContainer: {
    paddingLeft: 10,
  },
  bodyText: {
    fontSize: 18,
    fontWeight: "400",
  },
}))

type SetAddressModalProps = {
  modalVisible: boolean
  toggleModal: () => void
}

const wallets = ["Muun", "Chivo", "Strike"]

export const PayCodeExplainerModal = ({
  modalVisible,
  toggleModal,
}: SetAddressModalProps) => {
  const { LL } = useI18nContext()
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()

  return (
    <Modal
      isVisible={modalVisible}
      backdropOpacity={0.3}
      backdropColor={colors.grey3}
      onBackdropPress={toggleModal}
      swipeDirection={modalVisible ? ["down"] : ["up"]}
    >
      <View style={styles.modalView}>
        <View style={styles.titleContainer}>
          <Text type="h1" bold>
            {LL.GaloyAddressScreen.howToUseYourPaycode()}
          </Text>
          <TouchableOpacity onPress={toggleModal}>
            <GaloyIcon name="close" size={32} color={colors.black} />
          </TouchableOpacity>
        </View>
        <Text style={styles.bodyText}>
          {LL.GaloyAddressScreen.howToUseYourPaycodeExplainer()}
        </Text>
        <Text style={styles.bodyText}>
          {wallets.map((wallet) => (
            <Text key={wallet} style={styles.bodyText}>
              {"\n\u2022 "}
              {wallet}
            </Text>
          ))}
        </Text>
      </View>
    </Modal>
  )
}
