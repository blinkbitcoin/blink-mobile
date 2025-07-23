import React, { useEffect } from "react"
import { View } from "react-native"
import Modal from "react-native-modal"

import { useApolloClient } from "@apollo/client"
import { setIntroducingCirclesModalShown } from "@app/graphql/client-only-query"
import { useIntroducingCirclesModalShownQuery } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { makeStyles, useTheme, Text } from "@rn-vui/themed"

import { GaloyIcon } from "../atomic/galoy-icon"
import { GaloyIconButton } from "../atomic/galoy-icon-button"
import { GaloyPrimaryButton } from "../atomic/galoy-primary-button"

type Props = {
  isVisible: boolean
  setIsVisible: (isVisible: boolean) => void
}

export const IntroducingCirclesModal: React.FC<Props> = ({ isVisible, setIsVisible }) => {
  const { LL } = useI18nContext()

  const client = useApolloClient()
  const { data } = useIntroducingCirclesModalShownQuery()
  useEffect(() => {
    if (!data?.introducingCirclesModalShown) {
      setIsVisible(true)
      setIntroducingCirclesModalShown(client)
    }
  }, [data, client, setIsVisible])

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
      backdropTransitionOutTiming={0}
      onBackdropPress={acknowledgeModal}
    >
      <View style={styles.modalCard}>
        <View style={styles.containerStyle}>
          <View style={styles.cross}>
            <GaloyIconButton name="close" size="medium" onPress={acknowledgeModal} />
          </View>
          <GaloyIcon name="people" color={colors.primary} size={50} />
          <View style={styles.cardTitleContainer}>
            <Text type="h1" bold>
              {LL.Circles.introducingCircles()}
            </Text>
            <Text style={styles.textCenter} type="p1">
              {LL.Circles.circlesExplainer()}
            </Text>
          </View>
          <View style={styles.cardActionsContainer}>
            <View>
              <GaloyPrimaryButton
                title={LL.Circles.viewMyCircles()}
                onPress={acknowledgeModal}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  containerStyle: {
    padding: 20,
    display: "flex",
    flexDirection: "column",
    rowGap: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  peopleIcon: {
    color: colors.primary,
  },
  cross: {
    position: "absolute",
    top: -20,
    right: 20,
  },
  modalCard: {
    backgroundColor: colors.grey5,
    borderRadius: 16,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 30,
  },
  cardTitleContainer: {
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    rowGap: 10,
    paddingHorizontal: 10,
  },
  cardActionsContainer: {
    flexDirection: "column",
  },
  textCenter: {
    textAlign: "center",
  },
}))
