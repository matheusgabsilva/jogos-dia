const API_URL = 'https://api.matheusgabsilva.digital'; // REPLACE WITH ACTUAL WORKER URL AFTER DEPLOYMENT
let allGames = [];
let favoriteTeams = JSON.parse(localStorage.getItem('favoriteTeams')) || [];
let autoRefreshInterval = null; // Stores the setInterval ID for auto-refresh
let autoRefreshSecondsLeft = 0; // Countdown for header display
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

    // Cache-buster: add timestamp to force fresh request
    const urlWithCacheBuster = `${API_URL}?t=${new Date().getTime()}`;

    fetch(urlWithCacheBuster)
        .then(async response => {
            const text = await response.text();
            if (!response.ok) {
                throw new Error(`Erro na rede: ${response.status} - ${text.substring(0, 200)}`);
            }
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
            // Assuming data is a 2D array where first two rows are headers
            const games = data.slice(2); // skip header rows
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
    // Clear existing options except the first default one
    leagueFilter.innerHTML = '<option value="">Todas as Ligas</option>';

    // Get unique leagues
    const leagues = [...new Set(games.map(game => game[1]))].sort(); // index 1 is liga

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

        // Sempre mostra o nome completo do canal (ESPN 2, SporTV 3, etc.)
        return `<span class="inline-flex items-center gap-1 bg-slate-700 text-white text-xs font-medium px-2 py-0.5 rounded-full mr-1">
            ${imgTag}
            <span>${channel}</span>
        </span>`;
    }).join('');
}

function toggleFavorite(teamName) {
    // Escape single quotes in teamName for storage? We store as is.
    const index = favoriteTeams.indexOf(teamName);
    if (index === -1) {
        favoriteTeams.push(teamName);
    } else {
        favoriteTeams.splice(index, 1);
    }
    localStorage.setItem('favoriteTeams', JSON.stringify(favoriteTeams));
    filterGames(); // re-render immediately
}

function createCardElement(game) {
    const [horario, liga, rodada, mandante, placar, visitante, status, transmissao] = game;
    const card = document.createElement('div');
    card.className = 'bg-white rounded-lg shadow-md p-4 flex flex-col h-full dark:bg-slate-800 dark:border-slate-700 relative';
    const isFavMand = favoriteTeams.includes(mandante);
    const isFavVisit = favoriteTeams.includes(visitante);
    // Escape single quotes for inline onclick
    const mandanteEscaped = mandante.replace(/'/g, "\\'");
    const visitanteEscaped = visitante.replace(/'/g, "\\'");

    // Status badge mapping
    let statusText = 'Não iniciado';
    let statusClass = 'bg-gray-200 text-gray-800';
    let statusAnimation = '';

    switch (status) {
        case 'NS':
            statusText = 'Não iniciado';
            statusClass = 'bg-gray-200 text-gray-800';
            break;
        case '1H':
        case '2H':
        case 'ET':
            statusText = 'Ao Vivo';
            statusClass = 'bg-green-100 text-green-800 animate-pulse';
            break;
        case 'HT':
            statusText = 'Intervalo';
            statusClass = 'bg-yellow-100 text-yellow-800';
            break;
        case 'FT':
        case 'AET':
        case 'PEN':
            statusText = 'Encerrado';
            statusClass = 'bg-slate-200 text-slate-800';
            break;
        default:
            statusText = status;
            statusClass = 'bg-gray-200 text-gray-800';
    }

    card.innerHTML = `
        <div class="mb-2 flex justify-between items-center text-sm position-relative">
            <span class="text-xs font-bold uppercase text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded truncate max-w-[50%]">${liga}</span>
            <span>${horario}</span>
            <span class="absolute right-0 top-0 mt-2 mr-2 px-2 py-1 text-xs font-bold rounded ${statusClass} ${statusAnimation}">${statusText}</span>
        </div>
        <div class="flex-grow flex flex-col justify-between">
            <div class="text-xl font-bold text-center mb-2 dark:text-slate-100">
                <span onclick="toggleFavorite('${mandanteEscaped}')" class="cursor-pointer text-xl">${isFavMand ? '⭐' : '☆'}</span> ${mandante} <span class="text-gray-500 mx-2 dark:text-slate-400">${placar}</span> <span onclick="toggleFavorite('${visitanteEscaped}')" class="cursor-pointer text-xl">${isFavVisit ? '⭐' : '☆'}</span> ${visitante}
            </div>
        </div>
        <div class="mt-3 px-2 py-1 bg-emerald-100 text-emerald-800 text-sm font-medium rounded text-center dark:bg-emerald-900 dark:text-emerald-200">
            ${formatTransmissao(transmissao)}
        </div>
    `;
    return card;
}

function renderGames(gamesToRender) {
    const gamesGrid = document.getElementById('games-grid');
    gamesGrid.innerHTML = '';

    if (gamesToRender.length === 0) {
        gamesGrid.innerHTML = '<p class="text-gray-500 text-center w-full dark:text-slate-400">Nenhum jogo encontrado.</p>';
        return;
    }

    // Separate favorites and others
    const favoriteGames = [];
    const otherGames = [];

    gamesToRender.forEach(game => {
        const [horario, liga, rodada, mandante, placar, visitante, status, transmissao] = game;
        if (favoriteTeams.includes(mandante) || favoriteTeams.includes(visitante)) {
            favoriteGames.push(game);
        } else {
            otherGames.push(game);
        }
    });

    // Render favorite games section if any
    if (favoriteGames.length > 0) {
        const favSection = document.createElement('div');
        const favTitle = document.createElement('h2');
        favTitle.className = 'text-xl font-bold text-slate-700 dark:text-slate-200 border-b-2 border-emerald-500 dark:border-emerald-600 pb-2 mb-4 mt-8 flex items-center gap-2';
        favTitle.innerHTML = '⭐ Seus Jogos';
        favSection.appendChild(favTitle);

        const favGrid = document.createElement('div');
        favGrid.className = 'grid gap-5 sm:grid-cols-2 lg:grid-cols-3';

        favoriteGames.forEach(game => {
            favGrid.appendChild(createCardElement(game));
        });

        favSection.appendChild(favGrid);
        gamesGrid.appendChild(favSection);
    }

    // Render other games grouped by league
    if (otherGames.length > 0) {
        // Group by league (index 1)
        const grouped = new Map();
        otherGames.forEach(game => {
            const liga = game[1];
            if (!grouped.has(liga)) {
                grouped.set(liga, []);
            }
            grouped.get(liga).push(game);
        });

        // Sort leagues alphabetically
        const sortedLeagues = Array.from(grouped.keys()).sort();

        sortedLeagues.forEach(liga => {
            const ligaGames = grouped.get(liga);

            // Create section container
            const section = document.createElement('div');

            // League title
            const title = document.createElement('h2');
            title.className = 'text-xl font-bold text-slate-700 dark:text-slate-200 border-b-2 border-emerald-500 dark:border-emerald-600 pb-2 mb-4 mt-8 flex items-center gap-2';
            title.innerHTML = `⚽ ${liga}`;
            section.appendChild(title);

            // Grid for games of this league
            const gamesContainer = document.createElement('div');
            gamesContainer.className = 'grid gap-5 sm:grid-cols-2 lg:grid-cols-3';

            // Create cards for each game in this league
            ligaGames.forEach(game => {
                gamesContainer.appendChild(createCardElement(game));
            });

            section.appendChild(gamesContainer);
            gamesGrid.appendChild(section);
        });
    }

// Auto-refresh for live games
    const hasLiveGames = gamesToRender.some(game => {
        const status = game[6]; // status is at index 6
        return ['1H', '2H', 'ET', 'HT'].includes(status);
    });

    if (hasLiveGames && !autoRefreshInterval) {
        // Start auto-refresh
        autoRefreshInterval = setInterval(() => {
            fetchGames();
            // Update the header indicator
            updateAutoRefreshHeader(60);
        }, 60000);

        // Show initial header indicator
        updateAutoRefreshHeader(60);
    } else if (!hasLiveGames && autoRefreshInterval) {
        // Stop auto-refresh if no live games
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        removeAutoRefreshHeader();
    }

// Auto-refresh header functions
function updateAutoRefreshHeader(seconds) {
    autoRefreshSecondsLeft = seconds;
    const header = document.getElementById('auto-refresh-header');
    if (!header) {
        // Create header element
        const headerDiv = document.createElement('div');
        headerDiv.id = 'auto-refresh-header';
        headerDiv.className = 'text-xs text-blue-600 dark:text-blue-400 mb-2';
        headerDiv.innerHTML = `🔄 Atualizando em ${autoRefreshSecondsLeft}s...`;

        // Insert after the loading div or at the top of games container
        const loadingDiv = document.getElementById('loading');
        const gamesGrid = document.getElementById('games-grid');
        if (loadingDiv && loadingDiv.parentNode) {
            loadingDiv.parentNode.insertBefore(headerDiv, loadingDiv.nextSibling);
        } else if (gamesGrid && gamesGrid.parentNode) {
            gamesGrid.parentNode.insertBefore(headerDiv, gamesGrid);
        } else {
            document.body.insertBefore(headerDiv, document.body.firstChild);
        }
    } else {
        header.innerHTML = `🔄 Atualizando em ${autoRefreshSecondsLeft}s...`;
    }
}

function removeAutoRefreshHeader() {
    const header = document.getElementById('auto-refresh-header');
    if (header) {
        header.remove();
    }
    autoRefreshSecondsLeft = 0;
}

// Update fetchGames to handle countdown
const originalFetchGames = fetchGames;
function fetchGames() {
    // Update countdown if active
    if (autoRefreshInterval && autoRefreshSecondsLeft > 0) {
        autoRefreshSecondsLeft--;
        const header = document.getElementById('auto-refresh-header');
        if (header) {
            header.innerHTML = `🔄 Atualizando em ${autoRefreshSecondsLeft}s...`;
        }

        // If countdown reaches 0, it will be updated on next interval tick
    }

    // Call original fetchGames
    return originalFetchGames.call(this);
}

// Rebind fetchGames to maintain correct context
window.fetchGames = fetchGames;

function filterGames() {
    const searchInput = document.getElementById('searchInput').value.trim().toLowerCase();
    const leagueFilter = document.getElementById('leagueFilter').value;

    const filteredGames = allGames.filter(game => {
        const [horario, liga, rodada, mandante, placar, visitante, status, transmissao] = game;
        const matchesSearch = !searchInput ||
            mandante.toLowerCase().includes(searchInput) ||
            visitante.toLowerCase().includes(searchInput);
        const matchesLeague = !leagueFilter || liga === leagueFilter;
        return matchesSearch && matchesLeague;
    });

    renderGames(filteredGames);
}

// Execute when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Dark mode initialization
    const themeToggle = document.getElementById('theme-toggle');
    const htmlElement = document.documentElement;

    // Check localStorage or system preference
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        htmlElement.classList.add('dark');
        themeToggle.textContent = '☀️';
    } else {
        htmlElement.classList.remove('dark');
        themeToggle.textContent = '🌙';
    }

    // Theme toggle event listener
    themeToggle.addEventListener('click', () => {
        htmlElement.classList.toggle('dark');
        if (htmlElement.classList.contains('dark')) {
            themeToggle.textContent = '☀️';
            localStorage.setItem('theme', 'dark');
        } else {
            themeToggle.textContent = '🌙';
            localStorage.setItem('theme', 'light');
        }
    });

    // Add event listeners after DOM is loaded
    document.getElementById('searchInput').addEventListener('input', filterGames);
    document.getElementById('leagueFilter').addEventListener('change', filterGames);
    document.getElementById('btn-fetch-games').addEventListener('click', fetchGames);
});