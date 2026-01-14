-- FICHIER: database/schema.sql

-- Extension pour UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== TABLE UTILISATEURS ====================
CREATE TABLE users (
    -- ID unique quantique
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Identité (SEO Friendly)
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    avatar_url TEXT,
    
    -- Contacts (WhatsApp, Telegram, etc.)
    contacts JSONB DEFAULT '{
        "whatsapp": {"number": null, "verified": false},
        "telegram": {"username": null, "chat_id": null, "verified": false},
        "phone": {"number": null, "verified": false},
        "signal": {"number": null, "verified": false}
    }',
    
    -- Sécurité
    password_hash VARCHAR(255) NOT NULL,
    two_factor_secret VARCHAR(255),
    recovery_codes TEXT[],
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    
    -- Crédit Universel
    credit_balance DECIMAL(20, 8) DEFAULT 0.00000000,
    credit_locked DECIMAL(20, 8) DEFAULT 0.00000000,
    credit_total_earned DECIMAL(20, 8) DEFAULT 0.00000000,
    
    -- Géolocalisation
    country VARCHAR(100),
    city VARCHAR(100),
    timezone VARCHAR(50),
    locale VARCHAR(10) DEFAULT 'fr_FR',
    
    -- Affiliation
    affiliate_code VARCHAR(20) UNIQUE,
    referrer_id UUID REFERENCES users(id),
    role VARCHAR(20) DEFAULT 'user', -- user, affiliate, partner, team, admin, super_admin
    level INTEGER DEFAULT 1,
    
    -- Métadonnées SEO
    seo_title VARCHAR(100),
    seo_description TEXT,
    seo_keywords TEXT[],
    
    -- Statut
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    is_premium BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    last_seen_at TIMESTAMP WITH TIME ZONE,
    
    -- Index pour performances
    INDEX idx_users_email (email),
    INDEX idx_users_username (username),
    INDEX idx_users_affiliate_code (affiliate_code),
    INDEX idx_users_country_city (country, city),
    INDEX idx_users_role (role)
) WITH (fillfactor = 90);

-- ==================== TABLE CRYPTO WALLETS ====================
CREATE TABLE crypto_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Cryptos supportées
    currency VARCHAR(20) NOT NULL, -- BTC, ETH, USDT, etc.
    network VARCHAR(50), -- Mainnet, Testnet, etc.
    address VARCHAR(255) NOT NULL,
    private_key_encrypted TEXT, -- Chiffré avec la clé master
    
    -- Solde
    balance DECIMAL(30, 18) DEFAULT 0.000000000000000000,
    pending_balance DECIMAL(30, 18) DEFAULT 0.000000000000000000,
    
    -- Métadonnées
    label VARCHAR(100),
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    
    -- Sécurité
    last_synced_at TIMESTAMP WITH TIME ZONE,
    sync_attempts INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, currency, network),
    INDEX idx_crypto_user_currency (user_id, currency)
);

-- ==================== TABLE TRANSACTIONS ====================
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Type de transaction
    type VARCHAR(50) NOT NULL, -- credit_transfer, crypto_deposit, crypto_withdrawal, affiliate_commission
    status VARCHAR(50) DEFAULT 'pending', -- pending, completed, failed, cancelled
    
    -- Participants
    from_user_id UUID REFERENCES users(id),
    to_user_id UUID REFERENCES users(id),
    from_wallet_id UUID REFERENCES crypto_wallets(id),
    to_wallet_id UUID REFERENCES crypto_wallets(id),
    
    -- Montants
    amount DECIMAL(30, 18) NOT NULL,
    currency VARCHAR(20) NOT NULL,
    fee DECIMAL(20, 8) DEFAULT 0,
    net_amount DECIMAL(30, 18),
    
    -- Métadonnées
    description TEXT,
    metadata JSONB DEFAULT '{}',
    
    -- Hash blockchain (pour les transactions crypto)
    tx_hash VARCHAR(255),
    block_number INTEGER,
    confirmations INTEGER DEFAULT 0,
    
    -- Sécurité
    ip_address INET,
    user_agent TEXT,
    location JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Index
    INDEX idx_transactions_user (from_user_id, to_user_id),
    INDEX idx_transactions_status (status),
    INDEX idx_transactions_created (created_at),
    INDEX idx_transactions_hash (tx_hash)
);

-- ==================== TABLE AFFILIATE NETWORK ====================
CREATE TABLE affiliate_network (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Relation
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Niveaux
    level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 10),
    commission_rate DECIMAL(5, 4) NOT NULL, -- 0.1500 = 15%
    
    -- Statistiques
    total_referred INTEGER DEFAULT 0,
    active_referred INTEGER DEFAULT 0,
    total_commission DECIMAL(20, 8) DEFAULT 0,
    
    -- Métadonnées
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_commission_at TIMESTAMP WITH TIME ZONE,
    
    -- Index
    UNIQUE(user_id, referrer_id),
    INDEX idx_affiliate_referrer (referrer_id, level),
    INDEX idx_affiliate_user (user_id)
);

-- ==================== TABLE COMMISSIONS ====================
CREATE TABLE commissions (
    id UUID PRIMARY DEFAULT uuid_generate_v4(),
    
    -- Relation
    affiliate_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    referred_user_id UUID REFERENCES users(id),
    
    -- Montant
    amount DECIMAL(20, 8) NOT NULL,
    currency VARCHAR(20) DEFAULT 'USD',
    rate DECIMAL(5, 4) NOT NULL,
    level INTEGER NOT NULL,
    
    -- Statut
    status VARCHAR(20) DEFAULT 'pending', -- pending, paid, cancelled
    paid_at TIMESTAMP WITH TIME ZONE,
    
    -- Métadonnées
    description TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_commissions_affiliate (affiliate_id),
    INDEX idx_commissions_status (status)
);

-- ==================== TABLE APPLICATIONS ====================
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Info application
    name VARCHAR(255) NOT NULL,
    description TEXT,
    domain VARCHAR(255),
    redirect_uris TEXT[] NOT NULL,
    
    -- OAuth2
    client_id VARCHAR(100) UNIQUE NOT NULL,
    client_secret VARCHAR(255) NOT NULL,
    client_secret_expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Permissions
    scopes TEXT[] DEFAULT '{"openid", "profile", "email"}',
    
    -- Statut
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    
    -- Métadonnées
    logo_url TEXT,
    privacy_policy_url TEXT,
    terms_of_service_url TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_applications_owner (owner_id),
    INDEX idx_applications_client (client_id)
);

-- ==================== TABLE SESSIONS ====================
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    application_id UUID REFERENCES applications(id),
    
    -- Token
    access_token VARCHAR(500) NOT NULL,
    refresh_token VARCHAR(500),
    token_type VARCHAR(50) DEFAULT 'Bearer',
    
    -- Expiration
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    refresh_expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Métadonnées
    ip_address INET,
    user_agent TEXT,
    device_info JSONB,
    location JSONB,
    
    -- Sécurité
    is_revoked BOOLEAN DEFAULT false,
    revoked_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_sessions_user (user_id),
    INDEX idx_sessions_access_token (access_token),
    INDEX idx_sessions_expires (expires_at)
);

-- ==================== TABLE AUDIT LOGS ====================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Action
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    
    -- Utilisateur
    user_id UUID REFERENCES users(id),
    ip_address INET,
    user_agent TEXT,
    
    -- Données
    old_data JSONB,
    new_data JSONB,
    changes JSONB,
    
    -- Métadonnées
    severity VARCHAR(20) DEFAULT 'info', -- info, warning, error, critical
    source VARCHAR(100), -- api, admin, system, bot
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_action (action),
    INDEX idx_audit_created (created_at)
);

-- ==================== TRIGGERS ====================
-- Mise à jour automatique du timestamp updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Appliquer le trigger à toutes les tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crypto_wallets_updated_at BEFORE UPDATE ON crypto_wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==================== FONCTIONS UTILES ====================
-- Fonction pour générer un code d'affiliation unique
CREATE OR REPLACE FUNCTION generate_affiliate_code()
RETURNS VARCHAR(20) AS $$
DECLARE
    code VARCHAR(20);
    exists BOOLEAN;
BEGIN
    LOOP
        -- Génère un code de 8 caractères alphanumériques
        code := UPPER(substring(md5(random()::text) from 1 for 8));
        
        -- Vérifie si le code existe déjà
        SELECT EXISTS(SELECT 1 FROM users WHERE affiliate_code = code) INTO exists;
        
        IF NOT exists THEN
            RETURN code;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour calculer les commissions
CREATE OR REPLACE FUNCTION calculate_commissions(
    p_transaction_id UUID,
    p_amount DECIMAL,
    p_currency VARCHAR
)
RETURNS VOID AS $$
DECLARE
    v_from_user_id UUID;
    v_to_user_id UUID;
    v_referrer_id UUID;
    v_level INTEGER;
    v_rate DECIMAL;
    v_commission DECIMAL;
BEGIN
    -- Récupère les infos de la transaction
    SELECT from_user_id, to_user_id INTO v_from_user_id, v_to_user_id
    FROM transactions WHERE id = p_transaction_id;
    
    -- Pour chaque niveau (jusqu'à 5 niveaux)
    FOR v_level IN 1..5 LOOP
        -- Trouve le référent à ce niveau
        IF v_level = 1 THEN
            SELECT referrer_id INTO v_referrer_id
            FROM affiliate_network
            WHERE user_id = v_to_user_id;
        ELSE
            SELECT referrer_id INTO v_referrer_id
            FROM affiliate_network
            WHERE user_id = v_referrer_id;
        END IF;
        
        -- Si aucun référent, on arrête
        EXIT WHEN v_referrer_id IS NULL;
        
        -- Récupère le taux de commission pour ce niveau
        SELECT commission_rate INTO v_rate
        FROM affiliate_network
        WHERE user_id = v_referrer_id AND level = v_level;
        
        -- Calcule la commission
        v_commission := p_amount * v_rate;
        
        -- Enregistre la commission
        INSERT INTO commissions (
            affiliate_id, transaction_id, referred_user_id,
            amount, currency, rate, level, status
        ) VALUES (
            v_referrer_id, p_transaction_id, v_to_user_id,
            v_commission, p_currency, v_rate, v_level, 'pending'
        );
        
        -- Met à jour le solde de l'affilié
        UPDATE users
        SET credit_balance = credit_balance + v_commission,
            credit_total_earned = credit_total_earned + v_commission
        WHERE id = v_referrer_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
