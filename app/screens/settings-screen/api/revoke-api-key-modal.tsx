import React from "react"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import CustomModal from "@app/components/custom-modal/custom-modal"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"

import { ApiKeyItem } from "./use-api-keys"

type Props = {
  apiKey: ApiKeyItem | null
  revoking: boolean
  onClose: () => void
  onRevoke: (apiKey: ApiKeyItem) => void
}

/** Going back is the primary action; revoking can't be undone, so it's the quieter one.
 *  Once a revoke is sent nothing closes the modal, since going back can't stop it. */
export const RevokeApiKeyModal: React.FC<Props> = ({
  apiKey,
  revoking,
  onClose,
  onRevoke,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()

  // keeps the name on screen while the modal fades out after apiKey is cleared
  const shownKeyRef = React.useRef(apiKey)
  if (apiKey) shownKeyRef.current = apiKey

  return (
    <CustomModal
      isVisible={Boolean(apiKey)}
      toggleModal={onClose}
      dismissable={!revoking}
      showCloseIconButton={true}
      closeIconButtonAccessibilityLabel={LL.common.close()}
      image={<GaloyIcon name="info" size={52} color={colors.primary} />}
      title={LL.ApiScreen.revokeTitle()}
      body={
        <Text style={styles.body}>
          {LL.ApiScreen.revokeBody({ name: shownKeyRef.current?.name ?? "" })}
        </Text>
      }
      primaryButtonTitle={LL.ApiScreen.revokeGoBack()}
      primaryButtonOnPress={onClose}
      primaryButtonDisabled={revoking}
      secondaryButtonTitle={LL.ApiScreen.revoke()}
      secondaryButtonOnPress={() => apiKey && onRevoke(apiKey)}
      secondaryButtonLoading={revoking}
      {...testProps("revoke-api-key-modal")}
    />
  )
}

const useStyles = makeStyles(({ colors }) => ({
  body: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
    color: colors.black,
  },
}))
