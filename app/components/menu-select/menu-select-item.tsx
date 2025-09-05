// This is a dummy item for better DX while writing the select component
// See ./item.ts for the correct item
import React from "react"

import { ListItemProps } from "@rn-vui/base"

export type MenuSelectItemProps = {
  children: React.ReactNode
  value: string
  testPropId?: string
} & ListItemProps

export const MenuSelectItem: React.FC<MenuSelectItemProps> = () => {
  return <></>
}
