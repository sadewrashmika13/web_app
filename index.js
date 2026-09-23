<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sadew Movie Desk</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap');

  :root{
    --void:#0A0A0F;
    --void-2:#100E16;
    --crimson:#E8283F;
    --crimson-dim: rgba(232,40,63,.35);
    --amber:#F5A623;
    --amber-dim: rgba(245,166,35,.35);
    --orange:#e57b16;
    --orange-dim: rgba(229,123,22,.35);
    --teal:#0ea5e9;
    --teal-dim: rgba(14,165,233,.35);
    --green:#10b981;
    --green-dim: rgba(16,185,129,.35);
    --violet:#7C5CFC;
    --violet-dim: rgba(124,92,252,.35);
    
    --stub:#F7F4EF;
    --stub-ink:#1A1720;
    --stub-mute:#8B8478;
    --text:#F3F1EE;
    --mute:#948FA0;
    --glass: rgba(255,255,255,0.045);
    --glass-brd: rgba(255,255,255,0.10);
  }

  *{ box-sizing:border-box; }
  html{ scroll-behavior:smooth; }
  body{
    margin:0; min-height:100vh; background:var(--void); color:var(--text);
    font-family:'Inter',sans-serif; -webkit-font-smoothing:antialiased;
    overflow-x:hidden;
  }

  .ambient{
    position:fixed; inset:0; z-index:-1; pointer-events:none;
    background:
      radial-gradient(ellipse 60% 40% at 50% -10%, var(--crimson-dim), transparent 60%),
      radial-gradient(ellipse 45% 35% at 90% 15%, var(--teal-dim), transparent 60%);
    opacity:.55;
    animation: breathe 9s ease-in-out infinite;
  }
  @keyframes breathe{ 0%,100%{ opacity:.4 } 50%{ opacity:.7 } }

  .grain{
    position:fixed; inset:0; z-index:-1; pointer-events:none; opacity:.05; mix-blend-mode:overlay;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  }

  /* ── UPLOAD PROGRESS BANNER ── */
  .upload-banner {
    position: fixed; top: 0; left: 0; right: 0; background: rgba(16, 14, 22, 0.95);
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--glass-brd); padding: 14px 20px; z-index: 1000;
    transform: translateY(-100%); transition: transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
    display: flex; flex-direction: column; gap: 10px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  }
  .upload-banner.show { transform: translateY(0); }
  .ub-info { display: flex; align-items: center; gap: 14px; }
  .ub-icon { width: 24px; height: 24px; color: var(--crimson); animation: spin 1s linear infinite; }
  .ub-text { display: flex; flex-direction: column; flex: 1; }
  .ub-title { font-weight: 600; font-size: 14px; color: #fff; }
  .ub-sub { font-size: 12px; color: var(--mute); margin-top: 2px; }
  .ub-progress { width: 100%; height: 4px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden; position: relative; }
  .ub-bar { position: absolute; left: 0; top: 0; bottom: 0; width: 30%; background: var(--crimson); border-radius: 4px; animation: slide 1.5s ease-in-out infinite alternate; }
  @keyframes spin { 100% { transform: rotate(360deg); } }
  @keyframes slide { 0% { left: 0; width: 30%; } 100% { left: 70%; width: 30%; } }

  header{ padding:64px 24px 28px; text-align:center; }
  .eyebrow{
    display:inline-flex; align-items:center; gap:8px; font-size:13px; letter-spacing:.02em; color:var(--mute);
    opacity:0; animation: rise .7s .1s ease forwards;
  }
  .eyebrow svg{ width:14px; height:14px; stroke:var(--crimson); }

  h1{
    font-family:'Fraunces',serif; font-weight:600; font-size:clamp(2.4rem,6vw,4rem);
    margin:10px 0 6px; line-height:1.04; letter-spacing:-0.01em;
    background:linear-gradient(120deg,#fff 30%, #d8d3e0 60%, #fff 90%);
    -webkit-background-clip:text; background-clip:text; color:transparent;
    opacity:0; animation: rise .8s .2s ease forwards;
  }
  h1 em{ font-style:italic; color:var(--crimson); -webkit-text-fill-color:var(--crimson); }
  .sub{ color:var(--mute); font-size:15.5px; max-width:480px; margin:0 auto 30px; opacity:0; animation: rise .8s .32s ease forwards; }
  @keyframes rise{ from{ opacity:0; transform:translateY(14px);} to{ opacity:1; transform:translateY(0);} }

  /* ── source toggle — 6 segments ── */
  .source-toggle{
    position:relative; display:flex; padding:4px; border-radius:999px; width:min(860px, 98vw);
    margin:0 auto; background:var(--glass); border:1px solid var(--glass-brd); backdrop-filter:blur(10px);
    -webkit-backdrop-filter:blur(10px); opacity:0; animation: rise .8s .44s ease forwards;
    overflow-x: auto; -ms-overflow-style: none; scrollbar-width: none;
  }
  .source-toggle::-webkit-scrollbar { display: none; }
  .source-toggle .thumb{
    position:absolute; top:4px; left:4px; width:calc(16.666% - 1.3px); height:calc(100% - 8px);
    border-radius:999px; background:var(--crimson); box-shadow:0 0 22px var(--crimson-dim);
    transition: transform .35s cubic-bezier(.65,0,.35,1), background .35s ease, box-shadow .35s ease;
    z-index:0;
  }
  
  .source-toggle[data-active="cinesubz"] .thumb { transform:translateX(0%); background:var(--crimson); box-shadow:0 0 22px var(--crimson-dim); }
  .source-toggle[data-active="sinhalasub2"] .thumb { transform:translateX(100%); background:var(--amber); box-shadow:0 0 22px var(--amber-dim); }
  .source-toggle[data-active="sinhalasub1"] .thumb { transform:translateX(200%); background:var(--orange); box-shadow:0 0 22px var(--orange-dim); }
  .source-toggle[data-active="1tamilmv"] .thumb { transform:translateX(300%); background:var(--teal); box-shadow:0 0 22px var(--teal-dim); }
  .source-toggle[data-active="moviesublk"] .thumb { transform:translateX(400%); background:var(--green); box-shadow:0 0 22px var(--green-dim); }
  .source-toggle[data-active="animeheaven"] .thumb { transform:translateX(500%); background:var(--violet); box-shadow:0 0 22px var(--violet-dim); }

  .src-btn{
    position:relative; z-index:1; flex:1; min-width: 110px; border:none; background:transparent; cursor:pointer;
    padding:9px 4px; font-family:'Inter'; font-weight:600; font-size:11.5px;
    color:var(--mute); border-radius:999px; transition:color .3s ease;
    display:flex; align-items:center; justify-content:center; gap:4px; white-space:nowrap;
  }
  .src-btn.active{ color:#fff; }
  .src-btn svg{ width:12px; height:12px; flex-shrink:0; }

  /* ── search ── */
  .search-wrap{ max-width:560px; margin:26px auto 0; padding:0 20px; display:flex; gap:10px; opacity:0; animation: rise .8s .55s ease forwards; }
  .search-box{
    flex:1; padding:15px 20px; font-size:15.5px; border-radius:14px;
    border:1px solid var(--glass-brd); background:var(--glass); color:var(--text);
    outline:none; font-family:'Inter'; transition:border-color .25s ease, box-shadow .25s ease;
  }
  .search-box::placeholder{ color:var(--mute); }
  .search-box:focus{ border-color:var(--crimson); box-shadow:0 0 0 3px var(--crimson-dim); }
  .source-toggle[data-active="sinhalasub2"] ~ .search-wrap .search-box:focus{ border-color:var(--amber); box-shadow:0 0 0 3px var(--amber-dim); }
  .source-toggle[data-active="sinhalasub1"] ~ .search-wrap .search-box:focus{ border-color:var(--orange); box-shadow:0 0 0 3px var(--orange-dim); }
  .source-toggle[data-active="1tamilmv"] ~ .search-wrap .search-box:focus{ border-color:var(--teal); box-shadow:0 0 0 3px var(--teal-dim); }
  .source-toggle[data-active="moviesublk"] ~ .search-wrap .search-box:focus{ border-color:var(--green); box-shadow:0 0 0 3px var(--green-dim); }
  .source-toggle[data-active="animeheaven"] ~ .search-wrap .search-box:focus{ border-color:var(--violet); box-shadow:0 0 0 3px var(--violet-dim); }

  .search-btn{
    padding:0 22px; border-radius:14px; border:none; cursor:pointer; background:var(--crimson); color:#fff;
    font-weight:700; font-size:14px; display:flex; align-items:center; gap:8px; transition:transform .2s ease, box-shadow .2s ease;
  }
  .search-btn:hover{ transform:translateY(-2px); box-shadow:0 8px 24px var(--crimson-dim); }
  .search-btn svg{ width:16px; height:16px; }

  .status{ text-align:center; margin:22px 0 0; font-size:14px; color:var(--mute); min-height:20px; }
  .status.err{ color:var(--crimson); }

  /* ── movie grid ── */
  .container{ max-width:1080px; margin:0 auto; padding:36px 22px 90px; }
  .movie-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); gap:22px; }

  .ticket{
    cursor:pointer; border-radius:16px; overflow:hidden; background:var(--void-2); border:1px solid var(--glass-brd);
    opacity:0; transform:translateY(16px); animation: card-in .55s cubic-bezier(.2,.7,.3,1) forwards;
    transition: transform .3s ease, box-shadow .3s ease;
  }
  .ticket:hover{ transform:translateY(-6px); box-shadow:0 16px 34px rgba(0,0,0,.45); }
  @keyframes card-in{ to{ opacity:1; transform:translateY(0); } }

  .ticket .poster{ position:relative; aspect-ratio:2/3; overflow:hidden; }
  .ticket .poster img{ width:100%; height:100%; object-fit:cover; display:block; transition:transform .5s ease; }
  .ticket:hover .poster img{ transform:scale(1.06); }
  .ticket .badge{
    position:absolute; top:10px; left:10px; font-size:10.5px; font-weight:700; letter-spacing:.02em;
    padding:4px 9px; border-radius:999px; backdrop-filter:blur(6px); background:rgba(0,0,0,.45); border:1px solid rgba(255,255,255,.18); color:#fff;
  }
  
  .ticket .badge.cinesubz{ border-color:var(--crimson); color:#ff8a94; }
  .ticket .badge.sinhalasub2{ border-color:var(--amber); color:#ffcf85; }
  .ticket .badge.sinhalasub1{ border-color:var(--orange); color:#fcd34d; }
  .ticket .badge.1tamilmv{ border-color:var(--teal); color:#bae6fd; }
  .ticket .badge.moviesublk{ border-color:var(--green); color:#6ee7b7; }
  .ticket .badge.animeheaven{ border-color:var(--violet); color:#c9bbff; }

  .perforation{ position:relative; height:0; background:var(--void-2); }
  .perforation::before{ content:""; position:absolute; top:-1px; left:0; right:0; height:2px; background-image:radial-gradient(circle, var(--void) 2.2px, transparent 2.6px); background-size:14px 4px; background-repeat:repeat-x; }

  .stub{ background:var(--stub); color:var(--stub-ink); padding:12px 13px 14px; }
  .stub h4{ margin:0 0 6px; font-family:'Fraunces',serif; font-weight:600; font-size:14.5px; line-height:1.22; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .stub .meta{ display:flex; align-items:center; gap:10px; font-size:11.5px; color:var(--stub-mute); font-weight:500; }
  .stub .meta span{ display:flex; align-items:center; gap:3px; }
  .stub svg{ width:11px; height:11px; }

  .skel{ border-radius:16px; overflow:hidden; background:var(--void-2); border:1px solid var(--glass-brd); }
  .skel .poster{ aspect-ratio:2/3; background:linear-gradient(100deg,#161420 30%,#211d2c 45%,#161420 60%); background-size:200% 100%; animation:shimmer 1.4s infinite; }
  .skel .stub{ height:56px; background:#EDE9E2; }
  @keyframes shimmer{ 0%{ background-position:150% 0 } 100%{ background-position:-50% 0 } }

  /* ── modal ── */
  .modal{ display:none; position:fixed; inset:0; z-index:999; background:rgba(6,5,9,.78); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); align-items:center; justify-content:center; padding:20px; }
  .modal.open{ display:flex; animation: fade .25s ease; }
  @keyframes fade{ from{ opacity:0 } to{ opacity:1 } }
  .modal-card{ width:100%; max-width:420px; max-height:88vh; overflow-y:auto; border-radius:20px; background:var(--void-2); border:1px solid var(--glass-brd); box-shadow:0 30px 80px rgba(0,0,0,.6); animation: pop .32s cubic-bezier(.2,.8,.3,1.2); }
  @keyframes pop{ from{ opacity:0; transform:scale(.92) translateY(10px);} to{ opacity:1; transform:scale(1) translateY(0);} }
  .modal-head{ position:relative; }
  .modal-head img{ width:100%; height:210px; object-fit:cover; display:block; }
  .modal-head::after{ content:""; position:absolute; inset:0; background:linear-gradient(to top, var(--void-2), transparent 55%); }
  .close-btn{ position:absolute; top:12px; right:12px; width:32px; height:32px; border-radius:50%; background:rgba(0,0,0,.5); border:1px solid rgba(255,255,255,.2); color:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:18px; z-index:2; }
  .modal-title{ position:absolute; bottom:12px; left:18px; right:18px; font-family:'Fraunces',serif; font-weight:600; font-size:20px; color:#fff; z-index:1; }
  .modal-body{ padding:20px 20px 24px; }
  .field{ width:100%; padding:12px 14px; margin-bottom:10px; border-radius:11px; border:1px solid var(--glass-brd); background:var(--glass); color:var(--text); font-family:'Inter'; font-size:14px; outline:none; transition:border-color .2s ease; }
  .field:focus{ border-color:var(--crimson); }
  .field::placeholder{ color:var(--mute); }
  .modal-status{ font-size:13px; color:#F5C453; margin:6px 0 12px; min-height:16px; }
  .quality-row{ display:flex; flex-wrap:wrap; gap:9px; max-height:260px; overflow-y:auto; }
  .qbtn{ padding:10px 18px; border-radius:11px; border:1px solid var(--glass-brd); background:var(--glass); color:var(--text); font-weight:600; font-size:13.5px; cursor:pointer; display:flex; align-items:center; gap:7px; opacity:0; transform:translateY(10px); animation:qpop .4s ease forwards; transition: border-color .2s ease, transform .2s ease, background .2s ease; }
  .qbtn:hover{ border-color:var(--crimson); transform:translateY(-2px); background:rgba(232,40,63,.12); }
  .qbtn svg{ width:14px; height:14px; }
  @keyframes qpop{ to{ opacity:1; transform:translateY(0); } }
  ::selection{ background:var(--crimson); color:#fff; }
</style>
</head>
<body>

<!-- 🚀 Upload Progress Banner -->
<div id="uploadBanner" class="upload-banner">
  <div class="ub-info">
    <svg class="ub-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
    <div class="ub-text">
      <div class="ub-title" id="ubTitle">Sending...</div>
      <div class="ub-sub" id="ubSub">Downloading and uploading to WhatsApp</div>
    </div>
    <button onclick="document.getElementById('uploadBanner').classList.remove('show')" style="background:none;border:none;color:#fff;font-size:20px;cursor:pointer;">×</button>
  </div>
  <div class="ub-progress"><div class="ub-bar"></div></div>
</div>

<div class="ambient"></div>
<div class="grain"></div>

<header>
  <div class="eyebrow">
    <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M4 4h16v16H4z" stroke-linejoin="round"/><path d="M8 4v16M16 4v16M4 8h4M16 8h4M4 16h4M16 16h4"/></svg>
    Sadew · Movie Desk
  </div>
  <h1>Find it. Send it. <em>Done.</em></h1>
  <p class="sub">Search a film or anime episode and drop it straight into the group — pick your source, pick a quality, it's gone.</p>

  <!-- 🚀 NEW 6-SEGMENT SOURCE TOGGLE -->
  <div class="source-toggle" id="sourceToggle" data-active="cinesubz">
    <div class="thumb"></div>
    <button class="src-btn active" data-source="cinesubz" onclick="setSource('cinesubz')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/></svg>CineSubz
    </button>
    <button class="src-btn" data-source="sinhalasub2" onclick="setSource('sinhalasub2')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h10"/></svg>SinhalaSub API
    </button>
    <button class="src-btn" data-source="sinhalasub1" onclick="setSource('sinhalasub1')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h10"/></svg>SinhalaSub Web
    </button>
    <button class="src-btn" data-source="1tamilmv" onclick="setSource('1tamilmv')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/></svg>1TamilMV
    </button>
    <button class="src-btn" data-source="moviesublk" onclick="setSource('moviesublk')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>MovieSubLK
    </button>
    <button class="src-btn" data-source="animeheaven" onclick="setSource('animeheaven')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l2.5 5.5L20 9l-4.5 3.9L16.9 19 12 15.8 7.1 19l1.4-6.1L4 9l5.5-.5z"/></svg>Anime Haven
    </button>
  </div>

  <div class="search-wrap">
    <input type="text" id="movieName" class="search-box" placeholder="Search a movie name…" onkeydown="if(event.key==='Enter')searchMovie()">
    <button class="search-btn" onclick="searchMovie()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
      Search
    </button>
  </div>
  <p class="status" id="statusMsg"></p>
</header>

<div class="container">
  <div class="movie-grid" id="movieGrid"></div>
</div>

<div class="modal" id="movieModal">
  <div class="modal-card">
    <div class="modal-head">
      <button class="close-btn" onclick="closeModal()">×</button>
      <img id="modalImg" src="" alt="">
      <div class="modal-title" id="modalTitle"></div>
    </div>
    <div class="modal-body">
      <input type="text" id="reqName" class="field" placeholder="Requester name">
      <input type="text" id="reqNum" class="field" placeholder="Phone number (e.g. 0771234567)">
      <p class="modal-status" id="modalStatus"></p>
      <div class="quality-row" id="qualityButtons"></div>
    </div>
  </div>
</div>

<script>
  let currentSource = 'cinesubz';
  let currentMovieMeta = {};   
  let currentAnime = {};       

  const placeholders = {
    cinesubz: 'Search CineSubz…',
    sinhalasub2: 'Search SinhalaSub (API)…',
    sinhalasub1: 'Search SinhalaSub (Web)…',
    '1tamilmv': 'Search 1TamilMV…',
    moviesublk: 'Search MovieSubLK...',
    animeheaven: 'Search Anime Haven…'
  };

  function setSource(src){
    currentSource = src;
    const toggle = document.getElementById('sourceToggle');
    toggle.setAttribute('data-active', src);
    document.querySelectorAll('.src-btn').forEach(b => b.classList.toggle('active', b.dataset.source === src));
    document.getElementById('movieGrid').innerHTML = '';
    document.getElementById('statusMsg').textContent = '';
    document.getElementById('movieName').placeholder = placeholders[src];
  }

  function skeletons(n){
    const grid = document.getElementById('movieGrid');
    grid.innerHTML = '';
    for(let i=0;i<n;i++){
      const s = document.createElement('div');
      s.className = 'skel';
      s.innerHTML = `<div class="poster"></div><div class="stub"></div>`;
      grid.appendChild(s);
    }
  }

  // 🚀 Show Progress Banner
  function showProgressBanner(title, quality) {
    document.getElementById('ubTitle').textContent = `Sending: ${title}`;
    document.getElementById('ubSub').textContent = `Quality: ${quality} | Server is downloading & sending to WhatsApp...`;
    document.getElementById('uploadBanner').classList.add('show');
    // Hide it automatically after 20 seconds (Since backend handles the rest silently)
    setTimeout(() => {
        document.getElementById('uploadBanner').classList.remove('show');
    }, 20000);
  }

  async function searchMovie(){
    const query = document.getElementById('movieName').value.trim();
    if(!query) return;

    const statusEl = document.getElementById('statusMsg');
    statusEl.className = 'status';
    statusEl.textContent = 'Searching…';
    skeletons(6);

    try{
      const isAnime = currentSource === 'animeheaven';
      const endpoint = isAnime ? '/api/anime-search' : '/api/search';
      const body = isAnime ? { query } : { query, source: currentSource };

      const res = await fetch(endpoint, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(body)
      });
      const data = await res.json();
      const grid = document.getElementById('movieGrid');
      grid.innerHTML = '';

      if(data.success && data.results?.length){
        statusEl.textContent = `${data.results.length} result${data.results.length>1?'s':''} found`;
        data.results.forEach((mv, i) => {
          const card = document.createElement('div');
          card.className = 'ticket';
          card.style.animationDelay = `${i * 0.06}s`;

          let badgeClass, badgeText, metaHtml;
          if(isAnime){
            badgeClass = 'animeheaven'; badgeText = 'Anime Haven';
            metaHtml = `<span>Tap for episodes</span>`;
          } else {
            badgeClass = mv.source;
            if(mv.source === 'sinhalasub2') badgeText = 'SinhalaSub API';
            else if(mv.source === 'sinhalasub1') badgeText = 'SinhalaSub Web';
            else if(mv.source === '1tamilmv') badgeText = '1TamilMV';
            else if(mv.source === 'moviesublk') badgeText = 'MovieSubLK';
            else badgeText = 'CineSubz';

            const metaBits = [];
            if(mv.imdb) metaBits.push(`<span><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 6.9 7 .7-5.3 4.9 1.6 7-6.3-3.7L5.7 21.5l1.6-7L2 9.6l7-.7z"/></svg>${mv.imdb}</span>`);
            if(mv.date) metaBits.push(`<span>${mv.date}</span>`);
            if(mv.runtime) metaBits.push(`<span>${mv.runtime}</span>`);
            metaHtml = metaBits.length ? metaBits.join('') : `<span>Tap for details</span>`;
          }

          card.innerHTML = `
            <div class="poster">
              <img src="${mv.img || 'https://via.placeholder.com/400x600/100e16/ffffff?text=No+Cover'}" alt="${mv.title}" loading="lazy">
              <span class="badge ${badgeClass}">${badgeText}</span>
            </div>
            <div class="perforation"></div>
            <div class="stub">
              <h4>${mv.title}</h4>
              <div class="meta">${metaHtml}</div>
            </div>
          `;
          const refId = isAnime ? mv.id : mv.url;
          card.onclick = () => openModal(mv.title, mv.img, refId, mv.imdb);
          grid.appendChild(card);
        });
      } else {
        grid.innerHTML = '';
        statusEl.className = 'status err';
        statusEl.textContent = isAnime ? 'No anime found for that search.' : 'No films found for that search.';
      }
    } catch(e){
      document.getElementById('movieGrid').innerHTML = '';
      statusEl.className = 'status err';
      statusEl.textContent = 'Something went wrong reaching the search.';
    }
  }

  async function openModal(title, img, refId, imdb){
    const modal = document.getElementById('movieModal');
    modal.classList.add('open');
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalImg').src = img || 'https://via.placeholder.com/400x600/100e16/ffffff?text=No+Cover';
    document.getElementById('qualityButtons').innerHTML = '';
    const modalStatus = document.getElementById('modalStatus');
    modalStatus.style.color = '#F5C453';

    if(currentSource === 'animeheaven'){
      modalStatus.textContent = 'Fetching episodes…';
      try{
        const res = await fetch('/api/anime-episodes', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ id: refId })
        });
        const data = await res.json();

        if(data.success && data.episodes?.length){
          currentAnime = {
            id: refId,
            videoname: data.videoname || title,
            desc: data.desc || '',
            thumbnail: data.thumbnail || img
          };
          modalStatus.textContent = `Pick an episode (${data.episodes.length} found):`;
          data.episodes.forEach((ep, index) => {
            const btn = document.createElement('button');
            btn.className = 'qbtn';
            btn.style.animationDelay = `${Math.min(index, 20) * 0.04}s`;
            btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16"/></svg>Ep ${ep.num}`;
            btn.onclick = () => sendAnimeEpisode(ep);
            document.getElementById('qualityButtons').appendChild(btn);
          });
        } else {
          modalStatus.style.color = 'var(--crimson)';
          modalStatus.textContent = 'No episodes found for this one.';
        }
      } catch(e){
        modalStatus.style.color = 'var(--crimson)';
        modalStatus.textContent = 'Could not reach the episode list.';
      }
      return;
    }

    currentMovieMeta = { title, img, imdb };
    modalStatus.textContent = 'Fetching download links…';
    try{
      const res = await fetch('/api/links', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ url: refId, source: currentSource })
      });
      const data = await res.json();
      if(data.rating) currentMovieMeta.imdb = data.rating;
      if(data.thumbnail) document.getElementById('modalImg').src = data.thumbnail;

      if(data.success && data.downloads?.length){
        modalStatus.textContent = 'Pick a quality:';
        data.downloads.forEach((dl, index) => {
          if(!dl.resolvedUrl) return;
          const btn = document.createElement('button');
          btn.className = 'qbtn';
          btn.style.animationDelay = `${index * 0.08}s`;
          btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16"/></svg>${dl.meta}`;
          btn.onclick = () => sendMovie(dl.resolvedUrl, dl.meta);
          document.getElementById('qualityButtons').appendChild(btn);
        });
      } else {
        modalStatus.style.color = 'var(--crimson)';
        modalStatus.textContent = data.msg || 'No download links found for this one.';
      }
    } catch(e){
      modalStatus.style.color = 'var(--crimson)';
      modalStatus.textContent = 'Could not reach the link server.';
    }
  }

  function closeModal(){
    document.getElementById('movieModal').classList.remove('open');
  }

  function getRequester(){
    const reqName = document.getElementById('reqName').value.trim();
    const reqNum = document.getElementById('reqNum').value.trim();
    const modalStatus = document.getElementById('modalStatus');
    if(!reqName || !reqNum){
      modalStatus.style.color = 'var(--crimson)';
      modalStatus.textContent = 'Add a requester name and number first.';
      return null;
    }
    return { reqName, reqNum };
  }

  async function sendMovie(url, quality){
    const req = getRequester();
    if(!req) return;
    const modalStatus = document.getElementById('modalStatus');
    modalStatus.style.color = '#3ddc84';
    modalStatus.textContent = `Processing ${quality}...`;

    // 🚀 SHOW OUR NEW ANIMATED PROGRESS BANNER
    showProgressBanner(currentMovieMeta.title, quality);

    try{
      await fetch('/api/send-movie', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          title: currentMovieMeta.title, url, quality,
          reqName: req.reqName, reqNum: req.reqNum,
          source: currentSource, img: currentMovieMeta.img, imdb: currentMovieMeta.imdb
        })
      });
    } catch(e){}

    setTimeout(closeModal, 1500);
  }

  async function sendAnimeEpisode(ep){
    const req = getRequester();
    if(!req) return;
    const modalStatus = document.getElementById('modalStatus');
    modalStatus.style.color = '#3ddc84';
    modalStatus.textContent = `Processing Episode ${ep.num}...`;

    // 🚀 SHOW OUR NEW ANIMATED PROGRESS BANNER
    showProgressBanner(currentAnime.videoname, `Episode ${ep.num}`);

    try{
      await fetch('/api/anime-send', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          id: currentAnime.id, hash: ep.hash, epNum: ep.num,
          videoname: currentAnime.videoname, desc: currentAnime.desc, thumbnail: currentAnime.thumbnail,
          reqName: req.reqName, reqNum: req.reqNum
        })
      });
    } catch(e){}

    setTimeout(closeModal, 1500);
  }
</script>
</body>
</html>
