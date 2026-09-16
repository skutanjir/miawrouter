const quoteYaml = (value) => JSON.stringify(String(value ?? ""));

export function buildOhMyPiProvider(baseUrl, apiKey, model) {
  return [
    "  miawrouter:",
    `    baseUrl: ${quoteYaml(baseUrl)}`,
    "    api: openai-completions",
    `    apiKey: ${quoteYaml(apiKey)}`,
    "    authHeader: true",
    "    models:",
    `      - id: ${quoteYaml(model)}`,
    `        name: ${quoteYaml(`MiawRouter ${model}`)}`,
    "        contextWindow: 1000000",
    "        maxTokens: 384000",
  ].join("\n");
}

export function mergeOhMyPiModels(existing, provider) {
  const source = String(existing || "").replace(/\r\n/g, "\n");
  const lines = source.split("\n");
  const providersIndex = lines.findIndex((line) => /^providers:\s*(?:#.*)?$/.test(line));

  if (providersIndex === -1) {
    return `${source.trimEnd()}${source.trim() ? "\n\n" : ""}providers:\n${provider}\n`;
  }

  let sectionEnd = lines.length;
  for (let i = providersIndex + 1; i < lines.length; i += 1) {
    if (/^\S/.test(lines[i]) && !lines[i].startsWith("#")) {
      sectionEnd = i;
      break;
    }
  }

  const providerStart = lines.findIndex(
    (line, index) => index > providersIndex && index < sectionEnd && /^  miawrouter:\s*(?:#.*)?$/.test(line)
  );

  if (providerStart !== -1) {
    let providerEnd = sectionEnd;
    for (let i = providerStart + 1; i < sectionEnd; i += 1) {
      if (/^  [A-Za-z0-9_-]+\s*:/.test(lines[i])) {
        providerEnd = i;
        break;
      }
    }
    lines.splice(providerStart, providerEnd - providerStart, ...provider.split("\n"));
  } else {
    lines.splice(sectionEnd, 0, ...provider.split("\n"));
  }

  return `${lines.join("\n").trimEnd()}\n`;
}
