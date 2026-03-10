import { gql } from "@apollo/client"

import { useCardEncryptionPublicKeyLazyQuery } from "@app/graphql/generated"

gql`
  query cardEncryptionPublicKey {
    cardEncryptionPublicKey
  }
`

export const useCardEncryption = () => {
  const [fetchPublicKey, { loading }] = useCardEncryptionPublicKeyLazyQuery()

  return { fetchPublicKey, loading }
}
