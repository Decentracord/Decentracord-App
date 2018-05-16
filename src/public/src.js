const electron = require("electron");
const {ipcRenderer: ipc} = electron;

let frame = document.getElementById("app");
let spinner = document.getElementById("spinner");
let statusText = document.getElementById("loading-text");


let rects = document.getElementsByClassName("sk-rect");

frame.style.visibility = "hidden";
frame.onload = () => {
	spinner.style.visibility = "hidden";
	frame.style.visibility = "visible";
	ipc.emit("app-loaded");
};

let i = 0;
while(i < rects.length-1) {
	let rect = rects.item(i);
	rect.style["background-color"] = "white";
	rect.style.width = "20px";

	i++;
}

ipc.on("updateStatus", (e, args) => {
	statusText.innerText = args.status;
	frame.src = args.url;
	if (args.hideStatus) {
		console.log("Hide status");
		statusText.parentElement.removeChild(statusText);
	}
});