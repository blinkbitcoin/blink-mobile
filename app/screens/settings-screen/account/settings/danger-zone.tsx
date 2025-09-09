import { View } from "react-native"

import { AccountLevel, useLevel } from "@app/graphql/level-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { Text, makeStyles } from "@rneui/themed"

import { Delete } from "./delete"
import { LogOut } from "./logout"

export const DangerZoneSettings: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()

  const { currentLevel, isAtLeastLevelOne, isAtLeastLevelZero } = useLevel()
  if (!isAtLeastLevelZero) return <></>

  return (
    <View style={styles.verticalSpacing}>
      <Text type="p2" bold>
        {LL.AccountScreen.dangerZone()}
      </Text>
      {isAtLeastLevelOne && <LogOut />}
      {currentLevel !== AccountLevel.NonAuth && <Delete />}
    </View>
  )
}

const useStyles = makeStyles(() => ({
  verticalSpacing: {
    marginTop: 10,
    display: "flex",
    flexDirection: "column",
    rowGap: 10,
  },
}))
