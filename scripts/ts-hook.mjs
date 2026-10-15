/** Run this repo's TypeScript under Node 20 (CI's version, no --experimental-strip-types): resolve extensionless
 *  imports to .ts and strip types with esbuild (already installed with Vite). */
import { readFile } from 'node:fs/promises'
import { transform } from 'esbuild'
export async function resolve(specifier, context, nextResolve) {
  if ((specifier.startsWith('.') || specifier.startsWith('/')) && !/\.(?:ts|js|mjs|cjs|json|node)$/.test(specifier)) {
    return nextResolve(specifier + '.ts', context)
  }
  return nextResolve(specifier, context)
}
export async function load(url, context, nextLoad) {
  if (!url.endsWith('.ts')) return nextLoad(url, context)
  const src = await readFile(new URL(url), 'utf8')
  const { code } = await transform(src, { loader: 'ts', format: 'esm', sourcefile: url, sourcemap: 'inline' })
  return { format: 'module', source: code, shortCircuit: true }
}
