(function() {
  var CFG = {
    url: 'https://script.google.com/macros/s/AKfycbz-hmeCMH4jTlON6tw-6_T2MuVKQoC_IIJmJ-xZbKHoXha0TyQEd1MN2n5D1znei7YR/exec',
    token: 'blue-falcon-manila-7342-orbit'
  }; 
  
  var $ = function(s) { return document.querySelector(s) };
  var K = 'syncshift.v2', H = 3600000, S;
  var live = !!CFG.url, busy = 0, metaOk = 0, err = '';
  
  var CRX = {
    'Travel & Dining': /travel|dining|book/i,
    'Executive Search': /exec|search|recruit|hire|candidate/i,
    'CRM Follow-up': /crm|follow|nudge/i,
    'Admin / Scheduling': /admin|sched/i
  };
  var ST = {
    today: /to ?do|new|open|progress|pending|priority|today|queue|not started/i,
    wait: /wait|founder|review|block|hold/i,
    done: /done|complete|closed/i
  };

  function e(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function save() {
    try { localStorage.setItem(K, JSON.stringify(S)) } catch (x) {}
  }

  function load() {
    try { S = JSON.parse(localStorage.getItem(K)) } catch (x) {}
    
    if (!S) {
      var n = Date.now();
      S = { tasks: [], nudges: [], content: [], outbox: [], map: {}, meta: {}, role: 'EA', theme: '' };
      
      if (!live) {
        S.tasks = [
          { id: 'd1', t: 'Book flight LHR to MNL, window seat', c: 'Travel & Dining', u: 'High', due: n + H, st: 'today' },
          { id: 'd2', t: 'Table for two at Dishoom London, Tuesday 7 PM', c: 'Travel & Dining', u: 'Medium', due: n + 6 * H, st: 'today' }
        ];
        S.nudges = [
          { id: 'n1', n: 'Sarah Chen', o: 'Northbridge', cat: 'Candidate', sent: n - 54 * H, s: 'Awaiting Reply' },
          { id: 'n2', n: 'James Okafor', o: 'Apex Ventures', cat: 'Investor', sent: n - 20 * H, s: 'Awaiting Reply' },
          { id: 'n3', n: 'Priya Nair', o: 'Lumen Ltd', cat: 'Vendor', sent: n - 30 * H, s: 'Awaiting Reply' }
        ];
      }
    }
    if (S.theme) document.documentElement.dataset.theme = S.theme;
  }

  /* ---------- sheet API ---------- */
  function j(r) {
    if (!r.ok) throw new Error("Network error: " + r.status);
    return r.json().then(function(x) {
      if (x && x.error) throw new Error(x.error);
      return x;
    }).catch(function(err) {
      throw new Error("Invalid response from server. Check deployment settings.");
    });
  }

  function api(route, body) {
    if (!body) return fetch(CFG.url + '?route=' + route + '&token=' + encodeURIComponent(CFG.token)).then(j);
    return fetch(CFG.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ token: CFG.token, route: route }, body))
    }).then(j);
  }

  function op(r, f) { return (S.meta[r] || {})[f] || [] }
  
  function pk(r, f, want, rx) {
    var o = op(r, f);
    if (!o.length) return want;
    var w = String(want).toLowerCase(), i;
    for (i = 0; i < o.length; i++) if (String(o[i]).toLowerCase() === w) return o[i];
    if (rx) for (i = 0; i < o.length; i++) if (rx.test(o[i])) return o[i];
    for (i = 0; i < o.length; i++) if (String(o[i]).toLowerCase().indexOf(w.split(/[ \/&]/)[0]) > -1) return o[i];
    return o[0];
  }

  function sv(r, s) { return pk(r, 'Status', s, ST[s]) }
  function stOf(s) { s = String(s || ''); return ST.done.test(s) ? 'done' : ST.wait.test(s) ? 'wait' : 'today' }
  function ts(v) { var t = Date.parse(v); return isNaN(t) ? null : t }
  function iso(t) { return new Date(t).toISOString() }

  function mT(r) { return { id: String(r['Task ID']), t: r['Task Description'], c: r.Category, u: r.Urgency, due: ts(r['Due Date']), dtxt: r['Due Date'], st: stOf(r.Status), sub: r.Submitter } }
  function mN(r) { return { id: String(r['Contact ID']), n: r['Contact Name'], o: r.Organization, cat: r.Category, sent: ts(r['Last Contact Date']), s: r.Status, step: r['Next Step'] } }
  function mC(r) { return { id: String(r['Post ID']), date: ts(r['Publish Date']), dtxt: r['Publish Date'], topic: r['Angle/Topic'], draft: r['Draft Content'], status: r.Status, plat: r.Platform, author: r.Author } }

  function getMeta() {
    if (metaOk) return Promise.resolve();
    return Promise.all(['tasks', 'nudges', 'content'].map(function(r) {
      return fetch(CFG.url + '?route=' + r + '&action=meta&token=' + encodeURIComponent(CFG.token)).then(j);
    })).then(function(m) {
      S.meta = { tasks: m[0], nudges: m[1], content: m[2] };
      metaOk = 1;
      save();
      fills();
    }, function(x) {
      if (x instanceof TypeError) throw x;
      metaOk = 1;
    });
  }

  function flush() {
    var p = Promise.resolve();
    S.outbox.slice().forEach(function(o) {
      p = p.then(function() {
        var id = o.id && S.map[o.id] ? S.map[o.id] : o.id;
        if (o.a != 'add' && String(id).indexOf('tmp-') == 0) {
          S.outbox.shift(); save(); return;
        }
        return api(o.r, o.a == 'add' ? { data: o.data } : { action: o.a, id: id, data: o.data }).then(function(x) {
          if (o.a == 'add') S.map[o.id] = x.id;
          S.outbox.shift();
          save();
        }, function(x) {
          if (x instanceof TypeError) throw x;
          S.outbox.shift();
          save();
          err = 'Sheet rejected a change: ' + x.message;
        });
      });
    });
    return p;
  }

  function setSt(t) { $('#sy').textContent = t }

  function sync() {
    if (!live || busy) return Promise.resolve();
    busy = 1; err = ''; setSt('⟳ Syncing…');
    
    return getMeta().then(flush).then(function() {
      return Promise.all([api('tasks'), api('nudges'), api('content')]);
    }).then(function(r) {
      function keep(a) { return a.filter(function(x) { return S.outbox.some(function(o) { return o.id == x.id }) }) }
      
      S.tasks = r[0].map(mT).filter(function(t) { return t.t }).concat(keep(S.tasks));
      S.nudges = r[1].map(mN).filter(function(n) { return n.n }).concat(keep(S.nudges));
      S.content = r[2].map(mC).filter(function(c) { return c.topic || c.draft }).concat(keep(S.content));
      
      save(); all();
      setSt(err ? '⚠ ' + err : '● Synced ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    }).catch(function(x) {
      setSt(x instanceof TypeError ? '○ Offline — changes queued' : '⚠ ' + x.message);
      all();
    }).then(function() { busy = 0 });
  }

  function q(r, a, id, data) {
    if (!live) return;
    S.outbox.push({ r: r, a: a, id: id, data: data });
    save(); sync();
  }

  /* ---------- clocks ---------- */
  function hr(z, d) { return +new Intl.DateTimeFormat('en-GB', { timeZone: z, hour: '2-digit', hourCycle: 'h23' }).format(d) }
  function min(z, d) { return +new Intl.DateTimeFormat('en-GB', { timeZone: z, minute: '2-digit' }).format(d) }
  function st(h, ov) { return ov ? ['Core Overlap', 'o'] : (h >= 7 && h < 22 ? ['Deep Work', ''] : ['Off-Hours / Sleeping', 's']) }
  
  function tick() {
    var d = new Date(), U = 'Europe/London', P = 'Asia/Manila', hu = hr(U, d), hp = hr(P, d), ov = hu >= 6 && hu < 11;
    function f(z, o) { return new Intl.DateTimeFormat('en-GB', Object.assign({ timeZone: z }, o)).format(d) }
    
    $('#tU').textContent = f(U, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    $('#tP').textContent = f(P, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    $('#dU').textContent = f(U, { weekday: 'long', day: 'numeric', month: 'short' });
    $('#dP').textContent = f(P, { weekday: 'long', day: 'numeric', month: 'short' });
    
    [['U', hu], ['P', hp]].forEach(function(x) {
      var s = st(x[1], ov), el = $('#s' + x[0]);
      el.textContent = s[0]; el.className = 'pill ' + s[1];
    });
    
    var off = (hp - hu + 24) % 24, a = (6 + off) % 24, w = 5 / 24 * 100;
    $('#ovb').style.left = a / 24 * 100 + '%';
    $('#ovb').style.width = Math.min(w, 100 - a / 24 * 100) + '%';
    $('#now').style.left = (hp + min(P, d) / 60) / 24 * 100 + '%';
    $('#ovt').textContent = 'Operational overlap: ' + String(a).padStart(2, '0') + ':00-' + String((a + 5) % 24).padStart(2, '0') + ':00 PHT / 06:00-11:00 UK (bar = 24h in PHT)';
  }

  function pht(t) { return t ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(t) + ' PHT' : '' }

  /* ---------- dispatch parser ---------- */
  function parse(txt) {
    return txt.split(/[.;\n]|,\s*and\s+|\s+and\s+(?=remind|book|send|schedule|call|email|chase)/i).map(function(s) { return s.trim() }).filter(Boolean).map(function(s, i) {
      var c = 'Admin / Scheduling';
      var k = [['Executive Search', /candidate|coo|ceo|cfo|hire|recruit|brief|cv|interview|shortlist/i], ['Travel & Dining', /book|flight|table|hotel|dinner|lunch|restaurant|train|taxi|travel/i], ['CRM Follow-up', /follow|nudge|chase|reply|investor|client|email/i]];
      k.some(function(r) { if (r[1].test(s)) { c = r[0]; return 1 } });
      
      var u = /urgent|asap|today|tonight|now|immediately/i.test(s) ? 'High' : /tomorrow|this week|tuesday|monday|wednesday|thursday|friday/i.test(s) ? 'Medium' : 'Low';
      return { id: 'tmp-' + Date.now() + '-' + i, t: s.charAt(0).toUpperCase() + s.slice(1), c: c, u: u, due: Date.now() + ({ High: 1, Medium: 6, Low: 24 })[u] * H, st: /remind me|sign.?off|approve|review/i.test(s) ? 'wait' : 'today' };
    });
  }

  /* ---------- render ---------- */
  function item(t, b) { return '<div class="it"><div>' + e(t.t) + '<small>' + e(t.c) + ' · ' + e(t.u) + ' · due ' + (t.due ? pht(t.due) : e(t.dtxt || 'not set')) + '</small></div><div>' + b + '</div></div>' }
  function bt(a, i, l, s) { return '<button data-a="' + a + '" data-i="' + e(i) + '"' + (s ? ' data-s="' + s + '"' : '') + '>' + l + '</button>' }
  
  function qr() {
    var g = { today: 'Today\'s Priorities', wait: 'Waiting on Founder', done: 'Completed' }, h = '';
    Object.keys(g).forEach(function(k) {
      h += '<h4>' + g[k] + '</h4>';
      var l = S.tasks.filter(function(t) { return t.st == k });
      if (!l.length) h += '<small>Nothing here</small>';
      l.forEach(function(t) {
        var b = k == 'done' ? bt('mv', t.id, 'Reopen', 'today') : bt('mv', t.id, 'Done', 'done') + (k == 'today' ? bt('mv', t.id, 'Founder', 'wait') : bt('mv', t.id, 'Back', 'today')) + bt('rm', t.id, '✕');
        h += item(t, b);
      });
    });
    $('#q').innerHTML = h;
  }

  function hrs(n) { return n.sent ? Math.floor((Date.now() - n.sent) / H) : 0 }
  function closed(n) { return /clos|won|lost|done/i.test(n.s || '') }
  
  function nr() {
    S.nudges.sort(function(a, b) { return (a.sent || 9e15) - (b.sent || 9e15) });
    $('#ng').innerHTML = S.nudges.map(function(n) {
      var h = hrs(n), late = !closed(n) && n.sent && h > 48;
      var bd = late ? '<span class="warn ' + (h > 72 ? 'late' : '') + '">Needs Nudge — ' + h + ' hrs</span>' : '<span class="pill">' + e(n.s) + (!closed(n) && n.sent ? ' · ' + h + ' hrs' : '') + '</span>';
      return '<div class="it"><div>' + e(n.n) + ' <small>' + e(n.o) + ' · ' + e(n.cat) + ' · last contact ' + (n.sent ? new Date(n.sent).toLocaleString('en-GB') : '—') + (n.step ? ' · next: ' + e(n.step) : '') + '</small></div><div>' + bd + ' ' + bt('ng', n.id, 'Nudge') + bt('cl', n.id, 'Close') + '</div></div>';
    }).join('') || '<small>No contacts</small>';
  }

  function cr() {
    S.content.sort(function(a, b) { return (a.date || 9e15) - (b.date || 9e15) });
    $('#cl').innerHTML = S.content.map(function(c) {
      return '<div class="it"><div>' + e(c.topic) + '<small>' + e(c.plat) + ' · ' + e(c.status) + ' · ' + (c.date ? new Date(c.date).toLocaleDateString('en-GB') : e(c.dtxt || 'unscheduled')) + ' · ' + e(c.author) + '</small><small>' + e((c.draft || '').slice(0, 120)) + '</small></div><div>' + bt('cc', c.id, 'Copy') + bt('cx', c.id, '✕') + '</div></div>';
    }).join('') || '<small>No posts planned</small>';
  }

  function fillSel(id, o, d) {
    var s = $(id), v = s.value;
    o = o && o.length ? o : d;
    s.innerHTML = o.map(function(x) { return '<option>' + e(x) + '</option>' }).join('');
    if (o.indexOf(v) > -1) s.value = v;
  }

  function fills() {
    fillSel('#nc', op('nudges', 'Category'), ['Candidate', 'Investor', 'Client', 'Vendor']);
    fillSel('#cp', op('content', 'Platform'), ['LinkedIn']);
    fillSel('#cs', op('content', 'Status'), ['Idea']);
  }

  function all() { qr(); nr(); cr(); }

  function nudgeMsg(n) {
    return 'Hi ' + String(n.n).split(' ')[0] + ', I hope you are well. I wanted to gently follow up on my note' + (n.sent ? ' of ' + new Date(n.sent).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : '') + ' regarding ' + n.o + '. Would you have a moment to share an update? Happy to work around your schedule. Many thanks.';
  }

  function cp(t, b) {
    var o = b.textContent;
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).catch(function() {
      var a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select();
      try { document.execCommand('copy') } catch (x) {} a.remove();
    }).then(function() {
      b.textContent = 'Copied ✓';
      setTimeout(function() { b.textContent = o }, 1500);
    });
  }

  function by(a, i) { return a.filter(function(x) { return String(x.id) == i })[0] }

  /* ---------- events ---------- */
  document.addEventListener('click', function(ev) {
    var b = ev.target.closest('button[data-a]');
    if (!b) return;
    var i = b.dataset.i, a = b.dataset.a, t;
    
    if (a == 'mv') { t = by(S.tasks, i); t.st = b.dataset.s; q('tasks', 'update', i, { Status: sv('tasks', t.st) }); }
    if (a == 'rm') { S.tasks = S.tasks.filter(function(t) { return String(t.id) != i }); q('tasks', 'delete', i); }
    if (a == 'cl') { t = by(S.nudges, i); t.s = 'Closed'; q('nudges', 'update', i, { Status: pk('nudges', 'Status', 'Closed', /clos/i) }); }
    if (a == 'ng') { t = by(S.nudges, i); $('#mt').textContent = nudgeMsg(t); $('#mc').dataset.i = i; $('#m').showModal(); return; }
    if (a == 'cx') { S.content = S.content.filter(function(c) { return String(c.id) != i }); q('content', 'delete', i); }
    if (a == 'cc') { cp(by(S.content, i).draft || '', b); return; }
    
    save(); all();
  });

  $('#mc').onclick = function() {
    var i = $('#mc').dataset.i, n = by(S.nudges, i);
    cp($('#mt').textContent, $('#mc'));
    n.s = 'Nudge Sent'; n.sent = Date.now();
    q('nudges', 'update', i, { Status: pk('nudges', 'Status', 'Nudge Sent', /nudge/i), 'Last Contact Date': iso(n.sent) });
    save(); all();
  };

  $('#mx').onclick = function() { $('#m').close() };

  $('#disp').onclick = function() {
    var v = $('#bd').value.trim();
    if (!v) return;
    parse(v).forEach(function(t) {
      S.tasks.push(t);
      q('tasks', 'add', t.id, {
        'Submitter': pk('tasks', 'Submitter', S.role, new RegExp(S.role, 'i')),
        'Category': pk('tasks', 'Category', t.c, CRX[t.c]),
        'Urgency': pk('tasks', 'Urgency', t.u),
        'Task Description': t.t,
        'Status': sv('tasks', t.st),
        'Assignee': pk('tasks', 'Assignee', 'EA', /ea|assoc|manila/i),
        'Due Date': iso(t.due)
      });
    });
    $('#bd').value = ''; save(); all();
  };

  $('#na').onclick = function() {
    var n = $('#nn').value.trim();
    if (!n) return;
    var x = { id: 'tmp-' + Date.now(), n: n, o: $('#no').value.trim() || '—', cat: $('#nc').value, sent: Date.now(), s: 'Awaiting Reply' };
    S.nudges.push(x);
    q('nudges', 'add', x.id, {
      'Contact Name': x.n,
      'Organization': x.o,
      'Category': pk('nudges', 'Category', x.cat),
      'Last Contact Date': iso(x.sent),
      'Status': pk('nudges', 'Status', 'Awaiting Reply', /await|pending|wait/i),
      'Assigned To': pk('nudges', 'Assigned To', 'EA', /ea|assoc/i)
    });
    $('#nn').value = $('#no').value = ''; save(); all();
  };

  $('#ca').onclick = function() {
    var tp = $('#ct').value.trim();
    if (!tp) return;
    var d = $('#cd').value, x = { id: 'tmp-' + Date.now(), date: d ? Date.parse(d) : null, topic: tp, draft: $('#cb').value.trim(), status: $('#cs').value, plat: $('#cp').value, author: S.role };
    S.content.push(x);
    q('content', 'add', x.id, {
      'Publish Date': d ? d + 'T09:00:00' : '',
      'Angle/Topic': x.topic,
      'Draft Content': x.draft,
      'Status': x.status,
      'Platform': x.plat,
      'Author': pk('content', 'Author', S.role, new RegExp(S.role, 'i'))
    });
    $('#ct').value = $('#cb').value = $('#cd').value = ''; save(); all();
  };

  $('#ho').onclick = function() {
    var d = S.tasks.filter(function(t) { return t.st == 'done' });
    var w = S.tasks.filter(function(t) { return t.st == 'wait' });
    var p = S.tasks.filter(function(t) { return t.st == 'today' });
    var nd = S.nudges.filter(function(n) { return !closed(n) && hrs(n) > 48 });
    
    function L(a, f) { return a.length ? a.map(f).join('\n') : '_None_' }
    
    var m = '*SyncShift Daily Handover — ' + new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) + '*\n\n*✅ Completed*\n' + L(d, function(t) { return '• ' + t.t }) + '\n\n*⏳ Waiting on Founder*\n' + L(w, function(t) { return '• ' + t.t }) + '\n\n*🎯 Still Open*\n' + L(p, function(t) { return '• ' + t.t + ' (' + t.u + ')' }) + '\n\n*🔔 Nudges Flagged (>48h)*\n' + L(nd, function(n) { return '• ' + n.n + ' (' + n.o + ') — ' + hrs(n) + ' hrs' });
    cp(m, $('#ho'));
  };

  $('#th').onclick = function() {
    var d = document.documentElement, c = d.dataset.theme || (matchMedia('(prefers-color-scheme:light)').matches ? 'light' : 'dark');
    S.theme = d.dataset.theme = c == 'dark' ? 'light' : 'dark';
    save();
  };

  $('#role').onchange = function() { S.role = $('#role').value; save(); };
  $('#sy').onclick = function() { metaOk = 0; sync(); };

  var SR = window.SpeechRecognition || window.webkitSpeechRecognition, rec = null;
  if (!SR) {
    $('#mic').hidden = true;
    $('#mn').textContent = 'Speech not supported here — type your brain dump.';
  } else {
    $('#mic').onclick = function() {
      if (rec) { rec.stop(); return; }
      rec = new SR();
      rec.lang = 'en-GB';
      rec.interimResults = false;
      rec.continuous = true;
      
      rec.onresult = function(r) {
        for (var i = r.resultIndex; i < r.results.length; i++) {
          if (r.results[i].isFinal) $('#bd').value += (($('#bd').value ? ' ' : '') + r.results[i][0].transcript.trim() + '.');
        }
      };
      
      // FIX: Ensure the microphone button resets completely on error
      rec.onerror = function(x) {
        $('#mn').textContent = 'Mic unavailable (' + x.error + ') — type instead.';
        rec = null;
        $('#mic').textContent = '🎙 Record';
        $('#mic').classList.remove('rec');
      };
      
      rec.onend = function() {
        rec = null;
        $('#mic').textContent = '🎙 Record';
        $('#mic').classList.remove('rec');
      };
      
      $('#mic').textContent = '■ Stop';
      $('#mic').classList.add('rec');
      try { rec.start() } catch (x) {}
    };
  }

  load();
  $('#role').value = S.role;
  fills();
  all();
  tick();
  setInterval(tick, 1000);
  setInterval(nr, 60000);
  
  if (live) {
    setSt('⟳ Connecting…');
    sync();
    setInterval(sync, 30000);
    addEventListener('online', sync);
    document.addEventListener('visibilitychange', function() { if (!document.hidden) sync() });
  } else {
    setSt('Local-only mode');
  }
})();
