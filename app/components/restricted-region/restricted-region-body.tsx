import * as React from "react"

import { Text, TextProps } from "@rn-vui/themed"

import { useI18nContext } from "@app/i18n/i18n-react"

type Props = {
  type?: TextProps["type"]
  style?: TextProps["style"]
}

/**
 * The sanctions copy is one message split across two keys. The banner, the modal
 * and the full-screen block all render it, so composing it once here keeps them
 * in lockstep when the wording changes; each surface still owns its own type and
 * style.
 */
export const RestrictedRegionBody: React.FC<Props> = ({ type, style }) => {
  const { LL } = useI18nContext()

  return (
    <Text type={type} style={style}>
      {LL.RestrictedRegion.body()}
      {"\n\n"}
      {LL.RestrictedRegion.bodyReturn()}
    </Text>
  )
}
