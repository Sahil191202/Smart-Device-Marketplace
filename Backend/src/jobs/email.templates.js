// src/jobs/email.templates.js

const baseTemplate = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f4f5; margin: 0; padding: 20px; }
    .card { background: white; border-radius: 12px; padding: 40px; max-width: 520px; margin: 0 auto; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .logo { font-size: 22px; font-weight: 700; color: #0f172a; margin-bottom: 32px; }
    .title { font-size: 24px; font-weight: 600; color: #0f172a; margin-bottom: 12px; }
    .text { font-size: 15px; color: #64748b; line-height: 1.6; margin-bottom: 24px; }
    .btn { display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; }
    .footer { margin-top: 32px; font-size: 13px; color: #94a3b8; }
    .divider { border: none; border-top: 1px solid #e2e8f0; margin: 32px 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">⚡ SmartMarketplace</div>
    ${content}
    <hr class="divider">
    <div class="footer">
      You received this email from SmartMarketplace. If you didn't request this, you can safely ignore it.
    </div>
  </div>
</body>
</html>
`;

const verifyEmailTemplate = ({ name, verifyUrl }) => ({
  subject: 'Verify your SmartMarketplace account',
  html: baseTemplate(`
    <div class="title">Verify your email, ${name} 👋</div>
    <p class="text">Thanks for signing up! Click the button below to verify your email address. This link expires in <strong>24 hours</strong>.</p>
    <a href="${verifyUrl}" class="btn">Verify Email Address</a>
    <p class="text" style="margin-top: 24px;">Or copy this link:<br><small style="word-break:break-all;color:#2563eb;">${verifyUrl}</small></p>
  `),
});

const passwordResetTemplate = ({ name, resetUrl, expiresInMinutes }) => ({
  subject: 'Reset your SmartMarketplace password',
  html: baseTemplate(`
    <div class="title">Password reset request</div>
    <p class="text">Hi ${name}, we received a request to reset your password. Click below to set a new one. This link expires in <strong>${expiresInMinutes} minutes</strong>.</p>
    <a href="${resetUrl}" class="btn">Reset Password</a>
    <p class="text" style="margin-top: 24px;">If you didn't request this, your account is safe — just ignore this email.</p>
  `),
});

const passwordChangedTemplate = ({ name }) => ({
  subject: 'Your SmartMarketplace password was changed',
  html: baseTemplate(`
    <div class="title">Password changed ✓</div>
    <p class="text">Hi ${name}, your password was successfully changed. If you made this change, no action is needed.</p>
    <p class="text">If you didn't change your password, please <a href="#" style="color:#ef4444;">contact support immediately</a> — your account may be compromised.</p>
  `),
});


const priceDropTemplate = ({ name, productTitle, oldPrice, newPrice, dropAmount, dropPercent, productSlug }) => {
  const frontendUrl = process.env.ALLOWED_ORIGINS?.split(',')[0] || '';
  const productUrl = `${frontendUrl}/products/slug/${productSlug}`;

  return {
    subject: `🔥 Price Drop Alert: ${productTitle}`,
    html: baseTemplate(`
      <div class="title">Price just dropped! 🎉</div>
      <p class="text">Hi ${name}, a product on your wishlist just got cheaper.</p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:20px 0;">
        <div style="font-weight:600;font-size:16px;color:#0f172a;margin-bottom:8px;">${productTitle}</div>
        <div style="display:flex;gap:16px;align-items:center;">
          <span style="text-decoration:line-through;color:#94a3b8;font-size:14px;">₹${oldPrice.toLocaleString('en-IN')}</span>
          <span style="font-size:22px;font-weight:700;color:#16a34a;">₹${newPrice.toLocaleString('en-IN')}</span>
          <span style="background:#dcfce7;color:#16a34a;padding:2px 8px;border-radius:4px;font-size:13px;font-weight:600;">-${dropPercent}%</span>
        </div>
        <div style="margin-top:8px;color:#16a34a;font-size:13px;">You save ₹${dropAmount.toLocaleString('en-IN')}</div>
      </div>
      <a href="${productUrl}" class="btn">View Product</a>
    `),
  };
};


module.exports = {
  verifyEmailTemplate,
  passwordResetTemplate,
  passwordChangedTemplate,
  priceDropTemplate,
};