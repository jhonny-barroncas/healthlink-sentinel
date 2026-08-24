import { readdir, readFile, appendFile, mkdir } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { build } from 'esbuild';

const projectRoot = resolve(import.meta.dirname, '..');
const protoRoot = resolve(projectRoot, 'apps/agent/proto');
const version = process.env.HEALTHLINK_AGENT_BUILD_VERSION?.trim() || '1.0.0';
const output = resolve(projectRoot, `dist/agent/healthlink-agent-${version}.cjs`);

async function collectProtoAssets(directory) {
  const assets = {};
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) Object.assign(assets, await collectProtoAssets(absolute));
    else if (entry.isFile() && entry.name.endsWith('.proto')) assets[relative(protoRoot, absolute).replaceAll('\\', '/')] = await readFile(absolute, 'utf8');
  }
  return assets;
}

const protos = await collectProtoAssets(protoRoot);
await mkdir(resolve(output, '..'), { recursive: true });
await build({
  entryPoints: [resolve(projectRoot, 'apps/agent/src/index.ts')],
  outfile: output,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: false,
  minify: true,
  define: {
    __HEALTHLINK_AGENT_VERSION__: JSON.stringify(version),
    __HEALTHLINK_STARLINK_PROTOS__: JSON.stringify(protos),
  },
});
const marker = `HealthLink Sentinel Agent v${version}`;
await appendFile(output, `\n// ${marker}\n`, 'utf8');
const source = await readFile(output, 'utf8');
if (!source.includes(marker)) throw new Error(`O bundle não contém o marcador da versão ${version}.`);
process.stdout.write(`${output}\n`);

