const electron = require('electron');
const {ipcRenderer: ipc} = electron;

const webview = document.getElementById('app');
const spinner = document.getElementById('spinner');
const statusText = document.getElementById('loading-text');

let rdy = false;

webview.addEventListener('dom-ready', () => {
	webview.openDevTools();

	console.log(rdy);

	console.log('dom-ready');
	if (rdy) {
		spinner.style.visibility = 'hidden';
		webview.style.visibility = 'visible';
		// statusText.style.visibility = 'hidden';

		ipc.send('app-loaded');
	} else {
		rdy = true;
	}
});

const rects = document.getElementsByClassName('sk-rect');

webview.style.visibility = 'hidden';
// webview.onload = () => {
// 	spinner.style.visibility = 'hidden';
// 	webview.style.visibility = 'visible';
// 	ipc.emit('app-loaded');
// };

let i = 0;
while(i < rects.length-1) {
	let rect = rects.item(i);
	rect.style['background-color'] = 'white';
	rect.style.width = '20px';

	i++;
}

ipc.on('connect-ipfs', (e, apiAddr) => {
	webview.addEventListener('did-finish-load', () => {
		webview.send('connect-ipfs', apiAddr);
	});
});

ipc.on('updateStatus', (e, args) => {
	console.log('updateStatus');
	statusText.innerText = args.status;
	if (args.ipfsUrl != null && args.status !== 'Done') {
		webview.loadURL(args.ipfsUrl);
		console.log(args.ipfsUrl);
	}
	if (args.hideStatus) {
		console.log('Hide status');
		statusText.style.visibility = 'hidden';
	} else {
		statusText.style.visibility = 'visible';
	}
});