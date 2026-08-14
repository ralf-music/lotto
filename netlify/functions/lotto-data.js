const ZDF_WED="https://teletext.zdf.de/teletext/zdf/seiten/557.html";
const ZDF_SAT="https://teletext.zdf.de/teletext/zdf/seiten/556.html";
const WEST_LOTTO="https://www.westlotto.de/lotto-6aus49/gewinnzahlen/gewinnzahlen.html";
const EURO_URL="https://www.eurojackpot.de/";

const headers={
  "user-agent":"Mozilla/5.0 (compatible; LottoZentrale/1.4.0)",
  "accept-language":"de-DE,de;q=0.9",
  "accept":"text/html,application/xhtml+xml"
};

function decode(s){
  return String(s||"")
    .replace(/&nbsp;|&#160;/g," ")
    .replace(/&amp;/g,"&")
    .replace(/&auml;/g,"ä").replace(/&ouml;/g,"ö").replace(/&uuml;/g,"ü")
    .replace(/&Auml;/g,"Ä").replace(/&Ouml;/g,"Ö").replace(/&Uuml;/g,"Ü")
    .replace(/&szlig;/g,"ß")
    .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(+n));
}
function strip(html){
  return decode(String(html||"")
    .replace(/<script[\s\S]*?<\/script>/gi," ")
    .replace(/<style[\s\S]*?<\/style>/gi," ")
    .replace(/<[^>]+>/g," ")
    .replace(/\s+/g," ")).trim();
}
function dateValue(s){
  const m=String(s).match(/(\d{2})\.(\d{2})\.(\d{4})/);
  return m?new Date(+m[3],+m[2]-1,+m[1]).getTime():0;
}
function uniqueDraws(draws){
  const seen=new Set();
  return draws.filter(d=>{
    if(!d||!d.date||!Array.isArray(d.numbers))return false;
    const k=d.date+"|"+d.numbers.join(",")+"|"+(d.special||[]).join(",");
    if(seen.has(k))return false;seen.add(k);return true
  }).sort((a,b)=>dateValue(b.date)-dateValue(a.date)).slice(0,5);
}
async function fetchText(url){
  const r=await fetch(url,{headers,redirect:"follow"});
  if(!r.ok)throw new Error(`${url} -> HTTP ${r.status}`);
  return r.text();
}
function parseZdfLotto(html){
  const text=strip(html);
  const date=(text.match(/(\d{2}\.\d{2}\.\d{4})/)||[])[1];
  const m=text.match(/6\s+aus\s+49\s+((?:\d{1,2}\s+){6})(\d)\s+Superzahl/i);
  if(!date||!m)return null;
  return {
    date,
    numbers:m[1].trim().split(/\s+/).map(Number).sort((a,b)=>a-b),
    special:[Number(m[2])]
  };
}
function parseWestLottoDraws(html){
  const text=strip(html),out=[];
  const rx=/Ergebnisse\s+vom\s+(Mittwoch|Samstag),?\s+den\s+(\d{2}\.\d{2}\.\d{4})([\s\S]{0,250}?)(?:Superzahl)\s+(\d)/gi;
  let m;
  while((m=rx.exec(text))){
    const nums=(m[3].match(/\b(?:[1-9]|[1-4]\d)\b/g)||[]).map(Number).filter(n=>n>=1&&n<=49);
    if(nums.length>=6)out.push({date:m[2],numbers:nums.slice(0,6).sort((a,b)=>a-b),special:[+m[4]]});
  }
  return uniqueDraws(out);
}
function parseWestLottoJackpot(html){
  const text=strip(html);
  const p=[
    /Jetzt\s+im\s+Jackpot\s+(?:rd\.\s*)?(\d+(?:[.,]\d+)?)\s*Mio/i,
    /Jackpot[^0-9]{0,80}(\d+(?:[.,]\d+)?)\s*Mio/i
  ];
  for(const rx of p){
    const m=text.match(rx);
    if(m)return{display:`${m[1].replace(".",",")} Mio. €`,max:"50 Mio. €"};
  }
  return null;
}
function parseEuro(html){
  const text=strip(html),out=[];
  const rx=/Gewinnzahlen\s+(Dienstag|Freitag),\s*(\d{2}\.\d{2}\.\d{4})\s+((?:\d{1,2}\s+){4}\d{1,2})\s+Eurozahlen\s+(\d{1,2})\s+(\d{1,2})/gi;
  let m;
  while((m=rx.exec(text)))out.push({
    date:m[2],
    numbers:m[3].trim().split(/\s+/).map(Number).sort((a,b)=>a-b),
    special:[+m[4],+m[5]].sort((a,b)=>a-b)
  });
  return uniqueDraws(out);
}
function parseEuroJackpot(html){
  const t=strip(html);
  const ps=[
    /nächste(?:n)?\s+Ziehung[\s\S]{0,180}?(\d+(?:[.,]\d+)?)\s*Millionen\s*Euro/i,
    /Jackpot[\s\S]{0,100}?(\d+(?:[.,]\d+)?)\s*Mio/i
  ];
  for(const p of ps){
    const m=t.match(p);
    if(m)return{display:`${m[1].replace(".",",")} Mio. €`,max:"120 Mio. €"};
  }
  return null;
}


const EURO_STATS_URL="https://www.eurojackpot.de/statistik";
function zeroCounts(a,b){const o={};for(let i=a;i<=b;i++)o[String(i)]=0;return o}
function parseEuroSpecialStats(html){
  const text=strip(html),pos=text.search(/2\s+aus\s+12|Eurozahlen/i);if(pos<0)return null;
  const sec=text.slice(pos,pos+12000),counts=zeroCounts(1,12);let found=0;
  const rx=/\b(\d{1,2})\b\s*(?:[:\-]|wurde)?\s*(\d{2,5})\s*(?:mal|x|Ziehungen)/gi;let m;
  while((m=rx.exec(sec))){const n=+m[1],c=+m[2];if(n>=1&&n<=12&&c>0&&!counts[String(n)]){counts[String(n)]=c;found++}}
  return found===12?counts:null;
}
function parseSuperzahlStatsFromArchive(html){
  const text=strip(html),counts=zeroCounts(0,9);let total=0,m;
  const rx=/(\d{2}\.\d{2}\.(20(?:2[0-9])))[\s\S]{0,350}?Superzahl\s+(\d)/gi;
  while((m=rx.exec(text))){if(+m[2]>=2020){counts[String(+m[3])]++;total++}}
  return total?{counts,total}:null;
}

exports.handler=async()=>{
  try{
    const [wed,sat,west,euro,euroStatsPage]=await Promise.allSettled([
      fetchText(ZDF_WED),fetchText(ZDF_SAT),fetchText(WEST_LOTTO),fetchText(EURO_URL),fetchText(EURO_STATS_URL)
    ]);

    const zdfDraws=[];
    if(wed.status==="fulfilled"){const d=parseZdfLotto(wed.value);if(d)zdfDraws.push(d)}
    if(sat.status==="fulfilled"){const d=parseZdfLotto(sat.value);if(d)zdfDraws.push(d)}

    const westDraws=west.status==="fulfilled"?parseWestLottoDraws(west.value):[];
    const lotto=uniqueDraws([...zdfDraws,...westDraws]);
    const eurojackpot=euro.status==="fulfilled"?parseEuro(euro.value):[];

    const lottoJackpot=west.status==="fulfilled"?parseWestLottoJackpot(west.value):null;
    const euroJackpot=euro.status==="fulfilled"?parseEuroJackpot(euro.value):null;
    const lottoParsed=west.status==="fulfilled"?parseSuperzahlStatsFromArchive(west.value):null;
    const euroCounts=euroStatsPage.status==="fulfilled"?parseEuroSpecialStats(euroStatsPage.value):null;
    const statDate=new Date().toLocaleDateString("de-DE",{timeZone:"Europe/Berlin"});
    const lottoSpecialStats=lottoParsed?{counts:lottoParsed.counts,total:lottoParsed.total,updatedAt:statDate,note:"Superzahl-Häufigkeit aus verfügbaren WestLotto-Daten seit 2020."}:null;
    const euroSpecialStats=euroCounts?{counts:euroCounts,updatedAt:statDate,note:"Eurozahlen-Häufigkeit aus der offiziellen Eurojackpot-Statistik."}:null;

    return{
      statusCode:200,
      headers:{
        "content-type":"application/json; charset=utf-8",
        "cache-control":"public, max-age=300, s-maxage=300"
      },
      body:JSON.stringify({
        updatedAt:new Date().toLocaleString("de-DE",{timeZone:"Europe/Berlin"}),
        source:"ZDFtext + WestLotto + Eurojackpot.de",
        sources:{
          lotto:zdfDraws.length?"ZDFtext (aktuelle Mi-/Sa-Ziehungen), WestLotto als Fallback":"WestLotto-Fallback",
          eurojackpot:"Eurojackpot.de"
        },
        draws:{lotto,eurojackpot},
        jackpots:{
          lotto:lottoJackpot||{display:"wird ermittelt",max:"50 Mio. €"},
          eurojackpot:euroJackpot||{display:"wird ermittelt",max:"120 Mio. €"}
        },
        specialStats:{lotto:lottoSpecialStats,eurojackpot:euroSpecialStats},
        freq:null,
        debug:{
          zdfWednesday:wed.status,
          zdfSaturday:sat.status,
          zdfDraws:zdfDraws.length,
          westLotto:west.status,
          westDraws:westDraws.length,
          euro:euro.status,
          euroDraws:eurojackpot.length
        }
      })
    };
  }catch(error){
    return{
      statusCode:502,
      headers:{"content-type":"application/json; charset=utf-8"},
      body:JSON.stringify({error:"Live-Daten konnten nicht geladen werden.",detail:error.message})
    };
  }
};
