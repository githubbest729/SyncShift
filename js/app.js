(function(){
var $=function(s){return document.querySelector(s)},K='syncshift.v1',H=36e5,S;
function e(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function save(){try{localStorage.setItem(K,JSON.stringify(S))}catch(x){}}
function load(){try{S=JSON.parse(localStorage.getItem(K))}catch(x){}
if(!S){var n=Date.now();S={tasks:[{id:1,t:'Book flight LHR to MNL, window seat',c:'Travel & Dining',u:'High',due:n+H,st:'today'},{id:2,t:'Table for two at Dishoom London, Tuesday 7 PM',c:'Travel & Dining',u:'Medium',due:n+6*H,st:'today'}],
nudges:[{id:1,n:'Sarah Chen',o:'Northbridge',cat:'Candidate',sent:n-54*H,s:'Awaiting Reply'},{id:2,n:'James Okafor',o:'Apex Ventures',cat:'Investor',sent:n-20*H,s:'Awaiting Reply'},{id:3,n:'Priya Nair',o:'Lumen Ltd',cat:'Vendor',sent:n-30*H,s:'Awaiting Reply'}],theme:''};save()}
if(S.theme)document.documentElement.dataset.theme=S.theme}
function hr(z,d){return +new Intl.DateTimeFormat('en-GB',{timeZone:z,hour:'2-digit',hourCycle:'h23'}).format(d)}
function min(z,d){return +new Intl.DateTimeFormat('en-GB',{timeZone:z,minute:'2-digit'}).format(d)}
function st(h,ov){return ov?['Core Overlap','o']:(h>=7&&h<22?['Deep Work','']:['Off-Hours / Sleeping','s'])}
function tick(){var d=new Date(),U='Europe/London',P='Asia/Manila',hu=hr(U,d),hp=hr(P,d),ov=hu>=6&&hu<11;
function f(z,o){return new Intl.DateTimeFormat('en-GB',Object.assign({timeZone:z},o)).format(d)}
$('#tU').textContent=f(U,{hour:'2-digit',minute:'2-digit',second:'2-digit'});$('#tP').textContent=f(P,{hour:'2-digit',minute:'2-digit',second:'2-digit'});
$('#dU').textContent=f(U,{weekday:'long',day:'numeric',month:'short'});$('#dP').textContent=f(P,{weekday:'long',day:'numeric',month:'short'});
[['U',hu],['P',hp]].forEach(function(x){var s=st(x[1],ov),el=$('#s'+x[0]);el.textContent=s[0];el.className='pill '+s[1]});
var off=(hp-hu+24)%24,a=(6+off)%24,w=5/24*100;$('#ovb').style.left=a/24*100+'%';$('#ovb').style.width=Math.min(w,100-a/24*100)+'%';
$('#now').style.left=(hp+min(P,d)/60)/24*100+'%';$('#ovt').textContent='Operational overlap: '+String(a).padStart(2,'0')+':00-'+String((a+5)%24).padStart(2,'0')+':00 PHT / 06:00-11:00 UK (bar = 24h in PHT)'}
function pht(t){return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Manila',weekday:'short',hour:'2-digit',minute:'2-digit'}).format(t)+' PHT'}
function rq(){var g=[['Executive Search',/candidate|coo|ceo|cfo|hire|recruit|brief|cv|interview|shortlist/i],['Travel & Dining',/book|flight|table|hotel|dinner|lunch|restaurant|train|taxi|travel/i],['CRM Follow-up',/follow|nudge|chase|reply|investor|client|email/i]];return g}
function parse(txt){return txt.split(/[.;\n]|,\s*and\s+|\s+and\s+(?=remind|book|send|schedule|call|email|chase)/i).map(function(s){return s.trim()}).filter(Boolean).map(function(s){
var c='Admin / Scheduling';rq().some(function(r){if(r[1].test(s)){c=r[0];return 1}});
var u=/urgent|asap|today|tonight|now|immediately/i.test(s)?'High':/tomorrow|this week|tuesday|monday|wednesday|thursday|friday/i.test(s)?'Medium':'Low';
return{id:Date.now()+Math.random(),t:s.charAt(0).toUpperCase()+s.slice(1),c:c,u:u,due:Date.now()+({High:1,Medium:6,Low:24})[u]*H,st:/remind me|sign.?off|approve|review/i.test(s)?'wait':'today'}})}
function item(t,b){return '<div class="it"><div>'+e(t.t)+'<small>'+e(t.c)+' · '+t.u+' · due '+pht(t.due)+'</small></div><div>'+b+'</div></div>'}
function qr(){var g={today:'Today\'s Priorities',wait:'Waiting on Founder',done:'Completed'},h='';
Object.keys(g).forEach(function(k){h+='<h4>'+g[k]+'</h4>';var l=S.tasks.filter(function(t){return t.st==k});if(!l.length)h+='<small>Nothing here</small>';
l.forEach(function(t){var b=k=='done'?'<button data-a="mv" data-i="'+t.id+'" data-s="today">Reopen</button>':'<button data-a="mv" data-i="'+t.id+'" data-s="done">Done</button>'+(k=='today'?'<button data-a="mv" data-i="'+t.id+'" data-s="wait">Founder</button>':'<button data-a="mv" data-i="'+t.id+'" data-s="today">Back</button>')+'<button data-a="rm" data-i="'+t.id+'">✕</button>';h+=item(t,b)})});$('#q').innerHTML=h}
function hrs(n){return Math.floor((Date.now()-n.sent)/H)}
function nr(){S.nudges.sort(function(a,b){return a.sent-b.sent});$('#ng').innerHTML=S.nudges.map(function(n){var h=hrs(n),late=n.s!='Closed'&&h>48,bd=late?'<span class="warn '+(h>72?'late':'')+'">Needs Nudge — '+h+' hrs</span>':'<span class="pill">'+n.s+(n.s!='Closed'?' · '+h+' hrs':'')+'</span>';
return '<div class="it"><div>'+e(n.n)+' <small>'+e(n.o)+' · '+n.cat+' · last contact '+new Date(n.sent).toLocaleString('en-GB')+'</small></div><div>'+bd+' <button data-a="ng" data-i="'+n.id+'">Nudge</button><button data-a="cl" data-i="'+n.id+'">Close</button></div></div>'}).join('')}
function all(){qr();nr()}
function nudgeMsg(n){return 'Hi '+n.n.split(' ')[0]+', I hope you are well. I wanted to gently follow up on my note of '+new Date(n.sent).toLocaleDateString('en-GB',{day:'numeric',month:'long'})+' regarding '+n.o+'. Would you have a moment to share an update? Happy to work around your schedule. Many thanks.'}
function cp(t,b){var o=b.textContent;(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).catch(function(){var a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();try{document.execCommand('copy')}catch(x){}a.remove()}).then(function(){b.textContent='Copied ✓';setTimeout(function(){b.textContent=o},1500)})}
document.addEventListener('click',function(ev){var b=ev.target.closest('button[data-a]');if(!b)return;var i=+b.dataset.i,a=b.dataset.a;
if(a=='mv'){S.tasks.forEach(function(t){if(t.id==i)t.st=b.dataset.s})}
if(a=='rm'){S.tasks=S.tasks.filter(function(t){return t.id!=i})}
if(a=='cl'){S.nudges.forEach(function(n){if(n.id==i)n.s='Closed'})}
if(a=='ng'){var n=S.nudges.filter(function(n){return n.id==i})[0];$('#mt').textContent=nudgeMsg(n);$('#mc').dataset.i=i;$('#m').showModal();return}
save();all()});
$('#mc').onclick=function(){var n=S.nudges.filter(function(n){return n.id==$('#mc').dataset.i})[0];cp($('#mt').textContent,$('#mc'));n.s='Nudge Sent';n.sent=Date.now();save();all()};
$('#mx').onclick=function(){$('#m').close()};
$('#disp').onclick=function(){var v=$('#bd').value.trim();if(!v)return;S.tasks=S.tasks.concat(parse(v));$('#bd').value='';save();all()};
$('#na').onclick=function(){var n=$('#nn').value.trim();if(!n)return;S.nudges.push({id:Date.now(),n:n,o:$('#no').value.trim()||'—',cat:$('#nc').value,sent:Date.now(),s:'Awaiting Reply'});$('#nn').value=$('#no').value='';save();all()};
$('#ho').onclick=function(){var d=S.tasks.filter(function(t){return t.st=='done'}),w=S.tasks.filter(function(t){return t.st=='wait'}),p=S.tasks.filter(function(t){return t.st=='today'}),nd=S.nudges.filter(function(n){return n.s!='Closed'&&hrs(n)>48});
function L(a,f){return a.length?a.map(f).join('\n'):'_None_'}
var m='*SyncShift Daily Handover — '+new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})+'*\n\n*✅ Completed*\n'+L(d,function(t){return '• '+t.t})+'\n\n*⏳ Waiting on Founder*\n'+L(w,function(t){return '• '+t.t})+'\n\n*🎯 Still Open*\n'+L(p,function(t){return '• '+t.t+' ('+t.u+')'})+'\n\n*🔔 Nudges Flagged (>48h)*\n'+L(nd,function(n){return '• '+n.n+' ('+n.o+') — '+hrs(n)+' hrs'});cp(m,$('#ho'))};
$('#th').onclick=function(){var d=document.documentElement,c=d.dataset.theme||(matchMedia('(prefers-color-scheme:light)').matches?'light':'dark');S.theme=d.dataset.theme=c=='dark'?'light':'dark';save()};
var SR=window.SpeechRecognition||window.webkitSpeechRecognition,rec=null;
if(!SR){$('#mic').hidden=true;$('#mn').textContent='Speech not supported here — type your brain dump.'}
else $('#mic').onclick=function(){if(rec){rec.stop();return}rec=new SR();rec.lang='en-GB';rec.interimResults=false;rec.continuous=true;
rec.onresult=function(r){for(var i=r.resultIndex;i<r.results.length;i++)if(r.results[i].isFinal)$('#bd').value+=(($('#bd').value?' ':'')+r.results[i][0].transcript.trim()+'.')};
rec.onerror=function(x){$('#mn').textContent='Mic unavailable ('+x.error+') — type instead.'};
rec.onend=function(){rec=null;$('#mic').textContent='🎙 Record';$('#mic').classList.remove('rec')};
$('#mic').textContent='■ Stop';$('#mic').classList.add('rec');try{rec.start()}catch(x){}};
load();all();tick();setInterval(tick,1000);setInterval(nr,6e4)})();