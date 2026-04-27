import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users, Package, ShoppingBag, TrendingUp,
  Server, AlertCircle, CheckCircle, Activity,
  BarChart3, DollarSign, Eye, Cpu,
  ArrowUpRight, ArrowDownRight, RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';

import { adminApi } from '../../api/admin.api';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { formatPrice, formatNumber } from '../../utils/format';

// ── Custom tooltip for charts ─────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label, prefix = '' }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card p-3 shadow-xl border border-slate-100 dark:border-slate-700">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-sm">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-700 dark:text-slate-200 font-medium">
            {prefix}{typeof entry.value === 'number' && prefix === '₹'
              ? formatPrice(entry.value)
              : entry.value.toLocaleString('en-IN')
            }
          </span>
        </div>
      ))}
    </div>
  );
};

// ── Stat card ─────────────────────────────────────────────────────────────────
const AdminStatCard = ({ icon: Icon, label, value, sub, color, trend, delay, onClick }) => (
  <motion.div
    initial={{ opacity: 0, y: 15 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    whileHover={{ y: -2 }}
    onClick={onClick}
    className={`card p-5 ${onClick ? 'cursor-pointer hover:shadow-lg transition-all' : ''}`}
  >
    <div className="flex items-start justify-between mb-3">
      <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center shadow-sm`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 text-xs font-semibold ${
          trend >= 0 ? 'text-green-600' : 'text-red-500'
        }`}>
          {trend >= 0
            ? <ArrowUpRight className="w-3.5 h-3.5" />
            : <ArrowDownRight className="w-3.5 h-3.5" />
          }
          {Math.abs(trend)}%
        </div>
      )}
    </div>
    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</p>
    <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
    {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
  </motion.div>
);

// ── System metrics panel ──────────────────────────────────────────────────────
const MetricsPanel = ({ metrics }) => {
  if (!metrics) return null;

  const queueTotal = Object.values(metrics.queues || {}).reduce(
    (sum, q) => sum + (q.waiting || 0) + (q.active || 0), 0
  );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {[
        {
          label: 'Heap Used',
          value: `${metrics.memory?.process?.heapUsed || 0} MB`,
          icon: Cpu,
          color: 'bg-blue-500',
        },
        {
          label: 'CPU Load',
          value: `${metrics.cpu?.load1 || 0}`,
          icon: Activity,
          color: 'bg-purple-500',
        },
        {
          label: 'Uptime',
          value: `${Math.floor((metrics.system?.uptime || 0) / 3600)}h`,
          icon: Server,
          color: 'bg-green-500',
        },
        {
          label: 'Queue Jobs',
          value: queueTotal,
          icon: BarChart3,
          color: 'bg-orange-500',
        },
      ].map((item, i) => (
        <div key={item.label} className="card p-4 flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl ${item.color} flex items-center justify-center flex-shrink-0`}>
            <item.icon className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{item.label}</p>
            <p className="text-base font-bold text-slate-900 dark:text-white">{item.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Queue health ──────────────────────────────────────────────────────────────
const QueueHealth = ({ queues }) => {
  if (!queues) return null;

  const STATUS_COLOR = {
    0: 'bg-green-500',
    low: 'bg-yellow-500',
    high: 'bg-red-500',
  };

  return (
    <div className="card p-5">
      <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
        <Activity className="w-4 h-4 text-primary-600" />
        Queue Health
      </h3>
      <div className="space-y-3">
        {Object.entries(queues).map(([name, stats]) => {
          const failed = stats.failed || 0;
          const waiting = stats.waiting || 0;
          const status = failed > 5 ? 'high' : waiting > 20 ? 'low' : 0;

          return (
            <div key={name} className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${STATUS_COLOR[status]} flex-shrink-0`} />
              <span className="text-sm text-slate-700 dark:text-slate-200 flex-1 capitalize">
                {name.replace(/-/g, ' ')}
              </span>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span title="Waiting">{waiting} waiting</span>
                <span title="Active" className="text-blue-500">{stats.active || 0} active</span>
                {failed > 0 && (
                  <span title="Failed" className="text-red-500">{failed} failed</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Category donut chart ──────────────────────────────────────────────────────
const CHART_COLORS = [
  '#2563eb', '#16a34a', '#9333ea', '#ea580c',
  '#0891b2', '#dc2626', '#65a30d', '#d97706',
  '#7c3aed', '#0d9488',
];

const CategoryDonut = ({ data }) => {
  if (!data?.length) return null;

  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="card p-5">
      <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
        <Package className="w-4 h-4 text-primary-600" />
        Products by Category
      </h3>
      <div className="flex items-center gap-4">
        <ResponsiveContainer width={140} height={140}>
          <PieChart>
            <Pie
              data={data.slice(0, 8)}
              cx="50%"
              cy="50%"
              innerRadius={42}
              outerRadius={65}
              dataKey="count"
              strokeWidth={2}
              stroke="transparent"
            >
              {data.slice(0, 8).map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const item = payload[0];
                return (
                  <div className="card p-2 text-xs shadow-lg">
                    <p className="font-medium capitalize">{item.name}</p>
                    <p className="text-slate-500">{item.value} products</p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="flex-1 space-y-1.5">
          {data.slice(0, 6).map((item, i) => (
            <div key={item._id} className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
              />
              <span className="text-xs text-slate-600 dark:text-slate-400 flex-1 capitalize truncate">
                {item._id}
              </span>
              <span className="text-xs font-semibold text-slate-900 dark:text-white">
                {Math.round((item.count / total) * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Revenue area chart ────────────────────────────────────────────────────────
const RevenueChart = ({ data, period, onPeriodChange }) => {
  const PERIODS = ['7d', '30d', '90d', '1y'];

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary-600" />
          Revenue Overview
        </h3>
        <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => onPeriodChange(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                period === p
                  ? 'bg-white dark:bg-dark-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {!data?.length ? (
        <div className="h-48 flex items-center justify-center">
          <p className="text-slate-400 text-sm">No revenue data for this period</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.1)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => {
                const d = new Date(v);
                return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
              }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
              width={50}
            />
            <Tooltip content={<ChartTooltip prefix="₹" />} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#2563eb"
              strokeWidth={2.5}
              fill="url(#revenueGrad)"
              dot={false}
              activeDot={{ r: 5, fill: '#2563eb' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

// ── Order status bar chart ────────────────────────────────────────────────────
const OrderStatusChart = ({ data }) => {
  if (!data?.byStatus?.length) return null;

  const STATUS_COLORS_MAP = {
    confirmed: '#2563eb',
    shipped: '#9333ea',
    delivered: '#16a34a',
    cancelled: '#ef4444',
    pending: '#f59e0b',
    refunded: '#64748b',
  };

  const chartData = data.byStatus.map((s) => ({
    name: s._id,
    count: s.count,
    value: s.totalValue,
    fill: STATUS_COLORS_MAP[s._id] || '#64748b',
  }));

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-primary-600" />
          Orders by Status
        </h3>
        <div className="text-right">
          <p className="text-xs text-slate-500">Cancellation rate</p>
          <p className={`text-sm font-bold ${
            data.cancellationRate > 15 ? 'text-red-500' : 'text-green-600'
          }`}>
            {data.cancellationRate}%
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.1)" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="card p-3 shadow-xl text-xs">
                  <p className="font-semibold capitalize mb-1">{d.name}</p>
                  <p className="text-slate-500">{d.count} orders</p>
                  <p className="text-primary-600 font-medium">{formatPrice(d.value)}</p>
                </div>
              );
            }}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ── Main Admin Dashboard ──────────────────────────────────────────────────────
export default function AdminDashboard() {
  const navigate = useNavigate();
  const [revenuePeriod, setRevenuePeriod] = useState('30d');

  // Dashboard snapshot
  const { data: dashData, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: adminApi.getDashboard,
    staleTime: 1000 * 60 * 5,
  });

  // Revenue with period
  const { data: revenueData } = useQuery({
    queryKey: ['admin', 'revenue', revenuePeriod],
    queryFn: () => adminApi.getRevenue({ period: revenuePeriod }),
    staleTime: 1000 * 60 * 5,
  });

  // System metrics
  const { data: metricsData, refetch: refetchMetrics } = useQuery({
    queryKey: ['admin', 'metrics'],
    queryFn: adminApi.getMetrics,
    refetchInterval: 60000, // refresh every minute
  });

  const dash = dashData?.data?.data;
  const revenue = revenueData?.data?.data;
  const metrics = metricsData?.data?.data;

  const isLoadingFull = isLoading;

  return (
    <PageWrapper>
      <div className="container-page py-8 pb-20">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-7 h-7 text-primary-600" />
              Admin Dashboard
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Platform overview and management
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              onClick={() => { refetch(); refetchMetrics(); }}
            >
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => navigate('/admin/users')}
              icon={Users}
            >
              Manage Users
            </Button>
          </div>
        </motion.div>

        {isLoadingFull ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="shimmer h-28 rounded-2xl" />
              ))}
            </div>
            <div className="shimmer h-64 rounded-2xl" />
          </div>
        ) : (
          <div className="space-y-6">

            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <AdminStatCard
                icon={DollarSign}
                label="Revenue (30d)"
                value={formatPrice(dash?.revenue?.summary?.totalRevenue || 0)}
                sub={`${dash?.revenue?.summary?.orderCount || 0} orders`}
                color="bg-primary-600"
                trend={12}
                delay={0}
              />
              <AdminStatCard
                icon={Users}
                label="Total Users"
                value={formatNumber(dash?.users?.total || 0)}
                sub={`${dash?.users?.newThisPeriod || 0} new this month`}
                color="bg-green-500"
                trend={8}
                delay={0.05}
                onClick={() => navigate('/admin/users')}
              />
              <AdminStatCard
                icon={Package}
                label="Active Listings"
                value={formatNumber(
                  dash?.products?.byStatus?.find((s) => s._id === 'active')?.count || 0
                )}
                sub="across all categories"
                color="bg-purple-500"
                delay={0.1}
              />
              <AdminStatCard
                icon={ShoppingBag}
                label="Orders (30d)"
                value={formatNumber(dash?.orders?.total || 0)}
                sub={`${dash?.orders?.cancellationRate || 0}% cancellation`}
                color="bg-orange-500"
                trend={-2}
                delay={0.15}
                onClick={() => navigate('/admin/orders')}
              />
            </div>

            {/* Charts row */}
            <div className="grid lg:grid-cols-2 gap-6">
              <RevenueChart
                data={revenue?.timeseries || dash?.revenue?.timeseries}
                period={revenuePeriod}
                onPeriodChange={setRevenuePeriod}
              />
              <OrderStatusChart data={dash?.orders} />
            </div>

            {/* Category + system metrics */}
            <div className="grid lg:grid-cols-3 gap-6">
              <CategoryDonut data={dash?.products?.byCategory} />
              <div className="lg:col-span-2">
                <QueueHealth queues={metrics?.queues} />
              </div>
            </div>

            {/* System metrics */}
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Server className="w-4 h-4 text-slate-400" />
                System Health
              </h2>
              <MetricsPanel metrics={metrics} />
            </div>

            {/* Top sellers */}
            {dash?.users?.topSellers?.length > 0 && (
              <div className="card p-5">
                <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary-600" />
                  Top Sellers
                </h3>
                <div className="space-y-3">
                  {dash.users.topSellers.slice(0, 5).map((seller, i) => (
                    <div key={seller._id} className="flex items-center gap-3">
                      <span className="w-6 text-sm font-bold text-slate-400">
                        #{i + 1}
                      </span>
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {seller.seller?.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {seller.seller?.name}
                        </p>
                        <p className="text-xs text-slate-500">{seller.orderCount} orders</p>
                      </div>
                      <span className="text-sm font-bold text-primary-600">
                        {formatPrice(seller.totalRevenue)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </PageWrapper>
  );
}