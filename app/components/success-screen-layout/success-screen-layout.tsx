import React from "react"
import { View } from "react-native"

import { makeStyles } from "@rn-vui/themed"

import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"
import { SuccessIconAnimation } from "@app/components/success-animation/success-icon-animation"
import { CompletedTextAnimation } from "@app/components/success-animation/success-text-animation"

type SuccessScreenLayoutProps = {
  icon?: IconNamesType
  iconSize?: number
  children: React.ReactNode
  footer?: React.ReactNode
  onAnimationComplete?: () => void
}

export const SuccessScreenLayout: React.FC<SuccessScreenLayoutProps> = ({
  icon = "payment-success",
  iconSize = 100,
  children,
  footer,
  onAnimationComplete,
}) => {
  const styles = useStyles()

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <SuccessIconAnimation>
          <GaloyIcon name={icon} size={iconSize} />
        </SuccessIconAnimation>
        <CompletedTextAnimation onComplete={onAnimationComplete}>
          {children}
        </CompletedTextAnimation>
      </View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  )
}

const useStyles = makeStyles(() => ({
  container: {
    flex: 1,
    justifyContent: "space-between",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    gap: 26,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
}))
