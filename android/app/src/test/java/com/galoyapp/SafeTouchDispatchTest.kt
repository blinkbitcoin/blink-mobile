package com.galoyapp

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class SafeTouchDispatchTest {

  @Test
  fun `returns true when superDispatch handles the event`() {
    var reported: Throwable? = null

    val handled = SafeTouchDispatch.dispatch(onFrameworkBug = { reported = it }) { true }

    assertTrue(handled)
    assertNull(reported)
  }

  @Test
  fun `returns false when superDispatch does not handle the event`() {
    var reported: Throwable? = null

    val handled = SafeTouchDispatch.dispatch(onFrameworkBug = { reported = it }) { false }

    assertFalse(handled)
    assertNull(reported)
  }

  @Test
  fun `swallows IllegalArgumentException and reports it`() {
    val frameworkBug = IllegalArgumentException("invalid pointerIndex -1")
    var reported: Throwable? = null

    val handled = SafeTouchDispatch.dispatch(onFrameworkBug = { reported = it }) {
      throw frameworkBug
    }

    assertFalse(handled)
    assertSame(frameworkBug, reported)
  }

  @Test
  fun `propagates other exceptions without reporting`() {
    val unrelated = IllegalStateException("not the framework bug")
    var reported: Throwable? = null

    val thrown = assertThrows(IllegalStateException::class.java) {
      SafeTouchDispatch.dispatch(onFrameworkBug = { reported = it }) { throw unrelated }
    }

    assertSame(unrelated, thrown)
    assertNull(reported)
  }
}
