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
        return '<span class="text-gray-500 italic">Sem transmissão</span>';
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
            logoElements.push(`<span class="text-gray-600">${channel}</span>`);
        }
    });

    return logoElements.join(' ');
}

function renderGames(gamesToRender) {
    const gamesGrid = document.getElementById('games-grid');
    gamesGrid.innerHTML = '';

    if (gamesToRender.length === 0) {
        gamesGrid.innerHTML = '<p class="text-gray-500 text-center w-full col-span-3">Nenhum jogo encontrado.</p>';
        return;
    }

    gamesToRender.forEach(game => {
        const [horario, liga, rodada, mandante, placar, visitante, status, transmissao] = game;
        const card = document.createElement('div');
        card.className = 'bg-white rounded-lg shadow-md p-4 flex flex-col h-full';
        card.innerHTML = `
            <div class="mb-2 flex justify-between text-sm">
                <span class="font-medium text-teal-700">${liga}</span>
                <span class="text-gray-500">${horario}</span>
            </div>
            <div class="flex-grow flex flex-col justify-between">
                <div class="text-xl font-bold text-center mb-2">
                    ${mandante} <span class="text-gray-500 mx-2">${placar}</span> ${visitante}
                </div>
            </div>
            <div class="mt-3 px-2 py-1 bg-emerald-100 text-emerald-800 text-sm font-medium rounded text-center">
                ${formatTransmissao(transmissao)}
            </div>
        `;
        gamesGrid.appendChild(card);
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
    fetchGames();
    // Add event listeners after DOM is loaded
    document.getElementById('searchInput').addEventListener('input', filterGames);
    document.getElementById('leagueFilter').addEventListener('change', filterGames);
});