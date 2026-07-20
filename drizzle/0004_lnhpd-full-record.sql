-- The old index was keyed on lnhpd_id alone, which silently discarded every
-- alternate product name for a licence (~136k rows) and stored only 5 of the
-- 17 fields the dump provides. The surviving rows have no product_name_id at
-- all, so there is nothing to migrate forward: drop the table, recreate it at
-- the correct grain, and clear the sync state so the index is re-downloaded.
DROP TABLE IF EXISTS `lnhpd_index`;--> statement-breakpoint
CREATE TABLE `lnhpd_index` (
	`lnhpd_id` integer NOT NULL,
	`product_name_id` integer NOT NULL,
	`licence_number` text NOT NULL,
	`product_name` text NOT NULL,
	`company_name` text,
	`company_id` integer,
	`company_name_id` integer,
	`dosage_form` text,
	`licence_date` text,
	`revised_date` text,
	`time_receipt` text,
	`date_start` text,
	`sub_submission_type_code` integer,
	`sub_submission_type_desc` text,
	`flag_primary_name` integer,
	`flag_product_status` integer,
	`flag_attested_monograph` integer,
	PRIMARY KEY(`lnhpd_id`, `product_name_id`)
);
--> statement-breakpoint
CREATE INDEX `lnhpd_index_licence_idx` ON `lnhpd_index` (`licence_number`);--> statement-breakpoint
CREATE INDEX `lnhpd_index_name_idx` ON `lnhpd_index` (`product_name`);--> statement-breakpoint
CREATE INDEX `lnhpd_index_lnhpd_id_idx` ON `lnhpd_index` (`lnhpd_id`);--> statement-breakpoint
-- keeps the admin's auto_sync_days preference, just marks the index as stale
UPDATE `lnhpd_sync_state` SET `synced_at` = NULL, `record_count` = NULL;
