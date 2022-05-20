import { args, cwd, basifyPath } from '../deps.ts'

const process = Deno.run({
	cmd: ['code', ...args],
	cwd: basifyPath(cwd),
})

await process.status()
