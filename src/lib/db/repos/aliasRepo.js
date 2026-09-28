import { getAdapter } from "../driver.js";
import { parseJson, stringifyJson } from "../helpers/jsonCol.js";
import { makeKv } from "../helpers/kvStore.js";

const aliasKv = makeKv("modelAliases");
const customKv = makeKv("customModels");
const mitmKv = makeKv("mitmAlias");

// modelAliases: key=alias, value=modelString
export async function getModelAliases() {
  return await aliasKv.getAll();
}

export async function setModelAlias(alias, model) {
  await aliasKv.set(alias, model);
}

export async function deleteModelAlias(alias) {
  await aliasKv.remove(alias);
}

// customModels: key=`${providerAlias}|${id}|${type}`, value=full model object
function customKey(providerAlias, id, type) {
  return `${providerAlias}|${id}|${type}`;
}

export async function getCustomModels() {
  const all = await customKv.getAll();
  return Object.values(all);
}

// Atomic check-then-insert inside transaction to prevent duplicate races
export async function addCustomModel({ providerAlias, id, type = "llm", name }) {
  const k = customKey(providerAlias, id, type);
  const db = await getAdapter();
  let added = false;
  db.transaction(() => {
    const row = db.get(`SELECT 1 FROM kv WHERE scope = 'customModels' AND key = ?`, [k]);
    if (row) return;
    const value = stringifyJson({ providerAlias, id, type, name: name || id, source: "manual" });
    db.run(`INSERT INTO kv(scope, key, value) VALUES('customModels', ?, ?)`, [k, value]);
    added = true;
  });
  return added;
}

export async function upsertCustomModels(models) {
  if (!Array.isArray(models) || models.length === 0) return { added: 0, updated: 0 };
  const db = await getAdapter();
  let added = 0;
  let updated = 0;
  db.transaction(() => {
    for (const model of models) {
      if (!model?.providerAlias || !model?.id) continue;
      const type = model.type || model.kind || "llm";
      const k = customKey(model.providerAlias, model.id, type);
      const row = db.get(`SELECT value FROM kv WHERE scope = 'customModels' AND key = ?`, [k]);
      const existing = row ? parseJson(row.value, {}) : null;
      const next = existing
        ? { ...model, ...existing, ...(existing.source === "live" ? model : {}), providerAlias: model.providerAlias, id: model.id, type }
        : { ...model, providerAlias: model.providerAlias, id: model.id, type, source: model.source || "live" };
      const value = stringifyJson(next);
      if (!row) {
        db.run(`INSERT INTO kv(scope, key, value) VALUES('customModels', ?, ?)`, [k, value]);
        added += 1;
      } else if (row.value !== value) {
        db.run(`UPDATE kv SET value = ? WHERE scope = 'customModels' AND key = ?`, [value, k]);
        updated += 1;
      }
    }
  });
  return { added, updated };
}

export async function deleteCustomModel({ providerAlias, id, type = "llm" }) {
  await customKv.remove(customKey(providerAlias, id, type));
}

// mitmAlias: key=toolName, value=mappings object
export async function getMitmAlias(toolName) {
  if (toolName) {
    const v = await mitmKv.get(toolName);
    return v || {};
  }
  return await mitmKv.getAll();
}

export async function setMitmAliasAll(toolName, mappings) {
  await mitmKv.set(toolName, mappings || {});
}
