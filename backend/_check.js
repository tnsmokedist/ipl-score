// Check if Cricbuzz scraper finds playoff matches
const { scrapeIPLSchedule } = require('./services/cricketApi');

async function check() {
  const matches = await scrapeIPLSchedule();
  console.log(`Total matches found: ${matches.length}`);
  console.log('\n--- Last 10 matches (sorted by match_number) ---');
  matches.slice(-10).forEach(m => {
    console.log(`#${m.match_number} ${m.match_desc} | ${m.team_a_name} vs ${m.team_b_name} | CB:${m.cricbuzz_id} | Date: ${m.start_date ? m.start_date.toISOString().slice(0,10) : 'null'} | ${m.status}`);
  });
  console.log('\n--- Matches with match_number=0 (likely playoffs) ---');
  matches.filter(m => m.match_number === 0).forEach(m => {
    console.log(`"${m.match_desc}" | ${m.team_a_name} vs ${m.team_b_name} | CB:${m.cricbuzz_id} | Date: ${m.start_date ? m.start_date.toISOString().slice(0,10) : 'null'} | ${m.status}`);
  });
}
check();
