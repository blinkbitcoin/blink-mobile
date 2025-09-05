import * as React from "react"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useI18nContext } from "@app/i18n/i18n-react"
import { Text, makeStyles } from "@rn-vui/themed"

type Props = {
  errs: { message: string }[]
  status: string
}

export const PaymentStatusIndicator: React.FC<Props> = ({ errs, status }) => {
  const styles = useStyles()

  const { LL } = useI18nContext()
  if (status === "success") {
    return (
      <>
        <GaloyIcon name={"payment-success"} size={128} />
        <Text type={"p1"} style={styles.successText}>
          {LL.SendBitcoinScreen.success()}
        </Text>
      </>
    )
  }

  if (status === "error") {
    return (
      <>
        <GaloyIcon name={"payment-error"} size={128} />
        {errs.map(({ message }, item) => (
          <Text type={"p1"} key={`error-${item}`} style={styles.errorText}>
            {message}
          </Text>
        ))}
      </>
    )
  }

  if (status === "pending") {
    return (
      <>
        <GaloyIcon name={"payment-pending"} size={128} />
        <Text type={"p1"} style={styles.pendingText}>
          {LL.SendBitcoinScreen.notConfirmed()}
        </Text>
      </>
    )
  }

  return <></>
}

const useStyles = makeStyles(({ colors }) => ({
  errorText: {
    color: colors.error,
    fontSize: 18,
    textAlign: "center",
  },

  pendingText: {
    textAlign: "center",
  },

  successText: {
    textAlign: "center",
  },
}))
