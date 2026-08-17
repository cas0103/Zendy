exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createExtension("pgcrypto", { ifNotExists: true });

  pgm.createType("webshop_platform", ["shopify", "woocommerce", "other"]);
  pgm.createType("inventory_provider", ["shopify", "woocommerce", "other"]);
  pgm.createType("inventory_integration_status", ["connected", "error", "disconnected"]);
  pgm.createType("vehicle_type", ["bike", "scooter", "car"]);
  pgm.createType("courier_status", ["offline", "online_available", "on_delivery"]);
  pgm.createType("order_status", [
    "AANGEMAAKT",
    "BETAALD",
    "ZOEKEN_KOERIER",
    "KOERIER_TOEGEWEZEN",
    "KLAARSTAAN_VOOR_OPHALEN",
    "OPGEHAALD",
    "ONDERWEG_NAAR_KLANT",
    "AFGELEVERD",
    "KEUZE_VEREIST_GEEN_KOERIER",
    "OMGEZET_ANDERE_VERZENDING",
    "GEANNULEERD",
    "TERUGBETAALD",
  ]);
  pgm.createType("payment_status", ["pending", "paid", "refunded"]);
  pgm.createType("changed_by_actor", ["system", "store", "courier", "customer"]);
  pgm.createType("offer_response", ["pending", "accepted", "declined", "expired"]);
  pgm.createType("payout_status", ["pending", "paid"]);
  pgm.createType("rated_by_actor", ["customer", "store"]);

  pgm.createTable("stores", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    name: { type: "text", notNull: true },
    address: { type: "text", notNull: true },
    latitude: { type: "double precision", notNull: true },
    longitude: { type: "double precision", notNull: true },
    contact_email: { type: "text", notNull: true },
    contact_phone: { type: "text", notNull: true },
    is_active: { type: "boolean", notNull: true, default: true },
    webshop_platform: { type: "webshop_platform", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createTable("store_inventory_integrations", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    store_id: { type: "uuid", notNull: true, references: "stores", onDelete: "cascade" },
    provider: { type: "inventory_provider", notNull: true },
    api_credentials: { type: "text", notNull: true },
    status: { type: "inventory_integration_status", notNull: true, default: "disconnected" },
    last_synced_at: { type: "timestamptz" },
  });

  pgm.createTable("couriers", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    name: { type: "text", notNull: true },
    phone: { type: "text", notNull: true },
    vehicle_type: { type: "vehicle_type", notNull: true },
    status: { type: "courier_status", notNull: true, default: "offline" },
    current_latitude: { type: "double precision" },
    current_longitude: { type: "double precision" },
    balance: { type: "numeric(10,2)", notNull: true, default: 0 },
    rating_average: { type: "numeric(3,2)" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createTable("orders", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    store_id: { type: "uuid", notNull: true, references: "stores", onDelete: "restrict" },
    courier_id: { type: "uuid", references: "couriers", onDelete: "set null" },
    external_order_ref: { type: "text", notNull: true },
    status: { type: "order_status", notNull: true, default: "AANGEMAAKT" },
    customer_name: { type: "text", notNull: true },
    customer_phone: { type: "text", notNull: true },
    delivery_address: { type: "text", notNull: true },
    delivery_latitude: { type: "double precision", notNull: true },
    delivery_longitude: { type: "double precision", notNull: true },
    item_description: { type: "text" },
    item_value: { type: "numeric(10,2)" },
    delivery_fee_paid_by_customer: { type: "numeric(10,2)", notNull: true },
    store_fee: { type: "numeric(10,2)", notNull: true },
    courier_payout: { type: "numeric(10,2)" },
    payment_status: { type: "payment_status", notNull: true, default: "pending" },
    courier_search_started_at: { type: "timestamptz" },
    courier_search_expires_at: { type: "timestamptz" },
    customer_choice_expires_at: { type: "timestamptz" },
    pickup_confirmed_by_store_at: { type: "timestamptz" },
    delivered_confirmed_by_courier_at: { type: "timestamptz" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createTable("order_status_history", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    order_id: { type: "uuid", notNull: true, references: "orders", onDelete: "cascade" },
    status: { type: "order_status", notNull: true },
    changed_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    changed_by: { type: "changed_by_actor", notNull: true },
  });

  pgm.createTable("courier_offers", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    order_id: { type: "uuid", notNull: true, references: "orders", onDelete: "cascade" },
    courier_id: { type: "uuid", notNull: true, references: "couriers", onDelete: "cascade" },
    offered_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    expires_at: { type: "timestamptz", notNull: true },
    response: { type: "offer_response", notNull: true, default: "pending" },
    responded_at: { type: "timestamptz" },
  });

  pgm.createTable("payouts", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    courier_id: { type: "uuid", notNull: true, references: "couriers", onDelete: "restrict" },
    order_id: { type: "uuid", notNull: true, references: "orders", onDelete: "restrict" },
    amount: { type: "numeric(10,2)", notNull: true },
    status: { type: "payout_status", notNull: true, default: "pending" },
    paid_at: { type: "timestamptz" },
  });

  pgm.createTable("ratings", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    order_id: { type: "uuid", notNull: true, references: "orders", onDelete: "cascade" },
    rated_by: { type: "rated_by_actor", notNull: true },
    courier_id: { type: "uuid", notNull: true, references: "couriers", onDelete: "cascade" },
    score: { type: "smallint", notNull: true, check: "score >= 1 AND score <= 5" },
    comment: { type: "text" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createIndex("orders", "store_id");
  pgm.createIndex("orders", "courier_id");
  pgm.createIndex("orders", "status");
  pgm.createIndex("order_status_history", "order_id");
  pgm.createIndex("courier_offers", "order_id");
  pgm.createIndex("courier_offers", "courier_id");
};

exports.down = (pgm) => {
  pgm.dropTable("ratings");
  pgm.dropTable("payouts");
  pgm.dropTable("courier_offers");
  pgm.dropTable("order_status_history");
  pgm.dropTable("orders");
  pgm.dropTable("couriers");
  pgm.dropTable("store_inventory_integrations");
  pgm.dropTable("stores");

  pgm.dropType("rated_by_actor");
  pgm.dropType("payout_status");
  pgm.dropType("offer_response");
  pgm.dropType("changed_by_actor");
  pgm.dropType("payment_status");
  pgm.dropType("order_status");
  pgm.dropType("courier_status");
  pgm.dropType("vehicle_type");
  pgm.dropType("inventory_integration_status");
  pgm.dropType("inventory_provider");
  pgm.dropType("webshop_platform");
};
