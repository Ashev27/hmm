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
  
  // Filter settings
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
  
  // Gesture capture (MediaPipe)
  gestureEnabled: false,
  handsDetector: null,
  isCountingDown: false,
  countdownTime: 5,
  countdownInterval: null,
  lastHandDetectedTime: 0,
  
  // Captured Photo Storage
  capturedCanvas: null, // Offscreen canvas holding raw combined image

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

const videoElement = document.getElementById('webcam');
const videoElementRemote = document.getElementById('webcam-remote');
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
const localNameBadge = document.getElementById('badge-local');
const remoteNameBadge = document.getElementById('badge-remote');

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
    populatePreviewSliders();
  }
}

// Check URL Hash on Load to see if joining a room
window.addEventListener('DOMContentLoaded', () => {
  const hash = window.location.hash.trim();
  if (hash.startsWith('#room-')) {
    const code = hash.replace('#room-', '');
    if (code) {
      // Prompt PIN first, then set state and join
      state.postPinAction = () => {
        state.isHost = false;
        state.roomCode = code;
        showScreen('booth');
      };
      showScreen('pin');
    }
  }
});

// Landing Actions
document.getElementById('btn-create-room').addEventListener('click', () => {
  state.postPinAction = () => {
    state.isHost = true;
    state.roomCode = Math.floor(10000 + Math.random() * 90000).toString(); // 5-digit code
    window.location.hash = `room-${state.roomCode}`;
    showScreen('booth');
  };
  showScreen('pin');
});

document.getElementById('btn-join-room').addEventListener('click', () => {
  const code = document.getElementById('input-room-code').value.trim();
  if (!code) {
    alert("Please enter a valid room code.");
    return;
  }
  state.postPinAction = () => {
    state.isHost = false;
    state.roomCode = code;
    window.location.hash = `room-${state.roomCode}`;
    showScreen('booth');
  };
  showScreen('pin');
});

/* ==========================================================================
   2. PIN LOCK SECURITY
   ========================================================================== */
const pinDots = document.querySelectorAll('.pin-dot');
const pinErrorMsg = document.getElementById('pin-error-msg');

function updatePinDisplay() {
  pinDots.forEach((dot, index) => {
    if (index < state.enteredPin.length) {
      dot.classList.add('filled');
    } else {
      dot.classList.remove('filled');
    }
  });
}

function verifyPin() {
  if (state.enteredPin === state.pinCode) {
    pinErrorMsg.style.visibility = 'hidden';
    state.enteredPin = "";
    updatePinDisplay();
    if (state.postPinAction) {
      state.postPinAction();
    } else {
      showScreen('booth');
    }
  } else {
    pinErrorMsg.style.visibility = 'visible';
    // Shake feedback animation
    const container = document.querySelector('.pin-container');
    container.style.animation = 'shake 0.3s ease';
    setTimeout(() => {
      container.style.animation = '';
      state.enteredPin = "";
      updatePinDisplay();
    }, 300);
  }
}

// Click numpad buttons
document.querySelectorAll('.numpad-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const val = btn.getAttribute('data-val');
    if (val && state.enteredPin.length < 6) {
      state.enteredPin += val;
      updatePinDisplay();
      if (state.enteredPin.length === 6) {
        setTimeout(verifyPin, 150);
      }
    }
  });
});

document.getElementById('numpad-clear').addEventListener('click', () => {
  state.enteredPin = "";
  updatePinDisplay();
  pinErrorMsg.style.visibility = 'hidden';
});

document.getElementById('numpad-backspace').addEventListener('click', () => {
  if (state.enteredPin.length > 0) {
    state.enteredPin = state.enteredPin.slice(0, -1);
    updatePinDisplay();
    pinErrorMsg.style.visibility = 'hidden';
  }
});

// Keyboard mapping for PIN
window.addEventListener('keydown', (e) => {
  if (!screens.pin.classList.contains('active')) return;
  
  if (e.key >= '0' && e.key <= '9') {
    if (state.enteredPin.length < 6) {
      state.enteredPin += e.key;
      updatePinDisplay();
      if (state.enteredPin.length === 6) {
        setTimeout(verifyPin, 150);
      }
    }
  } else if (e.key === 'Backspace') {
    if (state.enteredPin.length > 0) {
      state.enteredPin = state.enteredPin.slice(0, -1);
      updatePinDisplay();
      pinErrorMsg.style.visibility = 'hidden';
    }
  } else if (e.key === 'Escape' || e.key === 'Delete') {
    state.enteredPin = "";
    updatePinDisplay();
    pinErrorMsg.style.visibility = 'hidden';
  }
});

// Inject Shake keyframes dynamically
const pinAnim = document.createElement('style');
pinAnim.innerHTML = `
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-8px); }
  40%, 80% { transform: translateX(8px); }
}
`;
document.head.appendChild(pinAnim);

/* ==========================================================================
   3. WEBCAM MANAGEMENT
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
    videoElement.srcObject = stream;
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
    alert("Could not access your camera. Please verify permission settings.");
  }
}

function stopCamera() {
  if (state.currentStream) {
    state.currentStream.getTracks().forEach(track => track.stop());
    state.currentStream = null;
  }
  videoElement.srcObject = null;
  state.isCameraReady = false;
  cancelGestureCountdown();
  closeP2PConnection();
}

async function getCameras() {
  try {
    const allDevices = await navigator.mediaDevices.enumerateDevices();
    state.devices = allDevices.filter(d => d.kind === 'videoinput');
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
        videoElementRemote.srcObject = stream;
        waitingOverlay.style.display = 'none';
        roomStatusBadge.textContent = "Friend Connected";
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
        videoElementRemote.srcObject = stream;
        roomStatusBadge.textContent = "Connected to Friend";
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
  });

  state.peerConnection.on('data', (data) => {
    if (!data || !data.type) return;

    switch(data.type) {
      case 'NAME_CHANGE':
        state.remoteName = data.name || "Friend";
        remoteNameBadge.textContent = state.remoteName;
        break;
        
      case 'SYNC_FILTERS':
        state.selectedStyle = data.style;
        state.filters = data.filters;
        syncSlidersUI();
        updateLiveFilters();
        break;
        
      case 'START_COUNTDOWN':
        if (!state.isCountingDown) {
          triggerShutterCountdown(false); // Trigger local run without resending signal
        }
        break;
        
      case 'RESET_BOOTH':
        state.capturedCanvas = null;
        showScreen('booth');
        break;
    }
  });
  
  state.peerConnection.on('close', handlePeerDisconnect);
}

function handlePeerDisconnect() {
  state.remoteStream = null;
  videoElementRemote.srcObject = null;
  state.remoteName = "Friend";
  remoteNameBadge.textContent = state.remoteName;
  
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
  videoElementRemote.srcObject = null;
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
  localNameBadge.textContent = val;
  
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

  // Capture mirrored stream (local) and non-mirrored stream (remote)
  captureRawSplitCollage();

  // Transition UI
  setTimeout(() => {
    showScreen('preview');
  }, 150);
}

function captureRawSplitCollage() {
  const collage = document.createElement('canvas');
  
  const vWidth = videoElement.videoWidth || 640;
  const vHeight = videoElement.videoHeight || 480;

  if (state.remoteStream) {
    // Both cameras active: 50/50 vertical split collage
    collage.width = vWidth * 2;
    collage.height = vHeight;
    const ctx = collage.getContext('2d');
    
    // Draw Local camera on Left Half (mirrored to match local preview)
    ctx.save();
    ctx.translate(vWidth, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoElement, 0, 0, vWidth, vHeight);
    ctx.restore();
    
    // Draw Remote camera on Right Half (not mirrored, matching call layout)
    ctx.drawImage(videoElementRemote, vWidth, 0, vWidth, vHeight);
  } else {
    // Single Camera: Full single viewport collage
    collage.width = vWidth;
    collage.height = vHeight;
    const ctx = collage.getContext('2d');
    
    ctx.translate(vWidth, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoElement, 0, 0, vWidth, vHeight);
  }
  
  state.capturedCanvas = collage;
}

// Shutter Click Handler
document.getElementById('btn-capture').addEventListener('click', () => {
  cancelGestureCountdown();
  triggerShutterCountdown(true);
});

/* ==========================================================================
   7. STYLES & MANUAL FILTERING PIPELINE
   ========================================================================== */
document.querySelectorAll('.style-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.style-card').forEach(c => c.classList.remove('active'));
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
  switch(style) {
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
  
  // Apply visual styling to BOTH video panels (left and right split panels)
  videoElement.style.filter = filterString;
  videoElementRemote.style.filter = filterString;

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
function renderCapturedPhoto() {
  if (!state.capturedCanvas) return;

  const width = state.capturedCanvas.width;
  const height = state.capturedCanvas.height;

  saveCanvas.width = width;
  saveCanvas.height = height;

  const ctx = saveCanvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);

  // 1. Draw raw canvas with CSS filters applied via ctx.filter
  const cssFilters = getCSSFilterString(state.selectedStyle, state.filters);
  ctx.filter = cssFilters;
  ctx.drawImage(state.capturedCanvas, 0, 0);

  ctx.filter = 'none';

  // 2. Soft Glow filter blend
  if (state.selectedStyle === 'softglow') {
    ctx.globalAlpha = 0.35;
    ctx.filter = 'blur(12px) brightness(1.05)';
    ctx.drawImage(state.capturedCanvas, 0, 0);
    ctx.filter = 'none';
    ctx.globalAlpha = 1.0;
  }

  // 3. Temperature shift overlay
  if (state.filters.temperature !== 0 || state.selectedStyle === 'cool') {
    ctx.globalCompositeOperation = 'source-over';
    let tempVal = state.filters.temperature;
    if (state.selectedStyle === 'cool') tempVal -= 30;
    
    const opacity = Math.min(0.25, Math.abs(tempVal) / 100 * 0.15);
    ctx.fillStyle = tempVal > 0 ? `rgba(249, 115, 22, ${opacity})` : `rgba(59, 130, 246, ${opacity})`;
    ctx.fillRect(0, 0, width, height);
  }

  // 4. Tint shift overlay
  if (state.filters.tint !== 0) {
    ctx.globalCompositeOperation = 'source-over';
    const opacity = Math.abs(state.filters.tint) / 100 * 0.12;
    ctx.fillStyle = state.filters.tint > 0 ? `rgba(34, 197, 94, ${opacity})` : `rgba(236, 72, 153, ${opacity})`;
    ctx.fillRect(0, 0, width, height);
  }

  // 5. Fade shift overlay
  if (state.filters.fade > 0) {
    ctx.globalCompositeOperation = 'source-over';
    const opacity = state.filters.fade / 100 * 0.3;
    ctx.fillStyle = `rgba(128, 128, 128, ${opacity})`;
    ctx.fillRect(0, 0, width, height);
  }

  // 6. Vignette overlay
  if (state.filters.vignette > 0) {
    ctx.globalCompositeOperation = 'source-over';
    const opacity = state.filters.vignette / 100;
    const radialGrad = ctx.createRadialGradient(
      width / 2, height / 2, Math.min(width, height) * 0.35,
      width / 2, height / 2, Math.max(width, height) * 0.72
    );
    radialGrad.addColorStop(0, 'rgba(0,0,0,0)');
    radialGrad.addColorStop(1, `rgba(0,0,0,${opacity})`);
    ctx.fillStyle = radialGrad;
    ctx.fillRect(0, 0, width, height);
  }

  // 7. Sharpness filter
  if (state.filters.sharpness > 0) {
    applySharpnessFilter(ctx, width, height, state.filters.sharpness);
  }

  // 8. Grain noise filter
  if (state.filters.grain > 0) {
    applyGrainFilter(ctx, width, height, state.filters.grain);
  }
  
  // 9. Render Nickname Badges directly onto the downloaded split image (matches look of screenshots)
  renderNameBadgesToCanvas(ctx, width, height);
}

function renderNameBadgesToCanvas(ctx, w, h) {
  ctx.save();
  ctx.font = "bold 24px 'Outfit', sans-serif";
  ctx.textBaseline = "middle";
  
  const paddingX = 24;
  const paddingY = 12;
  const bottomMargin = 28;
  const leftMargin = 28;
  
  if (state.remoteStream) {
    // 1. Draw Local User badge on left side
    const localText = state.localName;
    const localWidth = ctx.measureText(localText).width;
    
    ctx.fillStyle = "#3b82f6"; // Blue
    drawRoundedRect(ctx, leftMargin, h - bottomMargin - 40, localWidth + paddingX * 2, 40, 20);
    ctx.fill();
    
    ctx.fillStyle = "#ffffff";
    ctx.fillText(localText, leftMargin + paddingX, h - bottomMargin - 20);
    
    // 2. Draw Remote User badge on right side
    const remoteText = state.remoteName;
    const remoteWidth = ctx.measureText(remoteText).width;
    const remoteLeft = w / 2 + leftMargin;
    
    ctx.fillStyle = "#ec4899"; // Pink
    drawRoundedRect(ctx, remoteLeft, h - bottomMargin - 40, remoteWidth + paddingX * 2, 40, 20);
    ctx.fill();
    
    ctx.fillStyle = "#ffffff";
    ctx.fillText(remoteText, remoteLeft + paddingX, h - bottomMargin - 20);
  } else {
    // Single local user mode
    const localText = state.localName;
    const localWidth = ctx.measureText(localText).width;
    
    ctx.fillStyle = "#3b82f6";
    drawRoundedRect(ctx, leftMargin, h - bottomMargin - 40, localWidth + paddingX * 2, 40, 20);
    ctx.fill();
    
    ctx.fillStyle = "#ffffff";
    ctx.fillText(localText, leftMargin + paddingX, h - bottomMargin - 20);
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
    data[i+1] = Math.min(255, Math.max(0, data[i+1] + noise));
    data[i+2] = Math.min(255, Math.max(0, data[i+2] + noise));
  }
  ctx.putImageData(imgData, 0, 0);
}

function populatePreviewSliders() {
  const container = document.getElementById('preview-sliders-container');
  container.innerHTML = '';

  const filterKeys = Object.keys(state.filters);
  filterKeys.forEach(name => {
    const sliderGroup = document.createElement('div');
    sliderGroup.className = 'slider-group';

    const min = name === 'exposure' || name === 'temperature' || name === 'tint' ? -100 : (name === 'shadow' || name === 'highlight' ? -50 : 0);
    const max = name === 'brightness' || name === 'contrast' || name === 'saturation' || name === 'vibrance' ? 200 : (name === 'blur' ? 10 : 100);
    
    let minLimit = min;
    if (name === 'brightness' || name === 'contrast' || name === 'vibrance') minLimit = 50;

    let displayVal = state.filters[name];
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
      <input type="range" id="preview-slider-${name}" min="${minLimit}" max="${max}" value="${state.filters[name]}" class="filter-slider">
    `;

    container.appendChild(sliderGroup);

    const previewSlider = sliderGroup.querySelector('input');
    previewSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      state.filters[name] = val;
      
      const label = document.getElementById(`preview-val-${name}`);
      if (name === 'brightness' || name === 'contrast' || name === 'saturation' || name === 'vibrance') {
        label.textContent = `${val}%`;
      } else if (name === 'blur') {
        label.textContent = `${val}px`;
      } else {
        label.textContent = val > 0 ? `+${val}` : val;
      }

      // Sync with camera sliders
      const mainCamSlider = document.getElementById(`slider-${name}`);
      if (mainCamSlider) {
        mainCamSlider.value = val;
        const mainCamValLabel = document.getElementById(`val-${name}`);
        if (mainCamValLabel) mainCamValLabel.textContent = label.textContent;
      }

      // Redraw canvas
      renderCapturedPhoto();
      
      // Broadcast settings sync
      syncFiltersToPeer();
    });
  });
}

document.getElementById('btn-preview-reset-filters').addEventListener('click', () => {
  resetAllSliders();
  populatePreviewSliders();
  renderCapturedPhoto();
  syncFiltersToPeer();
});

document.getElementById('btn-save').addEventListener('click', () => {
  if (!state.capturedCanvas) return;
  
  renderCapturedPhoto();
  
  const dataUrl = saveCanvas.toDataURL('image/jpeg', 0.95);
  const link = document.createElement('a');
  link.download = `photobooth_${Date.now()}.jpg`;
  link.href = dataUrl;
  link.click();
});

// Sync Retake Trigger
document.getElementById('btn-retake').addEventListener('click', () => {
  state.capturedCanvas = null;
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

  if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA && !isProcessingFrame) {
    isProcessingFrame = true;
    try {
      await state.handsDetector.send({ image: videoElement });
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
