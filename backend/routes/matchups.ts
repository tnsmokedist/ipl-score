import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// Get active matchups
router.get('/', async (req, res) => {
  try {
    const matchups = await prisma.matchup.findMany({
      orderBy: { updated_at: 'desc' },
      include: {
        match: true,
        betting_player: true,
        player_a: true,
        player_b: true
      }
    });
    res.json(matchups);
  } catch (error) {
    console.error('Fetch matchups error:', error);
    res.status(500).json({ error: 'Failed to fetch matchups' });
  }
});

// Support data for dropdowns in frontend
router.get('/support-data', async (req, res) => {
  try {
    const matches = await prisma.iplMatch.findMany({ where: { status: 'UPCOMING' } });
    const cp = await prisma.cricketPlayer.findMany();
    res.json({ matches, cricketPlayers: cp });
  } catch (error) {
    console.error('Failed to get support data', error);
    res.status(500).json({ error: 'Failed to fetch support data' });
  }
});

// Create a new Matchup
router.post('/', async (req, res) => {
  try {
    const { match_id, betting_player_id, player_a_id, player_b_id, assigned_player_id, bet_amount } = req.body;
    
    const newMatchup = await prisma.matchup.create({
      data: {
        match_id,
        betting_player_id,
        player_a_id,
        player_b_id,
        assigned_player_id,
        bet_amount: Number(bet_amount) || 0,
        status: 'ACTIVE'
      },
      include: {
        match: true,
        betting_player: true,
        player_a: true,
        player_b: true
      }
    });

    res.status(201).json(newMatchup);
  } catch (error) {
    console.error('Create matchup error:', error);
    res.status(500).json({ error: 'Failed to create matchup' });
  }
});

export default router;
