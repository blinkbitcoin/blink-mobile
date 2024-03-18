package app.bitcoinjungle.mobile;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

import java.io.IOException;
import java.text.NumberFormat;
import java.util.Locale;

import com.google.gson.Gson;

public class BitcoinPriceWidgetProvider extends AppWidgetProvider {

    private static final String API_URL = "https://price.bitcoinjungle.app/ticker";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    private void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.bitcoin_price_widget);

        OkHttpClient client = new OkHttpClient();
        Request request = new Request.Builder()
                .url(API_URL)
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                e.printStackTrace();
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                if (response.isSuccessful()) {
                    String jsonResponse = response.body().string();
                    Gson gson = new Gson();
                    PriceResponse priceResponse = gson.fromJson(jsonResponse, PriceResponse.class);
                    double btcUsd = priceResponse.BTCUSD.indexPrice;

                    NumberFormat currencyFormat = NumberFormat.getCurrencyInstance(Locale.US);
                    String formattedPrice = currencyFormat.format(btcUsd);
                    views.setTextViewText(R.id.btc_price, "Bitcoin Price\n" + formattedPrice);
                    appWidgetManager.updateAppWidget(appWidgetId, views);
                }
            }
        });
    }

    private static class PriceResponse {
        public PriceObject BTCUSD;

        private static class PriceObject {
            public double indexPrice;
        }
    }
}
