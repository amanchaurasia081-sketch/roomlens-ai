/**
 * RoomLens Futuristic Canvas HUD Renderer
 * Renders glowing Sci-Fi bounding boxes, tracking reticles, radar sweep animations,
 * and directional arrows over the camera stream.
 */

class HudRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.radarAngle = 0;
        this.pulsePhase = 0;
        this.scanlineY = 0;

        // Visual theme palette
        this.colors = {
            target: '#00ff9d',       // Electric neon green (Target Locked)
            targetGlow: 'rgba(0, 255, 157, 0.4)',
            search: '#00f3ff',       // Cyber cyan (Scanning/General)
            searchGlow: 'rgba(0, 243, 255, 0.3)',
            warning: '#f59e0b',      // Amber
            electronics: '#38bdf8',  // Sky blue
            furniture: '#c084fc',    // Lilac
            dining: '#fbbf24',       // Amber
            person: '#34d399',       // Emerald
            item: '#e2e8f0'          // Cool grey
        };
    }

    /**
     * Resizes canvas to match display coordinates
     */
    resize(width, height) {
        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
        }
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Main HUD rendering routine
     */
    render(detectionResult, isSearching = false) {
        const { width, height } = this.canvas;
        this.clear();

        this.pulsePhase += 0.05;
        this.scanlineY = (this.scanlineY + 3) % height;

        // Draw ambient sci-fi scanline
        this._drawScanline(width, height);

        if (!detectionResult) return;

        const { detections, targetMatch, searchTarget, srcWidth, srcHeight } = detectionResult;

        // Scale factor from video resolution to canvas display resolution
        const scaleX = width / srcWidth;
        const scaleY = height / srcHeight;

        if (isSearching && searchTarget) {
            // TARGET SEARCH MODE
            if (targetMatch) {
                // Target has been found!
                this._drawTargetLock(targetMatch, scaleX, scaleY, width, height);
                this._drawDirectionalGuidance(targetMatch, scaleX, scaleY, width, height);
            } else {
                // Target not found yet -> Draw active radar search UI
                this._drawRadarScanner(width, height, searchTarget);
            }
        } else {
            // IDENTIFY ALL MODE
            this._drawAllDetections(detections, scaleX, scaleY);
        }

        // Draw subtle HUD corner reticles on viewport
        this._drawViewportFrame(width, height);
    }

    /**
     * Draws futuristic corner brackets on the screen viewport
     */
    _drawViewportFrame(w, h) {
        const ctx = this.ctx;
        const len = 25;
        const pad = 12;

        ctx.save();
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.35)';
        ctx.lineWidth = 2;

        // Top-left
        ctx.beginPath();
        ctx.moveTo(pad, pad + len);
        ctx.lineTo(pad, pad);
        ctx.lineTo(pad + len, pad);
        ctx.stroke();

        // Top-right
        ctx.beginPath();
        ctx.moveTo(w - pad - len, pad);
        ctx.lineTo(w - pad, pad);
        ctx.lineTo(w - pad, pad + len);
        ctx.stroke();

        // Bottom-left
        ctx.beginPath();
        ctx.moveTo(pad, h - pad - len);
        ctx.lineTo(pad, h - pad);
        ctx.lineTo(pad + len, h - pad);
        ctx.stroke();

        // Bottom-right
        ctx.beginPath();
        ctx.moveTo(w - pad - len, h - pad);
        ctx.lineTo(w - pad, h - pad);
        ctx.lineTo(w - pad, h - pad - len);
        ctx.stroke();

        ctx.restore();
    }

    /**
     * Subtle horizontal laser scan line
     */
    _drawScanline(w, h) {
        const ctx = this.ctx;
        ctx.save();
        const grad = ctx.createLinearGradient(0, this.scanlineY - 20, 0, this.scanlineY + 20);
        grad.addColorStop(0, 'rgba(0, 243, 255, 0)');
        grad.addColorStop(0.5, 'rgba(0, 243, 255, 0.08)');
        grad.addColorStop(1, 'rgba(0, 243, 255, 0)');

        ctx.fillStyle = grad;
        ctx.fillRect(0, this.scanlineY - 20, w, 40);
        ctx.restore();
    }

    /**
     * Pulsing Radar Scanner when sweeping the room for target
     */
    _drawRadarScanner(w, h, targetName) {
        const ctx = this.ctx;
        const cx = w / 2;
        const cy = h / 2;
        const maxRadius = Math.min(w, h) * 0.28;

        this.radarAngle = (this.radarAngle + 0.04) % (Math.PI * 2);

        ctx.save();

        // Concentric rings
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 6]);

        [0.35, 0.7, 1.0].forEach(factor => {
            ctx.beginPath();
            ctx.arc(cx, cy, maxRadius * factor, 0, Math.PI * 2);
            ctx.stroke();
        });

        ctx.setLineDash([]);

        // Center crosshair
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.6)';
        ctx.beginPath();
        ctx.moveTo(cx - 15, cy);
        ctx.lineTo(cx + 15, cy);
        ctx.moveTo(cx, cy - 15);
        ctx.lineTo(cx, cy + 15);
        ctx.stroke();

        // Sweeping radar wedge
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, maxRadius, this.radarAngle - 0.5, this.radarAngle);
        ctx.closePath();
        const radarGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxRadius);
        radarGrad.addColorStop(0, 'rgba(0, 243, 255, 0.35)');
        radarGrad.addColorStop(1, 'rgba(0, 243, 255, 0.0)');
        ctx.fillStyle = radarGrad;
        ctx.fill();
        ctx.restore();

        // Pulsing search text
        const pulse = 0.7 + Math.sin(this.pulsePhase * 2) * 0.3;
        ctx.fillStyle = `rgba(0, 243, 255, ${pulse})`;
        ctx.font = '600 14px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.letterSpacing = '1.5px';
        ctx.fillText(`SWEEPING ROOM FOR: "${targetName.toUpperCase()}"`, cx, cy + maxRadius + 32);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '12px "Segoe UI", system-ui, sans-serif';
        ctx.fillText('Move camera smoothly across surfaces & tables', cx, cy + maxRadius + 52);

        ctx.restore();
    }

    /**
     * High-visibility glowing Lock-On box around the found target
     */
    _drawTargetLock(target, scaleX, scaleY, canvasW, canvasH) {
        const ctx = this.ctx;
        const [rawX, rawY, rawW, rawH] = target.bbox;
        const x = rawX * scaleX;
        const y = rawY * scaleY;
        const w = rawW * scaleX;
        const h = rawH * scaleY;
        const cx = x + w / 2;
        const cy = y + h / 2;

        const pulse = Math.sin(this.pulsePhase * 3) * 3;

        ctx.save();

        // Glowing outer box shadow
        ctx.shadowColor = this.colors.target;
        ctx.shadowBlur = 16;
        ctx.strokeStyle = this.colors.target;
        ctx.lineWidth = 3;

        // Draw futuristic cyber corners
        const cornerLen = Math.min(w, h) * 0.28;

        // Corners
        this._drawCorners(ctx, x - pulse, y - pulse, w + pulse * 2, h + pulse * 2, cornerLen);

        // Center crosshair inside target
        ctx.strokeStyle = 'rgba(0, 255, 157, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - 10, cy);
        ctx.lineTo(cx + 10, cy);
        ctx.moveTo(cx, cy - 10);
        ctx.lineTo(cx, cy + 10);
        ctx.stroke();

        // Rotating target reticle circles
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(this.radarAngle * 1.5);
        ctx.setLineDash([8, 12]);
        ctx.strokeStyle = 'rgba(0, 255, 157, 0.5)';
        ctx.beginPath();
        const reticleR = Math.max(w, h) * 0.55;
        ctx.arc(0, 0, reticleR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // TARGET ACQUIRED BADGE
        const badgeText = `🎯 TARGET LOCKED: ${target.class.toUpperCase()} (${target.confidencePercent}%)`;
        ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
        const textWidth = ctx.measureText(badgeText).width;

        const badgeX = Math.max(10, Math.min(x, canvasW - textWidth - 30));
        const badgeY = Math.max(30, y - 12);

        // Badge background
        ctx.shadowBlur = 10;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.strokeStyle = this.colors.target;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY - 22, textWidth + 24, 28, 6);
        ctx.fill();
        ctx.stroke();

        // Badge text
        ctx.fillStyle = this.colors.target;
        ctx.fillText(badgeText, badgeX + 12, badgeY - 4);

        // Sub-badge: Distance & Position
        const subText = `${target.positionDescription.toUpperCase()} • ${target.distanceEst.toUpperCase()}`;
        ctx.font = '11px "Segoe UI", system-ui, sans-serif';
        const subWidth = ctx.measureText(subText).width;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.beginPath();
        ctx.roundRect(badgeX, y + h + 6, subWidth + 18, 22, 4);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.fillText(subText, badgeX + 9, y + h + 21);

        ctx.restore();
    }

    /**
     * Directional arrows prompting user to center the object or walk closer
     */
    _drawDirectionalGuidance(target, scaleX, scaleY, canvasW, canvasH) {
        const ctx = this.ctx;
        const [rawX, rawY, rawW, rawH] = target.bbox;
        const cx = (rawX + rawW / 2) * scaleX;
        const cy = (rawY + rawH / 2) * scaleY;

        const screenCenterX = canvasW / 2;
        const screenCenterY = canvasH / 2;

        const diffX = cx - screenCenterX;
        const threshold = canvasW * 0.15; // 15% tolerance for "centered"

        ctx.save();

        if (diffX < -threshold) {
            // Target is to the left -> Arrow pointing left
            this._drawBannerArrow(ctx, 40, canvasH / 2, 'left', 'LOOK LEFT ◀');
        } else if (diffX > threshold) {
            // Target is to the right -> Arrow pointing right
            this._drawBannerArrow(ctx, canvasW - 40, canvasH / 2, 'right', '▶ LOOK RIGHT');
        } else {
            // Centered!
            ctx.fillStyle = 'rgba(0, 255, 157, 0.9)';
            ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('TARGET IN CENTER VIEW', screenCenterX, canvasH - 35);
        }

        ctx.restore();
    }

    _drawBannerArrow(ctx, x, y, direction, text) {
        const pulse = Math.sin(this.pulsePhase * 4) * 8;
        const drawX = direction === 'left' ? x - pulse : x + pulse;

        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.strokeStyle = this.colors.target;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = this.colors.target;
        ctx.shadowBlur = 12;

        ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
        const txtWidth = ctx.measureText(text).width;
        const boxW = txtWidth + 24;
        const boxH = 34;

        const boxX = direction === 'left' ? drawX : drawX - boxW;
        const boxY = y - boxH / 2;

        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = this.colors.target;
        ctx.textAlign = 'center';
        ctx.fillText(text, boxX + boxW / 2, y + 5);

        ctx.restore();
    }

    /**
     * Draws neon boxes and info tags for all detected objects in room
     */
    _drawAllDetections(detections, scaleX, scaleY) {
        if (!detections || detections.length === 0) return;

        detections.forEach(det => {
            const [rawX, rawY, rawW, rawH] = det.bbox;
            const x = rawX * scaleX;
            const y = rawY * scaleY;
            const w = rawW * scaleX;
            const h = rawH * scaleY;

            const color = this._getClassColor(det.class);

            this.ctx.save();
            this.ctx.strokeStyle = color;
            this.ctx.shadowColor = color;
            this.ctx.shadowBlur = 8;
            this.ctx.lineWidth = 2;

            // Sleek corner brackets instead of solid box
            const len = Math.min(18, w * 0.3, h * 0.3);
            this._drawCorners(this.ctx, x, y, w, h, len);

            // Thin bounding line
            this.ctx.lineWidth = 1;
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            this.ctx.strokeRect(x, y, w, h);

            // Labeled Pill Tag
            const label = `${det.class} ${det.confidencePercent}%`;
            this.ctx.font = '12px "Segoe UI", system-ui, sans-serif';
            const textWidth = this.ctx.measureText(label).width;

            this.ctx.fillStyle = 'rgba(10, 15, 25, 0.88)';
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.roundRect(x, y - 22, textWidth + 14, 20, 4);
            this.ctx.fill();
            this.ctx.stroke();

            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillText(label, x + 7, y - 7);

            this.ctx.restore();
        });
    }

    _drawCorners(ctx, x, y, w, h, len) {
        ctx.beginPath();
        // Top-left
        ctx.moveTo(x, y + len);
        ctx.lineTo(x, y);
        ctx.lineTo(x + len, y);

        // Top-right
        ctx.moveTo(x + w - len, y);
        ctx.lineTo(x + w, y);
        ctx.lineTo(x + w, y + len);

        // Bottom-left
        ctx.moveTo(x, y + h - len);
        ctx.lineTo(x, y + h);
        ctx.lineTo(x + len, y + h);

        // Bottom-right
        ctx.moveTo(x + w - len, y + h);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x + w, y + h - len);

        ctx.stroke();
    }

    _getClassColor(className) {
        const c = className.toLowerCase();
        if (['laptop', 'cell phone', 'tv', 'mouse', 'keyboard', 'remote', 'microwave'].includes(c)) {
            return this.colors.electronics;
        }
        if (['chair', 'couch', 'bed', 'dining table'].includes(c)) {
            return this.colors.furniture;
        }
        if (['cup', 'bottle', 'wine glass', 'bowl', 'banana', 'apple'].includes(c)) {
            return this.colors.dining;
        }
        if (['person', 'cat', 'dog'].includes(c)) {
            return this.colors.person;
        }
        return this.colors.search;
    }
}

// Export class
window.HudRenderer = HudRenderer;

