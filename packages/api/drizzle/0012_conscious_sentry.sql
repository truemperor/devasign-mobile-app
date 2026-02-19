DROP INDEX "ext_req_bounty_dev_pending_uniq_idx";--> statement-breakpoint
ALTER TABLE "extension_requests" DROP COLUMN "updated_at";--> statement-breakpoint
ALTER TABLE "transactions" DROP COLUMN "updated_at";