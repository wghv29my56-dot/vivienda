// No SDK dependency. Pass a publishable key; private saves require a Supabase Auth access token.
export const SIMULATOR_PROJECT_URL = 'https://qskdwrvobxlshebocwjr.supabase.co';
export function createSimulatorAPI({ publishableKey, getAccessToken = () => null }) {
  if (!publishableKey) throw new Error('Falta la clave publicable de Supabase.');
  async function request(path, { body, privateData = false } = {}) {
    const token = await getAccessToken();
    if (privateData && !token) throw new Error('Inicia sesión para guardar o recuperar partidas.');
    const headers = { apikey: publishableKey, 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${SIMULATOR_PROJECT_URL}/rest/v1/${path}`, {
      method: body === undefined ? 'GET' : 'POST', headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const result = await response.json();
    if (!response.ok) {
      const error = new Error(result.message || 'No se pudo consultar el simulador.');
      error.code = result.code; error.status = response.status; throw error;
    }
    return result;
  }
  function uuid(id) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error('Identificador de partida inválido.');
    return id;
  }
  return {
    async currentModel(channel = 'national') {
      const rows = await request('sim_current_model?channel=eq.' + encodeURIComponent(channel) + '&select=*');
      if (rows.length !== 1) throw new Error('No hay una única versión activa del modelo.');
      return rows[0];
    },
    async catalogue(version = null) {
      if (!version || !version.startsWith('alpha-')) {
        const rows = version
          ? await request('sim_model_versions?id=eq.' + encodeURIComponent(version) + '&select=id,payload,engine_id')
          : await request('sim_current_model?channel=eq.national&select=version_id,payload,engine_id');
        if (rows.length !== 1 || rows[0].engine_id !== 'js-national-v1') throw new Error('Modelo no disponible o no compatible.');
        return rows[0].payload;
      }
      // Explicit historical access only. Current games use the versioned JSON contract.
      const v = encodeURIComponent(version);
      const names = ['cities', 'groups', 'categories', 'budget_sources', 'measure_effects', 'scenario_groups', 'scenario_budgets', 'sources', 'measure_sources'];
      const entries = await Promise.all(names.map(async name => [name, await request(`sim_${name}?select=*`)]));
      entries.push(['scenarios', await request(`sim_scenarios?version_id=eq.${v}&select=*`)]);
      entries.push(['measures', await request(`sim_measures?version_id=eq.${v}&select=*`)]);
      const catalogue = Object.fromEntries(entries);
      catalogue.cities = catalogue.cities.filter(c => catalogue.scenarios.some(s => s.city_id === c.id));
      const measureIds = new Set(catalogue.measures.map(m => m.id));
      const scenarioIds = new Set(catalogue.scenarios.map(s => s.id));
      const categoryIds = new Set(catalogue.measures.map(m => m.category_id));
      catalogue.categories = catalogue.categories.filter(c => categoryIds.has(c.id));
      catalogue.measure_effects = catalogue.measure_effects.filter(e => measureIds.has(e.measure_id));
      catalogue.measure_sources = catalogue.measure_sources.filter(s => measureIds.has(s.measure_id));
      catalogue.scenario_groups = catalogue.scenario_groups.filter(g => scenarioIds.has(g.scenario_id));
      catalogue.scenario_budgets = catalogue.scenario_budgets.filter(b => scenarioIds.has(b.scenario_id));
      const sourceIds = new Set(catalogue.scenario_budgets.map(b => b.source_id));
      catalogue.budget_sources = catalogue.budget_sources.filter(s => sourceIds.has(s.id));
      return catalogue;
    },
    createRun({ scenarioId, years, name, objective, configuration = {} }) {
      return request('rpc/sim_create_run', { privateData: true, body: {
        p_scenario_id: scenarioId, p_years: years, p_name: name,
        p_objective: objective, p_configuration: configuration
      } });
    },
    advanceTurn({ runId, expectedTurn, decisions = [] }) {
      return request('rpc/sim_advance_turn', { privateData: true, body: {
        p_run_id: uuid(runId), p_expected_turn: expectedTurn, p_decisions: decisions
      } });
    },
    listRuns() { return request('sim_runs?select=*&order=updated_at.desc', { privateData: true }); },
    async loadRun(runId) {
      const id = uuid(runId);
      const run = await request(`sim_runs?id=eq.${id}&select=*`, { privateData: true });
      if (!run.length) throw new Error('Partida no encontrada o sin acceso.');
      const entries = await Promise.all(['turns', 'turn_groups', 'decisions', 'funding', 'turn_budgets'].map(async name =>
        [name, await request(`sim_${name}?run_id=eq.${id}&select=*`, { privateData: true })]));
      return { run: run[0], ...Object.fromEntries(entries) };
    }
  };
}
