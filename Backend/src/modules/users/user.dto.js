// src/modules/users/user.dto.js
const Joi = require('joi');

const updateProfileDto = Joi.object({
  name: Joi.string().min(2).max(50).trim(),
  // email change deliberately excluded — requires re-verification flow (Phase 2 extension)
}).min(1).messages({
  'object.min': 'At least one field must be provided for update',
});

const addAddressDto = Joi.object({
  label: Joi.string().trim().max(30).default('Home'),
  line1: Joi.string().trim().min(5).max(100).required(),
  line2: Joi.string().trim().max(100).allow(''),
  city: Joi.string().trim().min(2).max(50).required(),
  state: Joi.string().trim().min(2).max(50).required(),
  pincode: Joi.string()
    .pattern(/^\d{6}$/)
    .required()
    .messages({ 'string.pattern.base': 'Pincode must be a 6-digit number' }),
  country: Joi.string().trim().max(50).default('India'),
  isDefault: Joi.boolean().default(false),
});

const updateAddressDto = Joi.object({
  label: Joi.string().trim().max(30),
  line1: Joi.string().trim().min(5).max(100),
  line2: Joi.string().trim().max(100).allow(''),
  city: Joi.string().trim().min(2).max(50),
  state: Joi.string().trim().min(2).max(50),
  pincode: Joi.string()
    .pattern(/^\d{6}$/)
    .messages({ 'string.pattern.base': 'Pincode must be a 6-digit number' }),
  country: Joi.string().trim().max(50),
  isDefault: Joi.boolean(),
}).min(1);

module.exports = { updateProfileDto, addAddressDto, updateAddressDto };