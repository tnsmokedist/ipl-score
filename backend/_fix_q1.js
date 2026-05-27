const { PrismaClient } = require('@prisma/client');
const { scrapeCricbuzzScorecard } = require('./services/cricketApi');
const prisma = new PrismaClient();

async function refetchEliminator() {
  try {
    const match = await prisma.iplMatch.findFirst({ where: { api_match_id: 'cb_155387' } });
    if (!match) { console.log('Eliminator not found!'); return; }
    
    console.log('Eliminator match:', match.id, match.team_a_name, 'vs', match.team_b_name);
    
    // Get scorecard
    const scores = await scrapeCricbuzzScorecard('155387');
    if (!scores) { console.log('Failed to scrape scorecard!'); return; }
    
    console.log('Team A batters:', scores.team_a_batters.map(b => `${b.name}(${b.runs})`).join(', '));
    console.log('Team B batters:', scores.team_b_batters.map(b => `${b.name}(${b.runs})`).join(', '));
    
    // Get all results for this match (the new empty ones we just backfilled)
    const results = await prisma.matchResult.findMany({
      where: { match_id: match.id },
      include: { betting_player: true }
    });
    
    console.log(`\nUpdating ${results.length} results...`);
    
    for (const r of results) {
      const aBatter = scores.team_a_batters.find(b => b.position === r.team_a_position);
      const bBatter = scores.team_b_batters.find(b => b.position === r.team_b_position);
      
      const aRuns = aBatter?.runs || 0;
      const bRuns = bBatter?.runs || 0;
      const totalRuns = aRuns + bRuns;
      
      await prisma.matchResult.update({
        where: { id: r.id },
        data: {
          player_a_name: aBatter?.name || '',
          player_b_name: bBatter?.name || '',
          player_a_runs: aRuns,
          player_b_runs: bRuns,
          total_runs: totalRuns,
        }
      });
      console.log(`  ${r.betting_player.name} A${r.team_a_position}B${r.team_b_position}: ${aBatter?.name}(${aRuns}) + ${bBatter?.name}(${bRuns}) = ${totalRuns}`);
    }
    
    // Determine winner(s) - just mark the results, DON'T adjust balances
    // (balances were already adjusted from the first auto-fetch)
    const updatedResults = await prisma.matchResult.findMany({
      where: { match_id: match.id },
      include: { betting_player: true },
      orderBy: { total_runs: 'desc' }
    });
    
    const maxRuns = updatedResults[0].total_runs;
    const winners = updatedResults.filter(r => r.total_runs === maxRuns);
    const losers = updatedResults.filter(r => r.total_runs < maxRuns);
    const payout = (losers.length * match.bet_amount) / winners.length;
    
    // Mark winners (without changing balances)
    for (const w of winners) {
      await prisma.matchResult.update({
        where: { id: w.id },
        data: { is_winner: true, payout }
      });
      console.log(`\n🏆 Winner: ${w.betting_player.name} (${maxRuns} runs) → $${payout}`);
    }
    
    // Mark losers (without changing balances) 
    for (const l of losers) {
      await prisma.matchResult.update({
        where: { id: l.id },
        data: { is_winner: false, payout: 0 }
      });
    }
    
    // Ensure match is completed
    await prisma.iplMatch.update({
      where: { id: match.id },
      data: { status: 'COMPLETED' }
    });
    
    console.log(`\n✅ Eliminator re-settled! ${winners.length} winner(s), ${losers.length} losers`);
    console.log('(Balances NOT adjusted — they were already updated from the first auto-fetch)');
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}
refetchEliminator();
