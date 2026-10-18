/* 尖塔档案 · 前端应用 */
(() => {
  'use strict';
  const D = window.STS_DATA;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const app = $('#app');
  const esc = (s = '') => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const attr = (s = '') => esc(s).replace(/`/g, '&#96;');
  const cardById = new Map(D.cards.map(c => [c.id, c]));
  const relicById = new Map(D.relics.map(r => [r.id, r]));
  const enemyById = new Map(D.enemies.map(e => [e.id, e]));
  const guideById = new Map(D.guides.map(g => [g.id, g]));
  const potionById = new Map(D.potions.map(p => [p.id, p]));
  const colorOrder = ['RED','GREEN','BLUE','PURPLE','COLORLESS','CURSE'];
  const tierOrder = ['STARTER','COMMON','UNCOMMON','RARE','BOSS','SHOP','SPECIAL'];
  const state = {
    cards: { color:'ALL', type:'ALL', rarity:'ALL', q:'', showUp:false, limit:9999 },
    relics: { tier:'ALL', q:'', limit:30 },
    enemies: { act:'ALL', kind:'ALL', q:'', limit:12 },
    potions: { rarity:'ALL', q:'', limit:15 },
    guides: { cat:'ALL' }
  };
  let searchItems = [];
  let searchIndex = -1;
  let lastFocused = null;
  let articleObserver = null;
  let revealObserver = null;
  let scrollTicking = false;

  const colorVar = { red:'var(--red)', green:'var(--green)', blue:'var(--blue)', purple:'var(--purple)', colorless:'var(--colorless)', curse:'var(--curse)' };
  const colorHex = { red:'#c46055', green:'#69a388', blue:'#6295c7', purple:'#9a7cbd', colorless:'#a8a49a', curse:'#966b82' };
  const energy = '<span class="energy-symbol">E</span>';

  /* ---------- helpers ---------- */
  function fmt(text = '') {
    return esc(text)
      .replace(/\[E\]/g, energy)
      .replace(/\[R\]/g, '<span class="energy-symbol" style="border-color:var(--red);color:var(--red)">R</span>')
      .replace(/\[G\]/g, '<span class="energy-symbol" style="border-color:var(--green);color:var(--green)">G</span>')
      .replace(/\[B\]/g, '<span class="energy-symbol" style="border-color:var(--blue);color:var(--blue)">B</span>')
      .replace(/\[W\]/g, '<span class="energy-symbol" style="border-color:var(--purple);color:var(--purple)">W</span>')
      .replace(/\n/g, '<br>');
  }
  function plain(text = '') { return String(text).replace(/\n/g, ' ').replace(/\s+/g, ' ').trim(); }
  function truncate(text = '', n = 70) { const t = plain(text); return t.length > n ? t.slice(0, n) + '…' : t; }
  function paramsFromHash() {
    const raw = location.hash.replace(/^#/, '') || '/';
    const [path, qs] = raw.split('?');
    return { path: path || '/', params: new URLSearchParams(qs || '') };
  }
  function route() {
    const raw = location.hash.replace(/^#/, '') || '/';
    const [path, qs] = raw.split('?');
    const parts = (path || '/').split('/').filter(Boolean);
    return { path: path || '/', parts, params: new URLSearchParams(qs || '') };
  }
  function setMeta(title) { document.title = title ? `${title} · 尖塔档案` : '尖塔档案 · 杀戮尖塔一代中文图鉴与攻略'; }
  function replaceHash(h){ try{ history.replaceState(null,'',h); }catch(e){ /* file:// fallback */ } }
  function dots(n, max = 5) {
    return `<span class="danger-dots" aria-label="威胁 ${n} / ${max}">${Array.from({length:max}, (_,i) => `<i class="${i<n?'on':''}"></i>`).join('')}</span>`;
  }
  function typeClass(t) { return t === '攻击' ? 'attack' : t === '技能' ? 'skill' : t === '能力' ? 'power' : 'other'; }
  function cardImage(c) { return c && c.art ? c.art : ''; }
  function guideLink(g) { return `#/guide/${g.id}`; }
  function sectionHead(eyebrow, title, desc, linkHref, linkText) {
    return `<div class="section-head reveal">
      <div><span class="eyebrow">${esc(eyebrow)}</span><h2>${title}</h2>${desc ? `<p>${desc}</p>` : ''}</div>
      ${linkHref ? `<a class="section-link" href="${linkHref}">${esc(linkText)} <span aria-hidden="true">→</span></a>` : ''}
    </div>`;
  }
  function cardTile(c) {
    const up = !!state.cards.showUp && c.upgradable !== false;
    const name = c.name + (up ? '+' : '');
    const cost = up ? c.upCostLabel : c.costLabel;
    const desc = up ? c.upDesc : c.desc;
    const quick = c.upgradable!==false ? `<button class="card-up-quick" type="button" data-open-card-up="${attr(c.id)}" aria-label="查看 ${attr(c.name)} 升级后">+</button>` : '';
    if (c.realArt) {
      const realImg = up ? (c.upRealArt || c.realArt) : c.realArt;
      return `<div class="card-tile-wrap">
        <button class="card-tile card-tile-real c-${c.colorKey}" type="button" data-open-card="${attr(c.id)}" data-card-version="${up?'up':'base'}" aria-label="查看卡牌 ${attr(name)}${up?'（升级后）':''}">
          <div class="real-thumb">
            <img src="${realImg}" alt="${attr(name)} 游戏卡面" loading="eager">
            
          </div>
        </button>
        ${quick}
      </div>`;
    }
    return `<div class="card-tile-wrap">
      <button class="card-tile card-tile-css c-${c.colorKey}" type="button" data-open-card="${attr(c.id)}" data-card-version="${up?'up':'base'}" aria-label="查看卡牌 ${attr(name)}${up?'（升级后）':''}">
        <div class="duo-frame" style="--card-accent:${colorHex[c.colorKey]}">
          <div class="duo-banner"><span class="duo-cost">${esc(cost)}</span><b>${esc(name)}</b></div>
          <div class="duo-art"><img src="${cardImage(c)}" alt="${attr(name)} 卡面" loading="lazy"></div>
          <div class="duo-type">${esc(c.typeName)}</div>
          <div class="duo-text">${fmt(desc)}</div>
          <div class="duo-rarity">${esc(c.rarityName)}</div>
        </div>
      </button>
      ${quick}
    </div>`;
  }
  function relicTile(r) {
    return `<button class="relic-tile" type="button" data-open-relic="${attr(r.id)}" aria-label="查看遗物 ${attr(r.name)}">
      <div class="relic-icon"><img src="${r.icon || ''}" alt="${attr(r.name)} 图标" loading="lazy"></div>
      <div class="relic-body">
        <div class="relic-top"><h3>${esc(r.name)}</h3><span>${esc(r.tierName)}</span></div>
        <p>${esc(truncate(r.desc, 74))}</p>
        <div class="relic-flavor">${esc(truncate(r.flavor, 46))}</div>
      </div>
    </button>`;
  }
  function enemyAccent(e) {
    if (e.kind === 'boss') return '#c46055';
    if (e.kind === 'elite') return '#b98a52';
    return e.act === 1 ? '#b17858' : e.act === 2 ? '#688a9e' : e.act === 3 ? '#7b6396' : '#a34f4f';
  }
  function enemyCard(e) {
    return `<button class="enemy-card act-${e.act} kind-${e.kind}" type="button" data-open-enemy="${attr(e.id)}" aria-label="查看敌人 ${attr(e.name)}">
      <div class="enemy-visual">
        <span class="enemy-badge">${esc(e.actName)} · ${esc(e.kindName)}</span>
        ${(e.image || e.icon) ? `<img class="enemy-icon" src="${e.image || e.icon}" alt="${attr(e.name)}" loading="lazy">` : `<span class="enemy-mark">${esc(e.mark)}</span>`}
        <span class="enemy-hp"><b>${esc(e.hp)}</b> HP</span>
      </div>
      <div class="enemy-card-body">
        <h3>${esc(e.name)}</h3>
        <div class="en">${esc(e.en)}</div>
        <p>${esc(truncate(e.threat, 62))}</p>
        <div class="enemy-foot">
          <div class="enemy-tags"><span>${esc(e.kindName)}</span><span>${e.moves.length} 种意图</span></div>
          ${dots(e.danger)}
        </div>
      </div>
    </button>`;
  }
  function guideCard(g, i) {
    return `<a class="guide-card reveal" href="${guideLink(g)}" style="transition-delay:${Math.min(i,5)*.05}s">
      <div class="guide-card-cover">
        ${g.cover ? `<img src="${g.cover}" alt="" loading="lazy">` : ''}
        <span class="num">${String(i+1).padStart(2,'0')}</span>
        <span class="cat">${esc(g.category)}</span>
      </div>
      <div class="guide-card-body">
        <h3>${esc(g.title)}</h3>
        <p>${esc(g.excerpt)}</p>
        <div class="guide-card-foot"><span>${esc(g.level)} · ${esc(g.read)}</span><span class="arrow">→</span></div>
      </div>
    </a>`;
  }

  /* ---------- home ---------- */
  function renderHome() {
    setMeta('');
    const fan = ['Bludgeon','Grand Finale','Electrodynamics','Ragnarok'].map(id => cardById.get(id)).filter(Boolean);
    const classGuides = ['ironclad','silent','defect','watcher'].map(id => D.heroes.find(h => h.id === id));
    const feature = guideById.get('ascension');
    const minis = ['beginner','ironclad','boss'].map(id => guideById.get(id)).filter(Boolean);
    const bosses = D.enemies.filter(e => e.kind === 'boss');
    const shelfNames = ['锚','异蛇之眼','符文金字塔','枯木树枝','香炉','化学物X'];
    const shelf = shelfNames.map(n => D.relics.find(r => r.name === n)).filter(Boolean);
    const potionShelf = ['瓶中精灵','罐装幽灵','异蛇之油','仙馔密酒','果汁','烟雾弹'].map(n => D.potions.find(p => p.name === n)).filter(Boolean);
    const routes = [
      { roman:'I', title:'塔底', sub:'ACT ONE · 生存优先', tag:'目标：做出第一张核心牌',
        items:['前 3 场普通战优先拿稳定输出，而不是「未来可期」的拼图。','第一个营火升级核心牌；血量 70% 以上再考虑精英。','Boss 前检查 AoE、状态牌处理与一瓶保命药水。'] },
      { roman:'II', title:'城市', sub:'ACT TWO · 卡组成型', tag:'目标：补齐过牌与防御',
        items:['开始删打击，把牌库压到 25 张以内。','精英遗物很强，但连续精英会拖垮血量。','商店优先删牌与关键遗物，不要把钱留到第三层。'] },
      { roman:'III', title:'深处', sub:'ACT THREE · 寻找上限', tag:'目标：为双 Boss 与心脏做准备',
        items:['确认你的成长引擎：力量、毒、球、姿态，必须有一个。','准备人工制品/无实体/稳定格挡应对心脏。','药水与爆发留给第二个 Boss，不要在第一个 Boss 全交。'] }
    ];
    app.innerHTML = `
      <section class="home-hero">
        <div class="hero-halo" aria-hidden="true"></div>
        <div class="hero-tower-lines" aria-hidden="true">
          <svg viewBox="0 0 700 900" fill="none" preserveAspectRatio="xMidYMid slice">
            <g stroke="rgba(201,164,92,.18)" stroke-width="1">
              <path d="M420 900 420 120M470 900 470 80M520 900 520 150M570 900 570 60M620 900 620 200"/>
              <path d="M350 900 350 260M330 900 330 340M310 900 310 430"/>
              <path d="M280 900 680 0M330 900 730 0M230 900 630 0" opacity=".5"/>
            </g>
            <g fill="rgba(201,164,92,.5)">
              <circle cx="420" cy="230" r="2"/><circle cx="470" cy="160" r="2"/><circle cx="520" cy="300" r="2"/><circle cx="570" cy="210" r="2"/><circle cx="620" cy="380" r="2"/>
            </g>
          </svg>
        </div>
        <div class="container hero-grid">
          <div class="hero-copy">
            <span class="eyebrow reveal">SLAY THE SPIRE · 1.0 ARCHIVE</span>
            <h1 class="hero-title reveal reveal-delay-1">向上，<br><em>直到心脏停跳</em><span class="dot">。</span></h1>
            <p class="hero-lede reveal reveal-delay-2">这里没有「必赢」的卡组，只有更好的选择。<strong>367 张卡牌、179 件遗物、42 瓶药水、41 个敌人</strong>，以及从中文社区整理而来的爬塔经验——把每一次抓牌、每一条路线、每一瓶药水，都变成你的优势。</p>
            <div class="hero-actions reveal reveal-delay-3">
              <a class="btn btn-primary" href="#/guide/beginner">从新手攻略开始 <span aria-hidden="true">→</span></a>
              <a class="btn btn-ghost" href="#/cards">打开卡牌图鉴 <span aria-hidden="true">↗</span></a>
            </div>
            <div class="hero-stats reveal reveal-delay-3">
              <div class="hero-stat"><b data-count="${D.meta.cards}">${D.meta.cards}</b><span>卡牌</span></div>
              <div class="hero-stat"><b data-count="${D.meta.relics}">${D.meta.relics}</b><span>遗物</span></div>
              <div class="hero-stat"><b data-count="${D.meta.potions}">${D.meta.potions}</b><span>药水</span></div>
              <div class="hero-stat"><b data-count="${D.meta.enemies}">${D.meta.enemies}</b><span>敌人</span></div>
              <div class="hero-stat"><b data-count="${D.meta.guides}">${D.meta.guides}</b><span>攻略</span></div>
            </div>
          </div>
          <div class="hero-visual reveal reveal-delay-1" aria-hidden="true">
            <div class="fan-stage">
              <span class="orbit"></span>
              ${fan.map(c => `<div class="fan-card"><div class="fan-art"><img src="${cardImage(c)}" alt=""><span class="fan-cost">${esc(c.costLabel)}</span></div><div class="fan-name"><b>${esc(c.name)}</b><span>${esc(c.colorName)}</span></div></div>`).join('')}
              <span class="fan-caption">ASCEND · ADAPT · ASCEND</span>
            </div>
          </div>
        </div>
        <span class="hero-scroll">SCROLL TO CLIMB</span>
      </section>

      <div class="marquee-strip" aria-hidden="true"><div class="marquee-inner">${Array.from({length:2},()=>`<span>IRONCLAD <i></i> THE SILENT <i></i> DEFECT <i></i> WATCHER <i></i> 367 CARDS <i></i> 179 RELICS <i></i> ASCENSION 20 <i></i></span>`).join('')}</div></div>

      <section class="section">
        <div class="container">
          ${sectionHead('CHOOSE YOUR CLIMBER','四位爬塔者，四种解题方式','每个职业都有自己的节奏与陷阱。先找到适合你的那一种，再谈进阶 20。','#/heroes','查看全部角色')}
          <div class="class-grid">
            ${classGuides.map((h,i) => `<a class="class-card ${h.color} reveal" href="#/guide/${h.id}" style="transition-delay:${i*.08}s">
              <div class="class-card-bg" style="background-image:url('${h.art}')"></div>
              <div class="class-card-shade"></div>
              <div class="class-card-top"><span class="class-num">0${i+1} / ${esc(h.en)}</span><span class="class-sigil">${['战','影','机','观'][i]}</span></div>
              <div class="class-card-content">
                <h3>${esc(h.name)} <small>${esc(h.en)}</small></h3>
                <p>${esc(h.tagline)}</p>
                <div class="class-meta"><span>${h.hp} HP</span><span>${h.energy} 能量</span><span class="diff" aria-label="难度 ${h.difficulty}">${Array.from({length:5},(_,x)=>`<i class="${x<h.difficulty?'on':''}"></i>`).join('')}</span></div>
              </div>
              <span class="hover-go">↗</span>
            </a>`).join('')}
          </div>
        </div>
      </section>

      <section class="section">
        <div class="container">
          ${sectionHead('FIELD NOTES','先读攻略，再进高塔','九篇从入门到进阶 20 的实战笔记。不是卡牌百科的复述，而是告诉你「什么时候该做什么」。','#/guides','全部攻略')}
          <div class="feature-grid">
            <a class="feature-main reveal" href="${guideLink(feature)}">
              <div class="feature-main-bg" style="background-image:url('${feature.cover}')"></div>
              <span class="corner">FEATURED · 01</span>
              <div class="feature-main-body">
                <span class="eyebrow">${esc(feature.category)} · ${esc(feature.read)}</span>
                <h3>${esc(feature.title)}</h3>
                <p>${esc(feature.excerpt)}</p>
                <div class="guide-meta"><span>${esc(feature.level)}</span><span>${feature.sections.length} 个章节</span><span>阅读 →</span></div>
              </div>
            </a>
            <div class="feature-side">
              ${minis.map((g,i) => `<a class="feature-mini reveal" href="${guideLink(g)}" style="transition-delay:${i*.07}s">
                <div class="feature-mini-img"><img src="${g.cover}" alt="" loading="lazy"></div>
                <div class="feature-mini-body"><span class="cat">${esc(g.category)} · ${esc(g.read)}</span><h4>${esc(g.title)}</h4><p>${esc(g.excerpt)}</p><span class="read">${esc(g.level)} · 阅读 →</span></div>
              </a>`).join('')}
            </div>
          </div>
        </div>
      </section>

      <section class="section route-section">
        <div class="container">
          ${sectionHead('THE ASCENT','三层路线，三种节奏','同一套牌，在不同的楼层要做不同的事。把资源放在正确的阶段，胜率会自己上涨。','#/guide/beginner','读路线基础')}
          <div class="route-grid">
            ${routes.map((r,i) => `<div class="route-card reveal" style="transition-delay:${i*.08}s">
              <span class="route-dot"></span><span class="roman">${r.roman}</span>
              <h3>${esc(r.title)}</h3><div class="sub">${esc(r.sub)}</div>
              <ul class="route-list">${r.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
              <span class="route-tag">${esc(r.tag)}</span>
            </div>`).join('')}
          </div>
        </div>
      </section>

      <section class="section">
        <div class="container">
          ${sectionHead('THREAT ARCHIVE','十位 Boss，十道必答题','从史莱姆老大的分裂到腐化之心的死亡律动，先看懂机制，再谈输出。','#/enemies','进入敌人档案')}
          <div class="boss-strip-wrap">
            <div class="boss-strip">
              ${bosses.map(e => `<button class="boss-pill" type="button" data-open-enemy="${attr(e.id)}">
                ${(e.image || e.icon) ? `<img src="${e.image || e.icon}" alt="${attr(e.name)}" loading="eager" decoding="async">` : `<span class="enemy-mark">${esc(e.mark)}</span>`}
                <b>${esc(e.name)}</b><span>${esc(e.actName)} · ${esc(e.hp)} HP</span>${dots(e.danger)}
              </button>`).join('')}
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="container">
          ${sectionHead('RELIC VAULT','遗物不是收藏品，是决策','同一件遗物，在不同卡组里价值完全不同。先看效果，再看它能不能改变你的打法。','#/relics','打开遗物档案')}
          <div class="relic-shelf">
            ${shelf.map((r,i) => `<button class="shelf-relic reveal" type="button" data-open-relic="${attr(r.id)}" style="transition-delay:${i*.05}s">
              <span class="icon"><img src="${r.icon || ''}" alt="" loading="lazy"></span>
              <b>${esc(r.name)}</b><span>${esc(r.tierName)}</span><p>${esc(truncate(r.desc, 42))}</p>
            </button>`).join('')}
          </div>
        </div>
      </section>

      <section class="section">
        <div class="container">
          ${sectionHead('POTION CABINET','药水不是备胎，是第五张手牌','一瓶药水就是一个回合、一条命、一次翻盘。先认清药水，再决定什么时候喝。','#/potions','打开药水柜')}
          <div class="potion-shelf">
            ${potionShelf.map((p,i)=>`<button class="shelf-potion reveal" type="button" data-open-potion="${attr(p.id)}" style="--potion:${p.colorHex};transition-delay:${i*.05}s">
              <span class="potion-orb"><img src="${p.icon}" alt="" loading="lazy"></span>
              <b>${esc(p.name)}</b><span>${esc(p.rarityName)}</span><p>${esc(truncate(p.desc,42))}</p>
            </button>`).join('')}
          </div>
        </div>
      </section>

      <section class="section section-tight">
        <div class="container">
          <div class="cta-panel reveal">
            <span class="cta-mark">THE SPIRE AWAITS</span>
            <h2>下一层，永远有新的答案。</h2>
            <p>把这份档案带在身边。下一次抓牌、下一次营火、下一次面对心脏时，你会知道该怎么做。</p>
            <div class="cta-actions"><a class="btn btn-primary" href="#/guides">继续阅读攻略 <span aria-hidden="true">→</span></a><a class="btn btn-ghost" href="#/about">资料与来源</a></div>
          </div>
        </div>
      </section>`;
    initReveal();
  }

  /* ---------- heroes page ---------- */
  function renderHeroes() {
    setMeta('角色档案');
    app.innerHTML = `
      <section class="page-hero">
        <div class="container page-hero-inner">
          <div>
            <span class="eyebrow">THE FOUR CLIMBERS</span>
            <h1>选择你的<em>爬塔者</em></h1>
            <p>他们不是四个皮肤，而是四套完全不同的资源系统。先理解职业的核心机制，再决定第一张牌拿什么。</p>
          </div>
          <div class="page-hero-side">
            <div class="page-stat"><b>4</b><span>可玩角色</span></div>
            <div class="page-stat"><b>300</b><span>职业卡牌</span></div>
            <div class="page-stat"><b>A20</b><span>进阶上限</span></div>
          </div>
        </div>
      </section>
      <div class="page-body">
        <div class="container">
          <div class="climber-nav">
            ${D.heroes.map(h => `<button type="button" data-scroll="hero-${h.id}" style="--dot:${colorVar[h.color]}"><span class="dot"></span><span><b>${esc(h.name)}</b><small>${esc(h.en)}</small></span></button>`).join('')}
          </div>
          ${D.heroes.map((h,idx) => {
            const guide = guideById.get(h.id);
            return `<section class="climber" id="hero-${h.id}" style="--accent:${colorVar[h.color]}">
              <div class="climber-sticky">
                <div class="climber-art">
                  <img src="${h.art}" alt="${attr(h.name)} 角色立绘" loading="lazy">
                  <span class="art-num">0${idx+1} / 04</span>
                  <div class="art-label"><span>${esc(h.en)}</span><b>${esc(h.name)}</b></div>
                </div>
                <div class="climber-side-meta">
                  <div><span>初始生命</span><b>${h.hp} HP</b></div>
                  <div><span>初始能量</span><b>${h.energy} / 回合</b></div>
                  <div><span>初始遗物</span><b>${esc(h.starterRelic)}</b></div>
                  <div><span>上手难度</span><b>${['入门','入门','进阶','大师'][idx]}</b></div>
                </div>
              </div>
              <div class="climber-main">
                <div class="climber-head">
                  <div><h2><small>${esc(h.en)}</small>${esc(h.name)}</h2><p class="tagline">${esc(h.tagline)}</p></div>
                  <div class="climber-diff"><span>DIFFICULTY</span><div class="diff">${Array.from({length:5},(_,i)=>`<i class="${i<h.difficulty?'on':''}"></i>`).join('')}</div></div>
                </div>
                <p class="climber-intro">${esc(h.intro)}</p>
                <div class="climber-mechanic"><b>核心机制</b><p>${esc(h.mechanic)}</p></div>
                <div class="sw-grid">
                  <div class="sw-box"><h4>优势 / STRENGTHS</h4><ul>${h.strengths.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>
                  <div class="sw-box weak"><h4>短板 / WEAKNESSES</h4><ul>${h.weaknesses.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>
                </div>
                <div class="arch-grid">
                  ${h.archetypes.map((a,i)=>`<div class="arch-card">
                    <div class="arch-index">ROUTE 0${i+1}</div>
                    <h4>${esc(a.name)}</h4><p>${esc(a.summary)}</p>
                    <div class="keys">${a.keyCards.map(k=>`<span>${esc(k)}</span>`).join('')}</div>
                    <div class="win">胜利方式：${esc(a.win)}</div>
                  </div>`).join('')}
                </div>
                <div class="priority-list">
                  ${h.priorities.map(p=>`<div class="priority-item"><b>${esc(p.phase)}</b><p>${esc(p.text)}</p></div>`).join('')}
                </div>
                <div class="section-head" style="margin-bottom:14px"><div><span class="eyebrow" style="font-size:9px">SAMPLE DECK</span><h2 style="font-size:28px;margin-top:9px">一套可参考的 16 张样本</h2></div><a class="section-link" href="${guide ? guideLink(guide) : '#/guides'}">读 ${esc(h.name)} 攻略 →</a></div>
                <div class="deck-strip">
                  ${h.starterDeckFull.map(c=>`<button class="deck-card" type="button" data-open-card="${attr(c.id)}"><img src="${c.art}" alt="" loading="lazy"><i>${esc(c.cost)}</i><span>${esc(c.name)}</span></button>`).join('')}
                </div>
                <div class="climber-tip"><span class="mark">“</span><p>${esc(h.bossTips)}</p></div>
              </div>
            </section>`;
          }).join('')}
        </div>
      </div>`;
    initReveal();
    D.heroes.forEach(h=>{
      const el=document.getElementById('hero-'+h.id);
      if(el) enhanceMentions(el.querySelector('.climber-main'), h.color);
    });
  }

  /* ---------- cards page ---------- */
  function readCardState(params) {
    state.cards = {
      color: (params.has('color') ? (params.get('color') || 'ALL') : 'RED').toUpperCase(),
      type: (params.get('type') || 'ALL').toUpperCase(),
      rarity: (params.get('rarity') || 'ALL').toUpperCase(),
      q: params.get('q') || '',
      showUp: params.get('up') === '1',
      limit: 9999
    };
    if (!['ALL','RED','GREEN','BLUE','PURPLE','COLORLESS','CURSE'].includes(state.cards.color)) state.cards.color = 'ALL';
    if (!['ALL','ATTACK','SKILL','POWER','STATUS','CURSE'].includes(state.cards.type)) state.cards.type = 'ALL';
    if (!['ALL','BASIC','COMMON','UNCOMMON','RARE','SPECIAL','CURSE'].includes(state.cards.rarity)) state.cards.rarity = 'ALL';
  }
  function cardFilterCounts() {
    const counts = { ALL: D.cards.length };
    colorOrder.forEach(c => counts[c] = D.cards.filter(x => x.color === c).length);
    return counts;
  }
  function renderCards() {
    setMeta('卡牌图鉴');
    readCardState(route().params);
    const counts = cardFilterCounts();
    const typeOptions = [['ALL','全部类型'],['ATTACK','攻击'],['SKILL','技能'],['POWER','能力'],['STATUS','状态'],['CURSE','诅咒']];
    const rarityOptions = [['ALL','全部稀有度'],['BASIC','初始'],['COMMON','普通'],['UNCOMMON','罕见'],['RARE','稀有'],['SPECIAL','特殊'],['CURSE','诅咒']];
    app.innerHTML = `
      <section class="page-hero">
        <div class="container page-hero-inner">
          <div>
            <span class="eyebrow">CARD ARCHIVE · 367</span>
            <h1>卡牌<em>档案</em></h1>
            <p>全部 367 张可收集卡牌。默认展示铁甲战士，点「全部」查看全职业；每一张牌都可以查看游戏内卡面、基础/升级后效果与构筑点评。</p>
          </div>
          <div class="page-hero-side">
            <div class="page-stat"><b>${D.cards.length}</b><span>总卡牌</span></div>
            <div class="page-stat"><b>300</b><span>职业卡</span></div>
            <div class="page-stat"><b>53</b><span>无色卡</span></div>
            <div class="page-stat"><b>14</b><span>诅咒</span></div>
          </div>
        </div>
      </section>
      <section class="filter-bar">
        <div class="container">
          <div class="filter-row">
            <div class="filter-search">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="1.5"/><path d="m15.5 15.5 5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
              <input id="card-search" type="search" placeholder="搜索卡牌名 / 效果 / 关键词…" value="${attr(state.cards.q)}" autocomplete="off" spellcheck="false">
            </div>
            <div class="chips">
              ${[['ALL','全部'],['RED','铁甲战士'],['GREEN','静默猎手'],['BLUE','故障机器人'],['PURPLE','观者'],['COLORLESS','无色'],['CURSE','诅咒']].map(([k,label])=>`<button class="chip ${state.cards.color===k?'active':''}" type="button" data-card-filter="color" data-value="${k}">${k==='ALL'?'':`<span class="dot" style="--dot:${colorVar[k.toLowerCase()]}"></span>`}${label}<span class="count">${counts[k]}</span></button>`).join('')}
            </div>
            <div class="filter-meta"><span>显示 <b id="card-shown">0</b> / <b id="card-count">0</b> 张</span><button class="filter-all-btn" type="button" id="card-show-top" hidden>查看全部</button><button class="reset-btn" type="button" data-reset-cards>重置</button></div>
          </div>
          <div class="filter-row">
            <div class="select-wrap"><select id="card-type">${typeOptions.map(([v,l])=>`<option value="${v}" ${state.cards.type===v?'selected':''}>${l}</option>`).join('')}</select></div>
            <div class="select-wrap"><select id="card-rarity">${rarityOptions.map(([v,l])=>`<option value="${v}" ${state.cards.rarity===v?'selected':''}>${l}</option>`).join('')}</select></div>
            <button class="chip upgrade-chip ${state.cards.showUp?'active':''}" type="button" data-card-up-toggle>升级后 +</button>
            <div class="filter-meta" style="margin-left:0;font-size:10px">点击卡牌右上角「+」可直接查看升级后；数值为进阶 0 基础值</div>
          </div>
        </div>
      </section>
      <div class="catalog-body">
        <div class="container">
          <div class="card-grid" id="card-grid"></div>
          <div class="load-wrap" id="card-load-wrap"></div>
          <div class="catalog-note"><span>提示：点击卡牌可同时查看基础与升级后；右上角「+」可直接切到升级后。</span><span>特殊卡牌（如小刀、奇迹）与诅咒也收录在内。</span></div>
        </div>
      </div>`;
    renderCardGrid();
    initReveal();
  }
  function filteredCards() {
    const s = state.cards; const q = s.q.trim().toLowerCase();
    return D.cards.filter(c => {
      if (s.color !== 'ALL' && c.color !== s.color) return false;
      if (s.type !== 'ALL' && c.type !== s.type) return false;
      if (s.rarity !== 'ALL' && c.rarity !== s.rarity) return false;
      if (q) {
        const hay = [c.name, c.desc, c.colorName, c.typeName, c.rarityName, ...(c.tags||[])].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a,b) => colorOrder.indexOf(a.color) - colorOrder.indexOf(b.color) || (['BASIC','COMMON','UNCOMMON','RARE','SPECIAL','CURSE'].indexOf(a.rarity)-['BASIC','COMMON','UNCOMMON','RARE','SPECIAL','CURSE'].indexOf(b.rarity)) || ((a.cost<0?99:a.cost)-(b.cost<0?99:b.cost)) || a.name.localeCompare(b.name,'zh-Hans-CN'));
  }
  function syncLimitControl(kind,total,shown,defaultLimit,unit){
    const top=$('#'+kind+'-show-top');
    const se=$('#'+kind+'-shown'); if(se) se.textContent=shown;
    if(!top) return;
    if(total>shown){ top.hidden=false; top.dataset.showAll=kind; delete top.dataset.collapseList; top.textContent=`查看全部 ${total} ${unit}`; }
    else if(total>defaultLimit){ top.hidden=false; top.dataset.collapseList=kind; delete top.dataset.showAll; top.textContent='收起列表'; }
    else { top.hidden=true; }
  }
  function renderCardGrid() {
    const list = filteredCards();
    const shown = list.slice(0, state.cards.limit);
    const grid = $('#card-grid'); if (!grid) return;
    grid.innerHTML = shown.length ? shown.map(cardTile).join('') : `<div class="empty-state" style="grid-column:1/-1"><b>没有找到对应的卡牌</b><p>试试换一个关键词，或重置筛选条件。</p></div>`;
    const count = $('#card-count'); if (count) count.textContent = list.length;
    syncLimitControl('card',list.length,shown.length,9999,'张');
    const wrap = $('#card-load-wrap');
    if (wrap) wrap.innerHTML = list.length > shown.length ? `<button class="btn btn-ghost btn-small" type="button" data-show-all="cards">查看全部 ${list.length} 张</button>` : (list.length > 24 ? `<button class="btn btn-ghost btn-small" type="button" data-collapse-list="cards">收起列表</button>` : '');
    updateCardsURL();
  }
  function updateCardsURL() {
    const p = new URLSearchParams();
    p.set('color', state.cards.color === 'ALL' ? 'all' : state.cards.color.toLowerCase());
    if (state.cards.type !== 'ALL') p.set('type', state.cards.type.toLowerCase());
    if (state.cards.rarity !== 'ALL') p.set('rarity', state.cards.rarity.toLowerCase());
    if (state.cards.showUp) p.set('up', '1');
    if (state.cards.q.trim()) p.set('q', state.cards.q.trim());
    const qs = p.toString();
    replaceHash(`#/cards${qs ? '?' + qs : ''}`);
  }
  function syncCardChrome() {
    $$('[data-card-filter]').forEach(b => b.classList.toggle('active', b.dataset.value === state.cards.color));
    const t = $('#card-type'); if (t) t.value = state.cards.type;
    const r = $('#card-rarity'); if (r) r.value = state.cards.rarity;
    const u = $('[data-card-up-toggle]'); if (u) u.classList.toggle('active', !!state.cards.showUp);
  }

  /* ---------- relics page ---------- */
  function readRelicState(params) {
    state.relics = { tier:(params.has('tier') ? (params.get('tier')||'ALL') : 'COMMON').toUpperCase(), q:params.get('q')||'', limit:30 };
    if (!['ALL',...tierOrder].includes(state.relics.tier)) state.relics.tier = 'ALL';
  }
  function renderRelics() {
    setMeta('遗物档案');
    readRelicState(route().params);
    const counts = { ALL:D.relics.length };
    tierOrder.forEach(t => counts[t] = D.relics.filter(r=>r.tier===t).length);
    const tierLabels = { STARTER:'初始', COMMON:'普通', UNCOMMON:'罕见', RARE:'稀有', BOSS:'Boss', SHOP:'商店', SPECIAL:'事件 / 特殊' };
    app.innerHTML = `
      <section class="page-hero">
        <div class="container page-hero-inner">
          <div><span class="eyebrow">RELIC VAULT · 179</span><h1>遗物<em>档案</em></h1><p>179 件遗物，从初始遗物到事件专属。默认展示普通遗物，点「全部」查看完整遗物池。</p></div>
          <div class="page-hero-side"><div class="page-stat"><b>${D.relics.length}</b><span>总遗物</span></div><div class="page-stat"><b>30</b><span>Boss 遗物</span></div><div class="page-stat"><b>21</b><span>商店遗物</span></div><div class="page-stat"><b>18</b><span>事件遗物</span></div></div>
        </div>
      </section>
      <section class="filter-bar">
        <div class="container">
          <div class="filter-row">
            <div class="filter-search"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="1.5"/><path d="m15.5 15.5 5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg><input id="relic-search" type="search" placeholder="搜索遗物名 / 效果…" value="${attr(state.relics.q)}" autocomplete="off" spellcheck="false"></div>
            <div class="chips">${[['ALL','全部'],...tierOrder.map(t=>[t,tierLabels[t]])].map(([k,l])=>`<button class="chip ${state.relics.tier===k?'active':''}" type="button" data-relic-tier="${k}">${l}<span class="count">${counts[k]}</span></button>`).join('')}</div>
            <div class="filter-meta"><span>显示 <b id="relic-shown">0</b> / <b id="relic-count">0</b> 件</span><button class="filter-all-btn" type="button" id="relic-show-top" hidden>查看全部</button><button class="reset-btn" type="button" data-reset-relics>重置</button></div>
          </div>
        </div>
      </section>
      <div class="catalog-body"><div class="container"><div class="relic-grid" id="relic-grid"></div><div class="load-wrap" id="relic-load-wrap"></div><div class="catalog-note"><span>提示：点击遗物查看完整效果与获取阶段。</span><span>“事件 / 特殊”包含事件遗物与无尽模式头环。</span></div></div></div>`;
    renderRelicGrid();
    initReveal();
  }
  function filteredRelics() {
    const s = state.relics, q = s.q.trim().toLowerCase();
    return D.relics.filter(r => {
      if (s.tier !== 'ALL' && r.tier !== s.tier) return false;
      if (q && !([r.name,r.desc,r.flavor,r.tierName].join(' ').toLowerCase().includes(q))) return false;
      return true;
    }).sort((a,b)=>tierOrder.indexOf(a.tier)-tierOrder.indexOf(b.tier)||a.name.localeCompare(b.name,'zh-Hans-CN'));
  }
  function renderRelicGrid() {
    const list = filteredRelics(); const shown = list.slice(0, state.relics.limit);
    const grid = $('#relic-grid'); if (!grid) return;
    grid.innerHTML = shown.length ? shown.map(relicTile).join('') : `<div class="empty-state" style="grid-column:1/-1"><b>没有找到对应的遗物</b><p>试试换一个关键词，或重置筛选条件。</p></div>`;
    const c = $('#relic-count'); if (c) c.textContent = list.length;
    syncLimitControl('relic',list.length,shown.length,30,'件');
    const wrap = $('#relic-load-wrap'); if (wrap) wrap.innerHTML = list.length > shown.length ? `<button class="btn btn-ghost btn-small" type="button" data-show-all="relics">查看全部 ${list.length} 件</button>` : (list.length > 30 ? `<button class="btn btn-ghost btn-small" type="button" data-collapse-list="relics">收起列表</button>` : '');
    const p = new URLSearchParams(); p.set('tier',state.relics.tier==='ALL'?'all':state.relics.tier.toLowerCase()); if (state.relics.q.trim()) p.set('q',state.relics.q.trim());
    replaceHash(`#/relics${p.toString()?'?'+p.toString():''}`);
  }

  /* ---------- potions page ---------- */
  function readPotionState(params){
    state.potions={ rarity:(params.has('rarity') ? (params.get('rarity')||'ALL') : 'COMMON').toUpperCase(), q:params.get('q')||'', limit:15 };
    if(!['ALL','COMMON','UNCOMMON','RARE'].includes(state.potions.rarity)) state.potions.rarity='ALL';
  }
  function potionTile(p){
    return `<button class="potion-tile" type="button" data-open-potion="${attr(p.id)}" style="--potion:${p.colorHex}">
      <div class="potion-orb"><img src="${p.icon}" alt="${attr(p.name)}" loading="lazy"></div>
      <div class="potion-tile-body">
        <div class="potion-top"><h3>${esc(p.name)}</h3><span>${esc(p.rarityName)}</span></div>
        <p>${esc(truncate(p.desc,78))}</p>
        ${p.note?`<div class="potion-note">${esc(truncate(p.note,42))}</div>`:''}
      </div>
    </button>`;
  }
  function renderPotions(){
    setMeta('药水档案');
    readPotionState(route().params);
    const counts={ALL:D.potions.length,COMMON:0,UNCOMMON:0,RARE:0};
    D.potions.forEach(p=>{ if(counts[p.rarity]!==undefined) counts[p.rarity]++; });
    app.innerHTML=`
      <section class="page-hero">
        <div class="container page-hero-inner">
          <div><span class="eyebrow">POTION CABINET · ${D.potions.length}</span><h1>药水<em>档案</em></h1><p>药水不是收藏品，是第五张手牌。默认展示普通药水，点「全部」查看完整药水柜。</p></div>
          <div class="page-hero-side"><div class="page-stat"><b>${D.potions.length}</b><span>总药水</span></div><div class="page-stat"><b>${counts.COMMON}</b><span>普通</span></div><div class="page-stat"><b>${counts.UNCOMMON}</b><span>罕见</span></div><div class="page-stat"><b>${counts.RARE}</b><span>稀有</span></div></div>
        </div>
      </section>
      <section class="filter-bar"><div class="container">
        <div class="filter-row">
          <div class="filter-search"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="1.5"/><path d="m15.5 15.5 5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg><input id="potion-search" type="search" placeholder="搜索药水名 / 效果…" value="${attr(state.potions.q)}" autocomplete="off" spellcheck="false"></div>
          <div class="chips">${[['ALL','全部'],['COMMON','普通'],['UNCOMMON','罕见'],['RARE','稀有']].map(([k,l])=>`<button class="chip ${state.potions.rarity===k?'active':''}" type="button" data-potion-rarity="${k}">${l}<span class="count">${counts[k]}</span></button>`).join('')}</div>
          <div class="filter-meta"><span>显示 <b id="potion-shown">0</b> / <b id="potion-count">0</b> 瓶</span><button class="filter-all-btn" type="button" id="potion-show-top" hidden>查看全部</button><button class="reset-btn" type="button" data-reset-potions>重置</button></div>
        </div>
        <div class="filter-row"><div class="filter-meta" style="margin-left:0;font-size:10px">默认展示前 15 瓶；点击下方「查看全部」展开完整药水柜。</div></div>
      </div></section>
      <div class="catalog-body"><div class="container"><div class="potion-grid" id="potion-grid"></div><div class="load-wrap" id="potion-load-wrap"></div><div class="catalog-note"><span>提示：点击药水查看完整效果与使用建议。</span><span>药水图标由游戏内瓶子素材合成，仅作识别。</span></div></div></div>`;
    renderPotionGrid();
    initReveal();
  }
  function filteredPotions(){
    const s=state.potions,q=s.q.trim().toLowerCase();
    return D.potions.filter(p=>{
      if(s.rarity!=='ALL' && p.rarity!==s.rarity) return false;
      if(q && !([p.name,p.desc,p.rarityName,p.note].join(' ').toLowerCase().includes(q))) return false;
      return true;
    }).sort((a,b)=>({COMMON:0,UNCOMMON:1,RARE:2}[a.rarity]-{COMMON:0,UNCOMMON:1,RARE:2}[b.rarity]) || a.name.localeCompare(b.name,'zh-Hans-CN'));
  }
  function renderPotionGrid(){
    const list=filteredPotions(), shown=list.slice(0,state.potions.limit);
    const grid=$('#potion-grid'); if(!grid) return;
    grid.innerHTML=shown.length?shown.map(potionTile).join(''):`<div class="empty-state" style="grid-column:1/-1"><b>没有找到对应的药水</b><p>试试换一个关键词，或重置筛选条件。</p></div>`;
    const c=$('#potion-count'); if(c) c.textContent=list.length;
    syncLimitControl('potion',list.length,shown.length,15,'瓶');
    const wrap=$('#potion-load-wrap');
    if(wrap) wrap.innerHTML = list.length>shown.length ? `<button class="btn btn-ghost btn-small" type="button" data-show-all="potions">查看全部 ${list.length} 瓶</button>` : (list.length>15?`<button class="btn btn-ghost btn-small" type="button" data-collapse-list="potions">收起</button>`:'');
    const p=new URLSearchParams(); p.set('rarity',state.potions.rarity==='ALL'?'all':state.potions.rarity.toLowerCase()); if(state.potions.q.trim()) p.set('q',state.potions.q.trim());
    replaceHash(`#/potions${p.toString()?'?'+p.toString():''}`);
  }
  function openPotion(id){
    const p=potionById.get(id); if(!p) return;
    const related=D.potions.filter(x=>x.id!==p.id && x.rarity===p.rarity).slice(0,4);
    showModal(`<div class="modal-relic modal-potion" style="--potion:${p.colorHex}">
      <div class="modal-relic-visual"><div class="potion-orb big"><img src="${p.icon}" alt="${attr(p.name)}"></div><div class="tier">药水 · ${esc(p.rarityName)}</div></div>
      <div class="modal-relic-info">
        <div class="modal-kicker">POTION DOSSIER · ${esc(p.rarityName)}</div>
        <h2>${esc(p.name)}</h2>
        <div class="en">药水 · ${esc(p.rarityName)}</div>
        <div class="modal-relic-effect">${fmt(p.desc)}</div>
        ${p.note?`<div class="modal-note"><b>使用建议</b><p>${esc(p.note)}</p></div>`:''}
        <div class="modal-actions"><a class="btn btn-ghost btn-small" href="#/potions?rarity=${p.rarity.toLowerCase()}" data-close-modal>查看同稀有度药水</a></div>
        ${related.length?`<div class="modal-related"><h4>同稀有度</h4><div class="modal-related-list">${related.map(x=>`<button type="button" data-open-potion="${attr(x.id)}">${esc(x.name)}</button>`).join('')}</div></div>`:''}
      </div>
    </div>`);
  }

  /* ---------- enemies page ---------- */
  function readEnemyState(params) {
    state.enemies = { act:(params.has('act') ? (params.get('act')||'ALL') : '1').toUpperCase(), kind:(params.get('kind')||'ALL').toUpperCase(), q:params.get('q')||'', limit:12 };
    if (!['ALL','1','2','3','4'].includes(state.enemies.act)) state.enemies.act='ALL';
    if (!['ALL','NORMAL','ELITE','BOSS'].includes(state.enemies.kind)) state.enemies.kind='ALL';
  }
  function renderEnemies() {
    setMeta('敌人档案');
    readEnemyState(route().params);
    const acts = [['ALL','全部'],['1','塔底 I'],['2','城市 II'],['3','深处 III'],['4','终幕 IV']];
    const kinds = [['ALL','全部'],['NORMAL','普通'],['ELITE','精英'],['BOSS','Boss']];
    app.innerHTML = `
      <section class="page-hero">
        <div class="container page-hero-inner">
          <div><span class="eyebrow">THREAT ARCHIVE · 41</span><h1>敌人<em>档案</em></h1><p>从大颚虫到腐化之心。默认展示第一幕敌人，点「全部」查看完整威胁档案。</p></div>
          <div class="page-hero-side"><div class="page-stat"><b>${D.enemies.length}</b><span>敌人条目</span></div><div class="page-stat"><b>10</b><span>Boss</span></div><div class="page-stat"><b>9</b><span>精英</span></div><div class="page-stat"><b>4</b><span>幕</span></div></div>
        </div>
      </section>
      <section class="filter-bar">
        <div class="container">
          <div class="filter-row">
            <div class="filter-search"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="1.5"/><path d="m15.5 15.5 5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg><input id="enemy-search" type="search" placeholder="搜索敌人 / 意图 / 机制…" value="${attr(state.enemies.q)}" autocomplete="off" spellcheck="false"></div>
            <div class="chips">${acts.map(([v,l])=>`<button class="chip ${state.enemies.act===v?'active':''}" type="button" data-enemy-act="${v}">${l}</button>`).join('')}</div>
            <div class="filter-meta"><span>显示 <b id="enemy-shown">0</b> / <b id="enemy-count">0</b> 个</span><button class="filter-all-btn" type="button" id="enemy-show-top" hidden>查看全部</button><button class="reset-btn" type="button" data-reset-enemies>重置</button></div>
          </div>
          <div class="filter-row"><div class="chips">${kinds.map(([v,l])=>`<button class="chip ${state.enemies.kind===v?'active':''}" type="button" data-enemy-kind="${v}">${l}</button>`).join('')}</div><div class="filter-meta" style="margin-left:0;font-size:10px">生命值为进阶 0 基准；进阶会改变伤害、血量与部分行动。</div></div>
        </div>
      </section>
      <div class="catalog-body"><div class="container"><div class="enemy-grid" id="enemy-grid"></div><div class="load-wrap" id="enemy-load-wrap"></div><div class="catalog-note"><span>提示：点击敌人查看意图、机制与应对方式。</span><span>Boss 图标来自游戏内地图素材。</span></div></div></div>`;
    renderEnemyGrid();
    initReveal();
  }
  function filteredEnemies() {
    const s = state.enemies, q = s.q.trim().toLowerCase();
    return D.enemies.filter(e => {
      if (s.act !== 'ALL' && String(e.act) !== s.act) return false;
      if (s.kind !== 'ALL' && e.kind.toUpperCase() !== s.kind) return false;
      if (q && !([e.name,e.en,e.threat,e.tip,e.moves.join(' ')].join(' ').toLowerCase().includes(q))) return false;
      return true;
    }).sort((a,b)=>a.act-b.act || ({normal:0,elite:1,boss:2}[a.kind]-{normal:0,elite:1,boss:2}[b.kind]) || a.name.localeCompare(b.name,'zh-Hans-CN'));
  }
  function renderEnemyGrid() {
    const list = filteredEnemies();
    const grid = $('#enemy-grid'); if (!grid) return;
    const shown=list.slice(0,state.enemies.limit); grid.innerHTML = list.length ? shown.map(enemyCard).join('') : `<div class="empty-state" style="grid-column:1/-1"><b>没有找到对应的敌人</b><p>试试换一个关键词，或重置筛选条件。</p></div>`;
    const c = $('#enemy-count'); if (c) c.textContent = list.length;
    syncLimitControl('enemy',list.length,shown.length,12,'个');
    const wrap=$('#enemy-load-wrap'); if(wrap) wrap.innerHTML = list.length>list.slice(0,state.enemies.limit).length ? `<button class="btn btn-ghost btn-small" type="button" data-show-all="enemies">查看全部 ${list.length} 个</button>` : (list.length>12?`<button class="btn btn-ghost btn-small" type="button" data-collapse-list="enemies">收起列表</button>`:'');
    const p = new URLSearchParams(); p.set('act',state.enemies.act==='ALL'?'all':state.enemies.act); if (state.enemies.kind!=='ALL') p.set('kind',state.enemies.kind.toLowerCase()); if (state.enemies.q.trim()) p.set('q',state.enemies.q.trim());
    replaceHash(`#/enemies${p.toString()?'?'+p.toString():''}`);
  }

  /* ---------- guides page ---------- */
  function renderGuides() {
    setMeta('攻略');
    const cats = ['ALL',...Array.from(new Set(D.guides.map(g=>g.category)))];
    const feature = guideById.get('beginner');
    const list = state.guides.cat==='ALL' ? D.guides : D.guides.filter(g=>g.category===state.guides.cat);
    app.innerHTML = `
      <section class="guide-hero">
        <div class="container">
          <div class="guide-hero-grid">
            <div>
              <span class="eyebrow">FIELD NOTES · 09</span>
              <h1>攻略，<br><em>更好的选择</em>。</h1>
              <p>从第一次爬塔到进阶 20 的双 Boss：新手框架、四个职业、Boss 时间线、经济决策与卡组诊断。每一篇都尽量回答「为什么」，而不只是「拿什么」。</p>
            </div>
            <a class="guide-feature-card" href="${guideLink(feature)}">
              <div class="img"><img src="${feature.cover}" alt=""></div>
              <div class="body"><span>推荐先读 · ${esc(feature.category)}</span><h3>${esc(feature.title)}</h3><p>${esc(feature.excerpt)}</p><div class="read">${esc(feature.read)} · 开始阅读 →</div></div>
            </a>
          </div>
        </div>
      </section>
      <div class="catalog-body">
        <div class="container">
          <div class="guide-filters">
            <div class="chips">${cats.map(c=>`<button class="chip ${state.guides.cat===c?'active':''}" type="button" data-guide-cat="${c}">${c==='ALL'?'全部':c}<span class="count">${c==='ALL'?D.guides.length:D.guides.filter(g=>g.category===c).length}</span></button>`).join('')}</div>
            <span class="muted" style="font-size:10.5px;letter-spacing:.06em"><b id="guide-count" style="color:var(--gold-2)">${list.length}</b> 篇 · 按阅读顺序排列</span>
          </div>
          <div class="guide-grid" id="guide-grid">${list.map(guideCard).join('')}</div>
          <div class="catalog-note"><span>攻略观点综合自中文社区资料与实战经验；不同版本/进阶下数值可能变化。</span><span><a href="#/about" style="color:var(--gold)">查看资料来源 →</a></span></div>
        </div>
      </div>`;
    initReveal();
  }
  function renderGuide(id) {
    const g = guideById.get(id);
    if (!g) { renderNotFound(); return; }
    setMeta(g.title);
    const idx = D.guides.findIndex(x=>x.id===id);
    const prev = D.guides[(idx-1+D.guides.length)%D.guides.length];
    const next = D.guides[(idx+1)%D.guides.length];
    app.innerHTML = `
      <article class="article">
        <header class="article-hero">
          ${g.cover ? `<div class="article-hero-bg" style="background-image:url('${g.cover}')"></div>` : ''}
          <div class="container">
            <div class="article-hero-inner">
              <span class="eyebrow">${esc(g.category)}${g.category===g.level?'':' · '+esc(g.level)} · ${esc(g.read)}</span>
              <h1>${esc(g.title)}</h1>
              <p class="sub">${esc(g.subtitle)}</p>
              <div class="article-meta"><span class="tag">${esc(g.category)}</span><span>${g.sections.length} 个章节</span><span class="dot"></span><span>约 ${esc(g.read)}</span><span class="dot"></span><span>${g.category==='职业' ? esc(g.coverColorName || '') : '全职业'}</span></div>
            </div>
          </div>
        </header>
        <div class="container">
          <div class="article-layout">
            <aside class="article-toc" aria-label="文章目录">
              <div class="label">CONTENTS</div>
              ${g.sections.map((s,i)=>`<a href="#${s.id}" data-toc="${s.id}"><span>${String(i+1).padStart(2,'0')}</span>${esc(s.title)}</a>`).join('')}
              <div class="toc-share"><button type="button" data-copy-link>复制本文链接 ↗</button></div>
            </aside>
            <div class="article-body">
              <p class="lead">${esc(g.excerpt)}</p>
              <div class="article-takeaways"><h3>本页要点</h3><ul>${g.takeaways.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></div>
              <div class="mention-hint">提示：文中带<b>虚线下划线</b>的卡牌、遗物、敌人与角色名称，悬停可查看图片，点击打开对应档案。</div>
              ${g.sections.map((s,i)=>`<section id="${s.id}"><h2><span class="h-num">${String(i+1).padStart(2,'0')}</span>${esc(s.title)}</h2>${s.html}</section>`).join('')}
              <div class="article-sources"><b>参考与延伸</b>${g.sources.map(s=>`<span>${esc(s)}</span>`).join(' · ')} · 完整来源见 <a href="#/about">资料与来源</a>。</div>
              <div class="article-next">
                <a href="${guideLink(prev)}"><span>← 上一篇</span><b>${esc(prev.title)}</b></a>
                <a class="next" href="${guideLink(next)}"><span>下一篇 →</span><b>${esc(next.title)}</b></a>
              </div>
            </div>
          </div>
        </div>
      </article>`;
    document.body.classList.add('is-article');
    enhanceMentions($('.article-body'), g.heroColor);
    initArticle(g);
  }

  /* ---------- about ---------- */
  function renderAbout() {
    setMeta('资料与来源');
    app.innerHTML = `
      <section class="page-hero">
        <div class="container page-hero-inner"><div><span class="eyebrow">ABOUT THE ARCHIVE</span><h1>关于<em>尖塔档案</em></h1><p>一个由玩家整理的中文攻略站。目标不是做最全的数据库，而是把「查资料」和「做决策」放在同一个地方。</p></div><div class="page-hero-side"><div class="page-stat"><b>367</b><span>卡牌</span></div><div class="page-stat"><b>179</b><span>遗物</span></div><div class="page-stat"><b>42</b><span>药水</span></div><div class="page-stat"><b>41</b><span>敌人</span></div></div></div>
      </section>
      <div class="page-body"><div class="container about-layout">
        <div class="about-body">
          <h2>这份档案是怎么来的</h2>
          <p>卡牌、遗物、药水与敌人的中文名称、基础效果，以《杀戮尖塔》官方简体中文 1.0 文本为底稿；卡池边界、分类与社区常用说法，参考了 18183、九游、本能应用、vgover、SteamXO 与哔哩哔哩 BWIKI 等中文资料。攻略部分综合这些资料与实战经验重新撰写，不逐字转载。</p>
          <p>我们尽量把「数据」和「观点」分开：图鉴部分给效果、费用、升级方向；攻略部分才给抓位、路线与取舍。这样你可以先查清楚一张牌是什么，再决定它值不值得拿。</p>
          <p><strong>图像素材：</strong>角色立绘取自游戏内角色选择画面，卡面截图取自灰机wiki 的完整中文卡面，卡面插画与遗物图标取自游戏本体，药水图标由游戏内瓶子/液体素材合成；敌人立绘参考 <a href="https://www.slaythespire.gg/" target="_blank" rel="noopener noreferrer" style="color:var(--gold-2);border-bottom:1px solid rgba(201,164,92,.35)">slaythespire.gg</a> 的社区图鉴整理。所有素材仅用于非商业识别与攻略展示。</p>
          <div class="about-quote">“爬塔不是把最强的牌塞进卡组，而是在每一个岔路口，选出更适合当前局面的那一个。”</div>
          <h2>数据口径</h2>
          <ul><li>卡牌/遗物数值为进阶 0 的基础值，升级效果按游戏内升级逻辑展示；部分特殊升级以游戏内文本为准。</li><li>敌人生命值为进阶 0 基准，进阶会提高伤害、血量并改变部分行动。</li><li>“进阶 20”攻略默认包含双 Boss 与腐化之心路线；不同版本/模组下可能有差异。</li><li>本站为非官方粉丝站，与 Mega Crit Games 无隶属关系。</li></ul>
          <h2>资料来源</h2>
          <div class="source-grid">
            ${D.sources.map(s=>`<a class="source-card" href="${s.url}" target="_blank" rel="noopener noreferrer"><b>${esc(s.name)}</b><span>中文资料 ↗</span><p>${esc(s.desc)}</p></a>`).join('')}
          </div>
          <h2>版权与反馈</h2>
          <p>《杀戮尖塔》（Slay the Spire）及相关卡牌、遗物、角色、图像素材版权归 Mega Crit Games 所有。卡面截图来自灰机wiki，其社区内容按 CC BY-NC-SA 4.0 协议分发。本站仅作非商业的攻略与资料整理；卡面与图标素材用于图鉴识别，如权利人认为不妥，请联系删除。</p>
          <p>本站为静态攻略站，不收集账号信息，不使用第三方追踪脚本。搜索与筛选全部在本地浏览器完成。</p>
        </div>
        <aside class="about-aside"><h3>档案信息</h3><dl><dt>版本</dt><dd>1.2 · 2026.10</dd><dt>卡牌</dt><dd>${D.cards.length} 张</dd><dt>遗物</dt><dd>${D.relics.length} 件</dd><dt>药水</dt><dd>${D.potions.length} 瓶</dd><dt>敌人</dt><dd>${D.enemies.length} 个</dd><dt>攻略</dt><dd>${D.guides.length} 篇</dd><dt>语言</dt><dd>简体中文</dd><dt>性质</dt><dd>非官方粉丝站</dd></dl><div style="margin-top:20px;padding-top:18px;border-top:1px solid var(--line);font-size:10.5px;color:var(--dim);line-height:1.8">数据与攻略会随版本与社区理解更新。发现错误，欢迎在社区指出。</div></aside>
      </div></div>`;
    initReveal();
  }
  function renderNotFound() {
    setMeta('页面不存在');
    app.innerHTML = `<section class="page-hero"><div class="container"><span class="eyebrow">404</span><h1>这一层<em>不存在</em></h1><p>你走进了一个没有生成的房间。回到地图，重新选择路线。</p><div style="margin-top:30px"><a class="btn btn-primary" href="#/">回到首页 →</a></div></div></section>`;
  }

  /* ---------- modals ---------- */
  let modalOpen = false, searchOpen = false, mobileOpen = false;
  function syncBodyLock() { document.body.style.overflow = (modalOpen || searchOpen || mobileOpen) ? 'hidden' : ''; }
  function showModal(inner) {
    const root = $('#modal-root');
    lastFocused = document.activeElement;
    root.innerHTML = `<div class="modal-backdrop" data-close-modal></div><div class="modal-dialog" role="dialog" aria-modal="true">${inner}<button class="modal-close" type="button" data-close-modal aria-label="关闭">×</button></div>`;
    root.classList.add('is-open'); root.setAttribute('aria-hidden','false');
    modalOpen = true; syncBodyLock();
    setTimeout(()=>{ const b = $('.modal-close'); if (b) b.focus({preventScroll:true}); }, 40);
  }
  function closeModal() {
    const root = $('#modal-root'); if (!root) return;
    root.classList.remove('is-open'); root.setAttribute('aria-hidden','true'); root.innerHTML='';
    modalOpen = false; syncBodyLock();
    if (lastFocused && lastFocused.focus) setTimeout(()=>{ try{ lastFocused.focus({preventScroll:true}); }catch(e){} }, 20);
  }
  function upgradeDiff(c){
    const out=[];
    if(c.upDamage) out.push(`伤害 ${c.damage} → ${c.damage + c.upDamage}`);
    if(c.upBlock) out.push(`格挡 ${c.block} → ${c.block + c.upBlock}`);
    if(c.upMagic) out.push(`效果 ${c.magic} → ${c.magic + c.upMagic}`);
    if(c.upCost !== null && c.upCost !== c.cost) out.push(`耗能 ${c.costLabel} → ${c.upCostLabel}`);
    return out;
  }
  function cardFrame(c, v, version){
    const up = v === 'up';
    const cost = up ? c.upCostLabel : c.costLabel;
    const name = c.name + (up ? '+' : '');
    const desc = up ? c.upDesc : c.desc;
    if (c.realArt) {
      const realImg = up ? (c.upRealArt || c.realArt) : c.realArt;
      return `<div class="duo-card ${up?'up':'base'} ${version===v?'is-active':''}" data-card-frame="${v}">
        <div class="duo-label">${up?'升级后':'基础'}</div>
        <div class="real-card-frame ${up?'up':''}">
          <img src="${realImg}" alt="${attr(name)} 游戏卡面">
        </div>
      </div>`;
    }
    return `<div class="duo-card ${up?'up':'base'} ${version===v?'is-active':''}" data-card-frame="${v}">
      <div class="duo-label">${up?'升级后':'基础'}</div>
      <div class="duo-frame" style="--card-accent:${colorHex[c.colorKey]}">
        <div class="duo-banner"><span class="duo-cost">${esc(cost)}</span><b>${esc(name)}</b></div>
        <div class="duo-art"><img src="${cardImage(c)}" alt="${attr(name)} 卡面"></div>
        <div class="duo-type">${esc(c.typeName)}${up?' · 升级':''}</div>
        <div class="duo-text">${fmt(desc)}</div>
        <div class="duo-rarity">${esc(c.rarityName)}</div>
      </div>
    </div>`;
  }
  function cardVersionPanel(c, v, version){
    const up = v === 'up';
    const cost = up ? c.upCostLabel : c.costLabel;
    const desc = up ? c.upDesc : c.desc;
    const diffs = upgradeDiff(c);
    const specialTags = `${c.exhaust?'<span>消耗</span>':''}${c.ethereal?'<span>虚无</span>':''}${c.innate?'<span>固有</span>':''}${c.retain?'<span>保留</span>':''}`;
    return `<div class="version-panel" data-version-panel="${v}" ${version===v?'':'hidden'}>
      <div class="modal-stats">
        <div class="modal-stat"><span>类型</span><b>${esc(c.typeName)}</b></div>
        <div class="modal-stat"><span>稀有度</span><b>${esc(c.rarityName)}</b></div>
        <div class="modal-stat"><span>耗能</span><b>${esc(cost)}${!up && c.upCostLabel!==c.costLabel?' → '+esc(c.upCostLabel):''}</b></div>
        <div class="modal-stat"><span>职业</span><b>${esc(c.colorName)}</b></div>
      </div>
      <div class="modal-desc">${fmt(desc)}</div>
      ${up && diffs.length ? `<div class="upgrade-diff">${diffs.map(d=>`<span>${esc(d)}</span>`).join('')}</div>` : ''}
      ${up && !diffs.length && c.upgradeSummary ? `<div class="upgrade-diff"><span>${esc(c.upgradeSummary)}</span></div>` : ''}
      <div class="modal-tags">${specialTags}${c.tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div>
    </div>`;
  }
  function switchCardVersion(v){
    $$('[data-version-panel]').forEach(p=>{ p.hidden = p.dataset.versionPanel !== v; });
    $$('[data-card-version-tab]').forEach(b=>{ b.classList.toggle('active', b.dataset.cardVersionTab === v); });
    $$('[data-card-frame]').forEach(f=>{ f.classList.toggle('is-active', f.dataset.cardFrame === v); });
  }
  function openCard(id, version = 'base') {
    const c = cardById.get(id); if (!c) return;
    if (c.upgradable === false) version = 'base';
    const guideId = { red:'ironclad', green:'silent', blue:'defect', purple:'watcher' }[c.colorKey];
    const related = D.cards.filter(x=>x.id!==c.id && x.color===c.color && x.type===c.type).slice(0,5);
    showModal(`<div class="modal-card-grid">
      <div class="modal-card-art" style="--accent:${colorHex[c.colorKey]}">
        <div class="modal-card-duo ${c.upgradable===false?'single':''} ${c.realArt?'real-duo':''}">${cardFrame(c,'base',version)}${c.upgradable!==false?cardFrame(c,'up',version):''}</div>
        <div class="modal-card-caption">同一张卡 · 基础 / 升级后</div>
      </div>
      <div class="modal-info">
        <div class="modal-kicker">CARD DOSSIER · ${esc(c.colorName)}</div>
        <h2>${esc(c.name)}</h2>
        <div class="modal-sub">${esc(c.typeName)} · ${esc(c.rarityName)} · ${esc(c.colorName)}</div>
        ${c.upgradable===false ? `<div class="version-tabs"><button type="button" class="active" disabled>不可升级</button></div>` : `<div class="version-tabs">
          <button type="button" data-card-version-tab="base" class="${version==='base'?'active':''}">基础</button>
          <button type="button" data-card-version-tab="up" class="up ${version==='up'?'active':''}">升级后 +</button>
        </div>`}
        ${cardVersionPanel(c,'base',version)}
        ${c.upgradable!==false?cardVersionPanel(c,'up',version):''}
        ${c.note?`<div class="modal-note"><b>构筑点评</b><p>${esc(c.note)}</p></div>`:''}
        <div class="modal-actions">
          ${guideId?`<a class="btn btn-primary btn-small" href="#/guide/${guideId}" data-close-modal>读 ${esc(c.colorName)} 攻略 →</a>`:''}
          <a class="btn btn-ghost btn-small" href="#/cards?color=${c.colorKey}" data-close-modal>查看同职业卡牌</a>
        </div>
        ${related.length?`<div class="modal-related"><h4>同职业 · 同类型</h4><div class="modal-related-list">${related.map(x=>`<button type="button" data-open-card="${attr(x.id)}">${esc(x.name)}</button>`).join('')}</div></div>`:''}
      </div>
    </div>`);
  }
  function openRelic(id) {
    const r = relicById.get(id); if (!r) return;
    const phase = { STARTER:'角色初始遗物', COMMON:'普通战斗 / 商店 / 宝箱', UNCOMMON:'普通战斗 / 商店 / 宝箱', RARE:'普通战斗 / 商店 / 宝箱', BOSS:'Boss 战后三选一', SHOP:'商店购买', SPECIAL:'事件 / 特殊获取' }[r.tier] || '未知';
    const related = D.relics.filter(x=>x.id!==r.id && x.tier===r.tier).slice(0,4);
    showModal(`<div class="modal-relic">
      <div class="modal-relic-visual"><div class="modal-relic-icon"><img src="${r.icon||''}" alt="${attr(r.name)} 图标"></div><div class="tier">${esc(r.tierName)}</div></div>
      <div class="modal-relic-info">
        <div class="modal-kicker">RELIC DOSSIER</div>
        <h2>${esc(r.name)}</h2>
        <div class="en">${esc(r.tierName)} · ${esc(phase)}</div>
        <div class="modal-relic-effect">${fmt(r.desc)}</div>
        ${r.flavor?`<div class="modal-relic-flavor">“${esc(r.flavor)}”</div>`:''}
        ${r.note?`<div class="modal-note"><b>什么时候值得拿</b><p>${esc(r.note)}</p></div>`:''}
        <div class="modal-actions"><a class="btn btn-ghost btn-small" href="#/relics?tier=${r.tier.toLowerCase()}" data-close-modal>查看同稀有度遗物</a></div>
        ${related.length?`<div class="modal-related"><h4>同稀有度</h4><div class="modal-related-list">${related.map(x=>`<button type="button" data-open-relic="${attr(x.id)}">${esc(x.name)}</button>`).join('')}</div></div>`:''}
      </div>
    </div>`);
  }
  function openEnemy(id) {
    const e = enemyById.get(id); if (!e) return;
    const accent = enemyAccent(e);
    const related = D.enemies.filter(x=>x.id!==e.id && x.act===e.act && x.kind===e.kind).slice(0,4);
    showModal(`<div class="modal-enemy" style="--accent:${accent}">
      <div class="modal-enemy-visual">
        ${(e.image || e.icon)?`<img src="${e.image || e.icon}" alt="${attr(e.name)}">`:`<span class="big-mark">${esc(e.mark)}</span>`}
        <div class="act-label">${esc(e.actName)} · ${esc(e.kindName)}</div>
      </div>
      <div class="modal-enemy-info">
        <div class="modal-kicker">THREAT DOSSIER · ACT ${e.act}</div>
        <h2>${esc(e.name)}</h2>
        <div class="en">${esc(e.en)} · ${esc(e.actName)} · ${esc(e.kindName)}</div>
        <div class="modal-hp"><b>${esc(e.hp)}</b><span>生命值（进阶 0）</span><span style="margin-left:auto">${dots(e.danger)}</span></div>
        <div class="modal-enemy-section"><h4>意图 / 行动</h4><ul class="modal-moves">${e.moves.map(m=>`<li>${esc(m)}</li>`).join('')}</ul></div>
        <div class="modal-enemy-section"><h4>威胁分析</h4><p>${esc(e.threat)}</p></div>
        <div class="modal-enemy-section"><h4>应对方式</h4><p>${esc(e.tip)}</p></div>
        ${related.length?`<div class="modal-related"><h4>同幕 · 同类</h4><div class="modal-related-list">${related.map(x=>`<button type="button" data-open-enemy="${attr(x.id)}">${esc(x.name)}</button>`).join('')}</div></div>`:''}
        <div class="modal-actions"><a class="btn btn-ghost btn-small" href="#/enemies?act=${e.act}" data-close-modal>查看本幕敌人</a></div>
      </div>
    </div>`);
  }


  /* ---------- inline mentions & image tooltips ---------- */
  const NO_MENTION = new Set(['打击','防御','愤怒','武装','收集','发现','净化','评估','坚毅','放血','急躁','冥想','祈祷','审判','光辉','许愿','猛虎下山']);
  function buildMentionIndex(){
    const map=new Map();
    const add=(name,entry)=>{ if(!name || name.length<2 || NO_MENTION.has(name)) return; if(!map.has(name)) map.set(name,[]); map.get(name).push(entry); };
    D.cards.forEach(c=>add(c.name,{kind:'card',id:c.id,color:c.colorKey}));
    D.relics.forEach(r=>add(r.name,{kind:'relic',id:r.id}));
    D.enemies.forEach(e=>add(e.name,{kind:'enemy',id:e.id}));
    D.potions.forEach(p=>add(p.name,{kind:'potion',id:p.id}));
    D.heroes.forEach(h=>add(h.name,{kind:'hero',id:h.id}));
    return map;
  }
  const mentionIndex=buildMentionIndex();
  const escapeReg=(s)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const mentionNames=Array.from(mentionIndex.keys()).sort((a,b)=>b.length-a.length);
  const MENTION_RE=new RegExp(mentionNames.map(escapeReg).join('|'),'g');
  function pickMention(name,color){
    const list=mentionIndex.get(name); if(!list||!list.length) return null;
    if(color){ const c=list.find(x=>x.kind==='card'&&x.color===color); if(c) return c; }
    return list.find(x=>x.kind==='card') || list.find(x=>x.kind==='relic') || list.find(x=>x.kind==='enemy') || list.find(x=>x.kind==='potion') || list[0];
  }
  function enhanceMentions(root, color){
    if(!root) return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{
      acceptNode(node){
        const p=node.parentElement;
        if(!p) return NodeFilter.FILTER_REJECT;
        if(p.closest('a,button,.mention,script,style,code,pre,h1,h2,h3')) return NodeFilter.FILTER_REJECT;
        if(!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node=>{
      const text=node.nodeValue; MENTION_RE.lastIndex=0;
      let m,last=0; const frag=document.createDocumentFragment(); let hit=false;
      while((m=MENTION_RE.exec(text))){
        const entry=pickMention(m[0],color); if(!entry) continue;
        hit=true;
        if(m.index>last) frag.appendChild(document.createTextNode(text.slice(last,m.index)));
        const btn=document.createElement('button');
        btn.type='button'; btn.className='mention'; btn.textContent=m[0];
        btn.dataset.mentionKind=entry.kind; btn.dataset.mentionId=entry.id;
        frag.appendChild(btn); last=m.index+m[0].length;
      }
      if(!hit) return;
      if(last<text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag,node);
    });
  }
  function mentionTipHtml(entry){
    if(entry.kind==='card'){
      const c=cardById.get(entry.id); if(!c) return '';
      return `<div class="mt-card"><img src="${cardImage(c)}" alt=""><div class="mt-body"><b>${esc(c.name)}</b><em>${esc(c.colorName)} · ${esc(c.typeName)} · ${esc(c.costLabel)} 费 · ${esc(c.rarityName)}</em><p>${esc(truncate(c.desc,88))}</p></div></div>`;
    }
    if(entry.kind==='relic'){
      const r=relicById.get(entry.id); if(!r) return '';
      return `<div class="mt-relic"><img src="${r.icon||''}" alt=""><div class="mt-body"><b>${esc(r.name)}</b><em>遗物 · ${esc(r.tierName)}</em><p>${esc(truncate(r.desc,88))}</p></div></div>`;
    }
    if(entry.kind==='enemy'){
      const e=enemyById.get(entry.id); if(!e) return '';
      return `<div class="mt-enemy"><img src="${e.image||e.icon||''}" alt=""><div class="mt-body"><b>${esc(e.name)}</b><em>${esc(e.actName)} · ${esc(e.kindName)} · ${esc(e.hp)} HP</em><p>${esc(truncate(e.threat,88))}</p></div></div>`;
    }
    if(entry.kind==='potion'){
      const p=potionById.get(entry.id); if(!p) return '';
      return `<div class="mt-relic"><img src="${p.icon}" alt=""><div class="mt-body"><b>${esc(p.name)}</b><em>药水 · ${esc(p.rarityName)}</em><p>${esc(truncate(p.desc,88))}</p></div></div>`;
    }
    if(entry.kind==='hero'){
      const h=D.heroes.find(x=>x.id===entry.id); if(!h) return '';
      return `<div class="mt-hero"><img src="${h.portrait||h.art}" alt=""><div class="mt-body"><b>${esc(h.name)}</b><em>${esc(h.en)} · ${h.hp} HP</em><p>${esc(h.tagline)}</p></div></div>`;
    }
    return '';
  }
  function showMentionTip(el){
    const tip=$('#mention-tip'); if(!tip) return;
    const entry={kind:el.dataset.mentionKind,id:el.dataset.mentionId};
    const html=mentionTipHtml(entry); if(!html) return;
    tip.innerHTML=html; tip.setAttribute('aria-hidden','false'); tip.classList.add('show'); tip.style.visibility='hidden';
    requestAnimationFrame(()=>{
      const r=el.getBoundingClientRect(); const w=tip.offsetWidth||286; const h=tip.offsetHeight||120;
      let left=Math.min(innerWidth-w-12,Math.max(12,r.left+r.width/2-w/2));
      let top=r.top-h-10; if(top<12) top=r.bottom+10;
      if(top+h>innerHeight-12) top=Math.max(12,innerHeight-h-12);
      tip.style.left=left+'px'; tip.style.top=top+'px'; tip.style.visibility='';
    });
  }
  function hideMentionTip(){ const tip=$('#mention-tip'); if(tip){ tip.classList.remove('show'); tip.setAttribute('aria-hidden','true'); } }
  function openMention(kind,id){
    hideMentionTip();
    if(kind==='card') openCard(id);
    else if(kind==='relic') openRelic(id);
    else if(kind==='enemy') openEnemy(id);
    else if(kind==='potion') openPotion(id);
    else if(kind==='hero'){ const g=guideById.get(id); if(g) location.hash='#/guide/'+id; }
  }

  /* ---------- search ---------- */
  function stripHTML(html='') { const d=document.createElement('div'); d.innerHTML=html; return d.textContent||''; }
  function searchAll(q) {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const results=[];
    const score=(name,text='')=>{
      const n=name.toLowerCase(), t=text.toLowerCase();
      if(n===term) return 120;
      if(n.startsWith(term)) return 100;
      if(n.includes(term)) return 82;
      if(t.startsWith(term)) return 65;
      if(t.includes(term)) return 45;
      return 0;
    };
    D.cards.forEach(c=>{ const s=score(c.name,[c.desc,c.colorName,c.typeName,...(c.tags||[])].join(' ')); if(s) results.push({kind:'card',id:c.id,score:s,name:c.name,meta:`${c.colorName} · ${c.typeName} · ${c.rarityName}`,thumb:c.art,thumbType:'img'}); });
    D.relics.forEach(r=>{ const s=score(r.name,[r.desc,r.flavor,r.tierName].join(' ')); if(s) results.push({kind:'relic',id:r.id,score:s,name:r.name,meta:`遗物 · ${r.tierName}`,thumb:r.icon,thumbType:'icon'}); });
    D.enemies.forEach(e=>{ const s=score(e.name,[e.en,e.threat,e.tip,e.moves.join(' '),e.actName,e.kindName].join(' ')); if(s) results.push({kind:'enemy',id:e.id,score:s,name:e.name,meta:`${e.actName} · ${e.kindName} · ${e.hp} HP`,thumb:e.image||e.icon,mark:e.mark,thumbType:(e.image||e.icon)?'icon':'mark'}); });
    D.potions.forEach(p=>{ const s=score(p.name,[p.desc,p.rarityName,p.note].join(' ')); if(s) results.push({kind:'potion',id:p.id,score:s,name:p.name,meta:`药水 · ${p.rarityName}`,thumb:p.icon,thumbType:'icon'}); });
    D.guides.forEach(g=>{ const s=score(g.title,[g.subtitle,g.excerpt,g.category,g.sections.map(x=>x.title+' '+stripHTML(x.html)).join(' ')].join(' ')); if(s) results.push({kind:'guide',id:g.id,score:s,name:g.title,meta:`攻略 · ${g.category} · ${g.read}`,thumb:g.cover,thumbType:'img'}); });
    const kindOrder={card:0,relic:1,enemy:2,guide:3};
    return results.sort((a,b)=>kindOrder[a.kind]-kindOrder[b.kind] || b.score-a.score || a.name.localeCompare(b.name,'zh-Hans-CN')).slice(0,24);
  }
  function searchThumb(item) {
    if (item.thumbType==='icon' && item.thumb) return `<span class="thumb icon"><img src="${item.thumb}" alt=""></span>`;
    if (item.thumbType==='mark') return `<span class="thumb mark">${esc(item.mark||'?')}</span>`;
    if (item.thumb) return `<span class="thumb"><img src="${item.thumb}" alt=""></span>`;
    return `<span class="thumb mark">?</span>`;
  }
  function renderSearch(q) {
    const box = $('#search-results'); if (!box) return;
    searchItems = searchAll(q); searchIndex = -1;
    if (!q.trim()) { box.innerHTML = `<div class="search-empty"><b>搜索整座尖塔</b>输入卡牌、遗物、敌人或攻略关键词。也可以直接点上面的推荐词。</div>`; return; }
    if (!searchItems.length) { box.innerHTML = `<div class="search-empty"><b>没有找到「${esc(q)}」</b>换一个名字、效果关键词，或试试「中毒」「力量」「姿态」。</div>`; return; }
    const groups = { card:'卡牌', relic:'遗物', enemy:'敌人', potion:'药水', guide:'攻略' };
    let html=''; let last='';
    searchItems.forEach((item,i)=>{
      if(item.kind!==last){ html+=`<div class="search-group-label">${groups[item.kind]}</div>`; last=item.kind; }
      html+=`<button class="search-result" type="button" data-search-index="${i}">${searchThumb(item)}<span class="sr-body"><b>${esc(item.name)}</b><span>${esc(item.meta)}</span></span><span class="sr-type">${groups[item.kind]}</span></button>`;
    });
    box.innerHTML=html;
  }
  function openSearch() {
    const ov=$('#search-overlay'); if(!ov) return;
    ov.classList.add('is-open'); ov.setAttribute('aria-hidden','false'); searchOpen=true; syncBodyLock();
    const inp=$('#global-search'); if(inp){ inp.value=''; setTimeout(()=>inp.focus(),40); }
    renderSearch('');
  }
  function closeSearch() {
    const ov=$('#search-overlay'); if(!ov) return;
    ov.classList.remove('is-open'); ov.setAttribute('aria-hidden','true'); searchOpen=false; syncBodyLock();
  }
  function openSearchItem(kind,id){
    closeSearch();
    if(kind==='card') openCard(id);
    else if(kind==='relic') openRelic(id);
    else if(kind==='enemy') openEnemy(id);
    else if(kind==='potion') openPotion(id);
    else if(kind==='guide'){ closeModal(); location.hash=`#/guide/${id}`; }
  }

  /* ---------- mobile menu ---------- */
  function openMobile(){ const m=$('#mobile-menu'); if(!m)return; m.classList.add('is-open'); m.setAttribute('aria-hidden','false'); mobileOpen=true; syncBodyLock(); const t=$('.menu-toggle'); if(t)t.setAttribute('aria-expanded','true'); }
  function closeMobile(){ const m=$('#mobile-menu'); if(!m)return; m.classList.remove('is-open'); m.setAttribute('aria-hidden','true'); mobileOpen=false; syncBodyLock(); const t=$('.menu-toggle'); if(t)t.setAttribute('aria-expanded','false'); }

  /* ---------- article / reveal / progress ---------- */
  function initReveal(){
    if(revealObserver) revealObserver.disconnect();
    if(!('IntersectionObserver' in window)){ $$('.reveal').forEach(el=>el.classList.add('is-visible')); return; }
    revealObserver = new IntersectionObserver((entries)=>{ entries.forEach(en=>{ if(en.isIntersecting){ en.target.classList.add('is-visible'); revealObserver.unobserve(en.target); } }); },{rootMargin:'0px 0px -8% 0px',threshold:.06});
    $$('.reveal:not(.is-visible)').forEach(el=>revealObserver.observe(el));
    setTimeout(()=>{ $$('.reveal:not(.is-visible)').forEach(el=>el.classList.add('is-visible')); }, 700);
  }
  function animateCounts(){
    const els=$$('[data-count]');
    if(!els.length || !('requestAnimationFrame' in window)) return;
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    els.forEach(el=>{
      const target=parseInt(el.dataset.count,10)||0; const start=performance.now(); const dur=900;
      const tick=(now)=>{ const p=Math.min(1,(now-start)/dur); const ease=1-Math.pow(1-p,3); el.textContent=Math.round(target*ease); if(p<1) requestAnimationFrame(tick); else el.textContent=target; };
      requestAnimationFrame(tick);
    });
  }
  function initArticle(g){
    if(articleObserver) articleObserver.disconnect();
    document.body.classList.add('is-article');
    const links=$$('[data-toc]');
    const sections=g.sections.map(s=>document.getElementById(s.id)).filter(Boolean);
    if('IntersectionObserver' in window){
      articleObserver=new IntersectionObserver((entries)=>{
        entries.forEach(en=>{ if(en.isIntersecting){ const id=en.target.id; links.forEach(a=>a.classList.toggle('active',a.dataset.toc===id)); } });
      },{rootMargin:'-18% 0px -68% 0px',threshold:0});
      sections.forEach(s=>articleObserver.observe(s));
    }
    updateReadingProgress();
  }
  function updateReadingProgress(){
    const bar=$('#reading-progress span'); if(!bar) return;
    if(!document.body.classList.contains('is-article')){ bar.style.width='0%'; return; }
    const body=$('.article-body'); if(!body){ bar.style.width='0%'; return; }
    const top=body.getBoundingClientRect().top+window.scrollY;
    const height=Math.max(1,body.offsetHeight-window.innerHeight*.4);
    const p=Math.min(1,Math.max(0,(window.scrollY-top+window.innerHeight*.35)/height));
    bar.style.width=`${(p*100).toFixed(2)}%`;
  }

  /* ---------- routing ---------- */
  const navMap={home:'home',heroes:'heroes',cards:'cards',relics:'relics',potions:'potions',enemies:'enemies',guides:'guides',guide:'guides',about:''};
  function setActiveNav(page){
    $$('.main-nav a').forEach(a=>a.classList.toggle('active',a.dataset.nav===navMap[page]));
  }
  function render(){
    const r=route(); const page=r.parts[0]||'home';
    closeModal(); closeSearch(); closeMobile(); hideMentionTip();
    document.body.classList.remove('is-article');
    $$('.main-nav a').forEach(a=>a.classList.remove('active'));
    setActiveNav(page);
    window.scrollTo({top:0,behavior:'auto'});
    if(page==='home') renderHome();
    else if(page==='heroes') renderHeroes();
    else if(page==='cards') renderCards();
    else if(page==='relics') renderRelics();
    else if(page==='potions') renderPotions();
    else if(page==='enemies') renderEnemies();
    else if(page==='guides') renderGuides();
    else if(page==='guide') renderGuide(r.parts[1]);
    else if(page==='about') renderAbout();
    else renderNotFound();
    setTimeout(updateReadingProgress,50);
  }

  /* ---------- events ---------- */
  document.addEventListener('click',(e)=>{
    const t=e.target;
    const closeBtn=t.closest('[data-close-modal]');
    if(closeBtn){
      e.preventDefault();
      const href=closeBtn.tagName==='A'?closeBtn.getAttribute('href'):null;
      closeModal();
      if(href) location.hash=href;
      return;
    }
    const mention=t.closest('.mention');
    if(mention){ e.preventDefault(); openMention(mention.dataset.mentionKind,mention.dataset.mentionId); return; }
    const versionTab=t.closest('[data-card-version-tab]');
    if(versionTab){ e.preventDefault(); switchCardVersion(versionTab.dataset.cardVersionTab); return; }
    const quickUp=t.closest('[data-open-card-up]');
    if(quickUp){ e.preventDefault(); openCard(quickUp.dataset.openCardUp,'up'); return; }
    const openCardBtn=t.closest('[data-open-card]');
    if(openCardBtn){ e.preventDefault(); openCard(openCardBtn.dataset.openCard, openCardBtn.dataset.cardVersion || 'base'); return; }
    if(t.closest('[data-card-up-toggle]')){ e.preventDefault(); state.cards.showUp=!state.cards.showUp; syncCardChrome(); renderCardGrid(); return; }
    const openRelicBtn=t.closest('[data-open-relic]');
    if(openRelicBtn){ e.preventDefault(); openRelic(openRelicBtn.dataset.openRelic); return; }
    const openEnemyBtn=t.closest('[data-open-enemy]');
    if(openEnemyBtn){ e.preventDefault(); openEnemy(openEnemyBtn.dataset.openEnemy); return; }
    const openPotionBtn=t.closest('[data-open-potion]');
    if(openPotionBtn){ e.preventDefault(); openPotion(openPotionBtn.dataset.openPotion); return; }
    const cf=t.closest('[data-card-filter]');
    if(cf){ e.preventDefault(); state.cards[cf.dataset.cardFilter]=cf.dataset.value; state.cards.limit=9999; syncCardChrome(); renderCardGrid(); return; }
    const rt=t.closest('[data-relic-tier]');
    if(rt){ e.preventDefault(); state.relics.tier=rt.dataset.relicTier; state.relics.limit=30; $$('[data-relic-tier]').forEach(b=>b.classList.toggle('active',b.dataset.relicTier===state.relics.tier)); renderRelicGrid(); return; }
    const ea=t.closest('[data-enemy-act]');
    if(ea){ e.preventDefault(); state.enemies.act=ea.dataset.enemyAct; state.enemies.limit=12; $$('[data-enemy-act]').forEach(b=>b.classList.toggle('active',b.dataset.enemyAct===state.enemies.act)); renderEnemyGrid(); return; }
    const ek=t.closest('[data-enemy-kind]');
    if(ek){ e.preventDefault(); state.enemies.kind=ek.dataset.enemyKind; state.enemies.limit=12; $$('[data-enemy-kind]').forEach(b=>b.classList.toggle('active',b.dataset.enemyKind===state.enemies.kind)); renderEnemyGrid(); return; }
    const gc=t.closest('[data-guide-cat]');
    if(gc){ e.preventDefault(); state.guides.cat=gc.dataset.guideCat; renderGuides(); return; }
    const pr=t.closest('[data-potion-rarity]');
    if(pr){ e.preventDefault(); state.potions.rarity=pr.dataset.potionRarity; state.potions.limit=15; $$('[data-potion-rarity]').forEach(b=>b.classList.toggle('active',b.dataset.potionRarity===state.potions.rarity)); renderPotionGrid(); return; }
    const kindMap={card:'cards',relic:'relics',enemy:'enemies',potion:'potions'};
    const sa=t.closest('[data-show-all]');
    if(sa){ e.preventDefault(); const k=kindMap[sa.dataset.showAll]||sa.dataset.showAll; if(k==='cards'){state.cards.limit=9999; renderCardGrid();} else if(k==='relics'){state.relics.limit=9999; renderRelicGrid();} else if(k==='enemies'){state.enemies.limit=9999; renderEnemyGrid();} else if(k==='potions'){state.potions.limit=9999; renderPotionGrid();} return; }
    const cl=t.closest('[data-collapse-list]');
    if(cl){ e.preventDefault(); const k=kindMap[cl.dataset.collapseList]||cl.dataset.collapseList; if(k==='cards'){state.cards.limit=9999; renderCardGrid();} else if(k==='relics'){state.relics.limit=30; renderRelicGrid();} else if(k==='enemies'){state.enemies.limit=12; renderEnemyGrid();} else if(k==='potions'){state.potions.limit=15; renderPotionGrid();} return; }
    const lm=t.closest('[data-load-more]');
    if(lm){ e.preventDefault(); if(lm.dataset.loadMore==='cards'){ state.cards.limit+=24; renderCardGrid(); } else { state.relics.limit+=60; renderRelicGrid(); } return; }
    if(t.closest('[data-reset-cards]')){ e.preventDefault(); state.cards={color:'ALL',type:'ALL',rarity:'ALL',q:'',showUp:false,limit:9999}; replaceHash('#/cards'); renderCards(); return; }
    if(t.closest('[data-reset-relics]')){ e.preventDefault(); state.relics={tier:'ALL',q:'',limit:30}; replaceHash('#/relics'); renderRelics(); return; }
    if(t.closest('[data-reset-enemies]')){ e.preventDefault(); state.enemies={act:'ALL',kind:'ALL',q:'',limit:12}; replaceHash('#/enemies'); renderEnemies(); return; }
    if(t.closest('[data-reset-potions]')){ e.preventDefault(); state.potions={rarity:'ALL',q:'',limit:15}; replaceHash('#/potions'); renderPotions(); return; }
    const sc=t.closest('[data-scroll]');
    if(sc){ e.preventDefault(); const el=document.getElementById(sc.dataset.scroll); if(el){ el.scrollIntoView({behavior:'smooth',block:'start'}); $$('.climber-nav button').forEach(b=>b.classList.toggle('active',b.dataset.scroll===sc.dataset.scroll)); } return; }
    if(t.closest('[data-to-top]')){ e.preventDefault(); window.scrollTo({top:0,behavior:'smooth'}); return; }
    if(t.closest('.search-trigger')){ e.preventDefault(); openSearch(); return; }
    if(t.closest('.search-close')){ e.preventDefault(); closeSearch(); return; }
    const hot=t.closest('[data-hot]');
    if(hot){ e.preventDefault(); const inp=$('#global-search'); if(inp){ inp.value=hot.dataset.hot; renderSearch(hot.dataset.hot); inp.focus(); } return; }
    const sr=t.closest('[data-search-index]');
    if(sr){ e.preventDefault(); const item=searchItems[parseInt(sr.dataset.searchIndex,10)]; if(item) openSearchItem(item.kind,item.id); return; }
    if(t.closest('.menu-toggle')){ e.preventDefault(); openMobile(); return; }
    if(t.closest('.menu-close')){ e.preventDefault(); closeMobile(); return; }
    const mn=t.closest('[data-mobile-nav]');
    if(mn){ closeMobile(); return; }
    const toc=t.closest('[data-toc]');
    if(toc){ e.preventDefault(); const el=document.getElementById(toc.dataset.toc); if(el){ el.scrollIntoView({behavior:'smooth',block:'start'}); } return; }
    if(t.closest('[data-copy-link]')){ e.preventDefault(); const url=location.href; if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(url).then(()=>toast('链接已复制')).catch(()=>toast('复制失败，请手动复制地址栏')); } else { toast('请手动复制地址栏链接'); } return; }
    if(t.matches('.modal-backdrop')){ closeModal(); return; }
  });

  document.addEventListener('input',(e)=>{
    const t=e.target;
    if(t.id==='card-search'){ state.cards.q=t.value; if(t.value.trim()){state.cards.color='ALL'; state.cards.type='ALL'; state.cards.rarity='ALL'; syncCardChrome();} state.cards.limit=9999; renderCardGrid(); }
    else if(t.id==='relic-search'){ state.relics.q=t.value; if(t.value.trim()){state.relics.tier='ALL'; $$('[data-relic-tier]').forEach(b=>b.classList.toggle('active',b.dataset.relicTier==='ALL'));} state.relics.limit=30; renderRelicGrid(); }
    else if(t.id==='enemy-search'){ state.enemies.q=t.value; if(t.value.trim()){state.enemies.act='ALL'; state.enemies.kind='ALL'; $$('[data-enemy-act]').forEach(b=>b.classList.toggle('active',b.dataset.enemyAct==='ALL')); $$('[data-enemy-kind]').forEach(b=>b.classList.toggle('active',b.dataset.enemyKind==='ALL'));} state.enemies.limit=12; renderEnemyGrid(); }
    else if(t.id==='potion-search'){ state.potions.q=t.value; if(t.value.trim()){state.potions.rarity='ALL'; $$('[data-potion-rarity]').forEach(b=>b.classList.toggle('active',b.dataset.potionRarity==='ALL'));} state.potions.limit=15; renderPotionGrid(); }
    else if(t.id==='global-search'){ renderSearch(t.value); }
  });
  document.addEventListener('change',(e)=>{
    const t=e.target;
    if(t.id==='card-type'){ state.cards.type=t.value; state.cards.limit=9999; renderCardGrid(); }
    else if(t.id==='card-rarity'){ state.cards.rarity=t.value; state.cards.limit=9999; renderCardGrid(); }
  });
  document.addEventListener('pointerover',(e)=>{
    const m=e.target.closest && e.target.closest('.mention');
    if(m) showMentionTip(m);
  });
  document.addEventListener('pointerout',(e)=>{
    if(!e.target.closest || !e.target.closest('.mention')) return;
    const to=e.relatedTarget;
    if(to && to.closest && to.closest('.mention')) return;
    hideMentionTip();
  });
  document.addEventListener('focusin',(e)=>{
    const m=e.target.closest && e.target.closest('.mention');
    if(m) showMentionTip(m);
  });
  document.addEventListener('focusout',(e)=>{
    if(e.target.closest && e.target.closest('.mention')) hideMentionTip();
  });
  document.addEventListener('keydown',(e)=>{
    if(e.key==='Escape'){ if(searchOpen){ closeSearch(); return; } if(mobileOpen){ closeMobile(); return; } if(modalOpen){ closeModal(); return; } }
    if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){ e.preventDefault(); if(searchOpen) closeSearch(); else openSearch(); return; }
    if(e.key==='/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)){ e.preventDefault(); openSearch(); return; }
    if(searchOpen){
      if(e.key==='ArrowDown'){ e.preventDefault(); if(searchItems.length){ searchIndex=Math.min(searchItems.length-1,searchIndex+1); updateSearchSelection(); } }
      else if(e.key==='ArrowUp'){ e.preventDefault(); if(searchItems.length){ searchIndex=Math.max(0,searchIndex-1); updateSearchSelection(); } }
      else if(e.key==='Enter' && searchIndex>=0 && searchItems[searchIndex]){ e.preventDefault(); const item=searchItems[searchIndex]; openSearchItem(item.kind,item.id); }
    }
  });
  function updateSearchSelection(){
    $$('.search-result').forEach((el,i)=>el.classList.toggle('selected',i===searchIndex));
    const sel=$('.search-result.selected'); if(sel) sel.scrollIntoView({block:'nearest'});
  }
  window.addEventListener('hashchange',()=>render());
  window.addEventListener('scroll',()=>{
    if(scrollTicking) return; scrollTicking=true;
    requestAnimationFrame(()=>{
      const header=$('#site-header'); if(header) header.classList.toggle('is-scrolled',window.scrollY>12);
      hideMentionTip();
      updateReadingProgress(); scrollTicking=false;
    });
  },{passive:true});
  function toast(msg){ const el=$('#toast'); if(!el) return; el.textContent=msg; el.classList.add('show'); clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove('show'),2200); }

  /* boot */
  render();
})();
