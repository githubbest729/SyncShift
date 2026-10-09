(function(){
  var $ = function(s) { return document.querySelector(s) };
  var K = 'syncshift.v1';
  var H = 3600000;
  
  // ==========================================
  // CONFIGURATION
  // ==========================================
  var SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzQy4wI0bWjX0vQ1kY0H9vG7U3tN8P2Z5T4/exec'; // You must update this if you deployed a new Apps Script version
  var TOKEN = 'blue-falcon-manila-7342-orbit';
  
  var S = { tasks: [], nudges: [], content: [], theme: '', role: 'EA', offlineQueue: [] };

  function e(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c] }) }
  
  function save() {
    try { localStorage.setItem(K, JSON.stringify(S)) } catch(x){}
  }

  function load() {
    try {
      var saved = JSON.parse(localStorage.getItem(K));
      if (saved) {
        S.tasks = saved.tasks || [];
        S.nudges = saved.nudges || [];
        S.content = saved.content || [];
        S.theme = saved.theme || '';
        S.role = saved.role || 'EA';
        S.offlineQueue = saved.offlineQueue || [];
      }
    } catch(x){}
    if (S.theme) document.documentElement.dataset.theme = S.theme;
  }

  // ==========================================
  // API SYNC ENGINE
  // ==========================================
  var isSyncing = false;
  
  function apiCall(action, route, data) {
    if (!SCRIPT_URL) return Promise.reject('No URL configured');
    
    var payload = {
      token: TOKEN,
      action: action,
      route: route
    };
    if (data) payload.data = data;

    return fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      headers: { 'Content-Type': 'text/plain' }, // Using text/plain avoids CORS preflight issues with Apps Script
      body: JSON.stringify(payload)
    })
    .then(function(res) {
      if (!res.ok) throw new Error('Network response was not ok');
      return res.json();
    })
    .then(function(json) {
      if (json.error) throw new Error(json.error);
      return json;
    });
  }

  function processQueue() {
    if (S.offlineQueue.length === 0 || !navigator.onLine || isSyncing) return;
    
    var item = S.offlineQueue[0];
    isSyncing = true;
    
    apiCall('add', item.route, item.data)
      .then(function() {
        S.offlineQueue.shift(); // Remove successful item
        save();
        isSyncing = false;
        processQueue(); // Try next item
      })
      .catch(function(err) {
        console.error('Queue sync failed:', err);
        isSyncing = false;
      });
  }

  function syncDown() {
    if (!navigator.onLine || isSyncing) return;
    isSyncing = true;
    
    Promise.all([
      apiCall('list', 'tasks'),
      apiCall('list', 'nudges')
    ])
    .then(function(results) {
      var remoteTasks = results[0];
      var remoteNudges = results[1];
      
      // Update local state if remote has data
      if (remoteTasks && remoteTasks.length > 0) {
        S.tasks = remoteTasks.map(function(rt) {
          return {
            id: rt['Task ID'],
            t: rt['Task Description'],
            c: rt['Category'],
            u: rt['Urgency'],
            due: new Date(rt['Due Date']).getTime() || (Date.now() + H),
            st: rt['Status'] === 'Completed' ? 'done' : (rt['Status'] === 'Waiting on Founder' ? 'wait' : 'today')
          };
        });
      }
      
      save();
      all();
      isSyncing = false;
      processQueue();
    })
    .catch(function(err) {
      console.error('Sync down failed:', err);
      isSyncing = false;
    });
  }

  function dispatchToAPI(route, mappedData) {
    if (navigator.onLine) {
      apiCall('add', route, mappedData).catch(function(err) {
        console.error('Direct dispatch failed, queuing:', err);
        S.offlineQueue.push({ route: route, data: mappedData });
        save();
      });
    } else {
      S.offlineQueue.push({ route: route, data: mappedData });
      save();
    }
  }

  // ==========================================
  // UI LOGIC & PARSING
  // ==========================================
  function hr(z,d){ return +new Intl.DateTimeFormat('en-GB',{timeZone:z,hour:'2-digit',hourCycle:'h23'}).format(d) }
  function min(z,d){ return +new Intl.DateTimeFormat('en-GB',{timeZone:z,minute:'2-digit'}).format(d) }
  function st(h,ov){ return ov?['Core Overlap','o']:(h>=7&&h<22?['Deep Work','']:['Off-Hours / Sleeping','s']) }
  
  function tick(){
    var d=new Date(),U='Europe/London',P='Asia/Manila',hu=hr(U,d),hp=hr(P,d),ov=hu>=6&&hu<11;
    function f(z,o){return new Intl.DateTimeFormat('en-GB',Object.assign({timeZone:z},o)).format(d)}
    
    $('#tU').textContent=f(U,{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    $('#tP').textContent=f(P,{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    $('#dU').textContent=f(U,{weekday:'long',day:'numeric',month:'short'});
    $('#dP').textContent=f(P,{weekday:'long',day:'numeric',month:'short'});
    
    [['U',hu],['P',hp]].forEach(function(x){
      var s=st(x[1],ov),el=$('#s'+x[0]);
      if(el) { el.textContent=s[0]; el.className='pill '+s[1]; }
    });
  }

  function pht(t){ return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Manila',weekday:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(t))+' PHT' }
  
  function rq(){ return [['Executive Search',/candidate|coo|ceo|cfo|hire|recruit|brief|cv|interview|shortlist/i],['Travel & Dining',/book|flight|table|hotel|dinner|lunch|restaurant|train|taxi|travel/i],['CRM Follow-up',/follow|nudge|chase|reply|investor|client|email/i]] }
  
  function parse(txt){
    return txt.split(/[.;\n]|,\s*and\s+|\s+and\s+(?=remind|book|send|schedule|call|email|chase)/i)
      .map(function(s){return s.trim()})
      .filter(Boolean)
      .map(function(s){
        var c='Admin / Scheduling';
        rq().some(function(r){if(r[1].test(s)){c=r[0];return 1}});
        var u=/urgent|asap|today|tonight|now|immediately/i.test(s)?'High':/tomorrow|this week|tuesday|monday|wednesday|thursday|friday/i.test(s)?'Medium':'Low';
        var isWait = /remind me|sign.?off|approve|review/i.test(s);
        
        var tObj = {
          id: Date.now()+Math.random(),
          t: s.charAt(0).toUpperCase()+s.slice(1),
          c: c,
          u: u,
          due: Date.now()+({High:1,Medium:6,Low:24})[u]*H,
          st: isWait ? 'wait' : 'today'
        };
        
        // Push to Sheet
        dispatchToAPI('tasks', {
          'Task ID': tObj.id,
          'Submitter': S.role,
          'Category': tObj.c,
          'Urgency': tObj.u,
          'Task Description': tObj.t,
          'Status': isWait ? 'Waiting on Founder' : 'Pending',
          'Due Date': new Date(tObj.due).toISOString()
        });
        
        return tObj;
    });
  }

  function item(t,b){ return '<div class="it"><div>'+e(t.t)+'<small>'+e(t.c)+' · '+t.u+' · due '+pht(t.due)+'</small></div><div>'+b+'</div></div>' }
  
  function qr(){
    var qEl
