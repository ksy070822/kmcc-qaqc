
import { getAgents } from "@/lib/bigquery";

async function testGetAgents() {
    console.log("Testing getAgents with no params (all)...");
    const resultAll = await getAgents({});
    if (resultAll.success) {
        console.log(`Success! Found ${resultAll.data?.length} agents.`);
        if (resultAll.data && resultAll.data.length > 0) {
            console.log("Sample agent:", resultAll.data[0]);
        }
    } else {
        console.error("Failed:", resultAll.error);
    }

    console.log("\nTesting getAgents with center='용산'...");
    const resultYongsan = await getAgents({ center: '용산' });
    if (resultYongsan.success) {
        console.log(`Success! Found ${resultYongsan.data?.length} agents in Yongsan.`);
    } else {
        console.error("Failed:", resultYongsan.error);
    }
}

testGetAgents();
