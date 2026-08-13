const VERSION="1.3.0", STORAGE_KEY="lottoZentraleSettingsV1", DRAW_CACHE_KEY="lottoZentraleDrawCacheV1";
const GAME_CONFIG={lotto:{label:"LOTTO 6aus49",max:49,count:6,specialCount:0,specialMax:0},eurojackpot:{label:"EUROJACKPOT",max:50,count:5,specialCount:2,specialMax:12}};
const FALLBACK_FREQ={lotto:Array.from({length:49},(_,i)=>({n:i+1,f:100+((i*17+11)%31)})),eurojackpot:Array.from({length:50},(_,i)=>({n:i+1,f:100+((i*13+7)%29)})),euro:Array.from({length:12},(_,i)=>({n:i+1,f:100+((i*9+3)%23)}))};
const FALLBACK_DRAWS={lotto:[],eurojackpot:[]};
let state={game:"lotto",tipsCount:6,statWeight:65,spreadMode:"reduced",sequenceMode:"two",avoidPatterns:true,balanceParity:true,balanceRange:true,statView:"hot",locked:new Set(),tips:[],data:structuredClone(FALLBACK_DRAWS),freq:structuredClone(FALLBACK_FREQ),jackpots:{lotto:null,eurojackpot:null},sources:{lotto:"",eurojackpot:""}};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
function mergeDraws(current,incoming){
  const all=[...(incoming||[]),...(current||[])],seen=new Set();
  return all.filter(d=>{
    const k=`${d.date}|${(d.numbers||[]).join(",")}|${(d.special||[]).join(",")}`;
    if(seen.has(k))return false;seen.add(k);return true
  }).sort((a,b)=>{
    const cv=x=>{const p=String(x).split(".").map(Number);return p.length===3?new Date(p[2],p[1]-1,p[0]).getTime():0};
    return cv(b.date)-cv(a.date)
  }).slice(0,5)
}
function loadDrawCache(){
  try{
    const c=JSON.parse(localStorage.getItem(DRAW_CACHE_KEY)||"{}");
    for(const g of ["lotto","eurojackpot"])if(Array.isArray(c[g]))state.data[g]=mergeDraws(state.data[g],c[g]);
  }catch{}
}
function saveDrawCache(){
  try{localStorage.setItem(DRAW_CACHE_KEY,JSON.stringify(state.data))}catch{}
}

function loadSettings(){try{const x=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");["tipsCount","statWeight","spreadMode","sequenceMode","avoidPatterns","balanceParity","balanceRange"].forEach(k=>{if(k in x)state[k]=x[k]})}catch{}}
function saveSettings(){const x={};["tipsCount","statWeight","spreadMode","sequenceMode","avoidPatterns","balanceParity","balanceRange"].forEach(k=>x[k]=state[k]);localStorage.setItem(STORAGE_KEY,JSON.stringify(x))}
function syncControls(){$("#tipsCount").textContent=state.tipsCount;$("#statWeight").value=state.statWeight;$("#weightValue").textContent=`${state.statWeight}%`;$$('input[name="spread"]').forEach(x=>x.checked=x.value===state.spreadMode);$$('input[name="sequence"]').forEach(x=>x.checked=x.value===state.sequenceMode);$("#avoidPatterns").checked=state.avoidPatterns;$("#balanceParity").checked=state.balanceParity;$("#balanceRange").checked=state.balanceRange}
function rnd(){const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]/4294967296}
function normalizeFreq(list,max){const m=new Map((list||[]).map(x=>[x.n,x.f]));return Array.from({length:max},(_,i)=>({n:i+1,f:Number(m.get(i+1)||100)}))}
function weightedPick(candidates,freq,used,spread,influence){const vals=freq.map(x=>x.f),mi=Math.min(...vals),ma=Math.max(...vals);const weights=candidates.map(n=>{const f=freq.find(x=>x.n===n)?.f??100;const norm=ma===mi?1:.55+((f-mi)/(ma-mi))*1.15;const stat=1+(norm-1)*(influence/100);const u=used.get(n)||0;let sf=1;if(spread==="reduced")sf=u===0?1:u===1?.3:u===2?.08:.01;if(spread==="unique")sf=u===0?1:.001;return Math.max(.0001,stat*sf)});let r=rnd()*weights.reduce((a,b)=>a+b,0);for(let i=0;i<candidates.length;i++){r-=weights[i];if(r<=0)return candidates[i]}return candidates.at(-1)}
function consecutiveRun(nums){const s=[...nums].sort((a,b)=>a-b);let max=1,cur=1;for(let i=1;i<s.length;i++){cur=s[i]-s[i-1]===1?cur+1:1;max=Math.max(max,cur)}return max}
function obviousPattern(nums){const s=[...nums].sort((a,b)=>a-b),d=s.slice(1).map((n,i)=>n-s[i]);const arithmetic=d.length>=3&&d.filter(x=>x===d[0]).length>=3;const decades=Math.max(...Object.values(s.reduce((o,n)=>{let k=Math.floor((n-1)/10);o[k]=(o[k]||0)+1;return o},{})));const endings=Math.max(...Object.values(s.reduce((o,n)=>{let k=n%10;o[k]=(o[k]||0)+1;return o},{})));return arithmetic||decades>=4||endings>=3}
function validTip(nums,cfg){const run=consecutiveRun(nums);if(state.sequenceMode==="two"&&run>=2)return false;if(state.sequenceMode==="long"&&run>=3)return false;if(state.avoidPatterns&&obviousPattern(nums))return false;const evens=nums.filter(n=>n%2===0).length;if(state.balanceParity&&(evens<2||evens>nums.length-2))return false;const low=nums.filter(n=>n<=Math.floor(cfg.max/2)).length;if(state.balanceRange&&(low<2||low>nums.length-2))return false;return true}
function generateOne(cfg,used){const freq=normalizeFreq(state.freq[state.game],cfg.max);for(let a=0;a<1400;a++){const picked=[];while(picked.length<cfg.count){const c=Array.from({length:cfg.max},(_,i)=>i+1).filter(n=>!picked.includes(n));picked.push(weightedPick(c,freq,used,state.spreadMode,state.statWeight))}picked.sort((a,b)=>a-b);if(validTip(picked,cfg)){const special=[];if(cfg.specialCount){const ef=normalizeFreq(state.freq.euro,cfg.specialMax);while(special.length<cfg.specialCount){const c=Array.from({length:cfg.specialMax},(_,i)=>i+1).filter(n=>!special.includes(n));special.push(weightedPick(c,ef,new Map(),"normal",state.statWeight))}special.sort((a,b)=>a-b)}return{numbers:picked,special}}}return{numbers:Array.from({length:cfg.count},(_,i)=>i+1),special:[]}}
function generateTips(onlyUnlocked=false){const cfg=GAME_CONFIG[state.game],used=new Map();if(onlyUnlocked)state.tips.forEach((t,i)=>{if(state.locked.has(i))t.numbers.forEach(n=>used.set(n,(used.get(n)||0)+1))});else state.locked.clear();const next=[];for(let i=0;i<state.tipsCount;i++){if(onlyUnlocked&&state.locked.has(i)&&state.tips[i])next[i]=state.tips[i];else{const t=generateOne(cfg,used);next[i]=t;t.numbers.forEach(n=>used.set(n,(used.get(n)||0)+1))}}state.tips=next;renderTips()}
function ball(n,special=false){return `<span class="ball ${special?"special":""}">${n}</span>`}
function renderTips(){$("#tipsContainer").innerHTML=state.tips.map((t,i)=>`<div class="tip-row"><div class="tip-label">${i+1}.</div><div class="tip-balls">${t.numbers.map(n=>ball(n)).join("")}${t.special.length?'<span>+</span>'+t.special.map(n=>ball(n,true)).join(""):""}</div><button class="lock-button ${state.locked.has(i)?"locked":""}" data-lock="${i}">${state.locked.has(i)?"●":"○"}</button></div>`).join("");$$('[data-lock]').forEach(b=>b.onclick=()=>{const i=+b.dataset.lock;state.locked.has(i)?state.locked.delete(i):state.locked.add(i);renderTips()})}
function renderStats(){const list=normalizeFreq(state.freq[state.game],GAME_CONFIG[state.game].max).sort((a,b)=>b.f-a.f);let sel;if(state.statView==="hot")sel=list.slice(0,10);else if(state.statView==="cold")sel=[...list].reverse().slice(0,10);else sel=list.slice(Math.max(0,Math.floor((list.length-10)/2)),Math.max(0,Math.floor((list.length-10)/2))+10);$("#statsGrid").innerHTML=sel.map(x=>`<div class="stat-number"><b>${x.n}</b><small>${x.f}×</small></div>`).join("");$("#statsGameLabel").textContent=GAME_CONFIG[state.game].label}
function prettyDay(date){const clean=String(date||"").replace(/\s+/g,"");let d,mn,y;if(clean.includes(".")){[d,mn,y]=clean.split(".").map(Number)}else{[y,mn,d]=clean.split("-").map(Number)}const dt=new Date(y,mn-1,d);return new Intl.DateTimeFormat("de-DE",{weekday:"short",day:"2-digit",month:"2-digit",year:"numeric"}).format(dt)}
function drawBlock(d,game){if(!d)return '<div class="current-draw"><div class="draw-date">Noch keine Daten</div></div>';return `<div class="current-draw"><div class="draw-date">${prettyDay(d.date)}</div><div class="draw-balls">${d.numbers.map(n=>ball(n)).join("")}${(d.special||[]).map(n=>ball(n,true)).join("")}</div>${game==='eurojackpot'&&d.special?.length?'<div class="special-label">rote Kugeln = Eurozahlen</div>':''}</div>`}
function renderHistory(game,target){const draws=(state.data[game]||[]).slice(0,5);$(target).innerHTML=`<div class="history-list">${draws.length?draws.map(d=>`<div class="history-row"><span>${prettyDay(d.date).split(',')[0]} ${d.date}</span><span class="history-nums">${d.numbers.join(' · ')}</span><span class="history-special">${(d.special||[]).length?'+'+(d.special||[]).join(' · '):''}</span></div>`).join(''):'<div class="data-status">Noch keine Live-Daten geladen.</div>'}</div>`}
function nextDrawInfo(game){
  const now=new Date();
  const schedules=game==="lotto"?[{weekday:3,hour:18,minute:25},{weekday:6,hour:19,minute:25}]:[{weekday:2,hour:20,minute:0},{weekday:5,hour:20,minute:0}];
  let best=null;
  for(const s of schedules){
    const candidate=new Date(now);
    candidate.setHours(s.hour,s.minute,0,0);
    const add=(s.weekday-now.getDay()+7)%7;
    candidate.setDate(now.getDate()+add);
    if(candidate<=now)candidate.setDate(candidate.getDate()+7);
    if(!best||candidate<best.date)best={...s,date:candidate};
  }
  const dateText=new Intl.DateTimeFormat("de-DE",{weekday:"long",day:"2-digit",month:"2-digit",year:"numeric"}).format(best.date);
  return game==="lotto"?`Nächste Ziehung: ${dateText} · ${String(best.hour).padStart(2,"0")}:${String(best.minute).padStart(2,"0")} Uhr`:`Nächste Ziehung: ${dateText} · abends`;
}
function renderJackpots(){
  $("#lottoJackpot").textContent=state.jackpots.lotto?.display||"wird ermittelt";
  $("#euroJackpot").textContent=state.jackpots.eurojackpot?.display||"mind. 10 Mio. €";
}
function renderDraws(){if($("#lottoSource"))$("#lottoSource").textContent=state.sources.lotto?`Quelle: ${state.sources.lotto}`:"Quelle: ZDFtext / WestLotto";const ld=(state.data.lotto||[]).slice(0,2),ed=(state.data.eurojackpot||[]).slice(0,2);$("#lottoCurrent").innerHTML=drawBlock(ld[0],'lotto')+drawBlock(ld[1],'lotto');$("#euroCurrent").innerHTML=drawBlock(ed[0],'eurojackpot')+drawBlock(ed[1],'eurojackpot');$("#lottoNext").textContent=nextDrawInfo("lotto");$("#euroNext").textContent=nextDrawInfo("eurojackpot");renderJackpots();renderHistory('lotto','#lottoHistory');renderHistory('eurojackpot','#euroHistory')}
async function refreshLiveData(){
  $("#dataStatus").textContent="Live-Daten werden geprüft…";
  try{
    const r=await fetch('/.netlify/functions/lotto-data',{cache:'no-store'});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    const data=await r.json();
    for(const g of ['lotto','eurojackpot']){
      if(Array.isArray(data.draws?.[g])&&data.draws[g].length){
        state.data[g]=mergeDraws(state.data[g],data.draws[g]);
      }
    }
    if(data.freq)for(const k of ["lotto","eurojackpot","euro"])
      if(Array.isArray(data.freq[k])&&data.freq[k].length)state.freq[k]=data.freq[k];
    if(data.jackpots){
      state.jackpots.lotto=data.jackpots.lotto||state.jackpots.lotto;
      state.jackpots.eurojackpot=data.jackpots.eurojackpot||state.jackpots.eurojackpot;
    }
    if(data.sources)state.sources={...state.sources,...data.sources};
    saveDrawCache();
    $("#dataStatus").textContent=`Datenstand: ${data.updatedAt||"aktuell"} · ${data.source||"Live-Daten"}`;
  }catch(e){
    $("#dataStatus").textContent="Live-Daten konnten nicht geladen werden. Bereits gespeicherte Ziehungen bleiben sichtbar.";
  }
  renderDraws();renderStats()
}
function changeGame(game){state.game=game;state.locked.clear();$$('.game-tab').forEach(b=>b.classList.toggle('active',b.dataset.game===game));renderStats();generateTips()}

let deferredInstallPrompt=null;

function setupPwaInstall(){
  const installBtn=$("#installAppButton");

  window.addEventListener("beforeinstallprompt",event=>{
    event.preventDefault();
    deferredInstallPrompt=event;
    if(installBtn)installBtn.hidden=false;
  });

  if(installBtn){
    installBtn.addEventListener("click",async()=>{
      if(!deferredInstallPrompt)return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt=null;
      installBtn.hidden=true;
    });
  }

  window.addEventListener("appinstalled",()=>{
    deferredInstallPrompt=null;
    if(installBtn)installBtn.hidden=true;
  });

  if("serviceWorker" in navigator){
    window.addEventListener("load",()=>{
      navigator.serviceWorker.register("/service-worker.js").catch(()=>{});
    });
  }
}

function bind(){$$('.game-tab').forEach(b=>b.onclick=()=>changeGame(b.dataset.game));$("#tipsMinus").onclick=()=>{state.tipsCount=Math.max(1,state.tipsCount-1);syncControls();saveSettings();generateTips()};$("#tipsPlus").onclick=()=>{state.tipsCount=Math.min(6,state.tipsCount+1);syncControls();saveSettings();generateTips()};$("#generateButton").onclick=()=>generateTips();$("#regenerateUnlocked").onclick=()=>generateTips(true);$("#unlockAll").onclick=()=>{state.locked.clear();renderTips()};$("#refreshData").onclick=refreshLiveData;$("#statWeight").oninput=e=>$("#weightValue").textContent=`${e.target.value}%`;$("#statWeight").onchange=e=>{state.statWeight=+e.target.value;saveSettings();generateTips()};$$('input[name="spread"]').forEach(x=>x.onchange=e=>{state.spreadMode=e.target.value;saveSettings();generateTips()});$$('input[name="sequence"]').forEach(x=>x.onchange=e=>{state.sequenceMode=e.target.value;saveSettings();generateTips()});['avoidPatterns','balanceParity','balanceRange'].forEach(id=>$("#"+id).onchange=e=>{state[id]=e.target.checked;saveSettings();generateTips()});$$('.stats-tab').forEach(b=>b.onclick=()=>{state.statView=b.dataset.stat;$$('.stats-tab').forEach(x=>x.classList.toggle('active',x===b));renderStats()});const open=()=>$("#changelogDialog").showModal();$("#versionButton").onclick=open;$("#footerVersion").onclick=open;$("#closeChangelog").onclick=()=>$("#changelogDialog").close();
  if($("#statsInfoButton"))$("#statsInfoButton").onclick=()=>$("#generatorInfoDialog").showModal();
  if($("#closeGeneratorInfo"))$("#closeGeneratorInfo").onclick=()=>$("#generatorInfoDialog").close();$$('[data-scroll]').forEach(b=>b.onclick=()=>document.getElementById(b.dataset.scroll).scrollIntoView({behavior:'smooth'}))}
loadSettings();loadDrawCache();syncControls();bind();setupPwaInstall();generateTips();renderStats();renderDraws();refreshLiveData();
