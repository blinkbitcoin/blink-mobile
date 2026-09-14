import * as React from "react"
import { View } from "react-native"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { Screen } from "@app/components/screen"
import { AccountOption, useAccountTypeOptions } from "@app/hooks/use-account-type-options"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { CreationBlockReason } from "@app/types/account"
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

type Wording = { title: string; description: string }

export const UnsupportedRegionScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const navigation = useNavigation()
  const route = useRoute<RouteProp<RootStackParamList, "unsupportedRegion">>()

  /** The one place that says whether self-custodial exists to be offered, so this screen
   *  cannot promise an option the selection screen would not show. */
  const { options } = useAccountTypeOptions()
  const isSelfCustodialOffered = options.includes(AccountOption.SelfCustodial)

  /**
   * Each refusal says only what it knows: a closed region offers nothing, an unread one
   * says so rather than blaming the region, and a refused first Blink account points at
   * self-custodial only where this build actually offers it.
   */
  const wordingByReason: Record<CreationBlockReason, () => Wording> = {
    [CreationBlockReason.Region]: () => ({
      title: LL.UnsupportedRegionScreen.title(),
      description: LL.UnsupportedRegionScreen.description(),
    }),
    [CreationBlockReason.FirstCustodialSignup]: () => ({
      title: LL.UnsupportedRegionScreen.title(),
      description: isSelfCustodialOffered
        ? LL.UnsupportedRegionScreen.custodialSignupDescription()
        : LL.UnsupportedRegionScreen.custodialSignupOnlyDescription(),
    }),
    [CreationBlockReason.UnknownRegion]: () => ({
      title: LL.UnsupportedRegionScreen.unknownRegionTitle(),
      description: LL.UnsupportedRegionScreen.unknownRegionDescription(),
    }),
  }

  /** Own keys only: `in` would accept "toString" and call it as if it described a refusal. */
  const reason = route.params?.reason
  const isReasonDescribed =
    reason !== undefined && Object.prototype.hasOwnProperty.call(wordingByReason, reason)
  const { title, description } =
    wordingByReason[isReasonDescribed ? reason : CreationBlockReason.Region]()

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.hero}>
          <GaloyIcon
            name="close"
            size={45}
            color={colors.error}
            backgroundColor={colors.grey5}
            containerSize={44}
          />
          <View style={styles.textGroup}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.description}>{description}</Text>
          </View>
        </View>
        <GaloyPrimaryButton title={LL.common.close()} onPress={navigation.goBack} />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  hero: {
    alignItems: "center",
    gap: 14,
    paddingVertical: 20,
  },
  textGroup: {
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 24,
    color: colors.black,
    textAlign: "center",
    maxWidth: 264,
  },
  description: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.black,
    textAlign: "center",
    maxWidth: 264,
  },
}))
