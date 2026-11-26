"use strict";
const byId=id=>document.getElementById(id);
const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
let epoch=0;
async function openData(pass){
 const current=++epoch;byId("data").replaceChildren();byId("status").textContent="読み込み中";
 try{
  if(!/^[A-Za-z0-9_-]{30,128}$/.test(pass.trim()))throw Error();
  const r=await fetch("blog-data.enc.json",{cache:"no-store",credentials:"omit",redirect:"error"});
  if(!r.ok)throw Error();
  const e=await r.json();
  if(e.v!==1||e.kdf!=="PBKDF2-SHA256"||e.iter!==310000||bytes(e.salt).length!==16||bytes(e.iv).length!==12||e.data.length>2000000)throw Error();
  const base=await crypto.subtle.importKey("raw",new TextEncoder().encode(pass.trim()),"PBKDF2",false,["deriveKey"]);
  const key=await crypto.subtle.deriveKey({name:"PBKDF2",hash:"SHA-256",salt:bytes(e.salt),iterations:310000},base,{name:"AES-GCM",length:256},false,["decrypt"]);
  const d=JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:bytes(e.iv)},key,bytes(e.data))));
  if(d.schema!==1||!["FIXTURE","APPROVED_AGGREGATE"].includes(d.scope)||!Array.isArray(d.metrics))throw Error();
  if(current!==epoch)return;
  for(const m of d.metrics){const a=document.createElement("article"),s=document.createElement("strong");a.textContent=String(m.label);s.textContent=String(m.value);a.append(s);byId("data").append(a);}
  byId("status").textContent=(d.scope==="FIXTURE"?"架空試験データ":"承認済み集計")+" / "+d.as_of+"\n0件は違反なしを意味しません。";
  byId("lock").hidden=false;
 }catch{if(current===epoch)byId("status").textContent="復号できません。合言葉または公開データを確認してください。";}
}
byId("unlock").addEventListener("submit",e=>{e.preventDefault();const p=byId("key").value;byId("key").value="";openData(p);});
byId("lock").onclick=()=>{++epoch;byId("data").replaceChildren();byId("status").textContent="閉じました";byId("lock").hidden=true;};
const fragment=new URLSearchParams(location.hash.slice(1)).get("k");
if(fragment){history.replaceState(null,"",location.pathname+location.search);openData(fragment);}
