import React from "react"
import { StyleProp, View, ViewStyle } from "react-native"
import { makeStyles } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { PhoneCodeChannelType } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"

type Props = {
  phoneCodeChannel: PhoneCodeChannelType
  captchaLoading: boolean
  isDisabled?: boolean
  submit: (channel: PhoneCodeChannelType) => void
  customStyle?: StyleProp<ViewStyle>
}

export const PhoneChannelButton: React.FC<Props> = ({
  phoneCodeChannel,
  captchaLoading,
  isDisabled,
  submit,
  customStyle,
}) => {
  const styles = useStyles()
  const { LL } = useI18nContext()

  const channelLabels: Record<PhoneCodeChannelType, string> = {
    [PhoneCodeChannelType.Telegram]: LL.PhoneLoginInitiateScreen.telegram(),
    [PhoneCodeChannelType.Sms]: LL.PhoneLoginInitiateScreen.sms(),
    [PhoneCodeChannelType.Whatsapp]: LL.PhoneLoginInitiateScreen.whatsapp(),
  }

  return (
    <View style={[styles.container, customStyle]}>
      <GaloyPrimaryButton
        title={channelLabels[phoneCodeChannel]}
        loading={captchaLoading}
        onPress={() => submit(phoneCodeChannel)}
        disabled={isDisabled}
      />
    </View>
  )
}

const useStyles = makeStyles(() => ({
  container: {
    flex: 1,
    justifyContent: "flex-end",
  },
}))
