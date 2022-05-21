import { JSZip } from 'https://deno.land/x/jszip@0.11.0/mod.ts'
import { join, writeBinary } from '../deps.ts'

export interface WriteZipOptions {
	mapFilename?(name: string): string | Promise<string>
}

export async function writeZip(content: Uint8Array, dir: string, options: WriteZipOptions = {}) {
	const zip = new JSZip()
	await zip.loadAsync(content)

	for (const z of zip) {
		if (z.dir) continue

		const writeName = options.mapFilename ? await options.mapFilename(z.name) : z.name
		const writePath = join(dir, writeName)

		const zipFile = zip.file(z.name)
		if (!zipFile) throw new Error(`No zip file found for ${z.name}`)

		const fileContent = await zipFile.async('uint8array')

		await writeBinary(writePath, fileContent)
	}
}
