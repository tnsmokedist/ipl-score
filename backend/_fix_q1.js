const { PrismaClient } = require('@prisma/client');
const { scrapeCricbuzzScorecard } = require('./services/cricketApi');
const prisma = new PrismaClient();

async function fixFinal() {
  try {
    const final = await prisma.iplMatch.findFirst({ where: { api_match_id: 'cb_155409' } });
    if (!final) { console.log('Final not found!'); return; }

    console.log(`Current: ${final.team_a_name} vs ${final.team_b_name} | ${final.status}`);

    // Fix team names - actual Final was GT vs RCB
    await prisma.iplMatch.update({
      where: { id: final.id },
      data: { 
        team_a_name: 'Gujarat Titans',
        team_b_name: 'Royal Challengers Bengaluru'
      }
    });
    console.log('Fixed: Gujarat Titans vs Royal Challengers Bengaluru');

    // Fetch scorecard
    console.log('\nFetching Final scorecard...');
    const scores = await scrapeCricbuzzScorecard('155409');
    if (!scores) { console.log('No scorecard!'); return; }

    console.log(`Team A (GT): ${scores.team_a_batters.map(b => `${b.name}(${b.runs})`).join(', ')}`);
    console.log(`Team B (RCB): ${scores.team_b_batters.map(b => `${b.name}(${b.runs})`).join(', ')}`);

    // Update results with scores
    const results = await prisma.matchResult.findMany({
      where: { match_id: final.id },
      include: { betting_player: true }
    });

    console.log(`\nUpdating ${results.length} results...`);
    for (const r of results) {
      const aBatter = scores.team_a_batters.find(b => b.position === r.team_a_position);
      const bBatter = scores.team_b_batters.find(b => b.position === r.team_b_position);
      if (aBatter && bBatter) {
        const total = aBatter.runs + bBatter.runs;
        await prisma.matchResult.update({
          where: { id: r.id },
          data: {
            player_a_name: aBatter.name,
            player_b_name: bBatter.name,
            player_a_runs: aBatter.runs,
            player_b_runs: bBatter.runs,
            total_runs: total
          }
        });
        console.log(`  ${r.betting_player.name.padEnd(10)} A${r.team_a_position}B${r.team_b_position}: ${aBatter.name}(${aBatter.runs}) + ${bBatter.name}(${bBatter.runs}) = ${total}`);
      }
    }

    // Settle - find winner(s)
    const allResults = await prisma.matchResult.findMany({
      where: { match_id: final.id },
      include: { betting_player: true },
      orderBy: { total_runs: 'desc' }
    });

    const maxRuns = Math.max(...allResults.map(r => r.total_runs));
    const winners = allResults.filter(r => r.total_runs === maxRuns);
    const betAmt = final.bet_amount || 100;
    const totalPot = betAmt * allResults.length;
    const payoutPerWinner = totalPot / winners.length;

    for (const r of allResults) {
      const isWin = r.total_runs === maxRuns;
      const payout = isWin ? payoutPerWinner : 0;
      const netGain = isWin ? (payoutPerWinner - betAmt) : (-betAmt);

      await prisma.matchResult.update({
        where: { id: r.id },
        data: { is_winner: isWin, payout }
      });

      await prisma.bettingPlayer.update({
        where: { id: r.betting_player_id },
        data: {
          total_winnings: { increment: isWin ? payoutPerWinner : 0 },
          total_losses: { increment: betAmt },
          net_balance: { increment: netGain }
        }
      });
    }

    await prisma.iplMatch.update({
      where: { id: final.id },
      data: { status: 'COMPLETED' }
    });

    console.log(`\n🏆 Final settled!`);
    console.log(`Winner(s): ${winners.map(w => `${w.betting_player.name} (${w.total_runs} runs)`).join(', ')}`);
    console.log(`Pot: $${totalPot} | Payout: $${payoutPerWinner}/winner`);

    // Final balance check
    console.log('\n=== FINAL PLAYER BALANCES ===');
    const players = await prisma.bettingPlayer.findMany({ orderBy: { name: 'asc' } });
    let tw = 0, tl = 0;
    players.forEach(p => {
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
fixFinal();
