package com.galoyapp

import android.appwidget.AppWidgetManager
import android.content.Context
import android.os.Bundle
import android.view.View
import android.widget.TextView
import androidx.test.core.app.ApplicationProvider
import androidx.work.Configuration
import androidx.work.WorkManager
import androidx.work.testing.SynchronousExecutor
import androidx.work.testing.WorkManagerTestInitHelper
import java.util.concurrent.Executor
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
        // onEnabled schedules FetchPriceWorker; give it a test WorkManager whose
        // worker executor drops tasks so no worker (and no network fetch) runs.
        val config = Configuration.Builder()
            .setExecutor(Executor { })
            .setTaskExecutor(SynchronousExecutor())
            .build()
        WorkManagerTestInitHelper.initializeTestWorkManager(context!!, config)
        appWidgetManager = AppWidgetManager.getInstance(context)
        shadowAppWidgetManager = Shadows.shadowOf(appWidgetManager)
    }

    @Test
    fun shouldInflateViewAndAssignIdWithoutDoingAnyWork() {
        val widgetId =
            shadowAppWidgetManager!!.createWidget(
                BitcoinPriceWidget::class.java, R.layout.bitcoin_price_widget
            )
        val widgetView = shadowAppWidgetManager!!.getViewFor(widgetId)

        Assert.assertEquals(
            context!!.getString(R.string.loading),
            (widgetView.findViewById<View?>(R.id.btc_price) as TextView).getText().toString()
        )
    }

    @Test
    fun showsErrorStateWhenNoStoredPrice() {
        val widgetId =
            shadowAppWidgetManager!!.createWidget(
                BitcoinPriceWidget::class.java, R.layout.bitcoin_price_widget
            )
        val widgetView = shadowAppWidgetManager!!.getViewFor(widgetId)

        Assert.assertEquals(View.VISIBLE, widgetView.findViewById<View>(R.id.error_message).visibility)
        Assert.assertEquals(View.GONE, widgetView.findViewById<View>(R.id.btc_price).visibility)
        Assert.assertEquals(View.GONE, widgetView.findViewById<View>(R.id.btc_price_label).visibility)
    }

    @Test
    fun showsFormattedPriceWhenStoredPriceExists() {
        val widgetId =
            shadowAppWidgetManager!!.createWidget(
                BitcoinPriceWidget::class.java, R.layout.bitcoin_price_widget
            )

        context!!.getSharedPreferences("bitcoinPricePrefs", Context.MODE_PRIVATE)
            .edit()
            // (50 / 10^6) * 100_000_000 / 100 = $50.00
            .putString("REALTIME_PRICE", """{"btcSatPrice":{"base":50,"offset":6}}""")
            .putString(
                "PRICE_ARRAY",
                """[{"price":{"formattedAmount":"49.5"}},{"price":{"formattedAmount":"50.5"}}]"""
            )
            .commit()
        val options = Bundle().apply {
            putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 320)
            putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 200)
        }
        appWidgetManager!!.updateAppWidgetOptions(widgetId, options)

        updateAppWidget(context!!, appWidgetManager!!, widgetId)
        val widgetView = shadowAppWidgetManager!!.getViewFor(widgetId)

        Assert.assertEquals(
            "$50.00",
            (widgetView.findViewById<View?>(R.id.btc_price) as TextView).getText().toString()
        )
        Assert.assertEquals(View.VISIBLE, widgetView.findViewById<View>(R.id.btc_price).visibility)
        Assert.assertEquals(View.GONE, widgetView.findViewById<View>(R.id.error_message).visibility)
    }

    @Test
    fun schedulesPriceFetchWorkOnEnabled() {
        shadowAppWidgetManager!!.createWidget(
            BitcoinPriceWidget::class.java, R.layout.bitcoin_price_widget
        )

        val workInfos = WorkManager.getInstance(context!!)
            .getWorkInfosByTag(FetchPriceWorker::class.java.name)
            .get()

        // onEnabled enqueues one immediate and one periodic fetch.
        Assert.assertEquals(2, workInfos.size)
    }

}
