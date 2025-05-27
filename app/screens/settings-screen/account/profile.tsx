import * as React from "react"
import { ScrollView, TouchableOpacity, View } from "react-native"
import { Screen } from "@app/components/screen"

import { ListItem, makeStyles, useTheme } from "@rneui/themed"
import Icon from "react-native-vector-icons/Ionicons"
import { useI18nContext } from "@app/i18n/i18n-react"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"

export const ProfileScreen: React.FC = () => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()
  const { LL } = useI18nContext()

  return (
    <Screen keyboardShouldPersistTaps="handled" style={styles.containerScreen}>
      <ScrollView contentContainerStyle={styles.outer}>
        {Array.from({ length: 5 }).map((_, index) => (
          <TouchableOpacity onPress={() => null}>
            <ListItem
              key={index}
              bottomDivider
              containerStyle={{
                borderBottomWidth: 2,
                borderTopWidth: index === 0 ? 2 : 0,
                borderColor: colors.grey5,
              }}
            >
              {index === 2 ? (
                <Icon name="checkmark-circle-outline" size={18} color={colors._green} />
              ) : (
                <View style={{ width: 18 }} />
              )}
              <ListItem.Content>
                <ListItem.Title>{`Opción ${index}`}</ListItem.Title>
              </ListItem.Content>
            </ListItem>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <GaloyPrimaryButton
        style={styles.addAccountButton}
        onPress={() => null}
        title={LL.ProfileScreen.addAccount()}
      />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  containerScreen: {
    paddingBottom: 40,
  },
  outer: {
    marginTop: 4,
    paddingBottom: 20,
    display: "flex",
    flexDirection: "column",
    // rowGap: 2,
  },
  addAccountButton: {
    paddingHorizontal: 20,
  },
}))
