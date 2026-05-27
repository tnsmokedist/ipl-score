const { scrapeCricbuzzScorecard } = require('./services/cricketApi');

async function audit() {
  // Eliminator match ID from Cricbuzz
  console.log('=== Fetching Eliminator scorecard (CB:155387) ===');
  const scores = await scrapeCricbuzzScorecard('155387');
  console.log(JSON.stringify(scores, null, 2));
}
audit();
