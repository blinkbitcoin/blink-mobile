import {
  FOREGROUND_RECHECK_GRACE_MS,
  isMigrationReceiveSupportDue,
  markAppForegrounded,
  OVERDUE_RECEIVE_SUPPORT,
  setMigrationReceiveOverdue,
} from "@app/screens/account-migration/utils/migration-receive-wait"
import { MigrationSupportOrigin, MigrationSupportReason } from "@app/types/migration"

const NOW = 1_000_000

describe("migration-receive-wait", () => {
  beforeEach(() => {
    setMigrationReceiveOverdue(false)
    markAppForegrounded(0)
  })

  it("is never due while the receive is not overdue", () => {
    expect(isMigrationReceiveSupportDue(NOW)).toBe(false)
  })

  it("is due once the receive is overdue and the app has long been active", () => {
    setMigrationReceiveOverdue(true)

    expect(isMigrationReceiveSupportDue(NOW)).toBe(true)
  })

  /** Timers stop in the background, so the window can elapse unseen: the check that fires
   *  on return gets its chance to clear the flag before support is offered. */
  it("waits out the grace after the app comes back", () => {
    setMigrationReceiveOverdue(true)
    markAppForegrounded(NOW)

    expect(isMigrationReceiveSupportDue(NOW + FOREGROUND_RECHECK_GRACE_MS - 1)).toBe(
      false,
    )
    expect(isMigrationReceiveSupportDue(NOW + FOREGROUND_RECHECK_GRACE_MS)).toBe(true)
  })

  it("stops being due once the receive is no longer overdue", () => {
    setMigrationReceiveOverdue(true)
    setMigrationReceiveOverdue(false)

    expect(isMigrationReceiveSupportDue(NOW)).toBe(false)
  })

  it("reads the current time when none is given", () => {
    setMigrationReceiveOverdue(true)
    markAppForegrounded()

    expect(isMigrationReceiveSupportDue()).toBe(false)
  })

  it("hands over with the delayed reason, backing out to the screen beneath", () => {
    expect(OVERDUE_RECEIVE_SUPPORT).toEqual({
      reason: MigrationSupportReason.ReceiveDelayed,
      origin: MigrationSupportOrigin.Resume,
    })
  })
})
