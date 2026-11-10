import { StyleSheet } from "react-native"

type HostNode = { props: { style?: unknown }; parent: HostNode | null }

/** The background of the nearest surface that paints one around a value. */
export const surfaceColor = (node: unknown) => {
  for (let current = node as HostNode | null; current; current = current.parent) {
    const { backgroundColor } = StyleSheet.flatten(current.props.style as never) ?? {}
    if (backgroundColor) return backgroundColor
  }
  return undefined
}
