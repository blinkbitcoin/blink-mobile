import { useState } from "react"
import { View, TouchableOpacity } from "react-native"

import { Text, makeStyles } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { AccountLevel, useLevel } from "@app/graphql/level-context"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useI18nContext } from "@app/i18n/i18n-react"
import { AccountType } from "@app/types/wallet"

import { Delete } from "./delete"
import { LogOut } from "./logout"
import { SelfCustodialDelete } from "./self-custodial-delete"

export const DangerZoneSettings: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()

  const [expanded, setExpanded] = useState(false)

  const { currentLevel, isAtLeastLevelOne, isAtLeastLevelZero } = useLevel()
  const { activeAccount } = useAccountRegistry()
  const isSelfCustodial = activeAccount?.type === AccountType.SelfCustodial

  if (!isSelfCustodial && !isAtLeastLevelZero) return <></>

  return (
    <View style={styles.verticalSpacing}>
      <TouchableOpacity style={styles.titleStyle} onPress={() => setExpanded(!expanded)}>
        <GaloyIcon name={expanded ? "caret-down" : "caret-right"} size={20} />
        <Text type="p2" bold>
          {LL.AccountScreen.dangerZone()}
        </Text>
      </TouchableOpacity>
      {isSelfCustodial
        ? expanded && <SelfCustodialDelete />
        : expanded && (
            <>
              {isAtLeastLevelOne && <LogOut />}
              {currentLevel !== AccountLevel.NonAuth && <Delete />}
            </>
          )}
    </View>
  )
}

const useStyles = makeStyles(() => ({
  verticalSpacing: {
    marginTop: 5,
    display: "flex",
    flexDirection: "column",
    rowGap: 10,
  },
  titleStyle: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
}))
