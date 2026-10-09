(function() {
  var CFG = {
    url: 'https://script.google.com/macros/s/AKfycby728XzmUfVQuspxvmtyGXcOztGiJZDBdYi-RaE94UxLaDdqKcybK4GfiR1GJ1IEVuJ/exec',
    token: 'blue-falcon-manila-7342-orbit'
  }; 
  
  var $ = function(s) { return document.querySelector(s) };
  var K = 'syncshift.v3', H = 3600000, S;
  var live = !!CFG.url, busy = 0, metaOk = 0, err = '';
  
  var CRX = { 'Travel & Dining': /travel|dining|book/i, 'Executive Search': /exec|search|recruit|hire|candidate/i, 'CRM Follow-up': /crm|follow|nudge/i, 'Admin / Scheduling': /admin|sched/i };
  var ST = { today: /to ?do|new|open|progress|pending|priority|today|queue|not started/i, wait: /wait|founder|review|block|hold/i, done: /done|complete|closed/i };

  function e(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] }); }
  function save() { try { localStorage.setItem(K, JSON.stringify(S)) } catch (x) {} }
  function load() {
    try { S = JSON.parse(localStorage.getItem(K)) } catch (x) {}
    if (!S) S = { tasks: [], nudges: [], content: [], outbox: [], map: {}, meta: {}, role: 'EA', theme: '' };
    if (S.theme) document.documentElement.dataset.theme = S.theme;
  }

  function j(r) {
    if (!r.ok) throw new Error("Network error: " + r.status);
    return r.json().then(function(x) { if (x && x.error) throw new Error(x.error); return x; }).catch(function() { throw new Error("Invalid response."); });
  }

  function api(route, body) {
    if (!body) return fetch(CFG.url + '?route=' + route + '&token=' + encodeURIComponent(CFG.token)).then(j);
    return fetch(CFG.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ token: CFG.token, route: route }, body)) }).then(j);
  }

  function op(r, f) { return (S.meta[r] || {})[f] || [] }
  function pk(r, f, want, rx) {
    var o = op(r, f);
    if (!o.length) return want;
    var w = String(want).toLowerCase(), i;
    for (i = 0; i < o.length; i++) if (String(o[i]).toLowerCase() === w) return o[i];
    if (rx) for (i = 0; i < o.length; i++) if (rx.test(o[i])) return o[i];
    return o[0];
  }

  function sv(r, s) { return pk(r, 'Status', s, ST[s]) }
  function stOf(s) { s = String(s || ''); return ST.done.test(s) ? 'done' : ST.wait.test(s) ? 'wait' : 'today' }
  function ts(v) { var t = Date.parse(v); return isNaN(t) ? null : t }
  function iso(t) { return new Date(t).toISOString() }
  function getPri(u) { return u === 'High' ? '🔴 High' : (u === 'Medium' ? '🟡 Medium' : '🟢 Low'); }

  function mT(r) { return { id: String(r['Task ID']), t: r['Task Description'], c: r.Category, u: r.Urgency, due: ts(r['Due Date']), dtxt: r['Due Date'], st: stOf(r.Status), sub: r.Submitter } }
  function mN(r) { return { id: String(r['Contact ID']), n: r['Contact Name'], o: r.Organization, cat: r.Category, sent: ts(r['Last Contact Date']), s: r.Status, step: r['Next Action'], url: r['LinkedIn URL'] } }
  function mC(r) { return { id: String(r['Post ID']), date: ts(r['Publish Date']), dtxt: r['Publish Date'], topic: r['Angle/Topic'], draft: r['Draft Content'], status: r.Status, type: r['Post Type'], aud: r['Target Audience'], goal: r['Engagement Goal'], voice: r['Voice Check'] } }

  function getMeta() {
    if (metaOk) return Promise.resolve();
    return Promise.all(['tasks', 'nudges', 'content'].map(function(r) { return fetch(CFG.url + '?route=' + r + '&action=meta&token=' + encodeURIComponent(CFG.token)).then(j); }))
      .then(function(m) { S.meta = { tasks: m[0], nudges: m[1], content: m[2] }; metaOk = 1; save(); fills(); }, function() { metaOk = 1; });
  }

  function flush() {
    var p = Promise.resolve();
    S.outbox.slice().forEach(function(o) {
      p = p.then(function() {
        var id = o.id && S.map[o.id] ? S.map[o.id] : o.id;
        if (o.a != 'add' && String(id).indexOf('tmp-') == 0) { S.outbox.shift(); save(); return; }
        return api(o.r, o.a == 'add' ? { data: o.data } : { action: o.a, id: id, data: o.data }).then(function(x) {
          if (o.a == 'add') S.map[o.id] = x.id;
          S.outbox.shift(); save();
        }, function(x) { S.outbox.shift(); save(); err = 'Sheet rejected: ' + x.message; });
      });
    });
    return p;
  }

  function setSt(t) { if($('#sy')) $('#sy').textContent = t; }

  function sync() {
    if (!live || busy) return Promise.resolve();
    busy = 1; err = ''; setSt('⟳ Syncing…');
    return getMeta().then(flush).then(function() { return Promise.all([api('tasks'), api('nudges'), api('content')]); }).then(function(r) {
      function keep(a) { return a.filter(function(x) { return S.outbox.some(function(o) { return o.id == x.id }) }) }
      S.tasks = r[0].map(mT).filter(function(t) { return t.t }).concat(keep(S.tasks));
      S.nudges = r[1].map(mN).filter(function(n) { return n.n }).concat(keep(S.nudges));
      S.content = r[2].map(mC).filter(function(c) { return c.topic || c.draft }).concat(keep(S.content));
      save(); all(); setSt(err ? '⚠ ' + err : '● Synced ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    }).catch(function(x) { setSt(x instanceof TypeError ? '○ Offline — changes queued' : '⚠ ' + x.message); all(); }).then(function() { busy = 0 });
  }

  function q(r, a, id, data) { if (!live) return; S.outbox.push({ r: r, a: a, id: id, data: data }); save(); sync(); }

  function hr(z, d) { return +new Intl.DateTimeFormat('en-GB', { timeZone: z, hour: '2-digit', hourCycle: 'h23' }).format(d) }
  function min(z, d) { return +new Intl.DateTimeFormat('en-GB', { timeZone: z, minute: '2-digit' }).format(d) }
  function st(h, ov) { return ov ? ['Core Overlap', 'o'] : (h >= 7 && h < 22 ? ['Deep Work', ''] : ['Off-Hours / Sleeping', 's']) }
  
  function tick() {
    var d = new Date(), U = 'Europe/London', P = 'Asia/Manila', hu = hr(U, d), hp = hr(P, d), ov = hu >= 6 && hu < 11;
    function f(z, o) { return new Intl.DateTimeFormat('en-GB', Object.assign({ timeZone: z }, o)).format(d) }
    
    if(!$('#tU')) return;
    
    $('#tU').textContent = f(U, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    $('#tP').textContent = f(P, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    $('#dU').textContent = f(U, { weekday: 'long', day: 'numeric', month: 'short' });
    $('#dP').textContent = f(P, { weekday: 'long', day: 'numeric', month: 'short' });
    [['U', hu], ['P', hp]].forEach(function(x) { var s = st(x[1], ov), el = $('#s' + x[0]); el.textContent = s[0]; el.className = 'pill ' + s[1]; });
    
    var off = (hp - hu + 24) % 24, a = (6 + off) % 24, w = 5 / 24 * 100;
    $('#ovb').style.left = a / 24 * 100 + '%'; $('#ovb').style.width = Math.min(w, 100 - a / 24 * 100) + '%';
    $('#now').style.left = (hp + min(P, d) / 60) / 24 * 100 + '%';
    
    var banner = $('#overlap-banner');
    if(banner) {
      if (ov) { banner.textContent = '⚡ Core overlap active — good time for live calls or quick decisions.'; banner.style.background = 'var(--ph)'; banner.style.color = '#04141a'; } 
      else { banner.textContent = '🌙 Outside overlap — Founder/EA sleeping. Auto-queueing non-urgent items.'; banner.style.background = 'var(--b)'; banner.style.color = 'var(--t)'; }
    }
  }

  function pht(t) { return t ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(t) + ' PHT' : '' }

  function parse(txt) {
    return txt.split(/[.;\n]|,\s*and\s+|\s+and\s+(?=remind|book|send|schedule|call|email|chase)/i).map(function(s) { return s.trim() }).filter(Boolean).map(function(s, i) {
      var c = 'Admin / Scheduling';
      var k = [['Executive Search', /candidate|coo|ceo|cfo|hire|recruit|brief|cv|interview|shortlist/i], ['Travel & Dining', /book|flight|table|hotel|dinner|lunch|restaurant|train|taxi|travel/i], ['CRM Follow-up', /follow|nudge|chase|reply|investor|client|email/i]];
      k.some(function(r) { if (r[1].test(s)) { c = r[0]; return 1 } });
      var u = /urgent|asap|today|tonight|now|immediately/i.test(s) ? 'High' : /tomorrow|this week|tuesday|monday|wednesday|thursday|friday/i.test(s) ? 'Medium' : 'Low';
      return { id: 'tmp-' + Date.now() + '-' + i, t: s.charAt(0).toUpperCase() + s.slice(1), c: c, u: u, due: Date.now() + ({ High: 1, Medium: 6, Low: 24 })[u] * H, st: /remind me|sign.?off|approve|review/i.test(s) ? 'wait' : 'today' };
    });
  }

  function item(t, b) { return '<div class="it"><div>' + e(t.t) + '<small>' + e(t.c) + ' · ' + getPri(t.u) + ' · due ' + (t.due ? pht(t.due) : e(t.dtxt || 'not set')) + '</small></div><div>' + b + '</div></div>' }
  function bt(a, i, l, s) { return '<button data-a="' + a + '" data-i="' + e(i) + '"' + (s ? ' data-s="' + s + '"' : '') + ' class="' + (a==='pub'?'pri':'') + '">' + l + '</button>' }
  
  function qr() {
    var g = { today: 'Today\'s Priorities', wait: 'Needs Founder Decision', done: 'Completed' }, h = '';
    Object.keys(g).forEach(function(k) {
      h += '<h4>' + g[k] + '</h4>';
      var l = S.tasks.filter(function(t) { return t.st == k });
      
      // FEATURE: Empty-State Onboarding Polish
      if (!l.length) {
        if (k === 'today') {
          h += '<div class="it" style="background:var(--bg); border: 1px dashed var(--b); border-radius: 8px; padding: 12px; text-align: center;"><small>💡 <b>Quick Tip:</b> Use the Brain Dump above to add your first task. Try typing: <i>"Book a flight to Manila for next Friday."</i></small></div>';
        } else {
          h += '<small>Nothing here</small>';
        }
      }
      
      l.forEach(function(t) {
        var b = k == 'done' ? bt('mv', t.id, 'Reopen', 'today') : bt('mv', t.id, 'Done', 'done') + (k == 'today' ? bt('mv', t.id, 'Escalate to Founder', 'wait') : bt('mv', t.id, 'Back', 'today')) + bt('rm', t.id, '✕');
        h += item(t, b);
      });
    });
    if($('#q')) $('#q').innerHTML = h;
  }

  function hrs(n) { return n.sent ? Math.floor((Date.now() - n.sent) / H) : 0 }
  function closed(n) { return /clos|won|lost|done|booked/i.test(n.s || '') }
  
  function nr() {
    S.nudges.sort(function(a, b) { return (a.sent || 9e15) - (b.sent || 9e15) });
    if($('#ng')) $('#ng').innerHTML = S.nudges.map(function(n) {
      var h = hrs(n), late = !closed(n) && n.sent && h > 48;
      // FEATURE: Color escalation: amber at 48 h, red at 72 h
      var bd = late ? '<span class="warn ' + (h > 72 ? 'late' : '') + '">' + (h > 72 ? '🔴 CRITICAL: ' : '🟠 Overdue: ') + h + ' hrs</span>' : '<span class="pill">' + e(n.s) + (!closed(n) && n.sent ? ' · ' + h + ' hrs' : '') + '</span>';
      
      // FEATURE: Nudge Tracker Quick Actions (Replied, Meeting Booked)
      var acts = bt('ng', n.id, 'Copy Nudge msg') + (!closed(n) ? bt('nrep', n.id, 'Replied') + bt('nbk', n.id, 'Booked') : '') + bt('cl', n.id, 'Close');
      
      return '<div class="it"><div>' + e(n.n) + ' <small>' + e(n.o) + ' · ' + e(n.cat) + ' · ' + (n.sent ? new Date(n.sent).toLocaleString('en-GB') : '—') + (n.step ? ' · Action: ' + e(n.step) : '') + (n.url ? ' · <a href="'+e(n.url)+'" target="_blank">LinkedIn</a>' : '') + '</small></div><div>' + bd + ' ' + acts + '</div></div>';
    }).join('') || '<div class="it" style="background:var(--bg); border: 1px dashed var(--b); border-radius: 8px; padding: 12px; text-align: center;"><small>💡 <b>No contacts tracked yet.</b> Add an Investor or Candidate below to start tracking follow-ups.</small></div>';
  }

  function cr() {
    S.content.sort(function(a, b) { return (a.date || 9e15) - (b.date || 9e15) });
    if($('#cl')) $('#cl').innerHTML = S.content.map(function(c) {
      var statusColor = c.status === 'Published' ? 'border-left: 4px solid #2ecc71;' : (c.status === 'Scheduled' ? 'border-left: 4px solid var(--ph);' : 'border-left: 4px solid var(--b);');
      
      // FEATURE: True pipeline states & One-click "Mark Published"
      var actions = '';
      if(c.status !== 'Published') actions += bt('pub', c.id, '🚀 Mark Published');
      actions += bt('cc', c.id, 'Copy') + bt('cx', c.id, '✕');
      
      return '<div class="it" style="' + statusColor + ' padding-left: 10px;"><div>' + e(c.topic) + '<small><b>' + e(c.status) + '</b> · ' + e(c.type || 'Post') + ' · ' + (c.date ? new Date(c.date).toLocaleDateString('en-GB') : e(c.dtxt || 'unscheduled')) + (c.voice === 'Yes' ? ' · ✅ Voice Checked' : '') + '</small><small>' + e((c.draft || '').slice(0, 120)) + '</small></div><div>' + actions + '</div></div>';
    }).join('') || '<div class="it" style="background:var(--bg); border: 1px dashed var(--b); border-radius: 8px; padding: 12px; text-align: center;"><small>💡 <b>Content Pipeline Empty.</b> Draft your first post below.</small></div>';
  }

  function renderAnalytics() {
    var an = $('#analytics-content');
    if (!an) return;
    var dC = S.tasks.filter(function(t) { return t.st == 'done' }).length;
    var pC = S.content.filter(function(c) { return c.status == 'Published' }).length;
    var nC = S.nudges.filter(function(n) { return closed(n) }).length;
    an.innerHTML = '<div class="row" style="gap:12px"><div class="clk ph"><h3>Tasks Done</h3><div class="t">' + dC + '</div></div><div class="clk uk"><h3>Posts Published</h3><div class="t">' + pC + '</div></div><div class="clk ph"><h3>Nudges Resolved</h3><div class="t">' + nC + '</div></div></div>';
  }

  function fillSel(id, o, d) { var s = $(id); if (!s) return; var v = s.value; o = o && o.length ? o : d; s.innerHTML = o.map(function(x) { return '<option>' + e(x) + '</option>' }).join(''); if (o.indexOf(v) > -1) s.value = v; }
  function fills() { fillSel('#nc', op('nudges', 'Category'), ['Candidate', 'Investor', 'Client', 'Vendor']); }
  function all() { qr(); nr(); cr(); renderAnalytics(); }

  function nudgeMsg(n) { return 'Hi ' + String(n.n).split(' ')[0] + ', I hope you are well. I wanted to gently follow up on my note' + (n.sent ? ' of ' + new Date(n.sent).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : '') + ' regarding ' + n.o + '. Would you have a moment to share an update? Happy to work around your schedule. Many thanks.'; }
  function cp(t, b) { var o = b.textContent; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).catch(function() { var a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy') } catch (x) {} a.remove(); }).then(function() { b.textContent = 'Copied ✓'; setTimeout(function() { b.textContent = o }, 1500); }); }
  function by(a, i) { return a.filter(function(x) { return String(x.id) == i })[0] }

  document.addEventListener('click', function(ev) {
    var b = ev.target.closest('button[data-a]');
    if (!b) return;
    var i = b.dataset.i, a = b.dataset.a, t;
    if (a == 'mv') { t = by(S.tasks, i); t.st = b.dataset.s; q('tasks', 'update', i, { Status: sv('tasks', t.st) }); }
    if (a == 'rm') { S.tasks = S.tasks.filter(function(t) { return String(t.id) != i }); q('tasks', 'delete', i); }
    if (a == 'cl') { t = by(S.nudges, i); t.s = 'Closed'; q('nudges', 'update', i, { Status: pk('nudges', 'Status', 'Closed', /clos/i) }); }
    if (a == 'nrep') { t = by(S.nudges, i); t.s = 'Replied'; q('nudges', 'update', i, { Status: 'Replied' }); }
    if (a == 'nbk') { t = by(S.nudges, i); t.s = 'Meeting booked'; q('nudges', 'update', i, { Status: 'Meeting booked' }); }
    if (a == 'ng') { t = by(S.nudges, i); $('#mt').textContent = nudgeMsg(t); $('#mc').dataset.i = i; $('#m').showModal(); return; }
    if (a == 'cx') { S.content = S.content.filter(function(c) { return String(c.id) != i }); q('content', 'delete', i); }
    if (a == 'cc') { cp(by(S.content, i).draft || '', b); return; }
    // FEATURE: One-click "Mark Published"
    if (a == 'pub') { t = by(S.content, i); t.status = 'Published'; q('content', 'update', i, { Status: 'Published' }); }
    save(); all();
  });

  if($('#mc')) $('#mc').onclick = function() { var i = $('#mc').dataset.i, n = by(S.nudges, i); cp($('#mt').textContent, $('#mc')); n.s = 'Contacted'; n.sent = Date.now(); q('nudges', 'update', i, { Status: 'Contacted', 'Last Contact Date': iso(n.sent) }); save(); all(); };
  if($('#mx')) $('#mx').onclick = function() { $('#m').close() };

  if($('#disp')) $('#disp').onclick = function() {
    var v = $('#bd').value.trim(); if (!v) return;
    parse(v).forEach(function(t) {
      S.tasks.push(t);
      q('tasks', 'add', t.id, { 'Submitter': pk('tasks', 'Submitter', S.role, new RegExp(S.role, 'i')), 'Category': pk('tasks', 'Category', t.c, CRX[t.c]), 'Urgency': pk('tasks', 'Urgency', t.u), 'Task Description': t.t, 'Status': sv('tasks', t.st), 'Assignee': pk('tasks', 'Assignee', 'EA', /ea|assoc|manila/i), 'Due Date': iso(t.due) });
    });
    $('#bd').value = ''; save(); all();
  };

  if($('#na')) $('#na').onclick = function() {
    var n = $('#nn').value.trim(); if (!n) return;
    var x = { id: 'tmp-' + Date.now(), n: n, o: $('#no').value.trim() || '—', cat: $('#nc').value, sent: Date.now(), s: 'Contacted', step: $('#nna').value.trim(), url: $('#nurl').value.trim() };
    S.nudges.push(x);
    q('nudges', 'add', x.id, { 'Contact Name': x.n, 'Organization': x.o, 'Category': pk('nudges', 'Category', x.cat), 'Last Contact Date': iso(x.sent), 'Status': 'Contacted', 'Assigned To': pk('nudges', 'Assigned To', 'EA', /ea|assoc/i), 'Next Action': x.step, 'LinkedIn URL': x.url });
    $('#nn').value = $('#no').value = $('#nna').value = $('#nurl').value = ''; save(); all();
  };

  if($('#ca')) $('#ca').onclick = function() {
    var tp = $('#ct').value.trim(); if (!tp) return;
    var d = $('#cd').value, x = { id: 'tmp-' + Date.now(), date: d ? Date.parse(d) : null, topic: tp, draft: $('#cb').value.trim(), status: 'Draft', type: $('#cpt').value, aud: $('#cta').value.trim(), goal: $('#ceg').value.trim(), voice: $('#cvc').checked ? 'Yes' : 'No', author: S.role };
    S.content.push(x);
    q('content', 'add', x.id, { 'Publish Date': d ? d + 'T09:00:00' : '', 'Angle/Topic': x.topic, 'Draft Content': x.draft, 'Status': x.status, 'Platform': 'LinkedIn', 'Post Type': x.type, 'Target Audience': x.aud, 'Engagement Goal': x.goal, 'Voice Check': x.voice, 'Author': pk('content', 'Author', S.role, new RegExp(S.role, 'i')) });
    $('#ct').value = $('#cb').value = $('#cd').value = $('#cta').value = $('#ceg').value = ''; $('#cvc').checked = false; save(); all();
  };

  // FEATURE: Enriched Daily Handover Output
  if($('#ho')) $('#ho').onclick = function() {
    var d = S.tasks.filter(function(t) { return t.st == 'done' }), w = S.tasks.filter(function(t) { return t.st == 'wait' }), p = S.tasks.filter(function(t) { return t.st == 'today' }), nd = S.nudges.filter(function(n) { return !closed(n) && hrs(n) > 48 }), pc = S.content.filter(function(c) { return c.status == 'Published' });
    function L(a, f) { return a.length ? a.map(f).join('\n') : '_None_' }
    var m = '*SyncShift Daily Handover — ' + new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) + '*\n\n' +
            '*✅ Completed Tasks*\n' + L(d, function(t) { return '• ' + t.t }) + '\n\n' +
            '*📈 LinkedIn Activity*\n• ' + pc.length + ' posts successfully published today.\n\n' +
            '*🚨 Escalated (Needs Founder Decision)*\n' + L(w, function(t) { return '• ' + t.t }) + '\n\n' +
            '*🎯 Suggested Priorities for Tomorrow*\n' + L(p.slice(0, 3), function(t) { return '• ' + t.t + ' (' + t.u + ')' }) + '\n\n' +
            '*🔔 Overdue CRM Nudges (>48h)*\n' + L(nd, function(n) { return '• ' + n.n + ' (' + n.o + ') — ' + hrs(n) + ' hrs' });
    cp(m, $('#ho'));
  };

  if($('#th')) $('#th').onclick = function() { var d = document.documentElement, c = d.dataset.theme || (matchMedia('(prefers-color-scheme:light)').matches ? 'light' : 'dark'); S.theme = d.dataset.theme = c == 'dark' ? 'light' : 'dark'; save(); };
  if($('#role')) $('#role').onchange = function() { S.role = $('#role').value; save(); };
  if($('#sy')) $('#sy').onclick = function() { metaOk = 0; sync(); };

  var SR = window.SpeechRecognition || window.webkitSpeechRecognition, rec = null;
  if (!SR) { if($('#mic')) { $('#mic').hidden = true; $('#mn').textContent = 'Voice input not supported.'; } }
  else {
    if($('#mic')) $('#mic').onclick = function() {
      if (rec) { rec.stop(); return; }
      rec = new SR(); rec.lang = 'en-GB'; rec.interimResults = false; rec.continuous = true;
      rec.onresult = function(r) { for (var i = r.resultIndex; i < r.results.length; i++) if (r.results[i].isFinal) $('#bd').value += (($('#bd').value ? ' ' : '') + r.results[i][0].transcript.trim() + '.'); };
      rec.onerror = rec.onend = function() { rec = null; $('#mic').textContent = '🎙 Record'; $('#mic').classList.remove('rec'); };
      $('#mic').textContent = '■ Stop'; $('#mic').classList.add('rec'); try { rec.start() } catch (x) {}
    };
  }

  var qa1 = $('#qa1'), qa2 = $('#qa2'), qa3 = $('#qa3'), qa4 = $('#qa4');
  if(qa1) qa1.onclick = function() { $('#bd').value = 'Prepare candidate brief for: '; };
  if(qa2) qa2.onclick = function() { $('#bd').value = 'Research company / prospect: '; };
  if(qa3) qa3.onclick = function() { $('#bd').value = 'Book meeting / restaurant: '; };
  if(qa4) qa4.onclick = function() { $('#bd').value = 'LinkedIn engagement batch: '; };
  
  load(); 
  if($('#role')) $('#role').value = S.role; 
  fills(); all(); tick(); setInterval(tick, 1000); setInterval(nr, 60000);
  if (live) { setSt('⟳ Connecting…'); sync(); setInterval(sync, 30000); addEventListener('online', sync); document.addEventListener('visibilitychange', function() { if (!document.hidden) sync() }); } else setSt('Local-only mode');
})();
