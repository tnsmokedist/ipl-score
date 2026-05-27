const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixBalances() {
  try {
    const players = await prisma.bettingPlayer.findMany({ orderBy: { name: 'asc' } });
    
    // Recalculate from all MatchResults using ORIGINAL pot-based formula:
    // totalPot = betPerPlayer × allPlayers, winner gets full pot, everyone pays entry
    const allResults = await prisma.matchResult.findMany({
      where: { total_runs: { gt: 0 } },
      include: { betting_player: true, match: true }
    });
    
    const calc = {};
    players.forEach(p => { calc[p.id] = { name: p.name, wins: 0, losses: 0, net: 0 }; });
    
    const byMatch = {};
    allResults.forEach(r => {
      if (!byMatch[r.match_id]) byMatch[r.match_id] = [];
      byMatch[r.match_id].push(r);
    });
    
    for (const [matchId, results] of Object.entries(byMatch)) {
      const sorted = results.sort((a, b) => b.total_runs - a.total_runs);
      const maxRuns = sorted[0].total_runs;
      const winners = sorted.filter(r => r.total_runs === maxRuns);
      const betAmt = sorted[0].match.bet_amount || 100;
      const totalPot = betAmt * results.length;
      const payoutPerWinner = totalPot / winners.length;
      
      // Everyone pays entry (loss), winners get pot (win)
      for (const r of sorted) {
        const isWin = r.total_runs === maxRuns;
        calc[r.betting_player_id].losses += betAmt;  // everyone pays
        if (isWin) {
          calc[r.betting_player_id].wins += payoutPerWinner;
        }
        const netGain = isWin ? (payoutPerWinner - betAmt) : (-betAmt);
        calc[r.betting_player_id].net += netGain;
      }
      
      // Also fix payout amounts in MatchResult records
      for (const r of sorted) {
        const isWin = r.total_runs === maxRuns;
        const payout = isWin ? payoutPerWinner : 0;
        if (Math.abs(r.payout - payout) > 0.01 || r.is_winner !== isWin) {
          await prisma.matchResult.update({
            where: { id: r.id },
            data: { is_winner: isWin, payout }
          });
        }
      }
    }
    
    // Apply corrections
    console.log('=== RECALCULATING BALANCES (pot-based: $100 × 8 = $800 pot) ===');
    for (const p of players) {
      const c = calc[p.id];
      if (Math.abs(c.wins - p.total_winnings) > 0.01 || 
          Math.abs(c.losses - p.total_losses) > 0.01 ||
          Math.abs(c.net - p.net_balance) > 0.01) {
        await prisma.bettingPlayer.update({
          where: { id: p.id },
          data: {
            total_winnings: c.wins,
            total_losses: c.losses,
            net_balance: c.net,
          }
        });
        console.log(`${c.name.padEnd(10)} | Win: $${p.total_winnings} → $${c.wins} | Loss: $${p.total_losses} → $${c.losses} | Net: $${p.net_balance} → $${c.net}`);
      } else {
        console.log(`${c.name.padEnd(10)} | ✅ Already correct (Win: $${c.wins} | Loss: $${c.losses} | Net: $${c.net})`);
      }
    }
    
    // Verify
    const updated = await prisma.bettingPlayer.findMany({ orderBy: { name: 'asc' } });
    let tw = 0, tl = 0;
    console.log('\n=== FINAL BALANCES ===');
    updated.forEach(p => {
      console.log(`${p.name.padEnd(10)} | Win: $${p.total_winnings.toString().padStart(6)} | Loss: $${p.total_losses.toString().padStart(6)} | Net: $${p.net_balance.toString().padStart(6)}`);
      tw += p.total_winnings; tl += p.total_losses;
    });
    console.log(`${'TOTAL'.padEnd(10)} | Win: $${tw.toString().padStart(6)} | Loss: $${tl.toString().padStart(6)} | Net: $${(tw - tl).toString().padStart(6)} (should be $0)`);
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}
fixBalances();
