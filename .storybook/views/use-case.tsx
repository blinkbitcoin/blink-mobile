import { Text, useTheme } from "@rneui/themed"
import * as React from "react"
import { View, TextStyle, ViewStyle } from "react-native"

const TITLE: TextStyle = { fontWeight: "600" }

const USE_CASE_WRAPPER: ViewStyle = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  borderTopColor: "#e6e6e6",
  borderTopWidth: 1,
  flexDirection: "row",
}

const USE_CASE: TextStyle = {
  fontSize: 10,
  paddingHorizontal: 4,
  paddingBottom: 2,
}

const USAGE: TextStyle = { fontSize: 10, paddingTop: 0 }
const HEADER: ViewStyle = {
  paddingTop: 20,
  paddingBottom: 10,
  paddingHorizontal: 10,
  borderBottomColor: "#e6e6e6",
  borderBottomWidth: 1,
}

export interface UseCaseProps {
  /** The title. */
  text: string
  /** When should we be using this? */
  usage?: string
  /** The component use case. */
  children: React.ReactNode
  /** A style override. Rarely used. */
  style?: ViewStyle
  /** Don't use any padding because it's important to see the spacing. */
  noPad?: boolean
}

export const UseCase: React.FC<UseCaseProps> = (props) => {
  const {
    theme: { colors },
  } = useTheme()

  const backgroundColor = { backgroundColor: colors.white }

  const style: ViewStyle = {
    ...{ padding: props.noPad ? 0 : 10, ...backgroundColor },
    ...props.style,
  }

  return (
    <>
      <View style={[HEADER, { ...backgroundColor }]}>
        <View style={USE_CASE_WRAPPER}>
          <Text style={USE_CASE}>Use Case</Text>
        </View>
        <View>
          <Text style={TITLE}>{props.text}</Text>
        </View>
        {props.usage ? <Text style={USAGE}>{props.usage}</Text> : null}
      </View>
      <View style={style}>{props.children}</View>
    </>
  )
}
