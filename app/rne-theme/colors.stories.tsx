import React from "react"
import { View } from "react-native"
import { ScrollView } from "react-native-gesture-handler"

import { light, dark } from "@app/rne-theme/colors"
import { createTheme, makeStyles, Text } from "@rn-vui/themed"

const theme = createTheme({ lightColors: light, darkColors: dark })

if (!theme.lightColors || !theme.darkColors) {
  throw Error("colors undefined")
}

const colorsLight = Object.entries(theme.lightColors)
  .filter(([_, value]) => typeof value === "string")
  .sort()

const colorsDark = Object.entries(theme.darkColors)
  .filter(([_, value]) => typeof value === "string")
  .sort()

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: colors.white,
  },
  colorWrapper: {
    marginRight: 10,
    marginBottom: 10,
  },
}))

export default {
  title: "Colors",
}

const Template = ({ colors }) => {
  const styles = useStyles()

  const colorBox = (value) => ({
    height: 40,
    width: 100,
    backgroundColor: value,
    // borderColor: "grey",
    // borderWidth: 1,
  })

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {colors.map(([name, value]) => (
        <View key={name} style={styles.colorWrapper}>
          <View style={colorBox(value)} />
          <Text type="p2">{name}</Text>
        </View>
      ))}
    </ScrollView>
  )
}

export const Light = Template.bind({})
Light.args = { colors: colorsLight }

export const Dark = Template.bind({})
Dark.args = { colors: colorsDark }
