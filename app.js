const VERSION = "1.0.0";
const STORAGE_KEY = "lottoZentraleSettingsV1";

const GAME_CONFIG = {
  lotto: { label:"LOTTO 6aus49", max:49, count:6, specialCount:0, specialMax:0 },
  eurojackpot: { label:"EUROJACKPOT", max:50, count:5, specialCount:2, specialMax:12 }
};

// Fallback-Gewichte. Sie sind absichtlich nur leicht unterschiedlich.
// Sobald Live-Historie verfügbar ist, ersetzt die Datenfunktion diese Werte.
const FALLBACK_FREQ = {
  lotto: Array.from({length:49}, (_,i) => ({n:i+1, f: 100 + ((i*17 + 11) % 31)})),
  eurojackpot: Array.from({length:50}, (_,i) => ({n:i+1, f: 100 + ((i*13 + 7) % 29)})),
  euro: Array.from({length:12}, (_,i) => ({n:i+1, f: 100 + ((i*9 + 3) % 23)}))
};

const FALLBACK_DRAWS = {
  lotto: [],
  eurojackpot: [
    { date:"11.08.2026", numbers:[4,11,12,16,30], special:[8,9] }
  ]
};

let state = {
  game:"lotto",
  tipsCount:6,
  statWeight:65,
  spreadMode:"reduced",
  avoidSequences:true,
  avoidPatterns:true,
  balanceParity:true,
  balanceRange:true,
  statView:"hot",
  locked:new Set(),
  tips:[],
  data: structuredClone(FALLBACK_DRAWS),
  freq: structuredClone(FALLBACK_FREQ)
};

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function loadSettings(){
  try{
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    for(const k of ["tipsCount","statWeight","spreadMode","avoidSequences","avoidPatterns","balanceParity","balanceRange"]){
      if(k in saved) state[k]=saved[k];
    }
  }catch{}
}
function saveSettings(){
  const data={};
  for(const k of ["tipsCount","statWeight","spreadMode","avoidSequences","avoidPatterns","balanceParity","balanceRange"]) data[k]=state[k];
  localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
}
function syncControls(){
  $("#tipsCount").textContent=state.tipsCount;
  $("#statWeight").value=state.statWeight;
  $("#weightValue").textContent=`${state.statWeight} %`;
  $("#spreadMode").value=state.spreadMode;
  $("#avoidSequences").checked=state.avoidSequences;
  $("#avoidPatterns").checked=state.avoidPatterns;
  $("#balanceParity").checked=state.balanceParity;
  $("#balanceRange").checked=state.balanceRange;
}
function cryptoRandom(){
  const a=new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0]/4294967296;
}
function normalizeFreq(list,max){
  const map=new Map(list.map(x=>[x.n,x.f]));
  return Array.from({length:max},(_,i)=>({n:i+1,f:Number(map.get(i+1)||100)}));
}
function weightedPick(candidates, freqList, usedCounts, spreadMode, influence){
  const values=freqList.map(x=>x.f);
  const min=Math.min(...values), max=Math.max(...values);
  let weights=candidates.map(n=>{
    const f=freqList.find(x=>x.n===n)?.f ?? 100;
    const normalized=max===min ? 1 : .55 + ((f-min)/(max-min))*1.15;
    const statFactor=1 + (normalized-1)*(influence/100);
    const used=usedCounts.get(n)||0;
    let spreadFactor=1;
    if(spreadMode==="reduced") spreadFactor=used===0?1:used===1?.3:used===2?.08:.01;
    if(spreadMode==="unique") spreadFactor=used===0?1:.001;
    return Math.max(.0001,statFactor*spreadFactor);
  });
  const total=weights.reduce((a,b)=>a+b,0);
  let r=cryptoRandom()*total;
  for(let i=0;i<candidates.length;i++){
    r-=weights[i];
    if(r<=0) return candidates[i];
  }
  return candidates[candidates.length-1];
}
function hasConsecutive(nums){
  const s=[...nums].sort((a,b)=>a-b);
  return s.some((n,i)=>i && n-s[i-1]===1);
}
function obviousPattern(nums){
  const s=[...nums].sort((a,b)=>a-b);
  const diffs=s.slice(1).map((n,i)=>n-s[i]);
  const sameDiff=diffs.length>=3 && diffs.filter(d=>d===diffs[0]).length>=3;
  const sameDecade=Math.max(...Object.values(s.reduce((o,n)=>{const k=Math.floor((n-1)/10);o[k]=(o[k]||0)+1;return o},{})))>=4;
  const endings=Math.max(...Object.values(s.reduce((o,n)=>{const k=n%10;o[k]=(o[k]||0)+1;return o},{})))>=3;
  return sameDiff || sameDecade || endings;
}
function balancedParity(nums){
  const evens=nums.filter(n=>n%2===0).length;
  return evens>=2 && evens<=nums.length-2;
}
function balancedRange(nums,max){
  const split=Math.floor(max/2);
  const low=nums.filter(n=>n<=split).length;
  return low>=2 && low<=nums.length-2;
}
function validTip(nums,cfg){
  if(state.avoidSequences && hasConsecutive(nums)) return false;
  if(state.avoidPatterns && obviousPattern(nums)) return false;
  if(state.balanceParity && !balancedParity(nums)) return false;
  if(state.balanceRange && !balancedRange(nums,cfg.max)) return false;
  return true;
}
function generateOne(cfg,usedCounts){
  const freq=normalizeFreq(state.freq[state.game],cfg.max);
  for(let attempt=0;attempt<1200;attempt++){
    const picked=[];
    while(picked.length<cfg.count){
      const candidates=Array.from({length:cfg.max},(_,i)=>i+1).filter(n=>!picked.includes(n));
      picked.push(weightedPick(candidates,freq,usedCounts,state.spreadMode,state.statWeight));
    }
    picked.sort((a,b)=>a-b);
    if(validTip(picked,cfg)){
      const special=[];
      if(cfg.specialCount){
        const ef=normalizeFreq(state.freq.euro,cfg.specialMax);
        while(special.length<cfg.specialCount){
          const candidates=Array.from({length:cfg.specialMax},(_,i)=>i+1).filter(n=>!special.includes(n));
          special.push(weightedPick(candidates,ef,new Map(),"normal",state.statWeight));
        }
        special.sort((a,b)=>a-b);
      }
      return {numbers:picked,special};
    }
  }
  return {numbers: Array.from({length:cfg.count},(_,i)=>i+1), special:[]};
}
function generateTips(onlyUnlocked=false){
  const cfg=GAME_CONFIG[state.game];
  const usedCounts=new Map();

  if(onlyUnlocked){
    state.tips.forEach((tip,i)=>{
      if(state.locked.has(i)) tip.numbers.forEach(n=>usedCounts.set(n,(usedCounts.get(n)||0)+1));
    });
  }else{
    state.locked.clear();
  }

  const next=[];
  for(let i=0;i<state.tipsCount;i++){
    if(onlyUnlocked && state.locked.has(i) && state.tips[i]){
      next[i]=state.tips[i];
    }else{
      const tip=generateOne(cfg,usedCounts);
      next[i]=tip;
      tip.numbers.forEach(n=>usedCounts.set(n,(usedCounts.get(n)||0)+1));
    }
  }
  state.tips=next;
  renderTips();
}
function ball(n,special=false){return `<span class="ball ${special?"special":""}">${n}</span>`}
function renderTips(){
  const host=$("#tipsContainer");
  host.innerHTML="";
  state.tips.forEach((tip,i)=>{
    const row=document.createElement("div");
    row.className="tip-row";
    const specials=tip.special?.length ? `<span class="special-sep">+</span>${tip.special.map(n=>ball(n,true)).join("")}`:"";
    row.innerHTML=`
      <div class="tip-label">Tipp ${i+1}</div>
      <div class="tip-balls">${tip.numbers.map(n=>ball(n)).join("")}${specials}</div>
      <button class="lock-button ${state.locked.has(i)?"locked":""}" data-lock="${i}" title="Tipp fixieren">${state.locked.has(i)?"●":"○"}</button>`;
    host.appendChild(row);
  });
  $$("[data-lock]").forEach(btn=>btn.onclick=()=>{
    const i=Number(btn.dataset.lock);
    state.locked.has(i)?state.locked.delete(i):state.locked.add(i);
    renderTips();
  });
}
function renderStats(){
  const list=normalizeFreq(state.freq[state.game],GAME_CONFIG[state.game].max).sort((a,b)=>b.f-a.f);
  let selection;
  if(state.statView==="hot") selection=list.slice(0,15);
  else if(state.statView==="cold") selection=[...list].reverse().slice(0,15);
  else {
    const start=Math.max(0,Math.floor((list.length-15)/2));
    selection=list.slice(start,start+15);
  }
  $("#statsGrid").innerHTML=selection.map(x=>`<span class="stat-number ${state.statView}">${x.n}</span>`).join("");
  $("#statsNote").textContent="Sortierung nach den aktuell geladenen historischen Häufigkeitswerten. Häufigkeit ist keine Vorhersage.";
}
function renderDraws(){
  const cfg=GAME_CONFIG[state.game];
  $("#drawTitle").textContent=cfg.label;
  const draws=(state.data[state.game]||[]).slice(0,5);
  const latest=draws[0];
  if(latest){
    $("#latestDrawDate").textContent=latest.date;
    $("#latestNumbers").innerHTML=latest.numbers.map(n=>ball(n)).join("")+(latest.special||[]).map(n=>ball(n,true)).join("");
  }else{
    $("#latestDrawDate").textContent="Noch keine Live-Daten verfügbar";
    $("#latestNumbers").innerHTML="";
  }
  $("#historyList").innerHTML=draws.length?draws.map(d=>`
    <div class="history-item">
      <div class="history-date">${d.date}</div>
      <div class="ball-row" style="justify-content:flex-start">
        ${d.numbers.map(n=>ball(n)).join("")}${(d.special||[]).map(n=>ball(n,true)).join("")}
      </div>
    </div>`).join(""):`<div class="muted">Keine Ziehungsdaten geladen.</div>`;
}
async function refreshLiveData(){
  $("#dataStatus").textContent="Live-Daten werden geprüft…";
  try{
    const res=await fetch("/.netlify/functions/lotto-data",{cache:"no-store"});
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const data=await res.json();
    if(data.draws){
      for(const game of ["lotto","eurojackpot"]){
        if(Array.isArray(data.draws[game]) && data.draws[game].length) state.data[game]=data.draws[game].slice(0,5);
      }
    }
    if(data.freq){
      for(const key of ["lotto","eurojackpot","euro"]){
        if(Array.isArray(data.freq[key]) && data.freq[key].length) state.freq[key]=data.freq[key];
      }
    }
    $("#dataStatus").textContent=`Datenstand: ${data.updatedAt || "gerade aktualisiert"} · Quelle: ${data.source || "Datenmodul"}`;
  }catch(err){
    $("#dataStatus").textContent="Live-Daten derzeit nicht erreichbar. Generator funktioniert mit lokalen Fallback-Gewichten weiter.";
  }
  renderDraws(); renderStats();
}
function changeGame(game){
  state.game=game;
  state.locked.clear();
  $$(".game-tab").forEach(b=>b.classList.toggle("active",b.dataset.game===game));
  renderDraws(); renderStats(); generateTips();
}
function bind(){
  $$(".game-tab").forEach(b=>b.onclick=()=>changeGame(b.dataset.game));
  $("#tipsMinus").onclick=()=>{state.tipsCount=Math.max(1,state.tipsCount-1);syncControls();saveSettings();generateTips()};
  $("#tipsPlus").onclick=()=>{state.tipsCount=Math.min(6,state.tipsCount+1);syncControls();saveSettings();generateTips()};
  $("#generateButton").onclick=()=>generateTips();
  $("#regenerateUnlocked").onclick=()=>generateTips(true);
  $("#unlockAll").onclick=()=>{state.locked.clear();renderTips()};
  $("#refreshData").onclick=refreshLiveData;
  $("#versionButton").onclick=()=>$("#changelogDialog").showModal();
  $("#closeChangelog").onclick=()=>$("#changelogDialog").close();

  $("#statWeight").oninput=e=>{$("#weightValue").textContent=`${e.target.value} %`};
  $("#statWeight").onchange=e=>{state.statWeight=Number(e.target.value);saveSettings();generateTips()};
  $("#spreadMode").onchange=e=>{state.spreadMode=e.target.value;saveSettings();generateTips()};
  for(const id of ["avoidSequences","avoidPatterns","balanceParity","balanceRange"]){
    $("#"+id).onchange=e=>{state[id]=e.target.checked;saveSettings();generateTips()};
  }
  $$(".stats-tab").forEach(b=>b.onclick=()=>{
    state.statView=b.dataset.stat;
    $$(".stats-tab").forEach(x=>x.classList.toggle("active",x===b));
    renderStats();
  });
}
loadSettings();
syncControls();
bind();
generateTips();
renderDraws();
renderStats();
refreshLiveData();
