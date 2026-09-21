const API_URL = 'https://api.matheusgabsilva.digital';
let allGames = [];
let favoriteTeams = JSON.parse(localStorage.getItem('favoriteTeams')) || [];
let autoRefreshInterval = null;
let autoRefreshCountdownInterval = null;
let autoRefreshSecondsLeft = 0;
let cooldownInterval = null;
let cooldownSecondsLeft = 0;
let filtersOpen = false;

const channelLogos = {
  'globo':'https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/TV_Globo_logo.svg/120px-TV_Globo_logo.svg.png',
  'sportv':'https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/SporTV_logo.svg/120px-SporTV_logo.svg.png',
  'premiere':'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Premiere_logo_2021.svg/120px-Premiere_logo_2021.svg.png',
  'espn':'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/ESPN_logo.svg/120px-ESPN_logo.svg.png',
  'disney':'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Disney%2B_logo.svg/120px-Disney%2B_logo.svg.png',
  'max':'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Max_logo.svg/120px-Max_logo.svg.png',
  'prime':'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Amazon_Prime_Video_logo.svg/120px-Amazon_Prime_Video_logo.svg.png',
  'paramount':'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Paramount_Plus.svg/120px-Paramount_Plus.svg.png',
  'sbt':'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/SBT_logo_2021.svg/120px-SBT_logo_2021.svg.png',
  'band':'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Band_logo.svg/120px-Band_logo.svg.png',
  'youtube':'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/YouTube_Logo_2017.svg/120px-YouTube_Logo_2017.svg.png',
  'dazn':'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/DAZN_-_Logo.svg/120px-DAZN_-_Logo.svg.png',
  'cazé':'https://upload.wikimedia.org/wikipedia/pt/thumb/6/68/Caz%C3%A9TV.png/120px-Caz%C3%A9TV.png',
  'caze':'https://upload.wikimedia.org/wikipedia/pt/thumb/6/68/Caz%C3%A9TV.png/120px-Caz%C3%A9TV.png',
  'cazetv':'https://upload.wikimedia.org/wikipedia/pt/thumb/6/68/Caz%C3%A9TV.png/120px-Caz%C3%A9TV.png',
  'record':'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Record_logo.svg/120px-Record_logo.svg.png',
};

function fetchGames(force=false){
  if(cooldownSecondsLeft>0&&!force)return;
  const loadingDiv=document.getElementById('loading');
  const gamesGrid=document.getElementById('games-grid');
  loadingDiv.classList.remove('hidden');
  gamesGrid.innerHTML='';
  fetch(`${API_URL}?t=${Date.now()}${force?'&force=1':''}`)
    .then(async r=>{const t=await r.text();if(!r.ok)throw new Error(`Erro ${r.status}`);try{return JSON.parse(t);}catch{throw new Error('Resposta inválida');}})
    .then(data=>{
      loadingDiv.classList.add('hidden');
      // Handle new structured response
      if (!data.ok) {
        gamesGrid.innerHTML=`<div class="py-12 text-center"><p class="text-red-400 text-sm">${data.error?.message||'Erro desconhecido.'}</p></div>`;
        return;
      }

      if (!data.games || data.games.length===0) {
        gamesGrid.innerHTML=`<div class="py-12 text-center"><p class="text-slate-400 text-sm">Nenhum jogo encontrado.</p></div>`;
        return;
      }

      allGames=data.games;
      populateLeagues(allGames);
      renderGames(allGames);
      if(!force)startCooldown();
    })
    .catch(err=>{
      loadingDiv.classList.add('hidden');
      gamesGrid.innerHTML=`<div class="py-12 text-center"><p class="text-red-400 text-sm">Erro: ${err.message}</p></div>`;
    });
}

function startCooldown(){
  if(cooldownInterval)return;
  cooldownSecondsLeft=60;
  const btn=document.getElementById('btn-fetch-games');
  const btnText=document.getElementById('btn-fetch-text');
  const cdText=document.getElementById('cooldown-text');
  const cdBarC=document.getElementById('cooldown-bar-container');
  const cdBar=document.getElementById('cooldown-bar');
  btn.disabled=true;
  cdBarC.classList.remove('hidden');
  cdText.classList.remove('hidden');
  cdBar.classList.remove('cooldown-bar');
  void cdBar.offsetWidth;
  cdBar.classList.add('cooldown-bar');
  const upd=()=>{btnText.textContent=`⏳ Aguarde ${cooldownSecondsLeft}s`;cdText.textContent=`Nova busca disponível em ${cooldownSecondsLeft}s`;};
  upd();
  cooldownInterval=setInterval(()=>{
    cooldownSecondsLeft--;
    if(cooldownSecondsLeft<=0){
      clearInterval(cooldownInterval);cooldownInterval=null;cooldownSecondsLeft=0;
      btn.disabled=false;btnText.textContent='⚽ Buscar Jogos de Hoje';
      cdText.classList.add('hidden');cdBarC.classList.add('hidden');
    }else{upd();}
  },1000);
}

function populateLeagues(games){
  const sel=document.getElementById('leagueFilter');
  sel.innerHTML='<option value="">Todas as Ligas</option>';
  [...new Set(games.map(g=>g.competition.name))].sort().forEach(liga=>{
    const o=document.createElement('option');o.value=liga;o.textContent=liga;sel.appendChild(o);
  });
}

function formatTransmissao(broadcastsArray){
  if(!broadcastsArray||broadcastsArray.length===0)
    return '<span class="text-slate-500 text-xs italic">Transmissão não confirmada</span>';

  return broadcastsArray.map(broadcast=>{
    let logo=null;
    const channelName = broadcast.name || '';
    const cl=channelName.toLowerCase().replace(/\s+/g,'');

    // 1. Tenta match exato sem espaços (ex: "sportv2" → 'sportv')
    // 2. Tenta startsWith no original (ex: "SporTV 2" começa com "sportv")
    // 3. Tenta includes como último recurso
    for (const [k, u] of Object.entries(channelLogos)) {
      const kl = k.toLowerCase();
      if (cl === kl) { logo = u; break; }
    }
    if (!logo) {
      for (const [k, u] of Object.entries(channelLogos)) {
        if (channelName.toLowerCase().startsWith(k.toLowerCase())) { logo = u; break; }
      }
    }
    if (!logo) {
      for (const [k, u] of Object.entries(channelLogos)) {
        if (channelName.toLowerCase().includes(k.toLowerCase())) { logo = u; break; }
      }
    }
    const img=logo?`<img src="${logo}" alt="" class="h-3.5 w-auto inline-block flex-shrink-0" onerror="this.style.display='none'">`:'' ;
    return `<span class="inline-flex items-center gap-1 bg-slate-800 dark:bg-slate-700 text-slate-200 text-xs px-1.5 py-0.5 rounded font-medium">${img}<span>${channelName}</span></span>`;
  }).join('');
}

function toggleFavorite(name){
  const i=favoriteTeams.indexOf(name);
  if(i===-1){favoriteTeams.push(name);}else{favoriteTeams.splice(i,1);}
  localStorage.setItem('favoriteTeams',JSON.stringify(favoriteTeams));
  filterGames();
}

function getStatusBadge(statusCode){
  if(statusCode==='NS')return'<span class="text-xs text-slate-500 whitespace-nowrap">Não iniciado</span>';
  if(['1H','2H','ET'].includes(statusCode))return'<span class="inline-flex items-center gap-1 text-xs font-bold text-red-500 live-pulse"><span class="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"></span>Ao Vivo</span>';
  if(statusCode==='HT')return'<span class="text-xs font-medium text-yellow-500">Intervalo</span>';
  if(['FT','AET','PEN'].includes(statusCode))return'<span class="text-xs text-slate-500">Encerrado</span>';
  return`<span class="text-xs text-slate-500">${statusCode}</span>`;
}

function escudo(logo, nome) {
  const ini = nome.charAt(0);
  const fallback = `<span class="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 flex-shrink-0">${ini}</span>`;
  if (!logo) return fallback;
  return `<span class="relative inline-flex flex-shrink-0" style="width:28px;height:28px">
    <img src="${logo}" alt="" style="width:28px;height:28px;object-fit:contain"
      onload="this.nextElementSibling.style.display='none'"
      onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
    <span class="w-7 h-7 rounded-full bg-slate-700 text-slate-300 text-xs font-bold absolute inset-0 items-center justify-center" style="display:flex">${ini}</span>
  </span>`;
}

function createGameRow(game){
  const fM=favoriteTeams.includes(game.home.name);
  const fV=favoriteTeams.includes(game.away.name);
  const mE=game.home.name.replace(/'/g,"\\'");
  const vE=game.away.name.replace(/'/g,"\\'");
  const row=document.createElement('div');
  row.className='game-row flex items-center gap-2 sm:gap-3 px-3 py-2.5 rounded-lg transition-colors';
  row.innerHTML = `
  <div class="w-16 flex-shrink-0 text-center">
    <div class="text-sm font-mono font-bold text-slate-700 dark:text-slate-200">${game.kickoff}</div>
    <div class="mt-0.5">${getStatusBadge(game.status.code)}</div>
  </div>

  <div class="flex items-center gap-1.5 flex-1 justify-end min-w-0">
    <button onclick="toggleFavorite('${mE}')" class="text-base p-1 hover:scale-125 transition-transform flex-shrink-0" style="min-width:28px;min-height:28px" title="Favoritar ${game.home.name}">${fM?'⭐':'☆'}</button>
    <span class="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate text-right">${game.home.name}</span>
    ${escudo(game.home.logo, game.home.name)}
  </div>

  <div class="flex-shrink-0 w-14 text-center">
    <span class="text-base font-black text-slate-800 dark:text-white tracking-tight">
      ${game.score.home !== null ? game.score.home : '-'} x ${game.score.away !== null ? game.score.away : '-'}
    </span>
  </div>

  <div class="flex items-center gap-1.5 flex-1 justify-start min-w-0">
    ${escudo(game.away.logo, game.away.name)}
    <span class="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">${game.away.name}</span>
    <button onclick="toggleFavorite('${vE}')" class="text-base p-1 hover:scale-125 transition-transform flex-shrink-0" style="min-width:28px;min-height:28px" title="Favoritar ${game.away.name}">${fV?'⭐':'☆'}</button>
  </div>

  <div class="flex-shrink-0 flex flex-wrap justify-end gap-1 min-w-[90px] max-w-[150px]">
    ${formatTransmissao(game.broadcasts)}
  </div>
  `;
  return row;
}

function buildSection(title,logoUrl,games){
  const sec=document.createElement('div');
  sec.className='bg-white dark:bg-[#111827] rounded-xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-800';
  const logoEl=logoUrl?`<img src="${logoUrl}" alt="" class="w-5 h-5 object-contain" onerror="this.style.display='none'">`:'' ;
  const hdr=document.createElement('div');
  hdr.className='flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-[#0f172a] border-b border-slate-100 dark:border-slate-800';
  hdr.innerHTML=`${logoEl}<span class="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">${title}</span><span class="ml-auto text-xs text-slate-400">${games.length} jogo${games.length!==1?'s':''}</span>`;
  sec.appendChild(hdr);
  const list=document.createElement('div');
  list.className='divide-y divide-slate-50 dark:divide-slate-800';
  games.forEach(g=>list.appendChild(createGameRow(g)));
  sec.appendChild(list);
  return sec;
}

function renderGames(games){
  const grid=document.getElementById('games-grid');
  grid.innerHTML='';
  if(!games.length){grid.innerHTML='<div class="py-12 text-center"><p class="text-slate-400 text-sm">Nenhum jogo encontrado.</p></div>';return;}
  const favs=games.filter(g=>favoriteTeams.includes(g.home.name)||favoriteTeams.includes(g.away.name));
  const others=games.filter(g=>!favoriteTeams.includes(g.home.name)&&!favoriteTeams.includes(g.away.name));
  if(favs.length)grid.appendChild(buildSection('⭐ Seus Jogos',null,favs));
  if(others.length){
    const grouped=new Map();
    others.forEach(g=>{if(!grouped.has(g.competition.name))grouped.set(g.competition.name,{logo:g.competition.logo||'',games:[]});grouped.get(g.competition.name).games.push(g);});
    Array.from(grouped.keys()).sort().forEach(liga=>{
      const{logo,games:lg}=grouped.get(liga);
      grid.appendChild(buildSection(liga,logo,lg));
    });
  }
  const hasLive=games.some(g=>['1H','2H','ET','HT'].includes(g.status.code));
  if(hasLive){startAutoRefresh();}else{stopAutoRefresh();}
}

function filterGames(){
  const s=document.getElementById('searchInput').value.trim().toLowerCase();
  const l=document.getElementById('leagueFilter').value;
  document.getElementById('filter-badge').classList.toggle('hidden',!(s||l));
  renderGames(allGames.filter(g=>{
    const ms=!s||g.home.name.toLowerCase().includes(s)||g.away.name.toLowerCase().includes(s);
    const ml=!l||g.competition.name===l;
    return ms&&ml;
  }));
}

function clearFilters(){
  document.getElementById('searchInput').value='';
  document.getElementById('leagueFilter').value='';
  document.getElementById('filter-badge').classList.add('hidden');
  filterGames();
}

function startAutoRefresh(){
  if(autoRefreshInterval)return;
  autoRefreshSecondsLeft=60;
  const upd=()=>{const el=document.getElementById('auto-refresh-header');if(el){el.classList.remove('hidden');el.textContent=`🔄 Atualizando automaticamente em ${autoRefreshSecondsLeft}s`;}};
  upd();
  autoRefreshCountdownInterval=setInterval(()=>{autoRefreshSecondsLeft=Math.max(0,autoRefreshSecondsLeft-1);upd();},1000);
  autoRefreshInterval=setInterval(()=>{autoRefreshSecondsLeft=60;fetchGames();},60000);
}

function stopAutoRefresh(){
  if(autoRefreshInterval){clearInterval(autoRefreshInterval);autoRefreshInterval=null;}
  if(autoRefreshCountdownInterval){clearInterval(autoRefreshCountdownInterval);autoRefreshCountdownInterval=null;}
  const el=document.getElementById('auto-refresh-header');if(el)el.classList.add('hidden');
}

document.addEventListener('DOMContentLoaded',()=>{
  const tg=document.getElementById('theme-toggle');
  const html=document.documentElement;
  const saved=localStorage.getItem('theme');
  const dark=saved==='dark'||(!saved&&window.matchMedia('(prefers-color-scheme: dark)').matches);
  if(dark){html.classList.add('dark');tg.textContent='☀️';}else{html.classList.remove('dark');tg.textContent='🌙';}
  tg.addEventListener('click',()=>{
    html.classList.toggle('dark');
    const d=html.classList.contains('dark');
    tg.textContent=d?'☀️':'🌙';
    localStorage.setItem('theme',d?'dark':'light');
  });
  document.getElementById('btn-fetch-games').addEventListener('click',()=>fetchGames(false));
  document.getElementById('btn-force-refresh').addEventListener('click',()=>fetchGames(true));
  document.getElementById('btn-toggle-filters').addEventListener('click',()=>{
    filtersOpen=!filtersOpen;
    document.getElementById('filter-panel').classList.toggle('open',filtersOpen);
  });
  document.getElementById('btn-clear-filters').addEventListener('click',clearFilters);
  document.getElementById('searchInput').addEventListener('input',filterGames);
  document.getElementById('leagueFilter').addEventListener('change',filterGames);
});