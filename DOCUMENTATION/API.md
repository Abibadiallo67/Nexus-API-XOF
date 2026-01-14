# 🌌 Nexus Universe Pro - Documentation API

## 🔑 Authentification

### Inscription
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "whatsapp": "+1234567890",
  "telegram": "@johndoe",
  "country": "France",
  "city": "Paris",
  "inviteCode": "REF123"
}
