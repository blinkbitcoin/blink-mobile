import * as React from "react"
import { ActivityIndicator, TouchableOpacity, View } from "react-native"

import { ListItem, makeStyles, Overlay, useTheme, Text } from "@rneui/themed"
import Icon from "react-native-vector-icons/Ionicons"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useState } from "react"
import { useAppConfig } from "@app/hooks"
import { testProps } from "@app/utils/testProps"

export const ProfileScreen: React.FC<ProfileProps> = ({
  identifier,
  token,
  selected,
  isFirstItem,
}) => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()
  const { LL } = useI18nContext()

  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const [switchLoading, setSwitchLoading] = useState(false)

  const { saveToken } = useAppConfig()

  const handleProfileSwitch = async () => {
    setSwitchLoading(true)
    await saveToken(token)

    // Small delay to ensure the new session token is processed and updated in the global state before navigating.
    // This prevents the "Primary" screen from initially loading data using the old session token.
    await new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 100)
    })

    setSwitchLoading(false)
    navigation.navigate("Primary")
  }

  return (
    <>
      <TouchableOpacity
        onPress={handleProfileSwitch}
        {...testProps(LL.AccountScreen.switchAccount())}
      >
        <ListItem
          bottomDivider
          containerStyle={[styles.listStyle, isFirstItem && styles.firstItem]}
        >
          {selected ? (
            <Icon name="checkmark-circle-outline" size={18} color={colors._green} />
          ) : (
            <View style={styles.spacerStyle} />
          )}
          <ListItem.Content>
            <ListItem.Title>{identifier}</ListItem.Title>
          </ListItem.Content>
        </ListItem>
      </TouchableOpacity>
      <Overlay isVisible={switchLoading} overlayStyle={styles.overlayStyle}>
        <ActivityIndicator size={50} color={styles.loadingIconColor.color} />
        <Text>{LL.AccountScreen.pleaseWait()}</Text>
      </Overlay>
    </>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  listStyle: {
    borderBottomWidth: 2,
    borderColor: colors.grey5,
  },
  firstItem: {
    borderTopWidth: 2,
  },
  overlayStyle: {
    backgroundColor: "transparent",
    shadowColor: "transparent",
  },
  loadingIconColor: {
    color: colors.primary,
  },
  spacerStyle: {
    width: 18,
  },
}))
