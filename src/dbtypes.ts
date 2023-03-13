import type { Database } from "./database.types";

export type PickTable<Schema extends keyof Database, Table extends keyof Database[Schema]["Tables"]> = Database[Schema]["Tables"][Table];

export type StorefrontRow = PickTable<"public", "storefronts">["Row"]
export type StorefrontCategoryRow = PickTable<"public", "storefront_categories">["Row"]
export type StorefrontImageRow = PickTable<"public", "storefront_images">["Row"]