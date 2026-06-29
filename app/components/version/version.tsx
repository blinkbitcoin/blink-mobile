import * as React from "react"
import { Pressable } from "react-native"
import DeviceInfo from "react-native-device-info"

import useDeviceLocation from "@app/hooks/use-device-location"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useNavigation } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { Text, makeStyles } from "@rn-vui/themed"

import type { RootStackParamList } from "../../navigation/stack-param-lists"
import { testProps } from "../../utils/testProps"

const useStyles = makeStyles(({ colors }) => ({
  version: {
    color: colors.grey0,
    marginTop: 18,
    textAlign: "center",
  },
}))

type VersionComponentNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "getStarted" | "settings"
>

export const VersionComponent = () => {
  const styles = useStyles()
  const { navigate } = useNavigation<VersionComponentNavigationProp>()
  const { LL } = useI18nContext()
  const { countryCode } = useDeviceLocation()
  const detectedCountry = countryCode ?? LL.common.unknown()
  const [secretMenuCounter, setSecretMenuCounter] = React.useState(0)
  React.useEffect(() => {
    if (secretMenuCounter > 2) {
      navigate("developerScreen")
      setSecretMenuCounter(0)
    }
  }, [navigate, secretMenuCounter])

  const readableVersion = DeviceInfo.getReadableVersion()

  return (
    <Pressable onPress={() => setSecretMenuCounter(secretMenuCounter + 1)}>
      <Text {...testProps("Version Build Text")} style={styles.version}>
        {readableVersion}
        {"\n"}
        {LL.common.country()}: {detectedCountry}
        {"\n"}
        {LL.GetStartedScreen.headline()}
      </Text>
    </Pressable>
  )
}
