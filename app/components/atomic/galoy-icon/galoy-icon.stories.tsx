import React from "react"
import { StyleSheet, View } from "react-native"

import { useTheme, Text } from "@rn-vui/themed"

import { GaloyIcon, IconNames, IconNamesType } from "."
import { Story, UseCase } from "../../../../.storybook/views"

const styles = StyleSheet.create({
  iconContainer: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
  },
  iconDisplayContainer: {
    width: 100,
    margin: 10,
    alignItems: "center",
  },
  fontSize: { fontSize: 12 },
})

const IconDisplay = ({
  name,
  ...props
}: {
  name: IconNamesType
  size: number
  color?: string
  backgroundColor?: string
}) => {
  return (
    <View style={styles.iconDisplayContainer}>
      <GaloyIcon name={name as IconNamesType} {...props} />
      <Text style={styles.fontSize}>{name}</Text>
    </View>
  )
}

const iconNamesSlice = IconNames.slice(0, 6)

export default {
  title: "Galoy Icon",
  component: GaloyIcon,
}

export const Default = () => {
  const {
    theme: { colors },
  } = useTheme()

  return (
    <Story>
      <UseCase text="Size 16">
        <View style={styles.iconContainer}>
          {IconNames.map((name) => (
            <IconDisplay key={name} name={name as IconNamesType} size={16} />
          ))}
        </View>
      </UseCase>
      <UseCase text="Size 20">
        <View style={styles.iconContainer}>
          {iconNamesSlice.map((name) => (
            <IconDisplay key={name} name={name as IconNamesType} size={20} />
          ))}
        </View>
      </UseCase>
      <UseCase text="Size 24">
        <View style={styles.iconContainer}>
          {iconNamesSlice.map((name) => (
            <IconDisplay key={name} name={name as IconNamesType} size={24} />
          ))}
        </View>
      </UseCase>
      <UseCase text="Size 32">
        <View style={styles.iconContainer}>
          {iconNamesSlice.map((name) => (
            <IconDisplay key={name} name={name as IconNamesType} size={32} />
          ))}
        </View>
      </UseCase>
      <UseCase text="Different Color">
        <View style={styles.iconContainer}>
          {iconNamesSlice.map((name) => (
            <IconDisplay
              key={name}
              name={name as IconNamesType}
              size={32}
              color={colors.primary}
            />
          ))}
        </View>
      </UseCase>
      <UseCase text="Fill">
        <View style={styles.iconContainer}>
          {iconNamesSlice.map((name) => (
            <IconDisplay
              key={name}
              name={name as IconNamesType}
              size={32}
              backgroundColor={colors.primary}
            />
          ))}
        </View>
      </UseCase>
    </Story>
  )
}
