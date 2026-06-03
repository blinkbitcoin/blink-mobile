import type { PropsWithChildren } from "react"
import type { TextInput } from "react-native"
import type { InputProps } from "@rn-vui/base"

/**
 * Workaround for the `@rn-vui/themed` Input ref typing bug: `withTheme(Input)`
 * exposes an impossible ref intersection that this type satisfies at compile
 * time. At runtime `ref.current` is fully compatible with `TextInput`.
 *
 * Refs:
 * - https://github.com/react-native-elements/react-native-elements/issues/3202
 * - https://github.com/react-native-elements/react-native-elements/issues/4032
 */
export type InputRef = TextInput & PropsWithChildren<InputProps>
