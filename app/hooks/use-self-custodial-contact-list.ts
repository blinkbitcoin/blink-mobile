import { useCallback, useRef, useState } from "react"

import { useFocusEffect } from "@react-navigation/native"

import { UserContact } from "@app/graphql/generated"
import { unifiedContactToUserContact } from "@app/screens/people-screen/contacts/legacy-contact-shims"

import { useContacts } from "./use-contacts"

export const useSelfCustodialContactList = (enabled: boolean): UserContact[] => {
  const adapter = useContacts()
  const adapterRef = useRef(adapter)
  adapterRef.current = adapter

  const [contacts, setContacts] = useState<UserContact[]>([])

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return undefined
      let cancelled = false
      adapterRef.current.list().then((result) => {
        if (cancelled) return
        setContacts(result.contacts.map(unifiedContactToUserContact))
      })
      return () => {
        cancelled = true
      }
    }, [enabled]),
  )

  return contacts
}
