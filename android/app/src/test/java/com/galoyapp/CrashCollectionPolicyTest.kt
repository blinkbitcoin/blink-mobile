package com.galoyapp

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * The decision table behind automatic crash collection (AD-13, NFR-P1). Each case is a
 * launch or a resolution; the SDK calls that follow are the [CrashCollectionPolicy.Decision].
 */
class CrashCollectionPolicyTest {

  @Test
  fun `a first install starts with collection off and nothing to send`() {
    val decision = CrashCollectionPolicy.atLaunch(previous = null)

    assertEquals(
      CrashCollectionPolicy.Decision(collect = false, deleteUnsent = true, provenance = "unresolved"),
      decision,
    )
  }

  @Test
  fun `a launch after a permitted session collects, so the reports it holds are delivered`() {
    val decision = CrashCollectionPolicy.atLaunch(previous = "permitted")

    assertEquals(true, decision.collect)
    assertEquals(false, decision.deleteUnsent)
  }

  @Test
  fun `a launch after a denied session deletes what it holds and starts off`() {
    val decision = CrashCollectionPolicy.atLaunch(previous = "denied")

    assertEquals(false, decision.collect)
    assertEquals(true, decision.deleteUnsent)
  }

  @Test
  fun `a launch after a session that never resolved deletes what it holds`() {
    // The prior-permitted → unresolved crash: the session before last was permitted, the
    // last one crashed before saying what it was. Its provenance is "unresolved", written
    // at its own launch, so its report never goes.
    val decision = CrashCollectionPolicy.atLaunch(previous = "unresolved")

    assertEquals(false, decision.collect)
    assertEquals(true, decision.deleteUnsent)
  }

  @Test
  fun `every launch resets the provenance to unresolved for the session now starting`() {
    for (previous in listOf(null, "permitted", "denied", "unresolved", "garbage")) {
      assertEquals("unresolved", CrashCollectionPolicy.atLaunch(previous).provenance)
    }
  }

  @Test
  fun `an unknown provenance is treated as not permitted`() {
    val decision = CrashCollectionPolicy.atLaunch(previous = "garbage")

    assertEquals(false, decision.collect)
    assertEquals(true, decision.deleteUnsent)
  }

  @Test
  fun `resolving permitted collects from now on and records it for the next launch`() {
    assertEquals(
      CrashCollectionPolicy.Decision(collect = true, deleteUnsent = false, provenance = "permitted"),
      CrashCollectionPolicy.onDisposition(permitted = true),
    )
  }

  @Test
  fun `resolving denied stops collecting, deletes what is held, and records it`() {
    assertEquals(
      CrashCollectionPolicy.Decision(collect = false, deleteUnsent = true, provenance = "denied"),
      CrashCollectionPolicy.onDisposition(permitted = false),
    )
  }
}
