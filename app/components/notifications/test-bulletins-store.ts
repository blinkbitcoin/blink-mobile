import React from "react"

import { IconNamesType } from "../atomic/galoy-icon"

export type TestBulletin = {
  id: string
  title: string
  body: string
  icon?: IconNamesType
} & (
  | { type: "deep-link"; deepLink: string }
  | { type: "external-link"; url: string }
  | { type: "none" }
)

let bulletins: TestBulletin[] = []
const listeners = new Set<() => void>()

const notify = () => listeners.forEach((l) => l())

export const testBulletinsStore = {
  add: (bulletin: TestBulletin) => {
    bulletins = [...bulletins, bulletin]
    notify()
  },
  remove: (id: string) => {
    bulletins = bulletins.filter((b) => b.id !== id)
    notify()
  },
  clear: () => {
    bulletins = []
    notify()
    listeners.clear()
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getSnapshot: () => bulletins,
}

export const useTestBulletins = () =>
  React.useSyncExternalStore(testBulletinsStore.subscribe, testBulletinsStore.getSnapshot)
