import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// Get all betting players
router.get('/', async (req, res) => {
  try {
    const players = await prisma.bettingPlayer.findMany({
      orderBy: { created_at: 'desc' }
    });
    res.json(players);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch betting players' });
  }
});

// Create a new betting player
router.post('/', async (req, res) => {
  try {
    const { name, default_bet_amount } = req.body;
    const newPlayer = await prisma.bettingPlayer.create({
      data: {
        name,
        default_bet_amount: default_bet_amount || 100.0,
      }
    });
    res.status(201).json(newPlayer);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create betting player' });
  }
});

// Update a betting player
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, is_active, default_bet_amount } = req.body;
    
    const updatedPlayer = await prisma.bettingPlayer.update({
      where: { id },
      data: {
        name,
        is_active,
        default_bet_amount
      }
    });
    res.json(updatedPlayer);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update betting player' });
  }
});

// Delete a betting player (or deactivate instead)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // For MVP, we'll actually delete. In production we might just set is_active=false.
    await prisma.bettingPlayer.delete({
      where: { id }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete betting player' });
  }
});

export default router;
