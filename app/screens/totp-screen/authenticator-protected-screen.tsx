import React, { useCallback } from "react"
import { View } from "react-native"
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { IconHero } from "@app/components/icon-hero"
import { RichText } from "@app/components/rich-text"
import { StepLayout } from "@app/components/step-layout"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { contactRemoveStepOf } from "@app/types/two-factor-enforcement"
import { testProps } from "@app/utils/testProps"

import { useTotpRegistrationFlow } from "./hooks/use-totp-registration-flow"

/**
 * The onboarding's last screen: the account is protected, with a reminder to move the
 * authenticator before changing phones. Done closes the whole registration, back to
 * wherever it was started from, as its back controls do, since it took the backup's
 * place. A registration opened to change a login method goes on to that change from
 * Done, now that the authenticator can approve it; its back controls only leave.
 */
export const AuthenticatorProtectedScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { leave } = useTotpRegistrationFlow()
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, "totpRegistrationDone">>()
  const { params } = useRoute<RouteProp<RootStackParamList, "totpRegistrationDone">>()
  const contactChange = params?.contactChange

  const finish = useCallback(() => {
    leave()
    if (!contactChange) return
    navigation.navigate("contactChangeCode", { step: contactRemoveStepOf(contactChange) })
  }, [leave, contactChange, navigation])

  return (
    <StepLayout
      footer={
        <GaloyPrimaryButton
          title={LL.AuthenticatorOnboarding.done()}
          onPress={finish}
          {...testProps("authenticator-protected-done")}
        />
      }
    >
      <IconHero
        icon="check-badge"
        iconColor={colors._green}
        title={LL.AuthenticatorOnboarding.protectedTitle()}
        subtitle={
          <Text type="p3" style={styles.description}>
            {LL.AuthenticatorOnboarding.protectedDescription()}
          </Text>
        }
      />
      <View style={styles.tip}>
        <RichText
          text={LL.AuthenticatorOnboarding.newPhoneTip()}
          style={styles.tipText}
        />
      </View>
    </StepLayout>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  description: {
    color: colors.grey1,
    textAlign: "center",
  },
  tip: {
    marginTop: 30,
    marginHorizontal: 20,
    backgroundColor: colors.grey7,
    borderLeftWidth: 2,
    borderLeftColor: colors.black,
    borderRadius: 6,
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 10,
  },
  tipText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.black,
  },
}))
