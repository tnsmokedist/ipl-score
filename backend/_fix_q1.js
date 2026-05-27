// Direct database fix for Q1 match date - bypasses the API
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixQ1() {
  try {
    // Find Q1 match
    const q1 = await prisma.iplMatch.findFirst({ where: { api_match_id: 'cb_155376' } });
    if (!q1) { console.log('Q1 match not found!'); return; }
    
    console.log('Current Q1 date:', q1.date.toISOString(), q1.team_a_name, 'vs', q1.team_b_name);
    
    // Step 1: Delete old MatchResult rows for Q1
    const deleted = await prisma.matchResult.deleteMany({ where: { match_id: q1.id } });
    console.log(`Deleted ${deleted.count} old MatchResult rows for Q1`);
    
    // Step 2: Update Q1 date to May 26
    await prisma.iplMatch.update({
      where: { id: q1.id },
      data: { date: new Date('2026-05-26T14:00:00Z') }
    });
    console.log('Updated Q1 date to 2026-05-26');
    
    // Step 3: Find the May 20-26 draw
    const may20Draw = await prisma.weeklyDraw.findFirst({
      where: { week_label: { contains: 'May 20' } },
      include: { entries: true }
    });
    
    if (!may20Draw) { console.log('May 20-26 draw not found!'); return; }
    console.log(`Found draw "${may20Draw.week_label}" with ${may20Draw.entries.length} entries`);
    
    // Step 4: Create MatchResult rows for Q1 in the May 20-26 draw
    let created = 0;
    for (const entry of may20Draw.entries) {
      await prisma.matchResult.create({
        data: {
          weekly_draw_id: may20Draw.id,
          match_id: q1.id,
          betting_player_id: entry.betting_player_id,
          team_a_position: entry.team_a_position,
          team_b_position: entry.team_b_position,
        }
      });
      created++;
    }
    console.log(`Created ${created} MatchResult rows for Q1 in "${may20Draw.week_label}"`);
    
    // Verify
    const q1Updated = await prisma.iplMatch.findFirst({ where: { api_match_id: 'cb_155376' } });
    console.log('\nVerification - Q1 date now:', q1Updated.date.toISOString());
    
    const results = await prisma.matchResult.count({ where: { match_id: q1.id } });
    console.log('Q1 MatchResult count:', results);
    
    console.log('\n✅ DONE! Q1 (RCB vs GT) moved to May 26 and backfilled into May 20-26 draw.');
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

fixQ1();
