import React from "react"
import Svg, { Circle, Text } from "react-native-svg"

const ClusterIcon = ({
  size,
  color,
  count,
}: {
  size: number
  color: string
  count: number
}) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 45 45">
      <Circle cx={22.5} cy={22.5} r={22.5} fill={color} fillOpacity={0.3} />
      <Circle cx={22.5} cy={22.5} r={16.5} fill={color} fillOpacity={0.7} />
      <Text
        x={22.5}
        y={22.5}
        fontSize={14}
        fontWeight="bold"
        fill="#FFFFFF"
        textAnchor="middle"
        alignmentBaseline="middle"
      >
        {count}
      </Text>
    </Svg>
  )
}
export default ClusterIcon
