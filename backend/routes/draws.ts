import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { findCricbuzzMatchId, scrapeCricbuzzScorecard } from '../services/cricketApi';

const router = Router();
const prisma = new PrismaClient();

// ─── Weekly Draws ───

// GET all weekly draws
router.get('/weeks', async (req, res) => {
  try {
    const weeks = await prisma.weeklyDraw.findMany({
      orderBy: { week_start: 'desc' },
      include: {
        entries: { include: { betting_player: true } },
        _count: { select: { results: true } }
      }
    });
    res.json(weeks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch weekly draws' });
  }
});

// GET a single weekly draw with its entries and match results
router.get('/weeks/:weekId', async (req, res) => {
  try {
    const { weekId } = req.params;
    const week = await prisma.weeklyDraw.findUnique({
      where: { id: weekId },
      include: {
        entries: { include: { betting_player: true } },
        results: {
          include: { match: true, betting_player: true },
          orderBy: [{ match: { date: 'asc' } }, { total_runs: 'desc' }]
        }
      }
    });
    if (!week) return res.status(404).json({ error: 'Week not found' });

    // Get matches for this week's date range
    const matches = await prisma.iplMatch.findMany({
      where: { date: { gte: week.week_start, lte: week.week_end } },
      orderBy: { date: 'asc' }
    });

    res.json({ ...week, matches });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch week details' });
  }
});

// POST — Create a new weekly draw
router.post('/weeks', async (req, res) => {
  try {
    const { week_label, week_start, week_end, assignments } = req.body;
    // assignments = [{ betting_player_id, team_a_position, team_b_position }, ...]

    const week = await prisma.weeklyDraw.create({
      data: { week_label, week_start: new Date(week_start), week_end: new Date(week_end) }
    });

    // Create entries for each player
    for (const a of assignments) {
      await prisma.weeklyDrawEntry.create({
        data: {
          weekly_draw_id: week.id,
          betting_player_id: a.betting_player_id,
          team_a_position: a.team_a_position,
          team_b_position: a.team_b_position
        }
      });
    }

    // Auto-create MatchResult entries for every match in this week's date range
    const matches = await prisma.iplMatch.findMany({
      where: { date: { gte: new Date(week_start), lte: new Date(week_end) } }
    });

    for (const match of matches) {
      for (const a of assignments) {
        await prisma.matchResult.create({
          data: {
            weekly_draw_id: week.id,
            match_id: match.id,
            betting_player_id: a.betting_player_id,
            team_a_position: a.team_a_position,
            team_b_position: a.team_b_position
          }
        });
      }
    }

    res.status(201).json({ message: `Draw created for ${week_label}. ${matches.length} matches auto-populated.`, weekId: week.id });
  } catch (error) {
    console.error('Create week error:', error);
    res.status(500).json({ error: 'Failed to create weekly draw' });
  }
});

// PUT — Update an existing weekly draw (edit positions, label, dates)
router.put('/weeks/:weekId', async (req, res) => {
  try {
    const { weekId } = req.params;
    const { week_label, week_start, week_end, assignments } = req.body;
    // assignments = [{ betting_player_id, team_a_position, team_b_position }, ...]

    const week = await prisma.weeklyDraw.findUnique({ where: { id: weekId } });
    if (!week) return res.status(404).json({ error: 'Week not found' });

    // Update week meta
    await prisma.weeklyDraw.update({
      where: { id: weekId },
      data: {
        week_label: week_label || week.week_label,
        week_start: week_start ? new Date(week_start) : week.week_start,
        week_end: week_end ? new Date(week_end) : week.week_end,
      }
    });

    // Update each player's draw entry
    for (const a of assignments) {
      await prisma.weeklyDrawEntry.updateMany({
        where: {
          weekly_draw_id: weekId,
          betting_player_id: a.betting_player_id,
        },
        data: {
          team_a_position: a.team_a_position,
          team_b_position: a.team_b_position,
        }
      });

      // Also update positions in all PENDING match results for this week + player
      // (don't touch COMPLETED matches)
      const pendingMatchIds = await prisma.iplMatch.findMany({
        where: {
          results: { some: { weekly_draw_id: weekId } },
          status: { not: 'COMPLETED' }
        },
        select: { id: true }
      });

      if (pendingMatchIds.length > 0) {
        await prisma.matchResult.updateMany({
          where: {
            weekly_draw_id: weekId,
            betting_player_id: a.betting_player_id,
            match_id: { in: pendingMatchIds.map(m => m.id) }
          },
          data: {
            team_a_position: a.team_a_position,
            team_b_position: a.team_b_position,
          }
        });
      }
    }

    // If dates changed, we may need to add/remove match results
    if (week_start && week_end) {
      const newStart = new Date(week_start);
      const newEnd = new Date(week_end);
      
      // Find new matches in the range
      const matchesInRange = await prisma.iplMatch.findMany({
        where: { date: { gte: newStart, lte: newEnd } }
      });
      
      // For any new matches that don't have results yet, create them
      for (const match of matchesInRange) {
        for (const a of assignments) {
          const existing = await prisma.matchResult.findFirst({
            where: { weekly_draw_id: weekId, match_id: match.id, betting_player_id: a.betting_player_id }
          });
          if (!existing) {
            await prisma.matchResult.create({
              data: {
                weekly_draw_id: weekId,
                match_id: match.id,
                betting_player_id: a.betting_player_id,
                team_a_position: a.team_a_position,
                team_b_position: a.team_b_position,
              }
            });
          }
        }
      }
    }

    res.json({ message: `Draw updated for ${week_label || week.week_label}.` });
  } catch (error) {
    console.error('Update week error:', error);
    res.status(500).json({ error: 'Failed to update weekly draw' });
  }
});

// ─── Match Scoring ───

// GET all matches (with result counts)
router.get('/matches', async (req, res) => {
  try {
    const matches = await prisma.iplMatch.findMany({
      orderBy: { date: 'asc' },
      include: { _count: { select: { results: true } } }
    });
    res.json(matches);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

// GET results for a specific match
router.get('/match/:matchId', async (req, res) => {
  try {
    const results = await prisma.matchResult.findMany({
      where: { match_id: req.params.matchId },
      orderBy: { total_runs: 'desc' },
      include: { betting_player: true, match: true }
    });
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch match results' });
  }
});

// PUT — Enter scores for a match and calculate winner
router.put('/match/:matchId/scores', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { scores } = req.body;
    // scores = [{ result_id, player_a_name, player_b_name, player_a_runs, player_b_runs }, ...]

    for (const s of scores) {
      const total = (s.player_a_runs || 0) + (s.player_b_runs || 0);
      await prisma.matchResult.update({
        where: { id: s.result_id },
        data: {
          player_a_name: s.player_a_name || '',
          player_b_name: s.player_b_name || '',
          player_a_runs: s.player_a_runs || 0,
          player_b_runs: s.player_b_runs || 0,
          total_runs: total,
          is_winner: false,
          payout: 0
        }
      });
    }

    // Calculate winner(s)
    const allResults = await prisma.matchResult.findMany({
      where: { match_id: matchId },
      include: { betting_player: true }
    });

    const maxRuns = Math.max(...allResults.map(r => r.total_runs));
    const winners = allResults.filter(r => r.total_runs === maxRuns);

    const match = await prisma.iplMatch.findUnique({ where: { id: matchId } });
    const betPerPlayer = match?.bet_amount || 100;
    const totalPot = betPerPlayer * allResults.length;
    const payoutPerWinner = totalPot / winners.length;

    for (const r of allResults) {
      const isWin = r.total_runs === maxRuns;
      const payout = isWin ? payoutPerWinner : 0;
      const netGain = isWin ? (payoutPerWinner - betPerPlayer) : (-betPerPlayer);

      await prisma.matchResult.update({
        where: { id: r.id },
        data: { is_winner: isWin, payout }
      });

      await prisma.bettingPlayer.update({
        where: { id: r.betting_player_id },
        data: {
          total_winnings: { increment: isWin ? payoutPerWinner : 0 },
          total_losses: { increment: betPerPlayer },
          net_balance: { increment: netGain }
        }
      });
    }

    await prisma.iplMatch.update({ where: { id: matchId }, data: { status: 'COMPLETED' } });

    const updated = await prisma.matchResult.findMany({
      where: { match_id: matchId },
      orderBy: { total_runs: 'desc' },
      include: { betting_player: true, match: true }
    });

    res.json({ message: `Settled! ${winners.length} winner(s). Pot: $${totalPot}`, results: updated });
  } catch (error) {
    console.error('Score error:', error);
    res.status(500).json({ error: 'Failed to enter scores' });
  }
});

// ─── Auto-Fetch Scores from Cricbuzz (No API Key!) ───
router.post('/match/:matchId/auto-fetch', async (req, res) => {
  try {
    const { matchId } = req.params;
    const match = await prisma.iplMatch.findUnique({ where: { id: matchId } });
    if (!match) return res.status(404).json({ error: 'Match not found' });

    // Get Cricbuzz ID — prefer stored ID (cb_ prefix), fallback to name search
    let cricbuzzId: string | null = null;
    if (match.api_match_id?.startsWith('cb_')) {
      cricbuzzId = match.api_match_id.replace('cb_', '');
    } else {
      cricbuzzId = await findCricbuzzMatchId(match.team_a_name, match.team_b_name);
    }
    if (!cricbuzzId) {
      return res.status(404).json({ error: `Match "${match.team_a_name} vs ${match.team_b_name}" not found on Cricbuzz. If the match hasn't been played yet, try after it's complete. Otherwise use Manual entry.` });
    }

    // Scrape the scorecard
    const scorecard = await scrapeCricbuzzScorecard(cricbuzzId);
    if (!scorecard || scorecard.team_a_batters.length === 0) {
      return res.status(404).json({ error: 'Scorecard not available yet. The match may still be in progress.' });
    }

    // Update all match results with the scorecard data
    const results = await prisma.matchResult.findMany({
      where: { match_id: matchId },
      include: { betting_player: true }
    });

    for (const r of results) {
      const batter_a = scorecard.team_a_batters.find(b => b.position === r.team_a_position);
      const batter_b = scorecard.team_b_batters.find(b => b.position === r.team_b_position);
      if (batter_a && batter_b) {
        const total = batter_a.runs + batter_b.runs;
        await prisma.matchResult.update({
          where: { id: r.id },
          data: {
            player_a_name: batter_a.name,
            player_b_name: batter_b.name,
            player_a_runs: batter_a.runs,
            player_b_runs: batter_b.runs,
            total_runs: total
          }
        });
      }
    }

    // Now auto-settle: find winner(s)
    const allResults = await prisma.matchResult.findMany({
      where: { match_id: matchId },
      include: { betting_player: true }
    });

    const maxRuns = Math.max(...allResults.map(r => r.total_runs));
    const winners = allResults.filter(r => r.total_runs === maxRuns);
    const betPerPlayer = match.bet_amount || 100;
    const totalPot = betPerPlayer * allResults.length;
    const payoutPerWinner = totalPot / winners.length;

    for (const r of allResults) {
      const isWin = r.total_runs === maxRuns;
      const payout = isWin ? payoutPerWinner : 0;
      const netGain = isWin ? (payoutPerWinner - betPerPlayer) : (-betPerPlayer);
      await prisma.matchResult.update({ where: { id: r.id }, data: { is_winner: isWin, payout } });
      await prisma.bettingPlayer.update({
        where: { id: r.betting_player_id },
        data: { total_winnings: { increment: isWin ? payoutPerWinner : 0 }, total_losses: { increment: betPerPlayer }, net_balance: { increment: netGain } }
      });
    }

    await prisma.iplMatch.update({ where: { id: matchId }, data: { status: 'COMPLETED' } });

    const updated = await prisma.matchResult.findMany({
      where: { match_id: matchId },
      orderBy: { total_runs: 'desc' },
      include: { betting_player: true, match: true }
    });

    res.json({ message: `Auto-fetched & settled! ${winners.length} winner(s). Pot: $${totalPot}`, results: updated });
  } catch (error) {
    console.error('Auto-fetch error:', error);
    res.status(500).json({ error: 'Failed to auto-fetch scores' });
  }
});

// ─── Per-Match Payment Confirmation ───
router.put('/confirm-payment/:resultId', async (req, res) => {
  try {
    const updated = await prisma.matchResult.update({
      where: { id: req.params.resultId },
      data: { payment_confirmed: true, payment_confirmed_at: new Date() },
      include: { betting_player: true }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to confirm payment' });
  }
});

// ─── Confirm Entire Week's Payout ───
router.put('/confirm-week-payout/:weekId', async (req, res) => {
  try {
    const { weekId } = req.params;

    // Mark all results in this week as payment confirmed
    await prisma.matchResult.updateMany({
      where: { weekly_draw_id: weekId },
      data: { payment_confirmed: true, payment_confirmed_at: new Date() }
    });

    // Mark the week itself as payout confirmed
    const updated = await prisma.weeklyDraw.update({
      where: { id: weekId },
      data: { payout_confirmed: true, payout_confirmed_at: new Date() }
    });

    res.json({ message: 'Weekly payout confirmed!', week: updated });
  } catch (error) {
    console.error('Week payout error:', error);
    res.status(500).json({ error: 'Failed to confirm weekly payout' });
  }
});

// ─── Unconfirm Entire Week's Payout ───
router.put('/unconfirm-week-payout/:weekId', async (req, res) => {
  try {
    const { weekId } = req.params;

    // Unmark all results in this week
    await prisma.matchResult.updateMany({
      where: { weekly_draw_id: weekId },
      data: { payment_confirmed: false, payment_confirmed_at: null }
    });

    // Unmark the week itself
    const updated = await prisma.weeklyDraw.update({
      where: { id: weekId },
      data: { payout_confirmed: false, payout_confirmed_at: null }
    });

    res.json({ message: 'Weekly payout unconfirmed. You can now make changes.', week: updated });
  } catch (error) {
    console.error('Week unconfirm error:', error);
    res.status(500).json({ error: 'Failed to unconfirm weekly payout' });
  }
});

// ─── Settlement Report (Weekly Grouped) ───
router.get('/settlement', async (req, res) => {
  try {
    // Get all weekly draws with results
    const weeks = await prisma.weeklyDraw.findMany({
      orderBy: { week_start: 'desc' },
      include: {
        results: {
          include: { match: true, betting_player: true },
          orderBy: { total_runs: 'desc' }
        }
      }
    });

    // Get all players
    const players = await prisma.bettingPlayer.findMany({
      where: { is_active: true },
      orderBy: { net_balance: 'desc' }
    });

    // Group results by week and player
    const weeklyData = weeks.map(week => {
      const completedResults = week.results.filter(r => r.total_runs > 0);
      const playerSummaries = players.map(p => {
        const playerResults = completedResults.filter(r => r.betting_player_id === p.id);
        const wins = playerResults.filter(r => r.is_winner);
        const totalWon = wins.reduce((sum, r) => sum + r.payout, 0);
        const totalPaid = playerResults.length * (playerResults[0]?.match?.bet_amount || 100);
        const weeklyNet = totalWon - totalPaid;
        return {
          player_id: p.id,
          player_name: p.name,
          matches_played: playerResults.length,
          wins: wins.length,
          total_won: totalWon,
          total_paid: totalPaid,
          weekly_net: weeklyNet,
          results: playerResults
        };
      }).filter(ps => ps.matches_played > 0).sort((a, b) => b.weekly_net - a.weekly_net);

      return {
        week_id: week.id,
        week_label: week.week_label,
        week_start: week.week_start,
        week_end: week.week_end,
        payout_confirmed: week.payout_confirmed,
        payout_confirmed_at: week.payout_confirmed_at,
        total_matches: new Set(completedResults.map(r => r.match_id)).size,
        player_summaries: playerSummaries
      };
    });

    res.json({ weeks: weeklyData, players });
  } catch (error) {
    console.error('Settlement error:', error);
    res.status(500).json({ error: 'Failed to generate settlement' });
  }
});

export default router;
