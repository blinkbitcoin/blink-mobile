import { StyleProp, TextStyle } from "react-native"

import { createTheme } from "@rn-vui/themed"

import { light, dark } from "./colors"
import { fonts } from "./fonts"

const theme = createTheme({
  lightColors: light,
  darkColors: dark,
  mode: "light",
  components: {
    Button: {
      containerStyle: {
        borderRadius: 50,
      },
      buttonStyle: {
        paddingHorizontal: 32,
        paddingVertical: 8,
        borderRadius: 50,
      },
    },
    Text: (props, { colors }) => {
      /**
       * Bold picks the bold face rather than a weight: Android synthesises `fontWeight`
       * instead of loading the bold file, which reads thinner and clips at large sizes.
       * It applies with or without a `type`, so `bold` alone is enough to make text bold.
       */
      const universalStyle = {
        color: props.color || colors.black,
        fontFamily: props.bold ? fonts.bold : fonts.regular,
      }

      const sizeStyle = props.type
        ? {
            h1: {
              fontSize: 24,
              lineHeight: 32,
            },
            h2: {
              fontSize: 20,
              lineHeight: 24,
            },
            p1: {
              fontSize: 18,
              lineHeight: 24,
            },
            p2: {
              fontSize: 16,
              lineHeight: 24,
            },
            p3: {
              fontSize: 14,
              lineHeight: 18,
            },
            p4: {
              fontSize: 12,
              lineHeight: 18,
            },
          }[props.type]
        : {}

      return {
        style: {
          ...universalStyle,
          ...sizeStyle,
        } as StyleProp<TextStyle>,
      }
    },
  },
})

export default theme
