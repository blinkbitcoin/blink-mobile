import { BtcMapPlace } from "./types"

/**
 * BTC Map does not publish a category for a place — the only classification that
 * reaches us is the Material icon name it tags the pin with, and that is all the
 * offline snapshot carries. So the filter buckets those ~157 icon names.
 *
 * Grouping the icon rather than the underlying OpenStreetMap tag means filtering
 * runs against the cached list with no network and no per-place detail fetch:
 * the alternative is ~29k requests. It also means two places that share a pin
 * share a bucket, which is exactly what someone reading the map already assumes.
 *
 * The set is server-driven and grows without us, so anything unrecognised lands
 * in `other` rather than disappearing from a filtered map.
 */
export const CATEGORY_ICONS = {
  restaurants: [
    "restaurant",
    "lunch_dining",
    "local_pizza",
    "tapas",
    "outdoor_grill",
    "cooking",
  ],
  cafes: ["local_cafe", "coffee", "emoji_food_beverage"],
  bakeries: ["bakery_dining", "cake", "icecream"],
  bars: ["local_bar", "sports_bar", "wine_bar", "nightlife", "liquor"],
  groceries: ["local_grocery_store", "shopping_cart"],
  shops: [
    "storefront",
    "local_mall",
    "checkroom",
    "card_giftcard",
    "diamond",
    "toys",
    "watch",
    "local_florist",
    "chair",
    "luggage",
    "videogame_asset",
    "games",
    "smartphone",
    "computer",
    "hardware",
    "grass",
    "palette",
    "menu_book",
    "music_note",
    "piano",
    "smoking_rooms",
    "vaping_rooms",
    "edit",
    "newspaper",
    "bedroom_baby",
    "potted_plant",
    "cruelty_free",
    "footprint",
    "pets",
    "photo_camera",
    "hive",
  ],
  money: ["local_atm", "currency_exchange", "attach_money", "account_balance"],
  lodging: ["hotel", "chalet", "camping", "cottage"],
  automotive: [
    "local_gas_station",
    "car_repair",
    "directions_car",
    "local_car_wash",
    "two_wheeler",
    "trip_origin",
    "car_rental",
    "minor_crash",
    "pedal_bike",
  ],
  health: [
    "medical_services",
    "dentistry",
    "local_pharmacy",
    "visibility",
    "local_hospital",
    "surgical",
    "science",
  ],
  beauty: ["content_cut", "spa", "colorize", "sauna"],
  services: [
    "business",
    "build",
    "balance",
    "construction",
    "engineering",
    "local_printshop",
    "design_services",
    "architecture",
    "cleaning_services",
    "local_laundry_service",
    "carpenter",
    "imagesearch_roller",
    "plumbing",
    "roofing",
    "electrical_services",
    "hvac",
    "lock",
    "window",
    "water_drop",
    "water_pump",
    "delete",
    "warehouse",
    "factory",
    "agriculture",
    "dns",
    "cell_tower",
    "videocam",
    "translate",
    "local_post_office",
    "mail",
    "local_taxi",
    "airport_shuttle",
    "commute",
    "flight_takeoff",
    "local_parking",
    "child_care",
    "school",
    "home",
    "electric_bolt",
    "celebration",
    "tour",
  ],
  sports: [
    "fitness_center",
    "sports",
    "sports_martial_arts",
    "pool",
    "sports_score",
    "surfing",
    "golf_course",
    "scuba_diving",
    "sailing",
    "paragliding",
    "sports_handball",
    "sports_soccer",
    "kitesurfing",
    "kayaking",
    "stadium",
  ],
  leisure: [
    "attractions",
    "local_movies",
    "museum",
    "beach_access",
    "park",
    "casino",
    "castle",
    "mic",
    "directions_boat",
    "nature_people",
    "directions_walk",
  ],
} as const

export type PlaceCategory = keyof typeof CATEGORY_ICONS | "other"

/**
 * The order the filter lists them in: what people come to this map looking for
 * first, then the long tail, then the catch-all.
 */
export const PLACE_CATEGORIES: readonly PlaceCategory[] = [
  "restaurants",
  "cafes",
  "bakeries",
  "bars",
  "groceries",
  "shops",
  "money",
  "lodging",
  "automotive",
  "health",
  "beauty",
  "services",
  "sports",
  "leisure",
  "other",
]

const CATEGORY_BY_ICON: ReadonlyMap<string, PlaceCategory> = new Map(
  Object.entries(CATEGORY_ICONS).flatMap(([category, icons]) =>
    icons.map((icon) => [icon, category as PlaceCategory] as const),
  ),
)

/**
 * Which bucket a pin belongs to. The wire spells icons snake_case, but the same
 * names are kebab-case once they reach the icon font, so both are accepted
 * rather than silently bucketing half the map as "other".
 */
export const categoryOf = (icon?: string | null): PlaceCategory => {
  if (!icon) return "other"
  return CATEGORY_BY_ICON.get(icon.toLowerCase().replace(/-/g, "_")) ?? "other"
}

/**
 * The places left after the filter.
 *
 * An empty selection means "no filter", not "nothing" — a map that went blank
 * the moment the last toggle was switched off would read as broken. The input
 * array is returned as-is in that case, and that identity matters: the clusterer
 * rebuilds its whole index for ~29k points whenever this array changes.
 */
export const placesInCategories = (
  places: BtcMapPlace[],
  categories: ReadonlySet<PlaceCategory>,
): BtcMapPlace[] => {
  if (!categories.size) return places
  return places.filter((place) => categories.has(categoryOf(place.icon)))
}
