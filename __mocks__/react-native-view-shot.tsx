import React from "react"
import { View } from "react-native"

type Props = { children?: React.ReactNode }

const ViewShot = ({ children }: Props) => <View>{children}</View>

export const captureRef = () => Promise.resolve("mock://viewshot")

export default ViewShot
