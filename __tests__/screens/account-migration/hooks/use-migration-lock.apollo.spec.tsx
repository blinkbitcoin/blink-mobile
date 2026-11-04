/**
 * The lock against a real Apollo client, where the next-step and lock specs mock the status
 * read away. What only this level can show: the frame in which a skipped read starts. The
 * step routing skips the read until a commit point loads, and a skip guard (keep-receiving)
 * acts the moment `loading` clears, so a frame reporting "not loading" with no answer would
 * hold the user on a generic error and step them back. Apollo 3.9 reports loading in that
 * same render; an upgrade that stops doing so must fail here rather than in the field.
 */
import React from "react"
import { MockedProvider } from "@apollo/client/testing"
import { renderHook, waitFor } from "@testing-library/react-native"

import { MigrationStatus, MigrationStatusDocument } from "@app/graphql/generated"
import { useMigrationLock } from "@app/screens/account-migration/hooks/use-migration-lock"
import { ServerMigrationFlow } from "@app/types/migration"
import { AccountType } from "@app/types/wallet"

jest.mock("@app/hooks/use-account-registry", () => ({
  ...jest.requireActual("@app/hooks/use-account-registry"),
  useAccountRegistry: () => ({
    activeAccount: { id: "account-1", type: AccountType.Custodial },
    loading: false,
  }),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  ...jest.requireActual("@app/graphql/is-authed-context"),
  useIsAuthed: () => true,
}))

const statusResponse = {
  request: { query: MigrationStatusDocument },
  result: {
    data: {
      migration: { __typename: "Migration", status: MigrationStatus.InProgress },
    },
  },
  delay: 20,
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MockedProvider mocks={[statusResponse]} addTypename={false}>
    {children}
  </MockedProvider>
)

type Frame = { skip: boolean; loading: boolean; flow: ServerMigrationFlow }

describe("useMigrationLock under a real client", () => {
  it("never reports a finished read without an answer once a skipped read starts", async () => {
    const frames: Frame[] = []
    const { rerender } = renderHook(
      ({ skip }: { skip: boolean }) => {
        const lock = useMigrationLock({ skip })
        frames.push({ skip, loading: lock.loading, flow: lock.flow })
        return lock
      },
      { initialProps: { skip: true }, wrapper },
    )

    rerender({ skip: false })
    await waitFor(() =>
      expect(frames[frames.length - 1].flow).toBe(ServerMigrationFlow.Open),
    )

    const framesAfterStart = frames.filter((frame) => !frame.skip)
    const firstAnswered = framesAfterStart.findIndex(
      (frame) => frame.flow !== ServerMigrationFlow.Unanswered,
    )
    const framesBeforeAnswer = framesAfterStart.slice(0, firstAnswered)
    expect(framesBeforeAnswer.length).toBeGreaterThan(0)
    for (const frame of framesBeforeAnswer) {
      expect(frame.loading).toBe(true)
    }
  })

  it("asks nothing while skipped", async () => {
    const { result } = renderHook(() => useMigrationLock({ skip: true }), { wrapper })

    expect(result.current.loading).toBe(false)
    expect(result.current.flow).toBe(ServerMigrationFlow.Unanswered)
  })
})
