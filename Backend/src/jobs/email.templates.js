// src/jobs/email.templates.js
const env = require('../config/env');

const FRONTEND_URL = env.ALLOWED_ORIGINS?.split(',')[0] || 'http://localhost:3000';

// ── Base HTML wrapper ─────────────────────────────────────────────────────────
const baseTemplate = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SmartMarketplace</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
      background: #f4f4f5; 
      padding: 40px 20px; 
    }
    .wrapper { max-width: 560px; margin: 0 auto; }
    .card { 
      background: white; 
      border-radius: 12px; 
      padding: 40px; 
      box-shadow: 0 1px 3px rgba(0,0,0,0.1); 
    }
    .logo { 
      font-size: 20px; 
      font-weight: 700; 
      color: #0f172a; 
      margin-bottom: 28px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .title { 
      font-size: 22px; 
      font-weight: 600; 
      color: #0f172a; 
      margin-bottom: 12px; 
      line-height: 1.3;
    }
    .text { 
      font-size: 15px; 
      color: #64748b; 
      line-height: 1.7; 
      margin-bottom: 20px; 
    }
    .btn { 
      display: inline-block; 
      background: #2563eb; 
      color: white !important; 
      text-decoration: none; 
      padding: 13px 28px; 
      border-radius: 8px; 
      font-weight: 600; 
      font-size: 15px;
      margin: 8px 0 20px;
    }
    .btn:hover { background: #1d4ed8; }
    .btn-green { background: #16a34a; }
    .divider { 
      border: none; 
      border-top: 1px solid #e2e8f0; 
      margin: 28px 0; 
    }
    .footer { 
      font-size: 13px; 
      color: #94a3b8; 
      line-height: 1.6;
    }
    .highlight-box {
      border-radius: 10px;
      padding: 20px;
      margin: 20px 0;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #f1f5f9;
      font-size: 14px;
    }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #64748b; }
    .info-value { color: #0f172a; font-weight: 500; }
    .small { font-size: 13px; color: #94a3b8; word-break: break-all; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="logo">⚡ SmartMarketplace</div>
      ${content}
      <hr class="divider">
      <div class="footer">
        You received this email from SmartMarketplace.<br>
        If you didn't request this, you can safely ignore this email.
      </div>
    </div>
  </div>
</body>
</html>
`;

// ── Template 1: Email Verification ───────────────────────────────────────────
const verifyEmailTemplate = ({ name, verifyUrl }) => ({
  subject: 'Verify your SmartMarketplace account',
  html: baseTemplate(`
    <div class="title">Welcome to SmartMarketplace, ${name}! 👋</div>
    <p class="text">
      Thanks for signing up! Please verify your email address to activate your account.
      This link expires in <strong>24 hours</strong>.
    </p>
    <a href="${verifyUrl}" class="btn">Verify Email Address</a>
    <p class="text">Or copy this link into your browser:</p>
    <p class="small">${verifyUrl}</p>
  `),
});

// ── Template 2: Password Reset ────────────────────────────────────────────────
const passwordResetTemplate = ({ name, resetUrl, expiresInMinutes }) => ({
  subject: 'Reset your SmartMarketplace password',
  html: baseTemplate(`
    <div class="title">Reset your password</div>
    <p class="text">
      Hi ${name}, we received a request to reset your password.
      Click the button below to set a new one.
      This link expires in <strong>${expiresInMinutes} minutes</strong>.
    </p>
    <a href="${resetUrl}" class="btn">Reset Password</a>
    <p class="text">Or copy this link into your browser:</p>
    <p class="small">${resetUrl}</p>
    <p class="text" style="margin-top:16px; font-size:13px; color:#94a3b8;">
      If you didn't request a password reset, you can safely ignore this email. 
      Your password will not be changed.
    </p>
  `),
});

// ── Template 3: Password Changed ──────────────────────────────────────────────
const passwordChangedTemplate = ({ name }) => ({
  subject: 'Your SmartMarketplace password was changed',
  html: baseTemplate(`
    <div class="title">Password changed successfully ✓</div>
    <p class="text">
      Hi ${name}, your account password was just changed successfully.
    </p>
    <div class="highlight-box" style="background:#f0fdf4; border:1px solid #bbf7d0;">
      <p style="color:#16a34a; font-size:14px; font-weight:500;">
        ✓ Your account is secure
      </p>
      <p style="color:#64748b; font-size:14px; margin-top:4px;">
        If you made this change, no further action is needed.
      </p>
    </div>
    <p class="text">
      If you did NOT change your password, your account may be compromised.
      Please <a href="${FRONTEND_URL}/forgot-password" style="color:#ef4444;">
      reset your password immediately</a> and contact support.
    </p>
  `),
});

// ── Template 4: Price Drop Alert ──────────────────────────────────────────────
const priceDropTemplate = ({
  name,
  productTitle,
  oldPrice,
  newPrice,
  dropAmount,
  dropPercent,
  productSlug,
}) => {
  const productUrl = `${FRONTEND_URL}/products/slug/${productSlug}`;

  return {
    subject: `🔥 Price Drop: ${productTitle} is now ₹${newPrice.toLocaleString('en-IN')}`,
    html: baseTemplate(`
      <div class="title">Price dropped on your wishlist item! 🎉</div>
      <p class="text">
        Hi ${name}, great news! A product on your wishlist just got cheaper.
      </p>
      <div class="highlight-box" style="background:#f0fdf4; border:1px solid #bbf7d0;">
        <p style="font-weight:600; font-size:16px; color:#0f172a; margin-bottom:12px;">
          ${productTitle}
        </p>
        <div class="info-row">
          <span class="info-label">Original Price</span>
          <span class="info-value" style="text-decoration:line-through; color:#94a3b8;">
            ₹${oldPrice.toLocaleString('en-IN')}
          </span>
        </div>
        <div class="info-row">
          <span class="info-label">New Price</span>
          <span class="info-value" style="color:#16a34a; font-size:18px;">
            ₹${newPrice.toLocaleString('en-IN')}
          </span>
        </div>
        <div class="info-row">
          <span class="info-label">You Save</span>
          <span class="info-value" style="color:#16a34a;">
            ₹${dropAmount.toLocaleString('en-IN')} (${dropPercent}% off)
          </span>
        </div>
      </div>
      <a href="${productUrl}" class="btn btn-green">View Product →</a>
      <p class="text" style="font-size:13px;">
        Hurry! This price may not last long.
      </p>
    `),
  };
};

// ── Template 5: Order Shipped (to Buyer) ──────────────────────────────────────
const orderShippedTemplate = ({
  name,
  productTitle,
  courier,
  trackingNumber,
  trackingUrl,
  estimatedDelivery,
  orderId,
}) => {
  const orderUrl = `${FRONTEND_URL}/orders/${orderId}`;
  const trackLink = trackingUrl || '#';
  const deliveryDate = estimatedDelivery
    ? new Date(estimatedDelivery).toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'To be updated';

  return {
    subject: `📦 Your order has been shipped — ${productTitle}`,
    html: baseTemplate(`
      <div class="title">Your order is on its way! 📦</div>
      <p class="text">
        Hi ${name}, great news! Your order has been shipped and is heading your way.
      </p>
      <div class="highlight-box" style="background:#eff6ff; border:1px solid #bfdbfe;">
        <p style="font-weight:600; font-size:15px; color:#0f172a; margin-bottom:12px;">
          ${productTitle}
        </p>
        <div class="info-row">
          <span class="info-label">Courier</span>
          <span class="info-value">${courier}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Tracking Number</span>
          <span class="info-value">${trackingNumber}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Estimated Delivery</span>
          <span class="info-value">${deliveryDate}</span>
        </div>
      </div>
      <a href="${trackLink}" class="btn">Track Your Package →</a>
      <p class="text" style="margin-top:8px;">
        You can also 
        <a href="${orderUrl}" style="color:#2563eb;">view your order details</a> 
        on SmartMarketplace.
      </p>
    `),
  };
};

// ── Template 6: Seller New Order ──────────────────────────────────────────────
const sellerNewOrderTemplate = ({
  name,
  productTitle,
  amount,
  buyerName,
  orderId,
}) => {
  const orderUrl = `${FRONTEND_URL}/seller/orders/${orderId}`;

  return {
    subject: `🎉 You made a sale — ${productTitle}`,
    html: baseTemplate(`
      <div class="title">Congratulations! Your product sold! 🎉</div>
      <p class="text">
        Hi ${name}, your listing just sold. Here are the order details:
      </p>
      <div class="highlight-box" style="background:#fefce8; border:1px solid #fde68a;">
        <div class="info-row">
          <span class="info-label">Product</span>
          <span class="info-value">${productTitle}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Sale Amount</span>
          <span class="info-value" style="color:#16a34a; font-weight:700; font-size:18px;">
            ₹${amount.toLocaleString('en-IN')}
          </span>
        </div>
        <div class="info-row">
          <span class="info-label">Buyer</span>
          <span class="info-value">${buyerName || 'Verified Buyer'}</span>
        </div>
      </div>
      <p class="text">
        <strong>Next step:</strong> Please ship the item to the buyer's address as soon as possible.
        Mark it as shipped once dispatched.
      </p>
      <a href="${orderUrl}" class="btn">View Order & Ship →</a>
    `),
  };
};

module.exports = {
  verifyEmailTemplate,
  passwordResetTemplate,
  passwordChangedTemplate,
  priceDropTemplate,
  orderShippedTemplate,
  sellerNewOrderTemplate,
};