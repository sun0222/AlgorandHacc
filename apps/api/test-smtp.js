const nodemailer = require('nodemailer');
(async () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    console.error('SMTP_USER or SMTP_PASS missing');
    process.exit(2);
  }
  const opts = { host, port, auth: { user, pass } };
  if (port === 465) opts.secure = true;
  else if (port === 587) { opts.secure = false; opts.requireTLS = true; }
  try {
    const t = nodemailer.createTransport(opts);
    await t.verify();
    console.log('SMTP verify OK');
  } catch (err) {
    console.error('SMTP verify FAILED', err);
  }
})();
