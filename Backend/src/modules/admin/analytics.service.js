// src/modules/admin/analytics.service.js
const mongoose = require("mongoose");
const Order = require("../orders/order.model");
const User = require("../users/user.model");
const Product = require("../products/product.model");
const { getRedisClient } = require("../../config/redis");
const { getQueue, QUEUE_NAMES } = require("../../jobs/queue");
const logger = require("../../config/logger");

const ANALYTICS_CACHE_TTL = 5 * 60; // 5 minutes — analytics can be slightly stale

class AnalyticsService {
  // ── Revenue Analytics ─────────────────────────────────────────────────────

  async getRevenueStats({ period = "30d" } = {}) {
    const { startDate, groupFormat } = this._getPeriodConfig(period);

    const [summary, timeseries] = await Promise.all([
      // Overall summary
      Order.aggregate([
        {
          $match: {
            status: { $in: ["confirmed", "shipped", "delivered"] },
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$amount" },
            orderCount: { $sum: 1 },
            avgOrderValue: { $avg: "$amount" },
            minOrder: { $min: "$amount" },
            maxOrder: { $max: "$amount" },
          },
        },
        { $project: { _id: 0 } },
      ]),

      // Revenue over time (timeseries)
      Order.aggregate([
        {
          $match: {
            status: { $in: ["confirmed", "shipped", "delivered"] },
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: groupFormat, date: "$createdAt" } },
            revenue: { $sum: "$amount" },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            date: "$_id",
            revenue: 1,
            orders: 1,
            _id: 0,
          },
        },
      ]),
    ]);

    return {
      summary: summary[0] || {
        totalRevenue: 0,
        orderCount: 0,
        avgOrderValue: 0,
        minOrder: 0,
        maxOrder: 0,
      },
      timeseries,
      period,
    };
  }

  // ── Order Analytics ───────────────────────────────────────────────────────

  async getOrderStats({ period = "30d" } = {}) {
    const { startDate } = this._getPeriodConfig(period);

    const [byStatus, cancellationReasons, dailyOrders] = await Promise.all([
      // Orders grouped by status
      Order.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalValue: { $sum: "$amount" },
          },
        },
        { $sort: { count: -1 } },
      ]),

      // Top cancellation reasons
      Order.aggregate([
        {
          $match: {
            status: "cancelled",
            createdAt: { $gte: startDate },
            cancelReason: { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: "$cancelledBy",
            count: { $sum: 1 },
            reasons: { $push: "$cancelReason" },
          },
        },
      ]),

      // Daily order volume
      Order.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
            revenue: { $sum: "$amount" },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // Calculate cancellation rate
    const total = byStatus.reduce((sum, s) => sum + s.count, 0);
    const cancelled = byStatus.find((s) => s._id === "cancelled")?.count || 0;
    const cancellationRate =
      total > 0 ? ((cancelled / total) * 100).toFixed(2) : 0;

    return {
      byStatus,
      cancellationRate: parseFloat(cancellationRate),
      cancellationReasons,
      dailyOrders,
      total,
      period,
    };
  }

  // ── User Analytics ────────────────────────────────────────────────────────

  async getUserStats({ period = "30d" } = {}) {
    const { startDate, groupFormat } = this._getPeriodConfig(period);

    const [summary, byRole, registrationTrend, topSellers] = await Promise.all([
      // Overall counts
      User.aggregate([
        {
          $facet: {
            total: [{ $count: "count" }],
            verified: [
              { $match: { emailVerified: true } },
              { $count: "count" },
            ],
            banned: [{ $match: { isBanned: true } }, { $count: "count" }],
            newThisPeriod: [
              { $match: { createdAt: { $gte: startDate } } },
              { $count: "count" },
            ],
          },
        },
      ]),

      // Users by role
      User.aggregate([
        { $group: { _id: "$role", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // Registration trend
      User.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: groupFormat, date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { date: "$_id", count: 1, _id: 0 } },
      ]),

      // Top sellers by order count
      Order.aggregate([
        { $match: { status: { $in: ["confirmed", "shipped", "delivered"] } } },
        {
          $group: {
            _id: "$sellerId",
            orderCount: { $sum: 1 },
            totalRevenue: { $sum: "$amount" },
          },
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "seller",
          },
        },
        { $unwind: "$seller" },
        {
          $project: {
            orderCount: 1,
            totalRevenue: 1,
            "seller.name": 1,
            "seller.email": 1,
            "seller.avatar": 1,
          },
        },
      ]),
    ]);

    const s = summary[0];
    return {
      total: s.total[0]?.count || 0,
      verified: s.verified[0]?.count || 0,
      banned: s.banned[0]?.count || 0,
      newThisPeriod: s.newThisPeriod[0]?.count || 0,
      byRole,
      registrationTrend,
      topSellers,
      period,
    };
  }

  // ── Product Analytics ─────────────────────────────────────────────────────

  async getProductStats() {
    const [byCategory, byCondition, byStatus, topViewed, sellThroughRate] =
      await Promise.all([
        // Products by category (exclude removed via $match in pipeline)
        Product.aggregate([
          { $match: { status: { $ne: "removed" } } },
          {
            $group: {
              _id: "$category",
              count: { $sum: 1 },
              avgPrice: { $avg: "$price" },
              totalValue: { $sum: "$price" },
            },
          },
          { $sort: { count: -1 } },
        ]),

        // Products by condition (active only)
        Product.aggregate([
          { $match: { status: "active" } },
          {
            $group: {
              _id: "$condition",
              count: { $sum: 1 },
              avgPrice: { $avg: "$price" },
            },
          },
          { $sort: { count: -1 } },
        ]),

        // Products by status — FIX: use $match in pipeline, NOT .setOptions()
        Product.aggregate([
          // Include ALL statuses including 'removed' using $match in pipeline
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
            },
          },
        ]),
        // NOTE: The pre-find middleware only applies to find() queries,
        // NOT to aggregate(). So aggregate already sees all docs including removed.

        // Top 10 most viewed products
        Product.find({ status: "active" })
          .sort({ views: -1 })
          .limit(10)
          .select("title slug price views category brand images")
          .lean(),

        // Sell-through rate
        Product.aggregate([
          {
            $match: {
              status: { $in: ["active", "sold"] },
            },
          },
          {
            $group: {
              _id: { category: "$category", status: "$status" },
              count: { $sum: 1 },
            },
          },
          {
            $group: {
              _id: "$_id.category",
              statuses: {
                $push: { status: "$_id.status", count: "$count" },
              },
            },
          },
          {
            $project: {
              category: "$_id",
              active: {
                $ifNull: [
                  {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: "$statuses",
                          cond: { $eq: ["$$this.status", "active"] },
                        },
                      },
                      0,
                    ],
                  },
                  { count: 0 },
                ],
              },
              sold: {
                $ifNull: [
                  {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: "$statuses",
                          cond: { $eq: ["$$this.status", "sold"] },
                        },
                      },
                      0,
                    ],
                  },
                  { count: 0 },
                ],
              },
            },
          },
          {
            $addFields: {
              sellThroughRate: {
                $cond: {
                  if: {
                    $gt: [{ $add: ["$active.count", "$sold.count"] }, 0],
                  },
                  then: {
                    $multiply: [
                      {
                        $divide: [
                          "$sold.count",
                          { $add: ["$active.count", "$sold.count"] },
                        ],
                      },
                      100,
                    ],
                  },
                  else: 0,
                },
              },
            },
          },
          { $sort: { sellThroughRate: -1 } },
        ]),
      ]);

    return {
      byCategory,
      byCondition,
      byStatus,
      topViewed,
      sellThroughRate,
    };
  }

  // ── AI Prediction Accuracy ────────────────────────────────────────────────

  async getAIPredictionStats() {
    const accuracy = await Order.aggregate([
      {
        $match: {
          status: { $in: ["delivered", "confirmed", "shipped"] },
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $match: {
          "product.predictedPrice.value": { $exists: true, $gt: 0 },
        },
      },
      {
        $project: {
          listedPrice: "$amount",
          predictedPrice: "$product.predictedPrice.value",
          confidence: "$product.predictedPrice.confidence",
          category: "$product.category",
          priceDelta: {
            $subtract: ["$amount", "$product.predictedPrice.value"],
          },
          priceDeltaPct: {
            $multiply: [
              {
                $divide: [
                  { $subtract: ["$amount", "$product.predictedPrice.value"] },
                  "$product.predictedPrice.value",
                ],
              },
              100,
            ],
          },
        },
      },
      {
        $group: {
          _id: "$category",
          avgDeltaPct: { $avg: "$priceDeltaPct" },
          avgConfidence: { $avg: "$confidence" },
          sampleCount: { $sum: 1 },
          withinTenPct: {
            $sum: {
              $cond: [{ $lte: [{ $abs: "$priceDeltaPct" }, 10] }, 1, 0],
            },
          },
        },
      },
      {
        $addFields: {
          accuracyRate: {
            $multiply: [{ $divide: ["$withinTenPct", "$sampleCount"] }, 100],
          },
        },
      },
      { $sort: { sampleCount: -1 } },
    ]);

    return { byCategory: accuracy };
  }

  // ── Combined dashboard snapshot ───────────────────────────────────────────

  async getDashboardSnapshot() {
    // Fetch all stats in parallel, cache result
    const redis = getRedisClient();
    const cacheKey = "admin:dashboard:snapshot";
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const [revenue, orders, users, products] = await Promise.all([
      this.getRevenueStats({ period: "30d" }),
      this.getOrderStats({ period: "30d" }),
      this.getUserStats({ period: "30d" }),
      this.getProductStats(),
    ]);

    const snapshot = {
      revenue,
      orders,
      users,
      products,
      generatedAt: new Date().toISOString(),
    };

    await redis.setEx(cacheKey, ANALYTICS_CACHE_TTL, JSON.stringify(snapshot));
    return snapshot;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  _getPeriodConfig(period) {
    const now = new Date();
    const configs = {
      "7d": {
        startDate: new Date(now - 7 * 24 * 60 * 60 * 1000),
        groupFormat: "%Y-%m-%d",
      },
      "30d": {
        startDate: new Date(now - 30 * 24 * 60 * 60 * 1000),
        groupFormat: "%Y-%m-%d",
      },
      "90d": {
        startDate: new Date(now - 90 * 24 * 60 * 60 * 1000),
        groupFormat: "%Y-%W", // group by week
      },
      "1y": {
        startDate: new Date(now - 365 * 24 * 60 * 60 * 1000),
        groupFormat: "%Y-%m", // group by month
      },
    };
    return configs[period] || configs["30d"];
  }
}

module.exports = new AnalyticsService();
