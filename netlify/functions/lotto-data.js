const LOTTO_URL = "https://www.lotto.de/lotto-6aus49/lottozahlen";
const EURO_URL = "https://www.eurojackpot.de/";

const headers = {
  "user-agent":"Mozilla/5.0 (compatible; LottoZentrale/1.0; +https://www.netlify.com/)",
  "accept-language":"de-DE,de;q=0.9"
};

function strip(html){
  return html
    .replace(/<script[\s\S]*?<\/script>/gi," ")
    .replace(/<style[\s\S]*?<\/style>/gi," ")
    .replace(/<[^>]+>/g," ")
    .replace(/&nbsp;/g," ")
    .replace(/&amp;/g,"&")
    .replace(/\s+/g," ")
    .trim();
}
function parseEuro(html){
  const text=strip(html);
  const m=text.match(/Gewinnzahlen\s+(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag),\s*(\d{2}\.\d{2}\.\d{4})\s+(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})\s+Eurozahlen\s+(\d{1,2})\s+(\d{1,2})/i);
  if(!m) return [];
  return [{date:m[2],numbers:m.slice(3,8).map(Number),special:m.slice(8,10).map(Number)}];
}
function extractJsonCandidates(html){
  const out=[];
  const rx=/<script[^>]*type=["']application\/(?:ld\+)?json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while((m=rx.exec(html))){
    try{out.push(JSON.parse(m[1]))}catch{}
  }
  return out;
}
function walk(obj, hits=[]){
  if(!obj || typeof obj!=="object") return hits;
  if(Array.isArray(obj)){obj.forEach(x=>walk(x,hits));return hits}
  const values=Object.values(obj);
  const nums=values.filter(v=>Array.isArray(v)&&v.length===6&&v.every(n=>Number.isInteger(+n)&&+n>=1&&+n<=49));
  if(nums.length) hits.push({obj, nums:nums[0].map(Number)});
  values.forEach(v=>walk(v,hits));
  return hits;
}
function parseLotto(html){
  const jsons=extractJsonCandidates(html);
  const hits=[];
  jsons.forEach(j=>walk(j,hits));
  for(const hit of hits){
    const raw=JSON.stringify(hit.obj);
    const date=(raw.match(/(\d{2}\.\d{2}\.\d{4})/)||raw.match(/(\d{4}-\d{2}-\d{2})/)||[])[1];
    if(date) return [{date,numbers:hit.nums,special:[]}];
  }
  const text=strip(html);
  const date=(text.match(/(Mittwoch|Samstag),\s*(\d{2}\.\d{2}\.\d{4})/i)||[])[2];
  if(date){
    const after=text.slice(text.indexOf(date)+date.length);
    const nums=(after.match(/\b(?:[1-9]|[1-4]\d)\b/g)||[]).map(Number).filter(n=>n>=1&&n<=49);
    if(nums.length>=6) return [{date,numbers:nums.slice(0,6),special:[]}];
  }
  return [];
}
exports.handler = async () => {
  try{
    const [lottoRes,euroRes]=await Promise.all([
      fetch(LOTTO_URL,{headers}),
      fetch(EURO_URL,{headers})
    ]);
    const [lottoHtml,euroHtml]=await Promise.all([lottoRes.text(),euroRes.text()]);
    const lotto=parseLotto(lottoHtml);
    const eurojackpot=parseEuro(euroHtml);

    return {
      statusCode:200,
      headers:{
        "content-type":"application/json; charset=utf-8",
        "cache-control":"public, max-age=900, s-maxage=900"
      },
      body:JSON.stringify({
        updatedAt:new Date().toLocaleString("de-DE",{timeZone:"Europe/Berlin"}),
        source:"LOTTO.de / Eurojackpot.de",
        draws:{lotto,eurojackpot},
        freq:null,
        note:"V1 liest aktuelle Ziehungen. Historische Häufigkeiten laufen mit lokalen Gewichten; ein stabiler Statistik-Import ist für ein Folgeupdate vorbereitet."
      })
    };
  }catch(error){
    return {
      statusCode:502,
      headers:{"content-type":"application/json; charset=utf-8"},
      body:JSON.stringify({error:"Live-Daten konnten nicht geladen werden.",detail:error.message})
    };
  }
};
