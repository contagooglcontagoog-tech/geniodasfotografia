/**
 * Wiapy Checkout × Dice — Interceptor PIX
 * Substitui o gateway Wiapy pelo Dice sem alterar o visual.
 */
(function () {
  'use strict';

  /* Nomes mascarados rotacionados a cada pedido */
  var PRODUCT_NAMES = [
    'Lisinha Bumbum',
    'Popozuda Lisinha',
    'Lisinha Premium',
    'Kit Bumbum',
    'Popozuda Original',
    'Creme Lisinha',
    'Bumbum Perfeito',
  ];
  function nomeMascarado() {
    return PRODUCT_NAMES[Math.floor(Math.random() * PRODUCT_NAMES.length)];
  }

  /* Preço base do produto principal */
  var BASE_PRICE = 10.00;

  /* Estado dos orderbumps selecionados: Set de índices */
  var selectedBumps = {};

  /* ── Estado PIX ── */
  var pixText   = '';
  var pixId     = null;
  var pollingTO = null;
  var timerTO   = null;

  /* ── Utilitários ── */
  function fmt(v) {
    return 'R$ ' + Number(v).toFixed(2).replace('.', ',');
  }

  function parseBRL(str) {
    var m = String(str).replace(/\s/g, '').match(/([\d]+[,.][\d]{2})/);
    return m ? parseFloat(m[1].replace(',', '.')) : 0;
  }

  function getTotal() {
    var total = BASE_PRICE;
    Object.keys(selectedBumps).forEach(function (idx) {
      total += selectedBumps[idx];
    });
    return Math.round(total * 100) / 100;
  }

  /* ── Atualiza exibição do total no DOM ── */
  function atualizarTotalDOM() {
    var total = getTotal();
    var fmtd  = fmt(total);

    /* .price-value.highlight-green (resumo) */
    document.querySelectorAll('.price-value.highlight-green, .price-value').forEach(function (el) {
      if (/R\$/.test(el.textContent)) el.textContent = fmtd;
    });

    /* .payment-summary-box__text (banner "À VISTA NO PIX") */
    document.querySelectorAll('.payment-summary-box__text').forEach(function (el) {
      el.textContent = fmtd + ' À VISTA NO PIX';
    });

    /* .price-row (linha Total no resumo) */
    document.querySelectorAll('.price-row').forEach(function (row) {
      var title = row.querySelector('.price-title');
      var value = row.querySelector('.price-value');
      if (title && /total/i.test(title.textContent) && value) {
        value.textContent = fmtd;
      }
    });
  }

  /* ── Injeção de estilos ── */
  function injectCSS() {
    var s = document.createElement('style');
    s.textContent = [
      /* Remove abas Cartão e Google Pay mesmo se o Nuxt re-renderizar */
      '.payment-tab:not(.pix-only-keep) { display: none !important; }',

      /* Remove branding Wiapy */
      '.technology-brand, .wiapy-logo, a[href="https://wiapy.com"] { display: none !important; }',

      /* Checkbox visual do orderbump selecionado */
      '.orderbump-card.dc-selected .orderbump-checkbox::after { content:"✓"; display:flex; align-items:center; justify-content:center; width:20px; height:20px; background:#7c3aed; color:#fff; border-radius:4px; font-weight:700; font-size:13px; }',
      '.orderbump-card.dc-selected { border: 2px solid #7c3aed !important; background: #faf5ff !important; }',
      '.orderbump-card.dc-selected .btn-add-offer { background: #7c3aed !important; color: #fff !important; border-color: #7c3aed !important; }',

      /* Modal overlay */
      ':root{--dc:#7c3aed}',
      '.dc-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9998;display:none}',
      '.dc-overlay.on{display:block}',
      '.dc-modal-wrap{position:fixed;inset:0;z-index:9999;display:none;align-items:flex-end;justify-content:center;overflow-y:auto}',
      '.dc-modal-wrap.on{display:flex}',
      '@media(min-width:580px){.dc-modal-wrap{align-items:center;padding:20px}}',
      '.dc-modal{background:#fff;width:100%;max-width:460px;border-radius:20px 20px 0 0;padding:24px 20px;padding-bottom:max(24px,env(safe-area-inset-bottom));position:relative}',
      '@media(min-width:580px){.dc-modal{border-radius:16px}}',
      '.dc-close{position:absolute;top:14px;right:16px;background:#f3f3f3;border:none;border-radius:50%;width:34px;height:34px;cursor:pointer;font-size:.9em;color:#666}',
      '.dc-title{font-size:1.1em;font-weight:700;margin-bottom:4px;text-align:center}',
      '.dc-sub{font-size:.83em;color:#888;text-align:center;margin-bottom:20px}',
      '.dc-amount{font-size:2.4em;font-weight:700;color:var(--dc);text-align:center;letter-spacing:-.02em;margin-bottom:4px}',
      '.dc-loader{display:flex;flex-direction:column;align-items:center;gap:12px;padding:30px 0;text-align:center}',
      '.dc-spinner{width:36px;height:36px;border:3px solid #eee;border-top-color:var(--dc);border-radius:50%;animation:dcspin .8s linear infinite}',
      '@keyframes dcspin{to{transform:rotate(360deg)}}',
      '.dc-loader p{font-size:.84em;color:#888}',
      '.dc-qr-wrap{display:none;text-align:center}',
      '.dc-timer{display:none;align-items:center;justify-content:center;gap:8px;background:#fff8e1;border:1px solid #ffb300;border-radius:8px;padding:7px 12px;margin-bottom:12px;font-size:.8em;font-weight:600;color:#7b5600}',
      '.dc-timer.on{display:flex}',
      '.dc-timer-val{color:#c0392b;font-family:monospace;font-size:1.1em}',
      '#dc-qrcode{width:180px;height:180px;margin:0 auto 14px;padding:8px;background:#fff;border:1px solid #eee;border-radius:10px}',
      '#dc-qrcode img,#dc-qrcode canvas{max-width:100%;height:auto}',
      '.dc-code-box{background:#f5f5f5;border:1px solid #eee;border-radius:8px;padding:9px 12px;font-family:monospace;font-size:.72em;color:#888;word-break:break-all;text-align:left;margin-bottom:10px;max-height:50px;overflow:hidden}',
      '.dc-btn-copy{display:block;width:100%;padding:14px;background:#222;color:#fff;border:none;border-radius:50px;font-size:.9em;font-weight:700;letter-spacing:.5px;text-transform:uppercase;cursor:pointer;margin-bottom:16px;font-family:inherit}',
      '.dc-btn-copy.ok{background:#27ae60}',
      '.dc-steps{text-align:left;border:1px solid #eee;border-radius:9px;overflow:hidden}',
      '.dc-step{display:flex;gap:10px;align-items:flex-start;padding:10px 13px;border-bottom:1px solid #eee;font-size:.83em;color:#666}',
      '.dc-step:last-child{border-bottom:none}',
      '.dc-step-n{flex-shrink:0;width:20px;height:20px;background:var(--dc);color:#fff;border-radius:50%;font-size:.72em;font-weight:700;display:flex;align-items:center;justify-content:center}',
      '.dc-err{display:none;text-align:center;padding:24px 0}',
      '.dc-err p{font-size:.84em;color:#e53935;margin:8px 0 14px}',
      '.dc-btn-retry{background:#f3f3f3;border:1.5px solid #ddd;border-radius:50px;padding:11px 20px;font-size:.84em;font-weight:600;color:#444;cursor:pointer;font-family:inherit}',
      '.dc-done{text-align:center;padding:32px 16px}',
      '.dc-done-icon{font-size:3em;margin-bottom:12px}',
      '.dc-done h3{font-size:1.3em;font-weight:700;margin-bottom:8px}',
      '.dc-done p{color:#888;font-size:.9em;line-height:1.6}',
      '.dc-btn-done{margin-top:18px;background:var(--dc);color:#fff;border:none;border-radius:50px;padding:13px 30px;font-size:.9em;font-weight:700;cursor:pointer;font-family:inherit}',
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ── Injeção do modal PIX ── */
  function injectHTML() {
    var div = document.createElement('div');
    div.innerHTML = [
      '<div class="dc-overlay" id="dc-overlay"></div>',
      '<div class="dc-modal-wrap" id="dc-modal-wrap" style="display:none">',
      '  <div class="dc-modal">',
      '    <button class="dc-close" onclick="dcFechar()">✕</button>',
      '    <div id="dc-pix-stage">',
      '      <div class="dc-title">Pagamento via PIX</div>',
      '      <div class="dc-sub">Confirmação imediata após o pagamento</div>',
      '      <div class="dc-amount" id="dc-amount">R$ 0,00</div>',
      '      <div class="dc-loader" id="dc-loader">',
      '        <div class="dc-spinner"></div><p>Gerando seu QR Code…</p>',
      '      </div>',
      '      <div class="dc-qr-wrap" id="dc-qr-wrap">',
      '        <div class="dc-timer" id="dc-timer"><span>⏱ Válido por:</span><strong class="dc-timer-val" id="dc-timer-val">30:00</strong></div>',
      '        <div id="dc-qrcode"></div>',
      '        <div class="dc-code-box" id="dc-code"></div>',
      '        <button class="dc-btn-copy" id="dc-btn-copy" onclick="dcCopiar()">Copiar Código PIX</button>',
      '        <div class="dc-steps">',
      '          <div class="dc-step"><span class="dc-step-n">1</span>Abra o app do banco e acesse o PIX</div>',
      '          <div class="dc-step"><span class="dc-step-n">2</span>Escolha "PIX Copia e Cola" ou escaneie o QR</div>',
      '          <div class="dc-step"><span class="dc-step-n">3</span>Confirme o valor e finalize o pagamento</div>',
      '          <div class="dc-step"><span class="dc-step-n">4</span>Pedido confirmado automaticamente ✅</div>',
      '        </div>',
      '      </div>',
      '      <div class="dc-err" id="dc-err">',
      '        <div style="font-size:2em">⚠️</div>',
      '        <p id="dc-err-msg">Erro ao gerar PIX.</p>',
      '        <button class="dc-btn-retry" onclick="dcTentarNovamente()">Tentar novamente</button>',
      '      </div>',
      '    </div>',
      '    <div class="dc-done" id="dc-done-stage" style="display:none">',
      '      <div class="dc-done-icon">✅</div>',
      '      <h3>Pagamento Confirmado!</h3>',
      '      <p>Seu acesso será liberado em instantes.<br>Verifique seu e-mail. 🎉</p>',
      '      <button class="dc-btn-done" onclick="dcFechar()">Fechar</button>',
      '    </div>',
      '  </div>',
      '</div>',
    ].join('\n');
    document.body.appendChild(div);

    if (!window.QRCode) {
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
      document.head.appendChild(s);
    }

    document.getElementById('dc-overlay').addEventListener('click', window.dcFechar);
  }

  /* ── Orderbumps ── */
  function bindOrderbumps() {
    /* Aguarda as cards existirem no DOM (Nuxt renderiza async) */
    var attempts = 0;
    var poll = setInterval(function () {
      var cards = document.querySelectorAll('.orderbump-card');
      if (!cards.length && attempts++ < 40) return;
      clearInterval(poll);

      cards.forEach(function (card, idx) {
        /* Extrai o preço do orderbump */
        var priceEl = card.querySelector('.price-green, .final-price strong');
        var price   = priceEl ? parseBRL(priceEl.textContent) : 0;

        var btn = card.querySelector('.btn-add-offer');
        if (!btn || !price) return;

        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopImmediatePropagation();

          var isSelected = card.classList.contains('dc-selected');

          if (isSelected) {
            /* Remove orderbump */
            card.classList.remove('dc-selected');
            delete selectedBumps[idx];
            btn.textContent = 'Adicionar oferta';
          } else {
            /* Adiciona orderbump */
            card.classList.add('dc-selected');
            selectedBumps[idx] = price;
            btn.textContent = '✓ Adicionado — Remover';
          }

          atualizarTotalDOM();
        }, true);
      });

      console.log('[Dice] ' + cards.length + ' orderbumps vinculados ✓');
    }, 300);
  }

  /* ── Força PIX como única aba ── */
  function forcarAbaPixUnica() {
    /* Aguarda Nuxt renderizar os tabs */
    var attempts = 0;
    var poll = setInterval(function () {
      var allTabs = document.querySelectorAll('.payment-tab');
      if (!allTabs.length && attempts++ < 40) return;
      clearInterval(poll);

      allTabs.forEach(function (tab) {
        var txt = tab.textContent.trim().toLowerCase();
        if (txt === 'pix') {
          tab.classList.add('pix-only-keep', 'active');
        } else {
          tab.style.display = 'none';
        }
      });

      /* Observer para esconder qualquer tab que o Nuxt re-injete */
      var tabsContainer = document.querySelector('.payment-tabs');
      if (tabsContainer) {
        new MutationObserver(function () {
          tabsContainer.querySelectorAll('.payment-tab').forEach(function (tab) {
            var txt = tab.textContent.trim().toLowerCase();
            if (txt !== 'pix') tab.style.display = 'none';
          });
        }).observe(tabsContainer, { childList: true, subtree: true });
      }
    }, 300);
  }

  /* ── Abrir/fechar modal ── */
  window.dcAbrir = function (total) {
    var amEl = document.getElementById('dc-amount');
    if (amEl) amEl.textContent = fmt(total);
    document.getElementById('dc-loader').style.display  = 'flex';
    document.getElementById('dc-qr-wrap').style.display = 'none';
    document.getElementById('dc-err').style.display     = 'none';
    document.getElementById('dc-pix-stage').style.display  = 'block';
    document.getElementById('dc-done-stage').style.display = 'none';
    document.getElementById('dc-overlay').classList.add('on');
    document.getElementById('dc-modal-wrap').style.display = 'flex';
    document.body.style.overflow = 'hidden';
  };
  window.dcFechar = function () {
    dcPararPolling();
    if (timerTO) clearTimeout(timerTO);
    document.getElementById('dc-overlay').classList.remove('on');
    document.getElementById('dc-modal-wrap').style.display = 'none';
    document.body.style.overflow = '';
  };

  /* ── Gerar PIX via Dice API ── */
  function dcGerarPix(dados) {
    fetch('/api/criar-pagamento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados),
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      document.getElementById('dc-loader').style.display = 'none';
      if (!data.ok) throw new Error(data.erro || 'Erro ao gerar PIX.');

      pixText = data.qr_code_text;
      pixId   = data.payment_id;

      var qrEl = document.getElementById('dc-qrcode');
      if (qrEl) {
        qrEl.innerHTML = '';
        if (window.QRCode) {
          new QRCode(qrEl, { text: pixText, width: 200, height: 200, colorDark: '#000', colorLight: '#fff', correctLevel: QRCode.CorrectLevel.L });
        }
      }
      document.getElementById('dc-code').textContent    = pixText;
      document.getElementById('dc-qr-wrap').style.display = 'block';
      dcStartTimer();
      dcIniciarPolling(pixId);
    })
    .catch(function (err) {
      document.getElementById('dc-loader').style.display = 'none';
      document.getElementById('dc-err-msg').textContent  = err.message || 'Erro ao gerar PIX.';
      document.getElementById('dc-err').style.display    = 'block';
    });
  }

  window.dcTentarNovamente = function () {
    document.getElementById('dc-err').style.display    = 'none';
    document.getElementById('dc-loader').style.display = 'flex';
    if (window._dcDados) dcGerarPix(window._dcDados);
  };

  /* ── Polling status ── */
  function dcIniciarPolling(id) {
    dcPararPolling();
    if (!id) return;
    (function poll() {
      fetch('/api/status-pagamento?id=' + encodeURIComponent(id))
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.status === 'PAID' || d.status === 'APPROVED') {
            dcPararPolling();
            if (timerTO) clearTimeout(timerTO);
            document.getElementById('dc-pix-stage').style.display  = 'none';
            document.getElementById('dc-done-stage').style.display = 'block';
          } else {
            pollingTO = setTimeout(poll, 4000);
          }
        })
        .catch(function () { pollingTO = setTimeout(poll, 6000); });
    })();
  }
  function dcPararPolling() {
    if (pollingTO) { clearTimeout(pollingTO); pollingTO = null; }
  }

  /* ── Copiar PIX ── */
  window.dcCopiar = function () {
    if (!pixText) return;
    var btn = document.getElementById('dc-btn-copy');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(pixText).then(function () {
        if (btn) { btn.textContent = '✓ CÓDIGO COPIADO!'; btn.classList.add('ok'); }
        setTimeout(function () { if (btn) { btn.textContent = 'Copiar Código PIX'; btn.classList.remove('ok'); } }, 2500);
      });
    } else {
      var ta = document.createElement('textarea');
      ta.value = pixText; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      if (btn) btn.textContent = '✓ CÓDIGO COPIADO!';
      setTimeout(function () { if (btn) btn.textContent = 'Copiar Código PIX'; }, 2500);
    }
  };

  /* ── Timer 30 min ── */
  function dcStartTimer() {
    if (timerTO) clearTimeout(timerTO);
    var wrap = document.getElementById('dc-timer');
    var el   = document.getElementById('dc-timer-val');
    if (!wrap || !el) return;
    wrap.classList.add('on');
    var secs = 30 * 60;
    (function tick() {
      var m = Math.floor(secs / 60), s = secs % 60;
      el.textContent = m + ':' + (s < 10 ? '0' : '') + s;
      if (secs > 0) { secs--; timerTO = setTimeout(tick, 1000); }
      else el.textContent = 'Expirado';
    })();
  }

  /* ── Interceptar submit do checkout ── */
  function interceptSubmit() {
    var attempts = 0;
    var poll = setInterval(function () {
      var btn = document.querySelector('.btn-submit');
      if (!btn && attempts++ < 60) return;
      clearInterval(poll);
      if (!btn) return;

      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();

        var nome  = (document.getElementById('name')  || {}).value || '';
        var email = (document.getElementById('email') || {}).value || '';
        var cpf   = (document.getElementById('taxId') || {}).value || '';
        var tel   = (document.getElementById('phone') || {}).value || '';

        if (!nome || !email || !cpf) {
          alert('Preencha nome, e-mail e CPF antes de finalizar.');
          return;
        }

        var total = getTotal();
        var dados = {
          nome:         nome,
          email:        email,
          cpf:          cpf,
          tel:          tel,
          produto_nome: nomeMascarado(),
          total:        total,
        };
        window._dcDados = dados;

        dcAbrir(total);
        dcGerarPix(dados);
      }, true);

      var form = btn.closest('form');
      if (form) {
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }, true);
      }

      console.log('[Dice] Submit interceptado ✓');
    }, 500);
  }

  /* ── Cronômetro de oferta ── */
  function initCronometro() {
    var minEl = document.getElementById('minute');
    var secEl = document.getElementById('second');
    if (!minEl || !secEl) return;

    /* Lê valor inicial do DOM ou usa 15:00 */
    var mins = parseInt(minEl.textContent, 10) || 15;
    var secs = parseInt(secEl.textContent, 10) || 0;
    var total = mins * 60 + secs;

    function tick() {
      if (total <= 0) { total = 0; }
      var m = Math.floor(total / 60);
      var s = total % 60;
      minEl.textContent = String(m).padStart(2, '0');
      secEl.textContent = String(s).padStart(2, '0');
      if (total > 0) { total--; setTimeout(tick, 1000); }
    }
    tick();
  }

  /* ── Init ── */
  function init() {
    injectCSS();
    injectHTML();
    forcarAbaPixUnica();
    bindOrderbumps();
    interceptSubmit();
    initCronometro();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
