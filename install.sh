#!/bin/bash

# Nexus Universe Pro - Installation Automatique
# Version: 2.0.0

set -e

echo "🌌 Nexus Universe Pro - Installation"
echo "====================================="

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonctions
print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[i]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Vérification des prérequis
check_requirements() {
    print_info "Vérification des prérequis..."
    
    # Docker
    if command -v docker &> /dev/null; then
        print_success "Docker est installé"
    else
        print_error "Docker n'est pas installé"
        echo "Installation de Docker..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sh get-docker.sh
        rm get-docker.sh
        print_success "Docker installé"
    fi
    
    # Docker Compose
    if command -v docker-compose &> /dev/null; then
        print_success "Docker Compose est installé"
    else
        print_warning "Docker Compose n'est pas installé"
        echo "Installation de Docker Compose..."
        sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
        print_success "Docker Compose installé"
    fi
    
    # Git
    if command -v git &> /dev/null; then
        print_success "Git est installé"
    else
        print_error "Git n'est pas installé"
        exit 1
    fi
}

# Configuration
configure_environment() {
    print_info "Configuration de l'environnement..."
    
    # Créer le dossier
    mkdir -p nexus-universe
    cd nexus-universe
    
    # Télécharger les fichiers
    print_info "Téléchargement des fichiers..."
    
    # Créer la structure
    mkdir -p backend frontend telegram-bot nginx
    
    # Télécharger docker-compose.yml
    curl -sSL https://raw.githubusercontent.com/nexus-universe/pro/main/docker-compose.yml -o docker-compose.yml
    
    # Télécharger .env.example
    curl -sSL https://raw.githubusercontent.com/nexus-universe/pro/main/.env.example -o .env
    
    # Configuration interactive
    if [ -t 0 ]; then
        echo ""
        print_info "Configuration interactive"
        echo "------------------------"
        
        read -p "Domaine principal (ex: nexus.example.com): " DOMAIN
        read -p "Email admin (pour SSL): " EMAIL
        read -p "Token du bot Telegram (@BotFather): " TELEGRAM_TOKEN
        read -p "Clé API OpenAI (optionnel): " OPENAI_KEY
        
        # Mettre à jour le .env
        if [ -n "$DOMAIN" ]; then
            sed -i "s|APP_URL=.*|APP_URL=https://$DOMAIN|" .env
            sed -i "s|DOMAIN=.*|DOMAIN=$DOMAIN|" .env
        fi
        
        if [ -n "$EMAIL" ]; then
            sed -i "s|ADMIN_EMAIL=.*|ADMIN_EMAIL=$EMAIL|" .env
        fi
        
        if [ -n "$TELEGRAM_TOKEN" ]; then
            sed -i "s|TELEGRAM_BOT_TOKEN=.*|TELEGRAM_BOT_TOKEN=$TELEGRAM_TOKEN|" .env
        fi
        
        if [ -n "$OPENAI_KEY" ]; then
            sed -i "s|OPENAI_API_KEY=.*|OPENAI_API_KEY=$OPENAI_KEY|" .env
        fi
        
        # Générer des clés JWT sécurisées
        JWT_SECRET=$(openssl rand -hex 64)
        sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env
        
        REFRESH_SECRET=$(openssl rand -hex 64)
        sed -i "s|JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$REFRESH_SECRET|" .env
        
        # Générer un mot de passe admin
        ADMIN_PASS=$(openssl rand -hex 12)
        sed -i "s|ADMIN_PASSWORD=.*|ADMIN_PASSWORD=$ADMIN_PASS|" .env
        
        print_success "Configuration terminée"
        echo ""
        print_info "Identifiants admin générés:"
        echo "Email: admin@$DOMAIN"
        echo "Mot de passe: $ADMIN_PASS"
        echo ""
        print_warning "Notez ces identifiants !"
    fi
}

# Installation
install_services() {
    print_info "Installation des services..."
    
    # Démarrer les services
    docker-compose up -d --build
    
    # Attendre que les services démarrent
    print_info "Attente du démarrage des services..."
    sleep 30
    
    # Vérifier l'état
    if docker-compose ps | grep -q "Up"; then
        print_success "Services démarrés avec succès"
    else
        print_error "Erreur lors du démarrage des services"
        docker-compose logs
        exit 1
    fi
}

# Initialisation
initialize_database() {
    print_info "Initialisation de la base de données..."
    
    # Attendre que PostgreSQL soit prêt
    until docker-compose exec postgres pg_isready -U nexus; do
        sleep 5
    done
    
    # Exécuter les migrations
    docker-compose exec backend npm run migrate
    
    # Créer l'utilisateur admin
    docker-compose exec backend node scripts/create-admin.js
    
    print_success "Base de données initialisée"
}

# Configuration SSL
configure_ssl() {
    print_info "Configuration SSL..."
    
    # Vérifier si un domaine est configuré
    if grep -q "DOMAIN=" .env && [ -n "$(grep "DOMAIN=" .env | cut -d= -f2)" ]; then
        DOMAIN=$(grep "DOMAIN=" .env | cut -d= -f2)
        
        print_info "Configuration SSL pour $DOMAIN"
        
        # Arrêter temporairement nginx
        docker-compose stop nginx
        
        # Obtenir un certificat SSL
        docker run -it --rm \
            -v "$(pwd)/nginx/certs:/etc/letsencrypt" \
            -v "$(pwd)/nginx/letsencrypt:/var/lib/letsencrypt" \
            certbot/certbot certonly \
            --standalone \
            --email "$(grep "ADMIN_EMAIL=" .env | cut -d= -f2)" \
            --domain "$DOMAIN" \
            --agree-tos \
            --non-interactive
        
        # Redémarrer nginx avec SSL
        docker-compose up -d nginx
        
        print_success "SSL configuré pour https://$DOMAIN"
    else
        print_warning "SSL non configuré (domaine non spécifié)"
    fi
}

# Vérification finale
final_check() {
    print_info "Vérification finale..."
    
    # Vérifier les services
    SERVICES_UP=$(docker-compose ps | grep -c "Up")
    if [ "$SERVICES_UP" -ge 4 ]; then
        print_success "Tous les services sont en ligne"
    else
        print_warning "Certains services ne sont pas en ligne"
    fi
    
    # Vérifier l'API
    if curl -s http://localhost:3001/health | grep -q "healthy"; then
        print_success "API fonctionnelle"
    else
        print_error "API non accessible"
    fi
    
    # Vérifier le frontend
    if curl -s http://localhost:3000 | grep -q "Nexus"; then
        print_success "Frontend fonctionnel"
    else
        print_error "Frontend non accessible"
    fi
    
    # Afficher les informations
    echo ""
    echo "====================================="
    print_success "INSTALLATION TERMINÉE AVEC SUCCÈS"
    echo "====================================="
    echo ""
    
    # Informations d'accès
    if grep -q "DOMAIN=" .env && [ -n "$(grep "DOMAIN=" .env | cut -d= -f2)" ]; then
        DOMAIN=$(grep "DOMAIN=" .env | cut -d= -f2)
        echo "🌐 Frontend:      https://$DOMAIN"
        echo "🔧 API:           https://$DOMAIN/api"
        echo "📚 Documentation: https://$DOMAIN/docs"
    else
        echo "🌐 Frontend:      http://localhost:3000"
        echo "🔧 API:           http://localhost:3001"
        echo "📚 Documentation: http://localhost:3000/docs"
    fi
    
    echo ""
    echo "🤖 Bot Telegram:"
    echo "   Cherchez @NexusUniverseBot sur Telegram"
    echo "   Utilisez /start pour commencer"
    echo ""
    
    echo "🔑 Identifiants admin:"
    echo "   Email: admin@$(grep "DOMAIN=" .env | cut -d= -f2 2>/dev/null || echo "localhost")"
    echo "   Mot de passe: $(grep "ADMIN_PASSWORD=" .env | cut -d= -f2)"
    echo ""
    
    echo "🛠️ Commandes utiles:"
    echo "   docker-compose logs -f      # Voir les logs"
    echo "   docker-compose restart      # Redémarrer"
    echo "   docker-compose down         # Arrêter"
    echo "   docker-compose exec backend npm run <commande>"
    echo ""
    
    echo "📊 Prochaines étapes:"
    echo "   1. Accédez au dashboard"
    echo "   2. Configurez votre profil"
    echo "   3. Invitez vos premiers utilisateurs"
    echo "   4. Intégrez l'API dans vos applications"
    echo ""
    
    print_warning "IMPORTANT: Changez le mot de passe admin après la première connexion !"
}

# Fonction principale
main() {
    echo ""
    print_info "Démarrage de l'installation de Nexus Universe Pro"
    echo ""
    
    check_requirements
    configure_environment
    install_services
    initialize_database
    configure_ssl
    final_check
}

# Exécution
main "$@"
