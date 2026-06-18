import * as React from "react"

import { RouteProp, useRoute } from "@react-navigation/native"

import { MenuSelect, MenuSelectItem } from "@app/components/menu-select"
import { Screen } from "@app/components/screen"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

type SelectionScreenRouteProp = RouteProp<RootStackParamList, "selectionScreen">

export const SelectionScreen: React.FC = () => {
  const route = useRoute<SelectionScreenRouteProp>()
  const { options, selectedValue, onSelect } = route.params

  const [currentValue, setCurrentValue] = React.useState(selectedValue)

  const handleSelect = async (value: string) => {
    setCurrentValue(value)
    onSelect(value)
  }

  return (
    <Screen preset="scroll">
      <MenuSelect value={currentValue} onChange={handleSelect}>
        {options.map((option) => (
          <MenuSelectItem key={option.value} value={option.value}>
            {option.label}
          </MenuSelectItem>
        ))}
      </MenuSelect>
    </Screen>
  )
}
