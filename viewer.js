const PUBLIC_AGGREGATE = true;
"use strict";
const byId=id=>document.getElementById(id);
const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
let epoch=0;
let retryPass="";
function takeKey(){
 const match=/(?:^#|&)k=([^&]+)/.exec(location.hash);
 if(!match)return "";
 try{return decodeURIComponent(match[1]).trim();}catch{return match[1].trim();}
}
async function openData(pass){
 pass=String(pass??"").trim();retryPass=pass;
 const current=++epoch;byId("data").replaceChildren();byId("detail").replaceChildren();byId("lock").hidden=true;byId("retry").hidden=true;byId("view-gate").hidden=true;byId("status").textContent="読み込み中";
 let networkFailure=false;
 try{
  if(!(typeof PUBLIC_AGGREGATE!=="undefined"&&PUBLIC_AGGREGATE)&&!/^[A-Za-z0-9_-]{30,128}$/.test(pass.trim()))throw Error();
  let r,raw;
  try{
   r=await fetch(typeof PUBLIC_AGGREGATE!=="undefined"&&PUBLIC_AGGREGATE?"blog-data.public.json":"blog-data.enc.json",{cache:"no-store",credentials:"omit",redirect:"error"});
   if(!r.ok)throw Error();
   raw=await r.text();
  }catch{networkFailure=true;throw Error();}
  if(raw.length>2100000)throw Error();
  let d;
  if(typeof PUBLIC_AGGREGATE!=="undefined"&&PUBLIC_AGGREGATE){d=JSON.parse(raw);}else{
  const e=JSON.parse(raw);
  if(!e||typeof e!=="object"||typeof e.salt!=="string"||typeof e.iv!=="string"||typeof e.data!=="string")throw Error();
  if(e.v!==1||e.kdf!=="PBKDF2-SHA256"||e.iter!==310000||bytes(e.salt).length!==16||bytes(e.iv).length!==12||e.data.length>2000000)throw Error();
  const base=await crypto.subtle.importKey("raw",new TextEncoder().encode(pass.trim()),"PBKDF2",false,["deriveKey"]);
  const key=await crypto.subtle.deriveKey({name:"PBKDF2",hash:"SHA-256",salt:bytes(e.salt),iterations:310000},base,{name:"AES-GCM",length:256},false,["decrypt"]);
  d=JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:bytes(e.iv)},key,bytes(e.data))));
  }
  if(!d||typeof d!=="object"||typeof d.as_of!=="string"||d.as_of.length>160)throw Error();
  if(d.schema!==1||!["FIXTURE","APPROVED_AGGREGATE","PILOT_AGGREGATE","STATUS_ONLY"].includes(d.scope)||!Array.isArray(d.metrics))throw Error();
  if(current!==epoch)return;
  if(d.metrics.length>30||d.metrics.some(m=>!m||typeof m!=="object"||typeof m.label!=="string"||m.label.length>120||!Number.isSafeInteger(m.value)||m.value<0))throw Error();
  if(d.scope==="STATUS_ONLY"&&!d.health)throw Error();
  if(d.health)renderHealth(d.health,d.as_of);
  if(d.scope==="FIXTURE")renderFixtureStatus();
  if(d.scope==="PILOT_AGGREGATE")renderPilotStatus(d.audit_state,d.review_state,d.capture_scope);
  for(const m of d.metrics){const a=document.createElement("article"),s=document.createElement("strong");a.textContent=String(m.label);s.textContent=String(m.value);a.append(s);byId("data").append(a);}
  byId("status").textContent=(d.scope==="STATUS_ONLY"?"実行状況のみ・監査集計未取得":d.scope==="FIXTURE"?"架空試験データ":d.scope==="PILOT_AGGREGATE"?"限定巡回の実測集計・法令監査未完了":"承認済み集計")+" / "+d.as_of+"\n0件は違反なしを意味しません。";
  byId("lock").hidden=typeof PUBLIC_AGGREGATE!=="undefined"&&PUBLIC_AGGREGATE;
  byId("retry").textContent="最新情報を再取得";byId("retry").hidden=false;
 }catch{if(current===epoch){byId("data").replaceChildren();byId("detail").replaceChildren();byId("lock").hidden=true;byId("view-gate").hidden=typeof PUBLIC_AGGREGATE!=="undefined"&&PUBLIC_AGGREGATE;byId("retry").textContent="もう一度読み込む";byId("retry").hidden=false;byId("status").textContent=(networkFailure||typeof PUBLIC_AGGREGATE!=="undefined"&&PUBLIC_AGGREGATE)?"データを読み込めません。通信状態を確認して、もう一度読み込んでください。":"合言葉が違います。アイコンが古い場合は、管理者から新しい ZIP を受け取ってください。";}}
}
byId("unlock").addEventListener("submit",e=>{e.preventDefault();const p=byId("key").value;byId("key").value="";return openData(p);});
byId("retry").onclick=()=>openData(retryPass);
byId("lock").onclick=()=>{++epoch;retryPass="";byId("data").replaceChildren();byId("detail").replaceChildren();byId("status").textContent="閉じました";byId("lock").hidden=true;byId("retry").hidden=true;byId("view-gate").hidden=false;};
// Preserve the fragment so a subsequently saved home-screen icon retains its key.
const fragment=takeKey();
const startup=typeof PUBLIC_AGGREGATE!=="undefined"&&PUBLIC_AGGREGATE?openData(""):fragment?openData(fragment):Promise.resolve();

function renderFixtureStatus(){
 const root=byId("detail"),h=document.createElement("h2"),p=document.createElement("p"),table=document.createElement("table");
 h.textContent="運用状況";p.textContent="開発試験中。実監査の実行・判定・転送結果は未連携です。";
 const rows=[["工程","状態"],["対象ブランド・拠点","構成確認用"],["ブログ取得","未連携"],["監査判定・指摘","未連携"],["HCG確認・是正管理","未連携"],["OneDrive転送","未連携"]];
 rows.forEach((row,i)=>{const tr=document.createElement("tr");row.forEach(value=>{const cell=document.createElement(i===0?"th":"td");cell.textContent=value;if(i===0)cell.scope="col";tr.append(cell)});table.append(tr)});root.append(h,p,table);
}

function renderPilotStatus(state,reviewState="NOT_CONNECTED",captureScope="SIX_STORE_ROTATION"){
 if(!["SIX_STORE_ROTATION","ALL_STORES_CURRENT"].includes(captureScope))throw Error();
 if(!["NOT_CONNECTED","GITHUB_HCG_ACTIONS"].includes(reviewState))throw Error();
 const states={NO_ENABLED_TEXT_RULES:"法令基準の有効化待ち",SCOPED_TEXT_REVIEW:"法令本文の限定的な資料確認。総合監査未完了",LOCAL_MODEL_NOT_APPROVED:"判定モデルの検証待ち",RULE_SET_CHANGED:"基準変更により中断",PRIMARY_TEXT_ONLY:"本文一次判定のみ・総合監査未完了"};
 if(!Object.hasOwn(states,state))throw Error();
 const root=byId("detail"),h=document.createElement("h2"),p=document.createElement("p"),table=document.createElement("table");
 h.textContent="運用状況";p.textContent=(captureScope==="ALL_STORES_CURRENT"?"全66拠点の先頭ページを対象にした開発試験です。各拠点で本文取得は最大2記事です。":"実サイトの限定巡回結果です。対象は1回6拠点です。")+"過去記事の網羅性と全投稿の新規・更新確認は未確認です。日時は取得元の実行完了時刻です。";
 const rows=[["工程","状態"],["ブログ取得","限定巡回・非公開DBへ保存"],["法令監査",states[state]],["画像監査","未完了"],["HCG確認・是正管理",reviewState==="GITHUB_HCG_ACTIONS"?"認証済みGitHubで対応記録可能・確認未完了":"未連携"],["OneDrive転送","未連携"]];
 rows.forEach((row,i)=>{const tr=document.createElement("tr");row.forEach(value=>{const cell=document.createElement(i===0?"th":"td");cell.textContent=value;if(i===0)cell.scope="col";tr.append(cell)});table.append(tr)});root.append(h,p,table);
 if(reviewState==="GITHUB_HCG_ACTIONS"){const a=document.createElement("a");a.textContent="管理者：GitHubで確認・対応を記録";a.href="https://github.com/MT-HCG/blog-compliance-monitor/actions/workflows/review-action.yml";a.rel="noreferrer";root.append(a);}
}

function renderHealth(health,asOf){
 const states={SUCCESS:"前回実行成功（総合監査完了ではありません）",FAILED:"直近の巡回実行が失敗",TIMED_OUT:"直近の巡回実行が時間切れ",CANCELLED:"直近の巡回実行が取消",ACTION_REQUIRED:"巡回実行に操作が必要",UNKNOWN:"巡回実行状況を確認できません",NOT_RUN:"巡回の実行記録なし",IN_PROGRESS:"巡回実行中",QUEUED:"巡回実行待ち",SKIPPED:"直近の巡回実行は省略"};
 if(!health||!Object.hasOwn(states,health.state)||typeof health.schedule_enabled!=="boolean"||!["AVAILABLE","UNAVAILABLE","NO_MEASURED_RESULT"].includes(health.report_state))throw Error();
 const stamp=value=>{if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(?:Z|\+00:00)$/.test(value)||!Number.isFinite(Date.parse(value)))throw Error();return Date.parse(value);};
 const checked=stamp(health.checked_at),attempted=health.attempted_at===null?null:stamp(health.attempted_at);
 const root=byId("detail"),heading=document.createElement("h2"),p=document.createElement("p");
 heading.textContent="GitHubの実行状況";
 p.textContent=states[health.state]+"。"+(health.schedule_enabled?"定期巡回の設定は有効です（実行成功の保証ではありません）。":"自動巡回は無効です。")+(health.report_state==="AVAILABLE"?"集計は最後に保存できた巡回結果です。":"監査集計を取得できません。過去の件数や0件で代用していません。");
 const timing=document.createElement("p");timing.textContent="状況の取得日時："+new Date(checked).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})+" JST"+(attempted===null?"":" ／ 直近の実行開始："+new Date(attempted).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})+" JST");
 root.append(heading,p,timing);
 const link=document.createElement("a");link.textContent="巡回の実行履歴（GitHub）";link.href="https://github.com/MT-HCG/blog-compliance-monitor/actions/workflows/bounded-pilot.yml";link.rel="noreferrer";root.append(link);
 const help=document.createElement("p");help.textContent="店舗名・記事・該当箇所・検出理由・法令根拠・確認状況は、画面上部の「HCGで検出一覧を開く」から確認できます。";root.append(help);
 const now=Date.now(),date=/^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}) JST$/.exec(asOf);
 let dataTime=null;
 if(date)dataTime=Date.parse(`${date[1]}-${date[2]}-${date[3]}T${date[4]}:${date[5]}:00+09:00`);
 if(now-checked>36*3600000||dataTime!==null&&now-dataTime>36*3600000){const warning=document.createElement("p");warning.textContent="36時間以上更新されていない情報があります。現在の稼働状況として扱わず、GitHubの実行履歴を確認してください。";root.append(warning);}
}

/* Private snapshot stays in browser memory. Never publish or transmit its contents. */
function mountPrivateSnapshot(){
 const root=byId("private-snapshot");
 if(!root)return;
 const file=byId("private-file"), status=byId("private-status"), output=byId("private-output"), search=byId("private-search"), rule=byId("private-rule"), review=byId("private-review");
 const coverage=byId("private-coverage");
 let rows=[], serial=0;
 const labels=(node,value)=>{const e=document.createElement("p");e.textContent=value;node.append(e);};
 function render(){
  output.replaceChildren();
  const q=search.value.normalize("NFKC").toLowerCase().trim();
  const filtered=rows.filter(x=>(!rule.value||x.rule===rule.value)&&(!review.value||x.status===review.value)&&(!q||[x.store,x.article,x.rule,x.finding_id].join(" ").normalize("NFKC").toLowerCase().includes(q)));
  labels(output,filtered.length+" / "+rows.length+" 件");
  for(const x of filtered){
   const panel=document.createElement("details"),heading=document.createElement("summary"),body=document.createElement("pre");
   heading.textContent=x.store+" ／ "+x.rule+" ／ "+x.status;
   body.textContent=x.section;
   panel.append(heading,body);output.append(panel);
  }
 }
 function choices(node,values){node.replaceChildren();for(const v of ["",...new Set(values)]){const o=document.createElement("option");o.value=v;o.textContent=v||"すべて";node.append(o);}}
 function clear(){++serial;rows=[];file.value="";output.replaceChildren();coverage.replaceChildren();choices(rule,[]);choices(review,[]);status.textContent="非公開詳細は未読込です。";}
 byId("private-clear").addEventListener("click",clear);
 for(const node of [search,rule,review])node.addEventListener(node===search?"input":"change",render);
 file.addEventListener("change",async()=>{
  const chosen=file.files?.[0],current=++serial;
  rows=[];output.replaceChildren();choices(rule,[]);choices(review,[]);
  try{
   if(!chosen||chosen.size>10000000)throw Error();
   const d=JSON.parse(await chosen.text());
   if(current!==serial)return;
   if(d.schema!==1||d.scope!=="PRIVATE_BLOG_DETAILS"||d.repository!=="MT-HCG/blog-compliance-monitor"||!Array.isArray(d.pages)||d.pages.length>200)throw Error();
   const next=[];
   for(const page of d.pages){
    if(!Array.isArray(page.entries)||page.entries.length>10||typeof page.body!=="string")throw Error();
    for(const x of page.entries){
     if(!/^[0-9a-f]{32}$/.test(x.finding_id)||["store","article","rule","status"].some(k=>typeof x[k]!=="string"))throw Error();
     const marker="## 候補 "+x.finding_id;
     const start=page.body.indexOf(marker);
     if(start<0)throw Error();
     const end=page.body.indexOf("\n## 候補 ",start+marker.length);
     next.push({...x,section:page.body.slice(start,end<0?undefined:end)});
    }
   }
   if(next.length!==d.finding_count||new Set(next.map(x=>x.finding_id)).size!==next.length)throw Error();
   if(!Array.isArray(d.coverage)||d.coverage.length!==66||d.coverage.some(x=>!x||["brand","store","status","last_attempt","last_success"].some(k=>typeof x[k]!=="string")||!Number.isSafeInteger(x.articles)||x.articles<0))throw Error();
   const table=document.createElement("table"), title=document.createElement("h3");title.textContent="全66拠点の巡回状況";coverage.append(title);
   for(const [i,vals] of [["ブランド","店舗","状態","最終試行 (UTC)","最終成功 (UTC)","保存記事数"],...d.coverage.map(x=>[x.brand,x.store,x.status,x.last_attempt,x.last_success,x.articles])].entries()){const tr=document.createElement("tr");for(const v of vals){const cell=document.createElement(i===0?"th":"td");cell.textContent=String(v);tr.append(cell);}table.append(tr);}coverage.append(table);
   rows=next;choices(rule,rows.map(x=>x.rule));choices(review,rows.map(x=>x.status));
   status.textContent="読込済みスナップショット："+String(d.finished_at)+" ／ 自動同期ではありません。";
   render();
  }catch{if(current===serial){rows=[];output.replaceChildren();coverage.replaceChildren();status.textContent="非公開監査ファイルを読み込めません。";}}
 });
}
mountPrivateSnapshot();
