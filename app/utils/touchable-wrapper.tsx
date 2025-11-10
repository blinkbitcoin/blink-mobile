import React, { Component } from "react"
import {
  TouchableHighlight as RNTouchableHighlight,
  TouchableHighlightProps,
} from "react-native"

export class TouchableHighlight extends Component<TouchableHighlightProps> {
  render() {
    return <RNTouchableHighlight {...this.props} />
  }
}
