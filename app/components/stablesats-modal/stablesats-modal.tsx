import * as React from "react"
import { Image, Linking, View } from "react-native"
import { ScrollView } from "react-native-gesture-handler"
import Modal from "react-native-modal"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { WalletCurrency } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"

import StablesatsImage from "../../assets/images/stable-sats.png"
import { CurrencyPill } from "../atomic/currency-pill"
import { GaloyPrimaryButton } from "../atomic/galoy-primary-button"
import { GaloySecondaryButton } from "../atomic/galoy-secondary-button"
import CustomModal from "../custom-modal/custom-modal"

const STABLESATS_LINK = "https://www.stablesats.com"
const DOLLAR_ACCOUNT_LINK = "https://www.blink.sv/en/dollar-account"
const TERMS_AND_CONDITIONS_LINK = "https://www.blink.sv/en/terms-conditions"

type Variant = "custodial" | "selfCustodial"

type Props = {
  isVisible: boolean
  setIsVisible: (isVisible: boolean) => void
  variant?: Variant
}

export const StableSatsModal: React.FC<Props> = ({
  isVisible,
  setIsVisible,
  variant = "custodial",
}) => {
  const acknowledgeModal = () => setIsVisible(false)

  if (variant === "selfCustodial") {
    return (
      <SelfCustodialStablecoinsModal
        isVisible={isVisible}
        toggleModal={acknowledgeModal}
      />
    )
  }
  return <CustodialStablesatsModal isVisible={isVisible} toggleModal={acknowledgeModal} />
}

type InternalProps = {
  isVisible: boolean
  toggleModal: () => void
}

const CustodialStablesatsModal: React.FC<InternalProps> = ({
  isVisible,
  toggleModal,
}) => {
  const { LL } = useI18nContext()
  const {
    theme: { colors },
  } = useTheme()
  const styles = useCustodialStyles()

  return (
    <Modal
      isVisible={isVisible}
      backdropOpacity={0.8}
      backdropColor={colors.white}
      onBackdropPress={toggleModal}
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
                onPress={() => Linking.openURL(TERMS_AND_CONDITIONS_LINK)}
              >
                {LL.StablesatsModal.termsAndConditions()}
              </Text>
            </Text>
          </View>
          <View style={styles.cardActionsContainer}>
            <View style={styles.marginBottom}>
              <GaloyPrimaryButton title={LL.common.backHome()} onPress={toggleModal} />
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

const SelfCustodialStablecoinsModal: React.FC<InternalProps> = ({
  isVisible,
  toggleModal,
}) => {
  const { LL } = useI18nContext()
  const styles = useSelfCustodialStyles()

  return (
    <CustomModal
      isVisible={isVisible}
      toggleModal={toggleModal}
      showCloseIconButton={true}
      image={<CurrencyPill currency={WalletCurrency.Usd} containerSize="medium" />}
      title={LL.StablesatsModal.headerSelfCustodial()}
      body={
        <Text style={styles.body}>
          {LL.StablesatsModal.bodySelfCustodial()}{" "}
          <Text
            style={styles.termsLink}
            onPress={() => Linking.openURL(TERMS_AND_CONDITIONS_LINK)}
          >
            {LL.StablesatsModal.termsAndConditions()}
          </Text>
        </Text>
      }
      primaryButtonTitle={LL.common.backHome()}
      primaryButtonOnPress={toggleModal}
      secondaryButtonTitle={LL.StablesatsModal.learnMoreSelfCustodial()}
      secondaryButtonOnPress={() => Linking.openURL(DOLLAR_ACCOUNT_LINK)}
    />
  )
}

const useCustodialStyles = makeStyles(({ colors }) => ({
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

const useSelfCustodialStyles = makeStyles(({ colors }) => ({
  body: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.black,
    textAlign: "center",
  },
  termsLink: {
    textDecorationLine: "underline",
  },
}))
