import * as React from "react"
import { StyleProp, ViewStyle } from "react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"

import { ExpirationTimeButton } from "./expiration-time-button"
import { ExpirationTimeModal } from "./expiration-time-modal"
import { useExpirationTimeLabel } from "./expiration-time-format"

export type ExpirationTimeInputProps = {
  expirationTime: number
  setExpirationTime?: (expirationTime: number) => void
  walletCurrency: WalletCurrency
  disabled: boolean
  big?: boolean
  style?: StyleProp<ViewStyle>
}

export const ExpirationTimeChooser: React.FC<ExpirationTimeInputProps> = ({
  expirationTime,
  setExpirationTime,
  walletCurrency,
  disabled,
  big,
  style,
}) => {
  const [openModal, setOpenModal] = React.useState(false)
  const { LL } = useI18nContext()
  const getExpirationTimeLabel = useExpirationTimeLabel(LL)

  const onSetExpirationTime = (next: number) => {
    setExpirationTime && setExpirationTime(next)
    setOpenModal(false)
  }

  if (openModal) {
    return (
      <ExpirationTimeModal
        value={expirationTime}
        isOpen={true}
        onSetExpirationTime={onSetExpirationTime}
        close={() => setOpenModal(false)}
        walletCurrency={walletCurrency}
      />
    )
  }

  const onPressInputButton = () => {
    if (disabled) return
    setOpenModal(true)
  }

  return (
    <ExpirationTimeButton
      placeholder={LL.common.expirationTime()}
      onPress={onPressInputButton}
      value={getExpirationTimeLabel({ minutes: expirationTime })}
      disabled={disabled}
      iconName="pencil"
      primaryTextTestProps={"Expiration time input button"}
      big={big}
      style={style}
      {...testProps("Expiration time button")}
    />
  )
}
