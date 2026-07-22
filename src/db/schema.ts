import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  primaryKey,
} from "drizzle-orm/sqlite-core";

/* ------------------------------------------------------------------ */
/* better-auth tables                                                  */
/* ------------------------------------------------------------------ */

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  // "admin" for the instance owner (the first account); null otherwise.
  role: text("role"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

/* ------------------------------------------------------------------ */
/* app tables                                                          */
/* ------------------------------------------------------------------ */

export const profiles = sqliteTable("profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  consentAcceptedAt: integer("consent_accepted_at", { mode: "timestamp" }),
  dateOfBirth: text("date_of_birth"), // ISO yyyy-mm-dd
  sex: text("sex", { enum: ["male", "female"] }),
  heightCm: real("height_cm"),
  weightKg: real("weight_kg"),
  activityLevel: text("activity_level", {
    enum: ["sedentary", "low_active", "active", "very_active"],
  }),
  pregnant: integer("pregnant", { mode: "boolean" }).notNull().default(false),
  lactating: integer("lactating", { mode: "boolean" }).notNull().default(false),
  region: text("region", { enum: ["CA", "US"] }).notNull().default("CA"),
  unitPreference: text("unit_preference", { enum: ["metric", "imperial"] })
    .notNull()
    .default("metric"),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

export const products = sqliteTable(
  "products",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    brand: text("brand"),
    upc: text("upc"),
    npn: text("npn"), // Health Canada Natural Product Number
    servingSize: text("serving_size"), // e.g. "1 capsule", "2 gummies"
    servingsPerContainer: real("servings_per_container"),
    source: text("source", {
      enum: ["dsld", "off", "lnhpd", "ocr", "manual"],
    }).notNull(),
    imageUrl: text("image_url"), // remote image imported from DSLD/OFF
    imagePath: text("image_path"), // user-uploaded photo, relative to uploads dir
    pillColor: text("pill_color"), // legacy single-colour key (kept for fallback)
    pillStyle: text("pill_style"), // JSON: { shape, size, color, color2 } // preset colour key for the placeholder pill
    // Dosage & stock (F2, unit-based). A "unit" is one tablet/capsule/etc.
    doseForm: text("dose_form"), // tablet | capsule | softgel | …
    doseAmount: real("dose_amount"), // units per intake (e.g. 2 tablets)
    doseFrequency: real("dose_frequency"), // intakes per dosePeriod
    dosePeriod: text("dose_period"), // day | week | month
    containerQty: real("container_qty"), // total units in a container
    unitsRemaining: real("units_remaining"), // units on hand as of stockUpdatedAt
    // legacy F2 fields (servings-based) — superseded by the unit fields above
    stockServings: real("stock_servings"),
    stockUpdatedAt: integer("stock_updated_at", { mode: "timestamp" }),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [index("products_user_id_idx").on(t.userId)],
);

export const productIngredients = sqliteTable(
  "product_ingredients",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    // canonical nutrient id from src/data/nutrients.ts, or null for
    // non-tracked ingredients (herbs, proprietary blends) kept for display
    nutrientId: text("nutrient_id"),
    label: text("label").notNull(), // ingredient name as printed on the label
    amountPerServing: real("amount_per_serving").notNull(),
    unit: text("unit").notNull(), // mcg | mg | g | IU
    form: text("form"), // e.g. "d3", "natural", "synthetic" — affects IU conversion
    // Order the ingredient appeared in on the source label, so the product
    // page can read like the bottle in hand. Canada mandates no ingredient
    // order, so the source's own order is the best signal we have.
    position: integer("position").notNull().default(0),
    // Non-medicinal / "other" ingredients (fillers, coatings, colours) kept as
    // their own rows for later use; they never count toward nutrient totals.
    nonMedicinal: integer("non_medicinal", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (t) => [index("product_ingredients_product_id_idx").on(t.productId)],
);

/**
 * Local copy of Health Canada's LNHPD product-licence list. Their API has no
 * search/filter parameters — the only options are single-record fetch by
 * internal id or the full 300k-row dump — so we sync the dump once into this
 * table and search it locally.
 */
/**
 * One row per *product name*, not per licence: Health Canada's dump lists every
 * marketed name for a licence (flavours, alternate brandings) as its own row
 * sharing one `lnhpd_id`. Keying on `lnhpd_id` alone dropped ~136k names, so
 * the key is the pair. Every field the dump gives us is kept.
 */
export const lnhpdIndex = sqliteTable(
  "lnhpd_index",
  {
    lnhpdId: integer("lnhpd_id").notNull(),
    productNameId: integer("product_name_id").notNull(),
    licenceNumber: text("licence_number").notNull(),
    productName: text("product_name").notNull(),
    companyName: text("company_name"),
    companyId: integer("company_id"),
    companyNameId: integer("company_name_id"),
    dosageForm: text("dosage_form"),
    // ISO date strings exactly as the dump provides them
    licenceDate: text("licence_date"),
    revisedDate: text("revised_date"),
    timeReceipt: text("time_receipt"),
    dateStart: text("date_start"),
    subSubmissionTypeCode: integer("sub_submission_type_code"),
    subSubmissionTypeDesc: text("sub_submission_type_desc"),
    // 1 when this is the licence's primary name
    flagPrimaryName: integer("flag_primary_name"),
    // 1 = active licence; 0/2/4 = cancelled, expired, etc.
    flagProductStatus: integer("flag_product_status"),
    flagAttestedMonograph: integer("flag_attested_monograph"),
  },
  (t) => [
    primaryKey({ columns: [t.lnhpdId, t.productNameId] }),
    index("lnhpd_index_licence_idx").on(t.licenceNumber),
    index("lnhpd_index_name_idx").on(t.productName),
    index("lnhpd_index_lnhpd_id_idx").on(t.lnhpdId),
  ],
);

export const lnhpdSyncState = sqliteTable("lnhpd_sync_state", {
  id: integer("id").primaryKey(), // single row, id = 1
  syncedAt: integer("synced_at", { mode: "timestamp" }),
  recordCount: integer("record_count"),
  // how often to auto-refresh the index, in days; 0 = never
  autoSyncDays: integer("auto_sync_days").notNull().default(0),
});

export const regimenItems = sqliteTable(
  "regimen_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    servingsPerDay: real("servings_per_day").notNull().default(1),
    // bit 0 = Monday … bit 6 = Sunday; 127 = every day
    daysOfWeek: integer("days_of_week").notNull().default(127),
    timeOfDay: text("time_of_day", {
      enum: ["morning", "noon", "evening", "any"],
    })
      .notNull()
      .default("any"),
  },
  (t) => [index("regimen_items_user_id_idx").on(t.userId)],
);
