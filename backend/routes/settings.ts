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

    let created = 0, updated = 0;
    for (const m of cbMatches) {
      const apiId = `cb_${m.cricbuzz_id}`;
      const existing = await prisma.iplMatch.findFirst({
        where: { api_match_id: apiId }
      });

      if (existing) {
        // Update status if changed
        if (m.status && m.status !== 'Upcoming') {
          await prisma.iplMatch.update({
            where: { id: existing.id },
            data: {
              team_a_name: m.team_a_name,
              team_b_name: m.team_b_name,
            }
          });
          updated++;
        }
      } else {
        // Create new match
        // Date: for matches without dates from Cricbuzz, calculate from match number
        // IPL starts March 28 2026 with 1 match/day, sometimes 2/day on weekends
        const matchDate = estimateMatchDate(m.match_number);

        await prisma.iplMatch.create({
          data: {
            api_match_id: apiId,
            date: matchDate,
            team_a_name: m.team_a_name,
            team_b_name: m.team_b_name,
            venue: '',
            bet_amount: 100,
            status: m.status === 'Upcoming' || m.status === 'Preview' ? 'PENDING' : 'PENDING'
          }
        });
        created++;
      }
    }

    console.log(`[Sync] Created ${created}, Updated ${updated} matches`);
    res.json({ message: `Synced ${cbMatches.length} IPL matches from Cricbuzz!`, created, updated });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Failed to sync matches' });
  }
});

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
// Verified against Cricbuzz (user-provided screenshot)
// IPL 2026: 70 matches, Mar 28 - May 31, one game/day early, doubleheaders on weekends later
function estimateMatchDate(matchNumber: number): Date {
  const schedule: Record<number, string> = {
    // Week 0: Mar 28 (Sat) – Mar 31 (Tue) — opening week, 1 game/day
    1: '2026-03-28',    // SRH vs RCB
    2: '2026-03-29',    // KKR vs MI
    3: '2026-03-30',    // CSK vs RR
    4: '2026-03-31',    // GT vs PBKS

    // Week 1: Apr 1 (Wed) – Apr 7 (Tue) — 1 game/day
    5: '2026-04-01',    // LSG vs DC
    6: '2026-04-02',    // SRH vs KKR
    7: '2026-04-03',    // CSK vs PBKS
    8: '2026-04-04',    // MI vs DC
    9: '2026-04-05',    // RR vs GT
    10: '2026-04-06',   // SRH vs LSG
    11: '2026-04-07',   // RCB vs CSK

    // Apr 7 has 2nd game too
    12: '2026-04-07',   // KKR vs PBKS

    // Week 2: Apr 8 (Wed) – Apr 14 (Tue)
    13: '2026-04-08',   // RR vs MI  
    14: '2026-04-08',   // GT vs DC
    15: '2026-04-09',   // KKR vs LSG
    16: '2026-04-10',   // RCB vs RR
    17: '2026-04-11',   // SRH vs PBKS
    18: '2026-04-11',   // CSK vs DC
    19: '2026-04-12',   // LSG vs GT
    20: '2026-04-12',   // RCB vs MI
    21: '2026-04-13',   // SRH vs RR
    22: '2026-04-14',   // CSK vs KKR

    // Week 3: Apr 15 (Wed) – Apr 21 (Tue) 
    23: '2026-04-15',   // RCB vs LSG
    24: '2026-04-16',   // MI vs PBKS
    25: '2026-04-16',   // GT vs CSK
    26: '2026-04-17',   // DC vs RR
    27: '2026-04-18',   // KKR vs SRH
    28: '2026-04-19',   // MI vs GT
    29: '2026-04-19',   // PBKS vs LSG
    30: '2026-04-20',   // RCB vs DC
    31: '2026-04-20',   // CSK vs SRH
  };

  if (schedule[matchNumber]) {
    return new Date(schedule[matchNumber] + 'T14:00:00Z');
  }

  // Matches 32-70: continue daily/doubleheader pattern from Apr 21
  const baseDate = new Date('2026-04-21T14:00:00Z');
  const offset = matchNumber - 32;
  const d = new Date(baseDate);
  d.setDate(d.getDate() + Math.floor(offset / 2));
  if (offset % 2 === 1) d.setHours(d.getHours() + 4);
  return d;
}
