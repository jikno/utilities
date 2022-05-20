import { args, give, readDir, print, flags } from '../deps.ts'

const options = flags.parse(args, { alias: { p: 'pretty' } })
const path = options._[0] ? options._[0].toString() : '.'

const entries = await readDir(path)

if (options.pretty)
	print(
		entries
			.map(entry => {
				if (entry.name.startsWith('.')) return `<span style="opacity: 0.5">${entry.name}</span>`
				if (entry.isDirectory) return `<span class="text-primary font-semibold">${entry.name}</span>`

				return entry.name
			})
			.join('\n'),
		{
			html: true,
		}
	)
else give(entries)
