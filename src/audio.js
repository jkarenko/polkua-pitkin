let audioCtx = null;
let hasInteracted = false;

function initAudio() {
    if (!audioCtx && hasInteracted) {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.error("Web Audio API is not supported in this browser", e);
        }
    }
}

function playHonk(durations = [0.3], pauses = [0]) {
    if (!audioCtx) return;

    let currentTime = audioCtx.currentTime;

    // Ensure durations and pauses arrays are the same length
    const length = Math.max(durations.length, pauses.length);
    durations = durations.concat(Array(length - durations.length).fill(0.3));
    pauses = pauses.concat(Array(length - pauses.length).fill(0));

    // Play each honk in sequence
    for (let i = 0; i < length; i++) {
        const startTime = currentTime;

        // First horn tone
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);

        // Second horn tone (slightly higher pitch)
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);

        // Set frequencies (using a minor third interval for a classic horn sound)
        const baseFreq = 400;
        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(baseFreq, startTime);
        osc2.frequency.setValueAtTime(baseFreq * 1.189207115, startTime); // Minor third up

        // Set gains (slightly lower for the second tone)
        gain1.gain.setValueAtTime(0.08, startTime);
        gain2.gain.setValueAtTime(0.06, startTime);

        // Create a slight attack and release
        gain1.gain.linearRampToValueAtTime(0.08, startTime + 0.05);
        gain2.gain.linearRampToValueAtTime(0.06, startTime + 0.05);
        gain1.gain.exponentialRampToValueAtTime(0.0001, startTime + durations[i]);
        gain2.gain.exponentialRampToValueAtTime(0.0001, startTime + durations[i]);

        // Start and stop both oscillators
        osc1.start(startTime);
        osc2.start(startTime);
        osc1.stop(startTime + durations[i]);
        osc2.stop(startTime + durations[i]);

        // Add pause before next honk
        currentTime += durations[i] + pauses[i];
    }
}

function playSound(type, pitchFactor = 0) {
    initAudio();
    if (!audioCtx) return;

    // Resume context if suspended
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);

    switch (type) {
        case 'alarm':
            return playAlarm(oscillator, gainNode);
        case 'chime':
            return playChime(oscillator, gainNode, pitchFactor);
        case 'success':
            return playSuccess();
        case 'engine':
            return createEngineSound();
        case 'screech':
            return playScreech(oscillator, gainNode);
        case 'honk':
            return playHonk([0.3]);
    }
}

function playAlarm(oscillator, gainNode) {
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(180, audioCtx.currentTime);
    oscillator.frequency.linearRampToValueAtTime(120, audioCtx.currentTime + 0.3);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.4);
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.4);
}

function playChime(oscillator, gainNode, pitchFactor) {
    const baseFrequency = 300;
    oscillator.type = 'sine';
    const frequency = baseFrequency * Math.pow(2, pitchFactor * 1.5);
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.15);
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.15);
}

function playSuccess() {
    const baseFreq = 523.25; // C5
    const freqs = [baseFreq, baseFreq * 1.25, baseFreq * 1.5]; // C, E, G
    let startTime = audioCtx.currentTime;
    freqs.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gn = audioCtx.createGain();
        osc.connect(gn);
        gn.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime + i * 0.15);
        gn.gain.setValueAtTime(0.1, startTime + i * 0.15);
        gn.gain.exponentialRampToValueAtTime(0.0001, startTime + i * 0.15 + 0.2);
        osc.start(startTime + i * 0.15);
        osc.stop(startTime + i * 0.15 + 0.2);
    });
}

function createEngineSound() {
    const baseFreq = 100;
    const startTime = audioCtx.currentTime;

    // Main engine sound
    const mainOsc = audioCtx.createOscillator();
    const mainGain = audioCtx.createGain();
    mainOsc.connect(mainGain);
    mainGain.connect(audioCtx.destination);
    mainOsc.type = 'sawtooth';
    mainOsc.frequency.setValueAtTime(baseFreq, startTime);
    mainGain.gain.setValueAtTime(0.05, startTime);

    // Add some variation
    const varOsc = audioCtx.createOscillator();
    const varGain = audioCtx.createGain();
    varOsc.connect(varGain);
    varGain.connect(audioCtx.destination);
    varOsc.type = 'sine';
    varOsc.frequency.setValueAtTime(baseFreq * 1.5, startTime);
    varGain.gain.setValueAtTime(0.02, startTime);

    mainOsc.start(startTime);
    varOsc.start(startTime);

    return {
        mainOsc,
        varOsc,
        mainGain,
        varGain,
        baseFreq,
        updateSpeed: (speed, maxSpeed) => {
            const speedFactor = speed / maxSpeed;
            const minFreq = baseFreq * 0.5;
            const maxFreq = baseFreq * 1.5;

            const targetFreq = minFreq + (maxFreq - minFreq) * speedFactor;
            const currentFreq = mainOsc.frequency.value;

            if (targetFreq < currentFreq) {
                const newFreq = Math.max(targetFreq, currentFreq * 0.98);
                mainOsc.frequency.setValueAtTime(newFreq, audioCtx.currentTime);
                varOsc.frequency.setValueAtTime(newFreq * 1.5, audioCtx.currentTime);
            } else {
                mainOsc.frequency.setValueAtTime(targetFreq, audioCtx.currentTime);
                varOsc.frequency.setValueAtTime(targetFreq * 1.5, audioCtx.currentTime);
            }

            const volumeFactor = 0.05 + (speedFactor * 0.05);
            const fadeOutFactor = Math.max(0, (speedFactor - 0.3) / 0.7);
            const finalVolumeFactor = volumeFactor * fadeOutFactor;
            mainGain.gain.setValueAtTime(finalVolumeFactor, audioCtx.currentTime);
            varGain.gain.setValueAtTime(finalVolumeFactor * 0.4, audioCtx.currentTime);
        }
    };
}

function playScreech(oscillator, gainNode) {
    const startTime = audioCtx.currentTime;
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(800, startTime);
    oscillator.frequency.linearRampToValueAtTime(1200, startTime + 0.2);
    gainNode.gain.setValueAtTime(0.1, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.3);
    oscillator.start(startTime);
    oscillator.stop(startTime + 0.3);
}

export function setHasInteracted(value) {
    hasInteracted = value;
}

export { playSound, playHonk }; 
