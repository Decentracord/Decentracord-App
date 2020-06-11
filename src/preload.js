const ipfsClient = require('ipfs-http-client');
const { ipcRenderer: ipc, webFrame } = require('electron');

ipc.on('connect-ipfs', (e, apiAddr) => {
	console.log('frame-renderer');
	window.ipfs = ipfsClient(apiAddr);
});

console.log(webFrame.routingId);

// if (window.location !== 'about:blank' && document.getElementById('app').tagName !== 'webview') {
// 	i
// }