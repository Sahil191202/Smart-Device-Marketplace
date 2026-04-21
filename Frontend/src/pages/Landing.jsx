import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Zap, Shield, TrendingDown, Star,
  ChevronRight, Sparkles, Package, Users, ShoppingBag,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { productsApi } from '../api/products.api';
import { CATEGORIES } from '../utils/constants';
import { formatPrice } from '../utils/format';
import { Button } from '../components/ui/Button';

// ── Animated counter hook ─────────────────────────────────────────────────────
const useCounter = (end, duration = 2000, start = 0) => {
  const [count, setCount] = useState(start);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    let startTime = null;
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * (end - start) + start));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, end, start, duration]);

  return { count, ref };
};

// ── Stat card ─────────────────────────────────────────────────────────────────
const StatCard = ({ end, suffix = '', label, icon: Icon, color }) => {
  const { count, ref } = useCounter(end);
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="card p-6 text-center group hover:shadow-lg transition-all duration-300"
    >
      <div className={`w-12 h-12 rounded-2xl ${color} flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
        {count.toLocaleString('en-IN')}{suffix}
      </div>
      <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
    </motion.div>
  );
};

// ── Product card (mini) ───────────────────────────────────────────────────────
const FeaturedProductCard = ({ product, index }) => {
  const navigate = useNavigate();
  const primaryImage = product.images?.find(i => i.isPrimary)?.url || product.images?.[0]?.url;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ y: -4 }}
      onClick={() => navigate(`/products/${product.slug}`)}
      className="card p-4 cursor-pointer group hover:shadow-xl hover:shadow-primary-600/10 transition-all duration-300"
    >
      {/* Image */}
      <div className="relative overflow-hidden rounded-xl bg-slate-50 dark:bg-slate-800/50 mb-4 aspect-square">
        {primaryImage ? (
          <img
            src={primaryImage}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-12 h-12 text-slate-300" />
          </div>
        )}
        {/* Condition badge */}
        <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-medium
          ${product.condition === 'new' ? 'bg-green-100 text-green-700' :
            product.condition === 'like-new' ? 'bg-blue-100 text-blue-700' :
            'bg-yellow-100 text-yellow-700'}`}
        >
          {product.condition}
        </span>
      </div>

      {/* Info */}
      <div className="space-y-1">
        <p className="text-xs text-slate-500 dark:text-slate-400">{product.brand}</p>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-2 leading-snug">
          {product.title}
        </h3>
        <div className="flex items-center justify-between pt-2">
          <span className="text-base font-bold text-primary-600">
            {formatPrice(product.price)}
          </span>
          {product.predictedPrice?.value && (
            <span className="text-xs text-slate-400 line-through">
              {formatPrice(product.predictedPrice.value)}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ── Main Landing page ─────────────────────────────────────────────────────────
export default function Landing() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState(null);

  const { data: featuredData } = useQuery({
    queryKey: ['products', 'featured'],
    queryFn: () => productsApi.list({ limit: 8, sort: 'most_viewed' }),
    staleTime: 1000 * 60 * 10,
  });

  const featured = featuredData?.data?.data?.products || [];

  return (
    <div className="min-h-screen">

      {/* ── Hero Section ──────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden gradient-hero pt-32 pb-20">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-primary-600/5 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full bg-blue-400/5 blur-3xl" />
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]"
            style={{
              backgroundImage: 'radial-gradient(circle, #2563eb 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />
        </div>

        <div className="container-page relative">
          <div className="max-w-4xl mx-auto text-center">

            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800/30 text-primary-700 dark:text-primary-400 text-sm font-medium mb-8"
            >
              <Sparkles className="w-4 h-4" />
              AI-Powered Price Analysis on Every Listing
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-5xl sm:text-6xl lg:text-7xl font-bold text-slate-900 dark:text-white leading-tight mb-6"
            >
              Buy & Sell{' '}
              <span className="gradient-text">Smart Devices</span>
              <br />
              with Confidence
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xl text-slate-600 dark:text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed"
            >
              India's first AI-powered marketplace for pre-owned electronics.
              Get fair price predictions, real-time alerts, and secure transactions.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Button
                size="xl"
                onClick={() => navigate('/marketplace')}
                icon={ArrowRight}
                iconPosition="right"
                className="shadow-xl shadow-primary-600/25 hover:shadow-2xl hover:shadow-primary-600/30 transition-all"
              >
                Browse Marketplace
              </Button>
              <Button
                size="xl"
                variant="outline"
                onClick={() => navigate('/register')}
              >
                Start Selling Free
              </Button>
            </motion.div>

            {/* Trust indicators */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex items-center justify-center gap-6 mt-12 text-sm text-slate-500 dark:text-slate-400"
            >
              {[
                { icon: Shield, text: 'Secure Payments' },
                { icon: Zap, text: 'AI Price Check' },
                { icon: Star, text: 'Verified Sellers' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-primary-500" />
                  <span>{text}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Hero visual — floating product cards */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="relative max-w-5xl mx-auto mt-20"
          >
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-700/50">
              {/* Browser chrome mockup */}
              <div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 mx-4 bg-white dark:bg-slate-700 rounded-md px-3 py-1 text-xs text-slate-500 dark:text-slate-400">
                  smartmarket.in/marketplace
                </div>
              </div>
              {/* Gradient preview instead of screenshot */}
              <div className="h-72 bg-gradient-to-br from-slate-50 to-primary-50 dark:from-dark-900 dark:to-dark-800 flex items-center justify-center">
                <div className="grid grid-cols-4 gap-4 p-6 w-full max-w-2xl">
                  {[...Array(4)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.6 + i * 0.1 }}
                      className="card p-3 text-center"
                    >
                      <div className="w-full aspect-square rounded-lg bg-gradient-to-br from-primary-100 to-blue-100 dark:from-primary-900/20 dark:to-blue-900/20 mb-2" />
                      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mx-auto mb-1" />
                      <div className="h-2 bg-primary-200 dark:bg-primary-800/50 rounded w-1/2 mx-auto" />
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            {/* Floating AI badge */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 }}
              className="absolute -right-4 top-1/2 -translate-y-1/2 card p-4 shadow-xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">AI Says</p>
                  <p className="text-sm font-bold text-green-600">Great Deal!</p>
                  <p className="text-xs text-slate-500">15% below market</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Stats Section ──────────────────────────────────────────────────── */}
      <section className="py-20 bg-white dark:bg-dark-900">
        <div className="container-page">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard end={15000} suffix="+" label="Active Listings" icon={Package} color="bg-primary-600" />
            <StatCard end={8500} suffix="+" label="Happy Buyers" icon={Users} color="bg-green-500" />
            <StatCard end={3200} suffix="+" label="Successful Sales" icon={ShoppingBag} color="bg-purple-500" />
            <StatCard end={98} suffix="%" label="Satisfaction Rate" icon={Star} color="bg-orange-500" />
          </div>
        </div>
      </section>

      {/* ── Categories Section ─────────────────────────────────────────────── */}
      <section className="py-20 bg-slate-50 dark:bg-dark-900/50">
        <div className="container-page">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
              Browse by Category
            </h2>
            <p className="text-slate-500 dark:text-slate-400">
              Find exactly what you're looking for
            </p>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {CATEGORIES.map((cat, i) => (
              <motion.div
                key={cat.value}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -4 }}
                onClick={() => navigate(`/marketplace?category=${cat.value}`)}
                onHoverStart={() => setActiveCategory(cat.value)}
                onHoverEnd={() => setActiveCategory(null)}
                className="card p-5 text-center cursor-pointer hover:shadow-lg hover:border-primary-200 dark:hover:border-primary-700 transition-all duration-300 group"
              >
                <motion.div
                  animate={{ scale: activeCategory === cat.value ? 1.2 : 1 }}
                  className="text-4xl mb-3"
                >
                  {cat.icon}
                </motion.div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover:text-primary-600 transition-colors">
                  {cat.label}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured Products ──────────────────────────────────────────────── */}
      {featured.length > 0 && (
        <section className="py-20 bg-white dark:bg-dark-900">
          <div className="container-page">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex items-center justify-between mb-12"
            >
              <div>
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                  Featured Listings
                </h2>
                <p className="text-slate-500 dark:text-slate-400">
                  Hand-picked deals with AI price verification
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => navigate('/marketplace')}
                icon={ChevronRight}
                iconPosition="right"
              >
                View All
              </Button>
            </motion.div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
              {featured.map((product, i) => (
                <FeaturedProductCard key={product._id} product={product} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── How It Works ───────────────────────────────────────────────────── */}
      <section className="py-20 bg-slate-50 dark:bg-dark-900/50">
        <div className="container-page">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
              How It Works
            </h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
              Buy or sell in minutes with our streamlined process
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-16">
            {/* For Buyers */}
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-8 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-600 flex items-center justify-center text-sm font-bold">B</span>
                For Buyers
              </h3>
              <div className="space-y-6">
                {[
                  { step: '01', title: 'Browse Listings', desc: 'Search by category, brand, or use AI-powered search to find what you need.' },
                  { step: '02', title: 'Check AI Price', desc: 'Every listing shows an AI-generated fair price badge so you never overpay.' },
                  { step: '03', title: 'Secure Payment', desc: 'Pay securely via Razorpay. Your money is protected until delivery confirmed.' },
                ].map((item, i) => (
                  <motion.div
                    key={item.step}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex gap-5"
                  >
                    <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-primary-600 text-white flex items-center justify-center font-bold text-sm shadow-lg shadow-primary-600/20">
                      {item.step}
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-white mb-1">{item.title}</h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* For Sellers */}
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-8 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 flex items-center justify-center text-sm font-bold">S</span>
                For Sellers
              </h3>
              <div className="space-y-6">
                {[
                  { step: '01', title: 'Create Listing', desc: 'Upload photos, add description and let our AI suggest the optimal price point.' },
                  { step: '02', title: 'Get Discovered', desc: 'Listings are indexed instantly. Buyers searching for your device will find it.' },
                  { step: '03', title: 'Ship & Get Paid', desc: 'Accept the order, ship to buyer, and receive payment directly to your account.' },
                ].map((item, i) => (
                  <motion.div
                    key={item.step}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex gap-5"
                  >
                    <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-green-500 text-white flex items-center justify-center font-bold text-sm shadow-lg shadow-green-500/20">
                      {item.step}
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-white mb-1">{item.title}</h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Section ────────────────────────────────────────────────────── */}
      <section className="py-24 bg-white dark:bg-dark-900">
        <div className="container-page">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-3xl gradient-primary p-12 text-center text-white"
          >
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/5" />
              <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-white/5" />
            </div>

            <div className="relative">
              <h2 className="text-4xl font-bold mb-4">
                Ready to Get Started?
              </h2>
              <p className="text-blue-100 text-lg mb-8 max-w-xl mx-auto">
                Join thousands of buyers and sellers on India's smartest device marketplace.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button
                  size="lg"
                  onClick={() => navigate('/register')}
                  className="bg-white !text-primary-600 hover:bg-blue-50 shadow-xl"
                >
                  Create Free Account
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  onClick={() => navigate('/marketplace')}
                  className="!text-white hover:!bg-white/10"
                >
                  Browse First
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-100 dark:border-slate-800 py-12 bg-white dark:bg-dark-900">
        <div className="container-page">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-600 rounded-xl flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-slate-900 dark:text-white">
                Smart<span className="text-primary-600">Market</span>
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              © 2026 SmartMarketplace. Built with ⚡ in India.
            </p>
            <div className="flex items-center gap-6 text-sm text-slate-500 dark:text-slate-400">
              <Link to="/marketplace" className="hover:text-primary-600 transition-colors">Browse</Link>
              <Link to="/register" className="hover:text-primary-600 transition-colors">Sell</Link>
              <Link to="/login" className="hover:text-primary-600 transition-colors">Sign In</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}