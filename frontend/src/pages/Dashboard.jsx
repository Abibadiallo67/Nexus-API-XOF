import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { motion } from 'framer-motion';
import {
  Users, CreditCard, Globe, TrendingUp,
  Shield, Send, UserPlus, Activity
} from 'lucide-react';

const Dashboard = ({ user }) => {
  const [stats, setStats] = useState({});
  const [recentActivity, setRecentActivity] = useState([]);
  const [teamData, setTeamData] = useState([]);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000); // Actualiser toutes les 30s
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      const [statsRes, activityRes, teamRes, txRes] = await Promise.all([
        fetch(`${process.env.REACT_APP_API_URL}/api/dashboard/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${process.env.REACT_APP_API_URL}/api/dashboard/activity`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${process.env.REACT_APP_API_URL}/api/affiliate/team`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${process.env.REACT_APP_API_URL}/api/transactions/recent?limit=5`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setStats(await statsRes.json());
      setRecentActivity(await activityRes.json());
      setTeamData(await teamRes.json());
      setTransactions(await txRes.json());
      
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    }
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white">
      {/* Header */}
      <header className="p-6 border-b border-gray-800">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
              Nexus Universe Pro
            </h1>
            <p className="text-gray-400">SSO & Système d'affiliation ultime</p>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="font-semibold">@{user?.username}</p>
              <p className="text-sm text-gray-400">{user?.role} • Niveau {user?.level}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500"></div>
          </div>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/50 backdrop-blur-lg rounded-2xl p-6 border border-gray-700"
          >
            <div className="flex items-center">
              <div className="p-3 bg-cyan-500/20 rounded-xl mr-4">
                <CreditCard className="w-8 h-8 text-cyan-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Crédit disponible</p>
                <p className="text-2xl font-bold">{user?.credit_balance || '0.00'} NEX</p>
                <p className="text-green-400 text-sm">+12.5% ce mois</p>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gray-800/50 backdrop-blur-lg rounded-2xl p-6 border border-gray-700"
          >
            <div className="flex items-center">
              <div className="p-3 bg-purple-500/20 rounded-xl mr-4">
                <Users className="w-8 h-8 text-purple-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Équipe</p>
                <p className="text-2xl font-bold">{stats.teamCount || '0'} membres</p>
                <p className="text-green-400 text-sm">+5 nouveaux</p>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gray-800/50 backdrop-blur-lg rounded-2xl p-6 border border-gray-700"
          >
            <div className="flex items-center">
              <div className="p-3 bg-green-500/20 rounded-xl mr-4">
                <TrendingUp className="w-8 h-8 text-green-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Commission</p>
                <p className="text-2xl font-bold">{stats.totalCommission || '0.00'} NEX</p>
                <p className="text-green-400 text-sm">Ce mois</p>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gray-800/50 backdrop-blur-lg rounded-2xl p-6 border border-gray-700"
          >
            <div className="flex items-center">
              <div className="p-3 bg-yellow-500/20 rounded-xl mr-4">
                <Globe className="w-8 h-8 text-yellow-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Zone d'influence</p>
                <p className="text-2xl font-bold">{stats.countries || '0'} pays</p>
                <p className="text-cyan-400 text-sm">{user?.city}, {user?.country}</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Charts & Data */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Graphique d'activité */}
          <div className="bg-gray-800/50 backdrop-blur-lg rounded-2xl p-6 border border-gray-700">
            <h3 className="text-xl font-bold mb-4">📈 Activité des transactions</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.transactionData || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis dataKey="date" stroke="#888" />
                  <YAxis stroke="#888" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', borderColor: '#4b5563' }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="credit" 
                    stroke="#00ffff" 
                    strokeWidth={2}
                    name="Crédit"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="crypto" 
                    stroke="#ff00ff" 
                    strokeWidth={2}
                    name="Crypto"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Distribution géographique */}
          <div className="bg-gray-800/50 backdrop-blur-lg rounded-2xl p-6 border border-gray-700">
            <h3 className="text-xl font-bold mb-4">🌍 Répartition géographique</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.geoDistribution || []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomizedLabel}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {stats.geoDistribution?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', borderColor: '#4b5563' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Transactions récentes */}
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-2xl p-6 border border-gray-700 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold">💸 Transactions récentes</h3>
            <button className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-lg hover:opacity-90">
              Voir toutes
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4">Date</th>
                  <th className="text-left py-3 px-4">De/À</th>
                  <th className="text-left py-3 px-4">Type</th>
                  <th className="text-left py-3 px-4">Montant</th>
                  <th className="text-left py-3 px-4">Statut</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-3 px-4">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 mr-2"></div>
                        <div>
                          <p className="font-medium">
                            {tx.from_user_id === user.id ? tx.to_username : tx.from_username}
                          </p>
                          <p className="text-sm text-gray-400">
                            {tx.from_user_id === user.id ? 'Sortant' : 'Entrant'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-700">
                        {tx.type}
                      </span>
                    </td>
                    <td className={`py-3 px-4 font-bold ${
                      tx.from_user_id === user.id ? 'text-red-400' : 'text-green-400'
                    }`}>
                      {tx.from_user_id === user.id ? '-' : '+'}{tx.amount} {tx.currency}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        tx.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                        tx.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button className="p-4 bg-gradient-to-r from-cyan-500/20 to-cyan-500/5 rounded-xl border border-cyan-500/30 hover:border-cyan-500 transition-all">
            <Send className="w-6 h-6 text-cyan-400 mb-2 mx-auto" />
            <p className="font-medium">Envoyer</p>
          </button>
          
          <button className="p-4 bg-gradient-to-r from-purple-500/20 to-purple-500/5 rounded-xl border border-purple-500/30 hover:border-purple-500 transition-all">
            <UserPlus className="w-6 h-6 text-purple-400 mb-2 mx-auto" />
            <p className="font-medium">Inviter</p>
          </button>
          
          <button className="p-4 bg-gradient-to-r from-green-500/20 to-green-500/5 rounded-xl border border-green-500/30 hover:border-green-500 transition-all">
            <Activity className="w-6 h-6 text-green-400 mb-2 mx-auto" />
            <p className="font-medium">Statistiques</p>
          </button>
          
          <button className="p-4 bg-gradient-to-r from-yellow-500/20 to-yellow-500/5 rounded-xl border border-yellow-500/30 hover:border-yellow-500 transition-all">
            <Shield className="w-6 h-6 text-yellow-400 mb-2 mx-auto" />
            <p className="font-medium">Sécurité</p>
          </button>
        </div>
      </div>
    </div>
  );
};

// Composant pour les labels du pie chart
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
  const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));

  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default Dashboard;
