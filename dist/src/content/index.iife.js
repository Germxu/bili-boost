(function(){var e=[{name:`动态`,href:`//t.bilibili.com`},{name:`热门`,href:`//www.bilibili.com/v/popular/all`},{name:`番剧`,href:`//www.bilibili.com/anime/`},{name:`电影`,href:`//www.bilibili.com/movie/`},{name:`国创`,href:`//www.bilibili.com/guochuang/`},{name:`电视剧`,href:`//www.bilibili.com/tv/`},{name:`综艺`,href:`//www.bilibili.com/variety/`},{name:`纪录片`,href:`//www.bilibili.com/documentary/`},{name:`动画`,href:`//www.bilibili.com/c/douga/`},{name:`游戏`,href:`//www.bilibili.com/c/game/`},{name:`鬼畜`,href:`//www.bilibili.com/c/kichiku/`},{name:`音乐`,href:`//www.bilibili.com/c/music/`},{name:`舞蹈`,href:`//www.bilibili.com/c/dance/`},{name:`影视`,href:`//www.bilibili.com/c/cinephile/`},{name:`娱乐`,href:`//www.bilibili.com/c/ent/`},{name:`知识`,href:`//www.bilibili.com/c/knowledge/`},{name:`科技数码`,href:`//www.bilibili.com/c/tech/`},{name:`资讯`,href:`//www.bilibili.com/c/information/`},{name:`美食`,href:`//www.bilibili.com/c/food/`},{name:`小剧场`,href:`//www.bilibili.com/c/shortplay/`},{name:`汽车`,href:`//www.bilibili.com/c/car`},{name:`时尚美妆`,href:`//www.bilibili.com/c/fashion/`},{name:`体育运动`,href:`//www.bilibili.com/c/sports/`},{name:`动物`,href:`//www.bilibili.com/c/animal/`},{name:`vlog`,href:`//www.bilibili.com/c/vlog/`},{name:`绘画`,href:`//www.bilibili.com/c/painting/`},{name:`人工智能`,href:`//www.bilibili.com/c/ai/`},{name:`家装房产`,href:`//www.bilibili.com/c/home/`},{name:`户外`,href:`//www.bilibili.com/c/outdoors/`},{name:`健身`,href:`//www.bilibili.com/c/gym/`},{name:`手工`,href:`//www.bilibili.com/c/handmake/`},{name:`旅游出行`,href:`//www.bilibili.com/c/travel/`},{name:`三农`,href:`//www.bilibili.com/c/rural/`},{name:`亲子`,href:`//www.bilibili.com/c/parenting/`},{name:`健康`,href:`//www.bilibili.com/c/health/`},{name:`情感`,href:`//www.bilibili.com/c/emotion/`},{name:`生活兴趣`,href:`//www.bilibili.com/c/life_joy/`},{name:`生活经验`,href:`//www.bilibili.com/c/life_experience/`}],t=`//www.bilibili.com`,n={min:.25,max:5},r={features:{navCustomizer:!1},speedWheel:{remember:!0},navCustomizer:{hidden:[],channels:[]}},i=`[BiliBoost]`,a={info(...e){console.info(i,...e)},warn(...e){console.warn(i,...e)},error(...e){console.error(i,...e)}},o=`settings`;async function s(){let e=(await chrome.storage.sync.get(o))[o];return{features:{...r.features,...e?.features},speedWheel:{...r.speedWheel,...e?.speedWheel},navCustomizer:{...r.navCustomizer,...e?.navCustomizer}}}async function c(e){let t=await s();t.navCustomizer={...t.navCustomizer,...e},await chrome.storage.sync.set({[o]:t})}var l=`biliBoost_ipEnabled`,ee=`BILIBOOST_INJECT_MAIN_WORLD`;function te(){chrome.runtime.sendMessage({type:ee,file:`ip-location.js`}).catch(e=>{a.warn(`main-world injection request failed`,e)})}function ne(){localStorage.setItem(l,`1`),te(),a.info(`comment-ip: main-world injection requested`)}var re=`bili-boost-capture-toast`,ie=`bili-boost-capture-btn`,ae=`.bpx-player-ctrl-time`,u=null,oe,d=null,se,ce=null,le=new WeakMap;function ue(e,t=document,n=0){let r=Array.from(t.querySelectorAll(e));return n>=4||t.querySelectorAll(`*`).forEach(t=>{t.shadowRoot&&r.push(...ue(e,t.shadowRoot,n+1))}),r}function de(){return ue(`video`)[0]??null}function fe(e){return e.closest(`.bpx-player-video-wrap, #bilibiliPlayer, .bilibili-player`)??e.parentElement??document.body}function pe(){return document.title.replace(/_哔哩哔哩.*$/,``).replace(/[\\/:*?"<>|]/g,`_`).trim()||`bilibili`}function me(e){let t=Math.max(0,Math.floor(e)),n=Math.floor(t/3600),r=Math.floor(t%3600/60),i=t%60,a=e=>String(e).padStart(2,`0`);return n>0?`${a(n)}-${a(r)}-${a(i)}`:`${a(r)}-${a(i)}`}function he(){if(u?.isConnected&&u.shadowRoot)return u.shadowRoot;u?.remove(),u=document.createElement(`div`),u.id=re,u.style.cssText=`position:fixed;top:0;left:0;pointer-events:none;z-index:2147483647;`;let e=u.attachShadow({mode:`open`}),t=document.createElement(`style`);t.textContent=`
    .toast {
      position: fixed;
      top: 24px;
      left: 50%;
      transform: translateX(-50%);
      padding: 10px 18px;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.78);
      color: #fff;
      font: 500 14px/1.4 system-ui, -apple-system, sans-serif;
      white-space: nowrap;
      opacity: 0;
      transition: opacity 0.18s ease;
    }
    .toast.show { opacity: 1; }
  `;let n=document.createElement(`div`);return n.className=`toast`,e.append(t,n),document.body.appendChild(u),e}function ge(e){let t=he();if(!t)return;let n=t.querySelector(`.toast`);n&&(n.textContent=e,n.classList.add(`show`),window.clearTimeout(oe),oe=window.setTimeout(()=>n.classList.remove(`show`),1600))}function _e(e){d?.remove(),d=document.createElement(`div`),d.id=`bili-boost-capture-flash`,d.style.cssText=`position:absolute;inset:0;background:#fff;opacity:0.55;pointer-events:none;z-index:9998;transition:opacity 0.28s ease;`,getComputedStyle(e).position===`static`&&(e.style.position=`relative`),e.appendChild(d),window.clearTimeout(se),se=window.setTimeout(()=>{d?.remove(),d=null},60)}async function ve(){let e=de();if(!e||e.readyState<2||!e.videoWidth||!e.videoHeight)ge(`视频未就绪，无法截图`);else try{let t=new OffscreenCanvas(e.videoWidth,e.videoHeight),n=t.getContext(`2d`);if(!n)throw Error(`无法创建 canvas 上下文`);n.drawImage(e,0,0,e.videoWidth,e.videoHeight);let r=await t.convertToBlob({type:`image/png`}),i=URL.createObjectURL(r),o=`${pe()}_${me(e.currentTime)}.png`,s=document.createElement(`a`);s.href=i,s.download=o,s.style.display=`none`,document.body.appendChild(s),s.click(),s.remove(),window.setTimeout(()=>URL.revokeObjectURL(i),1e3),_e(fe(e)),ge(`已保存 ${o}`),a.info(`frame-capture: saved`,o)}catch(e){a.warn(`frame-capture: failed`,e),ge(`截图失败：当前视频不支持导出`)}}function ye(e,t){e.style.width=`36px`,e.style.height=`${t}px`;let n=e.querySelector(`svg`);n?.setAttribute(`width`,`22`),n?.setAttribute(`height`,`22`)}function be(e){let t=document.createElement(`button`);return t.id=ie,t.type=`button`,t.setAttribute(`aria-label`,`截图`),t.title=`截取当前帧`,t.style.cssText=`display:inline-flex;align-items:center;justify-content:center;flex:none;box-sizing:border-box;padding:0;margin:0 0 0 4px;border:0;border-radius:4px;background:transparent;color:#fff;opacity:0.85;cursor:pointer;vertical-align:middle;transition:opacity .2s,color .2s`,t.innerHTML=`
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
         stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:block">
      <path d="M3 8.5h3.6l1.5-2.5h7.8l1.5 2.5H21v10.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>
      <circle cx="12" cy="13.5" r="3.3"/>
    </svg>
  `,ye(t,e),t.addEventListener(`click`,e=>{e.preventDefault(),e.stopPropagation(),ve()}),t.addEventListener(`mousedown`,e=>e.stopPropagation()),t.addEventListener(`mouseenter`,()=>{t.style.opacity=`1`,t.style.color=`#00aeec`}),t.addEventListener(`mouseleave`,()=>{t.style.opacity=`0.85`,t.style.color=`#fff`}),t}function xe(e){let t=e.getBoundingClientRect().height;return Math.round(Math.min(44,Math.max(20,t||36)))}function Se(){ue(ae).forEach(e=>{let t=xe(e),n=le.get(e);if(n?.isConnected){ye(n,t);return}let r=e.nextElementSibling;if(r?.id===ie){let n=r;le.set(e,n),ye(n,t);return}let i=be(t);e.insertAdjacentElement(`afterend`,i),le.set(e,i),a.info(`frame-capture: camera button injected`,t)})}function Ce(e,t,n){e===`BILIBOOST_CAPTURE_FRAME`&&(ve(),n({ok:!0}))}function we(){chrome.runtime.onMessage.addListener(Ce),ce=new MutationObserver(()=>Se()),ce.observe(document,{childList:!0,subtree:!0}),Se(),a.info(`frame-capture: ready (camera button / popup button)`)}var Te=`bili-boost-progress-host`,Ee=`bili-boost:player-ready`,De={childList:!0,subtree:!0},Oe=`data-ctrl-hidden`,ke=`.bpx-player-container`,f=null,Ae=!1,je=new WeakMap;function Me(e,t=document,n=0){let r=Array.from(t.querySelectorAll(e));return n>=4||t.querySelectorAll(`*`).forEach(t=>{t.shadowRoot&&r.push(...Me(e,t.shadowRoot,n+1))}),r}function Ne(){return Me(`video`)}function Pe(e){let t=e;for(;t;){if(t.matches(`.bpx-player, #bilibiliPlayer, .bilibili-player`))return t;let e=t.parentElement;if(e){t=e;continue}let n=t.getRootNode();t=n instanceof ShadowRoot?n.host:null}let n=e.getRootNode();return(n instanceof ShadowRoot?n.host:null)??e.parentElement??document.body}function Fe(e,t){return e.closest(`.bpx-player-video-wrap, #bilibiliPlayer, .bilibili-player`)??e.parentElement??t}function Ie(e){let t=Me(ke,e)[0];if(t)return t;let n=e;for(let e=0;n&&e<16;e++){if(n instanceof HTMLElement&&n.matches(ke))return n;let e=n.parentElement;if(e){n=e;continue}let t=n.getRootNode();n=t instanceof ShadowRoot?t.host:null}return null}function Le(e){if(!Number.isFinite(e)||e<0)return`00:00`;let t=Math.floor(e),n=Math.floor(t/3600),r=Math.floor(t%3600/60),i=t%60,a=e=>String(e).padStart(2,`0`);return n>0?`${a(n)}:${a(r)}:${a(i)}`:`${a(r)}:${a(i)}`}function Re(e){let{video:t,fill:n,time:r}=e,i=t.duration,a=Number.isFinite(i)&&i>0?Math.min(100,Math.max(0,t.currentTime/i*100)):0;n.style.width=`${a}%`,r.textContent=`${Le(t.currentTime)} / ${Le(i)}`}function ze(e,t){e.track.style.opacity=t?`0.7`:`0`,e.time.style.opacity=t?`1`:`0`}function Be(e){let t=e.ctrlHost?.getAttribute(Oe);ze(e,t!==`false`)}function Ve(e){e.host.remove(),e.ctrlObserver?.disconnect();for(let[t,n]of e.listeners)e.video.removeEventListener(t,n)}function He(e,t,n){let r=document.createElement(`div`);r.id=Te,r.style.cssText=`position:absolute;left:0;right:0;bottom:0;height:3px;pointer-events:none;z-index:9997`;let i=document.createElement(`div`);i.style.cssText=`position:absolute;inset:0;background:rgba(255,255,255,.2);opacity:0;transition:opacity .2s ease`;let a=document.createElement(`div`);a.style.cssText=`position:absolute;left:0;top:0;bottom:0;width:0;background:#00aeec;`;let o=document.createElement(`div`);o.style.cssText=`position:absolute;right:4px;bottom:6px;padding:2px 6px;border-radius:4px;background:rgba(0,0,0,.38);color:#fff9;font:12px/1.4 system-ui,-apple-system,sans-serif;white-space:nowrap;opacity:0;transition:opacity .2s ease`,i.appendChild(a),r.append(i,o),getComputedStyle(t).position===`static`&&(t.style.position=`relative`),t.appendChild(r);let s={host:r,track:i,fill:a,time:o,video:e,container:t,listeners:[],ctrlHost:n,ctrlObserver:null};n&&(s.ctrlObserver=new MutationObserver(()=>Be(s)),s.ctrlObserver.observe(n,{attributes:!0,attributeFilter:[Oe]}));let c=()=>Re(s);return[`timeupdate`,`loadedmetadata`,`durationchange`,`seeked`].forEach(t=>{e.addEventListener(t,c),s.listeners.push([t,c])}),Re(s),Be(s),s}function Ue(){f?.disconnect();try{let e=new Set;Ne().forEach(t=>{let n=Pe(t),r=Fe(t,n);if(e.has(r))return;e.add(r);let i=Ie(n),a=je.get(r);if(a?.host.isConnected&&a.video.isConnected&&a.ctrlHost===i&&(!a.ctrlHost||a.ctrlHost.isConnected))return;a&&Ve(a),r.querySelectorAll(`#${Te}`).forEach(e=>e.remove());let o=He(t,r,i);je.set(r,o),document.dispatchEvent(new CustomEvent(Ee))})}finally{f?.observe(document,De)}}function We(){Ae||(Ae=!0,window.setTimeout(()=>{Ae=!1,Ue()},100))}function Ge(){f=new MutationObserver(We),f.observe(document,De),Ue(),a.info(`immersive-progress: ready`)}var p=`biliBoost_lastPlaybackRate`,Ke=`bili-boost-speed-host`,qe=`div[aria-label='倍速'], .bpx-player-ctrl-playbackrate, .bpx-player-ctrl-playbackrate-menu`,Je=`.bpx-player-ctrl-playbackrate-menu`,Ye=`.bpx-player-ctrl-playbackrate-result`,Xe=50,Ze=300,Qe=2e3,m={...r.speedWheel},$e=null,h=[],et=[],tt=new WeakSet,g=null,nt,rt,_=null,v=null,it=0,at=0,y=!1;function b(e){let t=Math.min(n.max,Math.max(n.min,e));return Math.round(t*100)/100}function ot(e){return`${Number(e.toFixed(2))}x`}function st(e){return e.closest(`.bpx-player-video-wrap, #bilibiliPlayer, .bilibili-player`)??e.parentElement??document.body}function x(e,t=document,n=0){let r=Array.from(t.querySelectorAll(e));return n>=4||t.querySelectorAll(`*`).forEach(t=>{t.shadowRoot&&r.push(...x(e,t.shadowRoot,n+1))}),r}function S(e=document){return x(`video`,e)}function ct(e){let t=e.closest(`.bpx-player-container, #bilibiliPlayer, .bilibili-player`);return t&&S(t)[0]||S()[0]||null}function lt(e){if(g&&g.parentElement===e&&g.shadowRoot)return g.shadowRoot;g?.remove(),g=document.createElement(`div`),g.id=Ke,g.style.cssText=`position:absolute;inset:0;pointer-events:none;z-index:9999;`;let t=g.attachShadow({mode:`open`}),n=document.createElement(`style`);n.textContent=`
    .badge {
      position: absolute;
      top: 14px;
      right: 16px;
      padding: 6px 12px;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.62);
      color: #fff;
      font: 500 16px/1.2 system-ui, -apple-system, sans-serif;
      opacity: 0;
      transition: opacity 0.18s ease;
    }
    .badge.show { opacity: 1; }
  `;let r=document.createElement(`div`);return r.className=`badge`,t.append(n,r),getComputedStyle(e).position===`static`&&(e.style.position=`relative`),e.appendChild(g),t}function ut(e,t){let n=lt(t).querySelector(`.badge`);n&&(n.textContent=ot(e),n.classList.add(`show`),window.clearTimeout(nt),nt=window.setTimeout(()=>n.classList.remove(`show`),1200))}function C(e){let t=e===1?`倍速`:ot(e);x(Ye).forEach(e=>{e.textContent=t})}function dt(){try{let e=window.localStorage.getItem(p);if(e===null)return null;let t=Number(e);return Number.isFinite(t)?b(t):null}catch(e){return a.warn(`speed-wheel: failed to read local speed`,e),null}}function ft(e){try{window.localStorage.setItem(p,String(e))}catch(e){a.warn(`speed-wheel: failed to write local speed`,e)}}async function pt(){if(_===null)return;let e=_;if(_=null,e!==v)try{await chrome.storage.sync.set({[p]:e}),v=e}catch(e){a.warn(`speed-wheel: failed to sync speed`,e)}}function mt(e){_=b(e),window.clearTimeout(rt),rt=window.setTimeout(()=>void pt(),Ze)}function ht(e){let t=b(e);ft(t),mt(t),a.info(`speed-wheel: saved speed`,t)}function gt(e,t){Math.abs(e.playbackRate-t)<.001||(e.playbackRate=t,C(t))}function _t(e){if(!m.remember)return;let t=dt();t!==null&&gt(e,t)}async function vt(){if(m.remember)try{let e=(await chrome.storage.sync.get(p))[p];if(typeof e!=`number`||!Number.isFinite(e))return;let t=b(e);v=t,ft(t),h.forEach(({video:e})=>gt(e,t))}catch(e){a.warn(`speed-wheel: failed to load synced speed`,e)}}function yt(e){return t=>{if(t.deltaY===0)return;let n=ct(e);if(!n)return;let r=Date.now();if(r-it<Xe){t.preventDefault(),t.stopImmediatePropagation();return}it=r,t.preventDefault(),t.stopImmediatePropagation();let i=t.deltaY>0?-1:1,a=n.playbackRate||1,o=b(a+i*(a>2?.3:.05));o!==a&&(n.playbackRate=o,C(o),ut(o,st(n)),m.remember&&ht(o))}}function bt(e){return t=>{let n=ct(e);n&&(t.preventDefault(),t.stopImmediatePropagation(),n.playbackRate=1,C(1),ut(1,st(n)),m.remember&&ht(1),a.info(`speed-wheel: reset to 1x via context menu`))}}function xt(){x(Je).forEach(e=>{if(tt.has(e))return;let t=()=>{at=Date.now(),y=!0};e.addEventListener(`pointerdown`,t,{capture:!0}),e.addEventListener(`click`,t,{capture:!0}),tt.add(e)})}function St(){S(document).forEach(e=>{if(h.some(t=>t.video===e))return;let t=()=>{let t=b(e.playbackRate);if(C(t),!m.remember)return;if(y&&Date.now()-at<Qe){y=!1,ht(t);return}let n=dt();n!==null&&Math.abs(t-n)<.001||_t(e)};e.addEventListener(`ratechange`,t),h.push({video:e,onRateChange:t}),_t(e)})}function Ct(){x(qe).forEach(e=>{if(et.some(t=>t.element===e))return;let t=yt(e),n=bt(e);e.addEventListener(`wheel`,t,{capture:!0,passive:!1}),e.addEventListener(`contextmenu`,n,{capture:!0}),et.push({element:e,onWheel:t,onContextMenu:n})})}function wt(){St(),Ct(),xt()}function Tt(e,t){if(t===`sync`){if(e.settings){let t=e.settings.newValue;t?.speedWheel&&(m={...t.speedWheel})}if(e[p]){let t=e[p].newValue;if(typeof t==`number`&&Number.isFinite(t)){let e=b(t);v=e,ft(e),h.forEach(({video:t})=>gt(t,e))}}}}async function Et(){m={...(await s()).speedWheel},chrome.storage.onChanged.addListener(Tt),$e=new MutationObserver(()=>wt()),$e.observe(document,{childList:!0,subtree:!0,attributes:!0}),wt(),vt(),a.info(`speed-wheel: ready`,m)}var Dt=`bili-boost-nav-editor-style`,w=`bili-boost-channel-panel`,Ot=`bb-nav-item`,T=`bb-nav-custom`,E=`bb-nav-del`,D=`bb-nav-add`,O=`bb-nav-editing`,kt=500,At=300,jt=1500,Mt=1e4,Nt=`data-bb-header-vue-ready`,Pt=`bili-boost:header-vue-ready`,Ft=`BILIBOOST_INJECT_MAIN_WORLD`,It=`vue-ready.js`,k=`:is(li, .left-entry__item)`,A=`:is(li, .left-entry__item):not(.bb-nav-custom)`,Lt=`.bili-header__bar .left-entry`,j={hidden:[],channels:[]},M=!1,N=!1,P=!1,F=null,I=null,L=``,R,z=``,Rt=0,B,zt={x:0,y:0},V=null,H=null,U,W=!1,G=null,Bt=new WeakMap;function K(e){return e.replace(/^https?:/,``).replace(/\/+$/,``).toLowerCase()}var Vt=K(t);function Ht(e,t){let n=[],r=e=>{if(e instanceof Element){let t=e.shadowRoot;t&&r(t)}let i=e.querySelectorAll(t);for(let e=0;e<i.length;e+=1)n.push(i[e]);let a=e.querySelectorAll(`*`);for(let e=0;e<a.length;e+=1){let t=a[e].shadowRoot;t&&r(t)}};return r(e),n}function Ut(e){return e.startsWith(`//`)?`${location.protocol}${e}`:e}function Wt(e){let t=e.querySelector(`.channel-panel__item-name, .channel-panel__item-text, .name`);if(t?.textContent?.trim())return t.textContent.trim();let n=e.getAttribute(`title`)||e.getAttribute(`aria-label`);if(n?.trim())return n.trim();let r=e.cloneNode(!0),i=r.querySelectorAll(`svg, img`);for(let e=0;e<i.length;e+=1)i[e].remove();return(r.textContent??``).replace(/\s+/g,` `).trim()}function Gt(e){let t=e.querySelector(`img[src], img[data-src], img[srcset]`),n=t?.getAttribute(`src`)||t?.getAttribute(`data-src`)||t?.getAttribute(`srcset`)?.split(` `)[0];if(n)return Ut(n);let r=[e,...Array.from(e.querySelectorAll(`*`))];for(let e of r){let t=(e.style?.backgroundImage)?.match(/url\(["']?([^"')]+)["']?\)/);if(t?.[1])return Ut(t[1])}let i=e.querySelector(`svg`);if(i)try{let e=i.cloneNode(!0);e.setAttribute(`xmlns`,`http://www.w3.org/2000/svg`);let t=new XMLSerializer().serializeToString(e);return`data:image/svg+xml;charset=utf-8,${encodeURIComponent(t)}`}catch{return}}function Kt(){let e=Ht(document,`bili-header-channel-panel, .bili-header-channel-panel`);if(!e.length)return[];let t=Ht(e[0],`a[href]`),n=new Set,r=[];for(let e of t){let t=e.getAttribute(`href`)??``;if(!/^(https?:)?\/\//i.test(t))continue;let i=K(t);if(!i||i===Vt||n.has(i))continue;let a=Wt(e);a&&(n.add(i),r.push({name:a,href:t,icon:Gt(e)}))}return r}function q(e){return e.querySelector(`a[href]`)}function J(e){let t=q(e);return!!t&&K(t.getAttribute(`href`)??``)===Vt}function qt(e){let t=q(e);return t?K(t.getAttribute(`href`)??``):null}var Jt=`
.${O} ${k} {
  position: relative;
  cursor: pointer;
}
.${E} {
  position: absolute;
  top: 2px;
  right: -6px;
  z-index: 9999;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: #f25d8e;
  line-height: 15px;
  text-align: center;
  cursor: pointer;
  user-select: none;
}
.${E}:hover { background: #e14a7d; }
.${D} {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin: 0 4px;
  border: 1px dashed #fb7299;
  border-radius: 6px;
  color: #fb7299;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  user-select: none;
}
.${D}:hover { background: #fff1f5; }
#${w} {
  position: fixed;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  width: 440px;
  max-height: min(560px, calc(100vh - 40px));
  overflow: hidden;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 12px 40px rgba(0,0,0,.2), 0 2px 8px rgba(0,0,0,.08);
  color: #18191c;
  font-size: 14px;
  animation: bb-panel-in .18s ease-out;
}
@media (prefers-reduced-motion: reduce) {
  #${w} { animation: none; }
}
@keyframes bb-panel-in {
  from { opacity: 0; transform: translateY(8px) scale(.98); }
  to { opacity: 1; transform: none; }
}
.bb-panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px 22px 14px;
}
.bb-panel-title { font-size: 17px; font-weight: 600; }
.bb-panel-subtitle { margin-top: 5px; font-size: 12px; color: #9499a0; }
.bb-panel-count {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 8px;
  border-radius: 10px;
  background: #fff1f5;
  color: #fb7299;
  font-size: 12px;
  font-weight: 500;
  vertical-align: 1px;
}
.bb-panel-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #f6f7f8;
  color: #9499a0;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  user-select: none;
}
.bb-panel-close:hover { background: #e3e5e7; color: #18191c; }
.bb-panel-search {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 22px 14px;
  padding: 9px 12px;
  border-radius: 10px;
  background: #f6f7f8;
}
.bb-panel-search svg { flex: none; }
.bb-panel-search input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: #18191c;
  font-size: 13px;
}
.bb-panel-search input::placeholder { color: #b4b2a9; }
.bb-panel-list { flex: 1; min-height: 0; overflow-y: auto; padding: 0 12px 8px; }
.bb-panel-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border-radius: 10px;
  cursor: pointer;
}
.bb-panel-item:hover { background: #f6f7f8; }
.bb-panel-item.bb-added { cursor: default; }
.bb-panel-item.bb-added:hover { background: transparent; }
.bb-panel-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: #f6f7f8;
  color: #fff;
  font-size: 16px;
  font-weight: 500;
  overflow: hidden;
}
.bb-panel-avatar img { width: 100%; height: 100%; object-fit: cover; }
.bb-panel-name { flex: 1; font-size: 14px; }
.bb-panel-item.bb-added .bb-panel-name { color: #9499a0; }
.bb-panel-plus {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 24px;
  height: 24px;
  border: 1px solid #fb7299;
  border-radius: 50%;
  color: #fb7299;
  font-size: 16px;
  line-height: 1;
}
.bb-panel-item:hover .bb-panel-plus { background: #fb7299; color: #fff; }
.bb-panel-item.bb-added .bb-panel-plus { border-color: #e3e5e7; color: #b4b2a9; background: transparent; }
.bb-panel-empty { padding: 48px 12px; text-align: center; color: #9499a0; }
.bb-panel-footer {
  padding: 12px 22px;
  border-top: 1px solid #e3e5e7;
  color: #9499a0;
  font-size: 12px;
}
`;function Yt(){if(!F?.isConnected&&(F=document.getElementById(Dt),!F)){let e=document.head??document.documentElement;if(!e)return;F=document.createElement(`style`),F.id=Dt,F.textContent=Jt,e.appendChild(F)}}function Xt(){F?.remove(),F=null}function Zt(e){let t=qt(e);return!t||t===Vt?!1:j.hidden.some(e=>t===e||t.startsWith(`${e}/`))}function Qt(){let e=Y();return e.find(e=>e.getClientRects().length>0)??e[0]}function $t(){let e=Qt();if(!e)return 0;let t=e.querySelector(`.left-entry-main`)??e;return Array.from(t.querySelectorAll(A)).filter(e=>!Zt(e)).length+t.querySelectorAll(`.${T}`).length}function en(){c({hidden:[...j.hidden],channels:j.channels.map(e=>({...e}))})}function tn(e){let t=Bt.get(e);if(t)return t;let n=Array.from(e.querySelectorAll(A)),r=n.find(e=>{if(J(e))return!1;let t=q(e);return!!t&&!!t.querySelector(`.trigger-text`)})??n.find(e=>!J(e)&&!!q(e));if(!r)return null;let i=r.cloneNode(!0),a=q(i);if(a){let e=a.querySelector(`.trigger-text`);Array.from(a.children).forEach(t=>{t!==e&&t.remove()})}return Array.from(i.children).forEach(e=>{e!==a&&e.remove()}),i.classList.remove(O,Ot),delete i.dataset.bbSig,i.style.display=``,Bt.set(e,i),i}function nn(e,t){let n=tn(t),r=n?n.cloneNode(!0):(()=>{let e=document.createElement(`div`);e.className=`v-popover-wrap left-entry__item`;let t=document.createElement(`a`);t.className=`left-entry__item-trigger`,t.target=`_blank`;let n=document.createElement(`span`);return n.className=`trigger-text`,t.appendChild(n),e.appendChild(t),e})();r.classList.add(Ot,T),r.style.display=``;let i=q(r);if(i){i.setAttribute(`href`,e.href),i.setAttribute(`target`,`_blank`);let t=i.querySelector(`.trigger-text`)??i;t.textContent=e.name}return r}function Y(){let e=[],t=n=>{n.querySelectorAll(Lt).forEach(t=>e.push(t)),n.querySelectorAll(`*`).forEach(e=>{e.shadowRoot&&t(e.shadowRoot)})};return t(document),e}function rn(e){if(!e.isConnected)return;cn(e);let t=e.querySelector(`.left-entry-main`)??e,n=`${+!!P}|${j.hidden.join(`,`)}|${j.channels.map(e=>K(e.href)).join(`,`)}`;if(t.dataset.bbSig===n)return;t.dataset.bbSig=n,t.querySelectorAll(`.${T}, .${E}, .${D}`).forEach(e=>e.remove());let r=Array.from(t.querySelectorAll(A));for(let e of r)if(e.classList.toggle(O,P),e.style.display=Zt(e)?`none`:``,P&&!J(e)){let t=document.createElement(`span`);t.className=E,t.textContent=`×`,t.title=`删除该导航项`,e.appendChild(t)}for(let e of j.channels){let n=nn(e,t);if(n.classList.toggle(O,P),P){let e=document.createElement(`span`);e.className=E,e.textContent=`×`,e.title=`删除该频道`,n.appendChild(e)}t.appendChild(n)}if(P){let e=document.createElement(`span`);e.className=D,e.textContent=`+`,e.title=`添加频道`,t.appendChild(e)}e.classList.toggle(O,P)}function X(){for(let e of Y())rn(e)}function an(){let e=Y();return e.length?e.map(e=>{let t=e.querySelector(`.left-entry-main`)??e;return Array.from(t.querySelectorAll(A)).map(e=>K(q(e)?.getAttribute(`href`)??``)).join(`|`)}).join(`||`):``}function on(){return W||document.documentElement.getAttribute(Nt)===`1`}function sn(){if(!M||!N||!on())return;let e=an();if(!e){z=``;return}if(e!==z){z=e,Rt=Date.now();return}let t=W?jt:At;Date.now()-Rt<t||X()}function cn(e){if(e.dataset.bbBound===`1`)return;e.dataset.bbBound=`1`;let t=G?.signal;e.addEventListener(`pointerdown`,t=>{if(!M)return;let n=t.target;if(n.closest(`.${E}, .${D}`))return;let r=n.closest(k);r&&e.contains(r)&&(zt={x:t.clientX,y:t.clientY},window.clearTimeout(B),B=window.setTimeout(()=>{B=void 0,M&&(P&&J(r)?dn():un())},kt))},{signal:t});let n=()=>{window.clearTimeout(B),B=void 0};e.addEventListener(`pointerup`,n,{signal:t}),e.addEventListener(`pointercancel`,n,{signal:t}),e.addEventListener(`pointerleave`,n,{signal:t}),e.addEventListener(`pointermove`,e=>{B!==void 0&&(Math.abs(e.clientX-zt.x)>8||Math.abs(e.clientY-zt.y)>8)&&n()},{signal:t}),e.addEventListener(`click`,e=>{if(!M)return;let t=e.target,n=t.closest(`.${E}`);if(n){e.preventDefault(),e.stopPropagation();let t=n.closest(k);t&&ln(t)}else if(t.closest(`.${D}`))e.preventDefault(),e.stopPropagation(),hn();else if(P){let n=t.closest(k);n&&(e.preventDefault(),e.stopPropagation(),J(n)&&dn())}},{signal:t})}function ln(e){if(!J(e)){if(e.classList.contains(T)){let t=q(e),n=t?K(t.getAttribute(`href`)??``):``;j.channels=j.channels.filter(e=>K(e.href)!==n)}else{let t=qt(e);t&&!j.hidden.includes(t)&&j.hidden.push(t)}en(),X(),I&&Q()}}function Z(e){P&&(e.target.closest(`${Lt}, #${w}`)||(e.preventDefault(),e.stopPropagation(),dn()))}function un(){M&&!P&&(P=!0,Yt(),document.addEventListener(`click`,Z,!0),X(),a.info(`nav-customizer: edit mode on`))}function dn(){P&&(P=!1,document.removeEventListener(`click`,Z,!0),gn(),X(),a.info(`nav-customizer: edit mode off`))}var fn=[`#fb7299`,`#f5a623`,`#23c2a0`,`#5b8ff9`,`#9b7bf0`,`#f2764c`,`#4dc4d8`,`#e0628f`,`#7bb13c`,`#b07be0`];function pn(e){let t=0;for(let n=0;n<e.length;n+=1)t=t*31+e.charCodeAt(n)>>>0;return fn[t%fn.length]}function mn(){if(I?.isConnected)return I;if(I=document.getElementById(w),!I){I=document.createElement(`div`),I.id=w;let e=document.createElement(`div`);e.className=`bb-panel-head`;let t=document.createElement(`div`),n=document.createElement(`div`);n.className=`bb-panel-title`,n.textContent=`添加频道`;let r=document.createElement(`span`);r.className=`bb-panel-count`,n.appendChild(r);let i=document.createElement(`div`);i.className=`bb-panel-subtitle`,i.textContent=`选择一个频道添加到顶部导航`,t.append(n,i);let a=document.createElement(`span`);a.className=`bb-panel-close`,a.textContent=`×`,a.title=`关闭`,a.addEventListener(`click`,e=>{e.stopPropagation(),gn()}),e.append(t,a);let o=document.createElement(`div`);o.className=`bb-panel-search`,o.innerHTML=`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9499a0" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/></svg>`;let s=document.createElement(`input`);s.type=`text`,s.placeholder=`搜索频道`,s.value=L,s.addEventListener(`input`,()=>{L=s.value.trim(),Q()}),o.appendChild(s);let c=document.createElement(`div`);c.className=`bb-panel-list`;let l=document.createElement(`div`);l.className=`bb-panel-footer`,l.textContent=`导航最多显示 10 项（含原生菜单）`,I.append(e,o,c,l),document.body.appendChild(I)}return I}function Q(){let t=mn(),n=t.querySelector(`.bb-panel-list`),r=t.querySelector(`.bb-panel-count`),i=$t();r.textContent=`${i}/10`,n.replaceChildren();let o=Kt(),s=o.length?o:e;a.info(`nav-customizer: channels from ${o.length?`header DOM (${o.length}): ${o.slice(0,6).map(e=>e.name).join(`、`)}…`:`builtin list`}`);let c=L?s.filter(e=>e.name.toLowerCase().includes(L.toLowerCase())):s;if(!c.length){let e=document.createElement(`div`);e.className=`bb-panel-empty`,e.textContent=L?`没有匹配的频道`:`暂无可添加的频道`,n.appendChild(e);return}let l=i>=10;for(let e of c){let t=j.channels.some(t=>K(t.href)===K(e.href)),r=document.createElement(`div`);r.className=`bb-panel-item${t||l?` bb-added`:``}`;let i=document.createElement(`span`);if(i.className=`bb-panel-avatar`,e.icon){let t=document.createElement(`img`);t.src=e.icon,t.alt=``,i.appendChild(t)}else i.style.background=pn(e.name),i.textContent=e.name.slice(0,1);let a=document.createElement(`span`);a.className=`bb-panel-name`,a.textContent=e.name;let o=document.createElement(`span`);o.className=`bb-panel-plus`,o.textContent=t?`✓`:`+`,r.append(i,a,o),!t&&!l&&r.addEventListener(`click`,t=>{t.stopPropagation(),$t()>=10||(j.channels.push({name:e.name,href:e.href}),en(),X()),Q()}),n.appendChild(r)}}function hn(){L=``;let e=mn(),t=e.querySelector(`.bb-panel-search input`);t&&(t.value=``),Q();let n=e.getBoundingClientRect();e.style.top=`${Math.max(12,Math.min(100,(window.innerHeight-n.height)/2))}px`,e.style.left=`${Math.max(12,(window.innerWidth-n.width)/2)}px`}function gn(){I?.remove(),I=null}function $(){if(M&&!N){N=!0,window.clearTimeout(U),U=void 0,Yt(),G=new AbortController;for(let e of Y())cn(e);z=``,Rt=Date.now()-At,R=window.setInterval(sn,300),sn(),a.info(`nav-customizer: dom ready (${W?`fallback`:`vue signal`})`)}}function _n(){H=()=>$(),document.addEventListener(Pt,H),document.documentElement.getAttribute(Nt)===`1`?$():(chrome.runtime.sendMessage({type:Ft,file:It}).catch(e=>{a.warn(`vue-ready injection request failed`,e)}),U=window.setTimeout(()=>{U=void 0,N||(W=!0,a.warn(`nav-customizer: vue-ready signal timeout, using fallback window`),$())},Mt))}function vn(){gn();for(let e of Y()){e.classList.remove(O),delete e.dataset.bbBound;let t=e.querySelector(`.left-entry-main`)??e;delete t.dataset.bbSig,t.querySelectorAll(`.${T}, .${E}, .${D}`).forEach(e=>e.remove()),t.querySelectorAll(k).forEach(e=>{e.classList.remove(O),e.style.display=``})}Xt()}var yn=[{id:`navCustomizer`,name:`顶部导航自定义`,description:`长按菜单进入编辑，可删除或添加菜单（总数最多 10 项）`,enabledByDefault:!1,async start(){M=!0;let e=await s();j={hidden:[...e.navCustomizer.hidden],channels:e.navCustomizer.channels.map(e=>({...e}))},W=!1,_n(),V=(e,t)=>{if(!M||t!==`sync`||!e.settings)return;let n=e.settings.newValue;n&&(j={hidden:[...n.navCustomizer.hidden],channels:n.navCustomizer.channels.map(e=>({...e}))},N&&X())},chrome.storage.onChanged.addListener(V),a.info(`nav-customizer: started`)},stop(){M=!1,P=!1,N=!1,window.clearTimeout(B),B=void 0,G?.abort(),G=null,R!==void 0&&(window.clearInterval(R),R=void 0),z=``,window.clearTimeout(U),U=void 0,H&&=(document.removeEventListener(Pt,H),null),document.removeEventListener(`click`,Z,!0),V&&=(chrome.storage.onChanged.removeListener(V),null),j={hidden:[],channels:[]},c({hidden:[],channels:[]}),vn(),a.info(`nav-customizer: stopped and reset`)}}];ne(),Et(),we(),Ge();async function bn(e){try{await e.start(),a.info(`feature started: ${e.id}`)}catch(t){a.error(`feature failed: ${e.id}`,t)}}async function xn(){let e=await s();for(let t of yn)e.features[t.id]&&await bn(t)}chrome.storage.onChanged.addListener((e,t)=>{if(t!==`sync`||!e.settings)return;let n=e.settings.oldValue,r=e.settings.newValue;if(n&&r)for(let e of yn){let t=n.features[e.id],i=r.features[e.id];t!==i&&(i?bn(e):e.stop?.())}}),xn()})();