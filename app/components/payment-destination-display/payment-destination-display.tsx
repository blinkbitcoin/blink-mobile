import React from "react"
import { ActivityIndicator } from "react-native"

import { useAppConfig } from "@app/hooks"
import { Text, makeStyles } from "@rn-vui/themed"

const useStyles = makeStyles(() => ({
  highlight: {
    fontWeight: "800",
    fontSize: 15,
  },
  primaryTextStyle: {
    flex: 1,
  },
}))

export const PaymentDestinationDisplay = ({
  destination,
  paymentType,
}: {
  destination?: string
  paymentType?: string
}) => {
  const styles = useStyles()

  const {
    appConfig: {
      galoyInstance: { lnAddressHostname: lnDomain },
    },
  } = useAppConfig()

  if (!destination) {
    return <ActivityIndicator />
  }

  if (destination.length < 40) {
    return (
      <Text
        type="p1"
        numberOfLines={1}
        ellipsizeMode={"middle"}
        style={styles.primaryTextStyle}
      >
        {destination}
        {paymentType === "intraledger" ? `@${lnDomain}` : ""}
      </Text>
    )
  }

  // we assume this is a bitcoin address or lightning invoice
  // not a username
  const firstSix = destination.slice(0, 6)
  const middle = destination.slice(6, -6)
  const lastSix = destination.slice(-6)

  return (
    <Text
      type="p2"
      style={styles.primaryTextStyle}
      numberOfLines={1}
      ellipsizeMode={"middle"}
    >
      <Text type="p2" style={styles.highlight}>
        {firstSix}
      </Text>
      {middle}
      <Text type="p2" style={styles.highlight}>
        {lastSix}
      </Text>
    </Text>
  )
}
