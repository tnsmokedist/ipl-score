import { Router } from 'express';
import { scrapeIPLSchedule, scrapeTopBatsmen } from '../services/cricketApi';
import prisma from '../lib/prisma';

const router = Router();

// ─── Sync IPL matches from Cricbuzz ───
router.post('/sync-matches', async (req, res) => {
  try {
    console.log('[Sync] Pulling real IPL schedule from Cricbuzz...');
    const cbMatches = await scrapeIPLSchedule();

    if (cbMatches.length === 0) {
      return res.status(500).json({ error: 'Failed to fetch schedule from Cricbuzz. Try again later.' });
    }

    let created = 0, updated = 0, datesFixed = 0;
    for (const m of cbMatches) {
      const apiId = `cb_${m.cricbuzz_id}`;
      const existing = await prisma.iplMatch.findFirst({
        where: { api_match_id: apiId }
      });

      if (existing) {
        // Always update team names + date if Cricbuzz provides a real start_date
        const updateData: any = {
          team_a_name: m.team_a_name,
          team_b_name: m.team_b_name,
        };
        // If Cricbuzz provides a real date (or estimated playoff date) AND it differs from what we have, update it
        if (m.start_date) {
          const cbDate = new Date(m.start_date);
          const existingDate = new Date(existing.date);
          // Check if dates differ by more than 2 hours (handles timezone edge cases)
          if (Math.abs(cbDate.getTime() - existingDate.getTime()) > 2 * 60 * 60 * 1000) {
            updateData.date = cbDate;
            datesFixed++;
            console.log(`[Sync] Fixed date for ${m.team_a_name} vs ${m.team_b_name}: ${existingDate.toISOString()} → ${cbDate.toISOString()}`);
          }
        }
        await prisma.iplMatch.update({
          where: { id: existing.id },
          data: updateData
        });
        updated++;
      } else {
        // Create new match — prefer real Cricbuzz date, fall back to estimate
        const matchDate = m.start_date || estimateMatchDate(m.match_number);

        await prisma.iplMatch.create({
          data: {
            api_match_id: apiId,
            date: matchDate,
            team_a_name: m.team_a_name,
            team_b_name: m.team_b_name,
            venue: '',
            bet_amount: 100,
            status: 'PENDING'
          }
        });
        created++;
      }
    }

    // After syncing dates, auto-fix any weekly draws that now have new matches in range
    if (datesFixed > 0) {
      console.log(`[Sync] ${datesFixed} match dates corrected — checking weekly draws for missing results...`);
      await backfillDrawResults();
    }

    console.log(`[Sync] Created ${created}, Updated ${updated}, Dates fixed ${datesFixed}`);
    res.json({ message: `Synced ${cbMatches.length} IPL matches from Cricbuzz! ${datesFixed} dates corrected.`, created, updated, datesFixed });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Failed to sync matches' });
  }
});

// ─── Fix Playoff Dates: Directly fix playoff match dates in DB ───
router.post('/fix-playoff-dates', async (req, res) => {
  try {
    console.log('[FixPlayoffs] Fixing playoff match dates...');
    const playoffFixMap: Record<string, { date: string; desc: string }> = {
      'cb_155376': { date: '2026-05-26T14:00:00Z', desc: 'Qualifier 1' },
      'cb_155387': { date: '2026-05-28T14:00:00Z', desc: 'Eliminator' },
      'cb_155398': { date: '2026-05-30T14:00:00Z', desc: 'Qualifier 2' },
    };

    let fixed = 0;
    for (const [apiId, info] of Object.entries(playoffFixMap)) {
      const match = await prisma.iplMatch.findFirst({ where: { api_match_id: apiId } });
      if (match) {
        const correctDate = new Date(info.date);
        const currentDate = new Date(match.date);
        if (Math.abs(correctDate.getTime() - currentDate.getTime()) > 2 * 60 * 60 * 1000) {
          // Delete old MatchResult rows for this match (they belong to the wrong draw)
          const deleted = await prisma.matchResult.deleteMany({ where: { match_id: match.id } });
          console.log(`[FixPlayoffs] Deleted ${deleted.count} old results for ${info.desc}`);

          await prisma.iplMatch.update({
            where: { id: match.id },
            data: { date: correctDate }
          });
          console.log(`[FixPlayoffs] ${info.desc}: ${currentDate.toISOString().split('T')[0]} → ${correctDate.toISOString().split('T')[0]}`);
          fixed++;
        } else {
          console.log(`[FixPlayoffs] ${info.desc}: already correct (${currentDate.toISOString().split('T')[0]})`);
        }
      } else {
        console.log(`[FixPlayoffs] ${info.desc} (${apiId}): not found in DB`);
      }
    }

    // Backfill draws after fixing dates
    const backfilled = await backfillDrawResults();
    console.log(`[FixPlayoffs] Done! ${fixed} playoff dates fixed, ${backfilled} draw results backfilled.`);
    res.json({ message: `Fixed ${fixed} playoff dates, backfilled ${backfilled} draw results.`, fixed, backfilled });
  } catch (error) {
    console.error('Fix playoff dates error:', error);
    res.status(500).json({ error: 'Failed to fix playoff dates' });
  }
});

// ─── Fix Dates: Force update ALL match dates from Cricbuzz + backfill draw results ───
router.post('/fix-dates', async (req, res) => {
  try {
    console.log('[FixDates] Forcing date update for all matches from Cricbuzz...');
    const cbMatches = await scrapeIPLSchedule();
    if (cbMatches.length === 0) {
      return res.status(500).json({ error: 'Failed to fetch schedule from Cricbuzz.' });
    }

    let fixed = 0;
    for (const m of cbMatches) {
      if (!m.start_date) continue;
      const apiId = `cb_${m.cricbuzz_id}`;
      const existing = await prisma.iplMatch.findFirst({ where: { api_match_id: apiId } });
      if (existing) {
        const cbDate = new Date(m.start_date);
        const existingDate = new Date(existing.date);
        if (Math.abs(cbDate.getTime() - existingDate.getTime()) > 2 * 60 * 60 * 1000) {
          await prisma.iplMatch.update({
            where: { id: existing.id },
            data: { date: cbDate }
          });
          console.log(`[FixDates] ${m.team_a_name} vs ${m.team_b_name}: ${existingDate.toISOString().split('T')[0]} → ${cbDate.toISOString().split('T')[0]}`);
          fixed++;
        }
      }
    }

    // Backfill missing MatchResult rows for all draws
    const backfilled = await backfillDrawResults();

    console.log(`[FixDates] Done! ${fixed} dates fixed, ${backfilled} new match results created.`);
    res.json({ message: `Fixed ${fixed} match dates, backfilled ${backfilled} draw results.`, fixed, backfilled });
  } catch (error) {
    console.error('Fix dates error:', error);
    res.status(500).json({ error: 'Failed to fix dates' });
  }
});

// ─── Helper: Backfill MatchResult rows for all weekly draws ───
async function backfillDrawResults(): Promise<number> {
  let totalCreated = 0;
  const allWeeks = await prisma.weeklyDraw.findMany({
    include: { entries: true }
  });

  for (const week of allWeeks) {
    const matchesInRange = await prisma.iplMatch.findMany({
      where: { date: { gte: week.week_start, lte: week.week_end } }
    });

    for (const match of matchesInRange) {
      for (const entry of week.entries) {
        const existing = await prisma.matchResult.findFirst({
          where: {
            weekly_draw_id: week.id,
            match_id: match.id,
            betting_player_id: entry.betting_player_id
          }
        });
        if (!existing) {
          await prisma.matchResult.create({
            data: {
              weekly_draw_id: week.id,
              match_id: match.id,
              betting_player_id: entry.betting_player_id,
              team_a_position: entry.team_a_position,
              team_b_position: entry.team_b_position,
            }
          });
          totalCreated++;
          console.log(`[Backfill] Created result for ${match.team_a_name} vs ${match.team_b_name} in week "${week.week_label}"`);
        }
      }
    }
  }
  return totalCreated;
}

// ─── Seed initial data (players + admin) ───
router.post('/seed', async (req, res) => {
  try {
    // 1. Seed the 8 real betting players
    const playerNames = ['Happy', 'Nick', 'Pintu', 'Satish', 'Mayur', 'Swami', 'Hp', 'Pradip'];
    for (const name of playerNames) {
      await prisma.bettingPlayer.upsert({ where: { name }, update: {}, create: { name, default_bet_amount: 100 } });
    }

    // 2. Create admin account if not exists
    const adminCount = await prisma.adminUser.count();
    if (adminCount === 0) {
      await prisma.adminUser.create({ data: { email: 'admin@cricket.local', password_hash: 'allstar', role: 'ADMIN' } });
    }

    // 3. Sync matches from Cricbuzz
    console.log('[Seed] Pulling real IPL schedule from Cricbuzz...');
    const cbMatches = await scrapeIPLSchedule();
    let matchCount = 0;

    // First clear any old mock matches
    const existingMocks = await prisma.iplMatch.findMany({
      where: { api_match_id: { startsWith: 'ipl2026_' } }
    });
    
    // Only delete mock matches that have no associated results
    for (const mock of existingMocks) {
      const resultCount = await prisma.matchResult.count({ where: { match_id: mock.id } });
      if (resultCount === 0) {
        await prisma.iplMatch.delete({ where: { id: mock.id } });
      }
    }

    // Insert real Cricbuzz matches
    for (const m of cbMatches) {
      const apiId = `cb_${m.cricbuzz_id}`;
      const existing = await prisma.iplMatch.findFirst({ where: { api_match_id: apiId } });
      if (!existing) {
        // Use real date from Cricbuzz (preferred) or fall back to estimate
        const matchDate = m.start_date || estimateMatchDate(m.match_number);
        await prisma.iplMatch.create({
          data: {
            api_match_id: apiId,
            date: matchDate,
            team_a_name: m.team_a_name,
            team_b_name: m.team_b_name,
            venue: '',
            bet_amount: 100,
            status: 'PENDING'
          }
        });
        matchCount++;
        if (m.start_date) {
          console.log(`[Seed] ${m.match_desc}: ${m.team_a_name} vs ${m.team_b_name} → ${matchDate.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', timeZone:'America/New_York' })} (from Cricbuzz)`);
        }
      }
    }

    res.json({
      message: `Seeded! ${playerNames.length} players, ${matchCount} new matches from Cricbuzz (${cbMatches.length} total).`,
      players: playerNames.length,
      matches: cbMatches.length
    });
  } catch (error) {
    console.error('Seeding error:', error);
    res.status(500).json({ error: 'Failed to seed database' });
  }
});

// ─── Top Batsmen (Orange Cap) ───
router.get('/top-batsmen', async (req, res) => {
  try {
    const topBatsmen = await scrapeTopBatsmen();
    res.json(topBatsmen);
  } catch (error) {
    console.error('Top batsmen error:', error);
    res.status(500).json({ error: 'Failed to fetch top batsmen' });
  }
});

export default router;

// ─── Helper: map match number to actual IPL 2026 date ───
// IPL 2026: ~74 matches, Mar 28 - May 31
// Pattern: 1 game weekdays, 2 games on Sat/Sun. Playoffs late May.
function estimateMatchDate(matchNumber: number): Date {
  const schedule: Record<number, string> = {
    // Week 0: Mar 28 – Mar 31
    1: '2026-03-28', 2: '2026-03-29', 3: '2026-03-30', 4: '2026-03-31',
    // Week 1: Apr 1 – Apr 7
    5: '2026-04-01', 6: '2026-04-02', 7: '2026-04-03', 8: '2026-04-04',
    9: '2026-04-05', 10: '2026-04-06', 11: '2026-04-07', 12: '2026-04-07',
    // Week 2: Apr 8 – Apr 14
    13: '2026-04-08', 14: '2026-04-08', 15: '2026-04-09', 16: '2026-04-10',
    17: '2026-04-11', 18: '2026-04-11', 19: '2026-04-12', 20: '2026-04-12',
    21: '2026-04-13', 22: '2026-04-14',
    // Week 3: Apr 15 – Apr 21
    23: '2026-04-15', 24: '2026-04-16', 25: '2026-04-16', 26: '2026-04-17',
    27: '2026-04-18', 28: '2026-04-19', 29: '2026-04-19', 30: '2026-04-20', 31: '2026-04-20',
    // Week 4: Apr 22 – Apr 28
    32: '2026-04-22', 33: '2026-04-23', 34: '2026-04-24', 35: '2026-04-25',
    36: '2026-04-25', 37: '2026-04-26', 38: '2026-04-26', 39: '2026-04-27', 40: '2026-04-28',
    // Week 5: Apr 29 – May 5
    41: '2026-04-29', 42: '2026-04-30', 43: '2026-05-01', 44: '2026-05-02',
    45: '2026-05-02', 46: '2026-05-03', 47: '2026-05-03', 48: '2026-05-04', 49: '2026-05-05',
    // Week 6: May 6 – May 12
    50: '2026-05-06', 51: '2026-05-07', 52: '2026-05-08', 53: '2026-05-09',
    54: '2026-05-09', 55: '2026-05-10', 56: '2026-05-10', 57: '2026-05-11', 58: '2026-05-12',
    // Week 7: May 13 – May 19
    59: '2026-05-13', 60: '2026-05-14', 61: '2026-05-15', 62: '2026-05-16',
    63: '2026-05-16', 64: '2026-05-17', 65: '2026-05-17', 66: '2026-05-18', 67: '2026-05-19',
    // Week 8: May 20 – May 26 (final league + playoffs)
    68: '2026-05-20', 69: '2026-05-21', 70: '2026-05-22',
    71: '2026-05-23', 72: '2026-05-25', 73: '2026-05-27', 74: '2026-05-29',
  };

  if (schedule[matchNumber]) {
    return new Date(schedule[matchNumber] + 'T14:00:00Z');
  }

  // Beyond 74: unlikely, but space ~1 game/day from May 30
  const baseDate = new Date('2026-05-30T14:00:00Z');
  const offset = matchNumber - 75;
  const d = new Date(baseDate);
  d.setDate(d.getDate() + offset);
  return d;
}
