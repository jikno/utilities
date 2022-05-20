import { args, writeText } from '../deps.ts'

for (const file of args) await writeText(file, '')
