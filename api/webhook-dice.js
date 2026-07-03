const axios  = require('axios');
const crypto = require('crypto');

const FB_PIXEL_ID   = '1350679366463627';
const FB_CAPI_TOKEN = process.env.FB_CAPI_TOKEN || '';

function sha256(str) {
  return crypto.createHash('sha256').update(String(str).trim().toLowerCase()).digest('hex');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const ev     = req.body;
  const status = (ev.status || ev.state || '').toUpperCase();
  const id     = ev.id || ev.payment_id || ev.transaction_id || '';
  const amount = ev.amount || 0;

  console.log('[Webhook Dice] status=%s id=%s amount=%s', status, id, amount);

  if (status !== 'PAID' && status !== 'APPROVED') return res.sendStatus(200);

  if (FB_CAPI_TOKEN) {
    try {
      const payer    = ev.payer || ev.customer || {};
      const email    = payer.email || '';
      const nameParts = (payer.name || '').trim().split(/\s+/);
      const digits   = (payer.phone || payer.document || '').replace(/\D/g, '');
      const phone    = digits.length >= 10 ? '55' + digits : digits;

      const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
                     || req.headers['x-real-ip'] || '';

      const userData = {
        client_ip_address: clientIp,
        client_user_agent: req.headers['user-agent'] || '',
      };
      if (email)        userData.em = [sha256(email)];
      if (nameParts[0]) userData.fn = [sha256(nameParts[0])];
      if (nameParts[1]) userData.ln = [sha256(nameParts.slice(1).join(' '))];
      if (phone)        userData.ph = [sha256(phone)];

      await axios.post(`https://graph.facebook.com/v19.0/${FB_PIXEL_ID}/events`, {
        data: [{
          event_name:       'Purchase',
          event_time:       Math.floor(Date.now() / 1000),
          event_id:         'purchase-' + String(id),
          action_source:    'website',
          event_source_url: '',
          user_data:        userData,
          custom_data: {
            value:        parseFloat(amount),
            currency:     'BRL',
            content_ids:  ['genio-prompts-' + String(id)],
            content_name: ev.product_name || 'Genio Prompts',
            content_type: 'product',
          },
        }],
        access_token: FB_CAPI_TOKEN,
      });

      console.log('[Webhook] CAPI Purchase enviado id=%s valor=%s', id, amount);
    } catch (e) {
      console.error('[Webhook] CAPI erro:', e.message);
    }
  }

  return res.sendStatus(200);
};
