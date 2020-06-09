const electron = require('electron');
const {ipcRenderer: ipc} = electron;

const webview = document.getElementById('app');
const spinner = document.getElementById('spinner');
const statusText = document.getElementById('loading-text');

let rdy = 0;

webview.addEventListener('dom-ready', () => {
	console.log('dom-ready');
	if (rdy == 1) {
		webview.openDevTools();
		spinner.style.visibility = 'hidden';
		webview.style.visibility = 'visible';
		ipc.emit('app-loaded');

		statusText.style.visibility = 'hidden';
	}
	rdy++;
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

ipc.on('updateStatus', (e, args) => {
	console.log('updateStatus');
	statusText.innerText = args.status;
	if (args.ipfsUrl != null) {
		webview.loadURL(args.ipfsUrl);
		console.log(args.ipfsUrl);
	}
	if (args.hideStatus) {
		console.log('Hide status');
		statusText.parentElement.removeChild(statusText);
	}
});