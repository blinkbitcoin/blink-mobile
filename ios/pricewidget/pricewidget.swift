import WidgetKit
import SwiftUI

struct pricewidget: Widget {
    let kind: String = "pricewidget"

    private var supportedFamilies: [WidgetFamily] {
        if #available(iOSApplicationExtension 16.0, *) {
            return [
                .systemSmall,
                .systemMedium,
                .accessoryCircular,
                .accessoryRectangular,
                .accessoryInline
            ]
        } else {
            return [
                .systemSmall,
                .systemMedium
            ]
        }
    }

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: BitcoinPriceProvider()) { entry in
            BitcoinPriceView(entry: entry)
        }
        .configurationDisplayName("Bitcoin Price")
        .description("Displays the current price of bitcoin.")
        .supportedFamilies(supportedFamilies)
    }
}

struct BitcoinPriceEntry: TimelineEntry {
    let date: Date
    let price: Double
}

struct BitcoinPriceProvider: TimelineProvider {
    func placeholder(in context: Context) -> BitcoinPriceEntry {
        BitcoinPriceEntry(date: Date(), price: 0)
    }

    func getSnapshot(in context: Context, completion: @escaping (BitcoinPriceEntry) -> ()) {
        let entry = BitcoinPriceEntry(date: Date(), price: 0)
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<BitcoinPriceEntry>) -> ()) {
        let currentDate = Date()
        let nextUpdateDate = Calendar.current.date(byAdding: .minute, value: 1, to: currentDate)!
        let url = URL(string: "https://orders.bitcoinjungle.app/price")!

        URLSession.shared.dataTask(with: url) { data, response, error in
            guard let data = data else {
                let timeline = Timeline(entries: [BitcoinPriceEntry(date: currentDate, price: 0)], policy: .atEnd)
                completion(timeline)
                return
            }

            let decoder = JSONDecoder()
            decoder.keyDecodingStrategy = .useDefaultKeys

            if let response = try? decoder.decode(BitcoinJungleResponse.self, from: data) {
                let price = Double(response.BTCUSD)
                let entry = BitcoinPriceEntry(date: currentDate, price: price!)
                let timeline = Timeline(entries: [entry], policy: .after(nextUpdateDate))
                completion(timeline)
            } else {
                let timeline = Timeline(entries: [BitcoinPriceEntry(date: currentDate, price: 0)], policy: .atEnd)
                completion(timeline)
            }
        }.resume()
    }
}

struct BitcoinPriceView: View {
    let entry: BitcoinPriceProvider.Entry

    @Environment(\.widgetFamily) private var family

    var body: some View {
        switch family {
            case .systemSmall, .systemMedium:
                NormalView(entry: entry)
            case .accessoryInline, .accessoryRectangular, .accessoryCircular:
                SmallView(entry: entry)
            default:
                NormalView(entry: entry)
        }
    }
}

struct NormalView: View {
    let entry: BitcoinPriceProvider.Entry
    var body: some View {
        VStack {
            Text("Bitcoin Price")
                .font(.headline)
            Text("$\(entry.price, specifier: "%.2f")")
                .font(.title)
        }
    }
}

struct SmallView: View {
    let entry: BitcoinPriceProvider.Entry
    var body: some View {
        VStack {
            Text("$\(entry.price, specifier: "%.0f")")
        }
    }
}

struct BitcoinJungleResponse: Codable {
    let BTCUSD: String
    let BTCCRC: Int
    let USDCRC: Double
    let USDCAD: Double
    let timestamp: String
}
