import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { findCricbuzzMatchId, scrapeCricbuzzScorecard, scrapeIPLSchedule } from './services/cricketApi';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 5000;

// CORS: allow localhost (dev) + Vercel (production)
const allowedOrigins = [
  'http://localhost:3000',
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    // Allow any .vercel.app subdomain
    if (origin.endsWith('.vercel.app') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(null, true); // be permissive for now
  },
  credentials: true
}));
app.use(express.json());

// ─── Online User Tracking (in-memory) ───
// Maps user ID → { email, name, role, lastSeen }
const onlineUsers = new Map<string, { email: string; name: string; role: string; lastSeen: Date }>();
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// Middleware: track authenticated users' last activity
app.use((req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer mock-jwt-')) {
    // Token format: mock-jwt-{role}-{userId}
    const parts = authHeader.replace('Bearer mock-jwt-', '').split('-');
    if (parts.length >= 2) {
      const userId = parts.slice(1).join('-'); // UUID may contain dashes
      // We'll enrich later when we have DB data; for now just bump timestamp
      const existing = onlineUsers.get(userId);
      if (existing) {
        existing.lastSeen = new Date();
      } else {
        // Fetch user info from DB asynchronously
        prisma.adminUser.findUnique({ where: { id: userId }, select: { email: true, name: true, role: true } })
          .then(user => {
            if (user) {
              onlineUsers.set(userId, { email: user.email, name: user.name || '', role: user.role, lastSeen: new Date() });
            }
          })
          .catch(() => {});
      }
    }
  }
  next();
});

// Routes
import authRouter from './routes/auth';
import playersRouter from './routes/players';
import settingsRouter from './routes/settings';
import drawsRouter from './routes/draws';

// Basic health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root fallback
app.get('/', (req, res) => {
  res.json({ message: 'Cricket IPL Betting API — Draw Engine Active', healthCheck: '/api/health' });
});

// ─── Online Users Endpoint ───
app.get('/api/auth/online', (req, res) => {
  const now = Date.now();
  const result: Array<{ id: string; email: string; name: string; role: string; lastSeen: string }> = [];
  onlineUsers.forEach((info, id) => {
    if (now - info.lastSeen.getTime() < ONLINE_THRESHOLD_MS) {
      result.push({ id, email: info.email, name: info.name, role: info.role, lastSeen: info.lastSeen.toISOString() });
    } else {
      onlineUsers.delete(id); // Clean up stale entries
    }
  });
  res.json(result);
});

app.use('/api/auth', authRouter);
app.use('/api/players', playersRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/draws', drawsRouter);

// ─── Auto-Fetch Cron: 4:00 PM EST daily ───
// EST = UTC-5 (EDT = UTC-4). 4pm EDT = 20:00 UTC. 4pm EST = 21:00 UTC.
// Using America/New_York timezone.
cron.schedule('0 16 * * *', async () => {
  console.log('[CRON] ⚡ 4:00 PM EST — Auto-fetching scores for today\'s completed matches...');
  try {
    // Get today's date range
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    // Find all pending matches for today that have draw entries
    const todaysMatches = await prisma.iplMatch.findMany({
      where: {
        status: 'PENDING',
        date: { gte: todayStart, lt: todayEnd }
      }
    });

    if (todaysMatches.length === 0) {
      console.log('[CRON] No pending matches for today.');
      return;
    }

    console.log(`[CRON] Found ${todaysMatches.length} pending match(es) for today`);

    for (const match of todaysMatches) {
      console.log(`[CRON] Processing: ${match.team_a_name} vs ${match.team_b_name}`);

      // Check if this match has any draw entries (results rows)
      const resultCount = await prisma.matchResult.count({ where: { match_id: match.id } });
      if (resultCount === 0) {
        console.log(`[CRON] No draw entries for this match — skipping`);
        continue;
      }

      // Find the match on Cricbuzz
      const cricbuzzId = await findCricbuzzMatchId(match.team_a_name, match.team_b_name);
      if (!cricbuzzId) {
        console.log(`[CRON] Match not found on Cricbuzz — skipping`);
        continue;
      }

      // Scrape the scorecard
      const scorecard = await scrapeCricbuzzScorecard(cricbuzzId);
      if (!scorecard || scorecard.team_a_batters.length === 0) {
        console.log(`[CRON] Scorecard not ready yet — skipping`);
        continue;
      }

      // Update all match results with the scorecard data
      const results = await prisma.matchResult.findMany({
        where: { match_id: match.id },
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

      // Settle: calculate winner(s)
      const allResults = await prisma.matchResult.findMany({
        where: { match_id: match.id },
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
          data: {
            total_winnings: { increment: isWin ? payoutPerWinner : 0 },
            total_losses: { increment: betPerPlayer },
            net_balance: { increment: netGain }
          }
        });
      }

      await prisma.iplMatch.update({ where: { id: match.id }, data: { status: 'COMPLETED' } });
      console.log(`[CRON] ✅ Settled: ${match.team_a_name} vs ${match.team_b_name} — ${winners.length} winner(s), Pot: $${totalPot}`);
    }

    console.log('[CRON] Auto-fetch complete!');
  } catch (error) {
    console.error('[CRON] Auto-fetch error:', error);
  }
}, {
  timezone: 'America/New_York'
});

app.listen(port, () => {
  console.log(`Backend server running on port ${port}`);
  console.log(`⏰ Auto-fetch cron scheduled: 4:00 PM EST daily (America/New_York)`);
});
