const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const QuantumAuth = require('../../core/auth');
const db = require('../../database');

const auth = new QuantumAuth();

// Rate limiting pour la sécurité
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 tentatives max
  message: 'Trop de tentatives, veuillez réessayer plus tard'
});

// ==================== INSCRIPTION ====================
router.post('/register', [
  body('username')
    .isLength({ min: 3, max: 50 })
    .matches(/^[a-zA-Z0-9_.]+$/),
  
  body('email').isEmail().normalizeEmail(),
  
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/),
  
  body('whatsapp').optional().isMobilePhone(),
  body('telegram').optional().isString(),
  body('country').optional().isString(),
  body('city').optional().isString(),
  body('inviteCode').optional().isString()
], async (req, res) => {
  try {
    // Validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      username,
      email,
      password,
      whatsapp,
      telegram,
      country,
      city,
      inviteCode
    } = req.body;

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: 'Un utilisateur avec cet email ou nom d\'utilisateur existe déjà'
      });
    }

    // Hash du mot de passe
    const passwordHash = await auth.hashPassword(password);

    // Générer le code d'affiliation
    const affiliateCode = await db.query(
      'SELECT generate_affiliate_code() as code'
    );

    // Préparer les contacts
    const contacts = {
      whatsapp: { number: whatsapp || null, verified: false },
      telegram: { username: telegram || null, verified: false }
    };

    // Créer l'utilisateur
    const user = await db.query(
      `INSERT INTO users (
        username, email, password_hash, contacts,
        country, city, affiliate_code, role
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, username, email, contacts, country, city,
                affiliate_code as affiliateCode, role, created_at`,
      [
        username, email, passwordHash, JSON.stringify(contacts),
        country, city, affiliateCode.rows[0].code, 'user'
      ]
    );

    // Gérer l'invitation si code fourni
    if (inviteCode) {
      const referrer = await db.query(
        'SELECT id FROM users WHERE affiliate_code = $1',
        [inviteCode]
      );

      if (referrer.rows.length > 0) {
        // Ajouter au réseau d'affiliation
        await db.query(
          `INSERT INTO affiliate_network (user_id, referrer_id, level, commission_rate)
           VALUES ($1, $2, $3, $4)`,
          [user.rows[0].id, referrer.rows[0].id, 1, 0.10]
        );

        // Attribuer un bonus au référent
        await db.query(
          'UPDATE users SET credit_balance = credit_balance + 10 WHERE id = $1',
          [referrer.rows[0].id]
        );
      }
    }

    // Générer les tokens
    const tokens = auth.generateTokenPair(user.rows[0]);

    // Créer la session
    await db.query(
      `INSERT INTO sessions (user_id, access_token, refresh_token, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        user.rows[0].id,
        tokens.accessToken,
        tokens.refreshToken,
        new Date(Date.now() + 900000),
        req.ip,
        req.headers['user-agent']
      ]
    );

    // Log d'audit
    await db.query(
      `INSERT INTO audit_logs (action, entity_type, entity_id, user_id, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      ['user.register', 'user', user.rows[0].id, user.rows[0].id, req.ip, req.headers['user-agent']]
    );

    res.status(201).json({
      success: true,
      message: 'Compte créé avec succès',
      user: user.rows[0],
      tokens,
      affiliate: {
        code: user.rows[0].affiliatecode,
        link: `${process.env.APP_URL}/register?ref=${user.rows[0].affiliatecode}`
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== CONNEXION ====================
router.post('/login', authLimiter, [
  body('identifier').notEmpty(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const { identifier, password, twoFactorCode } = req.body;

    // Trouver l'utilisateur par email ou username
    const user = await db.query(
      `SELECT id, username, email, password_hash, role, affiliate_code,
              is_active, is_verified, two_factor_secret, login_attempts, locked_until
       FROM users 
       WHERE email = $1 OR username = $1`,
      [identifier]
    );

    if (user.rows.length === 0) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    const userData = user.rows[0];

    // Vérifier si le compte est verrouillé
    if (userData.locked_until && userData.locked_until > new Date()) {
      return res.status(423).json({
        error: 'Compte temporairement verrouillé',
        lockedUntil: userData.locked_until
      });
    }

    // Vérifier le mot de passe
    const validPassword = await auth.verifyPassword(userData.password_hash, password);
    
    if (!validPassword) {
      // Incrémenter les tentatives échouées
      await db.query(
        'UPDATE users SET login_attempts = login_attempts + 1 WHERE id = $1',
        [userData.id]
      );

      // Verrouiller après 5 tentatives échouées
      if (userData.login_attempts + 1 >= 5) {
        await db.query(
          'UPDATE users SET locked_until = NOW() + INTERVAL \'30 minutes\' WHERE id = $1',
          [userData.id]
        );
        
        return res.status(423).json({
          error: 'Trop de tentatives échouées. Compte verrouillé pour 30 minutes.'
        });
      }

      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    // Vérifier 2FA si activé
    if (userData.two_factor_secret) {
      if (!twoFactorCode) {
        return res.status(206).json({
          requires2FA: true,
          methods: ['totp']
        });
      }

      const valid2FA = await auth.verifyTwoFactor(userData, twoFactorCode);
      if (!valid2FA) {
        return res.status(401).json({ error: 'Code 2FA invalide' });
      }
    }

    // Réinitialiser les tentatives échouées
    await db.query(
      'UPDATE users SET login_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id = $1',
      [userData.id]
    );

    // Générer les tokens
    const tokens = auth.generateTokenPair(userData);

    // Mettre à jour la session
    await db.query(
      `INSERT INTO sessions (user_id, access_token, refresh_token, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userData.id,
        tokens.accessToken,
        tokens.refreshToken,
        new Date(Date.now() + 900000),
        req.ip,
        req.headers['user-agent']
      ]
    );

    // Log d'audit
    await db.query(
      `INSERT INTO audit_logs (action, entity_type, entity_id, user_id, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      ['user.login', 'user', userData.id, userData.id, req.ip, req.headers['user-agent']]
    );

    res.json({
      success: true,
      user: {
        id: userData.id,
        username: userData.username,
        email: userData.email,
        role: userData.role,
        affiliateCode: userData.affiliate_code,
        isVerified: userData.is_verified
      },
      tokens
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== OAUTH2 ====================
router.get('/oauth/authorize', async (req, res) => {
  try {
    const { client_id, redirect_uri, response_type, scope, state } = req.query;

    // Valider le client
    const client = await db.query(
      'SELECT * FROM applications WHERE client_id = $1 AND is_active = true',
      [client_id]
    );

    if (client.rows.length === 0) {
      return res.status(400).json({ error: 'Client invalide' });
    }

    // Valider la redirect_uri
    const validRedirect = client.rows[0].redirect_uris.includes(redirect_uri);
    if (!validRedirect) {
      return res.status(400).json({ error: 'Redirect URI invalide' });
    }

    // Vérifier si l'utilisateur est connecté
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      // Rediriger vers la page de connexion
      return res.redirect(`/login?redirect=${encodeURIComponent(req.originalUrl)}`);
    }

    // Vérifier le token
    const decoded = auth.verifyToken(token);
    
    // Valider les scopes
    const requestedScopes = scope ? scope.split(' ') : ['openid', 'profile', 'email'];
    const validScopes = auth.validateScopes(requestedScopes, client.rows[0].scopes);
    
    if (!validScopes) {
      return res.status(400).json({ error: 'Scopes invalides' });
    }

    // Générer le code d'autorisation
    const authCode = auth.generateAuthorizationCode(
      client_id,
      decoded.uid,
      requestedScopes
    );

    // Rediriger avec le code
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('code', authCode.code);
    if (state) redirectUrl.searchParams.set('state', state);

    res.redirect(redirectUrl.toString());

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/oauth/token', [
  body('grant_type').isIn(['authorization_code', 'refresh_token', 'client_credentials']),
  body('client_id').notEmpty(),
  body('client_secret').notEmpty()
], async (req, res) => {
  try {
    const { grant_type, client_id, client_secret, code, refresh_token } = req.body;

    // Valider les credentials du client
    const client = await db.query(
      'SELECT * FROM applications WHERE client_id = $1 AND client_secret = $2',
      [client_id, client_secret]
    );

    if (client.rows.length === 0) {
      return res.status(401).json({ error: 'Credentials client invalides' });
    }

    if (grant_type === 'authorization_code') {
      // Échanger le code contre un token
      // (Ici, tu devrais vérifier le code dans ta base de données)
      
      const user = await db.query('SELECT * FROM users WHERE id = $1', [code.userId]);
      
      const tokens = auth.generateTokenPair(user.rows[0]);
      
      res.json({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        token_type: 'Bearer',
        expires_in: 900,
        scope: code.scopes.join(' ')
      });

    } else if (grant_type === 'refresh_token') {
      // Rafraîchir le token
      const decoded = auth.verifyToken(refresh_token, 'refresh');
      
      const user = await db.query('SELECT * FROM users WHERE id = $1', [decoded.uid]);
      
      const tokens = auth.generateTokenPair(user.rows[0]);
      
      res.json({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        token_type: 'Bearer',
        expires_in: 900
      });
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== PROFILE ====================
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Token manquant' });
    }

    const decoded = auth.verifyToken(token);
    
    const user = await db.query(
      `SELECT u.*, 
              (SELECT COUNT(*) FROM affiliate_network WHERE referrer_id = u.id) as team_size,
              (SELECT SUM(amount) FROM commissions WHERE affiliate_id = u.id AND status = 'paid') as total_commission
       FROM users u
       WHERE u.id = $1`,
      [decoded.uid]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    res.json({
      success: true,
      user: user.rows[0]
    });

  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

// ==================== MISE À JOUR PROFILE ====================
router.put('/me', [
  body('whatsapp').optional().isMobilePhone(),
  body('telegram').optional().isString(),
  body('country').optional().isString(),
  body('city').optional().isString()
], async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = auth.verifyToken(token);

    const { whatsapp, telegram, country, city } = req.body;

    // Récupérer les contacts actuels
    const currentUser = await db.query(
      'SELECT contacts FROM users WHERE id = $1',
      [decoded.uid]
    );

    const currentContacts = currentUser.rows[0].contacts || {};

    // Mettre à jour les contacts
    const updatedContacts = {
      ...currentContacts,
      whatsapp: { 
        number: whatsapp || currentContacts.whatsapp?.number,
        verified: false
      },
      telegram: {
        username: telegram || currentContacts.telegram?.username,
        verified: false
      }
    };

    await db.query(
      `UPDATE users 
       SET contacts = $1, country = COALESCE($2, country), city = COALESCE($3, city)
       WHERE id = $4
       RETURNING username, email, contacts, country, city, affiliate_code`,
      [JSON.stringify(updatedContacts), country, city, decoded.uid]
    );

    res.json({
      success: true,
      message: 'Profil mis à jour avec succès'
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
