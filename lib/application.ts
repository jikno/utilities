import { readJson, pathUtils } from './deps.ts'

export type ExplanationFile = CliExplanationFile | DesktopExplanationFile

export interface CliExplanationFile {
	type: 'cli'
	title: string
	description: string
	shellContributionsFile: string
}

export interface DesktopExplanationFile {
	type: 'desktop'
	startupFile: string
	appIcon: string
	title: string
	description: string
}

export interface GetExplanationFileParams {
	repo: string
	user: string
	version: string
	auth: string | null
}

export async function fetchRemoteExplanationFile(params: GetExplanationFileParams): Promise<ExplanationFile> {
	const res = await fetch(`https://api.github.com/repos/${params.user}/${params.repo}/contents/explanation.json?ref=${params.version}`, {
		headers: { Authorization: `Basic ${params.auth}` },
	})

	if (!res.ok) {
		const { message } = await res.json()
		throw new Error(`Application is not properly configured.  Failed to fetch explanation.json: ${message}`)
	}

	const { content } = await res.json()
	const json = atob(content)

	try {
		return JSON.parse(json)
	} catch (e) {
		throw new Error(`Failed to parse application explanation file: ${e}`)
	}
}

export interface LoadLocalExplanationFile {
	repo: string
	user: string
}

export async function loadLocalExplanationFile(params: LoadLocalExplanationFile) {
	const load = async (type: string) =>
		await readJson(pathUtils.join('/Applications', type, `${params.repo}/${params.user}`, 'explanation.json'))

	try {
		return await load('_cli')
	} catch (_) {
		return await load('_desktop')
	}
}

export function parseAppId(appId: string) {
	const sections = appId.split('.')
	const user = sections[0]
	const repoAndVersion = sections.slice(1).join('.')

	if (!repoAndVersion || !user) throw new Error('Improperly formatted appId')

	const [repo, version] = repoAndVersion.split('@')

	return {
		user,
		repo,
		version: version || null,
	}
}

export interface FetchTarballParams {
	user: string
	repo: string
	version: string
	auth: string | null
}

export async function fetchZip(params: FetchTarballParams) {
	const res = await fetch(`https://api.github.com/repos/${params.user}/${params.repo}/zipball/${params.version}`, {
		headers: { Authorization: `Basic ${params.auth}` },
	})

	if (!res.ok) {
		if (res.status === 404) throw new Error(`Version ${params.version} of application ${params.user}.${params.repo} does not exist`)
		throw new Error(`Error downloading application: ${await res.text()}`)
	}

	return await res.arrayBuffer().then(buffer => new Uint8Array(buffer))
}