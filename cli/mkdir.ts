import { args, mkdir } from '../deps.ts'

for (const path of args) await mkdir(path)
