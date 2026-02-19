
import { getAgents } from "@/lib/bigquery";

async function testGetAgents() {
    console.log("[Test] Fetching agents for 2026-01...");
    const result = await getAgents({ month: '2026-01' });

    if (result.success) {
        console.log(`Success! Found ${result.data?.length} agents.`);
        if (result.data && result.data.length > 0) {
            console.log("Sample Agent:", JSON.stringify(result.data[0], null, 2));
        }
    } else {
        console.error("Failed:", result.error);
    }
}

testGetAgents();
