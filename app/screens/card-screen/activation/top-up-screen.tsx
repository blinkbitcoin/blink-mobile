import React from "react"
import { View } from "react-native"
import { Divider, makeStyles, Text, useTheme } from "@rn-vui/themed"

import { IconNamesType } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { SettingItemRow } from "@app/components/card-screen"
import { IconHero } from "@app/components/icon-hero"
import { StepLayout } from "@app/components/step-layout"
import { CardActivationStep } from "@app/graphql/generated"
import { useCardActivation } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { fonts } from "@app/rne-theme/fonts"
import { radius } from "@app/rne-theme/radius"

type TopUpWay = {
  icon: IconNamesType
  title: string
}

const DIVIDER_WIDTH = 1
const WAY_ROW_HEIGHT = 62

/** The activation's last step. Funds only reach the card through deposits blink-card can
 *  verify, so until those exist both ways show as unavailable and the step can only be
 *  skipped. */
export const CardTopUpScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const { complete, isCompleting } = useCardActivation({
    step: CardActivationStep.TopUp,
  })

  const ways: TopUpWay[] = [
    { icon: "transfer", title: LL.CardFlow.Activation.TopUp.fromBalance() },
    { icon: "receive", title: LL.CardFlow.Activation.TopUp.deposit() },
  ]

  return (
    <StepLayout
      footer={
        <>
          <GaloyPrimaryButton title={LL.CardFlow.Activation.TopUp.topUpNow()} disabled />
          <GaloySecondaryButton
            title={LL.CardFlow.Activation.TopUp.skip()}
            onPress={complete}
            loading={isCompleting}
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
        {ways.map((way, index) => {
          const hasDivider = index > 0

          return (
            <React.Fragment key={way.icon}>
              {hasDivider && <Divider color={colors.neutral} width={DIVIDER_WIDTH} />}
              <View
                style={styles.unavailableWay}
                accessible
                accessibilityState={{ disabled: true }}
              >
                <SettingItemRow
                  leftIcon={way.icon}
                  title={way.title}
                  rightIcon={null}
                  containerStyle={styles.wayRow}
                  titleStyle={styles.wayTitle}
                />
              </View>
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
  unavailableWay: {
    opacity: 0.5,
  },
  wayRow: {
    minHeight: WAY_ROW_HEIGHT,
  },
  wayTitle: {
    fontFamily: fonts.bold,
    lineHeight: 18,
  },
}))
