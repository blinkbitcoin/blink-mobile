import { makeStyles } from "@rn-vui/themed"
import { groupTitleGap } from "@app/rne-theme/tokens"

import { radius } from "@app/rne-theme/radius"
import { fonts } from "@app/rne-theme/fonts"

export const useSharedStepStyles = makeStyles(({ colors }) => ({
  section: {
    gap: groupTitleGap,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: fonts.regular,
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
