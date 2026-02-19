
import { getBigQueryClient } from "@/lib/bigquery";

const DATASET_ID = process.env.BIGQUERY_DATASET_ID || 'KMCC_QC';

async function checkLatestDate() {
    console.log("[Date Check] Checking latest date in table:", DATASET_ID + ".evaluations");
    const bigquery = getBigQueryClient();

    const query = `SELECT MAX(evaluation_date) as latest_date FROM \`${DATASET_ID}.evaluations\``;

    try {
        const [rows] = await bigquery.query({ query, location: 'asia-northeast3' });
        console.log("Latest Date:", rows[0].latest_date.value);
    } catch (e) {
        console.error("Error fetching latest date:", e);
    }
}

checkLatestDate();
