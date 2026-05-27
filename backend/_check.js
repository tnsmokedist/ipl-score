const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function finalCheck() {
  try {
    const players = await prisma.bettingPlayer.findMany({ orderBy: { name: 'asc' } });
    console.log('=== FINAL PLAYER BALANCES ===');
    let tw = 0, tl = 0;
    players.forEach(p => {
      console.log(`${p.name.padEnd(10)} | Win: $${p.total_winnings.toString().padStart(6)} | Loss: $${p.total_losses.toString().padStart(6)} | Net: $${p.net_balance.toString().padStart(6)}`);
      tw += p.total_winnings; tl += p.total_losses;
    });
    console.log(`${'TOTAL'.padEnd(10)} | Win: $${tw.toString().padStart(6)} | Loss: $${tl.toString().padStart(6)} | Sum: $${(tw - tl).toString().padStart(6)} (should be $0)`);
    
    // Playoff dates
    console.log('\n=== PLAYOFF MATCH DATES ===');
    const playoffs = await prisma.iplMatch.findMany({
      where: { date: { gte: new Date('2026-05-25') } },
      orderBy: { date: 'asc' }
    });
    playoffs.forEach(m => {
      const d = m.date;
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      console.log(`${dayName}, ${d.toISOString().slice(0,10)} | ${m.team_a_name} vs ${m.team_b_name} | ${m.status}`);
    });
  } catch (e) { console.error(e); }
  finally { await prisma.$disconnect(); }
}
finalCheck();
