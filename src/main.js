const electron = require('electron');
const { ipcMain: ipc, app, BrowserWindow } = electron;
const { autoUpdater } = require('electron-updater');

const url = require('url');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const ipfsDl = require('go-ipfs-dep');

const { createController } = require('ipfsd-ctl');
let ipfsd;

const userDataPath = app.getPath('userData');
const configFile = path.join(userDataPath, 'config.json');
const cachePath = path.join(userDataPath, 'ipnsCache.json');

let config = {
};

let ipnsCache = {};

// if (fs.existsSync(cachePath)) {
// 	ipnsCache = JSON.parse(fs.readFileSync(cachePath));
// }

let ipfsBinDir = path.join('.', 'go-ipfs');
let ipfsBin = path.join('.', 'go-ipfs', 'ipfs' + (process.platform == 'win32' ? '.exe' : ''));

let ipnsHash = '/ipns/QmP7kf4teMVJBZiDMgtMJFUQCtZGstaKpjdDsCvQprRSdd';
let ipfsUrl = null;

let repoPath = path.join(os.homedir(), '.ipfs');

let win; // this will store the window object

var globalStatus = 'Waiting for the IPFS node';

// creates the default window

function createWindow() {
	const win = new BrowserWindow({
		width: 900,
		height: 680,
		// frame: false
		webPreferences: {
			nodeIntegration: true,
			webviewTag: true
		}
	});

	win.loadFile(path.join(__dirname, 'public', 'loader.html'));

	return win;
}

function toSubdomain(ipfsPath) {

	const [_, ipfsProto, ipfsCid] = ipfsPath.split('/');

	console.log(ipfsBin);
	const cidToBase32 = spawnSync(ipfsBin, ['cid', 'base32', ipfsCid]);

	console.dir(cidToBase32);

	return `${cidToBase32.stdout.toString()}.${ipfsProto}`;
}

app.whenReady().then(async () => {
	//autoUpdater.checkForUpdates();
	win = createWindow();

	if (!fs.existsSync(ipfsBin)) {
		await ipfsDl();
	}



	// win.webContents.on('did-finish-load', async () => {
	ipfsd = await createController({
		ipfsHttpModule: require('ipfs-http-client'),
		ipfsBin,
		disposable: false,
		remote: false,
		args: ['--enable-pubsub-experiment']
	});

	if (!fs.existsSync(path.join(repoPath, 'config'))) {
		updateStatus('Initializing the IPFS repo...');

		await spawnSync(ipfsBin, ['init'], {
			stdio: 'inherit'
		});

		await ipfsd.init();
	}

	updateStatus('Starting IPFS Node...');
	await ipfsd.start();

	await ipfsd.api.pubsub.ls();

	updateStatus('Resolving the IPNS hash... This may take a while.');

	// let ipfsPath = await resolveAndCache(ipfsd.api, ipnsHash, 10800);

	// ipfsd.api.pin.add(ipnsHash);

	const splitGateway = (await ipfsd.api.config.get('Addresses.Gateway')).split('/');

	const port = splitGateway[splitGateway.length - 1];
	ipfsUrl = `http://${toSubdomain(ipnsHash)}.localhost:${port}`;

	console.log(ipfsUrl);
	updateStatus('Url obtained. Loading...');
	// setInterval(() => { refreshCache(ipfsd.api); }, 1500000);
	// });
}).catch(handleErr);

// when the update has been downloaded and is ready to be installed, notify the BrowserWindow
autoUpdater.on('update-downloaded', (info) => {
	win.webContents.send('updateReady');
});

// when receiving a quitAndInstall signal, quit and install the new version ;)
ipc.on('quitAndInstall', (event, arg) => {
	autoUpdater.quitAndInstall();
});

ipc.on('app-loaded', (e, arg) => {
	updateStatus('Done', true);
});

app.on('window-all-closed', () => {
	gracefulQuit();
});

async function gracefulQuit() {
	app.quit();
}

function handleErr(err) {
	if (err) {
		updateStatus('Error: ' + err);
		setTimeout(gracefulQuit, 2000);
		console.error(err);
	}
}

function updateStatus(status, hideStatus) {
	console.log(status);
	globalStatus = status;

	if (win) {
		console.log('win');
		win.webContents.send('updateStatus', { ipfsUrl, status, hideStatus });
	}
}

async function resolveAndCache(ipfs, ipnsHash, time, refresh) {
	const now = Date.now();
	if (!refresh && ipnsCache[ipnsHash] && ipnsCache[ipnsHash].cacheUntil > now) {
		return ipnsCache[ipnsHash].value;
	} else {
		let hash;
		for await (const ipfsHash of await ipfs.name.resolve(ipnsHash)) {
			hash = ipfsHash;
		}

		ipnsCache[ipnsHash] = {
			value: hash,
			cacheUntil: now + time * 1000,
			cacheFor: time * 1000
		};

		if (!refresh) writeCache();

		return hash;
	}
}

async function refreshCache(ipfs) {
	const l = [];
	for (const hash in ipnsCache) {
		l.push(resolveAndCache(ipfs, hash, ipnsCache[hash].cacheFor, true));
	}

	await Promise.all(l);
	writeCache();
}

function writeCache() {
	fs.writeFileSync(cachePath, JSON.stringify(ipnsCache, null, '\t'));

	console.log('Cache writtern to ' + cachePath);
}