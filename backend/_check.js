const fs = require('fs');
const html = fs.readFileSync(String.raw`C:\Users\HITESHPATIDAR\.gemini\antigravity\brain\a8ff2e77-606f-4ccd-9bbd-cb7540c73cc6\.system_generated\steps\387\content.md`, 'utf8');

// Find startDate
const dateM = html.match(/startDate[\\]*":[\\]*"(\d{10,13})/);
if (dateM) {
  let ts = parseInt(dateM[1]);
  if (ts < 1e12) ts *= 1000;
  console.log('Q1 startDate:', new Date(ts).toISOString());
} else {
  console.log('No startDate found in Q1 page');
}

// Find match date text
const dateText = html.match(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+\w+\s+\d+,\s+\d{4}/);
if (dateText) console.log('Match date text:', dateText[0]);

// Find any May 2026 date references
const mayDates = html.match(/May\s+\d+/g);
if (mayDates) console.log('May dates found:', [...new Set(mayDates)]);

// Try to find the date another way
const matchHeader = html.match(/Qualifier 1[^<]*?(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun)\s+(\d{4})/i);
if (matchHeader) console.log('Header date:', matchHeader[0]);
