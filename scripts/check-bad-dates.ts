
import { readYonsan2025Gwangju2025Sheets, parseSheetRowsToEvaluations2025 } from "@/lib/google-sheets";

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID || '14pXr3QNz_xY3vm9QNaF2yOtle1M4dqAuGb7Z5ebpi2o';

async function checkBadDates() {
    console.log("[Check Bad Dates] Reading sheets...");
    const sheetsResult = await readYonsan2025Gwangju2025Sheets(SPREADSHEET_ID);

    if (!sheetsResult.success || !sheetsResult.yonsan || !sheetsResult.gwangju) {
        console.error("Failed to read sheets");
        return;
    }

    const check = (rows: any[], center: string) => {
        let badCount = 0;
        let examples: string[] = [];

        // Headers are first row
        const headers = rows[0] || [];
        const dataRows = rows.slice(1);

        const evaluations = parseSheetRowsToEvaluations2025(headers, dataRows, center, center === '용산');

        evaluations.forEach(e => {
            const year = parseInt(e.date.split('-')[0]);
            if (year < 2024) {
                badCount++;
                if (examples.length < 3) examples.push(`${e.agentName}/${e.date}`);
            }
        });

        console.log(`[${center}2025] Found ${badCount} invalid dates (before 2024). Examples: ${examples.join(', ')}`);
    };

    check(sheetsResult.yonsan, "용산");
    check(sheetsResult.gwangju, "광주");
}

checkBadDates();
