(function(){const n=document.createElement("link").relList;if(n&&n.supports&&n.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))o(r);new MutationObserver(r=>{for(const s of r)if(s.type==="childList")for(const i of s.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&o(i)}).observe(document,{childList:!0,subtree:!0});function t(r){const s={};return r.integrity&&(s.integrity=r.integrity),r.referrerPolicy&&(s.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?s.credentials="include":r.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function o(r){if(r.ep)return;r.ep=!0;const s=t(r);fetch(r.href,s)}})();const cn="Super Amber",On="superamber",St=`${cn} | 班级排座与轮转`,Ct=`${On}-backup`,B=(e,n=[])=>({current:e,legacy:n}),y={classData:B("superamberClassData",["classSeatingData"]),userProfile:B("superamberUserProfile",["classSeatingProfile"]),batchUndo:B("superamberBatchUndoData",["classSeatingBatchUndoData"]),ocrSettings:B("superamberOCRSettings",["classSeatingOCRSettings"]),cnfSyncProfile:B("superamberCnfSyncProfile",["classSeatingCnfSyncProfile"]),usageGuideDismissed:B("superamberUsageGuideDismissed",["classSeatingUsageGuideDismissed"]),notesPanelWidth:B("superamberNotesPanelWidth",["classSeatingNotesPanelWidth"]),notesSectionHeight:B("superamberNotesSectionHeight",["classSeatingNotesSectionHeight"]),notesToolbarCollapsed:B("superamberNotesToolbarCollapsed",["classSeatingNotesToolbarCollapsed"]),editorToolsCollapsed:B("superamberEditorToolsCollapsed",["classSeatingEditorToolsCollapsed"])},j=e=>{const n=window.localStorage.getItem(e.current);if(n!==null)return n;for(const t of e.legacy){const o=window.localStorage.getItem(t);if(o!==null)return window.localStorage.setItem(e.current,o),o}return null},F=(e,n)=>{window.localStorage.setItem(e.current,n)},Dt=e=>{window.localStorage.removeItem(e.current),e.legacy.forEach(n=>window.localStorage.removeItem(n))},Et="modulepreload",Lt=function(e){return"/"+e},Cn={},$t=function(n,t,o){let r=Promise.resolve();if(t&&t.length>0){let u=function(d){return Promise.all(d.map(p=>Promise.resolve(p).then(m=>({status:"fulfilled",value:m}),m=>({status:"rejected",reason:m}))))};document.getElementsByTagName("link");const i=document.querySelector("meta[property=csp-nonce]"),c=i?.nonce||i?.getAttribute("nonce");r=u(t.map(d=>{if(d=Lt(d),d in Cn)return;Cn[d]=!0;const p=d.endsWith(".css"),m=p?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${d}"]${m}`))return;const h=document.createElement("link");if(h.rel=p?"stylesheet":Et,p||(h.as="script"),h.crossOrigin="",h.href=d,c&&h.setAttribute("nonce",c),document.head.appendChild(h),p)return new Promise((g,b)=>{h.addEventListener("load",g),h.addEventListener("error",()=>b(new Error(`Unable to preload CSS for ${d}`)))})}))}function s(i){const c=new Event("vite:preloadError",{cancelable:!0});if(c.payload=i,window.dispatchEvent(c),!c.defaultPrevented)throw i}return r.then(i=>{for(const c of i||[])c.status==="rejected"&&s(c.reason);return n().catch(s)})},Gt=1440*60*1e3,Mt="2026-03-02",un=e=>{const n=e.getFullYear(),t=String(e.getMonth()+1).padStart(2,"0"),o=String(e.getDate()).padStart(2,"0");return`${n}-${t}-${o}`},Ie=e=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(e))return null;const[n,t,o]=e.split("-").map(Number),r=new Date(n,t-1,o);return Number.isNaN(r.getTime())?null:r},In=["星期日","星期一","星期二","星期三","星期四","星期五","星期六"],Tt=(e=new Date)=>`${e.getMonth()+1}月${e.getDate()}日`,At=(e=new Date)=>In[e.getDay()]??"",Nt=(e=new Date)=>{const n=Ie(Mt);if(!n)return 1;const t=un(e),o=Ie(t);if(!o)return 1;const r=Math.floor((o.getTime()-n.getTime())/Gt);return Math.max(1,Math.floor(r/7)+1)},Ot=(e,n)=>{const t=Ie(e);return t?(t.setDate(t.getDate()+n),un(t)):null},me=(e,n)=>{const t=Number.parseInt(e,10),o=Number.parseInt(n,10);if(!Number.isFinite(t)||!Number.isFinite(o)||t<1||t>12||o<1||o>31)return null;const r=2026,s=new Date(r,t-1,o);return s.getMonth()!==t-1||s.getDate()!==o?null:un(s)},It=e=>{const n=Ie(e);return n?{month:String(n.getMonth()+1),day:String(n.getDate()),weekday:In[n.getDay()]??""}:null},Rt=e=>{const n=e.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/);return n?me(n[1],n[2]):null},J=6,x=6,en=18,C=()=>Array.from({length:6},()=>Array(J).fill("")),M=()=>({rows:Array.from({length:3},()=>({left:Array(x).fill(""),right:Array(x).fill("")}))}),E=()=>({rows:[Array(en).fill(""),Array(en).fill("")]}),he=()=>({date:"",day:"",weekday:"",time:"",campus:"",floor:"",room:"",notes:"",fullDate:""}),Dn=(e="circular")=>({layout:e,groups:null,groupOrder:null,rowGroups:null,arcGroups:null,currentArrangement:0,locationInfo:he()}),We=(e="circular",n="paper")=>({theme:n,weekday:Dn(e),weekend:Dn(e),previousWeek:null,cnf:null}),nn=()=>({username:"",theme:"paper"}),Pt=()=>({isEditMode:!1,currentArrangement:0,currentTimeMode:"weekday",currentLayout:"circular",currentView:"home",groups:C(),currentGroupOrder:[1,2,3,4,5,6],rowGroups:M(),arcGroups:E(),classData:{},userProfile:nn()}),zt=[{min:31,groups:6},{min:25,groups:5},{min:19,groups:4},{min:1,groups:3}],Bt=[{min:31,groups:6},{min:25,groups:5},{min:1,groups:4}],w=(e,n)=>{const t=e.map(o=>o.trim()).filter(Boolean).slice(0,n);return[...t,...Array(n-t.length).fill("")]},G=e=>e.map(n=>n.trim()).filter(Boolean),Rn=e=>{for(const n of zt)if(e>=n.min)return n.groups;return 0},Pn=e=>{for(const n of Bt)if(e>=n.min)return n.groups;return 0},Ge=e=>e>=6?[0,1,2,3,4,5]:e===5?[0,1,2,3,4,null]:e===4?[0,1,2,null,3,null]:e===3?[0,1,2,null,null,null]:e===2?[0,1,null,null,null,null]:e===1?[0,null,null,null,null,null]:[null,null,null,null,null,null],be=e=>e>=6?[0,1,2,3,4,5]:e===5?[0,1,2,3,4,null]:e===4?[0,1,2,3,null,null]:e===3?[0,1,2,null,null,null]:e===2?[0,1,null,null,null,null]:e===1?[0,null,null,null,null,null]:[null,null,null,null,null,null],dn=(e,n,t)=>{const o=G(e);if(n<=0)return[];if(o.length>n*t)throw new Error(`人数超出限制：${n}组每组最多${t}人，当前${o.length}人`);const r=Math.floor(o.length/n),s=o.length%n,i=[];let c=0;for(let u=0;u<n;u+=1){const d=r+(u<s?1:0),p=o.slice(c,c+d);c+=d,i.push(p)}return i},pn=e=>e.filter(n=>n.some(t=>t.trim())).length,gn=(e,n)=>{const t=e.filter(i=>i.trim()),o=e.length-t.length;if(t.length<=1)return w(e,e.length);const r=(n%t.length+t.length)%t.length||1;return[...[...t.slice(-r),...t.slice(0,-r)],...Array(o).fill("")]},X=(e,n)=>{const t=e.length;let o=Math.floor((t-1)/2),r=o+1,s=!0,i=0;for(;i<n.length&&(o>=0||r<t);)s&&o>=0?e[o--]=n[i++]:!s&&r<t&&(e[r++]=n[i++]),s=!s},je=(e,n)=>{const t=G(e),o=n??Rn(t.length);if(o<=0)return C();const r=dn(t,o,J),s=C();return r.forEach((i,c)=>{s[c]=w(i,J)}),s},zn=e=>({rows:[{left:w(e[0]??[],x),right:w(e[1]??[],x)},{left:w(e[2]??[],x),right:w(e[3]??[],x)},{left:w(e[4]??[],x),right:w(e[5]??[],x)}]}),fn=e=>{const n=e.rows;return[w(n[0]?.left??[],x),w(n[0]?.right??[],x),w(n[1]?.left??[],x),w(n[1]?.right??[],x),w(n[2]?.left??[],x),w(n[2]?.right??[],x)]},Fe=(e,n)=>{const t=G(e),o=n??Pn(t.length);if(o<=0)return M();const r=dn(t,o,x),s=be(o),i=Array.from({length:6},()=>Array(x).fill(""));return s.forEach((c,u)=>{c!==null&&(i[u]=w(r[c]??[],x))}),zn(i)},Wt=(e,n)=>{const t=G(e).slice(0,36),o=Math.max(1,Math.min(4,Math.ceil(t.length/9))),r=Math.max(1,Math.min(4,n??o)),s=dn(t,r,9),i=E(),c=[...s[0]||[],...s[1]||[]].slice(0,18),u=[...s[2]||[],...s[3]||[]].slice(0,18);return X(i.rows[0],c),X(i.rows[1],u),i},Ue=e=>e.flatMap(n=>n.map(t=>t.trim()).filter(Boolean)),He=e=>fn(e).flatMap(n=>n.map(t=>t.trim()).filter(Boolean)),Ke=e=>e.rows.flatMap(n=>n.map(t=>t.trim()).filter(Boolean)),te=e=>pn(e),qe=e=>pn(fn(e)),Bn=e=>{const n=e.map(c=>gn(w(c,J),2)),t=te(n);if(t<=1)return n;const o=Ge(t),s=[0,1,2,3,4,5].filter(c=>o[c]!==null),i=C();return i.forEach((c,u)=>{i[u]=w(n[u],J)}),s.forEach((c,u)=>{const d=s[(u-1+s.length)%s.length],p=o[c],m=o[d];p===null||m===null||(i[p]=w(n[m],J))}),i},Wn=(e,n)=>{const t=Ge(n),r=[0,1,2,3,4,5].filter(i=>t[i]!==null),s=[...e];return r.forEach((i,c)=>{const u=r[(c-1+r.length)%r.length],d=t[i],p=t[u];d===null||p===null||(s[d]=e[p]||p+1)}),s},jn=e=>{const n=fn(e),t=pn(n);if(t<=1)return e;const o=be(t),r=n.map(u=>gn(w(u,x),1)),i=[0,2,4,1,3,5].filter(u=>o[u]!==null),c=Array.from({length:6},()=>Array(x).fill(""));return i.forEach((u,d)=>{const p=i[(d-1+i.length)%i.length];c[u]=w(r[p],x)}),zn(c)},Fn=e=>({rows:e.rows.map(t=>gn(w(t,en),2))}),jt=(e,n,t)=>{const o=G(t);if(e==="circular"){if(n<1||n>6)throw new Error("圆桌布局组数需在1-6之间");if(o.length>n*J)throw new Error(`圆桌布局每组最多${J}人，当前无法分配`);return{layout:e,groups:je(o,n),rowGroups:M(),arcGroups:E()}}if(e==="rows"){if(n<1||n>6)throw new Error("三横排组数需在1-6之间");if(o.length>n*x)throw new Error(`三横排每组最多${x}人，当前无法分配`);return{layout:e,groups:C(),rowGroups:Fe(o,n),arcGroups:E()}}if(n<1||n>4)throw new Error("两横排组数需在1-4之间");if(o.length>n*9)throw new Error("两横排每组最多9人，当前无法分配");return{layout:e,groups:C(),rowGroups:M(),arcGroups:Wt(o,n)}},Un=e=>36,Ft="ocrEndpoint",Ut=()=>location.hostname==="127.0.0.1"||location.hostname==="localhost",Ht=()=>{try{return new URLSearchParams(location.search).get(Ft)?.trim().replace(/\/$/,"")||""}catch{return""}},Hn=()=>Ht()||(Ut()?"http://127.0.0.1:8787":""),mn=e=>e.trim().replace(/\/$/,"")||Hn(),hn=()=>Hn(),Qe=()=>({engine:"hybrid",allowLocalFallback:!1,tencentEndpoint:hn(),tencentRegion:"ap-guangzhou",tencentAction:"Auto"}),Kn=()=>{const e=j(y.ocrSettings);if(!e)return Qe();try{const n=JSON.parse(e),t=Qe();return{engine:n.engine==="local"||n.engine==="tencent"||n.engine==="hybrid"?n.engine:t.engine,allowLocalFallback:typeof n.allowLocalFallback=="boolean"?n.allowLocalFallback:t.allowLocalFallback,tencentEndpoint:mn(n.tencentEndpoint||t.tencentEndpoint),tencentRegion:(n.tencentRegion||t.tencentRegion).trim()||t.tencentRegion,tencentAction:n.tencentAction==="ExtractDocMulti"||n.tencentAction==="GeneralAccurateOCR"||n.tencentAction==="GeneralBasicOCR"||n.tencentAction==="Auto"?n.tencentAction:t.tencentAction}}catch{return Qe()}},qn=e=>{const n=mn(e.tencentEndpoint);F(y.ocrSettings,JSON.stringify({...e,tencentEndpoint:n,tencentRegion:e.tencentRegion.trim()||"ap-guangzhou"}))},Ze=Kn();Ze.tencentEndpoint!==mn(Ze.tencentEndpoint)&&qn(Ze);let _n=document;const bn=e=>{_n=e},_e=e=>{const n=_n.querySelector(e);if(!n)throw new Error(`Element not found: ${e}`);return n},ve=(e,n,t)=>{const o=document.createElement("input");return o.type="text",o.value=e,o.style.fontSize=`${n}px`,t&&(o.readOnly=!0),o},xe=(e,n=1)=>Math.max(...e.filter(t=>t).map(t=>t.length),n),Kt=(e,n)=>{const t=_e("#classroom");t.innerHTML="",e.currentLayout==="circular"?(t.className="classroom",_t(e,n)):e.currentLayout==="rows"?(t.className="classroom three-rows-layout",Vt(e,n)):(t.className="classroom arc-layout",Jt(e,n))},qt=(e,n)=>{if(e.innerHTML="",n.layout==="circular"){Xt(e,n.groups||[]);return}if(n.layout==="rows"){Yt(e,n.rowGroups);return}Qt(e,n.arcGroups)},_t=(e,n)=>{const t=_e("#classroom"),o=te(e.groups),r=Ge(o);for(let s=0;s<6;s+=1){const i=r[s],c=document.createElement("div");if(i===null){c.className="table table-empty",c.innerHTML='<h3>空组</h3><div class="seats seats-empty"></div>',t.appendChild(c);continue}const u=e.currentGroupOrder[i]||i+1;c.className=`table group-${(u-1)%6+1}`;const d=document.createElement("h3");d.textContent=`Group ${u}`,c.appendChild(d);const p=document.createElement("div");p.className="seats";const m=xe(e.groups[i],1),h=Math.min(16,Math.max(10,Math.floor(140/m)));for(let g=0;g<6;g+=1){const b=document.createElement("div");b.className="seat";const k=e.groups[i][g]||"",S=ve(k,h,!e.isEditMode);S.onchange=()=>n.handleSeatChange(i,g,S.value),b.appendChild(S),p.appendChild(b)}c.appendChild(p),t.appendChild(c)}},Vt=(e,n)=>{const t=_e("#classroom"),o=qe(e.rowGroups),r=be(o);[{leftSlot:0,rightSlot:1},{leftSlot:2,rightSlot:3},{leftSlot:4,rightSlot:5}].forEach((i,c)=>{const u=document.createElement("div");u.className="row";const d=r[i.leftSlot],p=r[i.rightSlot],m=e.rowGroups.rows[c].left,h=e.rowGroups.rows[c].right,g=c===2&&d!==null&&p===null;g&&u.classList.add("single-center");const b=A=>{const R=document.createElement("div");R.className=A==="left"?"group-left":"group-right";const oe=A==="left"?d:p,we=A==="left"?m:h,ke=A,Te=document.createElement("h3");Te.textContent=oe===null?"空组":`Group ${oe+1}`,R.appendChild(Te);const Se=document.createElement("div");Se.className="seats-row";const Ae=xe(we,1),Ce=Math.min(16,Math.max(10,Math.floor(140/Ae)));return we.forEach((Sn,kt)=>{if(!Sn)return;const Xe=document.createElement("div");Xe.className="seat";const Ye=ve(Sn,Ce,!e.isEditMode||oe===null);Ye.onchange=()=>n.handleRowSeatChange(c,ke,kt,Ye.value),Xe.appendChild(Ye),Se.appendChild(Xe)}),R.appendChild(Se),R},k=b("left"),S=b("right");g?(k.classList.add("group-center"),u.appendChild(k)):(u.appendChild(k),u.appendChild(S)),t.appendChild(u)})},Jt=(e,n)=>{const t=_e("#classroom");e.arcGroups.rows.forEach((o,r)=>{const s=document.createElement("div");s.className="arc-row";const i=document.createElement("h3");i.className="two-row-title",i.textContent=r===0?"前排":"后排",s.appendChild(i);const c=document.createElement("div");c.className="arc-seats";const u=xe(o,1),d=Math.min(16,Math.max(12,Math.floor(140/u)));for(let p=0;p<o.length;p+=1){const m=o[p]||"",h=document.createElement("div");h.className="seat arc-seat";const g=ve(m,d,!e.isEditMode);g.onchange=()=>n.handleArcSeatChange(r,p,g.value),h.appendChild(g),c.appendChild(h)}s.appendChild(c),t.appendChild(s)})},Xt=(e,n)=>{const t=te(n),o=Ge(t);for(let r=0;r<6;r+=1){const s=o[r],i=document.createElement("div");if(s===null){i.className="table table-empty",i.innerHTML='<h3>空组</h3><div class="seats seats-empty"></div>',e.appendChild(i);continue}i.className=`table group-${s%6+1}`;const c=document.createElement("h3");c.textContent=`Group ${s+1}`,i.appendChild(c);const u=document.createElement("div");u.className="seats";const d=xe(n[s]||[],1),p=Math.min(16,Math.max(10,Math.floor(140/d)));for(let m=0;m<6;m+=1){const h=document.createElement("div");h.className="seat",h.appendChild(ve(n[s]?.[m]||"",p,!0)),u.appendChild(h)}i.appendChild(u),e.appendChild(i)}},Yt=(e,n)=>{if(!n)return;const t=qe(n),o=be(t);[{leftSlot:0,rightSlot:1},{leftSlot:2,rightSlot:3},{leftSlot:4,rightSlot:5}].forEach((s,i)=>{const c=document.createElement("div");c.className="row";const u=o[s.leftSlot],d=o[s.rightSlot],p=n.rows[i].left,m=n.rows[i].right,h=i===2&&u!==null&&d===null;h&&c.classList.add("single-center");const g=S=>{const A=document.createElement("div");A.className=S==="left"?"group-left":"group-right";const R=S==="left"?u:d,oe=S==="left"?p:m,we=document.createElement("h3");we.textContent=R===null?"空组":`Group ${R+1}`,A.appendChild(we);const ke=document.createElement("div");ke.className="seats-row";const Te=xe(oe,1),Se=Math.min(16,Math.max(10,Math.floor(140/Te)));return oe.forEach(Ae=>{if(!Ae)return;const Ce=document.createElement("div");Ce.className="seat",Ce.appendChild(ve(Ae,Se,!0)),ke.appendChild(Ce)}),A.appendChild(ke),A},b=g("left"),k=g("right");h?(b.classList.add("group-center"),c.appendChild(b)):(c.appendChild(b),c.appendChild(k)),e.appendChild(c)})},Qt=(e,n)=>{n&&n.rows.forEach((t,o)=>{const r=document.createElement("div");r.className="arc-row";const s=document.createElement("h3");s.className="two-row-title",s.textContent=o===0?"前排":"后排",r.appendChild(s);const i=document.createElement("div");i.className="arc-seats";const c=xe(t,1),u=Math.min(16,Math.max(12,Math.floor(140/c)));for(let d=0;d<t.length;d+=1){const p=document.createElement("div");p.className="seat arc-seat",p.appendChild(ve(t[d]||"",u,!0)),i.appendChild(p)}r.appendChild(i),e.appendChild(r)})},Zt=new Set(["paper","classic","mint","rose","apricot","golden","plum"]),eo=e=>Zt.has(e),no=()=>{const e=j(y.classData);if(!e)return{};try{return JSON.parse(e)}catch{return{}}},Vn=e=>{F(y.classData,JSON.stringify(e))},vn=()=>{const e=j(y.batchUndo);if(!e)return null;try{return JSON.parse(e)}catch{return null}},Jn=e=>{F(y.batchUndo,JSON.stringify(e))},Xn=()=>{Dt(y.batchUndo)},to=()=>{const e=j(y.userProfile);if(!e)return nn();try{const n=JSON.parse(e),t=typeof n.username=="string"?n.username:"",o=typeof n.theme=="string"?n.theme:void 0,r=o==="sky"?"mint":o==="sunny"?"golden":o;return{username:t.trim(),theme:r&&eo(r)?r:"paper"}}catch{return nn()}},oo=e=>{F(y.userProfile,JSON.stringify(e))},ro=()=>location.hostname==="127.0.0.1"||location.hostname==="localhost",ao=()=>ro()&&hn().replace(/\/$/,"")||"",so=()=>{const e=j(y.cnfSyncProfile);if(!e)return{username:"",password:""};try{const n=JSON.parse(e);return{username:String(n.username||"").trim(),password:String(n.password||"")}}catch{return{username:"",password:""}}},Yn=e=>{F(y.cnfSyncProfile,JSON.stringify({username:e.username.trim(),password:e.password}))},Qn=async(e,n)=>{const t=ao(),o=await fetch(`${t}/api/cnf-roster`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:e,...n})}),r=await o.json().catch(()=>({}));if(!o.ok||!r.ok)throw new Error(String(r.error||`请求失败 (${o.status})`));return r},io=async e=>(await Qn("listSquads",{username:e.username.trim(),password:e.password})).squads||[],lo=async(e,n,t)=>{const o=await Qn("fetchRoster",{username:e.username.trim(),password:e.password,squadId:String(n).trim(),squadType:t});return{squad:o.squad,students:o.students,total:o.total}},a=Pt();let N=[],re=Kn(),f=null,tn=!1,L="",ue={},de=document,se=null;const co=(e={})=>{ue=e,de=e.queryRoot||document,bn(de)},Zn=()=>{if(ue.launchClassName)return ue.launchClassName.trim();try{return new URLSearchParams(window.location.search).get("class")?.trim()||""}catch{return""}},Ve=e=>de.querySelector(e),Je=e=>Array.from(de.querySelectorAll(e)),l=e=>{const n=Ve(`#${e}`);if(!n)throw new Error(`Missing element: ${e}`);return n},$=()=>l("classSelect"),xn=()=>l("floatingClassSelect"),U=()=>l("headerClassName"),Re=()=>l("notes"),uo=()=>l("classroom"),D=e=>JSON.parse(JSON.stringify(e)),P=e=>{l(e).style.display="block",l("overlay").style.display="block"},q=e=>{l(e).style.display="none",l("overlay").style.display="none"},v=e=>e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"),po=e=>{const n=[...e];for(let t=n.length-1;t>0;t-=1){const o=Math.floor(Math.random()*(t+1));[n[t],n[o]]=[n[o],n[t]]}return n},et=e=>{try{const n=window.localStorage.getItem("amber_class_profiles");if(!n)return[];const o=JSON.parse(n).find(r=>String(r?.classCode||"").trim().toUpperCase()===e.trim().toUpperCase());return G(Array.isArray(o?.students)?o.students.map(r=>String(r?.chineseName||"").trim()).filter(Boolean):[])}catch{return[]}},go=e=>{const n=et(e);if(n.length===0){alert("没有找到这班的核心名单，请先去“班级名单检查”里保存。");return}Q(e),I(e),L=e,U().value=e,a.currentTimeMode="weekday",ye("editor"),ut(po(n)),T()},Pe=()=>{oo(a.userProfile)},O=()=>{Vn(a.classData)},Y=e=>{const n=ue.hostElement;n&&(n.classList.remove("theme-paper","theme-classic","theme-mint","theme-rose","theme-apricot","theme-golden","theme-plum"),n.classList.add(`theme-${e}`),l("themeSelect").value=e)},nt=e=>a.classData[e]?.theme||a.userProfile.theme||"paper",on=e=>{l("editorThemeSelect").value=e},fo=()=>{if(a.userProfile.username.trim())return;const t=window.prompt("请输入用户名","Teacher")?.trim()||"Teacher";a.userProfile.username=t,Pe()},Me=()=>{const e=Nt();l("homeWeekNum").textContent=String(e),l("welcomeText").textContent=`${cn} · ${a.userProfile.username}`,l("todayText").textContent=`今天是 ${Tt()}，第${e}周，${At()}`,l("usernameInput").value=a.userProfile.username},tt=e=>{l("homeView").querySelector(".usage-guide")?.classList.toggle("hidden",!e),l("usageGuideToggleBtn").textContent=e?"隐藏使用说明":"查看使用说明",F(y.usageGuideDismissed,e?"0":"1")},mo=()=>{tt(j(y.usageGuideDismissed)!=="1")},ho=()=>{const e=l("homeView").querySelector(".usage-guide");tt(e?.classList.contains("hidden")??!1)},ze=e=>e.layout==="circular"?Ue(e.groups||[]).length:e.layout==="rows"?He(e.rowGroups||M()).length:Ke(e.arcGroups||E()).length,Le=()=>{const e=l("syncOtherModeBtn"),n=$().value.trim(),o=(a.currentTimeMode==="weekday"?"weekend":"weekday")==="weekday"?"周中":"周末";if(!n||!a.classData[n]){e.textContent=`同步到${o}`,e.disabled=!0;return}const r=a.classData[n][a.currentTimeMode],s=ze(r);e.textContent=`同步到${o}`,e.disabled=s===0,e.title=s===0?"当前时段还没有可同步的名单。":`将当前学生名单和座位顺序同步到${o}。`},rn=e=>e==="rows"?"三横排":e==="arc"?"两横排":"圆桌",bo=e=>e==="weekday"?"周中":"周末",I=e=>{$().value=e,xn().value=e},H=()=>{const e=l("editorFloatingContext"),n=l("floatingClassMeta"),t=L.trim();e.classList.toggle("hidden",a.currentView!=="editor"),a.currentView==="editor"&&(I(t),n.textContent=t?`${bo(a.currentTimeMode)} · ${rn(a.currentLayout)}`:"未选择班级")},En=e=>{const n=$e(e.locationInfo);return[n.weekday,n.time,n.campus,n.room].filter(Boolean).join(" · ")||"未设置"},T=()=>{const e=l("homeClassList"),n=Object.keys(a.classData).sort();if(n.length===0){e.innerHTML='<div class="class-card empty">暂无班级，请点击“新建班级座位表”</div>',Ln(),Le();return}const t=n.map(o=>{const r=a.classData[o],s=ze(r.weekday),i=ze(r.weekend);return`
        <article class="class-card" data-open-class="${v(o)}">
          <div class="class-card-header">
            <strong>${v(o)}</strong>
            <span>${s+i} 人次</span>
          </div>
          <div class="class-card-meta">
            <span class="mode-chip">周中</span>
            <span>${v(rn(r.weekday.layout))}</span>
            <span>${s} 人</span>
          </div>
          <div class="class-card-detail">${v(En(r.weekday))}</div>
          <div class="class-card-meta">
            <span class="mode-chip weekend">周末</span>
            <span>${v(rn(r.weekend.layout))}</span>
            <span>${i} 人</span>
          </div>
          <div class="class-card-detail">${v(En(r.weekend))}</div>
          <button>进入编辑</button>
        </article>
      `}).join("");e.innerHTML=t,Ln(),Le()},vo=()=>{const e=Zn();if(!e)return;if(a.classData[e]){yn(e);return}U().value=e;const n=l("homeClassList"),t=et(e),o=document.createElement("div");o.className="class-card empty",o.innerHTML=t.length>0?`
      <div>已从 Amber 打开班级 ${v(e)}，当前座位表里还没有这班的数据。</div>
      <div style="margin-top: 8px;">已发现 ${t.length} 人核心名单，可以直接随机生成第一版圆桌座位。</div>
      <div style="margin-top: 12px;">
        <button type="button" data-use-roster-class="${v(e)}">用现有名单随机生成</button>
      </div>
    `:`已从 Amber 打开班级 ${e}，当前座位表里还没有这班的数据。可直接新建或导入。`,n.prepend(o)},Ln=()=>{const e=l("undoWeekBtn");e.disabled=!vn()},ye=e=>{a.currentView=e;const n=l("homeView"),t=l("editorView");if(e==="home"){n.classList.remove("hidden"),t.classList.add("hidden"),Me(),T(),H();return}n.classList.add("hidden"),t.classList.remove("hidden"),H()},_=()=>{const e=Object.keys(a.classData).sort(),n=t=>{t.innerHTML='<option value="">选择班级...</option>',e.forEach(o=>{const r=document.createElement("option");r.value=o,r.textContent=o,t.appendChild(r)})};n($()),n(xn()),H()},$e=e=>{const n={...he(),...e};return n.fullDate||(n.fullDate=me(n.date,n.day)||""),n},$n=e=>{const n=$e(e.locationInfo||{});if(e.layout==="circular"){const r=C();(e.groups||[]).slice(0,6).forEach((c,u)=>{r[u]=G(c).slice(0,6).concat(Array(6).fill("")).slice(0,6)});const s=[1,2,3,4,5,6],i=(e.groupOrder||s).slice(0,6).concat(s).slice(0,6);return{layout:"circular",groups:r,groupOrder:i,rowGroups:null,arcGroups:null,currentArrangement:e.currentArrangement||0,locationInfo:n}}if(e.layout==="rows"){const r=M(),s=e.rowGroups?.rows||[];for(let i=0;i<3;i+=1)r.rows[i].left=G(s[i]?.left||[]).slice(0,6).concat(Array(6).fill("")).slice(0,6),r.rows[i].right=G(s[i]?.right||[]).slice(0,6).concat(Array(6).fill("")).slice(0,6);return{layout:"rows",groups:null,groupOrder:null,rowGroups:r,arcGroups:null,currentArrangement:e.currentArrangement||0,locationInfo:n}}const t=E();return(e.arcGroups?.rows||(e.groups?.length===2&&e.groups[0].length===18?e.groups:[])).slice(0,2).forEach((r,s)=>{t.rows[s]=G(r).slice(0,18).concat(Array(18).fill("")).slice(0,18)}),{layout:"arc",groups:null,groupOrder:null,rowGroups:null,arcGroups:t,currentArrangement:e.currentArrangement||0,locationInfo:n}},an=e=>{const n=We("circular",a.userProfile.theme);return{theme:e?.theme||a.userProfile.theme||"paper",weekday:$n(e?.weekday||n.weekday),weekend:$n(e?.weekend||n.weekend)}},ot=e=>({theme:e.theme,weekday:D(e.weekday),weekend:D(e.weekend)}),Be=e=>{const n={};return Object.entries(e).forEach(([t,o])=>{const r=We("circular",a.userProfile.theme),s=an(o);r.theme=s.theme,r.weekday=s.weekday,r.weekend=s.weekend,r.previousWeek=o.previousWeek?an(o.previousWeek):null,r.cnf=o.cnf||null,n[t]=r}),n},xo=e=>e==="classic"||e==="mint"||e==="rose"||e==="apricot"||e==="golden"||e==="plum"||e==="paper"?e:"paper",yo=()=>({app:{name:cn,slug:On},exportedAt:new Date().toISOString(),sourceOrigin:window.location.origin,classData:D(a.classData),userProfile:{username:a.userProfile.username,theme:a.userProfile.theme},batchUndo:D(vn())}),wo=()=>{const e=yo(),n=e.exportedAt.slice(0,19).replace(/[:T]/g,"-"),t=new Blob([JSON.stringify(e,null,2)],{type:"application/json"}),o=URL.createObjectURL(t),r=document.createElement("a");r.href=o,r.download=`${Ct}-${n}.json`,r.click(),URL.revokeObjectURL(o)},ko=e=>{a.userProfile={username:typeof e.userProfile?.username=="string"?e.userProfile.username.trim():"",theme:xo(e.userProfile?.theme)},Pe(),Y(a.userProfile.theme),Me(),a.classData=Be(e.classData&&typeof e.classData=="object"?e.classData:{}),O(),e.batchUndo&&typeof e.batchUndo=="object"?Jn(Be(e.batchUndo)):Xn(),L="",I(""),_(),T(),ye("home")},So=async e=>{const n=e.target,t=n.files?.[0];if(t)try{const o=JSON.parse(await t.text());ko(o),window.alert("备份导入成功，当前页面已切回主页。")}catch{window.alert("备份文件读取失败，请确认选择的是导出的 JSON 备份。")}finally{n.value=""}},Co=()=>{l("backupImportInput").click()},Do=()=>{const e=no();a.classData=Be(e),L="",_()},rt=()=>{const e=l("date").value.trim(),n=l("day").value.trim(),t=l("date").dataset.fullDate||"",o=me(e,n)||t;return{date:e,day:n,weekday:l("weekday").value,time:l("time").value,campus:l("campus").value,floor:l("floor").value,room:l("room").value,notes:Re().innerHTML,fullDate:o}},sn=e=>{const n=$e(e);l("date").value=n.date,l("date").dataset.fullDate=n.fullDate,l("day").value=n.day,l("weekday").value=n.weekday,l("time").value=n.time,l("campus").value=n.campus,l("floor").value=n.floor,l("room").value=n.room,Re().innerHTML=n.notes},at=()=>({layout:a.currentLayout,groups:a.currentLayout==="circular"?JSON.parse(JSON.stringify(a.groups)):null,groupOrder:a.currentLayout==="circular"?[...a.currentGroupOrder]:null,rowGroups:a.currentLayout==="rows"?JSON.parse(JSON.stringify(a.rowGroups)):null,arcGroups:a.currentLayout==="arc"?JSON.parse(JSON.stringify(a.arcGroups)):null,currentArrangement:a.currentArrangement,locationInfo:rt()}),Q=e=>{a.classData[e]||(a.classData[e]=We(a.currentLayout,a.userProfile.theme))},V=()=>{const e=L.trim();e&&(Q(e),a.classData[e][a.currentTimeMode]=at(),a.classData[e].theme=nt(e),O())},st=()=>{a.groups=C(),a.currentGroupOrder=[1,2,3,4,5,6],a.rowGroups=M(),a.arcGroups=E()},pe=e=>{const n=uo();n.className="classroom",e==="rows"?n.classList.add("three-rows-layout"):e==="arc"&&n.classList.add("arc-layout")},z=()=>{Kt(a,{handleSeatChange:(e,n,t)=>{a.isEditMode&&(a.groups[e][n]=t)},handleRowSeatChange:(e,n,t,o)=>{a.isEditMode&&(a.rowGroups.rows[e][n][t]=o)},handleArcSeatChange:(e,n,t)=>{a.isEditMode&&(a.arcGroups.rows[e][n]=t)}})},Z=()=>{const e=$().value,n=a.classData[e]?.[a.currentTimeMode];if(!e||!n){L=e||"",a.currentLayout="circular",st(),a.currentArrangement=0,sn(he()),U().value=e||"",on(a.userProfile.theme),Y(a.userProfile.theme),pe(a.currentLayout),z(),Le(),H();return}L=e,a.currentLayout=n.layout||"circular",a.currentArrangement=n.currentArrangement||0,a.currentLayout==="circular"?(a.groups=JSON.parse(JSON.stringify(n.groups||C())),a.currentGroupOrder=[...n.groupOrder||[1,2,3,4,5,6]],a.rowGroups=M(),a.arcGroups=E()):a.currentLayout==="rows"?(a.rowGroups=JSON.parse(JSON.stringify(n.rowGroups||M())),a.groups=C(),a.currentGroupOrder=[1,2,3,4,5,6],a.arcGroups=E()):(a.arcGroups=JSON.parse(JSON.stringify(n.arcGroups||E())),a.groups=C(),a.currentGroupOrder=[1,2,3,4,5,6],a.rowGroups=M()),sn(n.locationInfo),U().value=e;const t=nt(e);on(t),Y(t),pe(a.currentLayout),z(),Le(),H()},it=e=>{a.currentTimeMode=e,l("weekdayBtn").className="active",l("weekendBtn").className="",e==="weekend"&&(l("weekdayBtn").className="",l("weekendBtn").className="active"),H()},Eo=()=>Je(".dialog").some(e=>e.style.display==="block"),Lo=()=>{Je(".dialog").forEach(e=>{e.style.display="none"}),l("overlay").style.display="none",f=null},ln=(e,n)=>{const t=e.trim(),o=L.trim();if(!t){I(o);return}if(t===o&&a.currentView==="editor"){I(t),H();return}if(tn){window.alert("图片识别进行中，请等待当前识别完成后再切换班级。"),I(o);return}if(!n?.preserveDialogs&&Eo()){if(!window.confirm("当前有功能弹窗处于打开状态。切换班级会先关闭弹窗，并放弃这些弹窗里未确认的临时修改，是否继续？")){I(o);return}Lo()}a.currentView==="editor"&&o&&V(),n?.resetMode&&it("weekday"),I(t),Z(),ye("editor")},yn=e=>{ln(e,{resetMode:!0,preserveDialogs:!0})},$o=()=>{V(),Y(a.userProfile.theme),ye("home")},Go=e=>{V(),it(e),Z()},Mo=()=>{const e=$().value.trim();if(!e){alert("请先选择班级。");return}Q(e),V();const n=a.currentTimeMode==="weekday"?"weekend":"weekday",t=n==="weekday"?"周中":"周末",o=a.classData[e][a.currentTimeMode],r=a.classData[e][n];if(ze(o)===0){alert("当前时段还没有可复制的名单。");return}window.confirm(`是否同步所有学生及座位顺序到${t}？

这会覆盖${t}当前的座位布局与学生顺序，但保留${t}原本的日期、时间、校区和备注信息。`)&&(a.classData[e][n]={layout:o.layout,groups:o.layout==="circular"?D(o.groups):null,groupOrder:o.layout==="circular"?[...o.groupOrder||[1,2,3,4,5,6]]:null,rowGroups:o.layout==="rows"?D(o.rowGroups):null,arcGroups:o.layout==="arc"?D(o.arcGroups):null,currentArrangement:o.currentArrangement,locationInfo:D(r.locationInfo||he())},O(),Le(),alert(`已把当前学生名单和座位顺序同步到${t}。`))},To=()=>{l("saveClassName").value=U().value,P("saveDialog")},lt=()=>{q("saveDialog")},Ao=()=>{const e=l("saveClassName").value.trim();if(!e){alert("请输入班级名称");return}Q(e),a.classData[e][a.currentTimeMode]=at(),O(),_(),I(e),L=e,U().value=e,lt(),T(),H()},No=()=>{const e=$().value;e&&confirm(`确定要删除 ${e} 的所有配置吗？`)&&(delete a.classData[e],O(),_(),T(),U().value="",L="",I(""),a.currentLayout="circular",st(),a.currentArrangement=0,on(a.userProfile.theme),Y(a.userProfile.theme),sn(he()),z(),H())},Oo=()=>{const e=$().value.trim();if(!e){alert("请先选择班级。");return}V();const t=window.prompt("输入新的班号",e)?.trim();if(!(!t||t===e)){if(a.classData[t]){alert("这个班号已经存在了，请换一个名称。");return}a.classData[t]=a.classData[e],delete a.classData[e],O(),_(),T(),I(t),L=t,U().value=t,Z()}},Gn=()=>{const e=rt();l("date").dataset.fullDate=e.fullDate},Io=()=>{l("studentNames").value="",l("errorMsg").textContent="",l("errorMsg").className="",P("importDialog")},ct=()=>{q("importDialog")},ge=e=>{const n=l("errorMsg");n.textContent=e,n.className="error"},Ro=e=>{const n=l("errorMsg");n.textContent=e,n.className="success",setTimeout(()=>{n.textContent="",n.className=""},2500)},Po=()=>{const e=$().value.trim();if(e)return L=e,e;const n=U().value.trim()||`Class${Object.keys(a.classData).length+1}`,o=window.prompt("请输入班级名称以保存导入结果",n)?.trim();return o?(Q(o),_(),I(o),L=o,U().value=o,o):null},wn=e=>{if(a.currentView==="home"&&ye("editor"),z(),ct(),!Po()){alert("已导入到当前画布，但你取消了保存，数据不会持久化。");return}V(),Ro(e)},ut=e=>{const n=G(e);if(n.length===0){ge("请至少输入1名学生");return}if(n.length>36){ge(`圆桌布局最多36人，当前${n.length}人`);return}a.currentLayout="circular",a.groups=je(n),a.currentGroupOrder=[1,2,3,4,5,6],a.rowGroups=M(),a.arcGroups=E(),a.currentArrangement=0,pe("circular");const t=Rn(n.length);wn(`成功导入${n.length}人，分为${t}组`)},zo=e=>{const n=G(e);if(n.length===0){ge("请至少输入1名学生");return}if(n.length>36){ge(`三横排布局最多36人，当前${n.length}人`);return}a.currentLayout="rows",a.rowGroups=Fe(n),a.groups=C(),a.currentGroupOrder=[1,2,3,4,5,6],a.arcGroups=E(),a.currentArrangement=0,pe("rows");const t=Pn(n.length);wn(`成功导入${n.length}人，分为${t}组`)},Bo=e=>{const n=e.split(`
`).map(u=>u.trim()).filter(Boolean);let t=[],o=[];const r=u=>u.split(/[,，]/).map(d=>d.trim()).filter(Boolean),s=n[0]||"",i=n[1]||"";s.startsWith("第一排")?t=r(s.substring(s.indexOf(":")+1)):s&&(t=r(s)),i.startsWith("第二排")?o=r(i.substring(i.indexOf(":")+1)):i&&(o=r(i));const c=t.length+o.length;if(c===0){ge("请至少输入1名学生");return}if(c>36){ge(`两横排布局最多36人，当前${c}人`);return}a.currentLayout="arc",a.groups=C(),a.currentGroupOrder=[1,2,3,4,5,6],a.rowGroups=M(),a.arcGroups=E(),X(a.arcGroups.rows[0],t),X(a.arcGroups.rows[1],o),a.currentArrangement=0,pe("arc"),wn(`成功导入两横排布局，共${c}人`)},Wo=()=>{const e=l("studentNames").value,n=e.split(`
`).map(t=>t.trim()).filter(Boolean);if(l("circularLayout").checked){ut(n);return}if(l("rowsLayout").checked){zo(n);return}Bo(e)},jo=e=>{const n={...e},t=n.fullDate||me(n.date,n.day)||Rt(n.time)||"";if(!t)return n;const o=Ot(t,7);if(!o)return n;const r=It(o);return n.fullDate=o,r&&(n.date=r.month,n.day=r.day,n.weekday||(n.weekday=r.weekday)),n},Mn=(e,n)=>{const t=n?jo($e(e.locationInfo)):$e(e.locationInfo);if(e.layout==="circular"){const o=te(e.groups||C());return{...e,groups:Bn(e.groups||C()),groupOrder:Wn(e.groupOrder||[1,2,3,4,5,6],o),currentArrangement:(e.currentArrangement+1)%200,locationInfo:t}}return e.layout==="rows"?{...e,rowGroups:jn(e.rowGroups||M()),groupOrder:null,currentArrangement:(e.currentArrangement+1)%200,locationInfo:t}:{...e,arcGroups:Fn(e.arcGroups||E()),groupOrder:null,currentArrangement:(e.currentArrangement+1)%200,locationInfo:t}},Fo=()=>{if(a.isEditMode){z();return}if(a.currentLayout==="circular"){const e=te(a.groups);a.groups=Bn(a.groups),a.currentGroupOrder=Wn(a.currentGroupOrder,e)}else a.currentLayout==="rows"?a.rowGroups=jn(a.rowGroups):a.arcGroups=Fn(a.arcGroups);a.currentArrangement=(a.currentArrangement+1)%200,z(),V()},Uo=()=>{Jn(D(a.classData)),Object.keys(a.classData).forEach(e=>{const n=a.classData[e];a.classData[e]={theme:n.theme,previousWeek:ot(n),weekday:Mn(n.weekday,!0),weekend:Mn(n.weekend,!0),cnf:n.cnf||null}}),O(),Me(),T(),a.currentView==="editor"&&$().value&&Z(),alert("已生成新一周座位表，所有班级已完成轮转并保存。")},Ho=()=>{const e=vn();if(!e){alert("当前没有可撤回的周轮转记录。");return}a.classData=Be(e),Xn(),O(),_(),T(),a.currentView==="editor"&&$().value&&Z(),alert("已撤回上次主页周轮转。")},Ko=()=>a.currentLayout==="circular"?Ue(a.groups):a.currentLayout==="rows"?He(a.rowGroups):Ke(a.arcGroups),qo=e=>[...G(e)].sort((n,t)=>n.localeCompare(t,"en",{sensitivity:"base",numeric:!0})),_o=()=>{const e=$().value.trim();if(!e){alert("请先选择班级。");return}const n=a.classData[e]?.previousWeek;if(!n){alert("这个班级还没有上一周记录。");return}const t=a.currentTimeMode==="weekday"?"周中":"周末",o=l("previousWeekPreview"),r=l("previousWeekSummary");o.className=`previous-week-preview ${n[a.currentTimeMode].layout==="rows"?"three-rows-layout":n[a.currentTimeMode].layout==="arc"?"arc-layout":"classroom"}`,r.textContent=`${e} · ${t} · 预览上一周座位。恢复后会把当前版本保留为新的“上周”记录。`,qt(o,n[a.currentTimeMode]),P("previousWeekDialog")},dt=()=>{q("previousWeekDialog")},Vo=()=>{const e=$().value.trim();if(!e)return;const n=a.classData[e],t=n?.previousWeek;if(!n||!t){alert("没有可恢复的上一周记录。");return}const o=ot(n);a.classData[e]={...an(t),previousWeek:o,cnf:n.cnf||null},O(),Z(),T(),dt(),alert("已恢复为上周版本。")},pt=()=>{const e=$().value.trim();if(!e){alert("请先选择班级。");return}const n=qo(Ko()),t=l("rosterSummary"),o=l("rosterList"),r=a.currentTimeMode==="weekday"?"周中":"周末";t.textContent=`${e} · ${r} · 当前总人数 ${n.length} 人`,o.innerHTML=n.length?n.map((s,i)=>`<div class="roster-item"><span>${i+1}.</span><strong>${v(s)}</strong><button type="button" class="roster-delete-btn" data-delete-student="${v(s)}" title="删除该学生">&times;</button></div>`).join(""):'<div class="muted">当前没有学生名单。</div>',P("rosterDialog")},Jo=e=>{const n=$().value.trim();if(!n||!a.classData[n])return;const t=a.classData[n][a.currentTimeMode];if(t){if(t.groups){for(const o of t.groups)for(let r=0;r<o.length;r++)o[r]===e&&(o[r]="");a.groups=D(t.groups)}if(t.rowGroups){for(const o of t.rowGroups.rows){for(let r=0;r<o.left.length;r++)o.left[r]===e&&(o.left[r]="");for(let r=0;r<o.right.length;r++)o.right[r]===e&&(o.right[r]="")}a.rowGroups=D(t.rowGroups)}if(t.arcGroups){for(const o of t.arcGroups.rows)for(let r=0;r<o.length;r++)o[r]===e&&(o[r]="");a.arcGroups=D(t.arcGroups)}O(),T(),pt()}},Xo=()=>{q("rosterDialog")},Yo=()=>{a.isEditMode=!a.isEditMode;const e=Ve(".edit-mode button");e&&(e.textContent=a.isEditMode?"退出编辑":"编辑模式",e.style.background=a.isEditMode?"#f44336":"#2196F3"),z()},Qo=()=>{const e=a.currentLayout==="circular"?Ue(a.groups):a.currentLayout==="rows"?He(a.rowGroups):Ke(a.arcGroups),n=a.currentLayout==="circular"?"rows":a.currentLayout==="rows"?"arc":"circular";if(e.length>Un(n)){alert(`当前人数超出${n}布局上限`);return}if(a.currentLayout=n,a.currentArrangement=0,n==="circular")a.groups=je(e),a.currentGroupOrder=[1,2,3,4,5,6],a.rowGroups=M(),a.arcGroups=E();else if(n==="rows")a.rowGroups=Fe(e),a.groups=C(),a.currentGroupOrder=[1,2,3,4,5,6],a.arcGroups=E();else{const t=Math.ceil(e.length/2);a.arcGroups=E(),X(a.arcGroups.rows[0],e.slice(0,t)),X(a.arcGroups.rows[1],e.slice(t,t+18)),a.groups=C(),a.currentGroupOrder=[1,2,3,4,5,6],a.rowGroups=M()}pe(n),z(),V(),H()},Ne=()=>{const e=l("layoutDescription");if(l("circularLayout").checked){e.innerHTML=`
      <ul style="font-size: 14px; color: #666; margin: 10px 0;">
        <li>圆桌：31-36人=6组，25-30人=5组，19-24人=4组，1-18人=3组</li>
        <li>每组最多6人，自动跳过空组轮转</li>
      </ul>
    `;return}if(l("rowsLayout").checked){e.innerHTML=`
      <ul style="font-size: 14px; color: #666; margin: 10px 0;">
        <li>三横排：31-36人=6组，25-30人=5组，1-24人=4组</li>
        <li>轮转按组号+2，跳过空组</li>
      </ul>
    `;return}e.innerHTML=`
    <ul style="font-size: 14px; color: #666; margin: 10px 0;">
      <li>两横排布局：前排与后排，每排最多18人</li>
      <li>支持按“第一排 / 第二排”直接导入</li>
    </ul>
  `},Zo=()=>{P("createClassDialog")},gt=()=>{q("createClassDialog")},er=(e,n)=>{if(e==="arc"){const o=n[0]?.filter(Boolean).join(", ")||"",r=n[1]?.filter(Boolean).join(", ")||"";return`第一排: ${o}
第二排: ${r}`}const t=[];return n.forEach((o,r)=>{const s=[...o,...Array(Math.max(0,6-o.length)).fill("")].slice(0,6);if(s.some(Boolean)){const i=s.slice(0,2).map(d=>d||"_").join(", "),c=s.slice(2,4).map(d=>d||"_").join(", "),u=s.slice(4,6).map(d=>d||"_").join(", ");t.push(`Group ${r+1}: ${i} | ${c} | ${u}`)}}),t.join(`
`)},ie=(e,n)=>{const t=n.split(`
`).map(r=>r.trim()).filter(Boolean);if(e==="arc"){const r=[Array(18).fill(""),Array(18).fill("")],s=u=>u.split(/[,，]/).map(d=>d.trim()).filter(Boolean).slice(0,18);let i=[],c=[];return t[0]?.startsWith("第一排")?(i=s(t[0].substring(t[0].indexOf(":")+1)),c=s((t[1]||"").substring((t[1]||"").indexOf(":")+1))):(i=s(t[0]||""),c=s(t[1]||"")),X(r[0],i),X(r[1],c),r}const o=Array.from({length:6},()=>[]);return t.forEach((r,s)=>{const i=r.match(/Group\s*(\d+)\s*:/i);if(i){const c=Math.max(0,Math.min(5,Number.parseInt(i[1],10)-1)),u=r.substring(r.indexOf(":")+1).trim();if(u.includes("|")){const d=u.split("|").flatMap(p=>p.split(/[,，]/).map(m=>m.trim()).map(m=>m==="_"?"":m)).slice(0,6);o[c]=[...d,...Array(Math.max(0,6-d.length)).fill("")].slice(0,6);return}o[c]=r.substring(r.indexOf(":")+1).split(/[,，]/).map(d=>d.trim()).filter(Boolean).slice(0,6);return}s<6&&(o[s]=r.split(/[,，]/).map(c=>c.trim()).filter(Boolean).slice(0,6))}),o},nr=e=>{const n=e.className||e.fileName.replace(/\.[^.]+$/,"").slice(0,12);return{id:`${Date.now()}-${Math.random().toString(36).slice(2,9)}`,fileName:e.fileName,source:e.source||"unknown",errorMessage:"",className:n,layout:e.layout,mode:"weekday",overwrite:!0,groupsText:er(e.layout,e.groups),detectedStudentCount:e.detectedStudentCount,placedStudentCount:e.placedStudentCount,confidence:e.confidence,date:e.info.date,day:e.info.day,weekday:e.info.weekday,time:e.info.time,campus:e.info.campus,floor:e.info.floor,room:e.info.room,fullDate:e.info.fullDate}},Oe=()=>{const e=l("ocrReviewList");if(N.length===0){e.innerHTML="";return}e.innerHTML=N.map(n=>{const o=Math.abs(n.detectedStudentCount-n.placedStudentCount)>0?`<div class="error">识别人数(${n.detectedStudentCount}) 与落座人数(${n.placedStudentCount}) 不一致，请核对。</div>`:`<div class="success">识别人数与落座人数一致：${n.placedStudentCount}</div>`,r=n.errorMessage?`<div class="error">失败原因：${v(n.errorMessage)}</div>`:"";return`
        <div class="ocr-card" data-id="${v(n.id)}">
          <h3>${v(n.fileName)}</h3>
          <div class="ocr-source">识别来源：${v(n.source)}</div>
          ${r}
          <div class="ocr-card-grid">
            <label>班级名<input data-field="className" value="${v(n.className)}" /></label>
            <label>模式
              <select data-field="mode">
                <option value="weekday" ${n.mode==="weekday"?"selected":""}>周中</option>
                <option value="weekend" ${n.mode==="weekend"?"selected":""}>周末</option>
              </select>
            </label>
            <label>布局
              <select data-field="layout">
                <option value="circular" ${n.layout==="circular"?"selected":""}>圆桌</option>
                <option value="rows" ${n.layout==="rows"?"selected":""}>三横排</option>
              </select>
            </label>
            <label>覆盖同名班级
              <select data-field="overwrite">
                <option value="true" ${n.overwrite?"selected":""}>覆盖</option>
                <option value="false" ${n.overwrite?"":"selected"}>新建</option>
              </select>
            </label>
            <label>月<input data-field="date" value="${v(n.date)}" /></label>
            <label>日<input data-field="day" value="${v(n.day)}" /></label>
            <label>星期<input data-field="weekday" value="${v(n.weekday)}" /></label>
            <label>时间<input data-field="time" value="${v(n.time)}" /></label>
            <label>校区<input data-field="campus" value="${v(n.campus)}" /></label>
            <label>楼层<input data-field="floor" value="${v(n.floor)}" /></label>
            <label>教室<input data-field="room" value="${v(n.room)}" /></label>
          </div>
          ${o}
          <label>座位文本（可修改）
            <textarea data-field="groupsText">${v(n.groupsText)}</textarea>
          </label>
        </div>
      `}).join("")},ft=()=>{const e=l("ocrEngine").value;l("ocrCloudConfig").classList.toggle("hidden",e==="local")},ee=(e,n="muted")=>{const t=l("ocrEngineStatus");t.classList.remove("error","success","muted"),t.classList.add(n),t.textContent=e},tr=()=>{l("ocrEngine").value=re.engine,l("allowLocalFallback").checked=re.allowLocalFallback,l("tencentEndpoint").value=re.tencentEndpoint,l("tencentRegion").value=re.tencentRegion,l("tencentAction").value=re.tencentAction,ft()},ne=()=>{const e=l("ocrEngine").value,n={engine:e==="local"||e==="tencent"||e==="hybrid"?e:"hybrid",allowLocalFallback:l("allowLocalFallback").checked,tencentEndpoint:l("tencentEndpoint").value.trim().replace(/\/$/,"")||hn(),tencentRegion:l("tencentRegion").value.trim()||"ap-guangzhou",tencentAction:l("tencentAction").value};return n.tencentAction!=="Auto"&&n.tencentAction!=="ExtractDocMulti"&&n.tencentAction!=="GeneralAccurateOCR"&&n.tencentAction!=="GeneralBasicOCR"&&(n.tencentAction="Auto"),re=n,qn(n),n},or=async()=>{const e=ne();if(e.engine==="local"){ee("当前为仅本地OCR模式，不会请求腾讯接口。","success");return}ee("检测中...");try{const n=e.tencentEndpoint.replace(/\/$/,""),t=await fetch(`${n}/api/health`),o=await t.json().catch(()=>({}));if(!t.ok)throw new Error("代理返回异常状态码");const r=o?.secretConfigured===!0,s="ExtractDocMulti -> GeneralAccurateOCR -> GeneralBasicOCR",i=String(o?.service||"tencent-ocr-proxy"),c=e.allowLocalFallback?"开启":"关闭",u=N.length>0?`；最近识别来源：${N[0].source}`:"";if(!r){ee("腾讯代理在线，但未检测到密钥配置（或代理未读取到环境变量）。","error");return}const d=await fetch(`${n}/api/self-test`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:e.tencentAction,region:e.tencentRegion})}),p=await d.json().catch(()=>({}));if(!d.ok)throw new Error("OCR自检请求失败");if(p?.ok===!0){const g=String(p?.action||"unknown"),b=p?.warning?`；说明：${String(p.warning)}`:"";ee(`${i} 在线，权限正常。自检命中：${g}${b}；自动策略：${s}；本地回退：${c}${u}`,"success");return}const m=String(p?.error||"权限或接口不可用"),h=Array.isArray(p?.tried)?p.tried.map(g=>String(g.action||"").trim()).filter(Boolean).join(" -> "):"";ee(`${i} 在线但自检失败：${m}${h?`；尝试接口：${h}`:""}；自动策略：${s}；本地回退：${c}${u}`,"error")}catch(n){const t=n instanceof Error?n.message:"检测失败";ee(`检测失败：${t}`,"error")}},rr=()=>{gt(),tr(),ee("点击“检测OCR通道”可验证当前是否走腾讯AI接口。"),l("ocrProgress").textContent="",l("imageFiles").value="",N=[],Oe(),P("imageImportDialog")},mt=()=>{q("imageImportDialog")},ar=async()=>{const e=Array.from(l("imageFiles").files||[]),n=l("ocrProgress"),t=ne();if(e.length===0){n.textContent="请先选择至少一张图片。";return}N=[],Oe(),tn=!0;try{const{recognizeClassFromImage:o}=await $t(async()=>{const{recognizeClassFromImage:r}=await import("./ocr-BAnFo0MA.js");return{recognizeClassFromImage:r}},[]);for(let r=0;r<e.length;r+=1){const s=e[r];n.textContent=`正在识别 ${r+1}/${e.length}: ${s.name}（${t.engine}）`;try{const i=await o(s,t);N.push(nr(i)),Oe()}catch(i){const c=i instanceof Error?i.message:"识别失败";N.push({id:`${Date.now()}-${Math.random().toString(36).slice(2,9)}`,fileName:s.name,source:`failed:${t.engine}`,errorMessage:c,className:s.name.replace(/\.[^.]+$/,""),layout:"circular",mode:"weekday",overwrite:!0,groupsText:"",detectedStudentCount:0,placedStudentCount:0,confidence:0,date:"",day:"",weekday:"",time:"",campus:"",floor:"",room:"",fullDate:""}),n.textContent=`图片 ${s.name} 识别失败：${c}`,Oe()}}n.textContent=`识别完成，共 ${N.length} 条，可修改后确认导入。`}finally{tn=!1}},sr=e=>{const n={...he(),date:e.date,day:e.day,weekday:e.weekday,time:e.time,campus:e.campus,floor:e.floor,room:e.room,fullDate:e.fullDate||me(e.date,e.day)||""};if(e.layout==="circular"){const o=ie("circular",e.groupsText),r=C();return o.slice(0,6).forEach((s,i)=>{r[i]=G(s).slice(0,6).concat(Array(6).fill("")).slice(0,6)}),{layout:"circular",groups:r,groupOrder:[1,2,3,4,5,6],rowGroups:null,arcGroups:null,currentArrangement:0,locationInfo:n}}if(e.layout==="rows"){const o=ie("rows",e.groupsText),r=be(o.filter(i=>i.length>0).length||4),s=Array.from({length:6},()=>Array(6).fill(""));return r.forEach((i,c)=>{i!==null&&(s[c]=G(o[i]||[]).slice(0,6).concat(Array(6).fill("")).slice(0,6))}),{layout:"rows",groups:null,groupOrder:null,rowGroups:{rows:[{left:s[0],right:s[1]},{left:s[2],right:s[3]},{left:s[4],right:s[5]}]},arcGroups:null,currentArrangement:0,locationInfo:n}}const t=ie("arc",e.groupsText);return{layout:"arc",groups:null,groupOrder:null,rowGroups:null,arcGroups:{rows:[t[0],t[1]]},currentArrangement:0,locationInfo:n}},ir=e=>{if(!a.classData[e])return e;let n=1;for(;a.classData[`${e}_${n}`];)n+=1;return`${e}_${n}`},lr=()=>{if(N.length===0){alert("没有可导入的识别结果");return}N.forEach(e=>{const n=e.className.trim()||e.fileName.replace(/\.[^.]+$/,""),t=e.overwrite?n:ir(n);Q(t),a.classData[t][e.mode]=sr(e)}),O(),_(),T(),mt(),alert(`已导入 ${N.length} 条图片识别结果。`)},cr=()=>a.currentLayout==="circular"?Math.max(1,te(a.groups)):a.currentLayout==="rows"?Math.max(1,qe(a.rowGroups)):4,ur=e=>e.layout==="circular"?Ue(e.groups):e.layout==="rows"?He(e.rowGroups):Ke(e.arcGroups),kn=e=>{if(e.layout==="circular")return e.groups.map((n,t)=>({title:`第${t+1}组`,seats:n.map((o,r)=>({key:`c-${t}-${r}`,label:`座位 ${r+1}`,kind:"circular",groupIndex:t,seatIndex:r}))}));if(e.layout==="rows"){const n=[["第一排左","第一排右"],["第二排左","第二排右"],["第三排左","第三排右"]];return e.rowGroups.rows.flatMap((t,o)=>[{title:n[o][0],seats:t.left.map((r,s)=>({key:`r-${o}-left-${s}`,label:`位置 ${s+1}`,kind:"rows",rowIndex:o,side:"left",seatIndex:s}))},{title:n[o][1],seats:t.right.map((r,s)=>({key:`r-${o}-right-${s}`,label:`位置 ${s+1}`,kind:"rows",rowIndex:o,side:"right",seatIndex:s}))}])}return e.arcGroups.rows.map((n,t)=>({title:t===0?"第一排":"第二排",seats:n.map((o,r)=>({key:`a-${t}-${r}`,label:`位置 ${r+1}`,kind:"arc",rowIndex:t,seatIndex:r}))}))},fe=(e,n)=>n.kind==="circular"?e.groups[n.groupIndex]?.[n.seatIndex]||"":n.kind==="rows"?e.rowGroups.rows[n.rowIndex]?.[n.side]?.[n.seatIndex]||"":e.arcGroups.rows[n.rowIndex]?.[n.seatIndex]||"",ae=(e,n,t)=>{if(n.kind==="circular"){e.groups[n.groupIndex][n.seatIndex]=t;return}if(n.kind==="rows"){e.rowGroups.rows[n.rowIndex][n.side][n.seatIndex]=t;return}e.arcGroups.rows[n.rowIndex][n.seatIndex]=t},De=(e,n)=>{for(const t of kn(e)){const o=t.seats.find(r=>r.key===n);if(o)return o}return null},dr=e=>e.kind==="circular"?`第${e.groupIndex+1}组 · 位置${e.seatIndex+1}`:e.kind==="rows"?`第${e.rowIndex+1}排${e.side==="left"?"左":"右"}侧 · 位置${e.seatIndex+1}`:`${e.rowIndex===0?"前排":"后排"} · 位置${e.seatIndex+1}`,Ee=()=>{const e=l("manualTuneStatus");if(!f){e.textContent="当前修改仅在预览中，记得保存后才会正式生效。",e.classList.remove("is-selected","is-dirty","is-saved");return}const n=f,t=n.isDirty?"未保存：当前修改仅在预览中，点“保存微调”后才会正式生效。":"已保存状态：现在看到的是当前草稿，继续改动后记得点“保存微调”。";if(!n.selectedSeatKey){e.textContent=`${t} 单击两个座位可交换，双击座位可直接编辑名字。`,e.classList.remove("is-selected"),e.classList.toggle("is-dirty",n.isDirty),e.classList.toggle("is-saved",!n.isDirty);return}const o=De(n,n.selectedSeatKey);e.textContent=o?`${t} 已选中 ${dr(o)}，现在再点一个目标座位完成互换。`:`${t} 单击两个座位可交换，双击座位可直接编辑名字。`,e.classList.toggle("is-selected",!!o),e.classList.toggle("is-dirty",n.isDirty),e.classList.toggle("is-saved",!n.isDirty)},le=()=>{f&&(f.isDirty=!0,Ee())},W=()=>{const e=l("manualSeatEditor");if(!f){e.innerHTML="";return}const n=f,t=()=>{n.editingSeatKey&&window.requestAnimationFrame(()=>{const r=e.querySelector(`input[data-seat-input="${n.editingSeatKey}"]`);r?.focus(),r?.select()})},o=(r,s)=>`
    <div class="seat manual-seat${n.selectedSeatKey===r.key?" selected":""}${n.editingSeatKey===r.key?" editing":""}" data-seat-key="${r.key}">
      <span class="manual-seat-label">${v(s)}</span>
      <button type="button" class="manual-seat-clear" data-clear-key="${r.key}" title="清空此座位">&times;</button>
      <input data-seat-input="${r.key}" value="${v(fe(n,r))}" />
    </div>
  `;if(n.layout==="circular"){const r=te(n.groups),s=Ge(r);e.innerHTML=`
      <div class="manual-layout classroom">
        ${Array.from({length:6},(i,c)=>{const u=s[c];return u===null?`
              <div class="table table-empty manual-table-empty">
                <h3>空组</h3>
                <div class="seats seats-empty"></div>
              </div>
            `:`
            <div class="table group-${u%6+1}">
              <h3>Group ${u+1}</h3>
              <div class="seats">
                ${n.groups[u].map((d,p)=>o({key:`c-${u}-${p}`,kind:"circular",groupIndex:u,seatIndex:p},`${p+1}`)).join("")}
              </div>
            </div>
          `}).join("")}
      </div>
    `,Ee(),t();return}if(n.layout==="rows"){const r=qe(n.rowGroups),s=be(r),i=[{leftSlot:0,rightSlot:1},{leftSlot:2,rightSlot:3},{leftSlot:4,rightSlot:5}];e.innerHTML=`
      <div class="manual-layout classroom three-rows-layout">
        ${i.map((c,u)=>{const d=s[c.leftSlot],p=s[c.rightSlot],m=u===2&&d!==null&&p===null,h=(g,b,k)=>{const S=n.rowGroups.rows[u][g];return k===null?`<div class="${g==="left"?"group-left":"group-right"} manual-group-empty"><h3>空组</h3><div class="seats-row"></div></div>`:`
              <div class="${g==="left"?"group-left":"group-right"}${m&&g==="left"?" group-center":""}">
                <h3>${v(b)}</h3>
                <div class="seats-row">
                  ${S.map((A,R)=>o({key:`r-${u}-${g}-${R}`,kind:"rows",rowIndex:u,side:g,seatIndex:R},`${R+1}`)).join("")}
                </div>
              </div>
            `};return`
            <div class="row${m?" single-center":""}">
              ${h("left",d===null?"空组":`Group ${d+1}`,d)}
              ${m?"":h("right",p===null?"空组":`Group ${p+1}`,p)}
            </div>
          `}).join("")}
      </div>
    `,Ee(),t();return}e.innerHTML=`
    <div class="manual-layout classroom arc-layout">
      ${n.arcGroups.rows.map((r,s)=>`
        <div class="arc-row">
          <h3 class="two-row-title">${s===0?"前排":"后排"}</h3>
          <div class="arc-seats">
            ${r.map((i,c)=>o({key:`a-${s}-${c}`,kind:"arc",rowIndex:s,seatIndex:c},`${c+1}`)).join("")}
          </div>
        </div>
      `).join("")}
    </div>
  `,Ee(),t()},pr=()=>{f={layout:a.currentLayout,groups:D(a.groups),rowGroups:D(a.rowGroups),arcGroups:D(a.arcGroups),groupCount:cr(),selectedSeatKey:null,editingSeatKey:null,isDirty:!1},l("manualGroupCount").value=String(f.groupCount),l("manualNewStudent").value="",l("manualTuneError").textContent="",W(),P("manualTuneDialog")},ht=()=>{f=null,q("manualTuneDialog")},gr=()=>{if(!f)return;const e=Number.parseInt(l("manualGroupCount").value,10),n=ur(f);try{const t=jt(f.layout,e,n);f.groups=t.groups,f.rowGroups=t.rowGroups,f.arcGroups=t.arcGroups,f.groupCount=e,f.selectedSeatKey=null,f.editingSeatKey=null,le(),l("manualTuneError").textContent="",W()}catch(t){l("manualTuneError").textContent=t instanceof Error?t.message:"重排失败"}},fr=()=>{if(!f)return;const e=l("manualNewStudent"),n=e.value.trim();if(!n){l("manualTuneError").textContent="请先输入新学生名字。";return}const t=kn(f).flatMap(o=>o.seats).find(o=>!fe(f,o).trim());if(!t){l("manualTuneError").textContent="当前没有空位，请先调组数或清空一个座位。";return}ae(f,t,n),f.editingSeatKey=null,e.value="",le(),l("manualTuneError").textContent="",W()},mr=()=>{if(!f)return;const n=kn(f).flatMap(o=>o.seats).filter(o=>fe(f,o).trim());if(n.length<=1)return;const t=n.map(o=>fe(f,o));for(let o=t.length-1;o>0;o--){const r=Math.floor(Math.random()*(o+1));[t[o],t[r]]=[t[r],t[o]]}n.forEach((o,r)=>{ae(f,o,t[r])}),f.selectedSeatKey=null,f.editingSeatKey=null,le(),W()},hr=()=>{f&&(a.groups=D(f.groups),a.rowGroups=D(f.rowGroups),a.arcGroups=D(f.arcGroups),a.currentArrangement=0,z(),V(),ht())};let ce=!1;const K=(e,n="")=>{const t=l("cnfSyncStatus");t.textContent=e,t.className=`cnf-sync-status ${n}`.trim()},br=()=>{const e=so();l("cnfUsername").value=e.username,l("cnfPassword").value=e.password,l("cnfSquadPickerWrap").style.display="none",l("cnfFetchBtn").disabled=!0,K(""),P("cnfSyncDialog")},bt=()=>{q("cnfSyncDialog")},vt=()=>({username:l("cnfUsername").value.trim(),password:l("cnfPassword").value}),vr=async()=>{if(ce)return;const e=vt();if(!e.username||!e.password){K("请填写账号和密码","cnf-err");return}ce=!0,K("正在登录并加载班级列表...","cnf-busy");try{const n=await io(e);Yn(e);const t=l("cnfSquadSelect");if(t.innerHTML="",n.length===0)t.innerHTML='<option value="">暂无班级</option>';else{t.innerHTML='<option value="">-- 选择班级 --</option>';for(const r of n){const s=document.createElement("option");s.value=String(r.id),s.dataset.type=r.type||"offline",s.textContent=`${r.name}（${r.group||r.section}）`,t.appendChild(s)}}const o=L?a.classData[L]?.cnf:null;o?.squadId&&(t.value=o.squadId),l("cnfSquadPickerWrap").style.display="",l("cnfFetchBtn").disabled=!1,K(`已加载 ${n.length} 个班级，选一个然后点"抓取名单"`,"cnf-ok")}catch(n){K(n instanceof Error?n.message:"登录失败","cnf-err")}finally{ce=!1}},xr=async()=>{if(ce)return;const e=vt(),n=l("cnfSquadSelect"),t=n.value;if(!t){K("请先选择一个班级","cnf-err");return}const r=n.options[n.selectedIndex]?.dataset.type||"offline";ce=!0,K("正在抓取学生名单...","cnf-busy"),bt();try{const s=await lo(e,t,r);Yn(e);const i=s.students.map(m=>m.displayName).filter(Boolean);if(i.length===0){K("该班级暂无学生","cnf-err"),P("cnfSyncDialog");return}const c=s.squad.name||s.squad.fullName||`班级${t}`;let u=L||c;if(!L){const m=We("circular",a.userProfile.theme);a.classData[c]=m,u=c}const d=a.classData[u];if(d){d.cnf={squadId:t,squadType:r,sessionToken:"",loginUsername:e.username,lastSyncedAt:new Date().toISOString()};const m=Un("circular"),h=i.slice(0,m),g=je(h);d.weekday.layout="circular",d.weekday.groups=g,d.weekday.groupOrder=[1,2,3,4,5,6],Vn(a.classData),$().value=u,Z(),T(),z()}const p=l("errorMsg");p.textContent=`已从教务系统导入 ${i.length} 名学生（${c}）`,p.className="success",setTimeout(()=>{p.textContent="",p.className=""},3e3)}catch(s){K(s instanceof Error?s.message:"抓取失败","cnf-err"),P("cnfSyncDialog")}finally{ce=!1}},yr=()=>{l("batchImportData").value="",l("batchImportError").textContent="",P("batchImportDialog")},xt=()=>{q("batchImportDialog")},Tn=e=>e.includes("三排")||e.includes("横排")?"rows":e.includes("弧")||e.includes("两排")?"arc":"circular",wr=()=>{const n=l("batchImportData").value.split("!").map(s=>s.trim()).filter(Boolean);let t=0;const o=[];n.forEach(s=>{try{const i=s.split(`
`).map(g=>g.trim()).filter(Boolean),u=i.find(g=>g.startsWith("班级名称:"))?.split(":")[1]?.trim();if(!u)throw new Error("缺少班级名称");Q(u);let d="weekday",p="circular",m=[];const h=()=>{if(m.length===0)return;const g=a.classData[u][d],b=m.join(`
`);if(p==="circular"){const k=ie("circular",b);g.layout="circular",g.groups=C(),k.forEach((S,A)=>{A<6&&(g.groups[A]=G(S).slice(0,6).concat(Array(6).fill("")).slice(0,6))}),g.rowGroups=null,g.arcGroups=null}else if(p==="rows"){const k=ie("rows",b),S=Fe(k.flat());g.layout="rows",g.groups=null,g.rowGroups=S,g.arcGroups=null}else{const k=ie("arc",b);g.layout="arc",g.groups=null,g.rowGroups=null,g.arcGroups={rows:[k[0],k[1]]}}m=[]};i.forEach(g=>{if(g.startsWith("周中布局:")){h(),d="weekday",p=Tn(g);return}if(g.startsWith("周末布局:")){h(),d="weekend",p=Tn(g);return}if(g.startsWith("月:")){a.classData[u][d].locationInfo.date=g.split(":")[1]?.trim()||"";return}if(g.startsWith("日:")){a.classData[u][d].locationInfo.day=g.split(":")[1]?.trim()||"";return}if(g.startsWith("星期:")){a.classData[u][d].locationInfo.weekday=g.split(":")[1]?.trim()||"";return}if(g.startsWith("时间:")){a.classData[u][d].locationInfo.time=g.slice(g.indexOf(":")+1).trim();return}if(g.startsWith("校区:")){a.classData[u][d].locationInfo.campus=g.split(":")[1]?.trim()||"";return}if(g.startsWith("楼层:")){a.classData[u][d].locationInfo.floor=g.split(":")[1]?.trim()||"";return}if(g.startsWith("教室:")){a.classData[u][d].locationInfo.room=g.split(":")[1]?.trim()||"";return}(g.startsWith("Group")||g.startsWith("第一排")||g.startsWith("第二排"))&&m.push(g)}),h(),["weekday","weekend"].forEach(g=>{const b=a.classData[u][g].locationInfo;b.fullDate=me(b.date,b.day)||""}),t+=1}catch(i){o.push(i instanceof Error?i.message:"解析失败")}}),O(),_(),T();const r=l("batchImportError");o.length>0?(r.className="error",r.innerHTML=`成功 ${t} 个，失败 ${o.length} 个：<br>${o.map(s=>`• ${v(s)}`).join("<br>")}`):(r.className="success",r.textContent=`成功导入 ${t} 个班级。`,setTimeout(xt,1300))},kr=e=>{document.execCommand(`justify${e.charAt(0).toUpperCase()}${e.slice(1)}`,!1),yt()},Sr=e=>{const n=window.getSelection();if(!n||!n.rangeCount)return;const t=n.getRangeAt(0),o=t.commonAncestorContainer;if(o.nodeType===3){const r=document.createElement("span");r.style.verticalAlign=e,t.surroundContents(r)}else o.nodeType===1&&(o.style.verticalAlign=e);yt()},yt=()=>{Je(".text-align-group button").forEach(o=>o.classList.remove("active"));const n=document.queryCommandState("justifyLeft")?"left":document.queryCommandState("justifyCenter")?"center":document.queryCommandState("justifyRight")?"right":"";if(!n)return;const t=Ve(`[onclick*="setTextAlign('${n}')"]`);t&&t.classList.add("active")},An=()=>{const e=new Date,n=String(e.getHours()).padStart(2,"0"),t=String(e.getMinutes()).padStart(2,"0"),o=l("time");o.value||(o.value=`${n}:${t}`)},Cr=()=>{const e=l("editorView").querySelector(".right-section"),n=l("editorView").querySelector(".notes-section"),t=l("notesWidthHandle"),o=l("notesHeightHandle"),r=l("notesToolbarToggle");if(e&&n){const s=j(y.notesPanelWidth);s&&(e.style.width=`${Math.max(280,Math.min(520,Number(s)||360))}px`);const i=j(y.notesSectionHeight);i&&(n.style.height=`${Math.max(520,Number(i)||520)}px`);const c=p=>{n.classList.toggle("toolbar-collapsed",p),r.textContent=p?"显示设置":"隐藏设置",F(y.notesToolbarCollapsed,p?"1":"0")};c(j(y.notesToolbarCollapsed)!=="0"),r.addEventListener("click",()=>{c(!n.classList.contains("toolbar-collapsed"))});const u=()=>{F(y.notesPanelWidth,String(e.getBoundingClientRect().width))},d=()=>{F(y.notesSectionHeight,String(n.getBoundingClientRect().height))};if(e.addEventListener("mouseup",u),e.addEventListener("touchend",u),n.addEventListener("mouseup",d),n.addEventListener("touchend",d),t.addEventListener("pointerdown",p=>{p.preventDefault();const m=p.clientX,h=e.getBoundingClientRect().width,g=k=>{const S=Math.max(280,Math.min(560,h+(k.clientX-m)));e.style.width=`${S}px`,u()},b=()=>{window.removeEventListener("pointermove",g),window.removeEventListener("pointerup",b),u()};window.addEventListener("pointermove",g),window.addEventListener("pointerup",b,{once:!0})}),o.addEventListener("pointerdown",p=>{p.preventDefault();const m=p.clientY,h=n.getBoundingClientRect().height,g=k=>{const S=Math.max(440,Math.min(window.innerHeight-80,h+(k.clientY-m)));n.style.height=`${S}px`,d()},b=()=>{window.removeEventListener("pointermove",g),window.removeEventListener("pointerup",b),d()};window.addEventListener("pointermove",g),window.addEventListener("pointerup",b,{once:!0})}),"ResizeObserver"in window){const p=new ResizeObserver(()=>{u(),d()});p.observe(e),p.observe(n)}}l("noteFontSize").addEventListener("change",s=>{document.execCommand("fontSize",!1,"7");const i=Je("font"),c=s.target;for(let u=0;u<i.length;u+=1)i[u].size==="7"&&(i[u].removeAttribute("size"),i[u].style.fontSize=`${c.value}px`)}),l("noteColor").addEventListener("change",s=>{const i=s.target;document.execCommand("foreColor",!1,i.value)}),Re().addEventListener("paste",s=>{s.preventDefault();const i=s.clipboardData;if(i)for(const c of i.items){if(c.type.startsWith("image")){const u=c.getAsFile();if(!u)continue;const d=new FileReader;d.onload=p=>{const m=document.createElement("img");m.src=String(p.target?.result||""),m.style.maxWidth="100%",m.style.height="auto",m.style.border="1px solid #ddd",m.style.margin="10px auto",m.style.display="block",Re().appendChild(m)},d.readAsDataURL(u);continue}c.type==="text/plain"&&c.getAsString(u=>{document.execCommand("insertText",!1,u)})}})},Dr=()=>{l("ocrReviewList").addEventListener("input",e=>{const n=e.target,t=n.dataset.field,r=n.closest(".ocr-card")?.dataset.id;if(!t||!r)return;const s=N.find(i=>i.id===r);if(s){if(t==="overwrite"){s.overwrite=n.value==="true";return}if(t==="layout"){s.layout=n.value;return}if(t==="mode"){s.mode=n.value;return}switch(t){case"className":s.className=n.value;break;case"groupsText":s.groupsText=n.value;break;case"date":s.date=n.value;break;case"day":s.day=n.value;break;case"weekday":s.weekday=n.value;break;case"time":s.time=n.value;break;case"campus":s.campus=n.value;break;case"floor":s.floor=n.value;break;case"room":s.room=n.value;break}}})},Er=()=>{const e=()=>{const n=l("usernameInput").value.trim();n&&(a.userProfile.username=n,Pe(),Me())};l("saveUsernameBtn").addEventListener("click",e),l("usernameInput").addEventListener("keydown",n=>{n.key==="Enter"&&e()}),l("themeSelect").addEventListener("change",n=>{const t=n.target.value;a.userProfile.theme=t,Pe(),a.currentView==="home"&&Y(t)}),l("homeClassList").addEventListener("click",n=>{const t=n.target,o=t.closest("[data-use-roster-class]");if(o?.dataset.useRosterClass){go(o.dataset.useRosterClass);return}const r=t.closest("[data-open-class]");if(!r)return;const s=r.dataset.openClass;s&&yn(s)})},Lr=()=>{const e=l("editorView"),n=l("editorToolsToggle"),t=o=>{e.classList.toggle("editor-tools-collapsed",o),n.textContent=o?"显示工具":"隐藏工具",F(y.editorToolsCollapsed,o?"1":"0")};t(j(y.editorToolsCollapsed)==="1"),n.addEventListener("click",()=>{t(!e.classList.contains("editor-tools-collapsed"))}),l("date").addEventListener("change",Gn),l("day").addEventListener("change",Gn),l("manualSeatEditor").addEventListener("click",o=>{if(!f)return;const r=o.target,s=r.closest("[data-clear-key]");if(s){o.preventDefault(),o.stopPropagation();const h=s.dataset.clearKey;if(h){const g=De(f,h);g&&(ae(f,g,""),f.selectedSeatKey=null,f.editingSeatKey=null,le(),W())}return}const c=r.closest("[data-seat-key]")?.dataset.seatKey;if(!c)return;if(!f.selectedSeatKey&&r.closest("input")){o.preventDefault(),f.editingSeatKey=null,f.selectedSeatKey=c,W();return}if(!f.selectedSeatKey||f.selectedSeatKey===c){f.editingSeatKey=null,f.selectedSeatKey=f.selectedSeatKey===c?null:c,W();return}o.preventDefault();const u=De(f,f.selectedSeatKey),d=De(f,c);if(!u||!d){f.selectedSeatKey=null,W();return}const p=fe(f,u),m=fe(f,d);ae(f,u,m),ae(f,d,p),f.selectedSeatKey=null,f.editingSeatKey=null,le(),l("manualTuneError").textContent="",W()}),l("manualSeatEditor").addEventListener("dblclick",o=>{if(!f)return;const i=o.target.closest("[data-seat-key]")?.dataset.seatKey;i&&(o.preventDefault(),f.selectedSeatKey=null,f.editingSeatKey=i,W())}),l("manualSeatEditor").addEventListener("input",o=>{if(!f)return;const r=o.target,s=r.dataset.seatInput;if(!s)return;const i=De(f,s);i&&(ae(f,i,r.value),f.editingSeatKey=s,le())}),l("manualSeatEditor").addEventListener("focusout",o=>{if(!f)return;const r=o.relatedTarget,s=l("manualSeatEditor");r instanceof Node&&s.contains(r)||(f.editingSeatKey=null,Ee())}),l("rosterList").addEventListener("click",o=>{const s=o.target.closest("[data-delete-student]");if(!s)return;const i=s.dataset.deleteStudent;i&&confirm(`确定要删除「${i}」吗？`)&&Jo(i)}),l("editorThemeSelect").addEventListener("change",o=>{const r=$().value.trim();if(!r)return;Q(r);const s=o.target.value;a.classData[r].theme=s,Y(s),O(),T()}),$().addEventListener("change",o=>{const r=o.target;ln(r.value)}),xn().addEventListener("change",o=>{const r=o.target;ln(r.value)}),l("circularLayout").addEventListener("change",Ne),l("rowsLayout").addEventListener("change",Ne),l("arcLayout").addEventListener("change",Ne),l("backupImportInput").addEventListener("change",o=>{So(o)}),l("ocrEngine").addEventListener("change",()=>{ft(),ne()}),l("allowLocalFallback").addEventListener("change",()=>{ne()}),l("tencentEndpoint").addEventListener("change",()=>{ne()}),l("tencentRegion").addEventListener("change",()=>{ne()}),l("tencentAction").addEventListener("change",()=>{ne()})},$r=()=>{const e=window;e.loadClass=Z,e.toggleTime=Go,e.showSaveDialog=To,e.hideSaveDialog=lt,e.saveClass=Ao,e.renameCurrentClass=Oo,e.deleteCurrentClass=No,e.showImportDialog=Io,e.hideImportDialog=ct,e.importStudents=Wo,e.generateSeating=Fo,e.toggleEditMode=Yo,e.setTextAlign=kr,e.setVerticalAlign=Sr,e.showBatchImportDialog=yr,e.hideBatchImportDialog=xt,e.processBatchImport=wr,e.toggleLayout=Qo,e.goHome=$o,e.generateWeeklySeating=Uo,e.undoWeeklySeating=Ho,e.showCreateClassDialog=Zo,e.hideCreateClassDialog=gt,e.showImageImportDialog=rr,e.hideImageImportDialog=mt,e.startImageRecognition=ar,e.checkOCRChannel=or,e.confirmImageImport=lr,e.showManualTuneDialog=pr,e.hideManualTuneDialog=ht,e.applyManualGroupCount=gr,e.addManualTuneStudent=fr,e.shuffleManualTuneSeats=mr,e.applyManualTune=hr,e.copyCurrentToOtherMode=Mo,e.showPreviousWeekDialog=_o,e.hidePreviousWeekDialog=dt,e.restorePreviousWeek=Vo,e.showRosterDialog=pt,e.hideRosterDialog=Xo,e.exportDataBackup=wo,e.triggerImportBackup=Co,e.toggleUsageGuide=ho,e.showCnfSyncDialog=br,e.hideCnfSyncDialog=bt,e.cnfLoginAction=vr,e.cnfFetchAction=xr},Gr=()=>{a.userProfile=to(),fo(),Y(a.userProfile.theme),Me()},Mr=()=>{bn(de),$r(),Gr(),Do(),Lr(),Cr(),Dr(),Er(),mo(),Ne(),An(),se&&window.clearInterval(se),se=window.setInterval(An,6e4),z();const e=Zn();if(e&&a.classData[e]?yn(e):(T(),ye("home"),vo()),ue.embedded||window.self!==window.top){const n=Ve(".back-home");n&&(n.style.display="none")}},Nn=()=>{se&&(window.clearInterval(se),se=null),f=null,ue={},de=document,bn(document)},Tr=`.superamber-shell {
  --font-ui: '得意黑', 'Smiley Sans', 'PingFang SC', sans-serif;
  --bg: #f6f4ef;
  --panel: #ffffff;
  --panel-soft: rgba(255, 255, 255, 0.94);
  --panel-alt: rgba(248, 244, 235, 0.92);
  --field-bg: rgba(255, 255, 255, 0.9);
  --surface-strong: #ffffff;
  --surface-soft: #f6f1e7;
  --text: #2d3136;
  --muted: #676e76;
  --primary: #6f7f91;
  --primary-strong: #4c5a69;
  --border: #ddd3c3;
  --button-soft: #efe8db;
  --button-soft-text: var(--text);
  --chip-bg: rgba(111, 127, 145, 0.12);
  --chip-text: var(--primary-strong);
  --chip-alt-bg: rgba(237, 176, 97, 0.16);
  --chip-alt-text: #926126;
  --toolbar-bg: rgba(243, 238, 229, 0.96);
  --banner-bg: #efe7d8;
  --banner-text: var(--primary-strong);
  --danger-soft: #fbe8e5;
  --danger-text: #b9594e;
  --success-text: #13834a;
  --error-text: #d32222;
  --decor-accent: #e7c691;
  --group-1: #f7e3a2;
  --group-2: #bddcf7;
  --group-3: #f8c59f;
  --group-4: #c9e8dd;
  --group-5: #d9cbf2;
  --group-6: #f7c9d7;
  --seat-bg: #ffffff;
  --seat-focus: #f7f2eb;
  --seat-border: rgba(76, 90, 105, 0.1);
  --card-title-bg: rgba(255, 255, 255, 0.75);
  --shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  --home-gradient: linear-gradient(132deg, #f7f1e7 0%, #fcfaf4 42%, #ffffff 100%);
}

@font-face {
  font-family: '得意黑';
  src: url('/seating/fonts/SmileySans-Oblique.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Smiley Sans';
  src: url('/seating/fonts/SmileySans-Oblique.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

.superamber-shell.theme-mint {
  --bg: #eef9f2;
  --panel: #fcfffd;
  --panel-soft: rgba(251, 255, 252, 0.94);
  --panel-alt: rgba(224, 246, 231, 0.9);
  --field-bg: rgba(245, 255, 247, 0.92);
  --surface-strong: #fbfffc;
  --surface-soft: #f1fbf4;
  --text: #163b27;
  --muted: #4d7a63;
  --primary: #2fab73;
  --primary-strong: #1f8054;
  --border: #cfe9d8;
  --button-soft: #e2f4e9;
  --chip-bg: rgba(47, 171, 115, 0.14);
  --chip-alt-bg: rgba(115, 198, 145, 0.18);
  --chip-alt-text: #2c6a4b;
  --toolbar-bg: rgba(228, 246, 235, 0.96);
  --banner-bg: #dff3e6;
  --banner-text: #216749;
  --danger-text: #bd5a54;
  --success-text: #197346;
  --error-text: #c34f43;
  --decor-accent: #98dbb6;
  --group-1: #dcf5b1;
  --group-2: #b6f0c4;
  --group-3: #8ee4a6;
  --group-4: #9be7d2;
  --group-5: #cfecc0;
  --group-6: #bfe9df;
  --seat-bg: #fbfffc;
  --seat-focus: #eefaf2;
  --seat-border: rgba(31, 128, 84, 0.12);
  --card-title-bg: rgba(255, 255, 255, 0.78);
  --shadow: 0 12px 28px rgba(47, 171, 115, 0.14);
  --home-gradient: radial-gradient(circle at 18% 18%, #e4fbeb 0%, #d7f4df 35%, #fbfffd 100%);
}

.superamber-shell.theme-rose {
  --bg: #fff1f5;
  --panel: #fffafd;
  --panel-soft: rgba(255, 251, 252, 0.95);
  --panel-alt: rgba(255, 232, 240, 0.92);
  --field-bg: rgba(255, 245, 248, 0.94);
  --surface-strong: #fffafc;
  --surface-soft: #fff4f8;
  --text: #4c2433;
  --muted: #866070;
  --primary: #e86893;
  --primary-strong: #b9486e;
  --border: #f3d4df;
  --button-soft: #fde7ee;
  --chip-bg: rgba(232, 104, 147, 0.14);
  --chip-alt-bg: rgba(255, 184, 210, 0.24);
  --chip-alt-text: #a7496c;
  --toolbar-bg: rgba(255, 236, 243, 0.96);
  --banner-bg: #ffe8ef;
  --banner-text: #b9486e;
  --danger-text: #c45b64;
  --success-text: #3b8755;
  --error-text: #c7455f;
  --decor-accent: #ffc2d5;
  --group-1: #ffd6e7;
  --group-2: #ffc3df;
  --group-3: #ffb0c7;
  --group-4: #ffd8cf;
  --group-5: #f3d0f6;
  --group-6: #ffe5bf;
  --seat-bg: #fffdfd;
  --seat-focus: #fff1f6;
  --seat-border: rgba(185, 72, 110, 0.12);
  --card-title-bg: rgba(255, 255, 255, 0.82);
  --shadow: 0 12px 30px rgba(232, 104, 147, 0.16);
  --home-gradient: linear-gradient(132deg, #ffe9f0 0%, #fff5f7 42%, #ffffff 100%);
}

.superamber-shell.theme-apricot {
  --bg: #fff4ec;
  --panel: #fffbf8;
  --panel-soft: rgba(255, 251, 247, 0.95);
  --panel-alt: rgba(255, 239, 227, 0.92);
  --field-bg: rgba(255, 248, 240, 0.94);
  --surface-strong: #fffaf6;
  --surface-soft: #fff4eb;
  --text: #4a2c1f;
  --muted: #88604d;
  --primary: #f08a4b;
  --primary-strong: #c45f23;
  --border: #f0d8c7;
  --button-soft: #fdeadc;
  --chip-bg: rgba(240, 138, 75, 0.16);
  --chip-alt-bg: rgba(255, 205, 162, 0.26);
  --chip-alt-text: #aa5926;
  --toolbar-bg: rgba(255, 240, 229, 0.96);
  --banner-bg: #ffe7d5;
  --banner-text: #ba6327;
  --danger-text: #c25a41;
  --success-text: #397f50;
  --error-text: #c75131;
  --decor-accent: #ffc089;
  --group-1: #ffd69c;
  --group-2: #ffcb88;
  --group-3: #ffb37d;
  --group-4: #ffdcb4;
  --group-5: #ffc7a9;
  --group-6: #ffe3c9;
  --seat-bg: #fffdfa;
  --seat-focus: #fff1e7;
  --seat-border: rgba(196, 95, 35, 0.12);
  --card-title-bg: rgba(255, 255, 255, 0.82);
  --shadow: 0 12px 30px rgba(240, 138, 75, 0.16);
  --home-gradient: linear-gradient(130deg, #fff0e1 0%, #fff7f2 42%, #ffffff 100%);
}

.superamber-shell.theme-golden {
  --bg: #fffbed;
  --panel: #fffef9;
  --panel-soft: rgba(255, 254, 247, 0.95);
  --panel-alt: rgba(255, 246, 214, 0.92);
  --field-bg: rgba(255, 251, 236, 0.96);
  --surface-strong: #fffdf6;
  --surface-soft: #fff9e8;
  --text: #4a3916;
  --muted: #7c6738;
  --primary: #d9ab24;
  --primary-strong: #aa7f09;
  --border: #ebdfb3;
  --button-soft: #fdf3c9;
  --chip-bg: rgba(217, 171, 36, 0.16);
  --chip-alt-bg: rgba(255, 223, 122, 0.26);
  --chip-alt-text: #946f06;
  --toolbar-bg: rgba(255, 248, 221, 0.96);
  --banner-bg: #fff1b8;
  --banner-text: #9b7610;
  --danger-text: #c26036;
  --success-text: #45804e;
  --error-text: #bf5d2b;
  --decor-accent: #ffe086;
  --group-1: #ffe58f;
  --group-2: #ffd86f;
  --group-3: #ffecab;
  --group-4: #f8ef93;
  --group-5: #f6de7b;
  --group-6: #fff2c2;
  --seat-bg: #fffefb;
  --seat-focus: #fff7db;
  --seat-border: rgba(170, 127, 9, 0.12);
  --card-title-bg: rgba(255, 255, 255, 0.82);
  --shadow: 0 12px 30px rgba(217, 171, 36, 0.16);
  --home-gradient: linear-gradient(132deg, #fff8d8 0%, #fffcef 44%, #ffffff 100%);
}

.superamber-shell.theme-plum {
  --bg: #f5effd;
  --panel: #fcfaff;
  --panel-soft: rgba(252, 249, 255, 0.95);
  --panel-alt: rgba(240, 231, 254, 0.92);
  --field-bg: rgba(248, 244, 255, 0.96);
  --surface-strong: #fcfaff;
  --surface-soft: #f6f0ff;
  --text: #34224b;
  --muted: #6f5a87;
  --primary: #8d61de;
  --primary-strong: #6b42ba;
  --border: #dfd2f4;
  --button-soft: #eee6fb;
  --chip-bg: rgba(141, 97, 222, 0.16);
  --chip-alt-bg: rgba(201, 167, 255, 0.25);
  --chip-alt-text: #6c42bc;
  --toolbar-bg: rgba(243, 236, 255, 0.96);
  --banner-bg: #ece0ff;
  --banner-text: #6b42ba;
  --danger-text: #bf5d84;
  --success-text: #2f885f;
  --error-text: #c44d86;
  --decor-accent: #c7adff;
  --group-1: #e0ccff;
  --group-2: #cdb4ff;
  --group-3: #bfa0ff;
  --group-4: #e6d5ff;
  --group-5: #f0d1f7;
  --group-6: #d8c3f5;
  --seat-bg: #fefcff;
  --seat-focus: #f3edff;
  --seat-border: rgba(107, 66, 186, 0.12);
  --card-title-bg: rgba(255, 255, 255, 0.82);
  --shadow: 0 12px 30px rgba(141, 97, 222, 0.16);
  --home-gradient: linear-gradient(132deg, #f0e5ff 0%, #f7f2ff 42%, #ffffff 100%);
}

.superamber-shell.theme-classic {
  --bg: #eff6ff;
  --panel: #fbfdff;
  --panel-soft: rgba(251, 253, 255, 0.95);
  --panel-alt: rgba(228, 240, 255, 0.92);
  --field-bg: rgba(243, 249, 255, 0.94);
  --surface-strong: #ffffff;
  --surface-soft: #eef4ff;
  --text: #1f2d3d;
  --muted: #5f7285;
  --primary: #2563eb;
  --primary-strong: #174ab8;
  --border: #d4e0f4;
  --button-soft: #e7efff;
  --chip-bg: rgba(37, 99, 235, 0.12);
  --chip-alt-bg: rgba(56, 189, 248, 0.16);
  --chip-alt-text: #0f5f8f;
  --toolbar-bg: rgba(233, 242, 255, 0.96);
  --banner-bg: #dbeafe;
  --banner-text: #174ab8;
  --danger-soft: #ffe8e6;
  --danger-text: #bd4f44;
  --decor-accent: #7dd3fc;
  --group-1: #bfdbfe;
  --group-2: #93c5fd;
  --group-3: #7dd3fc;
  --group-4: #a5b4fc;
  --group-5: #99f6e4;
  --group-6: #c4b5fd;
  --seat-bg: #ffffff;
  --seat-focus: #edf4ff;
  --seat-border: rgba(23, 74, 184, 0.1);
  --card-title-bg: rgba(255, 255, 255, 0.82);
  --shadow: 0 12px 30px rgba(37, 99, 235, 0.14);
  --home-gradient: linear-gradient(132deg, #e7f0ff 0%, #f5f8ff 42%, #ffffff 100%);
}

.superamber-shell.theme-paper {
  --bg: #f6f4ef;
  --panel: #ffffff;
  --panel-soft: rgba(255, 255, 255, 0.94);
  --panel-alt: rgba(248, 244, 235, 0.92);
  --field-bg: rgba(255, 255, 255, 0.9);
  --surface-strong: #ffffff;
  --surface-soft: #f6f1e7;
  --text: #2d3136;
  --muted: #676e76;
  --primary: #6f7f91;
  --primary-strong: #4c5a69;
  --border: #ddd3c3;
  --button-soft: #efe8db;
  --chip-bg: rgba(111, 127, 145, 0.12);
  --chip-alt-bg: rgba(237, 176, 97, 0.16);
  --chip-alt-text: #926126;
  --toolbar-bg: rgba(243, 238, 229, 0.96);
  --banner-bg: #efe7d8;
  --banner-text: #4c5a69;
  --danger-soft: #fbe8e5;
  --danger-text: #b9594e;
  --decor-accent: #e7c691;
  --group-1: #f7e3a2;
  --group-2: #bddcf7;
  --group-3: #f8c59f;
  --group-4: #c9e8dd;
  --group-5: #d9cbf2;
  --group-6: #f7c9d7;
  --seat-bg: #ffffff;
  --seat-focus: #f7f2eb;
  --seat-border: rgba(76, 90, 105, 0.1);
  --card-title-bg: rgba(255, 255, 255, 0.75);
  --shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  --home-gradient: linear-gradient(132deg, #f7f1e7 0%, #fcfaf4 42%, #ffffff 100%);
}

.superamber-shell * {
  box-sizing: border-box;
}

.superamber-shell {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-ui);
  line-height: 1.45;
}

.superamber-shell button,
.superamber-shell input,
.superamber-shell select,
.superamber-shell textarea {
  font: inherit;
}

.superamber-shell {
  min-height: 100vh;
  padding: 24px;
}

.hidden {
  display: none !important;
}

.home-view {
  max-width: 1480px;
  margin: 0 auto;
  background: var(--home-gradient);
  border: 8px solid var(--primary);
  border-radius: 28px;
  padding: 32px;
  min-height: calc(100vh - 40px);
  box-shadow: var(--shadow);
  position: relative;
  overflow: hidden;
}

.home-view::before,
.home-view::after {
  content: '';
  position: absolute;
  width: 180px;
  height: 180px;
  border-radius: 999px;
  opacity: 0.14;
  pointer-events: none;
}

.home-view::before {
  background: var(--primary);
  top: -60px;
  left: -40px;
}

.home-view::after {
  background: var(--decor-accent);
  right: -50px;
  bottom: -70px;
}

.home-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  position: relative;
  z-index: 1;
}

.welcome-box h1 {
  margin: 0;
  font-size: clamp(32px, 4vw, 44px);
  color: var(--primary-strong);
}

.welcome-box p {
  margin: 8px 0 0;
  font-size: clamp(18px, 2vw, 22px);
  color: var(--muted);
}

.theme-switch {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-end;
}

.username-editor {
  display: flex;
  gap: 8px;
  align-items: center;
}

.username-editor input {
  min-width: 140px;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px 12px;
  background: var(--field-bg);
}

.theme-switch select {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px 12px;
  background: var(--field-bg);
}

.home-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 22px;
  position: relative;
  z-index: 1;
}

.usage-guide {
  margin-top: 22px;
  position: relative;
  z-index: 1;
  background: var(--panel-soft);
  border: 1px solid var(--border);
  border-radius: 22px;
  padding: 22px;
  box-shadow: var(--shadow);
}

.usage-guide-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.usage-guide-header-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
}

.usage-guide-eyebrow {
  margin: 0 0 6px;
  color: var(--primary);
  font-size: 13px;
  letter-spacing: 0.08em;
}

.usage-guide h2 {
  margin: 0;
  font-size: clamp(24px, 3vw, 32px);
  color: var(--primary-strong);
}

.usage-guide-note {
  margin: 0;
  max-width: 420px;
  color: var(--muted);
  font-size: 14px;
  text-align: right;
}

.usage-guide-close {
  padding: 8px 14px;
  background: var(--panel);
  border: 1px solid var(--border);
}

.usage-guide-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}

.usage-card {
  background: var(--panel);
  border: 1px solid color-mix(in srgb, var(--border) 80%, white 20%);
  border-radius: 18px;
  padding: 18px;
}

.usage-card h3 {
  margin: 0 0 10px;
  font-size: 18px;
  color: var(--primary-strong);
}

.usage-card ul {
  margin: 0;
  padding-left: 18px;
  color: var(--muted);
  display: grid;
  gap: 8px;
}

.usage-card li {
  line-height: 1.6;
}

.usage-card-emphasis {
  background: linear-gradient(140deg, var(--panel) 0%, var(--surface-soft) 100%);
  border-color: color-mix(in srgb, var(--primary) 28%, var(--border) 72%);
}

button {
  border: none;
  border-radius: 10px;
  padding: 10px 16px;
  background: var(--button-soft);
  color: var(--button-soft-text);
  font-family: inherit;
  font-size: 16px;
  cursor: pointer;
  transition: transform 0.15s ease, background 0.2s ease;
}

button:hover {
  transform: translateY(-1px);
}

button.primary,
.save-button,
.controls button.confirm,
.dialog .confirm {
  background: var(--primary);
  color: #fff;
}

button.primary:hover,
.save-button:hover,
.dialog .confirm:hover {
  background: var(--primary-strong);
}

button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

.class-overview {
  margin-top: 26px;
  position: relative;
  z-index: 1;
}

.class-overview h2 {
  margin: 0 0 10px;
}

.home-class-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 14px;
}

.class-card {
  background: var(--panel-soft);
  border-radius: 18px;
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 214px;
  cursor: pointer;
}

.class-card.empty {
  color: var(--muted);
  justify-content: center;
  align-items: center;
  text-align: center;
}

.class-card-header,
.class-card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.class-card-header strong {
  font-size: 24px;
  color: var(--primary-strong);
}

.class-card-header span,
.class-card-detail {
  color: var(--muted);
  font-size: 14px;
}

.class-card-meta {
  font-size: 14px;
}

.mode-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--chip-bg);
  color: var(--chip-text);
}

.mode-chip.weekend {
  background: var(--chip-alt-bg);
  color: var(--chip-alt-text);
}

.class-card button {
  margin-top: auto;
}

.editor-view {
  max-width: 1500px;
  margin: 0 auto;
  padding-bottom: 40px;
  zoom: 0.9;
}

.editor-floating-context {
  position: fixed;
  top: 18px;
  right: max(18px, calc((100vw - 1500px) / 2 + 18px));
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: 1px solid color-mix(in srgb, var(--primary) 18%, var(--border) 82%);
  border-radius: 16px;
  background: color-mix(in srgb, var(--surface-strong) 92%, white 8%);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(12px);
  z-index: 1101;
}

.editor-floating-label {
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
}

.editor-floating-context select {
  min-width: 110px;
  max-width: 150px;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--field-bg);
  color: var(--text);
  font-size: 14px;
  font-weight: 700;
}

.editor-floating-meta {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  background: var(--chip-bg);
  color: var(--chip-text);
  font-size: 13px;
  white-space: nowrap;
}

.editor-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.back-home {
  background: var(--primary);
  color: #fff;
}

.editor-tools-toggle {
  background: var(--button-soft);
  color: var(--text);
}

.main-content {
  display: flex;
  gap: 20px;
  background: var(--panel);
  padding: 22px;
  border-radius: 22px;
  box-shadow: var(--shadow);
  align-items: start;
  margin-top: 18px;
}

.left-section {
  min-width: 0;
  flex: 1 1 auto;
}

.right-section {
  flex: 0 0 360px;
  width: 360px;
  min-width: 280px;
  max-width: 520px;
  display: flex;
  align-items: stretch;
  gap: 6px;
  overflow: auto;
  padding-top: 126px;
}

.notes-width-handle {
  flex: 0 0 10px;
  align-self: stretch;
  cursor: col-resize;
  position: relative;
  opacity: 0.18;
  transition: opacity 0.18s ease;
}

.notes-width-handle:hover {
  opacity: 0.55;
}

.notes-width-handle::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 2px;
  height: 72px;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  background: color-mix(in srgb, var(--primary) 58%, transparent 42%);
  box-shadow: -3px 0 0 color-mix(in srgb, var(--primary) 16%, transparent 84%),
    3px 0 0 color-mix(in srgb, var(--primary) 16%, transparent 84%);
}

.header {
  font-size: clamp(30px, 3vw, 38px);
  color: var(--primary);
  font-weight: bold;
  text-align: center;
  margin-bottom: 20px;
  padding-top: 12px;
  letter-spacing: 1px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header input {
  font-family: inherit;
  font-size: inherit;
  color: var(--primary);
  font-weight: bold;
  text-align: center;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  width: 150px;
  margin-right: -8px;
}

.header input:focus {
  outline: none;
  border-bottom-color: var(--primary);
}

.info-section {
  background: var(--panel-alt);
  padding: 16px;
  border-radius: 14px;
  margin-bottom: 20px;
  width: 100%;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.time-display,
.location-display {
  flex: 1;
  min-width: 300px;
  font-size: 17px;
  padding: 15px;
  border-radius: 12px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.time-display {
  background: color-mix(in srgb, var(--panel-alt) 72%, #fff1b2 28%);
}

.location-display {
  background: color-mix(in srgb, var(--panel-alt) 72%, #d8e6ff 28%);
}

.time-display .emoji,
.location-display .emoji {
  font-size: 32px;
  margin-right: 15px;
  width: 40px;
  text-align: center;
}

.info-input {
  border: none;
  border-bottom: 1px solid var(--border);
  padding: 5px;
  font-family: inherit;
  font-size: 16px;
  width: 40px;
  text-align: center;
  background: transparent;
}

.info-input.wider {
  width: 100px;
}

.weekday-select,
.campus-select {
  font-size: 16px;
  padding: 5px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: transparent;
  min-width: 90px;
}

.screen-banner {
  text-align: center;
  padding: 12px;
  background: var(--banner-bg);
  color: var(--banner-text);
  font-weight: bold;
  margin-bottom: 24px;
  border-radius: 12px;
  font-size: 18px;
  letter-spacing: 1px;
}

.classroom {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}

.table {
  padding: 14px;
  border-radius: 14px;
}

.table-empty {
  opacity: 0.4;
  background: var(--surface-soft);
}

.seats-empty {
  min-height: 180px;
}

.group-1 {
  background: var(--group-1);
}

.group-2 {
  background: var(--group-2);
}

.group-3 {
  background: var(--group-3);
}

.group-4 {
  background: var(--group-4);
}

.group-5 {
  background: var(--group-5);
}

.group-6 {
  background: var(--group-6);
}

.table h3,
.group-left h3,
.group-right h3 {
  text-align: center;
  margin: 0 0 10px;
  color: var(--text);
  padding: 8px;
  background: var(--card-title-bg);
  border-radius: 5px;
  font-size: 18px;
}

.seats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.seat {
  background: var(--seat-bg);
  border: 1px solid var(--seat-border);
  padding: 8px 6px;
  border-radius: 8px;
  text-align: center;
  min-height: 44px;
}

.seat input {
  font-family: inherit;
  width: 100%;
  border: none;
  background: transparent;
  text-align: center;
  padding: 4px;
}

.seat input:focus {
  outline: none;
  background: var(--seat-focus);
}

.notes-section {
  position: sticky;
  top: 20px;
  background: var(--panel);
  min-height: 520px;
  flex: 1 1 auto;
  width: 100%;
  padding: 14px;
  border-radius: 16px;
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: 0 10px 26px rgba(12, 64, 102, 0.08);
  overflow: auto;
}

.notes-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 6px;
}

.notes-header strong {
  display: block;
  font-size: 18px;
}

.notes-header span {
  display: block;
  font-size: 12px;
  color: var(--muted);
}

.notes-toolbar-toggle {
  background: var(--chip-bg);
  color: var(--primary-strong);
}

.notes-toolbar {
  display: flex;
  gap: 8px;
  padding: 5px;
  background: var(--toolbar-bg);
  border-radius: 5px;
  flex-wrap: wrap;
}

.notes-section.toolbar-collapsed .notes-toolbar {
  display: none;
}

.notes-toolbar select,
.notes-toolbar button {
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--field-bg);
}

.notes-toolbar .text-align-group {
  display: flex;
  gap: 4px;
}

.notes-toolbar .text-align-group button.active {
  background: var(--primary);
  color: #fff;
}

.notes-content {
  flex: 1;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px;
  overflow-y: auto;
  background: var(--panel-soft);
  min-height: 420px;
}

.notes-height-handle {
  height: 12px;
  cursor: row-resize;
  position: relative;
  flex: 0 0 auto;
  opacity: 0.2;
  transition: opacity 0.18s ease;
}

.notes-height-handle:hover {
  opacity: 0.55;
}

.notes-height-handle::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 48px;
  height: 2px;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  background: color-mix(in srgb, var(--primary) 58%, transparent 42%);
  box-shadow: 0 -3px 0 color-mix(in srgb, var(--primary) 16%, transparent 84%),
    0 3px 0 color-mix(in srgb, var(--primary) 16%, transparent 84%);
}

.three-rows-layout {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.row {
  background: var(--surface-strong);
  padding: 12px;
  border-radius: 10px;
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.row.single-center {
  justify-content: center;
}

.group-left,
.group-right,
.group-center {
  flex: 1;
  padding: 12px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
}

.group-center {
  max-width: 520px;
}

.row:nth-child(1) .group-left {
  background: var(--group-1);
}

.row:nth-child(1) .group-right {
  background: var(--group-2);
}

.row:nth-child(2) .group-left {
  background: var(--group-3);
}

.row:nth-child(2) .group-right {
  background: var(--group-4);
}

.row:nth-child(3) .group-left,
.row:nth-child(3) .group-center {
  background: var(--group-5);
}

.row:nth-child(3) .group-right {
  background: var(--group-6);
}

.seats-row {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: nowrap;
  align-items: center;
  min-height: 50px;
}

.seats-row .seat {
  flex: 1;
  min-width: 0;
}

.arc-layout {
  display: flex;
  flex-direction: column;
  gap: 22px;
  width: 100%;
}

.arc-row {
  min-height: 132px;
  padding: 16px 18px 18px;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 12px;
  background: var(--panel-soft);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
}

.two-row-title {
  margin: 0;
  font-size: 18px;
  color: var(--primary-strong);
  text-align: left;
}

.arc-seats {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  width: 100%;
  gap: 8px;
  padding: 4px 0 0;
}

.arc-seat {
  width: 56px;
  min-height: 56px;
  background: var(--seat-bg);
  border: 1px solid var(--seat-border);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.arc-seat input {
  width: 100%;
  height: 100%;
}

.controls {
  position: sticky;
  bottom: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  z-index: 90;
  margin-top: 18px;
  width: 100%;
  max-width: none;
  justify-content: flex-start;
  margin-left: 0;
}

.controls button {
  background: var(--button-soft);
  color: var(--text);
}

.controls .edit-mode button {
  background: var(--primary);
  color: #fff;
}

.save-button {
  position: sticky;
  bottom: 90px;
  display: block;
  margin: 18px 0 0 auto;
  z-index: 90;
}

.editor-view.editor-tools-collapsed .class-selector,
.editor-view.editor-tools-collapsed .controls,
.editor-view.editor-tools-collapsed .save-button {
  display: none;
}

.editor-view.editor-tools-collapsed .main-content {
  margin-top: 8px;
}

.editor-view.editor-tools-collapsed .right-section {
  padding-top: 0;
}

.class-selector {
  position: sticky;
  top: 16px;
  background: var(--panel-soft);
  border-radius: 14px;
  box-shadow: var(--shadow);
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 12px;
  z-index: 90;
  max-width: 100%;
  margin-bottom: 14px;
}

.class-selector-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 180px;
  flex: 1 1 220px;
}

.class-theme-switch {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 148px;
}

.class-selector-label {
  font-size: 12px;
  color: var(--muted);
}

.class-selector select {
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  font-size: 15px;
  background: var(--field-bg);
}

.subtle {
  background: var(--danger-soft);
  color: var(--danger-text);
}

.rename-btn {
  background: var(--chip-bg);
  color: var(--primary-strong);
}

.time-toggle {
  display: flex;
  gap: 4px;
}

.time-toggle button.active {
  background: var(--primary);
  color: #fff;
}

.delete-btn {
  background: var(--danger-soft);
  color: var(--danger-text);
}

.overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 999;
}

.dialog {
  display: none;
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--surface-strong);
  border-radius: 12px;
  box-shadow: var(--shadow);
  z-index: 1000;
  width: min(1040px, 94vw);
  max-height: 92vh;
  overflow: auto;
  padding: 22px;
}

.dialog h2 {
  margin: 0 0 10px;
  color: var(--primary-strong);
}

.dialog .buttons {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

.dialog input,
.dialog textarea,
.dialog select {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px;
  background: var(--field-bg);
}

.dialog textarea {
  min-height: 160px;
  resize: vertical;
}

.previous-week-dialog,
.roster-dialog {
  max-width: 1180px;
}

.previous-week-preview {
  margin-top: 12px;
  background: var(--panel-alt);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 16px;
  max-height: 74vh;
  overflow: auto;
}

.previous-week-preview.classroom {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}

.roster-list {
  margin-top: 12px;
  column-width: 220px;
  column-gap: 14px;
  max-height: 56vh;
  overflow: auto;
  padding: 12px;
  border-radius: 14px;
  background: var(--panel-alt);
  border: 1px solid var(--border);
}

.roster-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 6px 8px;
  border-radius: 10px;
  background: var(--panel-soft);
  break-inside: avoid;
  margin-bottom: 8px;
}

.create-options {
  display: grid;
  gap: 8px;
}

.import-dialog {
  max-width: 620px;
}

.cnf-sync-dialog {
  max-width: 500px;
}

.cnf-sync-form {
  display: grid;
  gap: 10px;
  margin-bottom: 12px;
}

.cnf-field label {
  display: block;
  font-size: 0.85em;
  margin-bottom: 3px;
  color: var(--text-muted);
}

.cnf-sync-status {
  min-height: 1.4em;
  font-size: 0.85em;
  margin-bottom: 8px;
  padding: 0 2px;
}

.cnf-sync-status.cnf-ok { color: var(--success, #2e7d32); }
.cnf-sync-status.cnf-err { color: var(--error, #c62828); }
.cnf-sync-status.cnf-busy { color: var(--text-muted); }

.layout-selector {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin: 10px 0;
  padding: 10px;
  background: var(--panel-alt);
  border-radius: 6px;
}

.layout-option {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
}

.layout-option input[type='radio'] {
  width: auto;
  flex: 0 0 auto;
  margin: 0;
  padding: 0;
  border: none;
}

.layout-option label {
  display: inline-block;
  white-space: nowrap;
  min-width: max-content;
  width: auto;
}

.ocr-config-grid {
  margin: 10px 0;
  border: 1px solid var(--border);
  background: var(--panel-alt);
  border-radius: 10px;
  padding: 10px;
  display: grid;
  gap: 8px;
}

.ocr-cloud-config {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.ocr-hint {
  font-size: 13px;
  color: var(--muted);
}

.ocr-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.ocr-checkbox input[type='checkbox'] {
  width: auto;
  margin: 0;
}

.ocr-check-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ocr-check-row button {
  white-space: nowrap;
}

#ocrEngineStatus {
  font-size: 13px;
  line-height: 1.4;
}

.muted {
  color: var(--muted);
}

.progress {
  margin-top: 8px;
  color: var(--muted);
  font-size: 14px;
}

.ocr-review-list {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}

.ocr-card {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px;
}

.ocr-source {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--muted);
}

.ocr-card-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.ocr-card textarea {
  min-height: 130px;
}

.manual-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}

.manual-row input {
  width: 140px;
}

.manual-tips {
  color: var(--muted);
  margin: 8px 0 0;
}

.manual-status {
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--primary) 10%, var(--panel) 90%);
  border: 1px solid color-mix(in srgb, var(--primary) 18%, var(--border) 82%);
  color: var(--primary-strong);
  font-size: 14px;
  line-height: 1.5;
}

.manual-status.is-dirty {
  background: color-mix(in srgb, #d64545 10%, var(--panel) 90%);
  border-color: color-mix(in srgb, #d64545 32%, var(--border) 68%);
  color: #b33636;
}

.manual-status.is-saved {
  background: color-mix(in srgb, #23a55a 10%, var(--panel) 90%);
  border-color: color-mix(in srgb, #23a55a 28%, var(--border) 72%);
  color: #1f7b46;
}

.manual-status.is-selected {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 14%, transparent 86%);
}

#manualTuneDialog {
  width: min(1400px, 96vw);
  max-width: none;
  max-height: 94vh;
}

#manualTuneDialog .buttons {
  position: sticky;
  bottom: 0;
  background: var(--surface-strong);
  padding-top: 10px;
  margin-top: 0;
  border-top: 1px solid var(--border);
  z-index: 1;
}

.manual-seat-editor {
  margin-top: 14px;
  max-height: 70vh;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--panel-alt);
  padding: 16px;
}

.manual-layout {
  min-width: 1220px;
}

.manual-layout.arc-layout {
  min-width: 980px;
}

.manual-seat-editor .table,
.manual-seat-editor .group-left,
.manual-seat-editor .group-right,
.manual-seat-editor .arc-row {
  box-shadow: none;
}

.manual-seat-editor .seat {
  position: relative;
  min-height: 88px;
  min-width: 112px;
  border-radius: 14px;
  padding: 8px;
}

.manual-seat {
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.manual-seat:hover {
  transform: translateY(-1px);
}

.manual-seat.selected {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 18%, transparent 82%);
}

.manual-seat.editing {
  border-color: #23a55a;
  box-shadow: 0 0 0 3px color-mix(in srgb, #23a55a 18%, transparent 82%);
}

.manual-seat-label {
  position: absolute;
  top: 6px;
  left: 8px;
  font-size: 11px;
  color: var(--muted);
  line-height: 1;
}

.manual-seat input {
  width: 100%;
  height: 100%;
  min-height: 64px;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 22px 10px 10px;
  background: var(--field-bg);
  text-align: center;
  font-size: 16px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.manual-seat input:focus {
  border-color: #23a55a;
  box-shadow: 0 0 0 3px color-mix(in srgb, #23a55a 14%, transparent 86%);
  outline: none;
}

.manual-seat-clear {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: color-mix(in srgb, #f44336 15%, transparent 85%);
  color: #f44336;
  font-size: 14px;
  line-height: 20px;
  text-align: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease;
  z-index: 2;
}

.manual-seat:hover .manual-seat-clear {
  opacity: 1;
}

.manual-seat-clear:hover {
  background: #f44336;
  color: #fff;
  transform: none;
}

.roster-delete-btn {
  margin-left: auto;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: color-mix(in srgb, #f44336 15%, transparent 85%);
  color: #f44336;
  font-size: 14px;
  line-height: 24px;
  text-align: center;
  cursor: pointer;
  flex-shrink: 0;
}

.roster-delete-btn:hover {
  background: #f44336;
  color: #fff;
  transform: none;
}

.manual-group-empty h3,
.manual-table-empty h3 {
  opacity: 0.55;
}

.batch-import-dialog .format-example {
  background: var(--panel-alt);
  padding: 10px;
  border-radius: 8px;
  font-family: monospace;
  font-size: 13px;
  white-space: pre-wrap;
}

.error {
  color: var(--error-text);
}

.success {
  color: var(--success-text);
}

@media (max-width: 1024px) {
  .editor-view {
    zoom: 1;
  }

  .editor-floating-context {
    position: static;
    margin-bottom: 10px;
    flex-wrap: wrap;
    justify-content: flex-start;
  }

  .main-content {
    flex-direction: column;
  }

  .right-section {
    min-height: 0;
    width: 100%;
    max-width: none;
    padding-top: 0;
  }

  .class-row {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .class-selector,
  .controls,
  .save-button {
    position: static;
    margin-top: 10px;
  }

  .editor-view {
    padding-bottom: 24px;
  }

  .notes-section {
    position: static;
    min-height: 340px;
  }

  .ocr-cloud-config {
    grid-template-columns: 1fr;
  }

  .ocr-check-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .controls {
    justify-content: flex-start;
    max-width: none;
  }
}

@media (max-width: 720px) {
  .superamber-shell {
    padding: 14px;
  }

  .home-view {
    min-height: auto;
    padding: 22px 18px;
    border-width: 6px;
  }

  .home-header {
    flex-direction: column;
  }

  .usage-guide-header {
    flex-direction: column;
  }

  .usage-guide-header-actions {
    align-items: flex-start;
  }

  .usage-guide-note {
    max-width: none;
    text-align: left;
  }

  .theme-switch {
    align-items: flex-start;
  }

  .editor-topbar {
    flex-direction: column;
    align-items: stretch;
  }

  .time-display,
  .location-display {
    min-width: 0;
  }

  .classroom {
    grid-template-columns: 1fr;
  }

  .header input {
    width: 120px;
  }
}
`,Ar=`
  <div class="superamber-shell theme-paper" id="superamberShell">
  <div class="overlay" id="overlay"></div>

  <section class="home-view" id="homeView">
    <header class="home-header">
      <div class="welcome-box" id="welcomeBox" title="右键可修改用户名">
        <h1 id="welcomeText">Super Amber</h1>
        <p id="todayText">今天是</p>
      </div>
      <div class="theme-switch">
        <label for="usernameInput">用户名</label>
        <div class="username-editor">
          <input id="usernameInput" placeholder="输入用户名" />
          <button type="button" id="saveUsernameBtn">保存</button>
        </div>
        <label for="themeSelect">主题</label>
        <select id="themeSelect">
          <option value="paper">默认白</option>
          <option value="classic">经典蓝</option>
          <option value="mint">森林绿</option>
          <option value="rose">樱花粉</option>
          <option value="apricot">杏桃橙</option>
          <option value="golden">奶油黄</option>
          <option value="plum">葡萄紫</option>
        </select>
      </div>
    </header>

    <section class="home-actions">
      <button class="primary" id="generateWeekBtn" onclick="generateWeeklySeating()">生成第<span id="homeWeekNum">1</span>周座位表</button>
      <button id="undoWeekBtn" onclick="undoWeeklySeating()">撤回上次周轮转</button>
      <button id="newClassBtn" onclick="showCreateClassDialog()">新建班级座位表</button>
      <button id="exportBackupBtn" onclick="exportDataBackup()">导出备份</button>
      <button id="importBackupBtn" onclick="triggerImportBackup()">导入备份</button>
      <button id="usageGuideToggleBtn" onclick="toggleUsageGuide()">隐藏使用说明</button>
      <input id="backupImportInput" type="file" accept=".json,application/json" hidden />
    </section>

    <section class="usage-guide" aria-labelledby="usageGuideTitle">
      <div class="usage-guide-header">
        <div>
          <p class="usage-guide-eyebrow">使用说明</p>
          <h2 id="usageGuideTitle">第一次打开先看这里</h2>
        </div>
        <div class="usage-guide-header-actions">
          <p class="usage-guide-note">Super Amber 是一套静态网页工具，上传到公司网站后即可直接访问。</p>
          <button type="button" class="usage-guide-close" onclick="toggleUsageGuide()">收起</button>
        </div>
      </div>
      <div class="usage-guide-grid">
        <article class="usage-card">
          <h3>1. 建班与导入</h3>
          <ul>
            <li>点击“新建班级座位表”开始建班。</li>
            <li>支持文字导入、图片 OCR 导入，也可以后续手动补名字。</li>
            <li>图片导入会先识别班号、名单、时间和教室，再让你人工确认后写入。</li>
            <li>只导入了周中或周末其中一边时，可在班内把已有座位同步到另一时段。</li>
          </ul>
        </article>
        <article class="usage-card">
          <h3>2. 班内编辑</h3>
          <ul>
            <li>进入班级后可修改班号、主题、日期、校区、教室和备注。</li>
            <li>“手动微调”里可以改组数、改学生名字、交换座位、补录新学生。</li>
            <li>“完整名单”可核对人数，并按字母顺序查看当前名单。</li>
          </ul>
        </article>
        <article class="usage-card">
          <h3>3. 轮转与回退</h3>
          <ul>
            <li>主页“生成第X周座位表”会批量推进所有班到下一周。</li>
            <li>主页“撤回上次周轮转”可恢复整批误触。</li>
            <li>每个班内都可“看看上周座位”，预览后再决定是否恢复。</li>
          </ul>
        </article>
        <article class="usage-card usage-card-emphasis">
          <h3>4. 部署与数据说明</h3>
          <ul>
            <li>给公司部署时，上传打包后的 dist 全部文件即可。</li>
            <li>当前版本数据默认保存在浏览器本地，同一浏览器会记住，上线后不会自动跨设备同步。</li>
            <li>OCR 是否走正式接口，取决于这里配置的 OCR 通道，不是所有环境都会自动带上。</li>
            <li>如需所有设备共用同一份实时数据，后续需要再接后端存储。</li>
          </ul>
        </article>
      </div>
    </section>

    <section class="class-overview">
      <h2>班级总览</h2>
      <div id="homeClassList" class="home-class-list"></div>
    </section>
  </section>

  <section class="editor-view hidden" id="editorView">
    <div class="editor-floating-context hidden" id="editorFloatingContext">
      <span class="editor-floating-label">当前班级</span>
      <select id="floatingClassSelect">
        <option value="">选择班级...</option>
      </select>
      <span class="editor-floating-meta" id="floatingClassMeta">未选择班级</span>
    </div>

    <div class="editor-stage">
      <div class="editor-topbar">
        <button class="back-home" onclick="goHome()">返回主页</button>
        <button type="button" class="editor-tools-toggle" id="editorToolsToggle">隐藏工具</button>
      </div>

      <div class="class-selector">
        <div class="class-selector-main">
          <label class="class-selector-label" for="classSelect">当前班级</label>
          <select id="classSelect">
            <option value="">选择班级...</option>
          </select>
        </div>
        <div class="class-theme-switch">
          <label class="class-selector-label" for="editorThemeSelect">班级主题</label>
          <select id="editorThemeSelect">
            <option value="paper">默认白</option>
            <option value="classic">经典蓝</option>
            <option value="mint">森林绿</option>
            <option value="rose">樱花粉</option>
            <option value="apricot">杏桃橙</option>
            <option value="golden">奶油黄</option>
            <option value="plum">葡萄紫</option>
          </select>
        </div>
        <div class="time-toggle">
          <button onclick="toggleTime('weekday')" id="weekdayBtn" class="active">周中</button>
          <button onclick="toggleTime('weekend')" id="weekendBtn">周末</button>
        </div>
        <button class="rename-btn" onclick="renameCurrentClass()">改班号</button>
        <button class="delete-btn subtle" onclick="deleteCurrentClass()">删除当前班级</button>
      </div>

      <div class="main-content">
        <div class="left-section">
          <div class="header">
            <input type="text" id="headerClassName" value="J328" placeholder="XXXX" maxlength="8" />班座位表
          </div>
          <div class="info-section">
            <div class="time-display">
              <span class="emoji">⏰</span>
              <input type="text" class="info-input" id="date" placeholder="月" />月
              <input type="text" class="info-input" id="day" placeholder="日" />日
              <select class="weekday-select" id="weekday">
                <option value="">选择星期</option>
                <option value="星期一">星期一</option>
                <option value="星期二">星期二</option>
                <option value="星期三">星期三</option>
                <option value="星期四">星期四</option>
                <option value="星期五">星期五</option>
                <option value="星期六">星期六</option>
                <option value="星期日">星期日</option>
              </select>
              <input type="text" class="info-input wider" id="time" list="timeOptions" placeholder="选择或输入时间" />
              <datalist id="timeOptions">
                <option value="10:10"></option>
                <option value="11:20"></option>
                <option value="12:30"></option>
                <option value="13:40"></option>
                <option value="14:50"></option>
                <option value="16:00"></option>
                <option value="17:10"></option>
                <option value="18:20"></option>
                <option value="19:30"></option>
              </datalist>
            </div>
            <div class="location-display">
              <span class="emoji">🏫</span>
              <select class="campus-select" id="campus">
                <option value="">选择校区</option>
                <option value="C86校区">C86校区</option>
                <option value="七彩校区">七彩校区</option>
              </select>
              <input type="text" class="info-input" id="floor" placeholder="楼" />楼
              <input type="text" class="info-input wider" id="room" placeholder="教室" />
            </div>
          </div>
          <div class="screen-banner">屏幕 & 白板</div>
          <div class="classroom" id="classroom"></div>
        </div>

        <div class="right-section">
          <div class="notes-section">
            <div class="notes-header">
              <div>
                <strong>备注栏</strong>
                <span>右侧调宽，底边调高，顶部和日期信息区对齐</span>
              </div>
              <button type="button" class="notes-toolbar-toggle" id="notesToolbarToggle">显示设置</button>
            </div>
            <div class="notes-toolbar">
              <select id="noteFontSize">
                <option value="12">12px</option>
                <option value="14">14px</option>
                <option value="16" selected>16px</option>
                <option value="18">18px</option>
                <option value="20">20px</option>
                <option value="24">24px</option>
              </select>
              <input type="color" id="noteColor" value="#000000" />
              <div class="text-align-group">
                <button onclick="setTextAlign('left')" title="左对齐"><i>⬅️</i></button>
                <button onclick="setTextAlign('center')" title="居中对齐"><i>⬆️</i></button>
                <button onclick="setTextAlign('right')" title="右对齐"><i>➡️</i></button>
              </div>
              <div class="text-align-group">
                <button onclick="setVerticalAlign('top')" title="顶部对齐"><i>⬆️</i></button>
                <button onclick="setVerticalAlign('middle')" title="垂直居中"><i>↕️</i></button>
                <button onclick="setVerticalAlign('bottom')" title="底部对齐"><i>⬇️</i></button>
              </div>
            </div>
            <div class="notes-content" id="notes" contenteditable="true" placeholder="在此添加备注内容..."></div>
            <div class="notes-height-handle" id="notesHeightHandle" title="拖动调整备注栏高度"></div>
          </div>
          <div class="notes-width-handle" id="notesWidthHandle" title="拖动调整备注栏宽度"></div>
        </div>
      </div>
    </div>

    <button class="save-button" onclick="showSaveDialog()">保存配置</button>
    <div class="controls">
      <button onclick="showBatchImportDialog()">批量导入</button>
      <button onclick="showImportDialog()">文字导入</button>
      <button onclick="showImageImportDialog()">图片导入</button>
      <button onclick="showCnfSyncDialog()">教务导入</button>
      <button onclick="showManualTuneDialog()">手动微调</button>
      <button onclick="showPreviousWeekDialog()">看看上周座位</button>
      <button onclick="showRosterDialog()">完整名单</button>
      <button id="syncOtherModeBtn" onclick="copyCurrentToOtherMode()">同步到另一时段</button>
      <button onclick="toggleLayout()">切换布局</button>
      <button onclick="generateSeating()">手动轮转</button>
    </div>
  </section>

  <div class="save-dialog dialog" id="saveDialog">
    <h2>保存班级配置</h2>
    <input type="text" id="saveClassName" placeholder="输入班级名称" />
    <div class="buttons">
      <button class="cancel" onclick="hideSaveDialog()">取消</button>
      <button class="confirm" onclick="saveClass()">保存</button>
    </div>
  </div>

  <div class="dialog" id="createClassDialog">
    <h2>新建班级座位表</h2>
    <div class="create-options">
      <button onclick="showImageImportDialog()">1. 原有座位表图片导入</button>
      <button onclick="showImportDialog()">2. 文字导入</button>
      <button disabled>3. 教务系统导入（开发中）</button>
    </div>
    <div class="buttons">
      <button class="cancel" onclick="hideCreateClassDialog()">关闭</button>
    </div>
  </div>

  <div class="dialog import-dialog" id="importDialog">
    <h2>导入学生名单</h2>
    <div class="layout-selector">
      <label>选择教室布局：</label>
      <div class="layout-option">
        <input type="radio" name="layout" value="circular" id="circularLayout" checked />
        <label for="circularLayout">六张圆桌布局</label>
      </div>
      <div class="layout-option">
        <input type="radio" name="layout" value="rows" id="rowsLayout" />
        <label for="rowsLayout">三横排布局</label>
      </div>
      <div class="layout-option" hidden>
        <input type="radio" name="layout" value="arc" id="arcLayout" />
        <label for="arcLayout">两横排布局</label>
      </div>
    </div>
    <p>请输入学生名单（每行一个名字）：</p>
    <div id="layoutDescription">
      <ul style="font-size: 14px; color: #666; margin: 10px 0;">
        <li>圆桌：31-36人=6组，25-30人=5组，19-24人=4组，1-18人=3组</li>
        <li>三横排：31-36人=6组，25-30人=5组，1-24人=4组</li>
      </ul>
    </div>
    <textarea id="studentNames" placeholder="请输入学生名字，每行一个..."></textarea>
    <div id="errorMsg"></div>
    <div class="buttons">
      <button class="cancel" onclick="hideImportDialog()">取消</button>
      <button class="confirm" onclick="importStudents()">确认导入</button>
    </div>
  </div>

  <div class="dialog" id="imageImportDialog">
    <h2>图片识别导入</h2>
    <p>支持单图单班级与多图多班级。先确认 OCR 通道，再识别，再人工核对后导入。</p>
    <div class="ocr-config-grid">
      <label>识别引擎
        <select id="ocrEngine">
          <option value="hybrid">腾讯优先（默认不回退）</option>
          <option value="tencent">仅腾讯 OCR</option>
          <option value="local">仅本地 OCR</option>
        </select>
      </label>
      <label class="ocr-checkbox">
        <input type="checkbox" id="allowLocalFallback" />
        <span>腾讯失败时回退本地OCR（默认关闭）</span>
      </label>
      <label>腾讯代理地址
        <input id="tencentEndpoint" placeholder="http://127.0.0.1:8787" />
      </label>
      <div id="ocrCloudConfig" class="ocr-cloud-config">
        <label>腾讯地域
          <input id="tencentRegion" placeholder="ap-guangzhou" />
        </label>
        <label>腾讯接口
          <select id="tencentAction">
            <option value="Auto">自动（优先最新AI接口）</option>
            <option value="ExtractDocMulti">ExtractDocMulti（最新AI）</option>
            <option value="GeneralAccurateOCR">GeneralAccurateOCR</option>
            <option value="GeneralBasicOCR">GeneralBasicOCR</option>
          </select>
        </label>
      </div>
      <div class="ocr-check-row">
        <button type="button" onclick="checkOCRChannel()">检测OCR通道</button>
        <div id="ocrEngineStatus" class="muted">点击“检测OCR通道”可验证当前是否走腾讯AI接口。</div>
      </div>
      <div class="ocr-hint">提示：正式环境请先填写你们的 OCR 接口地址并做一次检测；只有本地调试时才需要 npm run ocr:proxy。</div>
    </div>
    <input type="file" id="imageFiles" accept="image/*" multiple />
    <div id="ocrProgress" class="progress"></div>
    <div id="ocrReviewList" class="ocr-review-list"></div>
    <div class="buttons">
      <button class="cancel" onclick="hideImageImportDialog()">取消</button>
      <button onclick="startImageRecognition()">开始识别</button>
      <button class="confirm" onclick="confirmImageImport()">确认导入</button>
    </div>
  </div>

  <div class="dialog" id="manualTuneDialog">
    <h2>手动微调</h2>
    <p class="manual-tips">提示：直接在真实座位图里操作。单击两个座位可交换，双击座位可直接改名；新增学生后会自动进入空位。红色提示代表还有修改没保存，绿色代表当前没有待保存改动。</p>
    <div class="manual-row">
      <label for="manualGroupCount">组数</label>
      <input type="number" id="manualGroupCount" min="1" max="6" value="6" />
      <button type="button" onclick="applyManualGroupCount()">按组数重排</button>
    </div>
    <div class="manual-row">
      <label for="manualNewStudent">新增学生</label>
      <input type="text" id="manualNewStudent" placeholder="输入新学生名字" />
      <button type="button" onclick="addManualTuneStudent()">加入空位</button>
    </div>
    <div class="manual-row">
      <button type="button" onclick="shuffleManualTuneSeats()">随机排座</button>
    </div>
    <div id="manualTuneStatus" class="manual-status is-saved">已保存状态：现在看到的是当前草稿，继续改动后记得点“保存微调”。单击两个座位可交换，双击座位可直接编辑名字。</div>
    <div id="manualSeatEditor" class="manual-seat-editor"></div>
    <div id="manualTuneError" class="error"></div>
    <div class="buttons">
      <button class="cancel" onclick="hideManualTuneDialog()">取消</button>
      <button class="confirm" onclick="applyManualTune()">保存微调</button>
    </div>
  </div>

  <div class="dialog previous-week-dialog" id="previousWeekDialog">
    <h2>看看上周座位</h2>
    <p id="previousWeekSummary" class="muted"></p>
    <div id="previousWeekPreview" class="previous-week-preview"></div>
    <div class="buttons">
      <button class="cancel" onclick="hidePreviousWeekDialog()">关闭</button>
      <button class="confirm" onclick="restorePreviousWeek()">恢复为上周版本</button>
    </div>
  </div>

  <div class="dialog roster-dialog" id="rosterDialog">
    <h2>完整名单</h2>
    <p id="rosterSummary" class="muted"></p>
    <div id="rosterList" class="roster-list"></div>
    <div class="buttons">
      <button class="confirm" onclick="hideRosterDialog()">关闭</button>
    </div>
  </div>

  <div class="dialog batch-import-dialog" id="batchImportDialog">
    <h2>批量导入班级配置</h2>
    <p>请按照以下格式输入数据（使用!作为班级分隔符）：</p>
    <div class="format-example">班级名称: J328
校区: C86校区
楼层: 1
教室: 101

周中布局: 圆桌
周中时间:
月: 3
日: 7
星期: 星期六
时间: 11:20-12:20

Group 1: Jenny, Andy, Rain
Group 2: Bella, Sunny, David
!
班级名称: J329
周中布局: 三排
Group 1: Amy, Lucas</div>
    <textarea id="batchImportData" placeholder="在此输入数据..."></textarea>
    <div id="batchImportError" class="error"></div>
    <div class="buttons">
      <button class="cancel" onclick="hideBatchImportDialog()">取消</button>
      <button class="confirm" onclick="processBatchImport()">确认导入</button>
    </div>
  </div>

  <div class="dialog cnf-sync-dialog" id="cnfSyncDialog">
    <h2>教务系统导入</h2>
    <div class="cnf-sync-form">
      <div class="cnf-field">
        <label for="cnfUsername">教务账号</label>
        <input type="text" id="cnfUsername" placeholder="教务系统用户名" autocomplete="username" />
      </div>
      <div class="cnf-field">
        <label for="cnfPassword">密码</label>
        <input type="password" id="cnfPassword" placeholder="教务系统密码" autocomplete="current-password" />
      </div>
      <div class="cnf-field cnf-squad-picker" id="cnfSquadPickerWrap" style="display:none">
        <label for="cnfSquadSelect">选择班级</label>
        <select id="cnfSquadSelect"><option value="">-- 请先登录 --</option></select>
      </div>
    </div>
    <div id="cnfSyncStatus" class="cnf-sync-status"></div>
    <div class="buttons">
      <button class="cancel" onclick="hideCnfSyncDialog()">取消</button>
      <button id="cnfLoginBtn" onclick="cnfLoginAction()">登录并加载班级</button>
      <button id="cnfFetchBtn" class="confirm" onclick="cnfFetchAction()" disabled>抓取名单</button>
    </div>
  </div>
  </div>
`,Nr=e=>e.replace(/url\((['"]?)\/fonts\//g,"url($1/seating/fonts/"),Or=(e,n={})=>{Nn();const t=n.embedded?e.shadowRoot||e.attachShadow({mode:"open"}):e;t.innerHTML=`${n.embedded?`<style>${Nr(Tr)}</style>`:""}${Ar}`;const o=t.querySelector("#superamberShell");return co({launchClassName:n.launchClassName,embedded:n.embedded,queryRoot:t,hostElement:o}),n.setDocumentTitle!==!1&&(document.title=St),Mr(),()=>{Nn(),t.innerHTML=""}},wt=document.querySelector("#app");if(!wt)throw new Error("App root not found");Or(wt,{embedded:!1});export{hn as g,me as m,X as p};
