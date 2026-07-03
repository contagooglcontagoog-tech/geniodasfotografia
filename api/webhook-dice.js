module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const ev     = req.body;
  const status = (ev.status || ev.state || '').toUpperCase();
  const id     = ev.id || ev.payment_id || ev.transaction_id || '';
  const amount = ev.amount || 0;
  console.log('[Wiapy-Dice Webhook] status=%s id=%s amount=%s', status, id, amount);
  return res.sendStatus(200);
};
