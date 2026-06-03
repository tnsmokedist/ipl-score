const { PrismaClient } = require('@prisma/client');
const { scrapeCricbuzzScorecard } = require('./services/cricketApi');
const prisma = new PrismaClient();

async function auditAndFix() {
  try {
    // 1. Check Q2 scores (CB:155398) - GT vs RR
    console.log('=== AUDITING Q2 (GT vs RR, May 29) ===');
    const q2 = await prisma.iplMatch.findFirst({ where: { api_match_id: 'cb_155398' } });
    if (q2) {
      const q2Results = await prisma.matchResult.findMany({
        where: { match_id: q2.id },
        include: { betting_player: true },
        orderBy: { total_runs: 'desc' }
      });
      console.log(`DB: ${q2.team_a_name} vs ${q2.team_b_name} | ${q2.status} | results: ${q2Results.length}`);
      q2Results.forEach(r => {
        const win = r.is_winner ? `🏆 $${r.payout}` : '';
        console.log(`  ${r.betting_player.name.padEnd(10)} A${r.team_a_position}B${r.team_b_position} | ${r.player_a_name}(${r.player_a_runs}) + ${r.player_b_name}(${r.player_b_runs}) = ${r.total_runs} ${win}`);
      });
      
      // Verify against Cricbuzz
      console.log('\nFetching Q2 scorecard from Cricbuzz...');
      const q2Scores = await scrapeCricbuzzScorecard('155398');
      if (q2Scores) {
        console.log(`CB Team A: ${q2Scores.team_a_batters.map(b => `${b.name}(${b.runs})`).join(', ')}`);
        console.log(`CB Team B: ${q2Scores.team_b_batters.map(b => `${b.name}(${b.runs})`).join(', ')}`);
      }
    }

    // 2. Check Final (CB:155409)
    console.log('\n=== AUDITING FINAL (May 31) ===');
    const final = await prisma.iplMatch.findFirst({ where: { api_match_id: 'cb_155409' } });
    if (final) {
      console.log(`DB: ${final.team_a_name} vs ${final.team_b_name} | ${final.status}`);
      const finalResults = await prisma.matchResult.count({ where: { match_id: final.id } });
      console.log(`Results: ${finalResults}`);
      
      // Fetch actual final scorecard
      console.log('\nFetching Final scorecard from Cricbuzz...');
      const finalScores = await scrapeCricbuzzScorecard('155409');
      if (finalScores) {
        console.log(`CB Team A: ${finalScores.team_a_batters.map(b => `${b.name}(${b.runs})`).join(', ')}`);
        console.log(`CB Team B: ${finalScores.team_b_batters.map(b => `${b.name}(${b.runs})`).join(', ')}`);
      } else {
        console.log('No scorecard available yet');
      }
    }

    // 3. Check the May 27-Jun 2 draw for missing results
    console.log('\n=== MAY 27-JUN 2 DRAW BACKFILL CHECK ===');
    const draw = await prisma.weeklyDraw.findFirst({
      where: { week_label: { contains: 'May 27' } },
      include: { entries: true }
    });
    if (draw && final) {
      const existingResults = await prisma.matchResult.count({
        where: { weekly_draw_id: draw.id, match_id: final.id }
      });
      console.log(`Final match results in "${draw.week_label}": ${existingResults} (expected: ${draw.entries.length})`);
      
      if (existingResults === 0) {
        console.log('Need to backfill Final match results into this draw');
        for (const entry of draw.entries) {
          const exists = await prisma.matchResult.findFirst({
            where: { match_id: final.id, betting_player_id: entry.betting_player_id }
          });
          if (!exists) {
            await prisma.matchResult.create({
              data: {
                weekly_draw_id: draw.id,
                match_id: final.id,
                betting_player_id: entry.betting_player_id,
                team_a_position: entry.team_a_position,
                team_b_position: entry.team_b_position,
              }
            });
          }
        }
        console.log(`✅ Backfilled ${draw.entries.length} results for Final`);
      }
    }

    // 4. Now verify ALL scores for May 20-26 week match-by-match against Cricbuzz
    console.log('\n=== VERIFYING SCORES FOR MAY 20-26 ===');
    const may20matches = await prisma.iplMatch.findMany({
      where: { date: { gte: new Date('2026-05-20'), lte: new Date('2026-05-27') } },
      orderBy: { date: 'asc' },
      include: { results: { include: { betting_player: true }, orderBy: { total_runs: 'desc' } } }
    });

    for (const m of may20matches) {
      const cbId = m.api_match_id.replace('cb_', '');
      const cbScores = await scrapeCricbuzzScorecard(cbId);
      if (!cbScores) { console.log(`⚠️ No scorecard for ${m.team_a_name} vs ${m.team_b_name}`); continue; }
      
      let issues = 0;
      for (const r of m.results) {
        const aBatter = cbScores.team_a_batters.find(b => b.position === r.team_a_position);
        const bBatter = cbScores.team_b_batters.find(b => b.position === r.team_b_position);
        if (aBatter && bBatter) {
          const expectedTotal = aBatter.runs + bBatter.runs;
          if (r.player_a_runs !== aBatter.runs || r.player_b_runs !== bBatter.runs) {
            console.log(`⚠️ ${m.date.toISOString().slice(0,10)} ${m.team_a_name} vs ${m.team_b_name}: ${r.betting_player.name} A${r.team_a_position}B${r.team_b_position}`);
            console.log(`   DB: ${r.player_a_name}(${r.player_a_runs}) + ${r.player_b_name}(${r.player_b_runs}) = ${r.total_runs}`);
            console.log(`   CB: ${aBatter.name}(${aBatter.runs}) + ${bBatter.name}(${bBatter.runs}) = ${expectedTotal}`);
            issues++;
          }
        }
      }
      if (issues === 0) {
        console.log(`✅ ${m.date.toISOString().slice(0,10)} ${m.team_a_name} vs ${m.team_b_name} - All scores match`);
      }
    }

    // 5. Verify May 27-Jun 2 scores
    console.log('\n=== VERIFYING SCORES FOR MAY 27-JUN 2 ===');
    const may27matches = await prisma.iplMatch.findMany({
      where: { date: { gte: new Date('2026-05-27'), lte: new Date('2026-06-03') } },
      orderBy: { date: 'asc' },
      include: { results: { include: { betting_player: true }, orderBy: { total_runs: 'desc' } } }
    });

    for (const m of may27matches) {
      if (m.results.length === 0 || !m.results.some(r => r.total_runs > 0)) {
        console.log(`⏳ ${m.date.toISOString().slice(0,10)} ${m.team_a_name} vs ${m.team_b_name} - No scores yet`);
        continue;
      }
      const cbId = m.api_match_id.replace('cb_', '');
      const cbScores = await scrapeCricbuzzScorecard(cbId);
      if (!cbScores) { console.log(`⚠️ No scorecard for ${m.team_a_name} vs ${m.team_b_name}`); continue; }
      
      let issues = 0;
      for (const r of m.results) {
        const aBatter = cbScores.team_a_batters.find(b => b.position === r.team_a_position);
        const bBatter = cbScores.team_b_batters.find(b => b.position === r.team_b_position);
        if (aBatter && bBatter) {
          if (r.player_a_runs !== aBatter.runs || r.player_b_runs !== bBatter.runs) {
            console.log(`⚠️ ${m.date.toISOString().slice(0,10)} ${m.team_a_name} vs ${m.team_b_name}: ${r.betting_player.name} A${r.team_a_position}B${r.team_b_position}`);
            console.log(`   DB: ${r.player_a_name}(${r.player_a_runs}) + ${r.player_b_name}(${r.player_b_runs}) = ${r.total_runs}`);
            console.log(`   CB: ${aBatter.name}(${aBatter.runs}) + ${bBatter.name}(${bBatter.runs}) = ${expectedTotal}`);
            issues++;
          }
        }
      }
      if (issues === 0) {
        console.log(`✅ ${m.date.toISOString().slice(0,10)} ${m.team_a_name} vs ${m.team_b_name} - All scores match`);
      }
    }

  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}
auditAndFix();
