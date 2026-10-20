/**
 * RoomLens Main Application Controller
 * Handles UI events, mode switching, voice commands, inventory management,
 * and object history memory ("Last Seen").
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const video = document.getElementById('webcam-video');
    const canvas = document.getElementById('hud-canvas');
    const startCamBtn = document.getElementById('btn-start-camera');
    const switchCamBtn = document.getElementById('btn-switch-camera');
    const torchBtn = document.getElementById('btn-torch');
    const snapshotBtn = document.getElementById('btn-snapshot');
    const speakRoomBtn = document.getElementById('btn-speak-room');
    
    // Mode toggles
    const modeSearchBtn = document.getElementById('tab-search-mode');
    const modeIdentifyBtn = document.getElementById('tab-identify-mode');
    const modeUploadBtn = document.getElementById('tab-upload-mode');

    // Search controls
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('btn-clear-search');
    const voiceSearchBtn = document.getElementById('btn-voice-search');
    const tagChips = document.querySelectorAll('.quick-tag');

    // UI Status & Telemetry
    const statusPill = document.getElementById('status-pill');
    const fpsBadge = document.getElementById('telemetry-fps');
    const resolutionBadge = document.getElementById('telemetry-res');
    const objectsCountBadge = document.getElementById('objects-count-badge');
    const targetStatusBanner = document.getElementById('target-status-banner');
    const targetStatusText = document.getElementById('target-status-text');

    // Inventory & Memory
    const inventoryList = document.getElementById('inventory-list');
    const historyList = document.getElementById('history-list');
    const emptyInventoryMsg = document.getElementById('empty-inventory-msg');

    // Settings
    const confidenceSlider = document.getElementById('slider-confidence');
    const confidenceVal = document.getElementById('val-confidence');
    const modelSelect = document.getElementById('select-model');
    const soundToggle = document.getElementById('toggle-sound');
    const voiceToggle = document.getElementById('toggle-voice');

    // Upload & Demo Elements
    const fileUploadInput = document.getElementById('file-upload-input');
    const uploadArea = document.getElementById('upload-drop-zone');
    const sampleDemoBtns = document.querySelectorAll('.sample-demo-card');
    const testImage = document.getElementById('test-image');

    // Instances
    const hud = new HudRenderer(canvas);
    const detector = window.objectDetector;
    const audio = window.soundController;

    // State
    let currentMode = 'search'; // 'search' | 'identify' | 'upload'
    let isWebcamRunning = false;
    let recognition = null;
    let isVoiceListening = false;
    let lastSeenMemory = {}; // class -> { time, snapshotUrl, position, confidence }
    let lastSpokenTargetTime = 0;
    let radarPingInterval = null;

    // -------------------------------------------------------------------------
    // 1. Initial Setup & Model Loading
    // -------------------------------------------------------------------------
    async function init() {
        setupVoiceRecognition();
        setupEventListeners();
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Load TensorFlow COCO-SSD
        updateStatus('loading', 'Loading AI neural network...');
        const success = await detector.loadModel(modelSelect.value);
        if (success) {
            updateStatus('ready', 'AI Scanner Ready. Start Camera or Load Image');
        }
    }

    function resizeCanvas() {
        const rect = video.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            hud.resize(video.videoWidth || rect.width, video.videoHeight || rect.height);
        }
    }

    function updateStatus(type, msg) {
        statusPill.className = `status-pill status-${type}`;
        statusPill.querySelector('.status-text').textContent = msg;
    }

    // -------------------------------------------------------------------------
    // 2. Camera & Detection Flow
    // -------------------------------------------------------------------------
    startCamBtn.addEventListener('click', async () => {
        audio.playClick();
        if (isWebcamRunning) {
            stopCameraFeed();
        } else {
            await startCameraFeed();
        }
    });

    async function startCameraFeed() {
        updateStatus('loading', 'Accessing camera...');
        testImage.classList.add('hidden');
        video.classList.remove('hidden');

        const success = await detector.startCamera(video);
        if (success) {
            isWebcamRunning = true;
            startCamBtn.innerHTML = '<span class="icon">⏹️</span> Stop Camera';
            startCamBtn.classList.add('btn-active');
            resolutionBadge.textContent = `${video.videoWidth}x${video.videoHeight}`;
            resizeCanvas();
            updateStatus('active', 'Camera Active • Scanning');

            // Show switch camera button if multiple devices or on mobile
            if (detector.availableDevices.length > 1 || /Mobi|Android/i.test(navigator.userAgent)) {
                switchCamBtn.classList.remove('hidden');
            }
            if (detector.torchSupported) {
                torchBtn.classList.remove('hidden');
            }

            detector.startDetectionLoop();
            startRadarSoundLoop();
        }
    }

    function stopCameraFeed() {
        detector.stopDetectionLoop();
        detector.stopCamera();
        isWebcamRunning = false;
        startCamBtn.innerHTML = '<span class="icon">📹</span> Start Camera';
        startCamBtn.classList.remove('btn-active');
        torchBtn.classList.add('hidden');
        updateStatus('ready', 'Camera Stopped');
        fpsBadge.textContent = '0 FPS';
        hud.clear();
        stopRadarSoundLoop();
    }

    switchCamBtn.addEventListener('click', async () => {
        audio.playClick();
        await detector.switchFacingMode();
        resizeCanvas();
    });

    torchBtn.addEventListener('click', async () => {
        audio.playClick();
        const isOn = await detector.toggleTorch();
        torchBtn.classList.toggle('active', isOn);
    });

    // -------------------------------------------------------------------------
    // 3. Audio & Radar Loop
    // -------------------------------------------------------------------------
    function startRadarSoundLoop() {
        stopRadarSoundLoop();
        // Subtle sonar radar sound every 3 seconds when searching and target not yet found
        radarPingInterval = setInterval(() => {
            if (isWebcamRunning && currentMode === 'search' && detector.searchTarget && !detector.lastTargetMatch) {
                audio.playRadarSweep();
            }
        }, 3000);
    }

    function stopRadarSoundLoop() {
        if (radarPingInterval) {
            clearInterval(radarPingInterval);
            radarPingInterval = null;
        }
    }

    // -------------------------------------------------------------------------
    // 4. Detection Callback & HUD Render Loop
    // -------------------------------------------------------------------------
    detector.onDetections = (result) => {
        const { detections, targetMatch, searchTarget, fps } = result;

        detector.lastTargetMatch = targetMatch;
        fpsBadge.textContent = `${fps} FPS`;
        objectsCountBadge.textContent = `${detections.length} Detected`;

        // Render visual canvas HUD
        const isSearching = (currentMode === 'search');
        hud.render(result, isSearching);

        // Update real-time room inventory
        renderInventory(detections);

        // Handle Target Search feedback
        if (isSearching && searchTarget) {
            handleSearchFeedback(targetMatch, searchTarget);
        } else {
            targetStatusBanner.classList.add('hidden');
        }

        // Store "Last Seen" memory for detected objects
        recordLastSeenMemory(detections);
    };

    function handleSearchFeedback(targetMatch, searchTarget) {
        targetStatusBanner.classList.remove('hidden');

        if (targetMatch) {
            // Target acquired!
            targetStatusBanner.className = 'target-banner banner-locked';
            targetStatusText.innerHTML = `🎯 <strong>TARGET LOCKED:</strong> Found <em>${targetMatch.class}</em> (${targetMatch.confidencePercent}%) • ${targetMatch.positionDescription}`;

            // Play target-lock chime once upon sighting
            const now = Date.now();
            if (now - lastSpokenTargetTime > 4000) {
                audio.playTargetLocked();
                const directionText = targetMatch.horizontalPos === 'Center' 
                    ? `I found your ${targetMatch.class} straight ahead.`
                    : `I found your ${targetMatch.class} on the ${targetMatch.horizontalPos}.`;
                audio.speak(directionText);
                lastSpokenTargetTime = now;
            }
        } else {
            // Still searching
            targetStatusBanner.className = 'target-banner banner-searching';
            targetStatusText.innerHTML = `🔍 Sweeping room for <strong>"${searchTarget}"</strong>... Move camera around`;
        }
    }

    // -------------------------------------------------------------------------
    // 5. Room Inventory Rendering
    // -------------------------------------------------------------------------
    function renderInventory(detections) {
        if (!detections || detections.length === 0) {
            emptyInventoryMsg.classList.remove('hidden');
            inventoryList.querySelectorAll('.inventory-item').forEach(el => el.remove());
            return;
        }

        emptyInventoryMsg.classList.add('hidden');

        // Group detections by class
        const groups = {};
        detections.forEach(d => {
            if (!groups[d.class]) {
                groups[d.class] = { items: [], maxScore: 0 };
            }
            groups[d.class].items.push(d);
            if (d.score > groups[d.class].maxScore) {
                groups[d.class].maxScore = d.score;
            }
        });

        // Build HTML
        const existingItems = inventoryList.querySelectorAll('.inventory-item');
        existingItems.forEach(el => el.remove());

        Object.keys(groups).forEach(className => {
            const group = groups[className];
            const count = group.items.length;
            const primary = group.items[0];
            const conf = Math.round(group.maxScore * 100);

            const itemDiv = document.createElement('div');
            itemDiv.className = `inventory-item ${primary.isTarget ? 'is-target' : ''}`;
            itemDiv.innerHTML = `
                <div class="inv-left">
                    <span class="inv-icon">${getObjectIcon(className)}</span>
                    <div class="inv-details">
                        <span class="inv-name">${className}</span>
                        <span class="inv-meta">${primary.positionDescription} • ${primary.distanceEst}</span>
                    </div>
                </div>
                <div class="inv-right">
                    <span class="inv-count">${count > 1 ? count + 'x' : ''}</span>
                    <span class="inv-conf">${conf}%</span>
                    <button class="btn-lock-target" title="Lock and search for this item">🎯</button>
                </div>
            `;

            // Clicking "Lock" sets this item as active search target
            itemDiv.querySelector('.btn-lock-target').addEventListener('click', (e) => {
                e.stopPropagation();
                setSearchTarget(className);
                setMode('search');
                audio.playClick();
            });

            // Clicking row also targets
            itemDiv.addEventListener('click', () => {
                setSearchTarget(className);
                setMode('search');
                audio.playClick();
            });

            inventoryList.appendChild(itemDiv);
        });
    }

    function getObjectIcon(name) {
        const icons = {
            'cell phone': '📱', 'laptop': '💻', 'tv': '📺', 'mouse': '🖱️', 'keyboard': '⌨️',
            'cup': '☕', 'bottle': '🍾', 'wine glass': '🍷', 'bowl': '🥣', 'chair': '🪑',
            'couch': '🛋️', 'bed': '🛏️', 'dining table': '🍽️', 'book': '📖', 'clock': '⏰',
            'backpack': '🎒', 'handbag': '👜', 'umbrella': '☂️', 'scissors': '✂️',
            'person': '👤', 'cat': '🐱', 'dog': '🐶', 'potted plant': '🪴', 'remote': '🕹️'
        };
        return icons[name.toLowerCase()] || '📦';
    }

    // -------------------------------------------------------------------------
    // 6. "Last Seen" Memory System
    // -------------------------------------------------------------------------
    function recordLastSeenMemory(detections) {
        const now = Date.now();
        detections.forEach(d => {
            lastSeenMemory[d.class] = {
                className: d.class,
                timestamp: now,
                timeStr: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                position: d.positionDescription,
                distance: d.distanceEst,
                confidence: d.confidencePercent
            };
        });
        updateLastSeenUI();
    }

    function updateLastSeenUI() {
        const entries = Object.values(lastSeenMemory).sort((a, b) => b.timestamp - a.timestamp);
        if (entries.length === 0) return;

        historyList.innerHTML = '';
        entries.slice(0, 8).forEach(entry => {
            const timeAgoSec = Math.round((Date.now() - entry.timestamp) / 1000);
            let timeAgoStr = timeAgoSec < 60 ? `${timeAgoSec}s ago` : `${Math.round(timeAgoSec / 60)}m ago`;

            const card = document.createElement('div');
            card.className = 'history-card';
            card.innerHTML = `
                <div class="hist-icon">${getObjectIcon(entry.className)}</div>
                <div class="hist-info">
                    <div class="hist-header">
                        <strong>${entry.className}</strong>
                        <span class="hist-time">${timeAgoStr}</span>
                    </div>
                    <div class="hist-sub">At ${entry.timeStr} • ${entry.position} (${entry.distance})</div>
                </div>
                <button class="btn-find-last" title="Search for this item">Find</button>
            `;

            card.querySelector('.btn-find-last').addEventListener('click', () => {
                setSearchTarget(entry.className);
                setMode('search');
                audio.playClick();
            });

            historyList.appendChild(card);
        });
    }

    // -------------------------------------------------------------------------
    // 7. Search Bar & Tag Chips
    // -------------------------------------------------------------------------
    function setSearchTarget(query) {
        searchInput.value = query;
        detector.setSearchTarget(query);
        clearSearchBtn.classList.toggle('hidden', !query);
        highlightActiveTag(query);
    }

    searchInput.addEventListener('input', (e) => {
        setSearchTarget(e.target.value);
    });

    clearSearchBtn.addEventListener('click', () => {
        setSearchTarget('');
        audio.playClick();
    });

    tagChips.forEach(chip => {
        chip.addEventListener('click', () => {
            audio.playClick();
            const tagValue = chip.getAttribute('data-target');
            setSearchTarget(tagValue);
            setMode('search');
        });
    });

    function highlightActiveTag(target) {
        tagChips.forEach(chip => {
            const val = chip.getAttribute('data-target');
            chip.classList.toggle('active', val && target && val.toLowerCase() === target.toLowerCase());
        });
    }

    // -------------------------------------------------------------------------
    // 8. Voice Search (Speech Recognition)
    // -------------------------------------------------------------------------
    function setupVoiceRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            voiceSearchBtn.title = 'Voice search not supported in this browser';
            voiceSearchBtn.style.opacity = '0.5';
            return;
        }

        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            isVoiceListening = true;
            voiceSearchBtn.classList.add('listening');
            updateStatus('active', '🎙️ Listening... Say what you want to find!');
            audio.playClick();
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript.toLowerCase();
            console.log('Voice recognized:', transcript);

            // Clean up natural phrasing: "find my cup" -> "cup", "where is the phone" -> "phone"
            let cleaned = transcript
                .replace(/^(find|search for|look for|where is my|where is the|where are my|locate|spot)\s+/i, '')
                .replace(/[.?!]/g, '')
                .trim();

            setSearchTarget(cleaned);
            setMode('search');
            audio.speak(`Searching room for ${cleaned}`);
        };

        recognition.onerror = (event) => {
            console.warn('Voice error:', event.error);
            isVoiceListening = false;
            voiceSearchBtn.classList.remove('listening');
        };

        recognition.onend = () => {
            isVoiceListening = false;
            voiceSearchBtn.classList.remove('listening');
        };

        voiceSearchBtn.addEventListener('click', () => {
            if (isVoiceListening) {
                recognition.stop();
            } else {
                recognition.start();
            }
        });
    }

    // -------------------------------------------------------------------------
    // 9. Speak Room Inventory ("Describe What You See")
    // -------------------------------------------------------------------------
    speakRoomBtn.addEventListener('click', () => {
        audio.playClick();
        const items = inventoryList.querySelectorAll('.inventory-item');
        if (items.length === 0) {
            audio.speak('No objects currently identified in the room. Move the camera around to scan.');
            return;
        }

        const counts = {};
        items.forEach(item => {
            const name = item.querySelector('.inv-name').textContent;
            counts[name] = (counts[name] || 0) + 1;
        });

        const descriptions = Object.entries(counts).map(([name, count]) => {
            return count > 1 ? `${count} ${name}s` : `a ${name}`;
        });

        const fullSentence = `In your room, I can see ${descriptions.join(', ')}.`;
        audio.speak(fullSentence, true);
    });

    // -------------------------------------------------------------------------
    // 10. Mode Switching (Search vs Identify vs Upload)
    // -------------------------------------------------------------------------
    function setMode(mode) {
        currentMode = mode;
        modeSearchBtn.classList.toggle('active', mode === 'search');
        modeIdentifyBtn.classList.toggle('active', mode === 'identify');
        modeUploadBtn.classList.toggle('active', mode === 'upload');

        const searchSection = document.getElementById('search-control-group');
        const uploadSection = document.getElementById('upload-container');

        if (mode === 'search') {
            searchSection.classList.remove('hidden');
            uploadSection.classList.add('hidden');
            if (!searchInput.value) {
                setSearchTarget('cell phone'); // default helpful search target
            }
        } else if (mode === 'identify') {
            searchSection.classList.add('hidden');
            uploadSection.classList.add('hidden');
            detector.setSearchTarget(''); // empty = identify all
        } else if (mode === 'upload') {
            searchSection.classList.remove('hidden');
            uploadSection.classList.remove('hidden');
        }
    }

    modeSearchBtn.addEventListener('click', () => {
        setMode('search');
        audio.playClick();
    });

    modeIdentifyBtn.addEventListener('click', () => {
        setMode('identify');
        audio.playClick();
    });

    modeUploadBtn.addEventListener('click', () => {
        setMode('upload');
        audio.playClick();
    });

    // -------------------------------------------------------------------------
    // 11. Snapshot Capture with Download
    // -------------------------------------------------------------------------
    snapshotBtn.addEventListener('click', () => {
        audio.playShutterSound();

        // Create an offscreen canvas to merge video and HUD
        const offCanvas = document.createElement('canvas');
        const srcW = video.videoWidth || testImage.naturalWidth || 1280;
        const srcH = video.videoHeight || testImage.naturalHeight || 720;
        offCanvas.width = srcW;
        offCanvas.height = srcH;
        const offCtx = offCanvas.getContext('2d');

        // Draw image or video
        if (!testImage.classList.contains('hidden')) {
            offCtx.drawImage(testImage, 0, 0, srcW, srcH);
        } else {
            offCtx.drawImage(video, 0, 0, srcW, srcH);
        }

        // Draw HUD overlay onto snapshot
        offCtx.drawImage(canvas, 0, 0, srcW, srcH);

        // Download link
        const link = document.createElement('a');
        link.download = `room-scan-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
        link.href = offCanvas.toDataURL('image/png');
        link.click();
    });

    // -------------------------------------------------------------------------
    // 12. Image Upload & Demo Room Presets
    // -------------------------------------------------------------------------
    uploadArea.addEventListener('click', () => fileUploadInput.click());
    fileUploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            loadFileToDetect(file);
        }
    });

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            loadFileToDetect(e.dataTransfer.files[0]);
        }
    });

    function loadFileToDetect(file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            testImage.src = event.target.result;
            testImage.onload = async () => {
                stopCameraFeed();
                video.classList.add('hidden');
                testImage.classList.remove('hidden');
                resizeCanvas();
                updateStatus('active', `Loaded photo: ${file.name}`);
                await detector.detectFrame(testImage);
            };
        };
        reader.readAsDataURL(file);
    }

    sampleDemoBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            audio.playClick();
            const imgSrc = btn.getAttribute('data-src');
            testImage.src = imgSrc;
            testImage.onload = async () => {
                stopCameraFeed();
                video.classList.add('hidden');
                testImage.classList.remove('hidden');
                resizeCanvas();
                updateStatus('active', `Scanning Demo: ${btn.getAttribute('data-name')}`);
                await detector.detectFrame(testImage);
            };
        });
    });

    // -------------------------------------------------------------------------
    // 13. Settings Listeners
    // -------------------------------------------------------------------------
    function setupEventListeners() {
        confidenceSlider.addEventListener('input', (e) => {
            const val = e.target.value;
            confidenceVal.textContent = `${val}%`;
            detector.confidenceThreshold = val / 100;
        });

        modelSelect.addEventListener('change', async (e) => {
            updateStatus('loading', 'Switching AI model...');
            await detector.loadModel(e.target.value);
            updateStatus('ready', 'Model switched');
        });

        soundToggle.addEventListener('change', (e) => {
            audio.setSoundEnabled(e.target.checked);
        });

        voiceToggle.addEventListener('change', (e) => {
            audio.setVoiceEnabled(e.target.checked);
        });
    }

    // Launch!
    init();
});

