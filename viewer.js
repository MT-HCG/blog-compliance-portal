"use strict";
const byId=id=>document.getElementById(id);
const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
let epoch=0;
async function openData(pass){
 const current=++epoch;byId("data").replaceChildren();byId("detail").replaceChildren();byId("lock").hidden=true;byId("status").textContent="読み込み中";
 try{
  if(!/^[A-Za-z0-9_-]{30,128}$/.test(pass.trim()))throw Error();
  const r=await fetch("blog-data.enc.json",{cache:"no-store",credentials:"omit",redirect:"error"});
  if(!r.ok)throw Error();
  const raw=await r.text();
  if(raw.length>2100000)throw Error();
  const e=JSON.parse(raw);
  if(!e||typeof e!=="object"||typeof e.salt!=="string"||typeof e.iv!=="string"||typeof e.data!=="string")throw Error();
  if(e.v!==1||e.kdf!=="PBKDF2-SHA256"||e.iter!==310000||bytes(e.salt).length!==16||bytes(e.iv).length!==12||e.data.length>2000000)throw Error();
  const base=await crypto.subtle.importKey("raw",new TextEncoder().encode(pass.trim()),"PBKDF2",false,["deriveKey"]);
  const key=await crypto.subtle.deriveKey({name:"PBKDF2",hash:"SHA-256",salt:bytes(e.salt),iterations:310000},base,{name:"AES-GCM",length:256},false,["decrypt"]);
  const d=JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:bytes(e.iv)},key,bytes(e.data))));
  if(!d||typeof d!=="object"||typeof d.as_of!=="string"||d.as_of.length>160)throw Error();
  if(d.schema!==1||!["FIXTURE","APPROVED_AGGREGATE"].includes(d.scope)||!Array.isArray(d.metrics))throw Error();
  if(current!==epoch)return;
  if(d.metrics.length>30||d.metrics.some(m=>!m||typeof m!=="object"||typeof m.label!=="string"||m.label.length>120||!Number.isSafeInteger(m.value)||m.value<0))throw Error();
  if(d.scope==="FIXTURE")renderFixtureStatus();
  for(const m of d.metrics){const a=document.createElement("article"),s=document.createElement("strong");a.textContent=String(m.label);s.textContent=String(m.value);a.append(s);byId("data").append(a);}
  byId("status").textContent=(d.scope==="FIXTURE"?"架空試験データ":"承認済み集計")+" / "+d.as_of+"\n0件は違反なしを意味しません。";
  byId("lock").hidden=false;
 }catch{if(current===epoch){byId("data").replaceChildren();byId("detail").replaceChildren();byId("lock").hidden=true;byId("status").textContent="復号できません。合言葉または公開データを確認してください。";}}
}
byId("unlock").addEventListener("submit",e=>{e.preventDefault();const p=byId("key").value;byId("key").value="";openData(p);});
byId("lock").onclick=()=>{++epoch;byId("data").replaceChildren();byId("detail").replaceChildren();byId("status").textContent="閉じました";byId("lock").hidden=true;};
const fragment=new URLSearchParams(location.hash.slice(1)).get("k");
if(fragment){history.replaceState(null,"",location.pathname+location.search);openData(fragment);}

function renderFixtureStatus(){
 const root=byId("detail"),h=document.createElement("h2"),p=document.createElement("p"),table=document.createElement("table");
 h.textContent="運用状況";p.textContent="開発試験中。実監査の実行・判定・転送結果は未連携です。";
 const rows=[["工程","状態"],["対象ブランド・拠点","構成確認用"],["ブログ取得","未連携"],["監査判定・指摘","未連携"],["HCG確認・是正管理","未連携"],["OneDrive転送","未連携"]];
 rows.forEach((row,i)=>{const tr=document.createElement("tr");row.forEach(value=>{const cell=document.createElement(i===0?"th":"td");cell.textContent=value;if(i===0)cell.scope="col";tr.append(cell)});table.append(tr)});root.append(h,p,table);
}
