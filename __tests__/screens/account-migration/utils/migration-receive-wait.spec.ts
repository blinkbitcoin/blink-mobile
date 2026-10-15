import {
  isMigrationReceiveSupportDue,
  markAppForegrounded,
  markMigrationReceiveChecked,
  OVERDUE_RECEIVE_SUPPORT,
  resetMigrationReceiveWait,
  setMigrationReceiveOverdue,
} from "@app/screens/account-migration/utils/migration-receive-wait"
import { MigrationSupportOrigin, MigrationSupportReason } from "@app/types/migration"

const FOREGROUNDED_AT = 1_000_000

describe("migration-receive-wait", () => {
  beforeEach(() => {
    resetMigrationReceiveWait()
    markAppForegrounded(FOREGROUNDED_AT)
  })

  it("is never due while the receive is not overdue", () => {
    markMigrationReceiveChecked(FOREGROUNDED_AT + 1)

    expect(isMigrationReceiveSupportDue()).toBe(false)
  })

  it("is due once the receive is overdue and a check since the return found nothing", () => {
    setMigrationReceiveOverdue(true)
    markMigrationReceiveChecked(FOREGROUNDED_AT + 1)

    expect(isMigrationReceiveSupportDue()).toBe(true)
  })

  /** Timers stop in the background, so the window can elapse unseen: the check that fires
   *  on return gets its chance to clear the flag before support is offered, however long
   *  that check takes. */
  it("waits for a check taken since the app came back", () => {
    setMigrationReceiveOverdue(true)

    expect(isMigrationReceiveSupportDue()).toBe(false)
  })

  /** One in flight as the app left settles after it returns, on a look taken before. */
  it("does not count a check that began before the app came back", () => {
    setMigrationReceiveOverdue(true)
    markMigrationReceiveChecked(FOREGROUNDED_AT - 1)

    expect(isMigrationReceiveSupportDue()).toBe(false)
  })

  /** The foreground mark and the check it asks for can share a millisecond. */
  it("counts a check that began the moment the app came back", () => {
    setMigrationReceiveOverdue(true)
    markMigrationReceiveChecked(FOREGROUNDED_AT)

    expect(isMigrationReceiveSupportDue()).toBe(true)
  })

  it("asks again after the next return", () => {
    setMigrationReceiveOverdue(true)
    markMigrationReceiveChecked(FOREGROUNDED_AT + 1)
    markAppForegrounded(FOREGROUNDED_AT + 2)

    expect(isMigrationReceiveSupportDue()).toBe(false)
  })

  it("stops being due once the receive is no longer overdue", () => {
    setMigrationReceiveOverdue(true)
    markMigrationReceiveChecked(FOREGROUNDED_AT + 1)
    setMigrationReceiveOverdue(false)

    expect(isMigrationReceiveSupportDue()).toBe(false)
  })

  it("forgets the wait and the checks on reset", () => {
    setMigrationReceiveOverdue(true)
    markMigrationReceiveChecked(FOREGROUNDED_AT + 1)

    resetMigrationReceiveWait()
    setMigrationReceiveOverdue(true)

    expect(isMigrationReceiveSupportDue()).toBe(false)
  })

  it("hands over with the delayed reason, backing out to the screen beneath", () => {
    expect(OVERDUE_RECEIVE_SUPPORT).toEqual({
      reason: MigrationSupportReason.ReceiveDelayed,
      origin: MigrationSupportOrigin.Resume,
    })
  })
})
