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
    initAudio();
    if (!audioCtx) {
        return;
    }

    let { currentTime } = audioCtx;

    const length = Math.max(durations.length, pauses.length);
    durations = durations.concat(Array(length - durations.length).fill(0.3));
    pauses = pauses.concat(Array(length - pauses.length).fill(0));

    for (let i = 0; i < length; i++) {
        const startTime = currentTime;

        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);

        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);

        const baseFreq = 400;
        osc1.type = 'triangle';
        osc2.type = 'square';
        osc1.frequency.setValueAtTime(baseFreq, startTime);
        osc2.frequency.setValueAtTime(baseFreq * 1.189207115, startTime);

        gain1.gain.setValueAtTime(0.08, startTime);
        gain2.gain.setValueAtTime(0.06, startTime);

        gain1.gain.linearRampToValueAtTime(0.08, startTime + 0.05);
        gain2.gain.linearRampToValueAtTime(0.06, startTime + 0.05);
        gain1.gain.exponentialRampToValueAtTime(0.0002, startTime + durations[i]);
        gain2.gain.exponentialRampToValueAtTime(0.0002, startTime + durations[i]);

        osc1.start(startTime);
        osc2.start(startTime);
        osc1.stop(startTime + durations[i]);
        osc2.stop(startTime + durations[i]);

        currentTime += durations[i] + pauses[i];
    }
}

function playSound(type, pitchFactor = 0) {
    initAudio();
    if (!audioCtx) {
      return;
    }

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
            return createV8EngineSound();
        case 'screech':
            return playScreech();
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

function createV8EngineSound() {
    const engine = createEngineSound();
    const minRPM = 800; // Idle/minimum RPM
    const maxRPM = 4800; // Max RPM (adjust as needed, based on 800 + 4000 from previous logic)
    return {
        updateSpeed: (speed, maxSpeed) => {
            // Calculate RPM based on speed within the defined range
            const currentRPM = minRPM + (speed / maxSpeed) * (maxRPM - minRPM);
            engine.updateRPM(currentRPM, minRPM, maxRPM); // Pass the full RPM context
        },
        stop: engine.stop
    };
}

function createEngineSound() {
    const baseFreq = 50;
    const cylinderCount = 8;
    const firingOrder = [1, 8, 4, 3, 6, 5, 7, 2];
    const oscillators = [];
    const gains = [];
    const initialFrequencies = []; // Store initial randomized base frequencies
    const maxRPMPitchFactor = 2.5; // Reduced: Pitch multiplier at max RPM compared to min RPM

    for (let i = 0; i < cylinderCount; i++) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        // Keep slight variation for texture, centered around baseFreq
        const initialFreq = baseFreq + Math.random() * 4 - 2;
        initialFrequencies.push(initialFreq);

        osc.connect(gain).connect(audioCtx.destination);
        osc.type = 'sawtooth';
        // Set the initial frequency for when RPM is at minimum
        osc.frequency.setValueAtTime(initialFreq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        osc.start(audioCtx.currentTime);
        oscillators.push(osc);
        gains.push(gain);
    }

    let currentRPM = 800; // Initialize tracked RPM
    let firingInterval = 120 / currentRPM;
    let running = true;
    // const baseRPM = 800; // Replaced by passed minRPM

    const fireCylinder = (cylIndex, time, duration, intensity) => {
        const gain = gains[cylIndex];
        gain.gain.cancelScheduledValues(time);
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(intensity, time + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    };

    const engineCycle = async () => {
        while (running) {
            let cycleTime = audioCtx.currentTime;
            for (let i = 0; i < cylinderCount; i++) {
                const cyl = firingOrder[i] - 1;
                fireCylinder(cyl, cycleTime, 0.1, 0.07 + Math.random() * 0.02);
                cycleTime += firingInterval;
            }
            const waitTimeMs = Math.max(1, (firingInterval * cylinderCount * 1000) - 10);
            await new Promise(r => setTimeout(r, waitTimeMs));
        }
    };

    engineCycle().catch(error => {
        console.error('Engine cycle error:', error);
    });

    return {
        oscillators,
        gains,
        stop: () => {
            running = false;
            const stopTime = audioCtx.currentTime + 0.2;
            oscillators.forEach(osc => osc.stop(stopTime));
        },
        // Accept minRPM and maxRPM along with the target newRPM
        updateRPM: (newRPM, minRPM, maxRPM) => {
            // Ensure RPM doesn't go below the defined minimum
            currentRPM = Math.max(minRPM, newRPM);
            firingInterval = 120 / currentRPM; // Update firing rate

            const {currentTime} = audioCtx;

            // Calculate the RPM range, avoid division by zero
            const rpmRange = Math.max(1, maxRPM - minRPM); // Ensure range is at least 1

            // Calculate position within the range (0.0 at minRPM, 1.0 at maxRPM)
            const rpmRatio = Math.max(0, Math.min(1, (currentRPM - minRPM) / rpmRange));

            // Calculate the target frequency multiplier:
            // Starts at 1.0 (at minRPM) and scales linearly to maxRPMPitchFactor (at maxRPM)
            const targetMultiplier = 1.0 + rpmRatio * (maxRPMPitchFactor - 1.0);

            oscillators.forEach((osc, index) => {
                // Target frequency is the oscillator's initial base frequency scaled by the multiplier
                const targetFreq = initialFrequencies[index] * targetMultiplier;

                // Smoothly ramp to the new target frequency
                osc.frequency.cancelScheduledValues(currentTime);
                // Start ramp from the current frequency value to avoid abrupt jumps
                osc.frequency.setValueAtTime(osc.frequency.value, currentTime);
                osc.frequency.linearRampToValueAtTime(targetFreq, currentTime + 0.05); // 50ms ramp
            });
        }
    };
}

function playScreech() {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    const baseFreq = 800;

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(baseFreq, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);

    oscillator.start(audioCtx.currentTime);

    let isPlaying = true;

    // Create a function to update the sound (can be used for variations)
    const updateSound = () => {
        if (!isPlaying) return;

        const currentTime = audioCtx.currentTime;
        // Add some randomness to the frequency for a more realistic tire screech
        const randomFreq = baseFreq + Math.random() * baseFreq * 0.5;
        oscillator.frequency.cancelScheduledValues(currentTime);
        oscillator.frequency.setValueAtTime(oscillator.frequency.value, currentTime);
        oscillator.frequency.linearRampToValueAtTime(randomFreq, currentTime + 0.1);
    };

    // Start a loop to continuously update the sound
    const interval = setInterval(updateSound, 100);

    return {
        stop: () => {
            if (!isPlaying) return;
            isPlaying = false;

            clearInterval(interval);

            const stopTime = audioCtx.currentTime;
            gainNode.gain.cancelScheduledValues(stopTime);
            gainNode.gain.setValueAtTime(gainNode.gain.value, stopTime);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, stopTime + 0.1);

            setTimeout(() => {
                oscillator.stop();
            }, 100);
        }
    };
}

export function setHasInteracted(value) {
    hasInteracted = value;
}

export { playSound, playHonk }; 
