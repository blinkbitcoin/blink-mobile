package com.galoyapp

import android.annotation.SuppressLint
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import androidx.core.content.ContextCompat
import androidx.work.Data
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.OutOfQuotaPolicy
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.github.mikephil.charting.charts.LineChart
import com.github.mikephil.charting.data.Entry
import com.github.mikephil.charting.data.LineData
import com.github.mikephil.charting.data.LineDataSet
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.pow

class BitcoinPriceWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onEnabled(context: Context) {
        super.onEnabled(context)

        val immediateWorkRequest = OneTimeWorkRequestBuilder<FetchPriceWorker>()
            .setInputData(Data.Builder().putString("RANGE", "ONE_DAY").build())
            .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
            .build()

        val periodicWorkRequest = PeriodicWorkRequestBuilder<FetchPriceWorker>(15, TimeUnit.MINUTES)
            .setInputData(Data.Builder().putString("RANGE", "ONE_DAY").build())
            .build()

        WorkManager.getInstance(context).apply {
            enqueue(immediateWorkRequest)
            enqueue(periodicWorkRequest)
        }

        val appWidgetManager = AppWidgetManager.getInstance(context)
        val appWidgetIds = appWidgetManager.getAppWidgetIds(ComponentName(context, BitcoinPriceWidget::class.java))
        appWidgetIds.forEach { appWidgetId ->
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onDisabled(context: Context) {
        WorkManager.getInstance(context).cancelAllWorkByTag("FETCH_PRICE_WORK")
    }
}

private fun generateChartBitmap(context: Context, data: JSONArray, width: Int, height: Int): Bitmap {
    val entries = ArrayList<Entry>()
    var maxY = 0f
    var minY = 9999999f
    for (i in 0 until data.length()) {
        val item = data.getJSONObject(i)
        val price = item.getJSONObject("price").getString("formattedAmount").toFloat()
        entries.add(Entry(i.toFloat(), price))
        if (price > maxY) { maxY = price }
        if (price < minY) { minY = price }
    }

    val chart = LineChart(context).apply {
        setDrawGridBackground(false)
        description.isEnabled = false
        legend.isEnabled = false
        axisLeft.isEnabled = false
        axisRight.isEnabled = false
        xAxis.isEnabled = false

        setBackgroundColor(Color.BLACK)
        setExtraOffsets(0f, 0f, 0f, 0f)
        setViewPortOffsets(0f, 0f, 0f, 0f)

        axisLeft.axisMaximum = maxY + ( (maxY - minY) * 0.3f )
    }

    val dataSet = LineDataSet(entries, "").apply {
        setDrawValues(false)
        setDrawCircles(false)
        mode = LineDataSet.Mode.HORIZONTAL_BEZIER
        cubicIntensity = 0.4f // Adjust this value to control the smoothness, default is 0.2
        lineWidth = 1f // Adjust the line width for aesthetic appearance
        color = ContextCompat.getColor(context, R.color.primary)
        setDrawFilled(true)
        fillDrawable = ContextCompat.getDrawable(context, R.drawable.bitcoin_price_widget_chart_gradient)
    }

    chart.data = LineData(dataSet)

    chart.measure(
        View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
        View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY))
    chart.layout(0, 0, chart.measuredWidth, chart.measuredHeight)

    chart.invalidate()
    return chart.getChartBitmap();
}

@SuppressLint("DefaultLocale")
internal fun updateAppWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
    val options = appWidgetManager.getAppWidgetOptions(appWidgetId)
    val width = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH)
    val height = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT)

    val minWidth = View.MeasureSpec.getSize(width)
    val maxHeight = View.MeasureSpec.getSize(height)

    val views = RemoteViews(context.packageName, R.layout.bitcoin_price_widget)

    val prefs = context.getSharedPreferences("bitcoinPricePrefs", Context.MODE_PRIVATE)
    val priceArray = JSONArray(prefs.getString("PRICE_ARRAY", "[]"))

    val realtimePrice = JSONObject(prefs.getString("REALTIME_PRICE", "No Data") ?: "{}")
    if (!realtimePrice.has("noData")) {

        val bitmap = generateChartBitmap(context, priceArray, minWidth, maxHeight)
        views.setImageViewBitmap(R.id.chart_image_view, bitmap)

        val btcSatBase = realtimePrice.getJSONObject("btcSatPrice").getLong("base")
        val btcSatOffset = realtimePrice.getJSONObject("btcSatPrice").getInt("offset")
        val btcUsdPrice = (btcSatBase / 10.0.pow(btcSatOffset)) * 100000000 / 100

        val formattedBtcUsdPrice = String.format("%.2f", btcUsdPrice)
        views.setTextViewText(R.id.btc_price, "$$formattedBtcUsdPrice")

        views.setViewVisibility(R.id.error_message, View.GONE)
        views.setViewVisibility(R.id.btc_price, View.VISIBLE)
        views.setViewVisibility(R.id.btc_price_label, View.VISIBLE)
        views.setViewVisibility(R.id.btc_logo, View.VISIBLE)
    } else {
        views.setViewVisibility(R.id.error_message, View.VISIBLE)
        views.setViewVisibility(R.id.btc_price, View.GONE)
        views.setViewVisibility(R.id.btc_price_label, View.GONE)
        views.setViewVisibility(R.id.btc_logo, View.GONE)
    }

    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("blink://price"))
    val pendingIntent = PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    views.setOnClickPendingIntent(R.id.bitcoin_price_widget, pendingIntent)

    appWidgetManager.updateAppWidget(appWidgetId, views)
}

enum class BitcoinPriceRanges {
    ONE_DAY,
    ONE_WEEK,
    ONE_MONTH,
    ONE_YEAR,
    FIVE_YEARS,
}

class FetchPriceWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        val range = BitcoinPriceRanges.valueOf(inputData.getString("RANGE") ?: "ONE_DAY")
        val jsonResponse = fetchBitcoinPrice(range)
        val priceArray = jsonResponse.getJSONArray("btcPriceList")
        val realtimePrice = jsonResponse.getJSONObject("realtimePrice")
        val prefs =
            applicationContext.getSharedPreferences("bitcoinPricePrefs", Context.MODE_PRIVATE)

        with(prefs.edit()) {
            putString("PRICE_ARRAY", priceArray.toString())
            putString("REALTIME_PRICE", realtimePrice.toString())
            apply()
        }

        updateWidgets(applicationContext)
        return Result.success()
    }

    private fun updateWidgets(context: Context) {
        val appWidgetManager = AppWidgetManager.getInstance(context)
        val ids = appWidgetManager.getAppWidgetIds(ComponentName(context, BitcoinPriceWidget::class.java))
        ids.forEach { id ->
            val updateIntent = Intent(context, BitcoinPriceWidget::class.java).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, intArrayOf(id))
            }
            context.sendBroadcast(updateIntent)
        }
    }

    private fun fetchBitcoinPrice(range: BitcoinPriceRanges): JSONObject {
        val url = URL("https://api.blink.sv/graphql")
        val query = "query BitcoinPriceForAppWidget(\$range: PriceGraphRange!) { btcPriceList(range: \$range) { timestamp price { base offset currencyUnit formattedAmount } } realtimePrice { btcSatPrice { base offset } timestamp usdCentPrice { base offset } } }"
        val jsonInputString = """{ "query": "$query", "variables": { "range": "$range" } }"""

        with(url.openConnection() as HttpURLConnection) {
            requestMethod = "POST"
            setRequestProperty("Content-Type", "application/json")
            doOutput = true
            outputStream.use { os ->
                os.write(jsonInputString.toByteArray())
            }
            return if (responseCode == HttpURLConnection.HTTP_OK) {
                BufferedReader(InputStreamReader(inputStream)).use { br ->
                    JSONObject(br.readText()).getJSONObject("data")
                }
            } else {
                JSONObject("{\"btcPriceList\": [], \"realtimePrice\": { \"noData\": true } }")
            }
        }
    }
}
