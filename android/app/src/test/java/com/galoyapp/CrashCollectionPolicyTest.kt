package com.galoyapp

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

/**
 * The decision table behind automatic crash collection. Each case is a launch or a
 * disposition change; the SDK calls that follow are the [CrashCollectionPolicy.Decision].
 */
class CrashCollectionPolicyTest {

  @Test
  fun `a first install starts with collection off and deletes what it holds`() {
    assertEquals(
      CrashCollectionPolicy.Decision(
        collect = false,
        sendUnsent = false,
        deleteUnsent = true,
        provenance = "unresolved",
      ),
      CrashCollectionPolicy.atLaunch(previous = null),
    )
  }

  @Test
  fun `a launch after a permitted session sends what it left, without collecting`() {
    // Collecting from the start would let the SDK upload a crash in *this* session before
    // it has said what it is, and on iOS persist that switch into the next launch.
    assertEquals(
      CrashCollectionPolicy.Decision(
        collect = false,
        sendUnsent = true,
        deleteUnsent = false,
        provenance = "unresolved",
      ),
      CrashCollectionPolicy.atLaunch(previous = "permitted"),
    )
  }

  @Test
  fun `no launch ever collects, whatever the previous session was`() {
    for (previous in listOf(null, "permitted", "denied", "unresolved", "garbage")) {
      assertFalse(previous.toString(), CrashCollectionPolicy.atLaunch(previous).collect)
    }
  }

  @Test
  fun `a launch after a denied session deletes what it holds`() {
    val decision = CrashCollectionPolicy.atLaunch(previous = "denied")

    assertEquals(true, decision.deleteUnsent)
    assertEquals(false, decision.sendUnsent)
  }

  @Test
  fun `a launch after a session that never resolved deletes what it holds`() {
    val decision = CrashCollectionPolicy.atLaunch(previous = "unresolved")

    assertEquals(true, decision.deleteUnsent)
    assertEquals(false, decision.sendUnsent)
  }

  @Test
  fun `an unknown provenance is treated as not permitted`() {
    val decision = CrashCollectionPolicy.atLaunch(previous = "garbage")

    assertEquals(true, decision.deleteUnsent)
    assertEquals(false, decision.sendUnsent)
  }

  @Test
  fun `every launch resets the provenance to unresolved for the session now starting`() {
    for (previous in listOf(null, "permitted", "denied", "unresolved", "garbage")) {
      assertEquals("unresolved", CrashCollectionPolicy.atLaunch(previous).provenance)
    }
  }

  @Test
  fun `resolving permitted collects from now on and records it for the next launch`() {
    assertEquals(
      CrashCollectionPolicy.Decision(
        collect = true,
        sendUnsent = false,
        deleteUnsent = false,
        provenance = "permitted",
      ),
      CrashCollectionPolicy.onDisposition("permitted"),
    )
  }

  @Test
  fun `resolving denied stops collecting, deletes what is held, and records it`() {
    assertEquals(
      CrashCollectionPolicy.Decision(
        collect = false,
        sendUnsent = false,
        deleteUnsent = true,
        provenance = "denied",
      ),
      CrashCollectionPolicy.onDisposition("denied"),
    )
  }

  @Test
  fun `falling back to unresolved stops collecting and keeps what is held`() {
    // The session may still turn out permitted; if it never does, the next launch deletes.
    assertEquals(
      CrashCollectionPolicy.Decision(
        collect = false,
        sendUnsent = false,
        deleteUnsent = false,
        provenance = "unresolved",
      ),
      CrashCollectionPolicy.onDisposition("unresolved"),
    )
  }

  @Test
  fun `an unrecognised disposition collects nothing`() {
    assertEquals(
      CrashCollectionPolicy.onDisposition("unresolved"),
      CrashCollectionPolicy.onDisposition("something-else"),
    )
  }
}
