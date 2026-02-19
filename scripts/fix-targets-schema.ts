
import { getBigQueryClient } from "@/lib/bigquery";

const DATASET_ID = process.env.BIGQUERY_DATASET_ID || 'KMCC_QC';

async function fixTargetsSchema() {
    console.log("[Schema Fix] Relaxing targets table schema columns to NULLABLE...");
    const bigquery = getBigQueryClient();

    // ALTER TABLE to DROP NOT NULL for error rate columns
    const query = `
        ALTER TABLE \`${DATASET_ID}.targets\`
        ALTER COLUMN target_attitude_error_rate DROP NOT NULL,
        ALTER COLUMN target_business_error_rate DROP NOT NULL,
        ALTER COLUMN target_overall_error_rate DROP NOT NULL
    `;

    try {
        const [job] = await bigquery.createQueryJob({ query, location: 'asia-northeast3' });
        console.log(`Job ${job.id} started.`);
        const [rows] = await job.getQueryResults();
        console.log("Schema updated successfully.");
    } catch (e) {
        console.error("Error updating schema:", e);
    }
}

fixTargetsSchema();
