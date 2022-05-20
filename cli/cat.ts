import { args, give, readText } from '../deps.ts'

const file = args[0]
if (!file) throw new Error('Expected a file to be passed in as the first argument')

const meta = await readText(file)
give(meta)
