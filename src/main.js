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
const CID = require('cids');

const userDataPath = app.getPath('userData');
const configFile = path.join(userDataPath, 'config.json');

let config = {
};

let ipfsd;

let ipfsBinDir = path.join('.', 'go-ipfs');
let ipfsBin = path.join('.', 'go-ipfs', 'ipfs' + (process.platform == 'win32' ? '.exe' : ''));

let ipnsHash = '/ipns/QmP7kf4teMVJBZiDMgtMJFUQCtZGstaKpjdDsCvQprRSdd';
let ipfsUrl = null;

let repoPath = path.join(os.homedir(), '.ipfs');

let win; // this will store the window object

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
	let [_, ipfsProto, ipfsCid] = ipfsPath.split('/');

	ipfsCid = new CID(ipfsCid).toV1().toString('base32');

	return `${ipfsCid}.${ipfsProto}`;
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
		disposable: true,
		remote: false,
		args: ['--enable-pubsub-experiment'],
		ipfsOptions: {
			config: {
				Addresses: {
					API: '/ip4/127.0.0.1/tcp/5555',
					Gateway: '/ip4/127.0.0.1/tcp/8888'
				}
			}
		}
	});

	// if (!fs.existsSync(path.join(repoPath, 'config'))) {
	// 	updateStatus('Initializing the IPFS repo...');

	// 	// await spawnSync(ipfsBin, ['init'], {
	// 	// 	stdio: 'inherit'
	// 	// });
	// }

	updateStatus('Initializing IPFS repo...');
	await ipfsd.init();

	updateStatus('Starting IPFS Node...');
	// try {
	await ipfsd.start();
	// } catch(e) {
	// 	const lock = path.join(repoPath, 'repo.lock');
	// 	if (fs.existsSync(lock)) {
	// 		fs.unlinkSync(lock);

	// 		await ipfsd.start();
	// 	} else {
	// 		throw e;
	// 	}
	// }
	await ipfsd.api.pubsub.ls();

	updateStatus('Looking up gateway address...');

	// let ipfsPath = await resolveAndCache(ipfsd.api, ipnsHash, 10800);

	// setTimeout(async () => {
	// 	let path;
	// 	for await (const p of ipfsd.api.name.resolve(ipnsHash)) {
	// 		path = p;
	// 	}
	// 	ipfsd.api.pin.add(path);
	// }, 10);



	const splitGateway = (await ipfsd.api.config.get('Addresses.Gateway')).split('/');
	const port = splitGateway[splitGateway.length - 1];

	ipfsUrl = `http://${toSubdomain(ipnsHash)}.localhost:${port}`;

	console.log(ipfsUrl);
	updateStatus('URL obtained. Loading...');
	// win.webContents.send('connect-ipfs', ipfsd.apiAddr);

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

	setTimeout(() => {
	}, 2000);
});

app.on('will-quit', () => {
	gracefulQuit();
});

async function gracefulQuit() {
	if (ipfsd.started) {
		if (ipfsd.gatewayAddr) {
			updateStatus('Stopping IPFS Node...');
			await ipfsd.stop();
		}
	}
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

	if (win) {
		win.webContents.send('updateStatus', { ipfsUrl, status, hideStatus });
	}
}