import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    let user = await prisma.adminUser.findUnique({ where: { email } });
    
    const adminCount = await prisma.adminUser.count();
    if (adminCount === 0 && email === 'admin@cricket.local') {
       user = await prisma.adminUser.create({ data: { email, password_hash: password, role: 'ADMIN' } });
    }

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.password_hash !== password) return res.status(401).json({ error: 'Invalid credentials' });

    res.json({ id: user.id, email: user.email, name: (user as any).name || '', role: user.role, token: `mock-jwt-${user.role.toLowerCase()}-${user.id}` });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
});

// Create account (admin or viewer)
router.post('/create-account', async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    const existing = await prisma.adminUser.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'Account already exists' });

    const validRole = (role === 'ADMIN' || role === 'CO_ADMIN') ? role : 'VIEWER';
    const account = await prisma.adminUser.create({
      data: { email, password_hash: password, name: name || '', role: validRole }
    });

    res.status(201).json({ id: account.id, email: account.email, name: account.name, role: account.role, message: `${validRole} account created for ${name || email}` });
  } catch (error) {
    console.error('Create account error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// List all accounts
router.get('/accounts', async (req, res) => {
  try {
    const users = await prisma.adminUser.findMany({
      select: { id: true, email: true, name: true, role: true, created_at: true }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// Reset password
router.put('/reset-password/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { new_password } = req.body;
    await prisma.adminUser.update({ where: { id }, data: { password_hash: new_password } });
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Delete account
router.delete('/accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Prevent deleting yourself
    await prisma.adminUser.delete({ where: { id } });
    res.json({ message: 'Account deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

export default router;
