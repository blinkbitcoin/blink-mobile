import * as React from "react"
import { Image, Linking, View } from "react-native"
import { ScrollView } from "react-native-gesture-handler"
import Modal from "react-native-modal"

import { useI18nContext } from "@app/i18n/i18n-react"
import { makeStyles, useTheme, Text } from "@rn-vui/themed"

import StablesatsImage from "../../assets/images/stable-sats.png"
import { GaloyPrimaryButton } from "../atomic/galoy-primary-button"
import { GaloySecondaryButton } from "../atomic/galoy-secondary-button"

const useStyles = makeStyles(({ colors }) => ({
  imageContainer: {
    height: 150,
    marginBottom: 16,
  },
  stableSatsImage: {
    flex: 1,
  },
  scrollViewStyle: {
    paddingHorizontal: 12,
  },
  modalCard: {
    backgroundColor: colors.grey5,
    borderRadius: 16,
    paddingVertical: 18,
  },
  cardTitleContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 16,
  },
  cardBodyContainer: {
    marginBottom: 16,
  },
  termsAndConditionsText: {
    textDecorationLine: "underline",
  },
  cardActionsContainer: {
    flexDirection: "column",
  },
  marginBottom: {
    marginBottom: 10,
  },
}))

const STABLESATS_LINK = "https://www.stablesats.com"
const STABLESATS_TERMS_LINK = "https://www.blink.sv/en/terms-conditions"

type Props = {
  isVisible: boolean
  setIsVisible: (isVisible: boolean) => void
}

export const StableSatsModal: React.FC<Props> = ({ isVisible, setIsVisible }) => {
  const { LL } = useI18nContext()
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()

  const acknowledgeModal = () => {
    setIsVisible(false)
  }

  return (
    <Modal
      isVisible={isVisible}
      backdropOpacity={0.8}
      backdropColor={colors.white}
      onBackdropPress={acknowledgeModal}
    >
      <View style={styles.modalCard}>
        <ScrollView style={styles.scrollViewStyle}>
          <View style={styles.imageContainer}>
            <Image
              source={StablesatsImage}
              style={styles.stableSatsImage}
              resizeMode="contain"
            />
          </View>
          <View style={styles.cardTitleContainer}>
            <Text type={"h2"}>{LL.StablesatsModal.header()}</Text>
          </View>
          <View style={styles.cardBodyContainer}>
            <Text type="p2">
              {LL.StablesatsModal.body()}{" "}
              <Text
                style={styles.termsAndConditionsText}
                onPress={() => Linking.openURL(STABLESATS_TERMS_LINK)}
              >
                {LL.StablesatsModal.termsAndConditions()}
              </Text>
              .
            </Text>
          </View>
          <View style={styles.cardActionsContainer}>
            <View style={styles.marginBottom}>
              <GaloyPrimaryButton
                title={LL.common.backHome()}
                onPress={acknowledgeModal}
              />
            </View>

            <GaloySecondaryButton
              title={LL.StablesatsModal.learnMore()}
              onPress={() => Linking.openURL(STABLESATS_LINK)}
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  )
}
