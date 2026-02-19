
import { getBigQueryClient } from "@/lib/bigquery";

const DATASET_ID = process.env.BIGQUERY_DATASET_ID || 'KMCC_QC';

async function checkCenterDates() {
    console.log("[Date Check] Checking min/max dates per center in:", DATASET_ID + ".evaluations");
    const bigquery = getBigQueryClient();

    const query = `
        SELECT 
            center, 
            MIN(evaluation_date) as min_date,
            MAX(evaluation_date) as max_date,
            COUNT(*) as count
        FROM \`${DATASET_ID}.evaluations\`
        GROUP BY center
        ORDER BY center
    `;

    try {
        const [rows] = await bigquery.query({ query, location: 'asia-northeast3' });
        console.table(rows.map(r => ({
            center: r.center,
            min_date: r.min_date.value,
            max_date: r.max_date.value,
            count: r.count
        })));
    } catch (e) {
        console.error("Error fetching center dates:", e);
    }
}

checkCenterDates();
