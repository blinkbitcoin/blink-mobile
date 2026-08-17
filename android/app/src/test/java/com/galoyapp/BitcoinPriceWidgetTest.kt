package com.galoyapp

import android.appwidget.AppWidgetManager
import android.content.Context
import android.os.Bundle
import android.view.View
import android.widget.TextView
import androidx.test.core.app.ApplicationProvider
import androidx.work.Configuration
import androidx.work.Data
import androidx.work.ListenableWorker
import androidx.work.WorkInfo
import androidx.work.WorkManager
import androidx.work.testing.SynchronousExecutor
import androidx.work.testing.TestWorkerBuilder
import androidx.work.testing.WorkManagerTestInitHelper
import java.util.concurrent.Executor
import org.json.JSONObject
import org.junit.After
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
    application = TestApplication::class,
    // Robolectric needs Java 21 to emulate SDK 36 (the default from targetSdk),
    // but the RN Gradle plugin pins the test toolchain to Java 17.
    sdk = [35]
)
class BitcoinPriceWidgetTest {
    private var context: Context? = null
    private var appWidgetManager: AppWidgetManager? = null
    private var shadowAppWidgetManager: ShadowAppWidgetManager? = null
    private val defaultFetch = FetchPriceWorker.fetch

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

    @After
    fun tearDown() {
        FetchPriceWorker.fetch = defaultFetch
    }

    private fun createWidget(): Int =
        shadowAppWidgetManager!!.createWidget(
            BitcoinPriceWidget::class.java, R.layout.bitcoin_price_widget
        )

    private fun seedStoredPrice() {
        context!!.getSharedPreferences("bitcoinPricePrefs", Context.MODE_PRIVATE)
            .edit()
            // (50 / 10^6) * 100_000_000 / 100 = $50.00
            .putString("REALTIME_PRICE", """{"btcSatPrice":{"base":50,"offset":6}}""")
            .putString(
                "PRICE_ARRAY",
                """[{"price":{"formattedAmount":"49.5"}},{"price":{"formattedAmount":"50.5"}}]"""
            )
            .commit()
    }

    @Test
    fun shouldInflateViewAndAssignIdWithoutDoingAnyWork() {
        val widgetId = createWidget()
        val widgetView = shadowAppWidgetManager!!.getViewFor(widgetId)

        Assert.assertEquals(
            context!!.getString(R.string.loading),
            (widgetView.findViewById<View?>(R.id.btc_price) as TextView).getText().toString()
        )
    }

    @Test
    fun showsErrorStateWhenNoStoredPrice() {
        val widgetId = createWidget()
        val widgetView = shadowAppWidgetManager!!.getViewFor(widgetId)

        Assert.assertEquals(View.VISIBLE, widgetView.findViewById<View>(R.id.error_message).visibility)
        Assert.assertEquals(View.GONE, widgetView.findViewById<View>(R.id.btc_price).visibility)
        Assert.assertEquals(View.GONE, widgetView.findViewById<View>(R.id.btc_price_label).visibility)
    }

    @Test
    fun showsFormattedPriceWhenStoredPriceExists() {
        val widgetId = createWidget()

        seedStoredPrice()
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
    fun rendersPriceWithoutChartWhenWidgetHasNoSizeYet() {
        val widgetId = createWidget()
        seedStoredPrice()

        // No updateAppWidgetOptions: the launcher has not sized the widget, so
        // OPTION_APPWIDGET_MIN_WIDTH/MAX_HEIGHT are 0. Must not crash in
        // Bitmap.createBitmap ("width and height must be > 0").
        updateAppWidget(context!!, appWidgetManager!!, widgetId)
        val widgetView = shadowAppWidgetManager!!.getViewFor(widgetId)

        Assert.assertEquals(
            "$50.00",
            (widgetView.findViewById<View?>(R.id.btc_price) as TextView).getText().toString()
        )
    }

    @Test
    fun schedulesPriceFetchWorkOnEnabled() {
        createWidget()

        val workInfos = WorkManager.getInstance(context!!)
            .getWorkInfosByTag(BitcoinPriceWidget.FETCH_PRICE_WORK_TAG)
            .get()

        // onEnabled enqueues one immediate and one periodic fetch.
        Assert.assertEquals(2, workInfos.size)
    }

    @Test
    fun cancelsScheduledWorkOnDisabled() {
        createWidget()

        BitcoinPriceWidget().onDisabled(context!!)

        val workInfos = WorkManager.getInstance(context!!)
            .getWorkInfosByTag(BitcoinPriceWidget.FETCH_PRICE_WORK_TAG)
            .get()
        Assert.assertTrue(workInfos.isNotEmpty())
        Assert.assertTrue(workInfos.all { it.state == WorkInfo.State.CANCELLED })
    }

    @Test
    fun workerStoresFetchedPriceData() {
        FetchPriceWorker.fetch = {
            JSONObject(
                """{"btcPriceList":[{"price":{"formattedAmount":"49.5"}}],
                    "realtimePrice":{"btcSatPrice":{"base":50,"offset":6}}}"""
            )
        }
        val worker = TestWorkerBuilder.from(context!!, FetchPriceWorker::class.java, SynchronousExecutor())
            .setInputData(Data.Builder().putString("RANGE", "ONE_DAY").build())
            .build()

        val result = worker.doWork()

        Assert.assertTrue(result is ListenableWorker.Result.Success)
        val prefs = context!!.getSharedPreferences("bitcoinPricePrefs", Context.MODE_PRIVATE)
        Assert.assertTrue(
            JSONObject(prefs.getString("REALTIME_PRICE", "{}")!!).has("btcSatPrice")
        )
        Assert.assertEquals(
            "49.5",
            org.json.JSONArray(prefs.getString("PRICE_ARRAY", "[]"))
                .getJSONObject(0).getJSONObject("price").getString("formattedAmount")
        )
    }

    @Test
    fun workerStoresErrorPayloadAndWidgetShowsErrorWhenFetchFails() {
        val widgetId = createWidget()
        // What fetchBitcoinPrice returns on a non-200 response.
        FetchPriceWorker.fetch = {
            JSONObject("""{"btcPriceList": [], "realtimePrice": { "noData": true } }""")
        }
        val worker = TestWorkerBuilder.from(context!!, FetchPriceWorker::class.java, SynchronousExecutor())
            .setInputData(Data.Builder().putString("RANGE", "ONE_DAY").build())
            .build()

        worker.doWork()

        updateAppWidget(context!!, appWidgetManager!!, widgetId)
        val widgetView = shadowAppWidgetManager!!.getViewFor(widgetId)
        Assert.assertEquals(View.VISIBLE, widgetView.findViewById<View>(R.id.error_message).visibility)
        Assert.assertEquals(View.GONE, widgetView.findViewById<View>(R.id.btc_price).visibility)
    }

}
