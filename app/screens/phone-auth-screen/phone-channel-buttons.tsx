import React from "react"
import { View } from "react-native"
import { makeStyles } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { PhoneCodeChannelType } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"

export const PhoneChannelButtons = ({
  isTelegramSupported,
  isSmsSupported,
  isWhatsAppSupported,
  phoneCodeChannel,
  captchaLoading,
  isDisabled,
  submit,
}: {
  isTelegramSupported: boolean
  isSmsSupported: boolean
  isWhatsAppSupported: boolean
  phoneCodeChannel: PhoneCodeChannelType
  captchaLoading: boolean
  isDisabled?: boolean
  submit: (channel: PhoneCodeChannelType) => void
}) => {
  const styles = useStyles()
  const { LL } = useI18nContext()

  let PrimaryButton = null
  let SecondaryButton = null
  let TertiaryButton = null

  const channels: {
    type: PhoneCodeChannelType
    supported: boolean
    label: string
  }[] = [
    {
      type: PhoneCodeChannelType.Telegram,
      supported: isTelegramSupported,
      label: LL.PhoneLoginInitiateScreen.telegram(),
    },
    {
      type: PhoneCodeChannelType.Sms,
      supported: isSmsSupported,
      label: LL.PhoneLoginInitiateScreen.sms(),
    },
    {
      type: PhoneCodeChannelType.Whatsapp,
      supported: isWhatsAppSupported,
      label: LL.PhoneLoginInitiateScreen.whatsapp(),
    },
  ]

  const availableChannels = channels.filter((c) => c.supported)

  if (availableChannels.length === 1) {
    const channel = availableChannels[0]
    PrimaryButton = (
      <GaloyPrimaryButton
        title={channel.label}
        loading={captchaLoading && phoneCodeChannel === channel.type}
        onPress={() => submit(channel.type)}
        disabled={isDisabled}
      />
    )
  }

  if (availableChannels.length === 2) {
    const [first, second] = availableChannels
    PrimaryButton = (
      <GaloyPrimaryButton
        title={first.label}
        loading={captchaLoading && phoneCodeChannel === first.type}
        onPress={() => submit(first.type)}
        disabled={isDisabled}
      />
    )
    SecondaryButton = (
      <GaloySecondaryButton
        title={second.label}
        containerStyle={styles.marginButton}
        loading={captchaLoading && phoneCodeChannel === second.type}
        onPress={() => submit(second.type)}
        disabled={isDisabled}
      />
    )
  }

  if (availableChannels.length >= 3) {
    const [first, second, third] = availableChannels
    PrimaryButton = (
      <GaloyPrimaryButton
        title={first.label}
        loading={captchaLoading && phoneCodeChannel === first.type}
        onPress={() => submit(first.type)}
        disabled={isDisabled}
      />
    )
    SecondaryButton = (
      <GaloySecondaryButton
        title={second.label}
        loading={captchaLoading && phoneCodeChannel === second.type}
        onPress={() => submit(second.type)}
        disabled={isDisabled}
      />
    )
    TertiaryButton = (
      <GaloySecondaryButton
        title={third.label}
        containerStyle={styles.marginButton}
        loading={captchaLoading && phoneCodeChannel === third.type}
        onPress={() => submit(third.type)}
        disabled={isDisabled}
      />
    )
  }

  return (
    <View style={styles.buttonsContainer}>
      {PrimaryButton}
      {SecondaryButton}
      {TertiaryButton}
    </View>
  )
}

const useStyles = makeStyles(() => ({
  marginButton: {
    marginBottom: 20,
  },
  buttonsContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
}))
