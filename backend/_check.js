const { scrapeIPLSchedule } = require('./services/cricketApi');
async function check() {
  const matches = await scrapeIPLSchedule();
  console.log('=== Matches May 23-30 ===');
  matches.filter(m => {
    if (!m.start_date) return m.match_number >= 69;
    const d = new Date(m.start_date);
    return d >= new Date('2026-05-23') && d <= new Date('2026-05-30');
  }).forEach(m => {
    console.log(`#${m.match_number} ${m.start_date ? m.start_date.toISOString().slice(0,10) : 'NO DATE'} | CB:${m.cricbuzz_id} | ${m.match_desc} | ${m.team_a_abbr} vs ${m.team_b_abbr} | ${m.status}`);
  });
  console.log(`\nTotal: ${matches.length} matches`);
  
  // Check if any match on May 25
  const may25 = matches.filter(m => m.start_date && m.start_date.toISOString().startsWith('2026-05-25'));
  console.log(`\nMay 25 matches: ${may25.length}`);
  may25.forEach(m => console.log(`  ${m.team_a_abbr} vs ${m.team_b_abbr} - ${m.match_desc}`));
}
check();
