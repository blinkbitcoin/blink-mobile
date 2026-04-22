import React from "react"
import { View } from "react-native"

import { makeStyles, Text } from "@rn-vui/themed"

import CustomModal from "@app/components/custom-modal/custom-modal"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"

type Props = {
  isVisible: boolean
  onAcknowledge: () => void
}

export const StableBalanceFirstTimeModal: React.FC<Props> = ({
  isVisible,
  onAcknowledge,
}) => {
  const { LL } = useI18nContext()
  const styles = useStyles()

  return (
    <CustomModal
      isVisible={isVisible}
      toggleModal={onAcknowledge}
      title={LL.StableBalance.firstTimeModal.title()}
      body={
        <View {...testProps("stable-balance-first-time-modal")}>
          <Text type="p1" style={styles.dualBalanceText}>
            {LL.StableBalance.firstTimeModal.dualBalance()}
          </Text>
          <Text type="p1">{LL.StableBalance.firstTimeModal.trustDisclosure()}</Text>
        </View>
      }
      primaryButtonTitle={LL.StableBalance.firstTimeModal.acknowledge()}
      primaryButtonOnPress={onAcknowledge}
    />
  )
}

const useStyles = makeStyles(() => ({
  dualBalanceText: {
    marginBottom: 12,
  },
}))
