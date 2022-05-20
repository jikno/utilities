import { args, cwd, print, writeText, flags, pathUtils } from '../deps.ts'
import { fetchRemoteExplanationFile, parseAppId, fetchZip } from '../lib/application.ts'
import { writeZip } from '../lib/zip.ts'

interface JamOptions {
	args: string[]
}

const argv = flags.parse(args)
const options = { ...argv, args: argv._.map(arg => arg.toString()) } as JamOptions

if (!options.args.length) throw new Error('Expected a command to be supplied')

const [command, value] = options.args

if (command === 'install') {
	if (!value) throw new Error('The install command requires one argument')

	await install(value)
} else {
	throw new Error(`Unknown command: ${command}`)
}

async function install(appId: string) {
	const { repo, user, version } = parseAppId(appId)
	if (!version) throw new Error('You must select a version for now')

	const { auth, name: latestVersion } = await getAuthAndLatestVersion(user, repo, null)

	if (version !== latestVersion)
		print(`Warning: ${version} is not the latest version of application.  Latest version is ${latestVersion}.`)

	const explanation = await fetchRemoteExplanationFile({ repo, user, version, auth })
	const zip = await fetchZip({ repo, user, version, auth })

	const path = pathUtils.join(cwd, 'Application', explanation.type === 'desktop' ? '_desktop' : '_cli', `${user}.${repo}`)

	await writeZip(zip, path, {
		// Removes the first directory from the resulting path
		mapFilename: file => file.split('/').slice(1).join('/'),
	})

	await writeText(pathUtils.join(path, '__version'), version)
}

async function getAuthAndLatestVersion(user: string, repo: string, auth: string | null) {
	const res = await fetch(`https://api.github.com/repos/${user}/${repo}/releases/latest`, {
		headers: { Authorization: `Basic ${auth}` },
	})

	if (!res.ok) {
		if (res.status === 404 || res.status === 401 || res.status === 403) {
			console.log(await res.json())
			throw new Error('Cannot download private applications at this time')
		}

		const { message } = await res.json()
		throw new Error(`Failed to ping application repository: ${message}`)
	}

	const { name } = await res.json()

	return { auth: null, name }
}
