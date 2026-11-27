"use strict";
const byId=id=>document.getElementById(id);
let epoch=0;
// Not needed for this monitor (no image download, no review records): these counts are not shown.
const HIDDEN_METRICS=new Set(["画像取得待ち","確認・対応記録","HCG確認未完了候補"]);

/* Public aggregate: counts and run status only. No store names, articles or findings are ever published here. */
async function openData(){
 const current=++epoch;byId("data").replaceChildren();byId("detail").replaceChildren();byId("retry").hidden=true;byId("status").textContent="読み込み中";
 try{
  let r,raw;
  try{
   r=await fetch("blog-data.public.json",{cache:"no-store",credentials:"omit",redirect:"error"});
   if(!r.ok)throw Error();
   raw=await r.text();
  }catch{throw Error();}
  if(raw.length>2100000)throw Error();
  const d=JSON.parse(raw);
  if(!d||typeof d!=="object"||typeof d.as_of!=="string"||d.as_of.length>160)throw Error();
  if(d.schema!==1||!["FIXTURE","APPROVED_AGGREGATE","PILOT_AGGREGATE","STATUS_ONLY"].includes(d.scope)||!Array.isArray(d.metrics))throw Error();
  if(current!==epoch)return;
  if(d.metrics.length>30||d.metrics.some(m=>!m||typeof m!=="object"||typeof m.label!=="string"||m.label.length>120||!Number.isSafeInteger(m.value)||m.value<0))throw Error();
  if(d.scope==="STATUS_ONLY"&&!d.health)throw Error();
  if(d.health)renderHealth(d.health,d.as_of);
  if(d.scope==="FIXTURE")renderFixtureStatus();
  if(d.scope==="PILOT_AGGREGATE")renderPilotStatus(d.audit_state,d.review_state,d.capture_scope);
  for(const m of d.metrics){if(HIDDEN_METRICS.has(m.label))continue;const a=document.createElement("article"),s=document.createElement("strong");a.textContent=String(m.label);s.textContent=String(m.value);a.append(s);byId("data").append(a);}
  byId("status").textContent=(d.scope==="STATUS_ONLY"?"実行状況のみ・監査集計未取得":d.scope==="FIXTURE"?"架空試験データ":d.scope==="PILOT_AGGREGATE"?"限定巡回の実測集計・法令監査未完了":"承認済み集計")+" / "+d.as_of+"\n0件は違反なしを意味しません。";
  byId("retry").textContent="最新情報を再取得";byId("retry").hidden=false;
 }catch{if(current===epoch){byId("data").replaceChildren();byId("detail").replaceChildren();byId("retry").textContent="もう一度読み込む";byId("retry").hidden=false;byId("status").textContent="データを読み込めません。通信状態を確認して、もう一度読み込んでください。";}}
}
byId("retry").onclick=()=>openData();
// Old home-screen icons carried the retired passphrase in the address fragment: remove it (never touch a Microsoft sign-in response).
if(/(?:^#|&)k=/.test(location.hash)&&!/(?:^#|&)(?:code|state|error)=/.test(location.hash))history.replaceState(null,"",location.pathname+location.search);
const startup=openData();

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
 const rows=[["工程","状態"],["ブログ取得","限定巡回・非公開DBへ保存"],["法令監査",states[state]],["画像監査","未完了"]];
 rows.forEach((row,i)=>{const tr=document.createElement("tr");row.forEach(value=>{const cell=document.createElement(i===0?"th":"td");cell.textContent=value;if(i===0)cell.scope="col";tr.append(cell)});table.append(tr)});root.append(h,p,table);
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
 const help=document.createElement("p");help.textContent="店舗名・記事・該当箇所・検出理由・法令根拠は、下の「監査詳細」に表示されます（管理者のMicrosoftサインインが必要です）。";root.append(help);
 const now=Date.now(),date=/^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}) JST$/.exec(asOf);
 let dataTime=null;
 if(date)dataTime=Date.parse(`${date[1]}-${date[2]}-${date[3]}T${date[4]}:${date[5]}:00+09:00`);
 if(now-checked>36*3600000||dataTime!==null&&now-dataTime>36*3600000){const warning=document.createElement("p");warning.textContent="36時間以上更新されていない情報があります。現在の稼働状況として扱わず、GitHubの実行履歴を確認してください。";root.append(warning);}
}

/* Private audit details. The page holds no data and no secret: after Microsoft sign-in it reads the latest
   detail file from the administrator's OneDrive (Microsoft Graph). Every value is rendered as text, never as HTML. */
const PRIVATE={
 clientId:"53279602-de4e-4ab4-b8fe-6498fda4cb5e", // Application (client) ID of the "Blog-Viewer" Entra app registration (an ID, not a secret). Empty = not set up yet.
 tenantId:"9a479428-f83e-4a2e-b0f7-0fdac44a610d",
 owner:"hcg@miyagichuo.onmicrosoft.com",
 path:"/店舗ブログ監査/アプリ用/blog-detail.json",
 scopes:["Files.Read"],
};
const GRAPH="https://graph.microsoft.com/v1.0";
const EXPECTED_STORES=66, MAX_FINDINGS=2000, MAX_BYTES=10000000, PAGE=50, REFRESH_MS=30*60*1000;
const failure=code=>Object.assign(new Error(code),{code});
const isText=(v,max=20000)=>typeof v==="string"&&v.length<=max;
const isTextOrNull=(v,max=20000)=>v===null||v===undefined||isText(v,max);
const blank=(v,empty="（記載なし）")=>v===null||v===undefined||v===""?empty:String(v);
const jst=v=>{const t=Date.parse(v);return Number.isFinite(t)?new Date(t).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})+" JST":blank(v,"記録なし");};

function validateDetails(d){
 const bad=()=>{throw failure("BAD");};
 if(!d||typeof d!=="object"||d.schema!==2||d.scope!=="PRIVATE_BLOG_DETAILS_APP"||d.repository!=="MT-HCG/blog-compliance-monitor")bad();
 if(!isText(d.finished_at,64)||!Number.isSafeInteger(d.source_run_id))bad();
 if(!Array.isArray(d.findings)||d.findings.length>MAX_FINDINGS||d.finding_count!==d.findings.length)bad();
 const seen=new Set();
 for(const x of d.findings){
  if(!x||typeof x!=="object"||!/^[0-9a-f]{32}$/.test(String(x.finding_id))||seen.has(x.finding_id))bad();
  seen.add(x.finding_id);
  if(!["rule_id","outcome","legal_basis"].every(k=>isText(x[k]))||!["rule_name","rule_version","reason","article_title","first_detected_at","scope_note"].every(k=>isTextOrNull(x[k])))bad();
  if(!Array.isArray(x.stores)||x.stores.length>20||!x.stores.every(s=>isText(s,200)))bad();
  if(!Array.isArray(x.evidence)||x.evidence.length>50||!x.evidence.every(s=>isText(s,5000)))bad();
  if(!isTextOrNull(x.article_url,2000)||!isTextOrNull(x.legal_source_url,2000)||!isTextOrNull(x.legal_source_title,500))bad();
 }
 if(!Array.isArray(d.coverage)||d.coverage.length!==EXPECTED_STORES)bad();
 for(const c of d.coverage){
  if(!c||typeof c!=="object"||!["brand","store","status"].every(k=>isText(c[k],200))||!isTextOrNull(c.last_attempt_at,64)||!isTextOrNull(c.last_success_at,64)||!Number.isSafeInteger(c.articles)||c.articles<0)bad();
 }
 return d;
}

const Auth=(()=>{
 let app=null,account=null;
 const redirectUri=()=>location.origin+location.pathname;
 const isOwner=()=>!!account&&String(account.username||"").toLowerCase()===PRIVATE.owner.toLowerCase();
 async function init(){
  if(!PRIVATE.clientId||typeof msal==="undefined")return "unconfigured";
  app=new msal.PublicClientApplication({auth:{clientId:PRIVATE.clientId,authority:`https://login.microsoftonline.com/${PRIVATE.tenantId}`,redirectUri:redirectUri()},cache:{cacheLocation:"localStorage"}});
  await app.initialize();
  let result;
  try{result=await app.handleRedirectPromise();}
  catch(e){throw failure(/consent|access_denied|AADSTS65001|AADSTS90094/i.test(`${e&&e.errorCode} ${e&&e.message}`)?"CONSENT":"SIGNIN");}
  account=(result&&result.account)||app.getActiveAccount()||app.getAllAccounts()[0]||null;
  if(account)app.setActiveAccount(account);
  return account?"signed-in":"signed-out";
 }
 const signIn=()=>app.loginRedirect({scopes:["User.Read",...PRIVATE.scopes]});
 const switchAccount=()=>app.loginRedirect({scopes:["User.Read"],prompt:"select_account"});
 const signOut=()=>app.logoutRedirect({account,postLogoutRedirectUri:redirectUri()});
 async function token(){
  try{return (await app.acquireTokenSilent({scopes:PRIVATE.scopes,account})).accessToken;}
  catch(e){
   if(e instanceof msal.InteractionRequiredAuthError)await app.acquireTokenRedirect({scopes:PRIVATE.scopes,account});
   throw e;
  }
 }
 // Graph answers /content with a redirect that browsers cannot follow under CORS: read the item, then its download URL.
 async function load(){
  let accessToken;
  try{accessToken=await token();}catch{throw failure("AUTH");}
  const encoded=PRIVATE.path.split("/").map(encodeURIComponent).join("/");
  let r;
  try{r=await fetch(`${GRAPH}/me/drive/root:${encoded}`,{headers:{Authorization:"Bearer "+accessToken},cache:"no-store"});}catch{throw failure("NET");}
  if(r.status===404)throw failure("NOTFOUND");
  if(r.status===401||r.status===403)throw failure("DENIED");
  if(!r.ok)throw failure("NET");
  let item;
  try{item=await r.json();}catch{throw failure("BAD");}
  const url=item&&item["@microsoft.graph.downloadUrl"];
  if(!item||!Number.isSafeInteger(item.size)||item.size>MAX_BYTES||typeof url!=="string"||!/^https:\/\//.test(url))throw failure("BAD");
  let raw;
  try{const f=await fetch(url,{cache:"no-store",credentials:"omit"});if(!f.ok)throw Error();raw=await f.text();}catch{throw failure("NET");}
  if(raw.length>MAX_BYTES)throw failure("BAD");
  try{return validateDetails(JSON.parse(raw));}catch(e){throw e&&e.code?e:failure("BAD");}
 }
 return {init,signIn,switchAccount,signOut,load,isOwner,user:()=>account&&account.username};
})();

const MESSAGES={
 UNCONFIGURED:"管理者サインインの設定が未完了です。Microsoft Entra の登録（Blog-Viewer）を設定すると、ここに監査詳細が表示されます。",
 SIGNED_OUT:"監査詳細は、管理者のMicrosoftアカウントでサインインすると表示されます。",
 CONSENT:"この画面を使うには、会社のIT管理者による承認（Blog-Viewer へのアクセス許可）が必要です。承認が済むまでお待ちください。",
 SIGNIN:"サインイン処理でエラーが発生しました。もう一度お試しください。",
 NOTFOUND:"監査詳細のデータがOneDriveにまだありません。自動転送の完了後に表示されます。",
 DENIED:"OneDriveのデータを開けませんでした。サインインし直してください。",
 AUTH:"サインインの有効期限が切れました。もう一度サインインしてください。",
 BAD:"監査詳細データの形式が正しくありません。表示を中止しました。",
 NET:"監査詳細を読み込めません。通信状態を確認して、もう一度読み込んでください。",
};

function safeLink(url,label){
 if(typeof url!=="string")return null;
 let u;try{u=new URL(url);}catch{return null;}
 if(u.protocol!=="https:"||u.username||u.password)return null;
 const a=document.createElement("a");a.href=u.href;a.textContent=label;a.target="_blank";a.rel="noreferrer noopener";return a;
}
function line(parent,label,value){const p=document.createElement("p"),b=document.createElement("b");b.textContent=label+" ";p.append(b,document.createTextNode(value));parent.append(p);return p;}
function linkLine(parent,label,text,url){
 const p=document.createElement("p"),b=document.createElement("b");b.textContent=label+" ";p.append(b);
 const a=safeLink(url,blank(text,"（題名なし）"));
 if(a)p.append(a);else p.append(document.createTextNode(blank(text,"（題名なし）")+"（リンク未確認）"));
 parent.append(p);
}

function mountPrivateDetails(){
 if(!byId("private-snapshot"))return;
 const el=byId;
 let rows=[],data=null,limit=PAGE,loadedAt=0,serial=0,ready=false;
 const setStatus=m=>{el("private-status").textContent=m;};
 const showOnly=ids=>{for(const id of ["private-signin","private-switch","private-reload","private-signout"])el(id).hidden=!ids.includes(id);};
 function options(node,values){
  const keep=node.value;node.replaceChildren();
  for(const v of ["",...new Set(values)].sort((a,b)=>a===""?-1:b===""?1:a.localeCompare(b,"ja"))){const o=document.createElement("option");o.value=v;o.textContent=v||"すべて";node.append(o);}
  if([...node.options].some(o=>o.value===keep))node.value=keep;
 }
 function clearBody(){
  rows=[];data=null;ready=false;el("private-body").hidden=true;el("private-output").replaceChildren();el("private-coverage").replaceChildren();
  for(const id of ["private-store","private-rule","private-outcome"])options(el(id),[]);
  el("private-count").textContent="";el("private-meta").textContent="";el("private-more").hidden=true;
 }
 function card(x){
  const panel=document.createElement("details"),head=document.createElement("summary"),body=document.createElement("div");
  const stores=x.stores.join("・")||"店舗未確認";
  head.textContent=stores+" ／ "+x.rule_id+" ／ "+x.outcome;
  line(body,"店舗",stores);
  linkLine(body,"記事",x.article_title,x.article_url);
  line(body,"記事の判定",x.outcome);
  line(body,"検出理由",blank(x.reason));
  const lead=document.createElement("p"),b=document.createElement("b");b.textContent="該当箇所";lead.append(b);body.append(lead);
  if(x.evidence.length===0){const p=document.createElement("p");p.textContent="引用未確認";body.append(p);}
  for(const q of x.evidence){const pre=document.createElement("pre");pre.textContent=q;body.append(pre);}
  line(body,"法令根拠",x.legal_basis);
  linkLine(body,"出典",x.legal_source_title,x.legal_source_url);
  line(body,"適用基準",blank(x.rule_name)+"（"+blank(x.rule_version,"版未記載")+"）");
  line(body,"初回検出",jst(x.first_detected_at));
  line(body,"確認範囲",blank(x.scope_note));
  line(body,"候補ID",String(x.finding_id));
  panel.append(head,body);return panel;
 }
 function filtered(){
  const q=el("private-search").value.normalize("NFKC").toLowerCase().trim();
  const store=el("private-store").value,rule=el("private-rule").value,outcome=el("private-outcome").value;
  return rows.filter(x=>(!store||x.stores.includes(store))&&(!rule||x.rule_id===rule)&&(!outcome||x.outcome===outcome)&&(!q||x.hay.includes(q)));
 }
 function renderList(){
  const out=el("private-output");out.replaceChildren();
  const list=filtered();
  el("private-count").textContent=list.length+" / "+rows.length+" 件"+(list.length>limit?"（新しい順に "+limit+" 件を表示）":"");
  for(const x of list.slice(0,limit))out.append(card(x));
  el("private-more").hidden=list.length<=limit;
 }
 function renderCoverage(){
  const host=el("private-coverage");host.replaceChildren();
  const q=el("private-coverage-search").value.normalize("NFKC").toLowerCase().trim();
  const list=data.coverage.filter(c=>!q||[c.brand,c.store,c.status].join(" ").normalize("NFKC").toLowerCase().includes(q));
  el("private-coverage-count").textContent=list.length+" / "+data.coverage.length+" 拠点";
  const table=document.createElement("table");
  for(const [i,vals] of [["ブランド","店舗","状態","最終試行","最終成功","保存記事数"],...list.map(c=>[c.brand,c.store,c.status,jst(c.last_attempt_at),jst(c.last_success_at),c.articles])].entries()){
   const tr=document.createElement("tr");
   for(const v of vals){const cell=document.createElement(i===0?"th":"td");if(i===0)cell.scope="col";cell.textContent=String(v);tr.append(cell);}
   table.append(tr);
  }
  host.append(table);
 }
 function accept(d){
  data=d;
  rows=d.findings.map(x=>({...x,hay:[x.stores.join(" "),x.article_title,x.rule_id,x.rule_name,x.finding_id,x.reason].map(v=>blank(v,"")).join(" ").normalize("NFKC").toLowerCase()}))
   .sort((a,b)=>(Date.parse(b.first_detected_at)||0)-(Date.parse(a.first_detected_at)||0)||String(a.finding_id).localeCompare(String(b.finding_id)));
  limit=PAGE;
  options(el("private-store"),rows.flatMap(x=>x.stores));options(el("private-rule"),rows.map(x=>x.rule_id));
  options(el("private-outcome"),rows.map(x=>x.outcome));
  el("private-meta").textContent="巡回の実行完了 "+jst(d.finished_at)+" ／ 取得元 実行番号 "+d.source_run_id+" ／ 確認候補 "+d.finding_count+" 件。違反の最終判断はHCGが行います。";
  el("private-body").hidden=false;renderList();renderCoverage();ready=true;
 }
 async function refresh(){
  const current=++serial;
  setStatus("読み込み中");
  try{
   const d=await Auth.load();
   if(current!==serial)return;
   accept(d);loadedAt=Date.now();setStatus("読込済み：サインイン中 "+Auth.user());
  }catch(e){
   if(current!==serial)return;
   const code=e&&e.code;
   clearBody();
   setStatus(MESSAGES[code]||MESSAGES.NET);
   showOnly(code==="DENIED"||code==="AUTH"?["private-signin","private-signout"]:["private-reload","private-signout"]);
  }
 }
 for(const id of ["private-search","private-store","private-rule","private-outcome"])el(id).addEventListener(id==="private-search"?"input":"change",()=>{limit=PAGE;if(ready)renderList();});
 el("private-coverage-search").addEventListener("input",()=>{if(ready)renderCoverage();});
 el("private-more").addEventListener("click",()=>{limit+=PAGE;renderList();});
 el("private-signin").addEventListener("click",()=>Auth.signIn());
 el("private-switch").addEventListener("click",()=>Auth.switchAccount());
 el("private-signout").addEventListener("click",()=>Auth.signOut());
 el("private-reload").addEventListener("click",()=>{openData();refresh();});
 document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&ready&&Date.now()-loadedAt>REFRESH_MS){openData();refresh();}});
 return (async()=>{
  clearBody();showOnly([]);
  let state;
  try{state=await Auth.init();}catch(e){setStatus(MESSAGES[e&&e.code]||MESSAGES.SIGNIN);showOnly(["private-signin"]);return;}
  if(state==="unconfigured"){setStatus(MESSAGES.UNCONFIGURED);return;}
  if(state==="signed-out"){setStatus(MESSAGES.SIGNED_OUT);showOnly(["private-signin"]);return;}
  if(!Auth.isOwner()){setStatus("このアカウント（"+Auth.user()+"）には閲覧権限がありません。管理者アカウントでサインインしてください。");showOnly(["private-switch","private-signout"]);return;}
  showOnly(["private-reload","private-signout"]);
  await refresh();
 })();
}
const privateStartup=mountPrivateDetails();
