const { PrismaClient } = require('@prisma/client');
const { scrapeCricbuzzScorecard } = require('./services/cricketApi');
const prisma = new PrismaClient();

// Enhanced scraper that also returns team names
async function scrapeWithTeamNames(cbId) {
  const url = `https://m.cricbuzz.com/live-cricket-scorecard/${cbId}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15' }
  });
  if (!res.ok) return null;
  const html = await res.text();
  
  const teamRe = /batTeamName[\\]*":[\\]*"([^"\\]+)/g;
  const teams = [];
  let m;
  while ((m = teamRe.exec(html)) !== null) {
    if (!teams.includes(m[1])) teams.push(m[1]);
  }
  return { battingFirstTeam: teams[0] || '', battingSecondTeam: teams[1] || '' };
}

async function auditTeamOrder() {
  try {
    const matches = await prisma.iplMatch.findMany({
      where: { date: { gte: new Date('2026-05-20') } },
      orderBy: { date: 'asc' },
      include: { results: { include: { betting_player: true }, orderBy: { total_runs: 'desc' } } }
    });

    console.log('=== TEAM ORDER AUDIT (Team A must = batting first) ===\n');
    const issues = [];
    
    for (const match of matches) {
      const cbId = match.api_match_id.replace('cb_', '');
      const teamInfo = await scrapeWithTeamNames(cbId);
      if (!teamInfo || !teamInfo.battingFirstTeam) {
        console.log(`⏳ ${match.date.toISOString().slice(0,10)} ${match.team_a_name} vs ${match.team_b_name} - No innings data`);
        continue;
      }
      
      const { battingFirstTeam, battingSecondTeam } = teamInfo;
      const dbA = match.team_a_name;
      const dbB = match.team_b_name;
      
      // Normalize comparison
      const firstWord = (s) => s.toLowerCase().split(' ')[0];
      const dbAmatches = firstWord(dbA) === firstWord(battingFirstTeam) || dbA.toLowerCase().includes(firstWord(battingFirstTeam));
      
      if (!dbAmatches) {
        console.log(`❌ ${match.date.toISOString().slice(0,10)} CB:${cbId} | DB: "${dbA}" vs "${dbB}" | Batted 1st: "${battingFirstTeam}" | NEEDS FIX`);
        const hasScores = match.results.some(r => r.total_runs > 0);
        issues.push({ match, battingFirstTeam, battingSecondTeam, cbId, hasScores });
      } else {
        console.log(`✅ ${match.date.toISOString().slice(0,10)} CB:${cbId} | DB: "${dbA}" vs "${dbB}" | Batted 1st: "${battingFirstTeam}"`);
      }
    }
    
    if (issues.length === 0) {
      console.log('\n✅ All team orders are correct!');
      return;
    }
    
    console.log(`\n=== FIXING ${issues.length} MATCHES ===\n`);
    
    for (const issue of issues) {
      const { match, battingFirstTeam, battingSecondTeam, cbId, hasScores } = issue;
      console.log(`--- Fixing: ${match.date.toISOString().slice(0,10)} CB:${cbId} ---`);
      console.log(`  Old: team_a="${match.team_a_name}" team_b="${match.team_b_name}"`);
      console.log(`  New: team_a="${battingFirstTeam}" team_b="${battingSecondTeam}"`);
      
      // 1. Update team names
      await prisma.iplMatch.update({
        where: { id: match.id },
        data: { team_a_name: battingFirstTeam, team_b_name: battingSecondTeam }
      });
      
      if (hasScores) {
        // 2. Delete old results (scores were based on wrong team order)
        const deleted = await prisma.matchResult.deleteMany({ where: { match_id: match.id } });
        console.log(`  Deleted ${deleted.count} old results`);
        
        // 3. Find the draw this match belongs to
        const draw = await prisma.weeklyDraw.findFirst({
          where: { week_start: { lte: match.date }, week_end: { gte: match.date } },
          include: { entries: { include: { betting_player: true } } }
        });
        
        if (draw) {
          // 4. Re-create results with draw positions
          for (const entry of draw.entries) {
            await prisma.matchResult.create({
              data: {
                weekly_draw_id: draw.id,
                match_id: match.id,
                betting_player_id: entry.betting_player_id,
                team_a_position: entry.team_a_position,
                team_b_position: entry.team_b_position,
              }
            });
          }
          console.log(`  Re-created ${draw.entries.length} results in "${draw.week_label}"`);
          
          // 5. Fetch correct scores
          const scores = await scrapeCricbuzzScorecard(cbId);
          if (scores) {
            const results = await prisma.matchResult.findMany({
              where: { match_id: match.id },
              include: { betting_player: true }
            });
            
            for (const r of results) {
              const aBatter = scores.team_a_batters.find(b => b.position === r.team_a_position);
              const bBatter = scores.team_b_batters.find(b => b.position === r.team_b_position);
              if (aBatter && bBatter) {
                await prisma.matchResult.update({
                  where: { id: r.id },
                  data: {
                    player_a_name: aBatter.name,
                    player_b_name: bBatter.name,
                    player_a_runs: aBatter.runs,
                    player_b_runs: bBatter.runs,
                    total_runs: aBatter.runs + bBatter.runs
                  }
                });
              }
            }
            console.log(`  Scores re-fetched`);
            
            // 6. Settle
            const allResults = await prisma.matchResult.findMany({
              where: { match_id: match.id },
              include: { betting_player: true },
              orderBy: { total_runs: 'desc' }
            });
            
            const maxRuns = Math.max(...allResults.map(r => r.total_runs));
            const winners = allResults.filter(r => r.total_runs === maxRuns);
            const betAmt = match.bet_amount || 100;
            const totalPot = betAmt * allResults.length;
            const payoutPerWinner = totalPot / winners.length;
            
            for (const r of allResults) {
              const isWin = r.total_runs === maxRuns;
              await prisma.matchResult.update({
                where: { id: r.id },
                data: { is_winner: isWin, payout: isWin ? payoutPerWinner : 0 }
              });
            }
            
            await prisma.iplMatch.update({ where: { id: match.id }, data: { status: 'COMPLETED' } });
            
            console.log(`  🏆 Winner: ${winners.map(w => `${w.betting_player.name}(${w.total_runs})`).join(', ')} → $${payoutPerWinner}`);
            allResults.forEach(r => {
              const win = r.total_runs === maxRuns ? '🏆' : '  ';
              console.log(`  ${win} ${r.betting_player.name.padEnd(10)} A${r.team_a_position}B${r.team_b_position}: ${r.player_a_name}(${r.player_a_runs}) + ${r.player_b_name}(${r.player_b_runs}) = ${r.total_runs}`);
            });
          }
        }
      }
    }
    
    // 7. FULL BALANCE RECALCULATION from all MatchResults
    console.log('\n=== RECALCULATING ALL BALANCES ===');
    const players = await prisma.bettingPlayer.findMany({ orderBy: { name: 'asc' } });
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
      
      for (const r of sorted) {
        const isWin = r.total_runs === maxRuns;
        calc[r.betting_player_id].losses += betAmt;
        if (isWin) calc[r.betting_player_id].wins += payoutPerWinner;
        calc[r.betting_player_id].net += isWin ? (payoutPerWinner - betAmt) : (-betAmt);
      }
    }
    
    let tw = 0, tl = 0;
    for (const p of players) {
      const c = calc[p.id];
      await prisma.bettingPlayer.update({
        where: { id: p.id },
        data: { total_winnings: c.wins, total_losses: c.losses, net_balance: c.net }
      });
      console.log(`${c.name.padEnd(10)} | Win: $${c.wins.toString().padStart(6)} | Loss: $${c.losses.toString().padStart(6)} | Net: $${c.net.toString().padStart(6)}`);
      tw += c.wins; tl += c.losses;
    }
    console.log(`${'TOTAL'.padEnd(10)} | Win: $${tw.toString().padStart(6)} | Loss: $${tl.toString().padStart(6)} | Net: $${(tw-tl).toString().padStart(6)} (should be $0)`);
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}
auditTeamOrder();
