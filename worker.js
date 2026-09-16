/**
 * Cloudflare Worker for Jogos do Dia API
 * Fetches data from API-Football, enriches with Gemini for Brazil transmissions,
 * and returns a 2D array compatible with the frontend.
 */

// Main league IDs (same as in the original Apps Script)
const LIGAS_PRINCIPAIS_IDS = [71, 72, 73, 13, 11, 39, 140, 135, 78, 61, 2, 3, 848];
// Flag to show only games with transmission (set to true by default)
// NOTE: Keeping variable for reference but disabling filter to show all games
const APENAS_COM_TRANSMISSAO = true;

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
        return new Response(JSON.stringify([
          ["⚠️ Limite de consultas da API atingido. Aguarde 60 segundos e tente novamente."],
          []
        ]), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          status: 429,
        });
      }

      if (!footballResponse.ok) {
        throw new Error(`API-Football error: ${footballResponse.status}`);
      }

      const footballData = await footballResponse.json();
      // If API-Football returns errors (rate limit, invalid token, etc.), return friendly message
      const hasErrors = footballData.errors && (Array.isArray(footballData.errors) ? footballData.errors.length > 0 : Object.keys(footballData.errors).length > 0);
      if (hasErrors) {
        return new Response(JSON.stringify([
          ["⚠️ Limite de consultas da API atingido. Aguarde 60 segundos e tente novamente."],
          []
        ]), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          status: 200, // Return 200 so frontend doesn't treat as error
        });
      }

      const fixtures = footballData.response || [];
      if (fixtures.length === 0) {
        // No games at all - return header rows only
        const headerTitle = [`Nenhum jogo encontrado para hoje (${hojeFormatado}).`];
        const colunas = ['Horário', 'Liga / Torneio', 'Fase / Rodada', 'Mandante', 'Placar', 'Visitante', 'Status', 'Onde Assistir (Brasil)'];
        return new Response(JSON.stringify([headerTitle, colunas]), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // Filter only main leagues
      const jogosFiltrados = fixtures.filter(item => LIGAS_PRINCIPAIS_IDS.includes(item.league.id));
      if (jogosFiltrados.length === 0) {
        // No games in main leagues - return header rows only
        const headerTitle = [`Nenhum jogo das principais ligas encontrado para hoje (${hojeFormatado}).`];
        const colunas = ['Horário', 'Liga / Torneio', 'Fase / Rodada', 'Mandante', 'Placar', 'Visitante', 'Status', 'Onde Assistir (Brasil)'];
        return new Response(JSON.stringify([headerTitle, colunas]), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // Structure base list
      const listaJogos = jogosFiltrados.map((item, index) => ({
        idLocal: index + 1,
        horario: item.fixture.date ? item.fixture.date.substring(11, 16) : '--:--',
        liga: item.league.name || 'Outros',
        rodada: item.league.round || '-',
        mandante: item.teams.home.name || 'Mandante',
        visitante: item.teams.away.name || 'Visitante',
        placar: `${item.goals.home !== null ? item.goals.home : '-'} x ${item.goals.away !== null ? item.goals.away : '-'}`,
        status: item.fixture.status.short || 'NS',
        transmissao: 'Consultando...',
      }));

      // Batch call to Gemini for transmissions
      const mapaTransmissoes = await obterTransmissoesGemini(listaJogos, hojeFormatado, env.GEMINI_API_KEY);

      listaJogos.forEach(j => {
        if (mapaTransmissoes[j.idLocal]) {
          j.transmissao = mapaTransmissoes[j.idLocal];
        } else {
          j.transmissao = 'Não informado';
        }
      });

      // REMOVED: Filter to only games with transmission flag
      // Now we show all games regardless of transmission info

      // Sort by time
      listaJogos.sort((a, b) => a.horario.localeCompare(b.horario));

      // Build 2D array for response
      const headerTitle = [`JOGOS DO DIA COM TRANSMISSÃO — ${hojeFormatado}`];
      const colunas = ['Horário', 'Liga / Torneio', 'Fase / Rodada', 'Mandante', 'Placar', 'Visitante', 'Status', 'Onde Assistir (Brasil)'];
      const dadosTabela = [headerTitle, colunas];

      listaJogos.forEach(j => {
        dadosTabela.push([
          j.horario,
          j.liga,
          j.rodada,
          j.mandante,
          j.placar,
          j.visitante,
          j.status,
          j.transmissao,
        ]);
      });

      return new Response(JSON.stringify(dadosTabela), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (error) {
      console.error('Erro no Worker:', error);
      // Return error in the expected 2D array format
      const errorMessage = `Erro ao processar dados: ${error.message}`;
      const headerTitle = [errorMessage];
      const colunas = []; // empty column headers to maintain structure
      return new Response(JSON.stringify([headerTitle, colunas]), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        status: 500,
      });
    }
  }
};

/**
 * Fetches transmission data from Gemini API in batch
 */
async function obterTransmissoesGemini(jogos, dataStr, apiKey) {
  const listaFormatada = jogos.map(j =>
    `ID ${j.idLocal}: ${j.mandante} x ${j.visitante} (${j.liga}) - Horário: ${j.horario}`
  ).join('\n');

  const prompt = `Você é um especialista na grade de transmissão de futebol no Brasil para TV Aberta, TV Fechada e Plataformas de Streaming (como Globo, SporTV, Premiere, ESPN, Disney+, CazéTV, YouTube, Max, Prime Video, Paramount+, etc.).

Para cada um dos jogos listados abaixo na data de hoje (${dataStr}), informe os canais ou serviços onde a partida será exibida ao vivo no Brasil. Se não houver transmissão prevista no território brasileiro, informe apenas "Sem transmissão".

Jogos:
${listaFormatada}

Responda EXCLUSIVAMENTE em formato JSON puro, contendo uma lista de objetos com "id" (número correspondente) e "ondeAssistir" (texto curto com os canais separados por vírgula):
[
  {"id": 1, "ondeAssistir": "Premiere, SporTV"},
  {"id": 2, "ondeAssistir": "Sem transmissão"}
]`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const json = await response.json();
    if (!json.candidates || !json.candidates[0].content) {
      throw new Error('Unexpected response from Gemini');
    }

    const textoResposta = json.candidates[0].content.parts[0].text;
    const arrayResultados = JSON.parse(textoResposta);

    const mapa = {};
    arrayResultados.forEach(item => {
      mapa[item.id] = item.ondeAssistir;
    });

    return mapa;
  } catch (e) {
    console.error('Erro ao consultar Gemini:', e);
    // Return empty map - transmissions will show as 'Não informado'
    return {};
  }
}