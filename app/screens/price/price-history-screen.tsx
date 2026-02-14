import * as React from "react"

import { makeStyles } from "@rn-vui/themed"

import { PriceHistory } from "../../components/price-history"
import { Screen } from "../../components/screen"

const useStyles = makeStyles((_theme) => ({
  screen: { flex: 1 },
}))

export const PriceHistoryScreen: React.FC = () => {
  const styles = useStyles()

  return (
    <Screen preset="scroll" style={styles.screen}>
      <PriceHistory />
    </Screen>
  )
}
