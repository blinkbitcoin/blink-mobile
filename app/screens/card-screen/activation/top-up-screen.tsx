import React, { useState } from "react"
import { Pressable, View } from "react-native"
import { Divider, makeStyles, Text, useTheme } from "@rn-vui/themed"

import { IconNamesType } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { SettingItemRow } from "@app/components/card-screen"
import { IconHero } from "@app/components/icon-hero"
import { StepLayout } from "@app/components/step-layout"
import { CardActivationStep } from "@app/graphql/generated"
import { useCardActivation } from "@app/hooks"
import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { ActivationThen } from "@app/hooks/use-card-activation"
import { useI18nContext } from "@app/i18n/i18n-react"
import { fonts } from "@app/rne-theme/fonts"
import { radius } from "@app/rne-theme/radius"
import { CARD } from "@app/types/amounts"

const TopUpWay = {
  Balance: "balance",
  Deposit: "deposit",
} as const

type TopUpWay = (typeof TopUpWay)[keyof typeof TopUpWay]

/** Where each way goes once the activation is complete, in the order the ways are shown
 *  and preselected. The deposit is shown but not offered until Receive can fill the Card
 *  Balance. */
const TOP_UP_ROUTES: Record<TopUpWay, ActivationThen | null> = {
  [TopUpWay.Balance]: { name: "conversionDetails", params: { destination: CARD } },
  [TopUpWay.Deposit]: null,
}

const WAY_ICONS: Record<TopUpWay, IconNamesType> = {
  [TopUpWay.Balance]: "transfer",
  [TopUpWay.Deposit]: "receive",
}

const WAYS = Object.values(TopUpWay)
const DIVIDER_WIDTH = 1
const WAY_ROW_HEIGHT = 62
const SELECTED_BORDER_WIDTH = 1

/** The activation's last step. The member tops the card up from the Bitcoin or Dollar
 *  Balance, or skips; either completes the activation. */
export const CardTopUpScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const { complete, isCompleting } = useCardActivation({
    step: CardActivationStep.TopUp,
  })
  const { wallets } = useActiveWallet()
  const [chosenWay, setChosenWay] = useState<TopUpWay | null>(null)
  const [isToppingUp, setIsToppingUp] = useState(false)

  const hasFunds = wallets.some(({ balance }) => balance.amount > 0)
  const isWayOffered = (way: TopUpWay) => {
    const isRouted = TOP_UP_ROUTES[way] !== null
    const isBalanceEmpty = way === TopUpWay.Balance && !hasFunds
    return isRouted && !isBalanceEmpty
  }
  /** The member's pick while it is still offered, the first offered way otherwise. */
  const isChosenWayOffered = chosenWay !== null && isWayOffered(chosenWay)
  const selectedWay = isChosenWayOffered ? chosenWay : WAYS.find(isWayOffered) ?? null
  const selectedRoute = selectedWay ? TOP_UP_ROUTES[selectedWay] : null

  const isTopUpRunning = isCompleting && isToppingUp
  const isSkipRunning = isCompleting && !isToppingUp
  const isTopUpDisabled = selectedRoute === null || isSkipRunning

  const wayTitles: Record<TopUpWay, string> = {
    [TopUpWay.Balance]: LL.CardFlow.Activation.TopUp.fromBalance(),
    [TopUpWay.Deposit]: LL.CardFlow.Activation.TopUp.deposit(),
  }

  const startTopUp = (route: ActivationThen) => {
    setIsToppingUp(true)
    complete({ then: route })
  }
  const topUp = selectedRoute ? () => startTopUp(selectedRoute) : undefined

  const skip = () => {
    setIsToppingUp(false)
    complete()
  }

  return (
    <StepLayout
      footer={
        <>
          <GaloyPrimaryButton
            title={LL.CardFlow.Activation.TopUp.topUpNow()}
            onPress={topUp}
            loading={isTopUpRunning}
            disabled={isTopUpDisabled}
          />
          <GaloySecondaryButton
            title={LL.CardFlow.Activation.TopUp.skip()}
            onPress={skip}
            loading={isSkipRunning}
            disabled={isTopUpRunning}
          />
        </>
      }
    >
      <IconHero
        icon="plus"
        iconColor={colors.success}
        title={LL.CardFlow.Activation.TopUp.title()}
        subtitle={
          <Text type="p3" style={styles.subtitle}>
            {LL.CardFlow.Activation.TopUp.subtitle()}
          </Text>
        }
      />
      <View style={styles.waysCard}>
        {WAYS.map((way, index) => {
          const isSelected = way === selectedWay
          const isUnavailable = !isWayOffered(way)
          const isNextToSelection = isSelected || WAYS[index - 1] === selectedWay
          const hasDivider = index > 0 && !isNextToSelection

          return (
            <React.Fragment key={way}>
              {hasDivider && (
                <Divider
                  color={colors.neutral}
                  width={DIVIDER_WIDTH}
                  style={styles.divider}
                />
              )}
              <Pressable
                onPress={() => setChosenWay(way)}
                disabled={isUnavailable}
                accessibilityRole="radio"
                accessibilityLabel={wayTitles[way]}
                accessibilityState={{ selected: isSelected, disabled: isUnavailable }}
                style={[
                  styles.way,
                  isSelected && styles.selectedWay,
                  isUnavailable && styles.unavailableWay,
                ]}
              >
                <SettingItemRow
                  leftIcon={WAY_ICONS[way]}
                  title={wayTitles[way]}
                  rightIcon={null}
                  containerStyle={styles.wayRow}
                  titleStyle={styles.wayTitle}
                />
              </Pressable>
            </React.Fragment>
          )
        })}
      </View>
    </StepLayout>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  subtitle: {
    color: colors.textSecondary,
    textAlign: "center",
  },
  waysCard: {
    marginTop: 30,
    marginHorizontal: 20,
    backgroundColor: colors.surfaceInteractive,
    borderRadius: radius.default,
    overflow: "hidden",
  },
  way: {
    borderRadius: radius.default,
    borderWidth: SELECTED_BORDER_WIDTH,
    borderColor: colors.transparent,
  },
  selectedWay: {
    borderColor: colors.accent,
    backgroundColor: colors.surfacePressed,
  },
  unavailableWay: {
    opacity: 0.5,
  },
  divider: {
    marginHorizontal: 14,
  },
  wayRow: {
    minHeight: WAY_ROW_HEIGHT - 2 * SELECTED_BORDER_WIDTH,
  },
  wayTitle: {
    fontFamily: fonts.bold,
    lineHeight: 18,
  },
}))
