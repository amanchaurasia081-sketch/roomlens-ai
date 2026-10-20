/**
 * RoomLens Audio & Speech Synthesis Engine
 * Uses Web Audio API for custom synthesized SFX (zero external dependencies)
 * and Web Speech API for real-time directional voice guidance.
 */

class SoundController {
    constructor() {
        this.ctx = null;
        this.soundEnabled = true;
        this.voiceEnabled = true;
        this.lastSpokenText = '';
        this.lastSpokenTime = 0;
        this.speakCooldownMs = 3500; // prevent repeated voice spam
        this.synth = window.speechSynthesis || null;
        this.selectedVoice = null;

        // Init voices when loaded
        if (this.synth) {
            this.initVoices();
            if (speechSynthesis.onvoiceschanged !== undefined) {
                speechSynthesis.onvoiceschanged = () => this.initVoices();
            }
        }
    }

    _ensureAudioContext() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    initVoices() {
        if (!this.synth) return;
        const voices = this.synth.getVoices();
        // Prefer natural English voices
        this.selectedVoice = voices.find(v => 
            v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Aria'))
        ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
    }

    setSoundEnabled(enabled) {
        this.soundEnabled = enabled;
    }

    setVoiceEnabled(enabled) {
        this.voiceEnabled = enabled;
        if (!enabled && this.synth) {
            this.synth.cancel();
        }
    }

    /**
     * Synthesizes a futuristic Sci-Fi radar sweep / sonar ping
     */
    playRadarSweep() {
        if (!this.soundEnabled) return;
        this._ensureAudioContext();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.28);

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.3);
    }

    /**
     * Triumphant target-lock chime (C-Major chord arpeggio)
     */
    playTargetLocked() {
        if (!this.soundEnabled) return;
        this._ensureAudioContext();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const startTime = now + idx * 0.07;
            const duration = 0.25;

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, startTime);

            gain.gain.setValueAtTime(0.001, startTime);
            gain.gain.linearRampToValueAtTime(0.15, startTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(startTime);
            osc.stop(startTime + duration);
        });
    }

    /**
     * Proximity beep when tracking (pitch corresponds to proximity/centering)
     * @param {number} intensity - 0.0 to 1.0 (1.0 = closest/centered)
     */
    playProximityBeep(intensity = 0.5) {
        if (!this.soundEnabled) return;
        this._ensureAudioContext();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // Frequency ranges from 440Hz to 1200Hz based on intensity
        const freq = 440 + Math.min(Math.max(intensity, 0), 1) * 760;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.12);
    }

    /**
     * Shutter click sound for snapshots
     */
    playShutterSound() {
        if (!this.soundEnabled) return;
        this._ensureAudioContext();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        // White noise burst for click
        const bufferSize = this.ctx.sampleRate * 0.05;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1000, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        noise.start(now);
    }

    /**
     * Subtle UI click feedback
     */
    playClick() {
        if (!this.soundEnabled) return;
        this._ensureAudioContext();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(700, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);

        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.04);
    }

    /**
     * Speaks natural language direction using Web Speech API
     * @param {string} text - Direction or notification
     * @param {boolean} force - Skip cooldown if high priority
     */
    speak(text, force = false) {
        if (!this.voiceEnabled || !this.synth) return;

        const now = Date.now();
        if (!force && text === this.lastSpokenText && now - this.lastSpokenTime < this.speakCooldownMs) {
            return;
        }

        // Cancel previous utterances if urgent
        if (force) {
            this.synth.cancel();
        } else if (this.synth.speaking) {
            return; // don't talk over current speech
        }

        this.lastSpokenText = text;
        this.lastSpokenTime = now;

        const utterance = new SpeechSynthesisUtterance(text);
        if (this.selectedVoice) {
            utterance.voice = this.selectedVoice;
        }
        utterance.rate = 1.05;
        utterance.pitch = 1.0;
        utterance.volume = 0.9;

        this.synth.speak(utterance);
    }
}

// Export singleton
window.soundController = new SoundController();

