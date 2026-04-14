// migrate_to_cloud.js — Copy local SQLite data → Neon PostgreSQL
const Database = require('better-sqlite3');
const { PrismaClient } = require('@prisma/client');
const path = require('path');

const localDb = new Database(path.join(__dirname, 'prisma', 'dev.db'), { readonly: true });
const prisma = new PrismaClient();

async function migrate() {
  console.log('=== Migrating Local SQLite → Neon PostgreSQL ===\n');

  // Clear cloud data (child tables first)
  console.log('Clearing cloud data...');
  await prisma.matchResult.deleteMany();
  await prisma.weeklyDrawEntry.deleteMany();
  await prisma.weeklyDraw.deleteMany();
  await prisma.iplMatch.deleteMany();
  await prisma.bettingPlayer.deleteMany();
  await prisma.adminUser.deleteMany();
  await prisma.systemSettings.deleteMany();
  console.log('Cloud cleared.\n');

  // 1. AdminUser
  const admins = localDb.prepare('SELECT * FROM AdminUser').all();
  console.log('AdminUser: ' + admins.length);
  for (const a of admins) {
    await prisma.adminUser.create({
      data: { id: a.id, email: a.email, name: a.name || '', password_hash: a.password_hash, role: a.role, created_at: new Date(a.created_at) }
    });
  }

  // 2. BettingPlayer
  const players = localDb.prepare('SELECT * FROM BettingPlayer').all();
  console.log('BettingPlayer: ' + players.length);
  for (const p of players) {
    await prisma.bettingPlayer.create({
      data: { id: p.id, name: p.name, is_active: p.is_active === 1, default_bet_amount: p.default_bet_amount, total_winnings: p.total_winnings, total_losses: p.total_losses, net_balance: p.net_balance, created_at: new Date(p.created_at) }
    });
  }

  // 3. IplMatch
  const matches = localDb.prepare('SELECT * FROM IplMatch').all();
  console.log('IplMatch: ' + matches.length);
  for (const m of matches) {
    await prisma.iplMatch.create({
      data: { id: m.id, api_match_id: m.api_match_id, date: new Date(m.date), team_a_name: m.team_a_name, team_b_name: m.team_b_name, venue: m.venue || '', status: m.status, bet_amount: m.bet_amount, created_at: new Date(m.created_at) }
    });
  }

  // 4. WeeklyDraw
  const draws = localDb.prepare('SELECT * FROM WeeklyDraw').all();
  console.log('WeeklyDraw: ' + draws.length);
  for (const d of draws) {
    await prisma.weeklyDraw.create({
      data: { id: d.id, week_label: d.week_label, week_start: new Date(d.week_start), week_end: new Date(d.week_end), payout_confirmed: d.payout_confirmed === 1, payout_confirmed_at: d.payout_confirmed_at ? new Date(d.payout_confirmed_at) : null, created_at: new Date(d.created_at) }
    });
  }

  // 5. WeeklyDrawEntry
  const entries = localDb.prepare('SELECT * FROM WeeklyDrawEntry').all();
  console.log('WeeklyDrawEntry: ' + entries.length);
  for (const e of entries) {
    await prisma.weeklyDrawEntry.create({
      data: { id: e.id, weekly_draw_id: e.weekly_draw_id, betting_player_id: e.betting_player_id, team_a_position: e.team_a_position, team_b_position: e.team_b_position, created_at: new Date(e.created_at) }
    });
  }

  // 6. MatchResult
  const results = localDb.prepare('SELECT * FROM MatchResult').all();
  console.log('MatchResult: ' + results.length);
  for (const r of results) {
    await prisma.matchResult.create({
      data: {
        id: r.id, weekly_draw_id: r.weekly_draw_id, match_id: r.match_id, betting_player_id: r.betting_player_id,
        team_a_position: r.team_a_position, team_b_position: r.team_b_position,
        player_a_name: r.player_a_name || '', player_b_name: r.player_b_name || '',
        player_a_runs: r.player_a_runs || 0, player_b_runs: r.player_b_runs || 0, total_runs: r.total_runs || 0,
        is_winner: r.is_winner === 1, payout: r.payout || 0,
        payment_confirmed: r.payment_confirmed === 1, payment_confirmed_at: r.payment_confirmed_at ? new Date(r.payment_confirmed_at) : null,
        created_at: new Date(r.created_at), updated_at: new Date(r.updated_at)
      }
    });
  }

  // 7. SystemSettings
  const settings = localDb.prepare('SELECT * FROM SystemSettings').all();
  console.log('SystemSettings: ' + settings.length);
  for (const s of settings) {
    await prisma.systemSettings.create({
      data: { id: s.id, key: s.key, value: s.value }
    });
  }

  console.log('\n✅ Migration complete! All data pushed to Neon PostgreSQL.');
  localDb.close();
  await prisma.$disconnect();
}

migrate().catch(function(e) { console.error('Migration failed:', e); process.exit(1); });
