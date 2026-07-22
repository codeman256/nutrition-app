ALTER TABLE `product_ingredients` ADD `non_medicinal` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `products` DROP COLUMN `non_medicinal_ingredients`;