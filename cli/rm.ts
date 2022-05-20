import { args, remove, flags } from '../deps.ts'

const options = flags.parse(args, { alias: { r: 'recursive' } })

const paths = options._
if (!paths.length) throw new Error('You must specify at least one path to remove')

for (const path of paths) {
	await remove(path.toString(), { recursive: !!options.recursive })
}
