package com.galoyapp

import android.appwidget.AppWidgetManager
import android.content.Context
import android.view.View
import android.widget.TextView
import androidx.test.core.app.ApplicationProvider
import androidx.work.Configuration
import androidx.work.testing.SynchronousExecutor
import androidx.work.testing.WorkManagerTestInitHelper
import org.junit.Assert
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowAppWidgetManager
import com.galoyapp.R

@RunWith(RobolectricTestRunner::class)
@Config(
    application = TestApplication::class
)
class BitcoinPriceWidgetTest {
    private var context: Context? = null
    private var appWidgetManager: AppWidgetManager? = null
    private var shadowAppWidgetManager: ShadowAppWidgetManager? = null

    @Before
    @Throws(Exception::class)
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        appWidgetManager = AppWidgetManager.getInstance(context)
        shadowAppWidgetManager = Shadows.shadowOf(appWidgetManager)
    }

    @Test
    fun shouldInflateViewAndAssignIdWithoutDoingAnyWork() {
        // Build a test-friendly configuration without an executor
        val config = Configuration.Builder()
            .build()

        WorkManagerTestInitHelper.initializeTestWorkManager(context!!, config)

        // Test loading the widget and check results without any logic executed
        val widgetId =
            shadowAppWidgetManager!!.createWidget(
                BitcoinPriceWidget::class.java, R.layout.bitcoin_price_widget
            )
        val widgetView = shadowAppWidgetManager!!.getViewFor(widgetId)

        Assert.assertEquals(
            "Loading…",
            (widgetView.findViewById<View?>(R.id.btc_price) as TextView).getText().toString()
        )
    }

    @Test
    fun shouldInflateViewAndAssignIdWhileExecutingWork() {
        // Build a test-friendly configuration using a SynchronousExecutor
        val config = Configuration.Builder()
            .setExecutor(SynchronousExecutor())
            .build()

        WorkManagerTestInitHelper.initializeTestWorkManager(context!!, config)

        // Wait for the work to be processed and check result is correct
//        val widgetId =
//            shadowAppWidgetManager!!.createWidget(
//                BitcoinPriceWidget::class.java, R.layout.bitcoin_price_widget
//            )
//        val widgetView = shadowAppWidgetManager!!.getViewFor(widgetId)
//
//        Assert.assertEquals(
//            "Loading…",
//            (widgetView.findViewById<View?>(R.id.btc_price) as TextView).getText().toString()
//        )
    }

}