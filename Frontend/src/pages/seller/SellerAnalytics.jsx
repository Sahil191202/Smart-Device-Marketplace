import { motion } from 'framer-motion';
import {
  TrendingUp, Eye, ShoppingBag, DollarSign,
  Package, BarChart3, ArrowUpRight,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';

import { productsApi } from '../../api/products.api';
import { ordersApi } from '../../api/orders.api';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { formatPrice } from '../../utils/format';

// ── Stat card ─────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, color, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 15 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="card p-5"
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">{label}</p>
        <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      </div>
      <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
  </motion.div>
);

export default function SellerAnalytics() {
  const { data: listingsData } = useQuery({
    queryKey: ['seller', 'listings', 'all'],
    queryFn: () => productsApi.getMyListings({ limit: 100 }),
  });

  const { data: ordersData } = useQuery({
    queryKey: ['seller', 'orders', 'all'],
    queryFn: () => ordersApi.getSellerOrders({ limit: 100 }),
  });

  const listings = listingsData?.data?.data?.products || [];
  const orders = ordersData?.data?.data?.orders || [];

  // Derived stats
  const totalRevenue = orders
    .filter((o) => ['confirmed', 'shipped', 'delivered'].includes(o.status))
    .reduce((sum, o) => sum + o.amount, 0);

  const totalViews = listings.reduce((sum, p) => sum + (p.views || 0), 0);
  const soldCount = listings.filter((p) => p.status === 'sold').length;
  const activeCount = listings.filter((p) => p.status === 'active').length;

  // Top performing (by views)
  const topByViews = [...listings]
    .sort((a, b) => (b.views || 0) - (a.views || 0))
    .slice(0, 5);

  // Views per category
  const viewsByCategory = listings.reduce((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + (p.views || 0);
    return acc;
  }, {});

  const categoryChartData = Object.entries(viewsByCategory)
    .map(([name, views]) => ({ name, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 6);

  const COLORS = ['#2563eb', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#dc2626'];

  return (
    <PageWrapper>
      <div className="container-page py-8 pb-20">

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Seller Analytics
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Performance overview for your listings
          </p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={DollarSign} label="Total Revenue" value={formatPrice(totalRevenue)} color="bg-primary-600" delay={0} />
          <StatCard icon={Eye} label="Total Views" value={totalViews.toLocaleString('en-IN')} color="bg-blue-500" delay={0.05} />
          <StatCard icon={ShoppingBag} label="Items Sold" value={soldCount} color="bg-green-500" delay={0.1} />
          <StatCard icon={Package} label="Active Listings" value={activeCount} color="bg-purple-500" delay={0.15} />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">

          {/* Views by category */}
          {categoryChartData.length > 0 && (
            <div className="card p-5">
              <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary-600" />
                Views by Category
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={categoryChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.1)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="card p-2 text-xs shadow-lg">
                          <p className="font-medium capitalize">{payload[0].payload.name}</p>
                          <p className="text-slate-500">{payload[0].value} views</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="views" radius={[6, 6, 0, 0]}>
                    {categoryChartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top listings */}
          <div className="card p-5">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary-600" />
              Top Performing Listings
            </h3>

            {topByViews.length === 0 ? (
              <div className="text-center py-8">
                <Eye className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No data yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topByViews.map((product, i) => {
                  const maxViews = topByViews[0].views || 1;
                  const pct = Math.round(((product.views || 0) / maxViews) * 100);

                  return (
                    <div key={product._id} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-bold text-slate-400 w-4">
                            #{i + 1}
                          </span>
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                            {product.title}
                          </p>
                        </div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white flex-shrink-0 flex items-center gap-1">
                          <Eye className="w-3 h-3 text-slate-400" />
                          {product.views || 0}
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ delay: 0.3 + i * 0.1, duration: 0.6 }}
                          className="h-full rounded-full bg-primary-600"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Conversion stats */}
        <div className="card p-5 mt-6">
          <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4 text-primary-600" />
            Conversion Summary
          </h3>
          <div className="grid grid-cols-3 gap-4">
            {[
              {
                label: 'View to Inquiry Rate',
                value: totalViews > 0
                  ? `${((orders.length / totalViews) * 100).toFixed(1)}%`
                  : '0%',
                desc: 'Views that led to orders',
              },
              {
                label: 'Sell-through Rate',
                value: listings.length > 0
                  ? `${Math.round((soldCount / listings.length) * 100)}%`
                  : '0%',
                desc: 'Listings that sold',
              },
              {
                label: 'Avg Listing Price',
                value: listings.length > 0
                  ? formatPrice(listings.reduce((sum, p) => sum + p.price, 0) / listings.length)
                  : '₹0',
                desc: 'Across all listings',
              },
            ].map((stat) => (
              <div key={stat.label} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{stat.label}</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{stat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}