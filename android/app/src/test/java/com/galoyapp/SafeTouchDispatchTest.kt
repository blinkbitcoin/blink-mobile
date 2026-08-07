package com.galoyapp

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class SafeTouchDispatchTest {

  private val safeTouchDispatch = SafeTouchDispatch()

  @Test
  fun `returns true when superDispatch handles the event`() {
    var reported: Throwable? = null

    val handled = safeTouchDispatch.dispatch(onFrameworkBug = { reported = it }) { true }

    assertTrue(handled)
    assertNull(reported)
  }

  @Test
  fun `returns false when superDispatch does not handle the event`() {
    var reported: Throwable? = null

    val handled = safeTouchDispatch.dispatch(onFrameworkBug = { reported = it }) { false }

    assertFalse(handled)
    assertNull(reported)
  }

  @Test
  fun `swallows the pointerIndex IllegalArgumentException and reports it`() {
    val frameworkBug = IllegalArgumentException("invalid pointerIndex -1")
    var reported: Throwable? = null

    val handled = safeTouchDispatch.dispatch(onFrameworkBug = { reported = it }) {
      throw frameworkBug
    }

    assertFalse(handled)
    assertSame(frameworkBug, reported)
  }

  @Test
  fun `swallows the out-of-range pointerIndex variant and reports it`() {
    val frameworkBug = IllegalArgumentException("pointerIndex out of range")
    var reported: Throwable? = null

    val handled = safeTouchDispatch.dispatch(onFrameworkBug = { reported = it }) {
      throw frameworkBug
    }

    assertFalse(handled)
    assertSame(frameworkBug, reported)
  }

  @Test
  fun `propagates IllegalArgumentException without a message without reporting`() {
    val messageless = IllegalArgumentException()
    var reported: Throwable? = null

    val thrown = assertThrows(IllegalArgumentException::class.java) {
      safeTouchDispatch.dispatch(onFrameworkBug = { reported = it }) { throw messageless }
    }

    assertSame(messageless, thrown)
    assertNull(reported)
  }

  @Test
  fun `propagates IllegalArgumentException with an unrelated message without reporting`() {
    val realBug = IllegalArgumentException("span index out of bounds")
    var reported: Throwable? = null

    val thrown = assertThrows(IllegalArgumentException::class.java) {
      safeTouchDispatch.dispatch(onFrameworkBug = { reported = it }) { throw realBug }
    }

    assertSame(realBug, thrown)
    assertNull(reported)
  }

  @Test
  fun `propagates other exceptions without reporting`() {
    val unrelated = IllegalStateException("not the framework bug")
    var reported: Throwable? = null

    val thrown = assertThrows(IllegalStateException::class.java) {
      safeTouchDispatch.dispatch(onFrameworkBug = { reported = it }) { throw unrelated }
    }

    assertSame(unrelated, thrown)
    assertNull(reported)
  }

  @Test
  fun `swallows repeated framework bugs but reports only the first`() {
    var reportCount = 0

    repeat(3) {
      val handled = safeTouchDispatch.dispatch(onFrameworkBug = { reportCount++ }) {
        throw IllegalArgumentException("invalid pointerIndex -1")
      }
      assertFalse(handled)
    }

    assertEquals(1, reportCount)
  }
}
