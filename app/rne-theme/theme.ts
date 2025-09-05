import { StyleProp, TextStyle } from "react-native"

import { createTheme } from "@rn-vui/themed"

import { light, dark } from "./colors"

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
      const universalStyle = {
        color: props.color || colors.black,
        // FIXME: is it automatically selecting the right font?
        // because there is only one?
        // fontFamily: "SourceSansPro",
      }

      const sizeStyle = props.type
        ? {
            h1: {
              fontSize: 24,
              lineHeight: 32,
              fontWeight: props.bold ? "600" : "400",
            },
            h2: {
              fontSize: 20,
              lineHeight: 24,
              fontWeight: props.bold ? "600" : "400",
            },
            p1: {
              fontSize: 18,
              lineHeight: 24,
              fontWeight: props.bold ? "600" : "400",
            },
            p2: {
              fontSize: 16,
              lineHeight: 24,
              fontWeight: props.bold ? "600" : "400",
            },
            p3: {
              fontSize: 14,
              lineHeight: 18,
              fontWeight: props.bold ? "600" : "400",
            },
            p4: {
              fontSize: 12,
              lineHeight: 18,
              fontWeight: props.bold ? "600" : "400",
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
