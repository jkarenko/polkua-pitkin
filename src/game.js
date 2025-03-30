// Import existing modules
import {drawCar, createCar, CAR_CONSTANTS} from './car.js';
import {
    calculateCurvature,
    getSpeedMultiplier,
    getDecelerationRate,
    calculateTirePositions,
    updateCarPhysics
} from './core/carPhysics.js';
import {
    distSq,
    dist,
    pointLineSegmentDistance,
    calculatePathLength,
    getPointAlongPath,
    isPointWithinPath,
    getProgressAlongPath,
    smoothPath,
    simpleHash,
    hashPath
} from './core/path.js';
import { playSound, playHonk, setHasInteracted } from './audio.js';
import { generateDecorationsForPath, generateDecorationsAlongSegment } from './decoration.js';
import { createCrashEffect, createVictoryCelebration, createOutOfFuelEffect, updateAndDrawParticles } from './effects.js';
import { GAME_STATES, GameState } from './core/gameState.js';
import { CourseManager } from './core/courseManager.js';
import { drawPath } from './ui/drawPath.js';
import { drawCircle } from './ui/drawCircle.js';
import { drawDirectionalMarker } from './ui/drawDirectionalMarker.js';
import { drawFailState } from './ui/drawFailState.js';
import { drawFuelGauge } from './ui/drawFuelGauge.js';
import { redrawAll } from './ui/redrawAll.js';
// Export all the game constants and initialization
export function initializeGame() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const doneButton = document.getElementById('doneButton');
    const resetButton = document.getElementById('resetButton');
    const statusDiv = document.getElementById('status');
    const savedCoursesButton = document.getElementById('savedCoursesButton');
    const savedCoursesSidebar = document.getElementById('savedCoursesSidebar');
    const sidebarContent = document.getElementById('sidebarContent');
    const closeSidebarButton = document.getElementById('closeSidebarButton');
    const trashCan = document.getElementById('trashCan');
    const saveCourseButton = document.getElementById('saveCourseButton');
    const gameStates = new GameState();

    // Create course manager instance
    const courseManager = new CourseManager(gameStates, canvas, ctx, statusDiv);

    let { P1_WIDTH } = gameStates.visualConstants;
    const {
        P1_COLOR,
        P2_COLOR,
        P2_WIDTH,
        START_COLOR,
        END_COLOR,
        MARKER_RADIUS_FACTOR,
        HIT_THRESHOLD_FACTOR,
        START_END_SNAP_RADIUS_FACTOR
    } = gameStates.visualConstants;

    const {
        PROGRESS_INTERVAL,
        SCORE_THRESHOLD,
        SCORE_POINTS,
        MAX_PATH_LENGTH_FACTOR
    } = gameStates.gameplayConstants;

    const {
        THUMBNAIL_WIDTH,
        THUMBNAIL_HEIGHT,
        THUMBNAIL_PADDING
    } = gameStates.uiConstants;

    // Car constants
    const {
        PIXEL_SPEED: CAR_PIXEL_SPEED,
        ANIMATION_INTERVAL: CAR_ANIMATION_INTERVAL,
        SMOOTHING_WINDOW,
        CURVATURE_WINDOW,
        MAX_CURVATURE,
        ACCELERATION_RATE,
        BASE_DECELERATION_RATE,
        CURVE_LOOK_AHEAD,
        MAX_DECELERATION_RATE,
        CURVE_PREPARATION_DISTANCE,
        FINISH_PREPARATION_DISTANCE,
        MIN_FINISH_SPEED,
        WHEEL_TURN_SPEED,
        MAX_WHEEL_ANGLE,
        WHEELBASE,
        SKID_TURN_RATE_MULTIPLIER
    } = gameStates.carConstants;

    // --- Helper Functions ---
    const getEventCoords = (e) => {
        const rect = canvas.getBoundingClientRect();
        let x, y;
        const touch = e.touches && e.touches[0];
        x = (touch ? touch.clientX : e.clientX) - rect.left;
        y = (touch ? touch.clientY : e.clientY) - rect.top;
        x *= canvas.width / rect.width;
        y *= canvas.height / rect.height;
        return { x, y };
    };

    // Utility functions for distance calculations moved to carPhysics.js

    // isPointWithinPath function moved to path.js

    // calculatePathLength function moved to carPhysics.js

    // getProgressAlongPath function moved to path.js

    // Car physics calculation functions moved to carPhysics.js
    // - calculateCurvature
    // - getSpeedMultiplier
    // - getDecelerationRate

    // --- Drawing Functions ---





    // smoothPath function moved to path.js

    const handleP1Done = () => {
        if (gameStates.player1Path.length < 2) {
            statusDiv.textContent = "Pelaaja 1: Polku on liian lyhyt! Piirrä pitempi polku.";
            return;
        }

        gameStates.gameState = GAME_STATES.P2_WAITING;
        gameStates.isDrawing = false;
        doneButton.style.display = 'none';
        saveCourseButton.style.display = 'none'; // Hide save button during P2 phase
        resetButton.style.display = 'inline-block';
        savedCoursesButton.style.display = 'none';
        statusDiv.textContent = 'Pelaaja 2: Seuraa polkua harmaasta ympyrästä alkaen.';

        gameStates.player1TotalLength = calculatePathLength(gameStates.player1Path);
        gameStates.maxAllowedPathLength = gameStates.player1TotalLength * gameStates.MAX_PATH_LENGTH_FACTOR;
        gameStates.currentPathLength = 0;
        const markerRadius = P1_WIDTH / 2 * gameStates.MARKER_RADIUS_FACTOR;
        gameStates.startMarker = { ...gameStates.player1Path[0], radius: markerRadius, snapRadius: markerRadius * gameStates.START_END_SNAP_RADIUS_FACTOR };
        gameStates.endMarker = { ...gameStates.player1Path[gameStates.player1Path.length - 1], radius: markerRadius, snapRadius: markerRadius * gameStates.START_END_SNAP_RADIUS_FACTOR };

        // smoothedPath = smoothPath(player1Path); // Option 1: Use actual smoothed P1 path
        gameStates.smoothedPath = gameStates.player1Path; // Option 2: Use the raw P1 path (current implementation)
        // This is the path that will be hashed and saved. DO NOT MODIFY LATER.

        // Calculate progress markers based on the original player1Path length
        gameStates.progressMarkers = [];
        for (let i = 0; i <= 10; i++) { // 10 segments (0% to 100%)
            const targetProgress = i * gameStates.PROGRESS_INTERVAL;
            let accumulatedLength = 0;
            let markerPoint = null;
            let markerDirection = null;

            for (let j = 0; j < gameStates.player1Path.length - 1; j++) {
                const segmentLength = dist(gameStates.player1Path[j], gameStates.player1Path[j + 1]);
                if (accumulatedLength + segmentLength >= targetProgress * gameStates.player1TotalLength) {
                    const t = (targetProgress * gameStates.player1TotalLength - accumulatedLength) / segmentLength;
                    markerPoint = {
                        x: gameStates.player1Path[j].x + t * (gameStates.player1Path[j + 1].x - gameStates.player1Path[j].x),
                        y: gameStates.player1Path[j].y + t * (gameStates.player1Path[j + 1].y - gameStates.player1Path[j].y)
                    };
                    markerDirection = {
                        x: gameStates.player1Path[j + 1].x - gameStates.player1Path[j].x,
                        y: gameStates.player1Path[j + 1].y - gameStates.player1Path[j].y
                    };
                    // Normalize direction
                    const length = Math.sqrt(markerDirection.x * markerDirection.x + markerDirection.y * markerDirection.y);
                    markerDirection.x /= length;
                    markerDirection.y /= length;
                    break;
                }
                accumulatedLength += segmentLength;
            }

            if (markerPoint && markerDirection) {
                gameStates.progressMarkers.push({ point: markerPoint, direction: markerDirection });
            }
        }

        redrawAllHelper();
    };

    // getPointAlongPath function moved to carPhysics.js

    const showVictoryScreen = (score) => {
        const victoryScreen = document.getElementById('victoryScreen');
        const scoreDisplay = document.getElementById('scoreDisplay');
        const scoreMessage = document.getElementById('scoreMessage');
        const saveButton = document.getElementById('victorySaveButton');
        const newRecordMsg = document.getElementById('newRecordMessage');

        // Store the high score *before* this run
        const previousSessionHighScore = gameStates.currentSessionHighScore;
        let newRecordSet = false;

        // Update session high score if this run was better
        if (score > gameStates.currentSessionHighScore) {
            gameStates.currentSessionHighScore = score;
            gameStates.currentSessionBestPlayer2Path = [...gameStates.player2Path];
            console.log(`New session high score: ${gameStates.currentSessionHighScore}`);
            if (score > previousSessionHighScore) {
                newRecordSet = true;
                // Automatically update highscore if this is a loaded course
                if (window.currentLoadedCourseId) {
                    updateHighScore(window.currentLoadedCourseId, score);
                }
            }
        }

        // Update display content
        scoreDisplay.textContent = `Pisteet: ${score}`;
        scoreMessage.textContent = getScoreMessage(score);
        newRecordMsg.style.display = newRecordSet ? 'block' : 'none';

        // Only show save button for new courses
        if (window.currentLoadedCourseId) {
            saveButton.style.display = 'none';
        } else {
            saveButton.style.display = 'block';
            saveButton.textContent = 'Tallenna rata';
            saveButton.disabled = false;
        }

        // Show the screen
        victoryScreen.style.display = 'flex';
    };

    // updateHighScore function moved to courseManager.js
    const updateHighScore = (courseId, newScore) => {
        courseManager.updateHighScore(courseId, newScore);
    };




    // Helper function to call redrawAll with all necessary parameters
    const redrawAllHelper = () => {
        redrawAll(
            ctx, 
            canvas, 
            gameStates, 
            P1_COLOR, 
            P1_WIDTH, 
            START_COLOR, 
            END_COLOR, 
            GAME_STATES, 
            MAX_PATH_LENGTH_FACTOR,
            drawPath,
            drawCircle,
            drawDirectionalMarker,
            drawFuelGauge,
            drawCar,
            CAR_CONSTANTS
        );
    };

    // --- Game Logic ---
    const resetPlayer2 = () => {
        gameStates.player2Path = [];
        gameStates.isDrawing = false;
        gameStates.lastPlayedProgressMilestone = 0;
        gameStates.currentActiveSegmentIndex = 0; // Reset the active segment index
        gameStates.currentPathLength = 0; // Reset path length
        gameStates.gameState = GAME_STATES.P2_WAITING;
        statusDiv.textContent = 'Pelaaja 2: Seuraa polkua harmaasta ympyrästä alkaen.';
        redrawAllHelper();
        saveCourseButton.style.display = 'none'; // Hide P1 save button
    };

    const resetGame = () => {
        // Hide screens
        document.getElementById('victoryScreen').style.display = 'none';
        document.getElementById('defeatScreen').style.display = 'none';

        // Reset all game states
        gameStates.reset();

        // Additional UI-specific resets
        gameStates.gameState = GAME_STATES.P1_DRAWING;
        doneButton.style.display = 'inline-block';
        saveCourseButton.style.display = 'inline-block'; // Show save button
        saveCourseButton.disabled = false; // Ensure it's enabled
        saveCourseButton.textContent = 'Tallenna rata'; // Reset text
        resetButton.style.display = 'none';
        statusDiv.textContent = 'Pelaaja 1: Piirrä polku.';

        // Cancel any ongoing animations
        if (gameStates.carAnimationFrame) {
            cancelAnimationFrame(gameStates.carAnimationFrame);
            gameStates.carAnimationFrame = null;
        }

        // Stop engine sound if playing
        if (gameStates.engineSound) {
            gameStates.engineSound.stop(); // Call the stop method provided by createV8EngineSound
            gameStates.engineSound = null;
        }

        // Stop screech sound if playing
        if (gameStates.screechSound) {
            gameStates.screechSound.stop();
            gameStates.screechSound = null;
        }

        // Clear the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Update UI elements
        savedCoursesButton.style.display = 'inline-block'; // Show button in P1 phase
        closeSidebar(); // Ensure sidebar is closed on new game
        hideTrashCan(); // Ensure trashcan is hidden

        // Cancel particle animation if running
        if (gameStates.particleAnimationFrame) {
            cancelAnimationFrame(gameStates.particleAnimationFrame);
            gameStates.particleAnimationFrame = null;
        }

        window.currentLoadedCourseId = null; // Clear the loaded course ID
    };

    // --- Event Handlers ---
    const handleStart = (e) => {
        if (e.touches && e.touches.length > 1) {
            return;
        }
        e.preventDefault();
        setHasInteracted(true);

        const pos = getEventCoords(e);

        if (gameStates.gameState === GAME_STATES.P1_DRAWING) {
            gameStates.isDrawing = true;
            gameStates.player1Path = [pos];
            gameStates.decorations = []; // Clear all decorations when starting to draw
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        } else if (gameStates.gameState === GAME_STATES.P2_WAITING) {
            if (gameStates.startMarker && dist(pos, gameStates.startMarker) <= gameStates.startMarker.snapRadius) {
                gameStates.isDrawing = true;
                gameStates.player2Path = [pos];
                gameStates.lastPlayedProgressMilestone = 0;
                gameStates.gameState = GAME_STATES.P2_DRAWING;
                statusDiv.textContent = 'Pelaaja 2: Seuraa polkua! Pysy sinisen viivan sisällä!';
                redrawAllHelper();
                drawPath(ctx, gameStates.player2Path, P2_COLOR, P2_WIDTH, false, P1_COLOR);
            } else {
                statusDiv.textContent = 'Pelaaja 2: Aloita piirtäminen harmaasta ympyrästä!';
            }
        }
    };

    const checkFuelLimit = (currentPosition, distanceMoved, isDrawingPhase = false) => {
        if (gameStates.defeatFlagged) {
            return true; // Already defeated
        }

        const effectivePathLength = isDrawingPhase ?
            getProgressAlongPath(currentPosition, gameStates.player1Path, gameStates.player1TotalLength, gameStates, GAME_STATES) * gameStates.player1TotalLength :
            gameStates.fuelConsumed + distanceMoved;

        if (effectivePathLength > gameStates.maxAllowedPathLength) {
            gameStates.defeatFlagged = true;
            playSound('alarm');
            playSound('alarm');
            statusDiv.textContent = 'Pelaaja 2: Polttoaine loppui! Yritä ajaa suoremmin.';

            // Add crash effect at the current position
            gameStates.activeParticles.push(...createOutOfFuelEffect(currentPosition.x, currentPosition.y));

            // Start particle animation immediately
            if (!gameStates.particleAnimationFrame) {
                animateParticles();
            }

            return true; // Indicates defeat
        }
        return false; // Indicates no defeat
    };

    const handleMove = (e) => {
        if (!gameStates.isDrawing || (e.touches && e.touches.length > 1)) {
            return;
        }
        e.preventDefault();

        const pos = getEventCoords(e);
        const lastPos = (gameStates.gameState === GAME_STATES.P1_DRAWING ? gameStates.player1Path : gameStates.player2Path).slice(-1)[0];

        if (pos.x === lastPos.x && pos.y === lastPos.y) {
            return;
        }

        if (gameStates.gameState === GAME_STATES.P1_DRAWING) {
            gameStates.player1Path.push(pos);
            ctx.beginPath();
            ctx.moveTo(lastPos.x, lastPos.y);
            ctx.lineTo(pos.x, pos.y);
            ctx.strokeStyle = P1_COLOR;
            ctx.lineWidth = P1_WIDTH;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();

            // Remove decorations that are under the current segment
            const erasureRadius = P1_WIDTH / 2; // Radius to check for decorations to remove
            gameStates.decorations = gameStates.decorations.filter(decoration => {
                const distance = pointLineSegmentDistance(decoration.position, lastPos, pos);
                return distance > erasureRadius;
            });

            // Generate decorations only for the current segment
            const decorationDensity = 5; // Average number of decorations per 100 pixels
            const decorationOffset = P1_WIDTH * 1.5; // Distance to offset decorations from the path
            const newDecorations = generateDecorationsAlongSegment(lastPos, pos, decorationDensity, decorationOffset);

            // Filter out decorations that are too close to any existing path segment
            const minDistanceToPath = P1_WIDTH * 1.2; // Slightly larger than the path width
            const validDecorations = newDecorations.filter(decoration => {
                // Check distance to all existing path segments
                for (let i = 0; i < gameStates.player1Path.length - 1; i++) {
                    const segmentStart = gameStates.player1Path[i];
                    const segmentEnd = gameStates.player1Path[i + 1];
                    // Skip the current segment as it's already handled by the erasure
                    if (segmentStart === lastPos && segmentEnd === pos) {
                        continue;
                    }

                    const distance = pointLineSegmentDistance(decoration.position, segmentStart, segmentEnd);
                    if (distance < minDistanceToPath) {
                        return false;
                    }
                }
                return true;
            });

            gameStates.decorations = gameStates.decorations.concat(validDecorations);
            redrawAllHelper();

        } else if (gameStates.gameState === GAME_STATES.P2_DRAWING) {
            const threshold = gameStates.P1_WIDTH / 2 * gameStates.HIT_THRESHOLD_FACTOR;
            if (!isPointWithinPath(pos, gameStates.player1Path, threshold, gameStates, GAME_STATES)) {
                playSound('alarm');
                resetPlayer2();
                statusDiv.textContent = 'Pelaaja 2: Hups! Eksyit polulta! Aloita uudelleen alusta.';
                return;
            }

            // Calculate new path length
            const newSegmentLength = dist(lastPos, pos);
            gameStates.currentPathLength += newSegmentLength;

            // Check fuel limit using shared function
            if (checkFuelLimit(pos, newSegmentLength, true)) {
                gameStates.isDrawing = false; // Stop drawing
                gameStates.gameState = GAME_STATES.SHOWING_SCORE; // Change state to show score

                // Add 1-second delay before showing defeat screen
                setTimeout(() => {
                    drawFailState();
                }, 1000);

                return; // Exit the function without showing defeat screen immediately
            }

            gameStates.player2Path.push(pos);

            ctx.beginPath();
            ctx.moveTo(lastPos.x, lastPos.y);
            ctx.lineTo(pos.x, pos.y);
            ctx.strokeStyle = P2_COLOR;
            ctx.lineWidth = P2_WIDTH;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();

            const currentProgress = getProgressAlongPath(pos, gameStates.player1Path, gameStates.player1TotalLength, gameStates, GAME_STATES);
            const currentMilestone = Math.floor(currentProgress / PROGRESS_INTERVAL);

            if (currentMilestone > gameStates.lastPlayedProgressMilestone && currentProgress < 1.0) {
                gameStates.lastPlayedProgressMilestone = currentMilestone;
                playSound('chime', currentProgress);
            }
        }
    };

    const handleEnd = (e) => {
        if (!gameStates.isDrawing) {
            return;
        }
        e.preventDefault();

        if (gameStates.gameState === GAME_STATES.P1_DRAWING) {
            gameStates.isDrawing = false;
            if (gameStates.player1Path.length < 2) {
                statusDiv.textContent = "Pelaaja 1: Polku on liian lyhyt! Piirrä pitempi polku.";
            } else {
                statusDiv.textContent = "Pelaaja 1: Paina 'Valmis' tai jatka piirtämistä.";
            }
        } else if (gameStates.gameState === GAME_STATES.P2_DRAWING) {
            const lastPos = gameStates.player2Path.slice(-1)[0];
            gameStates.isDrawing = false;

            if (gameStates.endMarker && dist(lastPos, gameStates.endMarker) <= gameStates.endMarker.snapRadius) {
                const finalProgress = getProgressAlongPath(lastPos, gameStates.player1Path, gameStates.player1TotalLength, gameStates, GAME_STATES);
                if (finalProgress >= 0.95) {
                    gameStates.gameState = GAME_STATES.CAR_ANIMATING;
                    statusDiv.textContent = 'Pelaaja 2: Polku valmis! Odota autoa...';
                    playSound('success');

                    // Apply smoothing to player 2 path for better car animation
                    gameStates.player2Path = smoothPath(gameStates.player2Path, SMOOTHING_WINDOW);

                    redrawAllHelper();
                    drawPath(ctx, gameStates.player2Path, P2_COLOR, P2_WIDTH, false, P1_COLOR);

                    // Reset car state and start animation
                    gameStates.carProgress = 0;
                    gameStates.carPosition = { ...gameStates.player2Path[0] };
                    gameStates.carAngle = 0;
                    gameStates.carConfig = createCar(); // Create new car configuration with random color
                    animateCar();
                } else {
                    playSound('alarm');
                    resetPlayer2();
                    statusDiv.textContent = 'Pelaaja 2: Saavutit maalin liian aikaisin! Aloita uudelleen alusta.';
                }
            } else {
                playSound('alarm');
                resetPlayer2();
                statusDiv.textContent = 'Pelaaja 2: Piirtäminen keskeytyi! Aloita uudelleen alusta.';
            }
        }
    };

    const calculateScore = () => {
        if (!gameStates.player2Path || gameStates.player2Path.length < 2 || !gameStates.smoothedPath || gameStates.smoothedPath.length < 2) {
            return 0; // Added check for smoothedPath
        }

        let totalDistance = 0;
        let validPoints = 0;

        // Sample points along Player 2's path
        for (let i = 0; i < gameStates.player2Path.length; i++) {
            const point = gameStates.player2Path[i];
            let minDistance = Infinity;

            // Find the closest point on the defined Player 1 course path (smoothedPath)
            for (let j = 0; j < gameStates.smoothedPath.length - 1; j++) {
                const dist = pointLineSegmentDistance(point, gameStates.smoothedPath[j], gameStates.smoothedPath[j + 1]);
                minDistance = Math.min(minDistance, dist);
            }
            // Check distance to the last point of smoothedPath as well
            if (gameStates.smoothedPath.length > 0) {
                minDistance = Math.min(minDistance, dist(point, gameStates.smoothedPath[gameStates.smoothedPath.length - 1]));
            }


            // Only count points that are within the threshold
            if (minDistance <= SCORE_THRESHOLD) {
                totalDistance += minDistance;
                validPoints++;
            }
        }

        if (validPoints === 0) {
            return 0;
        }

        // Calculate average distance
        const avgDistance = totalDistance / validPoints;

        // Convert to score (0-100)
        // Perfect score (100) when average distance is 0
        // 0 points when average distance is SCORE_THRESHOLD or greater
        return Math.max(0, Math.round(SCORE_POINTS * (1 - avgDistance / SCORE_THRESHOLD)));
    };

    const getScoreMessage = (score) => {
        if (score >= 90) { return "Vau! Upea suoritus! 🌟🌟🌟🌟🌟"; }
        if (score >= 80) { return "Ajoit varsin hienosti! 🌟🌟🌟🌟"; }
        if (score >= 70) { return "Hyvä! Pysyit tiellä! 🌟🌟🌟"; }
        if (score >= 60) { return "Pystyt parempaankin! 🌟🌟"; }
        if (score >= 50) { return "Nyt meni vähän mutkitellen! 🌟"; }
        return "Kokeile uudelleen! 💪";
    };

    // --- Initialization ---
    const resizeCanvas = () => {
        const controlsHeight = document.getElementById('controls').offsetHeight + 20; // Get actual height + margin
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight; // Adjust if controls overlay canvas significantly

        // Style setting needed if CSS dimensions are different
        canvas.style.width = `${window.innerWidth}px`;
        canvas.style.height = `${window.innerHeight}px`;

        redrawAllHelper(); // Redraw contents after resize
    };

    // saveCourseNow function moved to courseManager.js
    const saveCourseNow = () => {
        courseManager.saveCourseNow(handleP1Done, redrawAllHelper, GAME_STATES);
    };

    const replayLevel = () => {
        // Hide screens
        document.getElementById('victoryScreen').style.display = 'none';
        document.getElementById('defeatScreen').style.display = 'none';

        // Keep player1Path and smoothedPath, but reset everything else
        gameStates.player2Path = [];
        gameStates.isDrawing = false;
        gameStates.lastPlayedProgressMilestone = 0;
        gameStates.currentActiveSegmentIndex = 0;
        gameStates.currentPathLength = 0;
        gameStates.fuelConsumed = 0; // Reset fuel consumed for replay
        gameStates.previousCarPosition = null; // Reset previous car position tracking
        gameStates.defeatFlagged = false; // Reset defeat flag
        gameStates.isFinishing = false; // Reset finishing flag
        gameStates.carConfig = null; // Reset car configuration
        gameStates.gameState = GAME_STATES.P2_WAITING;
        statusDiv.textContent = 'Pelaaja 2: Seuraa polkua harmaasta ympyrästä alkaen.';

        // Reset car state
        if (gameStates.carAnimationFrame) {
            cancelAnimationFrame(gameStates.carAnimationFrame);
            gameStates.carAnimationFrame = null;
        }
        gameStates.carProgress = 0;
        gameStates.carPosition = { x: 0, y: 0 };
        gameStates.carAngle = 0;
        gameStates.carTrail = []; // Clear car trail array
        gameStates.tireMarks = []; // <--- Clear tire marks
        gameStates.isScreeching = false; // <--- Reset screeching state
        gameStates.isSkidding = false; // Add this

        // Stop engine sound if playing
        if (gameStates.engineSound) {
            gameStates.engineSound.stop(); // Call the stop method provided by createV8EngineSound
            gameStates.engineSound = null;
        }

        // Stop screech sound if playing
        if (gameStates.screechSound) {
            gameStates.screechSound.stop();
            gameStates.screechSound = null;
        }

        redrawAllHelper();

        // Clear particles
        gameStates.activeParticles = [];

        // Cancel particle animation if running
        if (gameStates.particleAnimationFrame) {
            cancelAnimationFrame(gameStates.particleAnimationFrame);
            gameStates.particleAnimationFrame = null;
        }
    };

    // openSidebar and closeSidebar functions moved to courseManager.js
    const openSidebar = () => {
        courseManager.openSidebar(handleP1Done, redrawAllHelper, GAME_STATES);
    };

    const closeSidebar = () => {
        courseManager.closeSidebar();
    };

    // showTrashCan and hideTrashCan functions moved to courseManager.js
    const showTrashCan = () => {
        courseManager.showTrashCan();
    };

    const hideTrashCan = () => {
        courseManager.hideTrashCan();
    };

    // getStarRatingHTML function moved to courseManager.js
    const getStarRatingHTML = (score) => {
        return courseManager.getStarRatingHTML(score);
    };

    // drawThumbnail function moved to courseManager.js
    const drawThumbnail = (canvasElement, path) => {
        courseManager.drawThumbnail(canvasElement, path);
    };

    // populateSavedCoursesSidebar function moved to courseManager.js
    const populateSavedCoursesSidebar = () => {
        courseManager.populateSavedCoursesSidebar(handleP1Done, redrawAllHelper, GAME_STATES);
    };

    // --- Course Loading/Deleting ---

    // loadCourse function moved to courseManager.js
    const loadCourse = (courseData) => {
        courseManager.loadCourse(courseData, handleP1Done, redrawAllHelper, GAME_STATES);
    };

    // deleteCourse function moved to courseManager.js
    const deleteCourse = (courseId) => {
        return courseManager.deleteCourse(courseId);
    };

    // --- Drag and Drop Handlers ---

    // handleThumbnailDragStart and handleThumbnailDragEnd functions moved to courseManager.js
    const handleThumbnailDragStart = (e) => {
        courseManager.handleThumbnailDragStart(e);
    };

    const handleThumbnailDragEnd = (e) => {
        courseManager.handleThumbnailDragEnd(e);
    };

    // handleCanvasDragOver, handleCanvasDrop, handleTrashDragOver, handleTrashDragLeave, and handleTrashDrop functions moved to courseManager.js
    const handleCanvasDragOver = (e) => {
        courseManager.handleCanvasDragOver(e);
    };

    const handleCanvasDrop = (e) => {
        courseManager.handleCanvasDrop(e, handleP1Done, redrawAllHelper, GAME_STATES);
    };

    const handleTrashDragOver = (e) => {
        courseManager.handleTrashDragOver(e);
    };

    const handleTrashDragLeave = (e) => {
        courseManager.handleTrashDragLeave(e);
    };

    const handleTrashDrop = (e) => {
        courseManager.handleTrashDrop(e);
    };

    const animateCar = () => {
        // Exit if we are already in the finishing delay or showing score
        if (gameStates.isFinishing || gameStates.gameState === GAME_STATES.SHOWING_SCORE) {
            // Start particle animation if not already running
            if (!gameStates.particleAnimationFrame && gameStates.activeParticles.length > 0) {
                animateParticles();
            }
            return;
        }

        // Create a car state object for the physics update
        const carState = {
            isFinishing: gameStates.isFinishing,
            previousPosition: gameStates.previousCarPosition,
            position: gameStates.carPosition,
            progress: gameStates.carProgress,
            currentAngle: gameStates.currentCarAngle,
            previousAngle: gameStates.previousCarAngle,
            currentWheelAngle: gameStates.currentWheelAngle,
            currentSpeed: gameStates.currentSpeed,
            isSkidding: gameStates.isSkidding,
            pathTotalLength: gameStates.player1TotalLength,
            trail: gameStates.carTrail,
            fuelConsumed: gameStates.fuelConsumed,
            tireMarks: gameStates.tireMarks
        };

        // Create a constants object for the physics update
        const constants = {
            PIXEL_SPEED: CAR_PIXEL_SPEED,
            ANIMATION_INTERVAL: CAR_ANIMATION_INTERVAL,
            MAX_CURVATURE: MAX_CURVATURE,
            ACCELERATION_RATE: ACCELERATION_RATE,
            BASE_DECELERATION_RATE: BASE_DECELERATION_RATE,
            CURVE_LOOK_AHEAD: CURVE_LOOK_AHEAD,
            MAX_DECELERATION_RATE: MAX_DECELERATION_RATE,
            CURVE_PREPARATION_DISTANCE: CURVE_PREPARATION_DISTANCE,
            FINISH_PREPARATION_DISTANCE: FINISH_PREPARATION_DISTANCE,
            MIN_FINISH_SPEED: MIN_FINISH_SPEED,
            WHEEL_TURN_SPEED: WHEEL_TURN_SPEED,
            MAX_WHEEL_ANGLE: MAX_WHEEL_ANGLE,
            WHEELBASE: WHEELBASE,
            SKID_TURN_RATE_MULTIPLIER: SKID_TURN_RATE_MULTIPLIER
        };

        // Use the updateCarPhysics function from the carPhysics module
        const result = updateCarPhysics(carState, gameStates.player2Path, constants, checkFuelLimit);

        // Update the game state with the new car state
        gameStates.previousCarPosition = carState.previousPosition;
        gameStates.carPosition = carState.position;
        gameStates.carProgress = carState.progress;
        gameStates.currentCarAngle = carState.currentAngle;
        gameStates.previousCarAngle = carState.previousAngle;
        gameStates.currentWheelAngle = carState.currentWheelAngle;
        gameStates.currentSpeed = carState.currentSpeed;
        gameStates.isSkidding = carState.isSkidding; // Update isSkidding flag for sound effects
        // Note: carState.trail and carState.tireMarks are updated by reference

        // Handle result from updateCarPhysics
        if (result === false) {
            // Car should stop (fuel limit exceeded)
            if (gameStates.carAnimationFrame) {
                cancelAnimationFrame(gameStates.carAnimationFrame);
                gameStates.carAnimationFrame = null;
            }

            // Stop engine sound
            if (gameStates.engineSound) {
                gameStates.engineSound.stop();
                gameStates.engineSound = null;
            }

            // Stop screech sound if it's playing
            if (gameStates.screechSound) {
                gameStates.screechSound.stop();
                gameStates.screechSound = null;
            }

            // Set timeout to show defeat screen after 1 second
            setTimeout(() => {
                gameStates.gameState = GAME_STATES.SHOWING_SCORE;
                drawFailState();
            }, 1000);

            return;
        }

        // Determine if the car should be screeching - only when drifting or braking hard
        const shouldBeScreeching = gameStates.isSkidding;

        // Manage the screech sound
        if (shouldBeScreeching) {
            // Start screech sound if not already playing
            if (!gameStates.screechSound) {
                gameStates.screechSound = playSound('screech');
            }
        } else {
            // Stop screech sound if it's playing
            if (gameStates.screechSound) {
                gameStates.screechSound.stop();
                gameStates.screechSound = null;
            }
        }

        // Update the screeching state for the current frame
        gameStates.isScreeching = shouldBeScreeching;

        // --- Engine Sound ---
        if (!gameStates.engineSound) {
            gameStates.engineSound = playSound('engine');
        } else {
            gameStates.engineSound.updateSpeed(gameStates.currentSpeed, CAR_PIXEL_SPEED);
        }

        // --- Redraw and Continue ---
        redrawAllHelper();

        // --- Finish Line Check ---
        if (result === 'finished' && !gameStates.isFinishing) {
            gameStates.isFinishing = true; // Set the finishing flag
            gameStates.currentSpeed = 0; // Stop the car immediately

            // Play honk sound immediately IF NOT defeated
            if (!gameStates.defeatFlagged) {
                playHonk([0.07, 0.6], [0.07]);

                // Calculate score before showing victory screen
                const score = calculateScore();

                // Only add victory celebration particles if this is a new high score
                if (score > gameStates.currentSessionHighScore) {
                    // Add victory celebration particles immediately
                    gameStates.activeParticles.push(...createVictoryCelebration(gameStates.carPosition.x, gameStates.carPosition.y));
                    // Start particle animation if not already running
                    if (!gameStates.particleAnimationFrame) {
                        animateParticles();
                    }
                }
            }

            // Stop engine sound
            if (gameStates.engineSound) {
                gameStates.engineSound.stop();
                gameStates.engineSound = null;
            }

            // Stop screech sound if it's playing
            if (gameStates.screechSound) {
                gameStates.screechSound.stop();
                gameStates.screechSound = null;
            }

            // Cancel future animation frames
            if (gameStates.carAnimationFrame) {
                cancelAnimationFrame(gameStates.carAnimationFrame);
                gameStates.carAnimationFrame = null;
            }

            // Perform one final redraw to show the car at the finish line
            redrawAllHelper();
            drawPath(ctx, gameStates.player2Path, P2_COLOR, P2_WIDTH, false, P1_COLOR);

            // Set timeout to show the appropriate screen after 1 second
            setTimeout(() => {
                gameStates.gameState = GAME_STATES.SHOWING_SCORE;
                if (gameStates.defeatFlagged) {
                    drawFailState();
                } else {
                    const score = calculateScore();
                    statusDiv.textContent = `Pisteet: ${score} - ${getScoreMessage(score)}`;
                    showVictoryScreen(score);
                }
            }, 1000);

            return;
        }

        // Request next frame only if not finishing
        if (!gameStates.isFinishing) {
            gameStates.carAnimationFrame = requestAnimationFrame(animateCar);
        }
    };

    // simpleHash and hashPath functions moved to path.js

    doneButton.style.display = 'none'; // P1 is done by loading
    saveCourseButton.style.display = 'none'; // Hide P1 save button too
    resetButton.style.display = 'inline-block';

    const animateParticles = () => {
        // Clear the canvas and redraw everything
        redrawAllHelper();

        // Update and draw particles on top
        updateAndDrawParticles(ctx, gameStates.activeParticles);

        // Continue animation if there are particles
        if (gameStates.activeParticles.length > 0) {
            gameStates.particleAnimationFrame = requestAnimationFrame(animateParticles);
        } else {
            // If no particles left, ensure we clean up
            gameStates.particleAnimationFrame = null;
        }
    };

    // Setup Event Listeners
    saveCourseButton.addEventListener('click', saveCourseNow); // Add listener for the new button

    // Add width slider event listener
    const widthSlider = document.getElementById('widthSlider');
    const widthValue = document.getElementById('widthValue');
    widthSlider.addEventListener('input', (e) => {
        P1_WIDTH = parseInt(e.target.value);
        widthValue.textContent = P1_WIDTH;
        if (gameStates.gameState === GAME_STATES.P1_DRAWING && gameStates.player1Path.length > 0) {
            redrawAllHelper();
        }
    });

    canvas.addEventListener('mousedown', handleStart);
    canvas.addEventListener('mousemove', handleMove);
    canvas.addEventListener('mouseup', handleEnd);
    canvas.addEventListener('mouseout', handleEnd); // Treat leaving canvas like mouseup

    canvas.addEventListener('touchstart', handleStart, { passive: false });
    canvas.addEventListener('touchmove', handleMove, { passive: false });
    canvas.addEventListener('touchend', handleEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleEnd, { passive: false }); // Treat cancel like end

    doneButton.addEventListener('click', handleP1Done);
    resetButton.addEventListener('click', resetGame);
    saveCourseButton.addEventListener('click', saveCourseNow); // Main save button
    document.getElementById('victorySaveButton').addEventListener('click', saveCourseNow); // Victory screen save button

    window.addEventListener('resize', resizeCanvas);

    // Add event listeners for game screens
    document.getElementById('victoryReplayButton').addEventListener('click', replayLevel);
    document.getElementById('victoryNewGameButton').addEventListener('click', resetGame);
    document.getElementById('defeatReplayButton').addEventListener('click', replayLevel);
    document.getElementById('defeatNewGameButton').addEventListener('click', resetGame);

    // Add listeners for new UI elements
    savedCoursesButton.addEventListener('click', openSidebar);
    closeSidebarButton.addEventListener('click', closeSidebar);

    // Add Drag/Drop listeners for canvas (loading)
    canvas.addEventListener('dragover', handleCanvasDragOver);
    canvas.addEventListener('drop', handleCanvasDrop);

    // Add Drag/Drop listeners for trashcan (deleting)
    trashCan.addEventListener('dragover', handleTrashDragOver);
    trashCan.addEventListener('dragleave', handleTrashDragLeave); // Handle leaving the trash area
    trashCan.addEventListener('drop', handleTrashDrop);

    // Initial setup
    document.addEventListener('DOMContentLoaded', (event) => {
        resizeCanvas();
        resetGame();
    });
}
