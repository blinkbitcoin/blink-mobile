import { makeStyles } from "@rn-vui/themed"
import { groupTitleGap } from "@app/rne-theme/tokens"

import { radius } from "@app/rne-theme/radius"

export const useSharedStepStyles = makeStyles(({ colors }) => ({
  section: {
    gap: groupTitleGap,
  },
  sectionTitle: {
    color: colors.textOnBackground,
    fontSize: 14,
    fontFamily: "Source Sans Pro",
    fontWeight: "400",
    lineHeight: 20,
  },
  settingsGroupContainer: {
    marginTop: 0,
    borderRadius: radius.default,
  },
  dividerStyle: {
    marginHorizontal: 22,
  },
}))
