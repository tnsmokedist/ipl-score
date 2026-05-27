const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyWinners() {
  try {
    // Check all matches that have scores but verify winner flags match
    const allResults = await prisma.matchResult.findMany({
      where: { total_runs: { gt: 0 } },
      include: { betting_player: true, match: true },
      orderBy: { match: { date: 'asc' } }
    });
    
    const byMatch = {};
    allResults.forEach(r => {
      if (!byMatch[r.match_id]) byMatch[r.match_id] = { match: r.match, results: [] };
      byMatch[r.match_id].results.push(r);
    });
    
    let issues = 0;
    for (const [matchId, data] of Object.entries(byMatch)) {
      const sorted = data.results.sort((a, b) => b.total_runs - a.total_runs);
      const maxRuns = sorted[0].total_runs;
      const winners = sorted.filter(r => r.total_runs === maxRuns);
      const losers = sorted.filter(r => r.total_runs < maxRuns);
      const betAmt = data.match.bet_amount;
      const payout = (losers.length * betAmt) / winners.length;
      
      for (const r of sorted) {
        const shouldWin = r.total_runs === maxRuns;
        const shouldPayout = shouldWin ? payout : 0;
        
        if (r.is_winner !== shouldWin || Math.abs(r.payout - shouldPayout) > 0.01) {
          console.log(`⚠️ ${data.match.date.toISOString().slice(0,10)} ${data.match.team_a_name} vs ${data.match.team_b_name}: ${r.betting_player.name} is_winner=${r.is_winner}→${shouldWin} payout=$${r.payout}→$${shouldPayout}`);
          
          await prisma.matchResult.update({
            where: { id: r.id },
            data: { is_winner: shouldWin, payout: shouldPayout }
          });
          issues++;
        }
      }
    }
    
    if (issues === 0) {
      console.log('✅ All winner flags and payouts are correct!');
    } else {
      console.log(`\n✅ Fixed ${issues} winner/payout discrepancies.`);
    }
    
    // Also verify RCB vs GT (Q1) has scores
    const q1 = await prisma.iplMatch.findFirst({ where: { api_match_id: 'cb_155376' } });
    if (q1) {
      const q1Results = await prisma.matchResult.findMany({ where: { match_id: q1.id } });
      const hasScores = q1Results.some(r => r.total_runs > 0);
      console.log(`\nQ1 (RCB vs GT): ${hasScores ? 'Has scores ✅' : 'NO SCORES - needs auto-fetch ⚠️'}`);
    }
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}
verifyWinners();
