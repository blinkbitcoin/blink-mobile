import React from 'react'
import Svg, { Path } from 'react-native-svg'

const PinIcon = ({ size = 50, color = "#4f378c" }) => (
  <Svg width={size} height={(size * 43) / 32} viewBox="0 0 32 43">
    <Path
      d="M0 16.0333C0 6.08 8.05161 0.131836 15.8361 0.131836C23.6205 0.131836 31.6721 6.08 31.6721 16.0333C31.6721 26.461 16.9494 41.3035 16.3229 41.9301C16.1941 42.0595 16.0185 42.1318 15.8361 42.1318C15.6536 42.1318 15.478 42.0595 15.3493 41.9301C14.7227 41.3035 0 26.461 0 16.0333Z"
      fill={color}
    />
  </Svg>
)

export default PinIcon