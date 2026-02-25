import React, { useCallback, useEffect } from "react"
import { ActivityIndicator, TouchableOpacity, View } from "react-native"
import { makeStyles, useTheme } from "@rn-vui/themed"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { ActionField } from "@app/components/action-field"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { BlinkCard } from "@app/components/blink-card"
import { InfoSection, InfoCard } from "@app/components/card-screen"
import { Screen } from "@app/components/screen"
import { CardStatus } from "@app/graphql/generated"
import { useClipboard } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { formatCardDisplayNumber } from "@app/utils/helper"

import { useBiometricGate } from "./hooks/use-biometric-gate"
import { useCardData } from "./hooks/use-card-data"
import { isCardFrozen, formatCardType, formatIssuedDate } from "./utils/card-display"

const CLIPBOARD_CLEAR_MS = 60_000

export const CardDetailsScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL, locale } = useI18nContext()
  const { copyToClipboard } = useClipboard(CLIPBOARD_CLEAR_MS)
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const handleDismiss = useCallback(() => navigation.goBack(), [navigation])

  const authenticated = useBiometricGate({
    description: LL.CardFlow.CardDetails.authDescription(),
    onFailure: handleDismiss,
  })

  const { card, loading: cardLoading } = useCardData()

  useEffect(() => {
    if (authenticated && !cardLoading && !card) {
      handleDismiss()
    }
  }, [authenticated, cardLoading, card, handleDismiss])

  const handleCopy = useCallback(
    (content: string, label: string) => {
      copyToClipboard({
        content,
        message: LL.common.hasBeenCopiedToClipboard({ type: label }),
      })
    },
    [copyToClipboard, LL],
  )

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

  if (!authenticated || cardLoading) {
    return (
      <Screen preset="scroll">
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      </Screen>
    )
  }

  if (!card) return null

  const isFrozen = isCardFrozen(card.status)

  const cardStatusConfig = {
    [CardStatus.Active]: {
      color: colors.success,
      text: LL.CardFlow.CardDetails.statusActive(),
    },
    [CardStatus.Locked]: {
      color: colors.grey3,
      text: LL.CardFlow.CardDetails.statusFrozen(),
    },
    [CardStatus.Canceled]: {
      color: colors.error,
      text: LL.CardFlow.CardDetails.statusCancelled(),
    },
    [CardStatus.NotActivated]: {
      color: colors.warning,
      text: LL.CardFlow.CardDetails.statusNotActivated(),
    },
    [CardStatus.Requested]: {
      color: colors.grey3,
      text: LL.CardFlow.CardDetails.statusPending(),
    },
    [CardStatus.Failed]: {
      color: colors.error,
      text: LL.CardFlow.CardDetails.statusFailed(),
    },
  }

  const statusConfig = cardStatusConfig[card.status]

  return (
    <Screen preset="scroll">
      <View style={styles.content}>
        <BlinkCard
          cardNumber={card.lastFour}
          holderName=""
          validThruDate=""
          isFrozen={isFrozen}
          showCardDetails
        />

        <View style={styles.fieldsContainer}>
          <ActionField
            label={LL.CardFlow.CardDetails.cardNumber()}
            value={formatCardDisplayNumber(card.lastFour, true)}
            icon="copy-paste"
            testID="card-number-field"
            onAction={() =>
              handleCopy(card.lastFour, LL.CardFlow.CardDetails.cardNumber())
            }
          />

          <View style={styles.rowFields}>
            <View style={styles.halfField}>
              <ActionField
                label={LL.CardFlow.CardDetails.expiryDate()}
                value={null}
                icon="copy-paste"
                // onAction={() => handleCopy("", LL.CardFlow.CardDetails.expiryDate())}
              />
            </View>
            <View style={styles.halfField}>
              <ActionField
                label={LL.CardFlow.CardDetails.cvv()}
                value={null}
                icon="copy-paste"
                // onAction={() => handleCopy("", LL.CardFlow.CardDetails.cvv())}
              />
            </View>
          </View>

          <ActionField
            label={LL.CardFlow.CardDetails.cardholderName()}
            value={null}
            icon="copy-paste"
            // onAction={() => handleCopy("", LL.CardFlow.CardDetails.cardholderName())}
          />

          <InfoSection
            title={LL.CardFlow.CardDetails.cardInformation()}
            items={[
              {
                label: LL.CardFlow.CardDetails.cardType(),
                value: formatCardType(card.cardType, LL.CardFlow.CardDetails),
              },
              {
                label: LL.CardFlow.CardDetails.status(),
                value: statusConfig.text,
                valueColor: statusConfig.color,
              },
              {
                label: LL.CardFlow.CardDetails.issued(),
                value: formatIssuedDate(card.createdAt, locale),
              },
              {
                label: LL.CardFlow.CardDetails.network(),
                value: "Visa",
              },
            ]}
          />

          <InfoCard
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
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 40,
  },
}))
