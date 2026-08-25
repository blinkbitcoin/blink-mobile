import { StyleProp, TextStyle } from "react-native"

import { createTheme } from "@rn-vui/themed"

import { light, dark } from "./colors"
import { cappedLineHeight, MAX_FONT_SIZE_MULTIPLIER } from "./text-scaling"

const theme = createTheme({
  lightColors: light,
  darkColors: dark,
  mode: "light",
  components: {
    /** rn-vui's Input forwards what it does not consume to the TextInput underneath, so
     *  the ceiling reaches typed text and placeholders the same way it reaches labels. */
    Input: {
      maxFontSizeMultiplier: MAX_FONT_SIZE_MULTIPLIER,
    },
    Button: {
      /** A button draws its title with rn-vui's own Text, which the theme's Text entry
       *  never reaches, so the ceiling travels through the props that Text receives.
       *  Without it the primary action is the one label that keeps growing. */
      titleProps: {
        maxFontSizeMultiplier: MAX_FONT_SIZE_MULTIPLIER,
      },
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
        fontFamily: "SourceSansPro-Regular",
      }

      const sizeStyle = props.type
        ? {
            h1: {
              fontSize: 24,
              lineHeight: cappedLineHeight(32),
              fontWeight: props.bold ? "600" : "400",
            },
            h2: {
              fontSize: 20,
              lineHeight: cappedLineHeight(24),
              fontWeight: props.bold ? "600" : "400",
            },
            p1: {
              fontSize: 18,
              lineHeight: cappedLineHeight(24),
              fontWeight: props.bold ? "600" : "400",
            },
            p2: {
              fontSize: 16,
              lineHeight: cappedLineHeight(24),
              fontWeight: props.bold ? "600" : "400",
            },
            p3: {
              fontSize: 14,
              lineHeight: cappedLineHeight(18),
              fontWeight: props.bold ? "600" : "400",
            },
            p4: {
              fontSize: 12,
              lineHeight: cappedLineHeight(18),
              fontWeight: props.bold ? "600" : "400",
            },
          }[props.type]
        : {}

      return {
        maxFontSizeMultiplier: MAX_FONT_SIZE_MULTIPLIER,
        style: {
          ...universalStyle,
          ...sizeStyle,
        } as StyleProp<TextStyle>,
      }
    },
  },
})

export default theme
