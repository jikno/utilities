import { writeZip } from './lib/zip.ts'

const zipContent = await fetch(`https://api.github.com/repos/jikno/deadbase/zipball/0.1.0`)
	.then(res => res.arrayBuffer())
	.then(buf => new Uint8Array(buf))

await writeZip(zipContent, '/fixture', { mapFilename: file => file.split('/').slice(1).join('/') })
