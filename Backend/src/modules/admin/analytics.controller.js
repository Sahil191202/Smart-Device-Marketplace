// src/modules/admin/analytics.controller.js
const analyticsService = require('./analytics.service');
const { collectMetrics } = require('../../shared/utils/metrics');
const apiResponse = require('../../shared/utils/apiResponse');
const asyncWrapper = require('../../shared/utils/asyncWrapper');
const Joi = require('joi');

const periodSchema = Joi.object({
  period: Joi.string().valid('7d', '30d', '90d', '1y').default('30d'),
});

const getDashboard = asyncWrapper(async (req, res) => {
  const snapshot = await analyticsService.getDashboardSnapshot();
  apiResponse.success(res, {
    message: 'Dashboard data fetched',
    data: snapshot,
  });
});

const getRevenue = asyncWrapper(async (req, res) => {
  const { value } = periodSchema.validate(req.query);
  const data = await analyticsService.getRevenueStats(value);
  apiResponse.success(res, { message: 'Revenue stats fetched', data });
});

const getOrders = asyncWrapper(async (req, res) => {
  const { value } = periodSchema.validate(req.query);
  const data = await analyticsService.getOrderStats(value);
  apiResponse.success(res, { message: 'Order stats fetched', data });
});

const getUsers = asyncWrapper(async (req, res) => {
  const { value } = periodSchema.validate(req.query);
  const data = await analyticsService.getUserStats(value);
  apiResponse.success(res, { message: 'User stats fetched', data });
});

const getProducts = asyncWrapper(async (req, res) => {
  const data = await analyticsService.getProductStats();
  apiResponse.success(res, { message: 'Product stats fetched', data });
});

const getAIPredictions = asyncWrapper(async (req, res) => {
  const data = await analyticsService.getAIPredictionStats();
  apiResponse.success(res, { message: 'AI prediction stats fetched', data });
});

const getMetrics = asyncWrapper(async (req, res) => {
  const metrics = await collectMetrics();
  apiResponse.success(res, { message: 'System metrics fetched', data: metrics });
});

const getAuditLogs = asyncWrapper(async (req, res) => {
  const AuditLog = require('./auditLog.model');
  const { cursor, limit = 50, action, adminId } = req.query;
  const mongoose = require('mongoose');

  const query = {};
  if (action) query.action = new RegExp(action, 'i');
  if (adminId) query.adminId = new mongoose.Types.ObjectId(adminId);

  if (cursor) {
    try {
      const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());
      query._id = { $lt: new mongoose.Types.ObjectId(decoded.id) };
    } catch { /* ignore */ }
  }

  const logs = await AuditLog.find(query)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit) + 1)
    .populate('adminId', 'name email')
    .lean();

  const hasNext = logs.length > parseInt(limit);
  const results = hasNext ? logs.slice(0, parseInt(limit)) : logs;

  let nextCursor = null;
  if (hasNext && results.length > 0) {
    nextCursor = Buffer.from(
      JSON.stringify({ id: results[results.length - 1]._id.toString() })
    ).toString('base64');
  }

  apiResponse.success(res, {
    message: 'Audit logs fetched',
    data: { logs: results },
    meta: { nextCursor, hasNext },
  });
});

module.exports = {
  getDashboard,
  getRevenue,
  getOrders,
  getUsers,
  getProducts,
  getAIPredictions,
  getMetrics,
  getAuditLogs,
};