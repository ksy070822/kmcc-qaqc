
import { getBigQueryClient } from "@/lib/bigquery";

const DATASET_ID = process.env.BIGQUERY_DATASET_ID || 'KMCC_QC';

async function checkSchema() {
    console.log("[Schema Check] Checking schema for table:", DATASET_ID + ".evaluations");
    const bigquery = getBigQueryClient();
    const dataset = bigquery.dataset(DATASET_ID);
    const table = dataset.table('evaluations');

    try {
        const [metadata] = await table.getMetadata();
        console.log(JSON.stringify(metadata.schema, null, 2));
    } catch (e) {
        console.error("Error fetching metadata:", e);
    }
}

checkSchema();
