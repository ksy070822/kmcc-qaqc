
import { getBigQueryClient } from "@/lib/bigquery";

const DATASET_ID = process.env.BIGQUERY_DATASET_ID || 'KMCC_QC';

async function createActionPlansTable() {
    console.log("[Schema] Creating action_plans table...");
    const bigquery = getBigQueryClient();

    const query = `
        CREATE TABLE IF NOT EXISTS \`${DATASET_ID}.action_plans\` (
            id STRING NOT NULL,
            agent_id STRING NOT NULL,
            agent_name STRING NOT NULL,
            center STRING NOT NULL,
            group_name STRING,
            issue STRING NOT NULL,
            plan STRING NOT NULL,
            status STRING NOT NULL,
            created_at TIMESTAMP NOT NULL,
            target_date DATE NOT NULL,
            result STRING,
            improvement FLOAT64,
            manager_feedback STRING,
            feedback_date DATE,
            updated_at TIMESTAMP
        );
    `;

    try {
        const [job] = await bigquery.createQueryJob({ query, location: 'asia-northeast3' });
        console.log(`Job ${job.id} started.`);
        await job.getQueryResults();
        console.log("Table action_plans created (or already exists).");
    } catch (e) {
        console.error("Error creating table:", e);
    }
}

createActionPlansTable();
