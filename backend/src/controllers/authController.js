const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { JWT_SECRET, ENFORCE_IP_LIMIT } = require('../config/constants');
const { getInitials } = require('../utils/avatar');

// Helper para obter o IP do cliente
function getClientIp(req) {
  return req.headers['x-forwarded-for'] || req.socket.remoteAddress;
}

async function register(req, res) {
  const { email, password, referred_by, name } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
  }

  const ip = getClientIp(req);

  try {
    if (ENFORCE_IP_LIMIT) {
      const existingIp = await prisma.user.findFirst({
        where: { registration_ip: ip },
      });
      if (existingIp && ip !== '::1' && ip !== '127.0.0.1') {
        return res.status(429).json({ error: 'Limite de criação de conta por IP atingido.' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newReferralCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    const displayName = name && name.trim() ? name.trim() : email.split('@')[0];

    // Transação Atômica do Growth Loop
    const result = await prisma.$transaction(async (tx) => {
      let referrerUser = null;

      if (referred_by) {
        referrerUser = await tx.user.findUnique({
          where: { referral_code: referred_by },
        });
        if (!referrerUser) {
          throw new Error('Código de indicação inválido.');
        }
      }

      const newUser = await tx.user.create({
        data: {
          name: displayName,
          email,
          password: hashedPassword,
          referral_code: newReferralCode,
          registration_ip: ip,
          premium_until: null,
        },
      });

      if (referrerUser) {
        const currentPremium =
          referrerUser.premium_until && new Date(referrerUser.premium_until) > new Date()
            ? new Date(referrerUser.premium_until)
            : new Date();
        currentPremium.setDate(currentPremium.getDate() + 30);

        await tx.user.update({
          where: { id: referrerUser.id },
          data: { premium_until: currentPremium },
        });

        await tx.referralEvent.create({
          data: {
            referrer_id: referrerUser.id,
            referred_id: newUser.id,
          },
        });
      }

      return newUser;
    });

    res.status(201).json({
      message: 'Usuário criado com sucesso.',
      user: {
        id: result.id,
        name: result.name || displayName,
        email: result.email,
        referral_code: result.referral_code,
      },
    });
  } catch (error) {
    if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
      return res.status(409).json({ error: 'E-mail já está em uso.' });
    }
    console.error('Erro no registro:', error);
    res.status(400).json({ error: error.message || 'Erro ao criar usuário.' });
  }
}

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ error: 'E-mail não cadastrado ou senha incorreta.' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    const displayName =
      user.name || (user.email ? user.email.split('@')[0] : 'Usuário');
    const initials = getInitials(displayName);

    const token = jwt.sign(
      { id: user.id, email: user.email, name: displayName },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Cálculo dinâmico dos dias restantes de Premium se houver data
    let daysLeft = 23;
    if (user.premium_until) {
      const now = new Date();
      const diffTime = new Date(user.premium_until) - now;
      daysLeft = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: displayName,
        initials,
        plan: 'Plano Vibe',
        daysLeft,
        referral_code: user.referral_code || 'SYNCPLAY',
        premium_until: user.premium_until,
      },
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno ao realizar login.' });
  }
}

module.exports = {
  register,
  login,
};

