declare module "*.svg" {
  import React from "react"
  import { SvgProps } from "react-native-svg"
  const content: React.FC<SvgProps>
  export default content
}

declare module "*.png" {
  import { ImageSourcePropType } from "react-native"
  const content: ImageSourcePropType
  export default content
}

declare module "*.gif" {
  const content: number
  export default content
}

declare module "*.json" {
  const content: string
  export default content
}
