/**
 * Cloudflare Worker for Jogos do Dia API
 * Fetches data from API-Football, enriches with Gemini for Brazil transmissions,
 * and returns structured JSON compatible with the frontend.
 */

// Main league IDs (same as in the original Apps Script)
const LIGAS_PRINCIPAIS_IDS = [71, 72, 73, 13, 11, 39, 140, 135, 78, 61, 2, 3, 848, 75];
// Flag to show only games with transmission (set to true by default)
// NOTE: Keeping variable for reference but disabling filter to show all games
const APENAS_COM_TRANSMISSAO = true;

/**
 * Maps API-Football status short code to our structured status
 * @param {string} shortCode - The short status code from API-Football
 * @param {number|null} elapsed - The elapsed time from API-Football
 * @returns {Object} Structured status object
 */
function mapStatus(shortCode, elapsed) {
  const statusMap = {
    NS: { state: 'scheduled', label: 'Não iniciado' },
    1H: { state: 'live', label: 'Ao vivo' },
    2H: { state: 'live', label: 'Ao vivo' },
    ET: { state: 'live', label: 'Ao vivo' },
    HT: { state: 'halftime', label: 'Intervalo' },
    FT: { state: 'finished', label: 'Encerrado' },
    AET: { state: 'finished', label: 'Encerrado' },
    PEN: { state: 'finished', label: 'Encerrado' },
    // Add other statuses as needed
    LIVE: { state: 'live', label: 'Ao vivo' },
  };

  const mapped = statusMap[shortCode] || { state: 'scheduled', label: shortCode };
  return {
    code: shortCode,
    state: mapped.state,
    label: mapped.label,
    elapsed: elapsed !== null ? elapsed : null
  };
}

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // Only allow GET requests
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      // Get today's date in America/Sao_Paulo
      const today = new Date();
      const options = { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' };
      const hojeIso = today.toLocaleDateString('en-CA', options); // yyyy-mm-dd
      const hojeFormatado = today.toLocaleDateString('pt-BR', options); // dd/mm/yyyy
      const updatedAtIso = today.toISOString().replace('Z', '');
      const timezoneOffset = -today.getTimezoneOffset();
      const offsetHours = Math.floor(Math.abs(timezoneOffset) / 60);
      const offsetMinutes = Math.abs(timezoneOffset) % 60;
      const offsetString = (timezoneOffset >= 0 ? '+' : '-') +
        String(offsetHours).padStart(2, '0') + ':' + String(offsetMinutes).padStart(2, '0');
      const updatedAtWithTimezone = updatedAtIso.substring(0, 19) + offsetString;

      // Parse URL for force parameter
      const url = new URL(request.url);
      const forceRefresh = url.searchParams.get('force') === '1';

      // Cache configuration
      const CACHE_KEY = `jogos_${hojeIso}`;
      const CACHE_TTL_SECONDS = 7200; // 2 horas

      // Check cache first (unless force refresh)
      if (env.JOGOS_CACHE && !forceRefresh) {
        const cached = await env.JOGOS_CACHE.get(CACHE_KEY);
        if (cached) {
          console.log(`[CACHE HIT] Retornando dados cacheados para ${hojeIso}`);
          return new Response(cached, {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'X-Cache': 'HIT',
            },
          });
        }
        console.log(`[CACHE MISS] Buscando dados frescos para ${hojeIso}`);
      }

      // Fetch from API-Football with cache control headers
      const footballResponse = await fetch(
        `https://v3.football.api-sports.io/fixtures?date=${hojeIso}&timezone=America/Sao_Paulo`,
        {
          headers: {
            'x-apisports-key': env.API_KEY_FOOTBALL,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
        }
      );

      // Handle rate limit (429) specifically
      if (footballResponse.status === 429) {
        return new Response(JSON.stringify({
          ok: false,
          date: hojeIso,
          timezone: 'America/Sao_Paulo',
          updatedAt: updatedAtWithTimezone,
          games: [],
          error: {
            code: 'RATE_LIMIT',
            message: 'Limite de consultas atingido.'
          }
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          status: 200, // Return 200 so frontend doesn't treat as error
        });
      }

      if (!footballResponse.ok) {
        throw new Error(`API-Football error: ${footballResponse.status}`);
      }

      const footballData = await footballResponse.json();
      // If API-Football returns errors (rate limit, invalid token, etc.), return friendly message
      const hasErrors = footballData.errors && (Array.isArray(footballData.errors) ? footballData.errors.length > 0 : Object.keys(footballData.errors).length > 0);
      if (hasErrors) {
        return new Response(JSON.stringify({
          ok: false,
          date: hojeIso,
          timezone: 'America/Sao_Paulo',
          updatedAt: updatedAtWithTimezone,
          games: [],
          error: {
            code: 'API_ERROR',
            message: 'Não foi possível carregar os jogos.'
          }
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          status: 200, // Return 200 so frontend doesn't treat as error
        });
      }

      const fixtures = footballData.response || [];
      if (fixtures.length === 0) {
        // No games at all - return empty games array
        return new Response(JSON.stringify({
          ok: true,
          date: hojeIso,
          timezone: 'America/Sao_Paulo',
          updatedAt: updatedAtWithTimezone,
          games: []
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // Filter only main leagues
      const jogosFiltrados = fixtures.filter(item => LIGAS_PRINCIPAIS_IDS.includes(item.league.id));
      if (jogosFiltrados.length === 0) {
        // No games in main leagues - return empty games array
        return new Response(JSON.stringify({
          ok: true,
          date: hojeIso,
          timezone: 'America/Sao_Paulo',
          updatedAt: updatedAtWithTimezone,
          games: []
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // Structured logs at the beginning of fetch handler
      const ligasIds = [...new Set(jogosFiltrados.map(item => item.league.id))];
      console.log(`[Jogos do Dia] Processando ${jogosFiltrados.length} jogos das ligas: ${ligasIds.join(', ')}`);
      console.log(`[Jogos do Dia] GEMINI_API_KEY presente: !!${env.GEMINI_API_KEY}`);

      // Build base list of games with structured data
      const jogosEstruturados = jogosFiltrados.map(item => {
        // Map status
        const status = mapStatus(item.fixture.status.short, item.fixture.status.elapsed);

        // Build game object
        return {
          id: item.fixture.id,
          kickoff: item.fixture.date ? item.fixture.date.substring(11, 16) : '--:--',
          kickoffIso: item.fixture.date || null,
          competition: {
            id: item.league.id,
            name: item.league.name || 'Outros',
            round: item.league.round || '-',
            logo: item.league.logo || ''
          },
          home: {
            id: item.teams.home.id,
            name: item.teams.home.name || 'Mandante',
            logo: item.teams.home.logo || ''
          },
          away: {
            id: item.teams.away.id,
            name: item.teams.away.name || 'Visitante',
            logo: item.teams.away.logo || ''
          },
          score: {
            home: item.goals.home !== null ? item.goals.home : null,
            away: item.goals.away !== null ? item.goals.away : null
          },
          status: status,
          broadcasts: [] // Will be populated below
        };
      });

      // Prepare data for Gemini transmission lookup
      const jogosParaGemini = jogosEstruturados.map((jogo, index) => ({
        idLocal: index + 1,
        home: jogo.home.name,
        away: jogo.away.name,
        competition: jogo.competition.name,
        kickoff: jogo.kickoff
      }));

      // Batch call to Gemini for transmissions
      const mapaTransmissoes = await obterTransmissoesGemini(jogosParaGemini, hojeFormatado, env.GEMINI_API_KEY);

      // Populate broadcasts for each game
      jogosEstruturados.forEach((jogo, index) => {
        const transmissaoResult = mapaTransmissoes[index + 1] || [];
        jogo.broadcasts = transmissaoResult;
      });

      // Read APENAS_COM_TRANSMISSAO from environment variable (but ignore for now - show all games)
      // const apenasComTransmissao = env.APENAS_COM_TRANSMISSAO === 'true' || env.APENAS_COM_TRANSMISSAO === true;

      // NOTE: Intentionally NOT filtering by transmission to show all games as per Phase 1 decision
      // if (apenasComTransmissao) {
      //   const jogosComTransmissaoOriginal = jogosEstruturados.length;
      //   jogosEstruturados = jogosEstruturados.filter(j =>
      //     j.broadcasts &&
      //     j.broadcasts.length > 0
      //   );
      //   console.log(`Filtrados ${jogosComTransmissaoOriginal - jogosEstruturados.length} jogos sem transmissão (restaram ${jogosEstruturados.length})`);
      // }

      // Sort by time
      jogosEstruturados.sort((a, b) => a.kickoff.localeCompare(b.kickoff));

      const responseBody = JSON.stringify({
        ok: true,
        date: hojeIso,
        timezone: 'America/Sao_Paulo',
        updatedAt: updatedAtWithTimezone,
        games: jogosEstruturados
      });

      // Save to KV cache
      if (env.JOGOS_CACHE) {
        await env.JOGOS_CACHE.put(CACHE_KEY, responseBody, { expirationTtl: CACHE_TTL_SECONDS });
        console.log(`[CACHE SET] Dados salvos no KV para ${hojeIso} com TTL de ${CACHE_TTL_SECONDS}s`);
      }

      return new Response(responseBody, {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'X-Cache': 'MISS',
        },
      });
    } catch (error) {
      console.error('Erro no Worker:', error);
      // Return error in the expected structured format
      const hojeIso = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
      const updatedAtIso = new Date().toISOString().replace('Z', '');
      const timezoneOffset = -new Date().getTimezoneOffset();
      const offsetHours = Math.floor(Math.abs(timezoneOffset) / 60);
      const offsetMinutes = Math.abs(timezoneOffset) % 60;
      const offsetString = (timezoneOffset >= 0 ? '+' : '-') +
        String(offsetHours).padStart(2, '0') + ':' + String(offsetMinutes).padStart(2, '0');
      const updatedAtWithTimezone = updatedAtIso.substring(0, 19) + offsetString;

      return new Response(JSON.stringify({
        ok: false,
        date: hojeIso,
        timezone: 'America/Sao_Paulo',
        updatedAt: updatedAtWithTimezone,
        games: [],
        error: {
          code: 'INTERNAL_ERROR',
          message: `Erro ao processar dados: ${error.message}`
        }
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        status: 200, // Return 200 so frontend doesn't treat as error
      });
    }
  }
};

/**
 * Fetches transmission data from Gemini API in batch
 * @param {Array} jogos - Array of game objects with idLocal, home, away, competition, kickoff
 * @param {string} dataStr - Date string in dd/mm/yyyy format
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<Object>} Map of game ID to broadcasts array
 */
async function obterTransmissoesGemini(jogos, dataStr, apiKey) {
  const listaFormatada = jogos.map(j =>
    `ID ${j.idLocal}: ${j.home} x ${j.away} (${j.competition}) - Horário: ${j.kickoff}`
  ).join('\n');

  const prompt = `Você é um especialista na grade de transmissão de futebol no Brasil para TV Aberta, TV Fechada e Plataformas de Streaming (como Globo, SporTV, Premiere, ESPN, Disney+, CazéTV, YouTube, Max, Prime Video, Paramount+, etc.).

Para cada um dos jogos listados abaixo na data de hoje (${dataStr}), informe os canais ou serviços onde a partida será exibida ao vivo no Brasil. Se não houver transmissão prevista no território brasileiro, informe um array vazio.

Responda EXCLUSIVAMENTE em formato JSON puro, contendo uma lista de objetos com "id" (número correspondente) e "broadcasts" (array de objetos com "name" e "type"):
[
  {"id": 1, "broadcasts": [{"name": "Premiere", "type": "TV"}, {"name": "SporTV", "type": "TV"}]},
  {"id": 2, "broadcasts": []}
]

Jogos:
${listaFormatada}`;

  // Try the new model first, then fallback to 1.5-flash
  const modelUrls = [
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`,
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`
  ];

  for (let i = 0; i < modelUrls.length; i++) {
    const url = modelUrls[i];
    try {
      // AbortController for timeout
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 25000);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2
          }
        }),
        signal: abortController.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Log detailed error for debugging
        const errorBody = await response.text();
        console.error(`Gemini API error (${response.status}): ${errorBody}`);
        // If it's a 404 (model not found), try next model
        if (response.status === 404 && i < modelUrls.length - 1) {
          continue; // try next model
        }
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const json = await response.json();
      if (!json.candidates || !json.candidates[0].content) {
        throw new Error('Unexpected response from Gemini');
      }

      let textoResposta = json.candidates[0].content.parts[0].text;
      // Strip markdown code fences if present
      if (textoResposta.startsWith('```json')) {
        textoResposta = textoResposta.substring(7);
      }
      if (textoResposta.endsWith('```')) {
        textoResposta = textoResposta.substring(0, textoResposta.length - 3);
      }
      textoResposta = textoResposta.trim();

      const arrayResultados = JSON.parse(textoResposta);

      const mapa = {};
      arrayResultados.forEach(item => {
        mapa[item.id] = item.broadcasts || [];
      });

      return mapa;
    } catch (err) {
      // If we have a timeout, err.name might be 'AbortError'
      if (err.name === 'AbortError') {
        console.error('Gemini API request timed out after 25 seconds');
      } else {
        console.error(`Erro ao consultar Gemini (tentativa ${i + 1}):`, err);
      }
      // If this was the last model, we break and return empty map
      if (i === modelUrls.length - 1) {
        console.error('Todos os modelos Gemini falharam');
        return {};
      }
      // Otherwise, continue to next model
    }
  }
  // Should not reach here, but fallback
  return {};
}