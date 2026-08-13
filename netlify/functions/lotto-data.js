const LOTTO_NUMBERS_URL="https://www.lotto.de/lotto-6aus49/lottozahlen";
const EURO_URL="https://www.eurojackpot.de/";
const LOTTO_NEWS_URL="https://www.lotto.de/ueber/neuigkeiten";
const ORIGIN="https://www.lotto.de";
const headers={"user-agent":"Mozilla/5.0 (compatible; LottoZentrale/1.1.1)","accept-language":"de-DE,de;q=0.9","accept":"text/html,application/xhtml+xml"};

function decode(s){return String(s||"").replace(/&nbsp;|&#160;/g," ").replace(/&amp;/g,"&").replace(/&auml;/g,"ä").replace(/&ouml;/g,"ö").replace(/&uuml;/g,"ü").replace(/&Auml;/g,"Ä").replace(/&Ouml;/g,"Ö").replace(/&Uuml;/g,"Ü").replace(/&szlig;/g,"ß").replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(+n))}
function strip(html){return decode(String(html||"").replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ")).trim()}
function cleanDate(s){return String(s||"").replace(/\s+/g,"")}
function dateValue(s){const m=String(s).replace(/\s+/g,"").match(/(\d{2})\.(\d{2})\.(\d{4})/);return m?new Date(+m[3],+m[2]-1,+m[1]).getTime():0}
function uniqueDraws(draws){const seen=new Set();return draws.filter(d=>{if(!d||d.numbers?.length<5)return false;const k=d.date+"|"+d.numbers.join(",")+"|"+(d.special||[]).join(",");if(seen.has(k))return false;seen.add(k);return true}).sort((a,b)=>dateValue(b.date)-dateValue(a.date)).slice(0,5)}

function parseLottoText(html){
  const text=strip(html),out=[];
  const rx=/Ziehung\s+vom\s+(Mittwoch|Samstag),?\s*(\d{2}\.\d{2}\.\s*\d{4})([\s\S]{0,250}?)Superzahl\s*\.?\s*(\d)/gi;
  let m;
  while((m=rx.exec(text))){
    const nums=(m[3].match(/\b(?:[1-9]|[1-4]\d)\b/g)||[]).map(Number).filter(n=>n>=1&&n<=49);
    if(nums.length>=6)out.push({date:cleanDate(m[2]),numbers:nums.slice(0,6).sort((a,b)=>a-b),special:[+m[4]]});
  }
  return uniqueDraws(out);
}
function parseEuro(html){
  const text=strip(html),out=[];
  const rx=/Gewinnzahlen\s+(Dienstag|Freitag),\s*(\d{2}\.\d{2}\.\d{4})\s+((?:\d{1,2}\s+){4}\d{1,2})\s+Eurozahlen\s+(\d{1,2})\s+(\d{1,2})/gi;
  let m;
  while((m=rx.exec(text)))out.push({date:m[2],numbers:m[3].trim().split(/\s+/).map(Number).sort((a,b)=>a-b),special:[+m[4],+m[5]].sort((a,b)=>a-b)});
  return uniqueDraws(out);
}
function parseLottoJackpot(html){
  const t=strip(html);
  const m=t.match(/Jackpot\s+für\s+die\s+Ziehung\s+am\s+[^:]{3,45}:\s*(?:ca\.\s*)?(\d+(?:[.,]\d+)?)\s*Mio/i);
  return m?{display:`${m[1].replace(".",",")} Mio. €`,max:"50 Mio. €"}:null;
}
function parseEuroJackpot(html){
  const t=strip(html);
  const ps=[/nächste(?:n)?\s+Ziehung[\s\S]{0,180}?(\d+(?:[.,]\d+)?)\s*Millionen\s*Euro/i,/Jackpot[\s\S]{0,80}?(\d+(?:[.,]\d+)?)\s*Mio/i,/mit\s+(\d+(?:[.,]\d+)?)\s*Millionen\s+Euro\s+im\s+obersten\s+Rang/i];
  for(const p of ps){const m=t.match(p);if(m)return{display:`${m[1].replace(".",",")} Mio. €`,max:"120 Mio. €"}}
  return null;
}
function extractNewsLinks(html){
  const links=[],rx=/href=["']([^"']*\/ueber\/neuigkeiten\/lotto-6aus49\/2026\/\d+[^"']*)["']/gi;
  let m;
  while((m=rx.exec(html))){
    let href=decode(m[1]).split("#")[0].split("?")[0];
    if(!href.startsWith("http"))href=ORIGIN+href;
    if(!links.includes(href))links.push(href);
  }
  return links.slice(0,12);
}
async function fetchText(url){const r=await fetch(url,{headers,redirect:"follow"});if(!r.ok)throw new Error(`${url} -> HTTP ${r.status}`);return r.text()}
async function fetchLottoViaNews(){
  const newsHtml=await fetchText(LOTTO_NEWS_URL);
  const links=extractNewsLinks(newsHtml);
  const out=[];let jackpot=null;
  for(const url of links.slice(0,10)){
    try{
      const html=await fetchText(url),draws=parseLottoText(html);
      if(draws.length)out.push(...draws);
      if(!jackpot)jackpot=parseLottoJackpot(html);
      if(uniqueDraws(out).length>=5&&jackpot)break;
    }catch{}
  }
  return{draws:uniqueDraws(out),jackpot};
}

exports.handler=async()=>{
  try{
    const [lottoPage,euroPage,newsFallback]=await Promise.allSettled([fetchText(LOTTO_NUMBERS_URL),fetchText(EURO_URL),fetchLottoViaNews()]);
    let lotto=[],lottoJackpot=null,lottoSource="LOTTO.de Gewinnzahlen";
    if(lottoPage.status==="fulfilled"){lotto=parseLottoText(lottoPage.value);lottoJackpot=parseLottoJackpot(lottoPage.value)}
    if(!lotto.length&&newsFallback.status==="fulfilled"){lotto=newsFallback.value.draws;lottoJackpot=lottoJackpot||newsFallback.value.jackpot;lottoSource="LOTTO.de Neuigkeiten-Fallback"}
    const eurojackpot=euroPage.status==="fulfilled"?parseEuro(euroPage.value):[];
    const euroJackpot=euroPage.status==="fulfilled"?parseEuroJackpot(euroPage.value):null;

    return{statusCode:200,headers:{"content-type":"application/json; charset=utf-8","cache-control":"public, max-age=600, s-maxage=600"},body:JSON.stringify({
      updatedAt:new Date().toLocaleString("de-DE",{timeZone:"Europe/Berlin"}),
      source:"LOTTO.de / Eurojackpot.de",
      draws:{lotto,eurojackpot},
      jackpots:{
        lotto:lottoJackpot||{display:"wird ermittelt",max:"50 Mio. €"},
        eurojackpot:euroJackpot||{display:"mind. 10 Mio. €",max:"120 Mio. €"}
      },
      freq:null,
      debug:{lottoFound:lotto.length,lottoSource,euroFound:eurojackpot.length,lottoPage:lottoPage.status,newsFallback:newsFallback.status}
    })};
  }catch(error){
    return{statusCode:502,headers:{"content-type":"application/json; charset=utf-8"},body:JSON.stringify({error:"Live-Daten konnten nicht geladen werden.",detail:error.message})};
  }
};
