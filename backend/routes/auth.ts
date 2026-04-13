import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
// For a production app we would use bcrypt and jsonwebtoken, but for this boilerplate setup MVP:

const router = Router();
const prisma = new PrismaClient();

// MVP Simple Login Endpoint for NextAuth Credentials Adapter
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Check if user exists
    let admin = await prisma.adminUser.findUnique({ where: { email } });
    
    // For MVP bootstrapping: If no admin exists on the entire platform, create the first one automatically
    const adminCount = await prisma.adminUser.count();
    if (adminCount === 0 && email === 'admin@cricket.local') {
       admin = await prisma.adminUser.create({
         data: { email, password_hash: password, role: 'ADMIN' }
       });
    }

    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Direct string compare for MVP. (Replace with bcrypt.compare in Production)
    if (admin.password_hash !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Return mock JWT payload
    res.json({
        id: admin.id,
        email: admin.email,
        role: admin.role,
        token: 'mock-jwt-token-replace-in-prod' 
    });

  } catch (error) {
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
});

export default router;
