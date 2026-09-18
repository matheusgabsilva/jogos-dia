const API_URL = 'https://api.matheusgabsilva.digital';
let allGames = [];
let favoriteTeams = JSON.parse(localStorage.getItem('favoriteTeams')) || [];
let autoRefreshInterval = null;
let autoRefreshCountdownInterval = null;
let autoRefreshSecondsLeft = 0;

const channelLogos = {
    'globo': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/TV_Globo_logo.svg/320px-TV_Globo_logo.svg.png',
    'sportv': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/SporTV_logo.svg/320px-SporTV_logo.svg.png',
    'premiere': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Premiere_logo_2021.svg/320px-Premiere_logo_2021.svg.png',
    'espn': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/ESPN_logo.svg/320px-ESPN_logo.svg.png',
    'disney': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Disney%2B_logo.svg/320px-Disney%2B_logo.svg.png',
    'max': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Max_logo.svg/320px-Max_logo.svg.png',
    'prime': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Amazon_Prime_Video_logo.svg/320px-Amazon_Prime_Video_logo.svg.png',
    'paramount': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Paramount_Plus.svg/320px-Paramount_Plus.svg.png',
    'sbt': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/SBT_logo_2021.svg/320px-SBT_logo_2021.svg.png',
    'band': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Band_logo.svg/320px-Band_logo.svg.png',
    'youtube': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/YouTube_Logo_2017.svg/320px-YouTube_Logo_2017.svg.png',
    'cazé': 'https://upload.wikimedia.org/wikipedia/pt/thumb/6/68/Caz%C3%A9TV.png/200px-Caz%C3%A9TV.png',
    'caze': 'https://upload.wikimedia.org/wikipedia/pt/thumb/6/68/Caz%C3%A9TV.png/200px-Caz%C3%A9TV.png',
    'dazn': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/DAZN_-_Logo.svg/320px-DAZN_-_Logo.svg.png',
    'record': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Record_logo.svg/320px-Record_logo.svg.png',
};

function fetchGames() {
    const loadingDiv = document.getElementById('loading');
    const gamesGrid = document.getElementById('games-grid');
    loadingDiv.style.display = 'block';
    gamesGrid.innerHTML = '';
    const urlWithCacheBuster = `${API_URL}?t=${new Date().getTime()}`;
    fetch(urlWithCacheBuster)
        .then(async response => {
            const text = await response.text();
            if (!response.ok) throw new Error(`Erro na rede: ${response.status} - ${text.substring(0, 200)}`);
            try {
                const data = JSON.parse(text);
                console.log("Dados recebidos da API:", data);
                return data;
            } catch (e) {
                throw new Error(`Resposta inválida (não JSON): ${text.substring(0, 200)}`);
            }
        })
        .then(data => {
            loadingDiv.style.display = 'none';
            const games = data.slice(2);
            console.log("Total de jogos após slice:", games.length, "| Primeira linha:", data[0]);
            allGames = games;
            populateLeagues(allGames);
            renderGames(allGames);
        })
        .catch(error => {
            loadingDiv.style.display = 'none';
            gamesGrid.innerHTML = `<p class="text-red-500 text-center w-full">Erro ao carregar jogos: ${error.message}</p>`;
            console.error("Detalhes do erro na API:", error);
        });
}

function populateLeagues(games) {
    const leagueFilter = document.getElementById('leagueFilter');
    leagueFilter.innerHTML = '<option value="">Todas as Ligas</option>';
    const leagues = [...new Set(games.map(game => game[1]))].sort();
    leagues.forEach(league => {
        const option = document.createElement('option');
        option.value = league;
        option.textContent = league;
        leagueFilter.appendChild(option);
    });
}

function formatTransmissao(transmissaoStr) {
    if (!transmissaoStr ||
        transmissaoStr.toLowerCase().includes('sem transmissão') ||
        transmissaoStr.toLowerCase().includes('não informado')) {
        return '<span class="text-gray-500 italic dark:text-slate-400">Sem transmissão</span>';
    }
    const channels = transmissaoStr.split(',').map(ch => ch.trim()).filter(Boolean);
    return channels.map(channel => {
        let logoUrl = null;
        let logoAlt = channel;
        for (const [key, url] of Object.entries(channelLogos)) {
            if (channel.toLowerCase().startsWith(key.toLowerCase()) ||
                channel.toLowerCase().includes(key.toLowerCase())) {
                logoUrl = url;
                logoAlt = key;
                break;
            }
        }
        const imgTag = logoUrl
            ? `<img src="${logoUrl}" alt="${logoAlt}" class="h-4 w-auto inline-block" onerror="this.style.display='none'">`
            : '';
        return `<span class="inline-flex items-center gap-1 bg-slate-700 text-white text-xs font-medium px-2 py-0.5 rounded-full mr-1 mb-1">${imgTag}<span>${channel}</span></span>`;
    }).join('');
}

function toggleFavorite(teamName) {
    const index = favoriteTeams.indexOf(teamName);
    if (index === -1) { favoriteTeams.push(teamName); } else { favoriteTeams.splice(index, 1); }
    localStorage.setItem('favoriteTeams', JSON.stringify(favoriteTeams));
    filterGames();
}

function getStatusBadge(status) {
    switch (status) {
        case 'NS': return { text: 'Não iniciado', cls: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300' };
        case '1H': case '2H': case 'ET': return { text: '🔴 Ao Vivo', cls: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 animate-pulse' };
        case 'HT': return { text: 'Intervalo', cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' };
        case 'FT': case 'AET': case 'PEN': return { text: 'Encerrado', cls: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300' };
        default: return { text: status, cls: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300' };
    }
}

function createCardElement(game) {
    const [horario, liga, rodada, mandante, placar, visitante, status, transmissao] = game;
    const card = document.createElement('div');
    card.className = 'bg-white rounded-lg shadow-md p-4 flex flex-col h-full dark:bg-slate-800 dark:border-slate-700 relative';
    const isFavMand = favoriteTeams.includes(mandante);
    const isFavVisit = favoriteTeams.includes(visitante);
    const mandanteEscaped = mandante.replace(/'/g, "\\'");
    const visitanteEscaped = visitante.replace(/'/g, "\\'");
    const badge = getStatusBadge(status);
    card.innerHTML = `
        <div class="mb-2 flex justify-between items-center text-sm gap-2">
            <span class="text-xs font-bold uppercase text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded truncate max-w-[40%]">${liga}</span>
            <span class="text-gray-500 dark:text-slate-400 text-xs">${horario}</span>
            <span class="text-xs font-semibold px-2 py-1 rounded-full ${badge.cls}">${badge.text}</span>
        </div>
        <div class="flex-grow flex flex-col justify-between">
            <div class="text-base font-bold text-center my-2 dark:text-slate-100 leading-snug">
                <span onclick="toggleFavorite('${mandanteEscaped}')" class="cursor-pointer">${isFavMand ? '⭐' : '☆'}</span>
                ${mandante}
                <span class="text-gray-500 mx-2 dark:text-slate-400">${placar}</span>
                <span onclick="toggleFavorite('${visitanteEscaped}')" class="cursor-pointer">${isFavVisit ? '⭐' : '☆'}</span>
                ${visitante}
            </div>
        </div>
        <div class="mt-3 px-2 py-2 bg-emerald-50 dark:bg-slate-700 rounded text-center flex flex-wrap justify-center gap-1">
            ${formatTransmissao(transmissao)}
        </div>
    `;
    return card;
}

function updateAutoRefreshHeader() {
    let header = document.getElementById('auto-refresh-header');
    if (!header) {
        header = document.createElement('div');
        header.id = 'auto-refresh-header';
        header.className = 'w-full text-center text-xs text-blue-600 dark:text-blue-400 py-1 font-medium';
        const loadingDiv = document.getElementById('loading');
        if (loadingDiv && loadingDiv.parentNode) loadingDiv.parentNode.insertBefore(header, loadingDiv.nextSibling);
    }
    header.textContent = `🔄 Atualizando em ${autoRefreshSecondsLeft}s...`;
}

function removeAutoRefreshHeader() {
    const header = document.getElementById('auto-refresh-header');
    if (header) header.remove();
    autoRefreshSecondsLeft = 0;
    if (autoRefreshCountdownInterval) { clearInterval(autoRefreshCountdownInterval); autoRefreshCountdownInterval = null; }
}

function startAutoRefresh() {
    if (autoRefreshInterval) return;
    autoRefreshSecondsLeft = 60;
    updateAutoRefreshHeader();
    autoRefreshCountdownInterval = setInterval(() => {
        autoRefreshSecondsLeft--;
        if (autoRefreshSecondsLeft <= 0) autoRefreshSecondsLeft = 0;
        updateAutoRefreshHeader();
    }, 1000);
    autoRefreshInterval = setInterval(() => { autoRefreshSecondsLeft = 60; fetchGames(); }, 60000);
}

function stopAutoRefresh() {
    if (autoRefreshInterval) { clearInterval(autoRefreshInterval); autoRefreshInterval = null; }
    removeAutoRefreshHeader();
}

function renderGames(gamesToRender) {
    const gamesGrid = document.getElementById('games-grid');
    gamesGrid.innerHTML = '';
    if (gamesToRender.length === 0) {
        gamesGrid.innerHTML = '<p class="text-gray-500 text-center w-full dark:text-slate-400">Nenhum jogo encontrado.</p>';
        return;
    }
    const favoriteGames = [];
    const otherGames = [];
    gamesToRender.forEach(game => {
        const [, , , mandante, , visitante] = game;
        if (favoriteTeams.includes(mandante) || favoriteTeams.includes(visitante)) { favoriteGames.push(game); } else { otherGames.push(game); }
    });
    if (favoriteGames.length > 0) {
        const favSection = document.createElement('div');
        const favTitle = document.createElement('h2');
        favTitle.className = 'text-xl font-bold text-slate-700 dark:text-slate-200 border-b-2 border-emerald-500 dark:border-emerald-600 pb-2 mb-4 mt-8 flex items-center gap-2';
        favTitle.innerHTML = '⭐ Seus Jogos';
        favSection.appendChild(favTitle);
        const favGrid = document.createElement('div');
        favGrid.className = 'grid gap-5 sm:grid-cols-2 lg:grid-cols-3';
        favoriteGames.forEach(game => favGrid.appendChild(createCardElement(game)));
        favSection.appendChild(favGrid);
        gamesGrid.appendChild(favSection);
    }
    if (otherGames.length > 0) {
        const grouped = new Map();
        otherGames.forEach(game => {
            const liga = game[1];
            if (!grouped.has(liga)) grouped.set(liga, []);
            grouped.get(liga).push(game);
        });
        Array.from(grouped.keys()).sort().forEach(liga => {
            const section = document.createElement('div');
            const title = document.createElement('h2');
            title.className = 'text-xl font-bold text-slate-700 dark:text-slate-200 border-b-2 border-emerald-500 dark:border-emerald-600 pb-2 mb-4 mt-8 flex items-center gap-2';
            title.innerHTML = `⚽ ${liga}`;
            section.appendChild(title);
            const gamesContainer = document.createElement('div');
            gamesContainer.className = 'grid gap-5 sm:grid-cols-2 lg:grid-cols-3';
            grouped.get(liga).forEach(game => gamesContainer.appendChild(createCardElement(game)));
            section.appendChild(gamesContainer);
            gamesGrid.appendChild(section);
        });
    }
    const hasLiveGames = gamesToRender.some(game => ['1H', '2H', 'ET', 'HT'].includes(game[6]));
    if (hasLiveGames) { startAutoRefresh(); } else { stopAutoRefresh(); }
}

function filterGames() {
    const searchInput = document.getElementById('searchInput').value.trim().toLowerCase();
    const leagueFilter = document.getElementById('leagueFilter').value;
    const filteredGames = allGames.filter(game => {
        const [, liga, , mandante, , visitante] = game;
        const matchesSearch = !searchInput || mandante.toLowerCase().includes(searchInput) || visitante.toLowerCase().includes(searchInput);
        const matchesLeague = !leagueFilter || liga === leagueFilter;
        return matchesSearch && matchesLeague;
    });
    renderGames(filteredGames);
}

document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    const htmlElement = document.documentElement;
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) { htmlElement.classList.add('dark'); themeToggle.textContent = '☀️'; }
    else { htmlElement.classList.remove('dark'); themeToggle.textContent = '🌙'; }
    themeToggle.addEventListener('click', () => {
        htmlElement.classList.toggle('dark');
        if (htmlElement.classList.contains('dark')) { themeToggle.textContent = '☀️'; localStorage.setItem('theme', 'dark'); }
        else { themeToggle.textContent = '🌙'; localStorage.setItem('theme', 'light'); }
    });
    document.getElementById('searchInput').addEventListener('input', filterGames);
    document.getElementById('leagueFilter').addEventListener('change', filterGames);
    document.getElementById('btn-fetch-games').addEventListener('click', fetchGames);
});