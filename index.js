const { speaker: audio } = require('win-audio');
const { promisify } = require('util');
const Shell = require('node-powershell');

// How fast the script should check for advertisements.
const POLLING_INTERVAL = 1_000;
// The volume to change to after an advertisement is past.
const VOLUME = 12;

const sleep = promisify(setTimeout);
const adTitles = new Set(['Spotify', 'Advertisement']);

const setMuted = shouldMute => {
	if (shouldMute !== audio.isMuted()) audio.toggle();
}

(async () => {
	let lastWasAd = false;

	while (true) {
		const isAd = await isAdvertisement();

		// No action if the state did not change.
		if (lastWasAd === isAd) {
			await sleep(POLLING_INTERVAL);
			continue;
		}

		if (isAd) {
			console.log('[INFO] Detected advertisement, muting speakers...');
			lastWasAd = true;
	
			setMuted(true);
			await sleep(POLLING_INTERVAL);
			continue;
		}

		console.log('[INFO] Detected end of advertisement, unmuting speakers...');
		// We were playing an advertisement before and are now back to playing a song.
		lastWasAd = false;

		setMuted(false);
		audio.set(VOLUME);

		await sleep(POLLING_INTERVAL);
	}
})();

async function isAdvertisement() {
	const shell = new Shell({ verbose: false, executionPolicy: 'bypass', noProfile: true });

	await shell.addCommand('Get-Process -Name Spotify | where-Object {$_.mainWindowTitle} | Format-List mainWindowTitle');
	const output = await shell.invoke()
		.catch(() => {})
		.finally(shell.dispose);

	// Unexpected error occurred.
	if (!output) return;

	// Output looks like this:
	//
	// [several blank lines]
	// MainWindowTitle : SongTitle
	// [several more blank lines]
	for (const line of output.split('\n')) {
		const [, name] = /MainWindowTitle : (.+)/.exec(line.trim()) || [];
		if (name) return adTitles.has(name);
	}

	return false;
}