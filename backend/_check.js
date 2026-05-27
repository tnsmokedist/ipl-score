// Check what the scraper now finds
const { scrapeIPLSchedule } = require('./services/cricketApi');

async function check() {
  const matches = await scrapeIPLSchedule();
  console.log(`Total matches: ${matches.length}`);
  
  // Find Q1 (cb_155376)
  const q1 = matches.find(m => m.cricbuzz_id === '155376');
  console.log('\nQualifier 1 (155376):', q1 || 'NOT FOUND');
  
  // Find Eliminator (cb_155387)
  const elim = matches.find(m => m.cricbuzz_id === '155387');
  console.log('Eliminator (155387):', elim || 'NOT FOUND');
  
  // Show all matches with match_number >= 70
  console.log('\n=== Matches #70+ ===');
  matches.filter(m => m.match_number >= 70).forEach(m => {
    console.log(`#${m.match_number} "${m.match_desc}" CB:${m.cricbuzz_id} | ${m.team_a_abbr} vs ${m.team_b_abbr} | Date: ${m.start_date ? m.start_date.toISOString().slice(0,10) : 'null'} | ${m.status}`);
  });
}
check();
