const electron = require("electron");
const {ipcMain: ipc, app, BrowserWindow} = electron;
const {autoUpdater} = require("electron-updater");

const url = require("url");
const path = require("path");
const fs = require("fs");
const os = require("os");

const pug = require("pug");

const IPFSFactory = require("ipfsd-ctl");
const ipfsd = IPFSFactory.create();
let ipfsNode;

const userDataPath = app.getPath("userData");
let configFile = path.join(userDataPath, "config.json");
let cachePath = path.join(userDataPath, "ipnsCache.json");


let config = {
};

let ipnsCache = {};

if (fs.existsSync(cachePath)) {
	ipnsCache = JSON.parse(fs.readFileSync(cachePath));
}

let win; // this will store the window object

let ipnsHash = "QmaqyhsTB3eND1hsd9toGbf1kzoomtLSVqTeLrvzXUTNN8";

// creates the default window
function createDefaultWindow(file, options) {
	win = new BrowserWindow({width: 900, height: 680, frame: false});
	loadPug(win, file, options);
	return win;
}

let ipfsUrl;
var globalStatus = "Waiting for the IPFS node";

let repoPath = path.join("~", ".ipfs");

ipfsd.spawn({disposable: false, repoPath: repoPath}, (err, ipfsNodee) => {
	ipfsNode = ipfsNodee;

	updateStatus("IPFS Node spawned.");

	isIPFSInitialized(repoPath, (callback) => {
		ipfsNode.init((err) => {
			handleErr(err);
	
			updateStatus("Initializing the IPFS repo...");
	
			callback();
		});
	}, () => {
		ipfsNode.start((err, ipfs) => {
			handleErr(err);

			updateStatus("Resolving the IPNS hash... This may take a while.");
			resolveAndCache(ipfs, ipnsHash, 10800, (err, ipfsPath) => {
				if (err) {
					ipfsPath == "/ipns/"+ipnsHash;
					console.error(err);
				}

				ipfs.pin.add(ipfsPath);

				let urlObj = ipfsNode.gatewayAddr.nodeAddress();
				let gatewayUrl = "http://"+urlObj.address+":"+urlObj.port;
				ipfsUrl = gatewayUrl+ipfsPath;

			
				console.log(ipfsUrl);
				updateStatus("Url obtained. Loading...");
				setInterval(refreshCache.bind(null, [ipfs]), 1500000);
			});
		});
	});

});

app.on("ready", () => {
	//autoUpdater.checkForUpdates();

	createDefaultWindow("loader", { url: url, status: globalStatus });
});

// when the update has been downloaded and is ready to be installed, notify the BrowserWindow
autoUpdater.on("update-downloaded", (info) => {
	win.webContents.send("updateReady");
});

// when receiving a quitAndInstall signal, quit and install the new version ;)
ipc.on("quitAndInstall", (event, arg) => {
	autoUpdater.quitAndInstall();
});

ipc.on("app-loaded", (e, arg) => {
	updateStatus("Done", true);
});

app.on("window-all-closed", () => {
	gracefulQuit();
});

function loadPug(win, file, options) {
	//let h = "data:text/html;charset=utf-8," + encodeURI(pug.renderFile(file));
    
	let pathToFile = path.join(__dirname, "public", file);

	fs.writeFileSync(pathToFile+".html", pug.renderFile(pathToFile+".pug", options));

	win.loadURL(url.format({
		pathname: pathToFile+".html",
		protocol: "file:",
		slashes: true
	}));
}

function gracefulQuit() {
	ipfsNode.stop((err) => {
		handleErr(err);
		ipfsNode.cleanup((err) => {
			handleErr(err);
			if (fs.existsSync(path.join(repoPath, "api"))) {
				fs.unlinkSync(path.join(repoPath, "repo.lock"));
			}
			app.quit();
		});
	});
}

function handleErr(err) {
	if (err) {
		updateStatus("Error: "+err);
		setTimeout(gracefulQuit, 2000);
		console.error(err);
	}
}

/**
 * 
 * @param {string} repoPath 
 * @param {function} ifNot 
 * @param {function} callback 
 */
function isIPFSInitialized(repoPath, ifNot, callback) {
	fs.exists(path.join(repoPath, "config").replace("~", require("os").homedir()), (exists) => {
		if (exists) {
			callback();
		} else {
			ifNot(callback);
		}
	});
}

function updateStatus(status, hideStatus) {
	console.log(status);
	globalStatus = status;
	//ipc.emit("updateStatus", { url: ipfsUrl, status: status });
	let data = { url: ipfsUrl, status: status };
	if (hideStatus) data.hideStatus = hideStatus;
	if (win) {
		win.webContents.send("updateStatus", data);
	}
}

function resolveAndCache(ipfs, ipnsHash, time, callback, refresh) {
	let now = Date.now();
	if (!refresh && ipnsCache[ipnsHash] && ipnsCache[ipnsHash].cacheUntil > now) {
		callback(null, ipnsCache[ipnsHash].value);
	} else {
		ipfs.name.resolve(ipnsHash, (err, ipfsHash) => {
			ipnsCache[ipnsHash] = {
				value: ipfsHash,
				cacheUntil: now+time*1000,
				cacheFor: time*1000
			};
			if (!refresh) writeCache();
			callback(ipfsHash);
		});
	}
}

function refreshCache(ipfs) {
	let cachedHashes = Object.keys(ipnsCache);
	refresh(ipfs, cachedHashes, 0);
}

function refresh(ipfs, list, i) {
	if (i <= list.length-1) {
		let hash = list[i];
		resolveAndCache(ipfs, hash, ipnsCache[hash].cacheFor, refresh.bind(null, [ipfs, list, i+1]), true);
	} else {
		writeCache();
	}
}

function writeCache() { 
	fs.writeFile(cachePath, JSON.stringify(ipnsCache, null, "\t"), () => {
		console.log("Cache writtern to "+cachePath);
	});
}