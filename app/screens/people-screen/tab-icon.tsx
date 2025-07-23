import { useEffect, useState } from "react"
import { View } from "react-native"

import { useApolloClient } from "@apollo/client"
import PeopleIcon from "@app/assets/icons/people.svg"
import { setInnerCircleCachedValue } from "@app/graphql/client-only-query"
import { useCirclesQuery, useInnerCircleValueQuery } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"
import { makeStyles } from "@rn-vui/themed"

type TabIconProps = {
  color: string
  focused: boolean
}

export const PeopleTabIcon: React.FC<TabIconProps> = ({ color, focused }) => {
  const { LL } = useI18nContext()
  const styles = useStyles()

  const [hidden, setHidden] = useState(true)

  const { data: cachedData } = useInnerCircleValueQuery()
  const { data: networkData } = useCirclesQuery({
    fetchPolicy: "cache-first",
  })

  const client = useApolloClient()

  useEffect(() => {
    const innerCircleCachedValue = cachedData?.innerCircleValue || -1
    const innerCircleRealValue =
      networkData?.me?.defaultAccount?.welcomeProfile?.innerCircleAllTimeCount || -1

    if (innerCircleCachedValue === -1 && innerCircleRealValue === -1) {
      setHidden(false)
      setInnerCircleCachedValue(client, 0)
      return
    }

    setHidden(innerCircleRealValue === innerCircleCachedValue)
    setInnerCircleCachedValue(client, innerCircleRealValue)
  }, [cachedData, networkData, setHidden, client])

  return (
    <View>
      {!hidden && (
        <>
          <View
            style={[
              styles.notificationDot,
              focused ? styles.notificationDotHighlight : {},
            ]}
          />
          <View
            style={[
              styles.notificationRing,
              focused ? styles.notificationRingHighlight : {},
            ]}
          />
        </>
      )}
      <PeopleIcon {...testProps(LL.PeopleScreen.title())} color={color} />
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  notificationDot: {
    position: "absolute",
    right: -6,
    top: -1,
    zIndex: 10,
    height: 4,
    width: 4,
    borderRadius: 2,
    backgroundColor: colors.grey2,
  },
  notificationDotHighlight: {
    backgroundColor: colors.primary,
  },
  notificationRing: {
    position: "absolute",
    right: -8,
    top: -3,
    zIndex: 10,
    height: 8,
    width: 8,
    borderRadius: 5,
    borderColor: colors.grey2,
    borderWidth: 1,
  },
  notificationRingHighlight: {
    borderColor: colors.primary,
  },
}))
