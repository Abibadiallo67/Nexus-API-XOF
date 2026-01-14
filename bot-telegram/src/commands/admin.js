const { Composer } = require('micro-bot');
const axios = require('axios');

const admin = new Composer();

// Middleware pour vérifier les permissions admin
admin.use(async (ctx, next) => {
  try {
    const response = await axios.get(`${process.env.API_URL}/api/admin/verify`, {
      data: { telegramId: ctx.from.id }
    });
    
    if (response.data.isAdmin) {
      return next();
    } else {
      return ctx.reply('⛔ Accès administrateur requis.');
    }
  } catch (error) {
    return ctx.reply('❌ Erreur de vérification.');
  }
});

// Dashboard admin
admin.command('admin', async (ctx) => {
  try {
    const response = await axios.get(`${process.env.API_URL}/api/admin/dashboard`);
    const data = response.data;
    
    const message = `
🏢 *DASHBOARD ADMIN NEXUS*

👥 Utilisateurs: ${data.stats.totalUsers}
💰 Crédit total: ${data.stats.totalCredit} NEX
💸 Transactions: ${data.stats.todayTransactions}
🌍 Pays: ${data.stats.activeCountries}

📊 Croissance: +${data.stats.growthRate}%
🛡️ Sécurité: ${data.stats.securityScore}/100

*Alertes récentes:*
${data.alerts.slice(0, 3).map(alert => `• ${alert.message}`).join('\n')}
`;
    
    await ctx.replyWithMarkdown(message, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '👥 Gérer utilisateurs', callback_data: 'admin_users' },
            { text: '💰 Transactions', callback_data: 'admin_transactions' }
          ],
          [
            { text: '🌐 Réseau', callback_data: 'admin_network' },
            { text: '🛡️ Sécurité', callback_data: 'admin_security' }
          ],
          [
            { text: '📊 Statistiques', callback_data: 'admin_stats' },
            { text: '⚙️ Configuration', callback_data: 'admin_config' }
          ]
        ]
      }
    });
    
  } catch (error) {
    await ctx.reply('❌ Erreur lors de la récupération des données.');
  }
});

// Gérer les utilisateurs
admin.action('admin_users', async (ctx) => {
  try {
    const response = await axios.get(`${process.env.API_URL}/api/admin/users`);
    const users = response.data.users;
    
    const message = `
👥 *UTILISATEURS* (${users.length})

${users.slice(0, 10).map((user, i) => 
  `${i+1}. @${user.username} - ${user.role} - ${user.credit_balance} NEX`
).join('\n')}
`;
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          users.slice(0, 10).map(user => ({
            text: `👤 ${user.username}`,
            callback_data: `user_detail_${user.id}`
          })),
          [
            { text: '◀️ Retour', callback_data: 'admin_back' },
            { text: '🔄 Actualiser', callback_data: 'admin_users' }
          ]
        ]
      }
    });
    
  } catch (error) {
    await ctx.answerCbQuery('❌ Erreur');
  }
});

// Voir les transactions
admin.command('transactions', async (ctx) => {
  try {
    const response = await axios.get(`${process.env.API_URL}/api/admin/transactions/recent`);
    const transactions = response.data.transactions;
    
    const message = `
💸 *TRANSACTIONS RÉCENTES*

${transactions.map((tx, i) => `
${i+1}. ${tx.from_username} → ${tx.to_username}
   💰 ${tx.amount} NEX
   📍 ${tx.status} • ${new Date(tx.created_at).toLocaleDateString()}
`).join('\n')}
`;
    
    await ctx.replyWithMarkdown(message);
    
  } catch (error) {
    await ctx.reply('❌ Erreur');
  }
});

// Statistiques en temps réel
admin.command('stats', async (ctx) => {
  try {
    const response = await axios.get(`${process.env.API_URL}/api/admin/stats/realtime`);
    const stats = response.data;
    
    // Créer un graphique ASCII
    const chart = createAsciiChart(stats.hourlyTransactions);
    
    const message = `
📈 *STATISTIQUES TEMPS RÉEL*

📊 Activité dernière heure:
\`\`\`
${chart}
\`\`\`

👥 Utilisateurs en ligne: ${stats.onlineUsers}
💸 Transactions/min: ${stats.transactionsPerMinute}
🛡️ Sécurité: ${stats.securityLevel}

*Top 5 pays:*
${stats.topCountries.map(c => `• ${c.country}: ${c.users}`).join('\n')}
`;
    
    await ctx.replyWithMarkdown(message);
    
  } catch (error) {
    await ctx.reply('❌ Erreur');
  }
});

// Créer un graphique ASCII
function createAsciiChart(data) {
  const max = Math.max(...data);
  const chart = data.map(value => {
    const barLength = Math.round((value / max) * 20);
    return '█'.repeat(barLength) + '░'.repeat(20 - barLength) + ` ${value}`;
  });
  return chart.join('\n');
}

module.exports = admin;
