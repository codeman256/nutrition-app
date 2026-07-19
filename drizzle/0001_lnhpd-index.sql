CREATE TABLE `lnhpd_index` (
	`lnhpd_id` integer PRIMARY KEY NOT NULL,
	`licence_number` text NOT NULL,
	`product_name` text NOT NULL,
	`company_name` text,
	`dosage_form` text
);
--> statement-breakpoint
CREATE INDEX `lnhpd_index_licence_idx` ON `lnhpd_index` (`licence_number`);--> statement-breakpoint
CREATE INDEX `lnhpd_index_name_idx` ON `lnhpd_index` (`product_name`);--> statement-breakpoint
CREATE TABLE `lnhpd_sync_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`synced_at` integer,
	`record_count` integer
);
