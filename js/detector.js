/**
 * RoomLens Object Detector Engine
 * Uses TensorFlow.js and COCO-SSD for client-side object detection.
 * Handles webcam stream, video constraints, and spatial position estimation.
 */

class ObjectDetector {
    constructor() {
        this.videoElement = null;
        this.model = null;
        this.isModelLoading = false;
        this.isRunning = false;
        this.stream = null;
        this.currentFacingMode = 'environment'; // prioritize back camera on mobile
        this.availableDevices = [];
        this.activeDeviceId = null;
        this.torchActive = false;
        this.torchSupported = false;

        this.confidenceThreshold = 0.50; // default 50%
        this.baseModel = 'lite_mobilenet_v2'; // fast and responsive

        // Performance metrics
        this.fps = 0;
        this.lastFrameTime = performance.now();
        this.frameCount = 0;
        this.fpsUpdateInterval = 500; // ms
        this.lastFpsUpdate = performance.now();

        // Target search config
        this.searchTarget = ''; // empty string = identify all mode
        this.lastTargetFoundTime = 0;

        // Callbacks
        this.onDetections = null;
        this.onModelStatus = null;
        this.onCameraReady = null;
        this.onError = null;

        // Label synonyms dictionary to allow natural searching
        this.synonyms = {
            'phone': 'cell phone',
            'mobile': 'cell phone',
            'smartphone': 'cell phone',
            'iphone': 'cell phone',
            'android': 'cell phone',
            'computer': 'laptop',
            'pc': 'laptop',
            'notebook': 'laptop',
            'screen': 'tv',
            'television': 'tv',
            'monitor': 'tv',
            'display': 'tv',
            'mug': 'cup',
            'glass': 'cup',
            'tumbler': 'cup',
            'water bottle': 'bottle',
            'flask': 'bottle',
            'sofa': 'couch',
            'settee': 'couch',
            'plant': 'potted plant',
            'flower': 'potted plant',
            'dining table': 'dining table',
            'desk': 'dining table',
            'table': 'dining table',
            'bag': 'backpack',
            'schoolbag': 'backpack',
            'rucksack': 'backpack',
            'purse': 'handbag',
            'wallet': 'handbag',
            'controller': 'remote',
            'tv remote': 'remote',
            'clicker': 'remote',
            'mouse': 'mouse',
            'keys': 'scissors', // COCO doesn't have keys, but scissors/cutlery are often proxy small metal items
            'spectacles': 'sports ball', // proxy placeholder
            'glasses': 'cup',
            'puppy': 'dog',
            'kitten': 'cat',
            'kitty': 'cat'
        };
    }

    /**
     * Initializes TensorFlow and loads the COCO-SSD model
     */
    async loadModel(baseModel = 'lite_mobilenet_v2') {
        this.baseModel = baseModel;
        this.isModelLoading = true;
        this._notifyModelStatus('loading', 'Loading TensorFlow.js neural network...');

        try {
            // Check if cocoSsd is loaded via CDN script
            if (typeof cocoSsd === 'undefined') {
                throw new Error('COCO-SSD script is not loaded. Check internet connection.');
            }

            this.model = await cocoSsd.load({ base: this.baseModel });
            this.isModelLoading = false;
            this._notifyModelStatus('ready', 'AI Model Ready (COCO-SSD)');
            return true;
        } catch (err) {
            this.isModelLoading = false;
            this._notifyModelStatus('error', 'Failed to load model: ' + err.message);
            if (this.onError) this.onError(err);
            return false;
        }
    }

    _notifyModelStatus(status, message) {
        if (this.onModelStatus) {
            this.onModelStatus({ status, message });
        }
    }

    /**
     * Query connected camera devices
     */
    async getCameraDevices() {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
                return [];
            }
            const devices = await navigator.mediaDevices.enumerateDevices();
            this.availableDevices = devices.filter(d => d.kind === 'videoinput');
            return this.availableDevices;
        } catch (e) {
            console.warn('Could not enumerate camera devices:', e);
            return [];
        }
    }

    /**
     * Starts the webcam stream with optimal resolution
     */
    async startCamera(videoElement, deviceId = null) {
        this.videoElement = videoElement;
        this.activeDeviceId = deviceId;

        // Stop existing stream if running
        this.stopCamera();

        const constraints = {
            audio: false,
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
            }
        };

        if (deviceId) {
            constraints.video.deviceId = { exact: deviceId };
        } else {
            constraints.video.facingMode = this.currentFacingMode;
        }

        try {
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.videoElement.srcObject = this.stream;
            
            // Wait for video metadata to load dimensions
            await new Promise((resolve) => {
                this.videoElement.onloadedmetadata = () => {
                    this.videoElement.play();
                    resolve();
                };
            });

            // Check if torch/flashlight is supported
            const videoTrack = this.stream.getVideoTracks()[0];
            const capabilities = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
            this.torchSupported = !!capabilities.torch;

            await this.getCameraDevices();

            if (this.onCameraReady) {
                this.onCameraReady({
                    width: this.videoElement.videoWidth,
                    height: this.videoElement.videoHeight,
                    torchSupported: this.torchSupported
                });
            }

            return true;
        } catch (err) {
            console.error('Camera access failed:', err);
            let msg = 'Could not access camera. Please allow camera permissions.';
            if (err.name === 'NotAllowedError') {
                msg = 'Camera permission denied. Please grant camera permission in your browser address bar.';
            } else if (err.name === 'NotFoundError') {
                msg = 'No camera found on this device. You can test using sample room photos below!';
            }
            if (this.onError) this.onError(new Error(msg));
            return false;
        }
    }

    /**
     * Toggle between front and back camera (especially useful on mobile/tablets)
     */
    async switchFacingMode() {
        this.currentFacingMode = this.currentFacingMode === 'environment' ? 'user' : 'environment';
        return await this.startCamera(this.videoElement);
    }

    /**
     * Toggle torch/flashlight if supported by hardware
     */
    async toggleTorch() {
        if (!this.stream || !this.torchSupported) return false;
        try {
            const track = this.stream.getVideoTracks()[0];
            this.torchActive = !this.torchActive;
            await track.applyConstraints({
                advanced: [{ torch: this.torchActive }]
            });
            return this.torchActive;
        } catch (e) {
            console.warn('Torch toggle failed:', e);
            return false;
        }
    }

    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (this.videoElement) {
            this.videoElement.srcObject = null;
        }
        this.isRunning = false;
    }

    /**
     * Sets the active search target item
     */
    setSearchTarget(targetText) {
        if (!targetText) {
            this.searchTarget = '';
            return;
        }

        const cleaned = targetText.trim().toLowerCase();
        // Resolve synonyms
        this.searchTarget = this.synonyms[cleaned] || cleaned;
    }

    /**
     * Main detection frame processing loop
     */
    startDetectionLoop() {
        if (this.isRunning) return;
        this.isRunning = true;
        this._detectionLoop();
    }

    stopDetectionLoop() {
        this.isRunning = false;
    }

    async _detectionLoop() {
        if (!this.isRunning) return;

        if (this.videoElement && this.videoElement.readyState >= 2 && this.model) {
            await this.detectFrame(this.videoElement);
        }

        // Request next frame
        if (this.isRunning) {
            requestAnimationFrame(() => this._detectionLoop());
        }
    }

    /**
     * Perform detection on a video frame or still image
     */
    async detectFrame(sourceElement) {
        if (!this.model) return null;

        const startTime = performance.now();

        try {
            // Predict objects using cocoSsd
            const rawPredictions = await this.model.detect(sourceElement);

            // Calculate FPS
            this.frameCount++;
            const now = performance.now();
            if (now - this.lastFpsUpdate >= this.fpsUpdateInterval) {
                this.fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdate));
                this.frameCount = 0;
                this.lastFpsUpdate = now;
            }

            // Dimensions of source
            const srcWidth = sourceElement.videoWidth || sourceElement.naturalWidth || sourceElement.width;
            const srcHeight = sourceElement.videoHeight || sourceElement.naturalHeight || sourceElement.height;

            // Process predictions with spatial metadata
            const processedDetections = rawPredictions
                .filter(p => p.score >= this.confidenceThreshold)
                .map(pred => this._enrichPrediction(pred, srcWidth, srcHeight));

            // Check if search target is currently found
            let targetMatch = null;
            if (this.searchTarget) {
                const targetLower = this.searchTarget.toLowerCase();
                // Find highest scoring match for the target
                const matches = processedDetections.filter(d => 
                    d.class.toLowerCase().includes(targetLower) || targetLower.includes(d.class.toLowerCase())
                );
                if (matches.length > 0) {
                    matches.sort((a, b) => b.score - a.score);
                    targetMatch = matches[0];
                    targetMatch.isTarget = true;
                }
            }

            const result = {
                detections: processedDetections,
                targetMatch: targetMatch,
                searchTarget: this.searchTarget,
                srcWidth,
                srcHeight,
                fps: this.fps,
                processingTimeMs: Math.round(performance.now() - startTime)
            };

            if (this.onDetections) {
                this.onDetections(result);
            }

            return result;
        } catch (err) {
            console.error('Detection frame error:', err);
            return null;
        }
    }

    /**
     * Enriches raw bounding box with directional quadrant and proximity metrics
     */
    _enrichPrediction(pred, frameW, frameH) {
        const [x, y, w, h] = pred.bbox;
        const centerX = x + w / 2;
        const centerY = y + h / 2;

        // Relative horizontal position (Left, Center, Right)
        const relX = centerX / frameW;
        let horizontalPos = 'Center';
        if (relX < 0.38) horizontalPos = 'Left';
        else if (relX > 0.62) horizontalPos = 'Right';

        // Relative vertical position (Top, Middle, Bottom)
        const relY = centerY / frameH;
        let verticalPos = 'Center';
        if (relY < 0.38) verticalPos = 'Upper';
        else if (relY > 0.62) verticalPos = 'Lower';

        // Screen area percentage (used to estimate distance)
        const areaRatio = (w * h) / (frameW * frameH);
        let distanceEst = 'Far';
        if (areaRatio > 0.18) distanceEst = 'Very Close';
        else if (areaRatio > 0.06) distanceEst = 'Near';
        else if (areaRatio > 0.02) distanceEst = 'Medium Distance';

        // Direction offset from center (-1.0 to +1.0)
        const offsetX = (centerX - frameW / 2) / (frameW / 2);
        const offsetY = (centerY - frameH / 2) / (frameH / 2);

        return {
            class: pred.class,
            score: pred.score,
            confidencePercent: Math.round(pred.score * 100),
            bbox: pred.bbox, // [x, y, width, height]
            center: { x: centerX, y: centerY },
            horizontalPos,
            verticalPos,
            positionDescription: `${verticalPos} ${horizontalPos}`.trim(),
            distanceEst,
            areaRatio,
            offset: { x: offsetX, y: offsetY },
            isTarget: false
        };
    }

    /**
     * List of all 80 classes supported by COCO-SSD
     */
    static getSupportedClasses() {
        return [
            "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat",
            "traffic light", "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat",
            "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe", "backpack",
            "umbrella", "handbag", "tie", "suitcase", "frisbee", "skis", "snowboard", "sports ball",
            "kite", "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket",
            "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple",
            "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake",
            "chair", "couch", "potted plant", "bed", "dining table", "toilet", "tv", "laptop",
            "mouse", "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink",
            "refrigerator", "book", "clock", "vase", "scissors", "teddy bear", "hair drier", "toothbrush"
        ];
    }
}

// Export singleton
window.objectDetector = new ObjectDetector();

