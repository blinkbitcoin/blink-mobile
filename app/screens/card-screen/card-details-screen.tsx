import React, { useCallback, useEffect, useMemo } from "react"
import { ActivityIndicator, TouchableOpacity, View } from "react-native"
import { makeStyles, useTheme } from "@rn-vui/themed"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { ActionField } from "@app/components/action-field"
import { GaloyErrorBox } from "@app/components/atomic/galoy-error-box"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { BlinkCard } from "@app/components/blink-card"
import { headerRightNoGlass } from "@app/components/header-no-glass"
import { InfoSection, InfoCard } from "@app/components/card-screen"
import { Screen } from "@app/components/screen"
import { ScreenSecurityGate } from "@app/components/screen-security-gate"
import { CardStatus } from "@app/graphql/generated"
import { useCardData, useCardHolder, useClipboard } from "@app/hooks"
import {
  useAuthGateFailureHandler,
  useLocalAuthGate,
} from "@app/hooks/use-local-auth-gate"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { formatCardDisplayNumber } from "@app/utils/helper"

import { useCardSecrets } from "./hooks/use-card-secrets"
import { isCardFrozen, formatCardType, formatIssuedDate } from "./utils/card-display"

const CLIPBOARD_CLEAR_MS = 60_000

type DetailsCard = NonNullable<ReturnType<typeof useCardData>["card"]>

export const CardDetailsScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const handleDismiss = useCallback(() => navigation.goBack(), [navigation])

  const handleAuthFailure = useAuthGateFailureHandler()

  const authenticated = useLocalAuthGate({
    description: LL.CardFlow.CardDetails.authDescription(),
    onFailure: handleAuthFailure,
  })

  const { card, loading: cardLoading } = useCardData()

  useEffect(() => {
    if (authenticated && !cardLoading && !card) {
      handleDismiss()
    }
  }, [authenticated, cardLoading, card, handleDismiss])

  const handleSettingsPress = useCallback(() => {
    navigation.navigate("cardSettingsScreen")
  }, [navigation])

  useEffect(() => {
    navigation.setOptions(
      headerRightNoGlass(() => (
        <TouchableOpacity style={styles.headerRight} onPress={handleSettingsPress}>
          <GaloyIcon name="settings" size={24} color={colors.black} />
        </TouchableOpacity>
      )),
    )
  }, [navigation, styles.headerRight, colors.black, handleSettingsPress])

  if (!authenticated || cardLoading) {
    return (
      <Screen preset="scroll">
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      </Screen>
    )
  }

  if (!card) return null

  return (
    <ScreenSecurityGate>
      <CardDetailsContent key={card.id} card={card} />
    </ScreenSecurityGate>
  )
}

/** Mounted only once the screen guard is on, so the decrypted card number and CVV are
 *  never fetched or painted where a screenshot, a recording or the app switcher could
 *  catch them. Keyed by the card, so a replaced card starts over instead of showing the
 *  secrets of the one before. */
const CardDetailsContent: React.FC<{ card: DetailsCard }> = ({ card }) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL, locale } = useI18nContext()
  const { copyToClipboard } = useClipboard(CLIPBOARD_CLEAR_MS)
  const { fullName } = useCardHolder(card.id)
  const { secrets, error: secretsError, fetchSecrets } = useCardSecrets()

  useEffect(() => {
    if (!secrets) fetchSecrets(card.id)
  }, [card.id, secrets, fetchSecrets])

  const retrySecrets = useCallback(() => fetchSecrets(card.id), [card.id, fetchSecrets])
  const hasSecretsFailed = secretsError !== undefined
  /** Also before the first fetch starts, so the fields never flash empty without it. */
  const isSecretsLoading = !secrets && !hasSecretsFailed

  const handleCopy = (content: string, label: string) =>
    copyToClipboard({
      content,
      message: LL.common.hasBeenCopiedToClipboard({ type: label }),
    })

  const cardStatusConfig = useMemo(
    () => ({
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
    }),
    [colors, LL],
  )

  const isFrozen = isCardFrozen(card.status)
  const statusConfig = cardStatusConfig[card.status]
  /** The card visual shows the last four while the secrets load, but the field waits for
   *  the full number, so copying it can never put four digits on the clipboard. */
  const visibleCardNumber = secrets?.pan ?? card.lastFour
  const cardNumberFormatted = secrets ? formatCardDisplayNumber(secrets.pan, true) : null
  const copyCardNumber = secrets
    ? () => handleCopy(secrets.pan, LL.CardFlow.CardDetails.cardNumber())
    : undefined
  const copyCvv = secrets
    ? () => handleCopy(secrets.cvc, LL.CardFlow.CardDetails.cvv())
    : undefined

  return (
    <Screen preset="scroll">
      <View style={styles.content}>
        <BlinkCard
          cardId={card.id}
          cardNumber={visibleCardNumber}
          validThruDate=""
          isFrozen={isFrozen}
          showCardDetails
        />

        <View style={styles.fieldsContainer}>
          {isSecretsLoading && (
            <ActivityIndicator testID="card-secrets-loading" color={colors.primary} />
          )}
          {hasSecretsFailed && (
            <View style={styles.secretsFailure}>
              <GaloyErrorBox errorMessage={secretsError} />
              <GaloyPrimaryButton title={LL.common.tryAgain()} onPress={retrySecrets} />
            </View>
          )}
          <ActionField
            label={LL.CardFlow.CardDetails.cardNumber()}
            value={cardNumberFormatted}
            icon="copy-paste"
            testID="card-number-field"
            onAction={copyCardNumber}
          />

          <View style={styles.rowFields}>
            <View style={styles.halfField}>
              <ActionField
                label={LL.CardFlow.CardDetails.expiryDate()}
                value={null}
                icon="copy-paste"
              />
            </View>
            <View style={styles.halfField}>
              <ActionField
                label={LL.CardFlow.CardDetails.cvv()}
                value={secrets?.cvc ?? null}
                icon="copy-paste"
                testID="card-cvv-field"
                onAction={copyCvv}
              />
            </View>
          </View>

          <ActionField
            label={LL.CardFlow.CardDetails.cardholderName()}
            value={fullName || null}
            icon="copy-paste"
            testID="card-holder-field"
            onAction={() =>
              handleCopy(fullName, LL.CardFlow.CardDetails.cardholderName())
            }
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
                value: LL.CardFlow.networkVisa(),
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
  secretsFailure: {
    gap: 10,
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
