import React, { Component, Ref } from "react"
import {
  TouchableHighlight as RNTouchableHighlight,
  TouchableHighlightProps,
  View,
} from "react-native"

type Props = TouchableHighlightProps & {
  /** The native view. RNE's `TouchableComponent` slot takes a class, which can't pass a
   *  `ref` through, so it travels as this prop instead. */
  hostRef?: Ref<View>
}

export class TouchableHighlight extends Component<Props> {
  render() {
    const { hostRef, ...props } = this.props
    return <RNTouchableHighlight {...props} ref={hostRef} />
  }
}
