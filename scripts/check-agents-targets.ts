
import { getBigQueryClient } from "@/lib/bigquery";

const DATASET_ID = process.env.BIGQUERY_DATASET_ID || 'KMCC_QC';

async function checkAgentsTable() {
    console.log("[Data Check] Checking count in table:", DATASET_ID + ".agents");
    const bigquery = getBigQueryClient();

    // Check agents table count
    try {
        const query = `SELECT count(*) as count FROM \`${DATASET_ID}.agents\``;
        const [rows] = await bigquery.query({ query, location: 'asia-northeast3' });
        console.log("Agents Count:", rows[0].count);
    } catch (e) {
        console.error("Error fetching agents count:", e);
    }

    // Check targets table count (for dashboard targets)
    try {
        const query = `SELECT count(*) as count FROM \`${DATASET_ID}.targets\``;
        const [rows] = await bigquery.query({ query, location: 'asia-northeast3' });
        console.log("Targets Count:", rows[0].count);
    } catch (e) {
        console.error("Error fetching targets count:", e);
    }
}

checkAgentsTable();
