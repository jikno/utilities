import { args, print, writeText, flags, join, remove as removeFs, exit, readText } from '../deps.ts'
import { fetchRemoteExplanationFile, parseAppId, fetchZip, loadApplicationsIndex, saveApplicationsIndex } from '../lib/application.ts'
import { writeZip } from '../lib/zip.ts'

interface JamOptions {
	args: string[]
	help: boolean
}

const argv = flags.parse(args, {
	boolean: ['help'],
	alias: { h: 'help' },
})
const options = { ...argv, args: argv._.map(arg => arg.toString()) } as unknown as JamOptions

if (options.help) {
	print(`
jam <command> <app-id> ...[app-id]

Commands:

	install               Installs supplied app ids onto the disk.  If an app id with a version is supplied that version will be installed.  If no version is supplied, the latest version will be installed.
	remove                Removes supplied app ids from the disk.  If a supplied appId is not found on the disk, it is silently ignored.
`)

	exit()
}
if (!options.args.length) throw new Error('Expected a command to be supplied')

const command = options.args[0]
const values = options.args.slice(1)

const countOccurrences = (array: string[], occurrence: string) => {
	let occurrences = 0

	for (const item of array) if (item === occurrence) occurrences++

	return occurrences
}

const startTime = Date.now()
let finalMessage = ``

// They want us to install some packages.
// If the package is already installed at the same version, skip it.
// If it installed at a different version update it.
// If a version is not supplied, use the latest version
if (command === 'install') {
	if (!values.length) throw new Error('The install command requires at least one argument')

	const statuses: string[] = []
	for (const value of values) statuses.push(await install(value))

	const skipped = countOccurrences(statuses, 'skipped')
	const installed = countOccurrences(statuses, 'installed')
	const updated = countOccurrences(statuses, 'updated')

	finalMessage = `Installed ${installed} application${installed === 1 ? '' : 's'}`
	if (skipped) finalMessage += ` and skipped ${skipped} application${skipped === 1 ? '' : 's'}`
	if (updated) finalMessage += ` and updated ${updated} application${updated === 1 ? '' : 's'}`
}

// They want us to remove some packages
// If the package is already removed, skip it
// If a version is supplied to a particular appId, it is ignored
else if (command === 'remove') {
	if (!values.length) throw new Error('The remove command requires at least one argument')

	const statuses: string[] = []
	for (const value of values) statuses.push(await remove(value))

	const removed = countOccurrences(statuses, 'removed')
	const skipped = countOccurrences(statuses, 'skipped')

	finalMessage = `Removed ${removed} application${removed === 1 ? '' : 's'}`
	if (skipped) finalMessage += ` and skipped ${skipped} application${skipped === 1 ? '' : 's'}`
}

// They supplied a command that is not implemented
else {
	throw new Error(`Unknown command: ${command}`)
}

if (!finalMessage.length) finalMessage += `Completed`
print(`${finalMessage} in ${Date.now() - startTime}ms.`)

/**
 * Installs an app id and returns the status of the operation:
 * 'installed', 'skipped' (already installed), and 'updated' (already installed, but it was a different version)
 */
async function install(appId: string) {
	const { repo, user, version: suppliedVersion } = parseAppId(appId)
	const { auth, name: latestVersion } = await getAuthAndLatestVersion(user, repo, null)

	if (suppliedVersion && suppliedVersion !== latestVersion)
		print(`Warning: ${suppliedVersion} is not the latest version of application.  Latest version is ${latestVersion}.`)

	const version = suppliedVersion || latestVersion
	const shortId = `${user}.${repo}`
	const longId = `${shortId}@${version}`

	const index = await loadApplicationsIndex()
	const existingMeta = index[shortId]
	if (existingMeta) {
		if (existingMeta.version === version) return 'skipped'

		print(`Application ${shortId} is already installed.  Updating to supplied version.`)
	}

	const explanation = await fetchRemoteExplanationFile({ repo, user, version, auth })
	const zip = await fetchZip({ repo, user, version, auth })

	const path = join('/Applications', explanation.type === 'desktop' ? '_desktop' : '_cli', `${longId}`)

	await writeZip(zip, path, {
		// Removes the first directory from the resulting path
		mapFilename: file => file.split('/').slice(1).join('/'),
	})

	await writeText(join(path, '__version'), version)

	if (explanation.type === 'cli') {
		const cliContributionsPath = join('_cli', longId, explanation.shellContributionsFile)

		await ensureAliasIncludes(join(`/Applications`, '_shell-contributions.alias'), cliContributionsPath)
		await ensureAliasIncludes('.shell.alias', '/Applications/_shell-contributions.alias')
	}

	index[shortId] = { type: explanation.type, version }
	await saveApplicationsIndex(index)

	if (existingMeta) return 'updated'

	return 'installed'
}

/**
 * Removes an appId from the system.  Returns the status of the operation:
 * 'removed', 'skipped' (already removed)
 */
async function remove(appId: string) {
	const { repo, user } = parseAppId(appId)
	const shortId = `${user}.${repo}`

	const index = await loadApplicationsIndex()

	const applicationMeta = index[shortId]
	if (!applicationMeta) {
		print(`Application ${shortId} is not installed.`)
		return 'skipped'
	}

	delete index[shortId]
	await saveApplicationsIndex(index)

	const path = join('/Application', applicationMeta.type === 'desktop' ? '_desktop' : '_cli', `${shortId}@${applicationMeta.version}`)

	await removeFs(path, { recursive: true })

	return 'removed'
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

async function ensureAliasIncludes(aliasPath: string, includeFile: string) {
	let alias: string | null = null

	try {
		alias = await readText(aliasPath)
	} catch (_) {
		// if the alias file does not exist, silently create it
	}

	if (!alias) {
		alias = `@include ${includeFile}`
	} else if (!alias.includes(`@include ${includeFile}`)) {
		alias += `\n@include ${includeFile}`
	}

	await writeText(aliasPath, alias)
}
