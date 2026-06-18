import { makeStyles } from "@rn-vui/themed"

export const useSharedStepStyles = makeStyles(({ colors }) => ({
  section: {
    gap: 3,
  },
  sectionTitle: {
    color: colors.black,
    fontSize: 14,
    fontFamily: "Source Sans Pro",
    fontWeight: "400",
    lineHeight: 20,
  },
  settingsGroupContainer: {
    marginTop: 0,
    borderRadius: 8,
  },
  dividerStyle: {
    marginHorizontal: 22,
  },
}))
