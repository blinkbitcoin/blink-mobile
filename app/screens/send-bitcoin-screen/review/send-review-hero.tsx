import React from "react"
import { View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"

export const SEND_REVIEW_PRIMARY_TEST_ID = "send-review-amount-primary"
export const SEND_REVIEW_SECONDARY_TEST_ID = "send-review-amount-secondary"

type SendReviewHeroProps = {
  primaryAmount: string
  /** Absent when the display currency is the wallet currency. */
  secondaryAmount?: string
}

export const SendReviewHero: React.FC<SendReviewHeroProps> = ({
  primaryAmount,
  secondaryAmount,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()

  return (
    <View style={styles.container}>
      <View style={styles.icon}>
        <GaloyIcon name="send" size={32} color={colors.primary} />
      </View>
      <View style={styles.texts}>
        <Text style={styles.label}>{LL.SendBitcoinConfirmationScreen.sending()}</Text>
        <Text
          style={styles.primaryAmount}
          adjustsFontSizeToFit
          numberOfLines={1}
          {...testProps(SEND_REVIEW_PRIMARY_TEST_ID)}
        >
          {primaryAmount}
        </Text>
        {secondaryAmount ? (
          <Text
            style={styles.secondaryAmount}
            numberOfLines={1}
            {...testProps(SEND_REVIEW_SECONDARY_TEST_ID)}
          >
            {secondaryAmount}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    alignItems: "center",
    rowGap: 10,
    paddingVertical: 10,
  },
  /** Figma's 44px icon frame with the 32px glyph centred in it, no fill. */
  icon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  texts: {
    alignSelf: "stretch",
    rowGap: 5,
  },
  /** Figma "Paragraph 4/Regular": 12/18. */
  label: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.black,
    textAlign: "center",
  },
  /** Figma "Heading 2/Bold": 20/24. */
  primaryAmount: {
    fontFamily: "SourceSansPro-Bold",
    fontSize: 20,
    lineHeight: 24,
    color: colors.black,
    textAlign: "center",
  },
  /** Figma "Paragraph 3/Regular": 14/20. */
  secondaryAmount: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.black,
    textAlign: "center",
  },
}))
