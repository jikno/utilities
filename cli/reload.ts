import { args, cwd, basifyPath, print, flags } from '../deps.ts'

const options = flags.parse(args, { alias: { r: 'reload', u: 'unstable' } })
const files = options._.map(arg => arg.toString())
const reload = !!options.reload
const unstable = !!options.unstable

for (const file of files) {
	const cmd = ['deno', 'cache']

	if (reload) cmd.push('--reload')
	if (unstable) cmd.push('--unstable')

	cmd.push(file)

	print(`<span class="text-success">Check</span> ${file}`, { html: true })
	const process = Deno.run({
		cmd,
		cwd: basifyPath(cwd),
	})

	await process.status()
}
