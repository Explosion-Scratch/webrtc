const Toast = swal.mixin({
	toast: true,
	position: "top-right",
	iconColor: "white",
	customClass: {
		popup: "colored-toast"
	},
	showConfirmButton: false,
	timer: 1500,
	timerProgressBar: true
});
var peer = new Peer({
	config: {
		iceServers: [
			{ url: "stun:stun.l.google.com:19302" },
			{ url: "stun:stun1.l.google.com:19302" },
			{ url: "stun:stun2.l.google.com:19302" },
			{ url: "stun:stun3.l.google.com:19302" }
		]
	} /* Sample servers, please use appropriate ones */
});
peer.on("close", () => {
	document.querySelector(".buttons").classList.add("hide");
	document.querySelector("video")?.remove();
	swal.fire({
		title: "Screen share ended",
		icon: "info",
		text: "The screen share ended, this can happen because of bad connection, but most of the time because the user sharing their screen stopped.",
		confirmButtonText: "Ok. That was fun!",
		reverseButtons: true,
		allowEscapeKey: false,
		allowOutsideClick: false,
		backdrop: false,
		customClass: {
			popup: "fullscreen"
		}
	}).then(() => {
		location.reload();
	})
})
const peerInitiated = new Promise((res) => peer.on("open", res));
const params = Object.fromEntries(
	new URLSearchParams(location.search).entries()
);
if (params.id) {
	join(params.id);
} else {
	swal
		.fire({
			title: "Hello!",
			text:
				"Would you like to share your screen or view someone else's screen?",
			confirmButtonText: `<span class="iconify-inline" data-icon="fa-solid:share"></span> Share my screen`,
			denyButtonText: `<span class="iconify-inline" data-icon="grommet-icons:personal-computer"></span> View screen`,
			showDenyButton: true,
			denyButtonColor: "#0006",
			reverseButtons: true,
			allowEscapeKey: false,
			allowOutsideClick: false,
			backdrop: false,
			customClass: {
				popup: "fullscreen"
			}
		})
		.then(({ value }) => {
			if (value === true /* Share screen */) {
				init({ action: "share", peer });
			} else {
				new swal({
					title: "Enter a meeting ID here",
					input: "text",
					inputLabel: "This should be a meeting ID that you copied",
					inputAttributes: {
						autofocus: true
					},
					customClass: {
						popup: "fullscreen"
					},
					backdrop: false,
					inputPlaceholder: "Meeting ID here",
					showCancelButton: false,
					confirmButtonText: `Join`,
					showCloseButton: false,
					focusConfirm: true,
					allowEscapeKey: false,
					allowOutsideClick: false
				}).then(({ value }) => {
					Toast.fire({
						icon: "info",
						title: "Joining...",
						timer: 5000,
					});
					init({ action: "join", id: value, peer });
				});
			}
		});
}
function join(id) {
	Toast.fire({
		icon: "info",
		title: "Joining...",
		timer: 5000,
	});
	swal
		.fire({
			title: "View screen",
			text: "Press 'Join now' to view the screen being shared",
			confirmButtonText: "Join now",
			reverseButtons: true,
			allowEscapeKey: false,
			allowOutsideClick: false,
			backdrop: false,
			customClass: {
				popup: "fullscreen"
			}
		})
		.then(() => {
			init({ action: "join", id, peer });
		});
}
async function init({ action, id, peer }) {
	if (action === "join") {
		const h = id;
		console.log("Waiting for id");
		await peerInitiated;
		var conn = peer.connect(h);
		var errorTimeout = setTimeout(() => {
			new swal({
				title: "Couldn't join meeting",
				icon: "error",
				text:
					"This could be due to a variety of reasons, perhaps you're behind a firewall, perhaps whoever is sharing has stopped, or maybe the meeting ID's invalid. Sorry!",
				customClass: {
					popup: "fullscreen"
				},
				backdrop: false,
				showCloseButton: false,
				showConfirmButton: false,
				allowEscapeKey: false,
				allowOutsideClick: false
			});
		}, 4000);
		console.log("Connecting to %o", h);
		conn.on("open", function () {
			console.log("Sending open message");
			conn.send({ type: "share", id: peer.id });
			conn.send({ type: "joined", id: peer.id });
			window.onbeforeunload = () => conn.send({ type: "left", id: peer.id });
			conn.on("data", (data) => {
				console.log("Got data", data)
				if (data.action === "ended"){
					conn.send({type: "destroy"})
					setTimeout(() => peer.destroy());
				}
				if (data.action === "paused"){
					document.querySelector("video").classList.add("hide")
					swal.fire({
						title: "Screen share paused",
						icon: "info",
						text: "The person sharing their screen paused sharing, when they resume this will go away.",
						showConfirmButton: false,
						reverseButtons: true,
						allowEscapeKey: false,
						allowOutsideClick: false,
						backdrop: false,
						customClass: {
							popup: "fullscreen"
						}
					})
				}
				if (data.action === "resumed"){
					swal.close();
					document.querySelector("video").classList.remove("hide")
					Toast.fire({
						icon: "info",
						title: "Stream resumed",
					});
				}
			})
		});
		peer.on("call", (call) => {
			clearTimeout(errorTimeout);
			swal.close();
			console.log("Got response call");
			call.answer();
			call.on("stream", function (stream) {
				console.log("Got stream!!!", stream);
				addStream(stream);
			});
		});
	} else if (action === "share") {
		await peerInitiated;
		const mediaStream = await getMedia();
		// If the user denies
		if (!mediaStream) return location.reload();
		const url = `${peer.id}`;
		new swal({
			title: "Copy this meeting ID and then send it to someone else",
			input: "text",
			inputValue: url,
			inputAttributes: { readonly: true },
			inputPlaceholder: "Copy this",
			cancelButtonText: "No thanks",
			showCancelButton: false,
			confirmButtonText: `<span class="iconify" data-icon="akar-icons:copy"></span> Copy it`,
			showCloseButton: true,
			focusConfirm: true
		}).then(async ({value}) => {
			if (value !== true) return;
			navigator.clipboard.writeText(url);
			await Toast.fire({
				icon: "success",
				title: "Copied!"
			});
		});
		addStream(mediaStream, true);
		console.log("Got media stream");

		var connections = [];
		document.querySelector(".buttons").classList.remove("hide");
		mediaStream.getVideoTracks()[0].onended = function () {
			stop(mediaStream);
			connections.forEach(i => {
				i.send({action: "ended"});
			})
			Toast.fire({
				icon: "info",
				title: "Stream stopped",
				timer: 5000,
			});
			setTimeout(() => peer.destroy(), 100);
		};
		document.querySelector("#stop").onclick = ({currentTarget: el}) => {
			Toast.fire({
				icon: "info",
				title: "Stream stopped",
				timer: 5000,
			});
			stop(mediaStream);
			connections.forEach(i => {
				i.send({action: "ended"});
			})
			setTimeout(() => peer.destroy(), 100);
		}
		document.querySelector("#copy_link").onclick = () => {
			navigator.clipboard.writeText(`${location /*location already has '/' */}?id=${peer.id}`);
			Toast.fire({
					icon: "success",
					title: "Copied meeting URL to clipboard!",
				});
		}
		document.querySelector("#pause").onclick = ({currentTarget: el}) => {
			if (el.getAttribute("data-paused") == "false"){
				Toast.fire({
					icon: "success",
					title: "Paused!",
					timer: 5000,
				});
				enable(mediaStream, false)
				document.querySelector("video").classList.add("hide");
				el.innerHTML = `<span class="iconify" data-icon="clarity:play-solid"></span>`;
				el.setAttribute("data-paused", "true")
				connections.forEach(i => {
					console.log(i.send)
					i.send({action: "paused"});
				})
			} else {
				// This is gonna cause glitches when it hides for a different reason
				document.querySelector("video").classList.remove("hide");
				enable(mediaStream, true)
				Toast.fire({
					icon: "success",
					title: "Resumed!",
					timer: 5000,
				});
				el.innerHTML = `<span class="iconify" data-icon="akar-icons:pause"></span>`;
				el.setAttribute("data-paused", "false")
				connections.forEach(i => {
					console.log(i.send)
					i.send({action: "resumed"});
				})
			}
		}
		peer.on("connection", (connection) => {
			console.log("Someone requested a connection");
			connection.on("data", function (data) {
				connection.send({action: 'test'})
				connections.push(connection);
				if (data.type == "share") {
					console.log("Sharing media stream with", data.id);
					peer.call(data.id, mediaStream);
				}
				if (data.type === "joined"){
					Toast.fire({
						icon: "info",
						title: "Someone joined",
					});
				}
				if (data.type === "destroy"){
					peer.destroy();
				}
				if (data.type === "left"){
					Toast.fire({
						icon: "info",
						title: "Someone left",
					});
				}
				console.log("Received", data);
			});
		});
	}
	function addStream(stream, local) {
		var v;
		if (!document.querySelector("video")){
			v = document.createElement("video");
			v.setAttribute("autoplay", true);
			if (local){
				v.classList.add("local");
			}
			document.body.appendChild(v);
		} else {
			v = document.querySelector("video");
		}
		if (local){
			v.setAttribute("muted", true)
		}
		v.srcObject = stream;
	}
}
function stop(stream){
	stream.getTracks().forEach(i => i.stop());
}
function enable(stream, enabled){
	stream.getTracks().forEach(i => i.enabled = enabled);
}
async function getMedia(){
	var mediaStream;
	try {
		var {value: options} = await swal.fire({
				title: "Select your sources",
				confirmButtonText: "Share!",
				html: `
						<label class='sourceSelect_label'><div><span class="iconify-inline" data-icon="ant-design:audio-filled"></span> Audio source:</div>
						<select id="audio_select" class='select'>
								<option value='display'>Audio from your computer</option>
								<option value='system'>Audio from your microphone</option>
								<option value='both'>Both computer and microphone audio</option>
								<option value='none' selected>No audio</option>
						</select>
						</label>
						<label class='sourceSelect_label'><div><span class="iconify-inline" data-icon="fluent:video-20-filled"></span> Video source:</div> 
						<select id="video_select" class='select'>
								<option value='display'>Screen share</option>
								<option value='system'>Your webcam</option>
						</select>
						</label>
				`,
				allowEscapeKey: false,
				allowOutsideClick: false,
				backdrop: false,
				customClass: {
						popup: "fullscreen",
						confirmButton: "confirmy"
				},
				preConfirm: ()=>{
						return {
								audio: document.querySelector("#audio_select").value,
								video: document.querySelector("#video_select").value
						};
				}
				,
		});

		mediaStream = await getStream(options);
		} catch(e) { 
			var {value} = await swal.fire({
				title: "Error",
				icon: "error",
				text:
					e.message,
				confirmButtonText: "Try again",
				denyButtonText: "No thanks",
				showDenyButton: true,
				reverseButtons: true,
				allowEscapeKey: false,
				allowOutsideClick: false,
				backdrop: false,
				customClass: {
					popup: "fullscreen"
				}
			})
			try {
				mediaStream.getTracks().forEach(i => i.stop())
			}catch(e){}
			if (value === true){
					mediaStream = "retry";
			} else {
				mediaStream = false;
			}
		}
		if (mediaStream === "retry"){
			mediaStream = await getMedia();
		}
		return mediaStream;
}
async function getStream({audio, video}) {
    var permissions = {
        both: {},
        system: {},
        display: {},
				none: {},
    };
    var streams = {};
    if (video) {
        //If video === 'system' then add {system: {video: true}}
        permissions[video].video = true;
    }
    if (audio) {
        permissions[audio].audio = true;
    }
    if (permissions.both.audio) {
        permissions.system.audio = true;
        permissions.display.audio = true;
    }
    console.log(permissions);
    try {
        if (Object.keys(permissions.system).length) {
            streams.system = await navigator.mediaDevices.getUserMedia(permissions.system);
        }
        if (Object.keys(permissions.display).length) {
            //getDisplayMedia requires video.
            streams.display = await navigator.mediaDevices.getDisplayMedia({video: true, ...permissions.display});
        }
    } catch(e){
        var _streams = Object.values(streams).map(i => i.getTracks()).flat();
        //Stop all running streams
        _streams.forEach(i => i.stop())
        console.error(e);
        throw new Error(`Permission denied.`)
        return;
    }
    var audioStream, videoStream;
    videoStream = get("video", streams.system) || get("video", streams.display);
    audioStream = get("audio", streams.system) || get("audio", streams.display);
    if (!audioStream && !permissions.none.audio) {
        if (permissions.both.audio){
            throw new Error(`You selected to mix audio from your microphone and the system audio, but no audio was given.`)
            return;
        }
        throw new Error(`You selected ${audio === 'system' ? 'microphone' : 'system'} audio as the source but it was not provided.`);
        return;
    }
    if (!videoStream) {
        throw new Error(`You selected ${video === 'system' ? 'webcam' : 'display'} video as the source but it was not provided.`);
        return;
    }
    if (permissions.both.audio) {
				const audioStreams = [get("audio", streams.system), get("audio", streams.display)];
				console.log(audioStreams, mixAudio(...audioStreams));
        audioStream = mixAudio(...audioStreams)
        if (!audioStream) {
            throw new Error(`You selected to mix microphone audio and system audio but your ${get("audio", streams.system) ? "system" : "microphone"} audio was not given.`);
            return;
        }
				return createStream(videoStream, ...audioStream)
    }
    return createStream(videoStream, audioStream);
}
function get(type, stream) {
    if (type === "audio") {
        return stream?.getAudioTracks()?.[0];
    }
    if (type === "video") {
        return stream?.getVideoTracks()?.[0];
    }
}
function mixAudio(desktopStream, voiceStream) {
    // Return undefined if both are not avalible.
    if (!(desktopStream && voiceStream))
        return undefined;
		console.log({desktopStream, voiceStream})
		// desktopStream and voiceStream are tracks not streams here
		desktopStream = createStream(desktopStream);
		voiceStream = createStream(voiceStream);
    const context = new AudioContext();
    const source1 = context.createMediaStreamSource(desktopStream);
    const source2 = context.createMediaStreamSource(voiceStream);
    const destination = context.createMediaStreamDestination();

    const desktopGain = context.createGain();
    const voiceGain = context.createGain();

    desktopGain.gain.value = 0.7;
    voiceGain.gain.value = 0.7;

    source1.connect(desktopGain).connect(destination);
    source2.connect(voiceGain).connect(destination);
		// Important to return tracks
    return destination.stream.getAudioTracks();
}

function createStream(...tracks) {
    if (Array.isArray(arguments[0])) {
        tracks = arguments[0];
        //Also allow [stream1, stream2] etc
    }
		tracks = tracks.filter(i => i);
    let newStream = new MediaStream();
    tracks.forEach(i=>newStream.addTrack(i));
    return newStream;
}
