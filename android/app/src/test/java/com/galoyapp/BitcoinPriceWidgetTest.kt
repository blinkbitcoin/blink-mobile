package com.galoyapp

import android.appwidget.AppWidgetManager
import android.content.Context
import android.view.View
import android.widget.TextView
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows
import org.robolectric.shadows.ShadowAppWidgetManager
import com.galoyapp.R

@RunWith(RobolectricTestRunner::class)
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
    fun shouldInflateViewAndAssignId() {
        val widgetId =
            shadowAppWidgetManager!!.createWidget(
                BitcoinPriceWidget::class.java, R.layout.bitcoin_price_widget
            )
        val widgetView = shadowAppWidgetManager!!.getViewFor(widgetId)

        Assert.assertEquals(
            "Loadings…",
            (widgetView.findViewById<View?>(R.id.btc_price) as TextView).getText().toString()
        )
    }

}