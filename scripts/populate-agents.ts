
import { getBigQueryClient } from "@/lib/bigquery";

const DATASET_ID = process.env.BIGQUERY_DATASET_ID || 'KMCC_QC';

async function populateAgents() {
    console.log("[Populate Agents] Extracting unique agents from evaluations...");
    const bigquery = getBigQueryClient();

    // 1. Extract unique agents from evaluations
    // Using grouping to get the latest info for each agent
    const query = `
        SELECT 
            agent_id,
            ANY_VALUE(agent_name) as agent_name,
            ANY_VALUE(center) as center,
            ANY_VALUE(service) as service,
            ANY_VALUE(channel) as channel,
            COUNT(*) as total_evaluations,
            SUM(attitude_error_count) as total_attitude_errors,
            SUM(business_error_count) as total_ops_errors
        FROM \`${DATASET_ID}.evaluations\`
        GROUP BY agent_id
    `;

    try {
        const [rows] = await bigquery.query({ query, location: 'asia-northeast3' });
        console.log(`Found ${rows.length} unique agents.`);

        if (rows.length === 0) return;

        // 2. Prepare insert rows
        const agentRows = rows.map((r: any) => {
            const groupValue = `${r.service || ''} ${r.channel || ''}`.trim();
            return {
                agent_id: r.agent_id,
                agent_name: r.agent_name,
                center: r.center,
                service: r.service || '',
                channel: r.channel || '',
                group: groupValue || 'unknown', // REQUIRED field
                hire_date: null,
                tenure_months: null,
                tenure: null, // nullable string
                // Removed stats fields and is_active/risk_level as they don't exist in schema
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
        });

        // 3. Insert into agents table (Truncate first? Or Merge?)
        // Ideally MERGE, but for simplicity let's truncate and load since it was empty
        const dataset = bigquery.dataset(DATASET_ID);
        const table = dataset.table('agents');

        // Truncate (using query)
        console.log("Truncating agents table...");
        await bigquery.query({
            query: `TRUNCATE TABLE \`${DATASET_ID}.agents\``,
            location: 'asia-northeast3'
        });

        // Insert
        console.log("Inserting agents...");
        const BATCH_SIZE = 1000;
        for (let i = 0; i < agentRows.length; i += BATCH_SIZE) {
            const batch = agentRows.slice(i, i + BATCH_SIZE);
            await table.insert(batch);
            console.log(`Inserted ${batch.length} rows...`);
        }

        console.log("Agents population complete.");

    } catch (e: any) {
        console.error("Error populating agents:", e);
        if (e.errors) console.error(JSON.stringify(e.errors, null, 2));
        if (e.response && e.response.insertErrors) console.error(JSON.stringify(e.response.insertErrors[0], null, 2));
    }
}

populateAgents();
