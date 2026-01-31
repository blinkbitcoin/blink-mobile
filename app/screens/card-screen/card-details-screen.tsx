import React, { useCallback, useEffect } from "react"
import { TouchableOpacity, View } from "react-native"
import { makeStyles, useTheme } from "@rn-vui/themed"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { ActionField } from "@app/components/action-field"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { BlinkCard } from "@app/components/blink-card"
import { InfoSection, WarningCard } from "@app/components/card-screen"
import { Screen } from "@app/components/screen"
import { useClipboard } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { CardStatus, MOCK_CARD } from "./card-mock-data"

export const CardDetailsScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const { copyToClipboard } = useClipboard()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const cardNumberWithoutSpaces = MOCK_CARD.cardNumber.replace(/\s/g, "")

  const getStatusLabel = (status: CardStatus) => {
    switch (status) {
      case CardStatus.Active:
        return LL.CardFlow.CardDetails.statusActive()
      case CardStatus.Frozen:
        return LL.CardFlow.CardDetails.statusFrozen()
      case CardStatus.Inactive:
        return LL.CardFlow.CardDetails.statusInactive()
    }
  }

  const handleCopy = (content: string, label: string) => {
    copyToClipboard({
      content,
      message: LL.common.hasBeenCopiedToClipboard({ type: label }),
    })
  }

  const handleSettingsPress = useCallback(() => {
    navigation.navigate("cardSettingsScreen")
  }, [navigation])

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity style={styles.headerRight} onPress={handleSettingsPress}>
          <GaloyIcon name="settings" size={24} color={colors.black} />
        </TouchableOpacity>
      ),
    })
  }, [navigation, styles.headerRight, colors.black, handleSettingsPress])

  return (
    <Screen preset="scroll">
      <View style={styles.content}>
        <BlinkCard
          cardNumber={MOCK_CARD.cardNumber}
          holderName={MOCK_CARD.holderName}
          validThruDate={MOCK_CARD.validThruDate}
          isFrozen={MOCK_CARD.status === CardStatus.Frozen}
          showCardDetails
        />

        <View style={styles.fieldsContainer}>
          <ActionField
            label={LL.CardFlow.CardDetails.cardNumber()}
            value={MOCK_CARD.cardNumber}
            icon="copy-paste"
            testID="card-number-field"
            onAction={() =>
              handleCopy(cardNumberWithoutSpaces, LL.CardFlow.CardDetails.cardNumber())
            }
          />

          <View style={styles.rowFields}>
            <View style={styles.halfField}>
              <ActionField
                label={LL.CardFlow.CardDetails.expiryDate()}
                value={MOCK_CARD.expiryDate}
                icon="copy-paste"
                onAction={() =>
                  handleCopy(MOCK_CARD.expiryDate, LL.CardFlow.CardDetails.expiryDate())
                }
              />
            </View>
            <View style={styles.halfField}>
              <ActionField
                label={LL.CardFlow.CardDetails.cvv()}
                value={MOCK_CARD.cvv}
                icon="copy-paste"
                onAction={() => handleCopy(MOCK_CARD.cvv, LL.CardFlow.CardDetails.cvv())}
              />
            </View>
          </View>

          <ActionField
            label={LL.CardFlow.CardDetails.cardholderName()}
            value={MOCK_CARD.holderName}
            icon="copy-paste"
            onAction={() =>
              handleCopy(MOCK_CARD.holderName, LL.CardFlow.CardDetails.cardholderName())
            }
          />

          <InfoSection
            title={LL.CardFlow.CardDetails.cardInformation()}
            items={[
              {
                label: LL.CardFlow.CardDetails.cardType(),
                value: MOCK_CARD.cardType,
              },
              {
                label: LL.CardFlow.CardDetails.status(),
                value: getStatusLabel(MOCK_CARD.status),
                valueColor:
                  MOCK_CARD.status === CardStatus.Active ? colors.success : colors.error,
              },
              {
                label: LL.CardFlow.CardDetails.issued(),
                value: MOCK_CARD.issuedDate,
              },
              {
                label: LL.CardFlow.CardDetails.network(),
                value: MOCK_CARD.network,
              },
            ]}
          />

          <WarningCard
            title={LL.CardFlow.CardDetails.keepDetailsSafe()}
            description={LL.CardFlow.CardDetails.securityWarning()}
          />
        </View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  headerRight: {
    marginRight: 24,
  },
  content: {
    paddingTop: 20,
    paddingBottom: 40,
    gap: 20,
  },
  fieldsContainer: {
    paddingHorizontal: 24,
    gap: 20,
  },
  rowFields: {
    flexDirection: "row",
    gap: 10,
  },
  halfField: {
    flex: 1,
  },
}))
