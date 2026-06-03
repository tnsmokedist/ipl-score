const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixAllPayouts() {
  try {
    // Get ALL matches with results
    const matches = await prisma.iplMatch.findMany({
      where: { results: { some: { total_runs: { gt: 0 } } } },
      include: { results: { include: { betting_player: true }, orderBy: { total_runs: 'desc' } } }
    });
    
    let fixed = 0;
    for (const m of matches) {
      const maxRuns = Math.max(...m.results.map(r => r.total_runs));
      const winners = m.results.filter(r => r.total_runs === maxRuns);
      const betAmt = m.bet_amount || 100;
      const totalPot = betAmt * m.results.length;
      const payoutPerWinner = totalPot / winners.length;
      
      for (const r of m.results) {
        const isWin = r.total_runs === maxRuns;
        const correctPayout = isWin ? payoutPerWinner : 0;
        
        if (r.payout !== correctPayout || r.is_winner !== isWin) {
          await prisma.matchResult.update({
            where: { id: r.id },
            data: { is_winner: isWin, payout: correctPayout }
          });
          console.log(`Fixed: ${m.date.toISOString().slice(0,10)} ${m.team_a_name.slice(0,15)} vs ${m.team_b_name.slice(0,15)} | ${r.betting_player.name} $${r.payout} → $${correctPayout}`);
          fixed++;
        }
      }
    }
    
    if (fixed === 0) {
      console.log('✅ All payouts already correct');
    } else {
      console.log(`\n✅ Fixed ${fixed} payout records`);
    }
    
    // Also recalculate all balances
    console.log('\n=== RECALCULATING ALL BALANCES ===');
    const players = await prisma.bettingPlayer.findMany({ orderBy: { name: 'asc' } });
    const allResults = await prisma.matchResult.findMany({
      where: { total_runs: { gt: 0 } },
      include: { match: true }
    });
    
    const calc = {};
    players.forEach(p => { calc[p.id] = { wins: 0, losses: 0, net: 0 }; });
    
    const byMatch = {};
    allResults.forEach(r => {
      if (!byMatch[r.match_id]) byMatch[r.match_id] = [];
      byMatch[r.match_id].push(r);
    });
    
    for (const [, results] of Object.entries(byMatch)) {
      const sorted = results.sort((a, b) => b.total_runs - a.total_runs);
      const maxRuns = sorted[0].total_runs;
      const betAmt = sorted[0].match.bet_amount || 100;
      const totalPot = betAmt * results.length;
      const winners = sorted.filter(r => r.total_runs === maxRuns);
      const payout = totalPot / winners.length;
      
      for (const r of sorted) {
        const isWin = r.total_runs === maxRuns;
        calc[r.betting_player_id].losses += betAmt;
        if (isWin) calc[r.betting_player_id].wins += payout;
        calc[r.betting_player_id].net += isWin ? (payout - betAmt) : (-betAmt);
      }
    }
    
    let tw = 0, tl = 0;
    for (const p of players) {
      const c = calc[p.id];
      await prisma.bettingPlayer.update({
        where: { id: p.id },
        data: { total_winnings: c.wins, total_losses: c.losses, net_balance: c.net }
      });
      console.log(`${p.name.padEnd(10)} | Win: $${c.wins.toString().padStart(6)} | Loss: $${c.losses.toString().padStart(6)} | Net: $${c.net.toString().padStart(6)}`);
      tw += c.wins; tl += c.losses;
    }
    console.log(`${'TOTAL'.padEnd(10)} | Win: $${tw.toString().padStart(6)} | Loss: $${tl.toString().padStart(6)} | Net: $${(tw-tl).toString().padStart(6)} (should be $0)`);
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}
fixAllPayouts();
