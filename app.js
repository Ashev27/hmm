/**
 * Ashly Photo Booth - Application Logic
 */

// Application State
const state = {
  // Security
  pinCode: "122724",
  enteredPin: "",
  postPinAction: null, // Callback to run after PIN validates successfully

  // Camera & Stream
  currentStream: null,
  devices: [],
  currentDeviceIndex: 0,
  isCameraReady: false,

  // Filter settings for active capturing row
  selectedStyle: "original",
  filters: {
    brightness: 100, // 50 - 150
    contrast: 100,   // 50 - 150
    saturation: 100, // 0 - 200
    exposure: 0,     // -100 - 100
    sharpness: 0,    // 0 - 100
    blur: 0,         // 0 - 10
    vibrance: 100,   // 50 - 150
    temperature: 0,  // -100 - 100
    tint: 0,         // -100 - 100
    vignette: 0,     // 0 - 100
    grain: 0,        // 0 - 100
    shadow: 0,       // -50 - 50
    highlight: 0,    // -50 - 50
    fade: 0          // 0 - 100
  },

  // Sequential capture state
  currentCaptureStep: 0, // 0 (Row 1), 1 (Row 2), 2 (Row 3), etc.
  capturedPhotos: [null, null, null, null, null, null], // Stores raw canvases
  photoStyles: [
    { selectedStyle: "original", filters: { brightness: 100, contrast: 100, saturation: 100, exposure: 0, sharpness: 0, blur: 0, vibrance: 100, temperature: 0, tint: 0, vignette: 0, grain: 0, shadow: 0, highlight: 0, fade: 0 } },
    { selectedStyle: "original", filters: { brightness: 100, contrast: 100, saturation: 100, exposure: 0, sharpness: 0, blur: 0, vibrance: 100, temperature: 0, tint: 0, vignette: 0, grain: 0, shadow: 0, highlight: 0, fade: 0 } },
    { selectedStyle: "original", filters: { brightness: 100, contrast: 100, saturation: 100, exposure: 0, sharpness: 0, blur: 0, vibrance: 100, temperature: 0, tint: 0, vignette: 0, grain: 0, shadow: 0, highlight: 0, fade: 0 } },
    { selectedStyle: "original", filters: { brightness: 100, contrast: 100, saturation: 100, exposure: 0, sharpness: 0, blur: 0, vibrance: 100, temperature: 0, tint: 0, vignette: 0, grain: 0, shadow: 0, highlight: 0, fade: 0 } },
    { selectedStyle: "original", filters: { brightness: 100, contrast: 100, saturation: 100, exposure: 0, sharpness: 0, blur: 0, vibrance: 100, temperature: 0, tint: 0, vignette: 0, grain: 0, shadow: 0, highlight: 0, fade: 0 } },
    { selectedStyle: "original", filters: { brightness: 100, contrast: 100, saturation: 100, exposure: 0, sharpness: 0, blur: 0, vibrance: 100, temperature: 0, tint: 0, vignette: 0, grain: 0, shadow: 0, highlight: 0, fade: 0 } }
  ],
  activeEditIndex: 0, // 0, 1, 2, 3, 4, 5, or "all"
  frameStyle: "black", // "black", "white", "pink", "kraft", "fuji"
  stripLayout: "double", // "double", "single"
  totalSteps: 3,

  // Gesture capture (MediaPipe)
  gestureEnabled: false,
  handsDetector: null,
  isCountingDown: false,
  countdownTime: 5,
  countdownInterval: null,
  lastHandDetectedTime: 0,

  // Online Multi-User (WebRTC PeerJS)
  peer: null,
  peerConnection: null, // Data channel
  peerCall: null,       // Media stream channel
  remoteStream: null,   // Remote friend stream
  isHost: false,
  roomCode: "",
  localName: "You",
  remoteName: "Friend"
};

// Default filter values for reset
const defaultFilters = { ...state.filters };

// DOM Elements
const screens = {
  landing: document.getElementById('screen-landing'),
  pin: document.getElementById('screen-pin'),
  booth: document.getElementById('screen-booth'),
  preview: document.getElementById('screen-preview')
};

// Live 6-row video and canvas arrays
const liveLocalVideos = [
  document.getElementById('webcam-0'),
  document.getElementById('webcam-1'),
  document.getElementById('webcam-2'),
  document.getElementById('webcam-3'),
  document.getElementById('webcam-4'),
  document.getElementById('webcam-5')
];
const liveRemoteVideos = [
  document.getElementById('webcam-remote-0'),
  document.getElementById('webcam-remote-1'),
  document.getElementById('webcam-remote-2'),
  document.getElementById('webcam-remote-3'),
  document.getElementById('webcam-remote-4'),
  document.getElementById('webcam-remote-5')
];
const frozenCanvasesLocal = [
  document.getElementById('frozen-local-0'),
  document.getElementById('frozen-local-1'),
  document.getElementById('frozen-local-2'),
  document.getElementById('frozen-local-3'),
  document.getElementById('frozen-local-4'),
  document.getElementById('frozen-local-5')
];
const frozenCanvasesRemote = [
  document.getElementById('frozen-remote-0'),
  document.getElementById('frozen-remote-1'),
  document.getElementById('frozen-remote-2'),
  document.getElementById('frozen-remote-3'),
  document.getElementById('frozen-remote-4'),
  document.getElementById('frozen-remote-5')
];
const stripRows = document.querySelectorAll('.strip-row');

const previewCanvas = document.getElementById('preview-canvas');
const saveCanvas = document.getElementById('save-canvas');
const shutterFlash = document.getElementById('shutter-flash');
const vignetteOverlay = document.getElementById('vignette-overlay');
const grainOverlay = document.getElementById('grain-overlay');
const countdownOverlay = document.getElementById('countdown-overlay');
const countdownCircle = document.getElementById('countdown-circle');
const countdownNumber = document.getElementById('countdown-number');
const feedbackAlert = document.getElementById('feedback-alert');
const gestureStatus = document.getElementById('gesture-status');
const roomStatusBadge = document.getElementById('room-status-badge');
const waitingOverlay = document.getElementById('waiting-overlay');
const shareLinkInput = document.getElementById('share-link-input');
const roomCodeDisplay = document.getElementById('room-code-display');

const localNameBadges = document.querySelectorAll('.badge-local-live');
const remoteNameBadges = document.querySelectorAll('.badge-remote-live');

// Audio Context for synthesized shutter sound
let audioCtx = null;

/* ==========================================================================
  1. NAVIGATION & INITIALIZATION
  ========================================================================== */
function showScreen(screenId) {
  Object.keys(screens).forEach(key => {
    if (key === screenId) {
      screens[key].classList.add('active');
    } else {
      screens[key].classList.remove('active');
    }
  });

  // Screen-specific camera and stream toggling
  if (screenId === 'booth') {
    startCamera();
  } else {
    stopCamera();
  }

  if (screenId === 'preview') {
    renderCapturedPhoto();
    syncPreviewControlsUI();
  }
}

// Check URL Hash on Load to see if joining a room
window.addEventListener('DOMContentLoaded', () => {
  const hash = window.location.hash.trim();
  if (hash.startsWith('#room-')) {
    const code = hash.replace('#room-', '');
    if (code) {
      state.isHost = false;
      state.roomCode = code;
      showScreen('booth');
    }
  }

  // Apply initial pose count visibility
  const rows = document.querySelectorAll('.strip-row');
  rows.forEach((row, idx) => {
    if (idx < state.totalSteps) {
      row.style.display = 'flex';
    } else {
      row.style.display = 'none';
    }
  });
});

// Landing Actions
document.getElementById('btn-create-room').addEventListener('click', () => {
  state.isHost = true;
  state.roomCode = Math.floor(10000 + Math.random() * 90000).toString(); // 5-digit code
  window.location.hash = `room-${state.roomCode}`;
  showScreen('booth');
});

document.getElementById('btn-join-room').addEventListener('click', () => {
  const code = document.getElementById('input-room-code').value.trim();
  if (!code) {
    alert("Please enter a valid room code.");
    return;
  }
  state.isHost = false;
  state.roomCode = code;
  window.location.hash = `room-${state.roomCode}`;
  showScreen('booth');
});

/* ==========================================================================
  2. WEBCAM MANAGEMENT
  ========================================================================== */
async function startCamera() {
  stopCamera();
  roomStatusBadge.textContent = "Setting camera...";

  try {
    const constraints = {
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: "user"
      },
      audio: false
    };

    if (state.devices.length > 0) {
      const device = state.devices[state.currentDeviceIndex];
      constraints.video.facingMode = undefined;
      constraints.video.deviceId = { exact: device.deviceId };
    }

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    state.currentStream = stream;

    // Bind stream to all 3 local webcam video elements
    liveLocalVideos.forEach(v => {
      if (v) v.srcObject = stream;
    });

    state.isCameraReady = true;

    if (state.devices.length === 0) {
      await getCameras();
    }

    updateLiveFilters();
    initiateP2PConnection(); // Connect or host online room once camera is ready

    if (state.gestureEnabled) {
      startGestureProcessing();
    }

  } catch (err) {
    console.error("Camera access error:", err);
    roomStatusBadge.textContent = "Camera Error";
    alert(`Could not access your camera (${err.name}: ${err.message}).\n\nCommon solutions:\n1. Click the site settings icon to the left of the URL bar and allow "Camera".\n2. Close any other applications (like OBS, Zoom, or another tab) that might be using the camera.`);
  }
}

function stopCamera() {
  if (state.currentStream) {
    state.currentStream.getTracks().forEach(track => track.stop());
    state.currentStream = null;
  }
  // Unbind stream from all 3 local webcam video elements
  liveLocalVideos.forEach(v => {
    if (v) v.srcObject = null;
  });
  state.isCameraReady = false;
  cancelGestureCountdown();
  closeP2PConnection();
}

async function getCameras() {
  try {
    const allDevices = await navigator.mediaDevices.enumerateDevices();
    state.devices = allDevices.filter(d => d.kind === 'videoinput' && d.deviceId);
  } catch (err) {
    console.error("Error enumerating cameras:", err);
  }
}

document.getElementById('btn-switch-camera').addEventListener('click', async () => {
  if (state.devices.length <= 1) {
    await getCameras();
    if (state.devices.length <= 1) {
      alert("No alternate cameras found.");
      return;
    }
  }
  state.currentDeviceIndex = (state.currentDeviceIndex + 1) % state.devices.length;
  startCamera();
});

/* ==========================================================================
  4. WEBRTC P2P MULTIPLAYER SIGNALING (PeerJS)
  ========================================================================== */
function initiateP2PConnection() {
  closeP2PConnection();

  roomStatusBadge.textContent = "Connecting signaling...";

  // Format sharing link
  const baseURL = window.location.href.split('#')[0];
  const shareURL = `${baseURL}#room-${state.roomCode}`;
  shareLinkInput.value = shareURL;
  roomCodeDisplay.textContent = state.roomCode;

  if (state.isHost) {
    // 1. HOST MODE
    waitingOverlay.style.display = 'flex';

    // Register as host-roomCode
    state.peer = new Peer('ashly-booth-host-' + state.roomCode);

    state.peer.on('open', (id) => {
      roomStatusBadge.textContent = `Room ${state.roomCode}: Open`;
    });

    // Listen for client data connection
    state.peer.on('connection', (conn) => {
      state.peerConnection = conn;
      setupDataChannel();
    });

    // Listen for client camera feed call
    state.peer.on('call', (call) => {
      state.peerCall = call;
      call.answer(state.currentStream);

      call.on('stream', (stream) => {
        state.remoteStream = stream;
        liveRemoteVideos.forEach(v => {
          if (v) v.srcObject = stream;
        });
        waitingOverlay.style.display = 'none';
        roomStatusBadge.textContent = "Friend Connected";
        updateCameraVisibility();
      });

      call.on('close', handlePeerDisconnect);
    });

  } else {
    // 2. CLIENT MODE
    waitingOverlay.style.display = 'none';

    // Register with unique client ID
    const clientID = 'ashly-booth-client-' + Math.random().toString(36).substring(2, 9);
    state.peer = new Peer(clientID);

    state.peer.on('open', (id) => {
      roomStatusBadge.textContent = "Connecting to Host...";

      // Connect data channel to Host
      const conn = state.peer.connect('ashly-booth-host-' + state.roomCode);
      state.peerConnection = conn;
      setupDataChannel();

      // Call Host camera feed
      const call = state.peer.call('ashly-booth-host-' + state.roomCode, state.currentStream);
      state.peerCall = call;

      call.on('stream', (stream) => {
        state.remoteStream = stream;
        liveRemoteVideos.forEach(v => {
          if (v) v.srcObject = stream;
        });
        roomStatusBadge.textContent = "Connected to Friend";
        updateCameraVisibility();
      });

      call.on('close', handlePeerDisconnect);
    });
  }

  state.peer.on('error', (err) => {
    console.error("PeerJS Error:", err);
    if (err.type === 'peer-unavailable') {
      roomStatusBadge.textContent = "Room unavailable";
      alert("The requested photo room could not be found. Make sure the host is online.");
      showScreen('landing');
    } else {
      roomStatusBadge.textContent = "Network Error";
    }
  });
}

function setupDataChannel() {
  state.peerConnection.on('open', () => {
    // Send local name immediately to friend
    state.peerConnection.send({
      type: 'NAME_CHANGE',
      name: state.localName
    });
    // Send current active visual filters to match presets
    state.peerConnection.send({
      type: 'SYNC_FILTERS',
      style: state.selectedStyle,
      filters: state.filters
    });
    // Send current film strip settings
    state.peerConnection.send({
      type: 'SYNC_STRIP_SETTINGS',
      frameStyle: state.frameStyle,
      stripLayout: state.stripLayout
    });
  });

  state.peerConnection.on('data', (data) => {
    if (!data || !data.type) return;

    switch (data.type) {
      case 'NAME_CHANGE':
        state.remoteName = data.name || "Friend";
        remoteNameBadges.forEach(b => {
          b.textContent = state.remoteName;
        });
        break;

      case 'SYNC_FILTERS':
        state.selectedStyle = data.style;
        state.filters = data.filters;
        syncSlidersUI();
        updateLiveFilters();
        break;

      case 'SYNC_STRIP_SETTINGS':
        state.frameStyle = data.frameStyle;
        state.stripLayout = data.stripLayout;

        // Update selectors UI
        document.getElementById('select-frame-style').value = data.frameStyle;
        document.getElementById('select-strip-layout').value = data.stripLayout;

        // Update live view classes
        const liveStrip = document.getElementById('film-strip-live');
        if (liveStrip) {
          liveStrip.className = `film-strip-live frame-${state.frameStyle}`;
        }
        break;

      case 'SYNC_POSE_COUNT':
        state.totalSteps = data.poseCount;
        document.getElementById('select-pose-count').value = data.poseCount;
        const rows = document.querySelectorAll('.strip-row');
        rows.forEach((row, idx) => {
          if (idx < state.totalSteps) {
            row.style.display = 'flex';
          } else {
            row.style.display = 'none';
          }
        });
        resetBoothCapture();
        break;

      case 'START_COUNTDOWN':
        if (!state.isCountingDown) {
          triggerShutterCountdown(false); // Trigger local run without resending signal
        }
        break;

      case 'RESET_BOOTH':
        resetBoothCapture();
        showScreen('booth');
        break;
    }
  });

  state.peerConnection.on('close', handlePeerDisconnect);
}

function handlePeerDisconnect() {
  state.remoteStream = null;
  liveRemoteVideos.forEach(v => {
    if (v) v.srcObject = null;
  });
  state.remoteName = "Friend";
  remoteNameBadges.forEach(b => {
    b.textContent = state.remoteName;
  });
  updateCameraVisibility();

  if (state.isHost) {
    waitingOverlay.style.display = 'flex';
    roomStatusBadge.textContent = `Room ${state.roomCode}: Open`;
  } else {
    alert("Connection lost with the host. Returning to landing page.");
    showScreen('landing');
  }
}

function closeP2PConnection() {
  if (state.peerCall) {
    state.peerCall.close();
    state.peerCall = null;
  }
  if (state.peerConnection) {
    state.peerConnection.close();
    state.peerConnection = null;
  }
  if (state.peer) {
    state.peer.destroy();
    state.peer = null;
  }
  state.remoteStream = null;
  liveRemoteVideos.forEach(v => {
    if (v) v.srcObject = null;
  });
  updateCameraVisibility();
}

// Copy sharing Link action
document.getElementById('btn-copy-link').addEventListener('click', () => {
  shareLinkInput.select();
  shareLinkInput.setSelectionRange(0, 99999);
  navigator.clipboard.writeText(shareLinkInput.value)
    .then(() => {
      const copyBtn = document.getElementById('btn-copy-link');
      copyBtn.textContent = "Copied!";
      setTimeout(() => { copyBtn.textContent = "Copy Link"; }, 1500);
    })
    .catch(err => {
      alert("Failed to copy link. Please select and copy it manually.");
    });
});

// Local Name Change Action
document.getElementById('input-local-name').addEventListener('input', (e) => {
  let val = e.target.value.trim();
  if (!val) val = "You";
  state.localName = val;
  localNameBadges.forEach(b => {
    b.textContent = val;
  });

  if (state.peerConnection && state.peerConnection.open) {
    state.peerConnection.send({
      type: 'NAME_CHANGE',
      name: val
    });
  }
});

/* ==========================================================================
  5. WEB AUDIO SHUTTER SOUND SYNTHESIZER
  ========================================================================== */
function playShutterSound() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const bufferSize = audioCtx.sampleRate * 0.15;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = buffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1200;
    filter.Q.value = 3;

    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.7, audioCtx.currentTime + 0.005);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);

    noiseSource.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    noiseSource.start();

    // Mirror flip second click click
    setTimeout(() => {
      const clickSource = audioCtx.createBufferSource();
      clickSource.buffer = buffer;

      const clickGain = audioCtx.createGain();
      clickGain.gain.setValueAtTime(0, audioCtx.currentTime);
      clickGain.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.003);
      clickGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.06);

      clickSource.connect(filter);
      filter.connect(clickGain);
      clickGain.connect(audioCtx.destination);
      clickSource.start();
    }, 60);

  } catch (err) {
    console.warn("Could not synthesize shutter sound:", err);
  }
}

/* ==========================================================================
  6. SHUTTER CAPTURE & COLLAGE GENERATION
  ========================================================================== */
function triggerShutterCountdown(shouldSendSignal = true) {
  if (shouldSendSignal && state.peerConnection && state.peerConnection.open) {
    state.peerConnection.send({ type: 'START_COUNTDOWN' });
  }
  startGestureCountdown();
}

function executeShutterCapture() {
  if (!state.isCameraReady) return;

  // Shutter Sound
  playShutterSound();

  // Trigger local Flash CSS Animation
  shutterFlash.classList.add('flash-active');
  setTimeout(() => {
    shutterFlash.classList.remove('flash-active');
  }, 350);

  const step = state.currentCaptureStep;
  if (step < 0 || step >= 6) return;

  // Capture mirrored stream (local) and non-mirrored stream (remote) for the current step
  const rawCanvas = captureRawSplitFrame(step);
  state.capturedPhotos[step] = rawCanvas;

  // Save the current active style/filters to this photo's state
  state.photoStyles[step] = {
    selectedStyle: state.selectedStyle,
    filters: JSON.parse(JSON.stringify(state.filters))
  };

  // Draw the captured frame onto the row's frozen canvases and display them
  freezeRowUI(step, rawCanvas);

  // Increment step
  state.currentCaptureStep++;

  // Sync to next row or complete
  setTimeout(() => {
    if (state.currentCaptureStep < 6) {
      // Deactivate all rows, activate the next one
      stripRows.forEach((row, i) => {
        if (i === state.currentCaptureStep) {
          row.classList.add('active');
        } else {
          row.classList.remove('active');
        }
      });

      // Update filters for the next live feed
      updateLiveFilters();
    } else {
      // All gaps filled! Go to preview screen
      showScreen('preview');
    }
  }, 300);
}

function captureRawSplitFrame(step) {
  const collage = document.createElement('canvas');

  const videoLocal = liveLocalVideos[step];
  const videoRemote = liveRemoteVideos[step];

  const vWidth = videoLocal.videoWidth || 640;
  const vHeight = videoLocal.videoHeight || 480;

  if (state.remoteStream) {
    // Both cameras active: side-by-side vertical split frame (unfiltered raw)
    collage.width = vWidth * 2;
    collage.height = vHeight;
    const ctx = collage.getContext('2d');

    // Draw Local camera on Left Half (mirrored to match live view)
    ctx.save();
    ctx.translate(vWidth, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoLocal, 0, 0, vWidth, vHeight);
    ctx.restore();

    // Draw Remote camera on Right Half
    ctx.drawImage(videoRemote, vWidth, 0, vWidth, vHeight);
  } else {
    // Single Camera: Full viewport frame
    collage.width = vWidth;
    collage.height = vHeight;
    const ctx = collage.getContext('2d');

    ctx.save();
    ctx.translate(vWidth, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoLocal, 0, 0, vWidth, vHeight);
    ctx.restore();
  }

  return collage;
}

function freezeRowUI(step, rawCanvas) {
  const canvasLocal = frozenCanvasesLocal[step];
  const canvasRemote = frozenCanvasesRemote[step];
  const videoLocal = liveLocalVideos[step];
  const videoRemote = liveRemoteVideos[step];

  const filterString = getCSSFilterString(state.selectedStyle, state.filters);

  // Set canvas size matching the webcam video size
  const vWidth = videoLocal.videoWidth || 640;
  const vHeight = videoLocal.videoHeight || 480;

  // Local canvas
  canvasLocal.width = vWidth;
  canvasLocal.height = vHeight;
  const ctxLocal = canvasLocal.getContext('2d');
  if (state.remoteStream) {
    ctxLocal.drawImage(rawCanvas, 0, 0, vWidth, vHeight, 0, 0, vWidth, vHeight);
  } else {
    ctxLocal.drawImage(rawCanvas, 0, 0);
  }
  canvasLocal.style.filter = filterString;
  canvasLocal.style.display = 'block';
  videoLocal.style.display = 'none';

  // Remote canvas
  if (state.remoteStream) {
    canvasRemote.width = vWidth;
    canvasRemote.height = vHeight;
    const ctxRemote = canvasRemote.getContext('2d');
    ctxRemote.drawImage(rawCanvas, vWidth, 0, vWidth, vHeight, 0, 0, vWidth, vHeight);
    canvasRemote.style.filter = filterString;
    canvasRemote.style.display = 'block';
    videoRemote.style.display = 'none';
  } else {
    canvasRemote.style.display = 'none';
    videoRemote.style.display = 'none';
  }

  // Mark the strip row as captured
  const stripRow = document.querySelector(`.strip-row[data-row="${step}"]`);
  if (stripRow) {
    stripRow.classList.add('captured');
  }
}

function resetBoothCapture() {
  state.currentCaptureStep = 0;
  state.capturedPhotos = [null, null, null, null, null, null];
  state.activeEditIndex = 0;

  // Reset individual styles to default
  state.photoStyles = [
    { selectedStyle: "original", filters: { ...defaultFilters } },
    { selectedStyle: "original", filters: { ...defaultFilters } },
    { selectedStyle: "original", filters: { ...defaultFilters } },
    { selectedStyle: "original", filters: { ...defaultFilters } },
    { selectedStyle: "original", filters: { ...defaultFilters } },
    { selectedStyle: "original", filters: { ...defaultFilters } }
  ];

  // Sync back live presets
  state.selectedStyle = "original";
  state.filters = { ...defaultFilters };
  syncSlidersUI();

  // Reset Row classes and elements
  const stripRowsElements = document.querySelectorAll('.strip-row');
  stripRowsElements.forEach((row, i) => {
    row.classList.remove('captured');
    if (i === 0) {
      row.classList.add('active');
    } else {
      row.classList.remove('active');
    }
  });

  // Reset Video / Canvas visibility
  for (let i = 0; i < 6; i++) {
    if (liveLocalVideos[i]) {
      liveLocalVideos[i].style.display = 'block';
      liveLocalVideos[i].style.filter = '';
    }
    if (frozenCanvasesLocal[i]) {
      frozenCanvasesLocal[i].style.display = 'none';
    }
    if (liveRemoteVideos[i]) {
      liveRemoteVideos[i].style.display = 'block';
      liveRemoteVideos[i].style.filter = '';
    }
    if (frozenCanvasesRemote[i]) {
      frozenCanvasesRemote[i].style.display = 'none';
    }
  }

  updateLiveFilters();
  updateCameraVisibility();
}

// Shutter Click Handler
document.getElementById('btn-capture').addEventListener('click', () => {
  cancelGestureCountdown();
  triggerShutterCountdown(true);
});

/* ==========================================================================
  7. STYLES & MANUAL FILTERING PIPELINE
  ========================================================================== */
// Frame style selector listener
document.getElementById('select-frame-style').addEventListener('change', (e) => {
  state.frameStyle = e.target.value;

  // Update live view classes to show the selected frame design in real-time
  const liveStrip = document.getElementById('film-strip-live');
  if (liveStrip) {
    liveStrip.className = `film-strip-live frame-${state.frameStyle}`;
  }

  // Sync style settings to peer
  if (state.peerConnection && state.peerConnection.open) {
    state.peerConnection.send({
      type: 'SYNC_STRIP_SETTINGS',
      frameStyle: state.frameStyle,
      stripLayout: state.stripLayout
    });
  }
});

// Strip layout selector listener
document.getElementById('select-strip-layout').addEventListener('change', (e) => {
  state.stripLayout = e.target.value;

  // Sync layout settings to peer
  if (state.peerConnection && state.peerConnection.open) {
    state.peerConnection.send({
      type: 'SYNC_STRIP_SETTINGS',
      frameStyle: state.frameStyle,
      stripLayout: state.stripLayout
    });
  }
});

// Pose count selector listener
document.getElementById('select-pose-count').addEventListener('change', (e) => {
  state.totalSteps = parseInt(e.target.value);
  
  // Hide/show live view rows dynamically
  const rows = document.querySelectorAll('.strip-row');
  rows.forEach((row, idx) => {
    if (idx < state.totalSteps) {
      row.style.display = 'flex';
    } else {
      row.style.display = 'none';
    }
  });

  // Reset current capture step back to 0
  resetBoothCapture();

  // Sync to peer
  if (state.peerConnection && state.peerConnection.open) {
    state.peerConnection.send({
      type: 'SYNC_POSE_COUNT',
      poseCount: state.totalSteps
    });
  }
});

document.querySelectorAll('.style-card[data-style]').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.style-card[data-style]').forEach(c => c.classList.remove('active'));
    card.classList.add('active');

    state.selectedStyle = card.getAttribute('data-style');
    updateLiveFilters();

    // Broadcast filters to peer
    syncFiltersToPeer();
  });
});

document.querySelectorAll('.filter-slider').forEach(slider => {
  slider.addEventListener('input', (e) => {
    const name = e.target.id.replace('slider-', '');
    let val = parseInt(e.target.value);

    state.filters[name] = val;

    // Update value label
    const labelVal = document.getElementById(`val-${name}`);
    if (name === 'brightness' || name === 'contrast' || name === 'saturation' || name === 'vibrance') {
      labelVal.textContent = `${val}%`;
    } else if (name === 'blur') {
      labelVal.textContent = `${val}px`;
    } else if (name === 'exposure' || name === 'temperature' || name === 'tint' || name === 'shadow' || name === 'highlight') {
      labelVal.textContent = val > 0 ? `+${val}` : val;
    } else {
      labelVal.textContent = `${val}%`;
    }

    updateLiveFilters();
    syncFiltersToPeer();
  });
});

document.getElementById('btn-reset-filters').addEventListener('click', () => {
  resetAllSliders();
  syncFiltersToPeer();
});

function syncFiltersToPeer() {
  if (state.peerConnection && state.peerConnection.open) {
    state.peerConnection.send({
      type: 'SYNC_FILTERS',
      style: state.selectedStyle,
      filters: state.filters
    });
  }
}

function syncSlidersUI() {
  // Sync style cards state
  document.querySelectorAll('.style-card').forEach(card => {
    if (card.getAttribute('data-style') === state.selectedStyle) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });

  // Sync range input positions and indicators
  document.querySelectorAll('.filter-slider').forEach(slider => {
    const name = slider.id.replace('slider-', '');
    slider.value = state.filters[name];

    const labelVal = document.getElementById(`val-${name}`);
    let val = state.filters[name];
    if (name === 'brightness' || name === 'contrast' || name === 'saturation' || name === 'vibrance') {
      labelVal.textContent = `${val}%`;
    } else if (name === 'blur') {
      labelVal.textContent = `${val}px`;
    } else {
      labelVal.textContent = val > 0 ? `+${val}` : val;
    }
  });
}

function resetAllSliders() {
  state.filters = { ...defaultFilters };
  state.selectedStyle = "original";
  syncSlidersUI();
  updateLiveFilters();
}

function getCSSFilterString(style, filters) {
  let styleFilter = '';
  switch (style) {
    case 'bw':
      styleFilter = 'grayscale(100%) contrast(110%)';
      break;
    case 'vintage':
      styleFilter = 'sepia(60%) contrast(85%) brightness(95%) saturate(90%)';
      break;
    case 'warm':
      styleFilter = 'sepia(25%) saturate(135%) brightness(100%) contrast(102%)';
      break;
    case 'cool':
      styleFilter = 'saturate(85%) contrast(98%) brightness(102%)';
      break;
    case 'sepia':
      styleFilter = 'sepia(100%) contrast(90%) brightness(95%)';
      break;
    case 'cinematic':
      styleFilter = 'contrast(120%) saturate(75%) brightness(88%)';
      break;
    case 'softglow':
      styleFilter = 'brightness(108%) contrast(90%) saturate(92%)';
      break;
    case 'hdr':
      styleFilter = 'contrast(130%) saturate(135%) brightness(104%)';
      break;
    case 'highcontrast':
      styleFilter = 'contrast(165%) brightness(90%) grayscale(10%)';
      break;
    default:
      styleFilter = '';
      break;
  }

  const exposureFactor = 1 + (filters.exposure / 100);
  const brightnessVal = (filters.brightness / 100) * exposureFactor * 100;
  const saturationVal = filters.saturation * (filters.vibrance / 100);

  const manualFilter = `
      brightness(${brightnessVal}%)
      contrast(${filters.contrast}%)
      saturate(${saturationVal}%)
      blur(${filters.blur}px)
    `;

  return `${styleFilter} ${manualFilter}`.trim();
}

function updateLiveFilters() {
  if (!state.isCameraReady) return;

  const filterString = getCSSFilterString(state.selectedStyle, state.filters);

  // Apply visual styling to the ACTIVE video row panels (both local and remote)
  const activeStep = state.currentCaptureStep;
  if (activeStep >= 0 && activeStep < 3) {
    const videoLocal = liveLocalVideos[activeStep];
    const videoRemote = liveRemoteVideos[activeStep];
    if (videoLocal) videoLocal.style.filter = filterString;
    if (videoRemote) videoRemote.style.filter = filterString;
  }

  // Temperature Overlay
  const tempOverlay = document.getElementById('temp-overlay') || createOverlay('temp-overlay', 2);
  if (state.filters.temperature !== 0) {
    const opacity = Math.abs(state.filters.temperature) / 100 * 0.15;
    const color = state.filters.temperature > 0 ? `249, 115, 22` : `59, 130, 246`;
    tempOverlay.style.backgroundColor = `rgba(${color}, ${opacity})`;
  } else {
    tempOverlay.style.backgroundColor = 'transparent';
  }

  // Tint Overlay
  const tintOverlay = document.getElementById('tint-overlay') || createOverlay('tint-overlay', 2);
  if (state.filters.tint !== 0) {
    const opacity = Math.abs(state.filters.tint) / 100 * 0.12;
    const color = state.filters.tint > 0 ? `34, 197, 94` : `236, 72, 153`;
    tintOverlay.style.backgroundColor = `rgba(${color}, ${opacity})`;
  } else {
    tintOverlay.style.backgroundColor = 'transparent';
  }

  // Vignette CSS Overlay
  if (state.filters.vignette > 0) {
    const opacity = state.filters.vignette / 100;
    vignetteOverlay.style.background = `radial-gradient(circle, transparent 40%, rgba(0,0,0,${opacity}) 100%)`;
    vignetteOverlay.style.opacity = 1;
  } else {
    vignetteOverlay.style.opacity = 0;
  }

  // Grain CSS Overlay
  if (state.filters.grain > 0) {
    grainOverlay.style.opacity = (state.filters.grain / 100) * 0.15;
  } else {
    grainOverlay.style.opacity = 0;
  }

  // Preset Overlays
  if (state.selectedStyle === 'cool') {
    tempOverlay.style.backgroundColor = `rgba(59, 130, 246, 0.08)`;
  }

  if (state.selectedStyle === 'softglow') {
    const glowOverlay = document.getElementById('glow-overlay') || createOverlay('glow-overlay', 1);
    glowOverlay.style.backdropFilter = 'blur(1.5px) brightness(1.02)';
    glowOverlay.style.opacity = 0.45;
  } else {
    const glowOverlay = document.getElementById('glow-overlay');
    if (glowOverlay) glowOverlay.style.opacity = 0;
  }
}

function createOverlay(id, zIndex) {
  const overlay = document.createElement('div');
  overlay.id = id;
  overlay.style.position = 'absolute';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = zIndex;
  document.getElementById('video-container').appendChild(overlay);
  return overlay;
}

/* ==========================================================================
  8. CANVAS COLLAGE RENDER PIPELINE
  ========================================================================== */
function drawCoverImage(ctx, img, x, y, w, h) {
  const imgW = img.width;
  const imgH = img.height;
  const imgRatio = imgW / imgH;
  const targetRatio = w / h;

  let sx, sy, sw, sh;

  if (imgRatio > targetRatio) {
    // Image is wider than target aspect ratio
    sh = imgH;
    sw = imgH * targetRatio;
    sx = (imgW - sw) / 2;
    sy = 0;
  } else {
    // Image is taller than target aspect ratio
    sw = imgW;
    sh = imgW / targetRatio;
    sx = 0;
    sy = (imgH - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function renderPhotoSlot(rawCanvas, photoStyle, stepIndex) {
  const slotW = 600;
  const slotH = 400;

  const off = document.createElement('canvas');
  off.width = slotW;
  off.height = slotH;
  const ctx = off.getContext('2d');

  // 1. Draw raw canvas with CSS filters applied via ctx.filter
  const cssFilters = getCSSFilterString(photoStyle.selectedStyle, photoStyle.filters);
  ctx.filter = cssFilters;
  drawCoverImage(ctx, rawCanvas, 0, 0, slotW, slotH);
  ctx.filter = 'none';

  // 2. Soft Glow filter blend
  if (photoStyle.selectedStyle === 'softglow') {
    ctx.globalAlpha = 0.35;
    ctx.filter = 'blur(10px) brightness(1.05)';
    drawCoverImage(ctx, rawCanvas, 0, 0, slotW, slotH);
    ctx.filter = 'none';
    ctx.globalAlpha = 1.0;
  }

  // 3. Temperature shift overlay
  if (photoStyle.filters.temperature !== 0 || photoStyle.selectedStyle === 'cool') {
    ctx.globalCompositeOperation = 'source-over';
    let tempVal = photoStyle.filters.temperature;
    if (photoStyle.selectedStyle === 'cool') tempVal -= 30;

    const opacity = Math.min(0.25, Math.abs(tempVal) / 100 * 0.15);
    ctx.fillStyle = tempVal > 0 ? `rgba(249, 115, 22, ${opacity})` : `rgba(59, 130, 246, ${opacity})`;
    ctx.fillRect(0, 0, slotW, slotH);
  }

  // 4. Tint shift overlay
  if (photoStyle.filters.tint !== 0) {
    ctx.globalCompositeOperation = 'source-over';
    const opacity = Math.abs(photoStyle.filters.tint) / 100 * 0.12;
    ctx.fillStyle = photoStyle.filters.tint > 0 ? `rgba(34, 197, 94, ${opacity})` : `rgba(236, 72, 153, ${opacity})`;
    ctx.fillRect(0, 0, slotW, slotH);
  }

  // 5. Fade shift overlay
  if (photoStyle.filters.fade > 0) {
    ctx.globalCompositeOperation = 'source-over';
    const opacity = photoStyle.filters.fade / 100 * 0.3;
    ctx.fillStyle = `rgba(128, 128, 128, ${opacity})`;
    ctx.fillRect(0, 0, slotW, slotH);
  }

  // 6. Vignette overlay
  if (photoStyle.filters.vignette > 0) {
    ctx.globalCompositeOperation = 'source-over';
    const opacity = photoStyle.filters.vignette / 100;
    const radialGrad = ctx.createRadialGradient(
      slotW / 2, slotH / 2, Math.min(slotW, slotH) * 0.35,
      slotW / 2, slotH / 2, Math.max(slotW, slotH) * 0.72
    );
    radialGrad.addColorStop(0, 'rgba(0,0,0,0)');
    radialGrad.addColorStop(1, `rgba(0,0,0,${opacity})`);
    ctx.fillStyle = radialGrad;
    ctx.fillRect(0, 0, slotW, slotH);
  }

  // 7. Sharpness filter
  if (photoStyle.filters.sharpness > 0) {
    applySharpnessFilter(ctx, slotW, slotH, photoStyle.filters.sharpness);
  }

  // 8. Grain noise filter
  if (photoStyle.filters.grain > 0) {
    applyGrainFilter(ctx, slotW, slotH, photoStyle.filters.grain);
  }

  // 9. Draw Nickname Badges directly onto this photo slot
  drawNameBadgesToSlot(ctx, slotW, slotH);

  return off;
}

function drawNameBadgesToSlot(ctx, w, h) {
  ctx.save();
  ctx.font = "bold 14px 'Outfit', sans-serif";
  ctx.textBaseline = "middle";

  const paddingX = 12;
  const paddingY = 6;
  const bottomMargin = 12;
  const leftMargin = 12;
  const rectH = 24;

  if (state.remoteStream) {
    // 1. Draw Local User badge on left side
    const localText = state.localName;
    const localWidth = ctx.measureText(localText).width;

    ctx.fillStyle = "#3b82f6"; // Blue
    drawRoundedRect(ctx, leftMargin, h - bottomMargin - rectH, localWidth + paddingX * 2, rectH, 12);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.fillText(localText, leftMargin + paddingX, h - bottomMargin - rectH / 2 + 1);

    // 2. Draw Remote User badge on right side
    const remoteText = state.remoteName;
    const remoteWidth = ctx.measureText(remoteText).width;
    const remoteLeft = w / 2 + leftMargin;

    ctx.fillStyle = "#ec4899"; // Pink
    drawRoundedRect(ctx, remoteLeft, h - bottomMargin - rectH, remoteWidth + paddingX * 2, rectH, 12);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.fillText(remoteText, remoteLeft + paddingX, h - bottomMargin - rectH / 2 + 1);
  } else {
    // Single local user mode
    const localText = state.localName;
    const localWidth = ctx.measureText(localText).width;

    ctx.fillStyle = "#3b82f6";
    drawRoundedRect(ctx, leftMargin, h - bottomMargin - rectH, localWidth + paddingX * 2, rectH, 12);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.fillText(localText, leftMargin + paddingX, h - bottomMargin - rectH / 2 + 1);
  }
  ctx.restore();
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawSprocketShape(ctx, sx, sy, w, h) {
  ctx.save();
  ctx.beginPath();
  if (state.frameStyle === 'pink') {
    ctx.arc(sx + w / 2, sy + h / 2, w / 2 + 1, 0, 2 * Math.PI);
  } else {
    if (ctx.roundRect) {
      ctx.roundRect(sx, sy, w, h, 2);
    } else {
      ctx.rect(sx, sy, w, h);
    }
  }

  if (state.frameStyle === 'black') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  } else if (state.frameStyle === 'white') {
    ctx.fillStyle = '#e4e4e7';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
  } else if (state.frameStyle === 'pink') {
    ctx.fillStyle = '#fdf2f8';
    ctx.strokeStyle = 'rgba(219, 39, 119, 0.2)';
  } else if (state.frameStyle === 'kraft') {
    ctx.fillStyle = '#451a03';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
  }

  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawStripFrame(ctx, x, y, w, h) {
  ctx.save();

  // 1. Draw strip background
  if (state.frameStyle === 'black') {
    ctx.fillStyle = '#121212';
    ctx.fillRect(x, y, w, h);
  } else if (state.frameStyle === 'white') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#e4e4e7';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
  } else if (state.frameStyle === 'pink') {
    ctx.fillStyle = '#fbcfe8';
    ctx.fillRect(x, y, w, h);
  } else if (state.frameStyle === 'kraft') {
    ctx.fillStyle = '#d7c49e';
    ctx.fillRect(x, y, w, h);

    // Draw subtle Kraft paper speckles
    ctx.fillStyle = 'rgba(0,0,0,0.03)';
    for (let i = 0; i < 300; i++) {
      const sx = x + Math.random() * w;
      const sy = y + Math.random() * h;
      const r = 0.5 + Math.random() * 1.5;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  // 2. Draw sprocket holes along left and right borders
  const sprocketCount = 15;
  const sprocketW = 8;
  const sprocketH = 14;
  const sprocketGap = h / sprocketCount;

  for (let i = 0; i < sprocketCount; i++) {
    const sy = y + i * sprocketGap + (sprocketGap - sprocketH) / 2;

    // Left sprocket
    const lx = x + 15;
    drawSprocketShape(ctx, lx, sy, sprocketW, sprocketH);

    // Right sprocket
    const rx = x + w - 15 - sprocketW;
    drawSprocketShape(ctx, rx, sy, sprocketW, sprocketH);
  }

  // 3. Draw markings and frame lines
  ctx.font = "bold 11px 'Courier New', monospace";

  if (state.frameStyle === 'black') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  } else if (state.frameStyle === 'white') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  } else if (state.frameStyle === 'pink') {
    ctx.fillStyle = '#be185d';
  } else if (state.frameStyle === 'kraft') {
    ctx.fillStyle = '#78350f';
  }

  // Markings on the left margin (next to each row)
  const slotH = 400;
  const topPadding = 60;
  const photoGap = 20;

  for (let i = 0; i < 3; i++) {
    const py = y + topPadding + i * (slotH + photoGap) + slotH / 2;

    // Row Index
    ctx.fillText(`${i + 1}`, x + 28, py);

    // Triangle arrow outline
    ctx.beginPath();
    ctx.moveTo(x + 28, py + 8);
    ctx.lineTo(x + 33, py + 13);
    ctx.lineTo(x + 28, py + 18);
    ctx.closePath();
    ctx.fill();

    // Right side numbers
    const numVal = 40 + i;
    ctx.fillText(`${numVal}`, x + w - 38, py);

    // neo photo label in the middle right
    if (i === 1) {
      ctx.save();
      ctx.translate(x + w - 28, py + 30);
      ctx.rotate(Math.PI / 2);
      ctx.font = "italic bold 10px 'Courier New', monospace";
      ctx.fillText("neo photo", 0, 0);
      ctx.restore();
    }
  }

  // 4. Draw logo/text stamps at the bottom margin of the strip
  ctx.textBaseline = "middle";
  if (state.frameStyle === 'black') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = "500 16px 'Outfit', sans-serif";
    ctx.fillText("Ashly Booth", x + w / 2 - ctx.measureText("Ashly Booth").width / 2, y + h - 45);
  } else if (state.frameStyle === 'white') {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.font = "italic 500 18px 'Georgia', serif";
    ctx.fillText("neo photo", x + w / 2 - ctx.measureText("neo photo").width / 2, y + h - 45);
  } else if (state.frameStyle === 'pink') {
    ctx.fillStyle = '#db2777';
    ctx.font = "500 16px 'Outfit', sans-serif";
    ctx.fillText("Ashly Booth ♥", x + w / 2 - ctx.measureText("Ashly Booth ♥").width / 2, y + h - 45);
  } else if (state.frameStyle === 'kraft') {
    ctx.fillStyle = '#451a03';
    ctx.font = "bold 15px 'Courier New', monospace";
    ctx.fillText("ASHLY HUB 2026", x + w / 2 - ctx.measureText("ASHLY HUB 2026").width / 2, y + h - 45);
  }

  ctx.restore();
}

function renderCapturedPhoto() {
  if (!state.capturedPhotos[0]) return;

  const slotW = 600;
  const slotH = 400;

  // Calculate strip dimensions
  const topPadding = 60;
  const bottomPadding = 80;
  const sidePadding = 45;
  const photoGap = 20;

  const stripW = slotW + sidePadding * 2;
  const stripH = topPadding + bottomPadding + 3 * slotH + 2 * photoGap;

  // Canvas size depending on layout
  let canvasW, canvasH;
  if (state.stripLayout === 'double') {
    canvasW = stripW * 2 + 20; // 20px gap between strips
    canvasH = stripH;
  } else {
    canvasW = stripW;
    canvasH = stripH;
  }

  saveCanvas.width = canvasW;
  saveCanvas.height = canvasH;
  const ctx = saveCanvas.getContext('2d');
  ctx.clearRect(0, 0, canvasW, canvasH);

  // Render strip backgrounds
  if (state.stripLayout === 'double') {
    drawStripFrame(ctx, 0, 0, stripW, stripH);
    drawStripFrame(ctx, stripW + 20, 0, stripW, stripH);
  } else {
    drawStripFrame(ctx, 0, 0, stripW, stripH);
  }

  // Render the 3 captured photos
  const renderedSlots = [
    renderPhotoSlot(state.capturedPhotos[0], state.photoStyles[0], 0),
    renderPhotoSlot(state.capturedPhotos[1], state.photoStyles[1], 1),
    renderPhotoSlot(state.capturedPhotos[2], state.photoStyles[2], 2)
  ];

  // Draw photos onto the canvas
  if (state.stripLayout === 'double') {
    // Left strip
    for (let i = 0; i < 3; i++) {
      const y = topPadding + i * (slotH + photoGap);
      ctx.drawImage(renderedSlots[i], sidePadding, y);
    }
    // Right strip
    for (let i = 0; i < 3; i++) {
      const y = topPadding + i * (slotH + photoGap);
      ctx.drawImage(renderedSlots[i], stripW + 20 + sidePadding, y);
    }
  } else {
    for (let i = 0; i < 3; i++) {
      const y = topPadding + i * (slotH + photoGap);
      ctx.drawImage(renderedSlots[i], sidePadding, y);
    }
  }
}

function applySharpnessFilter(ctx, width, height, value) {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const output = ctx.createImageData(width, height);
  const outData = output.data;

  const strength = value / 100 * 0.8;
  const center = 1 + 4 * strength;
  const edge = -strength;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;

      for (let c = 0; c < 3; c++) {
        const val =
          data[idx + c] * center +
          (data[idx - 4 + c] + data[idx + 4 + c] + data[idx - width * 4 + c] + data[idx + width * 4 + c]) * edge;
        outData[idx + c] = Math.min(255, Math.max(0, val));
      }
      outData[idx + 3] = data[idx + 3];
    }
  }
  ctx.putImageData(output, 0, 0);
}

function applyGrainFilter(ctx, width, height, value) {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const intensity = (value / 100) * 40;

  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * intensity;
    data[i] = Math.min(255, Math.max(0, data[i] + noise));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
  }
  ctx.putImageData(imgData, 0, 0);
}

// Preview Edit Index Selector
document.querySelectorAll('.edit-photo-selector .style-card').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.edit-photo-selector .style-card').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const index = btn.getAttribute('data-index');
    state.activeEditIndex = index === 'all' ? 'all' : parseInt(index);

    syncPreviewControlsUI();
    renderCapturedPhoto();
  });
});

// Sync styles/filters controls on the Preview panel
function syncPreviewControlsUI() {
  // Hide/show preview photo selector buttons dynamically
  for (let i = 0; i < 6; i++) {
    const btn = document.getElementById(`btn-edit-photo-${i}`);
    if (btn) {
      btn.style.display = i < state.totalSteps ? 'block' : 'none';
    }
  }

  const targetIndex = state.activeEditIndex === 'all' ? 0 : state.activeEditIndex;
  const targetStyle = state.photoStyles[targetIndex].selectedStyle;

  // Sync preset cards in preview-styles-grid
  document.querySelectorAll('#preview-styles-grid .style-card').forEach(card => {
    if (card.getAttribute('data-preview-style') === targetStyle) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });

  // Re-generate preview sliders with target values
  populatePreviewSliders();
}

// Preset card clicks in preview-styles-grid
document.querySelectorAll('#preview-styles-grid .style-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('#preview-styles-grid .style-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');

    const selectedPreset = card.getAttribute('data-preview-style');

    // Apply style to target
    if (state.activeEditIndex === 'all') {
      for (let i = 0; i < 6; i++) {
        state.photoStyles[i].selectedStyle = selectedPreset;
      }
    } else {
      state.photoStyles[state.activeEditIndex].selectedStyle = selectedPreset;
    }

    renderCapturedPhoto();
    syncFiltersToPeer();
  });
});

function populatePreviewSliders() {
  const container = document.getElementById('preview-sliders-container');
  if (!container) return;
  container.innerHTML = '';

  const targetIndex = state.activeEditIndex === 'all' ? 0 : state.activeEditIndex;
  const currentFilters = state.photoStyles[targetIndex].filters;

  const filterKeys = Object.keys(currentFilters);
  filterKeys.forEach(name => {
    const sliderGroup = document.createElement('div');
    sliderGroup.className = 'slider-group';

    const min = name === 'exposure' || name === 'temperature' || name === 'tint' ? -100 : (name === 'shadow' || name === 'highlight' ? -50 : 0);
    const max = name === 'brightness' || name === 'contrast' || name === 'saturation' || name === 'vibrance' ? 200 : (name === 'blur' ? 10 : 100);

    let minLimit = min;
    if (name === 'brightness' || name === 'contrast' || name === 'vibrance') minLimit = 50;

    let displayVal = currentFilters[name];
    if (name === 'brightness' || name === 'contrast' || name === 'saturation' || name === 'vibrance') {
      displayVal = `${displayVal}%`;
    } else if (name === 'blur') {
      displayVal = `${displayVal}px`;
    } else {
      displayVal = displayVal > 0 ? `+${displayVal}` : displayVal;
    }

    sliderGroup.innerHTML = `
        <div class="slider-info">
          <span class="slider-label" style="text-transform: capitalize">${name}</span>
          <span class="slider-value" id="preview-val-${name}">${displayVal}</span>
        </div>
        <input type="range" id="preview-slider-${name}" min="${minLimit}" max="${max}" value="${currentFilters[name]}" class="filter-slider">
      `;

    container.appendChild(sliderGroup);

    const previewSlider = sliderGroup.querySelector('input');
    previewSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);

      // Update target
      if (state.activeEditIndex === 'all') {
        for (let i = 0; i < 6; i++) {
          state.photoStyles[i].filters[name] = val;
        }
      } else {
        state.photoStyles[state.activeEditIndex].filters[name] = val;
      }

      const label = document.getElementById(`preview-val-${name}`);
      if (name === 'brightness' || name === 'contrast' || name === 'saturation' || name === 'vibrance') {
        label.textContent = `${val}%`;
      } else if (name === 'blur') {
        label.textContent = `${val}px`;
      } else {
        label.textContent = val > 0 ? `+${val}` : val;
      }

      // Redraw canvas
      renderCapturedPhoto();

      // Broadcast settings sync
      syncFiltersToPeer();
    });
  });
}

document.getElementById('btn-preview-reset-filters').addEventListener('click', () => {
  if (state.activeEditIndex === 'all') {
    for (let i = 0; i < 6; i++) {
      state.photoStyles[i].filters = { ...defaultFilters };
      state.photoStyles[i].selectedStyle = "original";
    }
  } else {
    state.photoStyles[state.activeEditIndex].filters = { ...defaultFilters };
    state.photoStyles[state.activeEditIndex].selectedStyle = "original";
  }

  syncPreviewControlsUI();
  renderCapturedPhoto();
  syncFiltersToPeer();
});

document.getElementById('btn-save').addEventListener('click', () => {
  if (!state.capturedPhotos[0]) return;

  renderCapturedPhoto();

  const dataUrl = saveCanvas.toDataURL('image/jpeg', 0.95);
  const link = document.createElement('a');
  link.download = `photobooth_strip_${Date.now()}.jpg`;
  link.href = dataUrl;
  link.click();
});

// Sync Retake Trigger
document.getElementById('btn-retake').addEventListener('click', () => {
  resetBoothCapture();
  showScreen('booth');

  if (state.peerConnection && state.peerConnection.open) {
    state.peerConnection.send({
      type: 'RESET_BOOTH'
    });
  }
});

/* ==========================================================================
  9. MEDIAPIPE GESTURE HAND DETECTION
  ========================================================================== */
function isOpenHand(landmarks) {
  const wrist = landmarks[0];
  const getDist = (pt1, pt2) => Math.hypot(pt1.x - pt2.x, pt1.y - pt2.y);

  const indexTipDist = getDist(landmarks[8], wrist);
  const middleTipDist = getDist(landmarks[12], wrist);
  const ringTipDist = getDist(landmarks[16], wrist);
  const pinkyTipDist = getDist(landmarks[20], wrist);

  const indexKnuckleDist = getDist(landmarks[5], wrist);
  const middleKnuckleDist = getDist(landmarks[9], wrist);
  const ringKnuckleDist = getDist(landmarks[13], wrist);
  const pinkyKnuckleDist = getDist(landmarks[17], wrist);

  const indexExtended = indexTipDist > indexKnuckleDist * 1.25;
  const middleExtended = middleTipDist > middleKnuckleDist * 1.25;
  const ringExtended = ringTipDist > ringKnuckleDist * 1.25;
  const pinkyExtended = pinkyTipDist > pinkyKnuckleDist * 1.25;

  return indexExtended && middleExtended && ringExtended && pinkyExtended;
}

let gestureLoopActive = false;

function startGestureProcessing() {
  if (gestureLoopActive) return;

  if (!state.handsDetector) {
    state.handsDetector = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    state.handsDetector.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.65,
      minTrackingConfidence: 0.65
    });

    state.handsDetector.onResults(onHandResults);
  }

  gestureLoopActive = true;
  runDetectionLoop();
}

let isProcessingFrame = false;
async function runDetectionLoop() {
  if (!state.gestureEnabled || !state.isCameraReady || !gestureLoopActive) {
    gestureLoopActive = false;
    return;
  }

  // Active webcam element
  const activeVideo = liveLocalVideos[state.currentCaptureStep] || liveLocalVideos[0];

  if (activeVideo && activeVideo.readyState === activeVideo.HAVE_ENOUGH_DATA && !isProcessingFrame) {
    isProcessingFrame = true;
    try {
      await state.handsDetector.send({ image: activeVideo });
    } catch (err) {
      console.warn("MediaPipe send error:", err);
    }
    isProcessingFrame = false;
  }

  setTimeout(() => {
    requestAnimationFrame(runDetectionLoop);
  }, 40);
}

function onHandResults(results) {
  if (!state.gestureEnabled || !state.isCameraReady) return;

  let handFound = false;
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    if (isOpenHand(results.multiHandLandmarks[0])) {
      handFound = true;
    }
  }

  if (handFound && !state.isCountingDown) {
    triggerShutterCountdown(true); // Broadcast timer triggers to peer
  }
}

function startGestureCountdown() {
  state.isCountingDown = true;
  state.countdownTime = 5;
  countdownNumber.textContent = state.countdownTime;

  countdownOverlay.style.display = 'flex';
  feedbackAlert.style.display = 'block';

  countdownCircle.style.strokeDashoffset = 0;

  const startTime = Date.now();
  const totalDuration = 5000;

  let animationFrameId;
  function updateCircleProgress() {
    if (!state.isCountingDown) {
      cancelAnimationFrame(animationFrameId);
      return;
    }

    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / totalDuration, 1);
    const strokeOffset = progress * 283;

    countdownCircle.style.strokeDashoffset = strokeOffset;

    if (progress < 1) {
      animationFrameId = requestAnimationFrame(updateCircleProgress);
    }
  }
  animationFrameId = requestAnimationFrame(updateCircleProgress);

  state.countdownInterval = setInterval(() => {
    state.countdownTime -= 1;
    if (state.countdownTime <= 0) {
      clearInterval(state.countdownInterval);
      state.isCountingDown = false;
      countdownOverlay.style.display = 'none';
      feedbackAlert.style.display = 'none';

      executeShutterCapture();
    } else {
      countdownNumber.textContent = state.countdownTime;
    }
  }, 1000);
}

function cancelGestureCountdown() {
  state.isCountingDown = false;
  if (state.countdownInterval) {
    clearInterval(state.countdownInterval);
    state.countdownInterval = null;
  }
  countdownOverlay.style.display = 'none';
  feedbackAlert.style.display = 'none';
}

document.getElementById('btn-toggle-gesture').addEventListener('click', () => {
  state.gestureEnabled = !state.gestureEnabled;

  if (state.gestureEnabled) {
    gestureStatus.classList.add('active');
    gestureStatus.querySelector('.status-text').textContent = "Palm Detection: On";
    document.getElementById('btn-toggle-gesture').classList.add('btn-primary');
    document.getElementById('btn-toggle-gesture').classList.remove('btn-secondary');

    startGestureProcessing();
  } else {
    gestureStatus.classList.remove('active');
    gestureStatus.querySelector('.status-text').textContent = "Palm Detection: Off";
    document.getElementById('btn-toggle-gesture').classList.remove('btn-primary');
    document.getElementById('btn-toggle-gesture').classList.add('btn-secondary');

    cancelGestureCountdown();
  }
});

