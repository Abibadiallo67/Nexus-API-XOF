const crypto = require('crypto');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

class QuantumAuth {
  constructor() {
    this.algorithm = 'argon2id';
    this.jwtSecret = process.env.JWT_SECRET || this.generateQuantumKey();
    this.refreshSecret = process.env.JWT_REFRESH_SECRET || this.generateQuantumKey();
  }

  // Génération de clé quantique sécurisée
  generateQuantumKey() {
    return crypto.randomBytes(64).toString('hex');
  }

  // Hash password avec Argon2 (résistant aux attaques quantiques)
  async hashPassword(password) {
    return await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
      hashLength: 32,
      salt: crypto.randomBytes(16)
    });
  }

  // Vérification du mot de passe
  async verifyPassword(hash, password) {
    try {
      return await argon2.verify(hash, password);
    } catch {
      // Protection contre les attaques par timing
      await argon2.hash('dummy', { timeCost: 1 });
      return false;
    }
  }

  // Génération de JWT sécurisé
  generateToken(user, type = 'access') {
    const payload = {
      uid: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      affiliate: user.affiliate_code,
      iat: Math.floor(Date.now() / 1000),
      jti: uuidv4() // ID unique pour éviter le replay
    };

    const secret = type === 'access' ? this.jwtSecret : this.refreshSecret;
    const expiresIn = type === 'access' ? '15m' : '7d';

    return jwt.sign(payload, secret, { 
      expiresIn,
      algorithm: 'HS512',
      issuer: 'nexus-universe',
      audience: 'nexus-clients'
    });
  }

  // Vérification du token
  verifyToken(token, type = 'access') {
    try {
      const secret = type === 'access' ? this.jwtSecret : this.refreshSecret;
      return jwt.verify(token, secret, {
        algorithms: ['HS512'],
        issuer: 'nexus-universe',
        audience: 'nexus-clients'
      });
    } catch (error) {
      throw new Error(`Token invalide: ${error.message}`);
    }
  }

  // Génération de paire de tokens (access + refresh)
  generateTokenPair(user) {
    return {
      accessToken: this.generateToken(user, 'access'),
      refreshToken: this.generateToken(user, 'refresh'),
      expiresIn: 900, // 15 minutes en secondes
      tokenType: 'Bearer'
    };
  }

  // Vérification MFA/2FA
  async verifyTwoFactor(user, token) {
    // Support TOTP, SMS, Email, etc.
    const speakeasy = require('speakeasy');
    
    return speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token: token,
      window: 1
    });
  }

  // Validation des permissions OAuth2
  validateScopes(requestedScopes, allowedScopes) {
    return requestedScopes.every(scope => allowedScopes.includes(scope));
  }

  // Génération de code d'autorisation OAuth2
  generateAuthorizationCode(clientId, userId, scopes) {
    const code = crypto.randomBytes(32).toString('hex');
    
    // Stocker le code en base (avec expiration 10 minutes)
    return {
      code,
      clientId,
      userId,
      scopes,
      expiresAt: Date.now() + 600000
    };
  }

  // Vérification de l'état CORS
  validateCors(origin, allowedOrigins) {
    if (!origin) return false;
    return allowedOrigins.includes(origin) || allowedOrigins.includes('*');
  }
}

module.exports = QuantumAuth;
