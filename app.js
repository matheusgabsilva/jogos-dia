const API_URL = 'https://script.google.com/macros/s/AKfycbyeIhHH5-LxPr4HGM20Z6RYr-AvXmRPr9ftj8p4Sbz3O0M1vYSStjl_X7XNdTz7zeOQ/exec';
let allGames = [];
const channelLogos = {
    'globo': 'https://upload.wikimedia.org/wikipedia/commons/2/24/TV_Globo_logo.svg',
    'sportv': 'https://upload.wikimedia.org/wikipedia/commons/3/33/SporTV_logo.svg',
    'premiere': 'https://upload.wikimedia.org/wikipedia/commons/f/f6/Premiere_logo_2021.svg',
    'espn': 'https://upload.wikimedia.org/wikipedia/commons/a/a2/ESPN_logo.svg',
    'disney': 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg',
    'max': 'https://upload.wikimedia.org/wikipedia/commons/c/ce/Max_logo.svg',
    'prime': 'https://upload.wikimedia.org/wikipedia/commons/1/11/Amazon_Prime_Video_logo.svg',
    'paramount': 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Paramount_Plus.svg',
    'sbt': 'https://upload.wikimedia.org/wikipedia/commons/a/a9/SBT_logo_2021.svg',
    'record': 'https://upload.wikimedia.org/wikipedia/commons/6/6c/Record_logo.svg',
    'band': 'https://upload.wikimedia.org/wikipedia/commons/4/4b/Band_logo.svg',
    'youtube': 'https://upload.wikimedia.org/wikipedia/commons/b/b8/YouTube_Logo_2017.svg',
    'cazé': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Caz%C3%A9TV_logo.png/320px-Caz%C3%A9TV_logo.png',
    'caze': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Caz%C3%A9TV_logo.png/320px-Caz%C3%A9TV_logo.png'
};

function fetchGames() {
    const loadingDiv = document.getElementById('loading');
    const gamesGrid = document.getElementById('games-grid');

    loadingDiv.style.display = 'block';
    gamesGrid.innerHTML = '';

    fetch(API_URL)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Erro na rede: ${response.status}`);
            }
            return response.json();
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
            console.error(error);
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
    if (!transmissaoStr || transmissaoStr.toLowerCase().includes('sem transmissão') || transmissaoStr.toLowerCase().includes('não informado')) {
        return '<span class="text-gray-500 italic dark:text-slate-400">Sem transmissão</span>';
    }

    const channels = transmissaoStr.split(',').map(channel => channel.trim());
    const logoElements = [];

    channels.forEach(channel => {
        let found = false;
        for (const [key, logoUrl] of Object.entries(channelLogos)) {
            if (channel.toLowerCase().includes(key.toLowerCase())) {
                logoElements.push(`<img src="${logoUrl}" alt="${key}" class="h-4 w-auto inline-block mr-1">`);
                found = true;
                break;
            }
        }
        if (!found) {
            logoElements.push(`<span class="text-gray-600 dark:text-slate-400">${channel}</span>`);
        }
    });

    return logoElements.join(' ');
}

function renderGames(gamesToRender) {
    const gamesGrid = document.getElementById('games-grid');
    gamesGrid.innerHTML = '';

    if (gamesToRender.length === 0) {
        gamesGrid.innerHTML = '<p class="text-gray-500 text-center w-full dark:text-slate-400">Nenhum jogo encontrado.</p>';
        return;
    }

    // Group by league (index 1)
    const grouped = new Map();
    gamesToRender.forEach(game => {
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
            const [horario, liga, rodada, mandante, placar, visitante, status, transmissao] = game;
            const card = document.createElement('div');
            card.className = 'bg-white rounded-lg shadow-md p-4 flex flex-col h-full dark:bg-slate-800 dark:border-slate-700';

            // Card content: horario at top right, then confronto, then transmissao
            card.innerHTML = `
                <div class="mb-2 text-sm text-right">${horario}</div>
                <div class="flex-grow flex flex-col justify-between">
                    <div class="text-xl font-bold text-center mb-2 dark:text-slate-100">
                        ${mandante} <span class="text-gray-500 mx-2 dark:text-slate-400">${placar}</span> ${visitante}
                    </div>
                </div>
                <div class="mt-3 px-2 py-1 bg-emerald-100 text-emerald-800 text-sm font-medium rounded text-center dark:bg-emerald-900 dark:text-emerald-200">
                    ${formatTransmissao(transmissao)}
                </div>
            `;
            gamesContainer.appendChild(card);
        });

        section.appendChild(gamesContainer);
        gamesGrid.appendChild(section);
    });
}

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

    fetchGames();
    // Add event listeners after DOM is loaded
    document.getElementById('searchInput').addEventListener('input', filterGames);
    document.getElementById('leagueFilter').addEventListener('change', filterGames);
});