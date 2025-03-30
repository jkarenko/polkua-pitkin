// Import existing modules
import {drawCar, createCar, CAR_CONSTANTS} from './car.js';
import { playSound, playHonk, setHasInteracted } from './audio.js';
import { generateDecorationsForPath, generateDecorationsAlongSegment } from './decoration.js';
import { createCrashEffect, createVictoryCelebration, createOutOfFuelEffect, updateAndDrawParticles } from './effects.js';
import { GAME_STATES, GameState } from './core/gameState.js';
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

    const distSq = (p1, p2) => {
        return (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;
    };

    const dist = (p1, p2) => {
        return Math.sqrt(distSq(p1, p2));
    };

    const pointLineSegmentDistance = (p, a, b) => {
        const l2 = distSq(a, b);
        if (l2 === 0) {
            return dist(p, a);
        }
        let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        const projection = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
        return dist(p, projection);
    };

    const isPointWithinPath = (point, path, threshold) => {
        if (path.length < 2) {
            return true;
        } // Path is just a point or empty

        // For Player 1's drawing phase, use the original behavior
        if (gameStates.gameState === GAME_STATES.P1_DRAWING) {
            let minDistance = Infinity;
            for (let i = 0; i < path.length - 1; i++) {
                minDistance = Math.min(minDistance, pointLineSegmentDistance(point, path[i], path[i + 1]));
            }
            if (path.length > 0) {
                minDistance = Math.min(minDistance, dist(point, path[0]));
                minDistance = Math.min(minDistance, dist(point, path[path.length - 1]));
            }
            return minDistance <= threshold;
        }

        // For Player 2's drawing phase, check against all segments up to current position plus look-ahead
        const lookAheadSegments = 3;
        const startIdx = 0;
        const endIdx = Math.min(gameStates.currentActiveSegmentIndex + lookAheadSegments, path.length - 1);

        let minDistance = Infinity;
        for (let i = startIdx; i <= endIdx; i++) {
            if (i < path.length - 1) {
                minDistance = Math.min(minDistance, pointLineSegmentDistance(point, path[i], path[i + 1]));
            }
        }

        // If we're near the end of the current segment, advance to the next one
        if (gameStates.currentActiveSegmentIndex < path.length - 1) {
            const currentSegmentEnd = path[gameStates.currentActiveSegmentIndex + 1];
            if (dist(point, currentSegmentEnd) <= threshold * 1.5) {
                gameStates.currentActiveSegmentIndex++;
            }
        }

        return minDistance <= threshold;
    };

    const calculatePathLength = (path) => {
        let length = 0;
        for (let i = 0; i < path.length - 1; i++) {
            length += dist(path[i], path[i + 1]);
        }
        return length;
    };

    const getProgressAlongPath = (point, path) => {
        if (path.length < 2 || gameStates.player1TotalLength === 0) {
            return 0;
        }

        if (gameStates.gameState === GAME_STATES.P1_DRAWING) {
            let minDistanceSq = Infinity;
            let lengthUpToProjection = 0;
            let accumulatedLength = 0;

            for (let i = 0; i < path.length - 1; i++) {
                const a = path[i];
                const b = path[i + 1];
                const segmentLength = dist(a, b);
                const l2 = distSq(a, b);
                let currentProjection = a;
                let t = 0;

                if (l2 !== 0) {
                    t = ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / l2;
                    t = Math.max(0, Math.min(1, t));
                    currentProjection = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
                }

                const dSq = distSq(point, currentProjection);

                if (dSq < minDistanceSq) {
                    minDistanceSq = dSq;
                    lengthUpToProjection = accumulatedLength + t * segmentLength;
                }
                accumulatedLength += segmentLength;
            }
            // Check distance to the last point as well
            const distToLastPointSq = distSq(point, path[path.length - 1]);
            if (distToLastPointSq < minDistanceSq) {
                lengthUpToProjection = accumulatedLength;
            }

            return lengthUpToProjection / gameStates.player1TotalLength;
        }

        // For Player 2's drawing phase, calculate progress based on current active segment
        let accumulatedLength = 0;
        let currentSegmentProgress = 0;

        // Calculate length up to current active segment
        for (let i = 0; i < gameStates.currentActiveSegmentIndex; i++) {
            accumulatedLength += dist(path[i], path[i + 1]);
        }

        // Calculate progress within current segment
        if (gameStates.currentActiveSegmentIndex < path.length - 1) {
            const currentStart = path[gameStates.currentActiveSegmentIndex];
            const currentEnd = path[gameStates.currentActiveSegmentIndex + 1];
            const segmentLength = dist(currentStart, currentEnd);
            const l2 = distSq(currentStart, currentEnd);

            if (l2 !== 0) {
                const t = ((point.x - currentStart.x) * (currentEnd.x - currentStart.x) +
                    (point.y - currentStart.y) * (currentEnd.y - currentStart.y)) / l2;
                currentSegmentProgress = Math.max(0, Math.min(1, t)) * segmentLength;
            }
        }

        return (accumulatedLength + currentSegmentProgress) / gameStates.player1TotalLength;
    };

    const calculateCurvature = (progress, path) => {
        if (path.length < 3) {
            return 0;
        }

        // Get points before and after current position
        const currentPoint = getPointAlongPath(progress, path);
        const prevPoint = getPointAlongPath(Math.max(0, progress - 0.01), path);
        const nextPoint = getPointAlongPath(Math.min(1, progress + 0.01), path);

        // Calculate vectors
        const v1 = { x: currentPoint.x - prevPoint.x, y: currentPoint.y - prevPoint.y };
        const v2 = { x: nextPoint.x - currentPoint.x, y: nextPoint.y - currentPoint.y };

        // Calculate angle between vectors
        const dot = v1.x * v2.x + v1.y * v2.y;
        const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

        if (mag1 === 0 || mag2 === 0) {
            return 0;
        }

        const cosAngle = dot / (mag1 * mag2);
        // Clamp cosAngle to [-1, 1] to avoid floating point errors
        const clampedCos = Math.max(-1, Math.min(1, cosAngle));
        const angle = Math.acos(clampedCos);

        // Convert angle to curvature (0 to 1)
        // 0 = straight line, 1 = complete U-turn
        return Math.min(MAX_CURVATURE, angle / Math.PI);
    };

    const getSpeedMultiplier = (curvature) => {
        // Convert curvature (0 to MAX_CURVATURE) to speed multiplier (0.05 to 1.0)
        // Now at maximum curvature, speed will be reduced to 5% instead of 10%
        return 1.0 - (curvature / MAX_CURVATURE) * 0.95;
    };

    const getDecelerationRate = (currentCurvature, upcomingCurvature) => {
        // If there's a sharp curve coming up, decelerate more aggressively
        const curveFactor = Math.max(0, upcomingCurvature - currentCurvature);

        // Calculate how close we are to the curve
        const distanceToCurve = CURVE_LOOK_AHEAD - CURVE_PREPARATION_DISTANCE;
        const preparationFactor = Math.max(0, Math.min(1, distanceToCurve / CURVE_PREPARATION_DISTANCE));

        // Combine curve sharpness with preparation factor
        // Add extra deceleration for very sharp curves (curvature > 0.7)
        const extraSharpCurveFactor = Math.max(0, (upcomingCurvature - 0.7) / 0.2);
        const combinedFactor = (curveFactor + extraSharpCurveFactor) * preparationFactor;

        return BASE_DECELERATION_RATE + (combinedFactor * (MAX_DECELERATION_RATE - BASE_DECELERATION_RATE));
    };

    // --- Drawing Functions ---





    const smoothPath = (path) => {
        if (path.length < 3) {
            return path;
        }

        const smoothed = [];
        const halfWindow = Math.floor(SMOOTHING_WINDOW / 2);

        for (let i = 0; i < path.length; i++) {
            let sumX = 0;
            let sumY = 0;
            let count = 0;

            // Calculate weighted average of surrounding points
            for (let j = -halfWindow; j <= halfWindow; j++) {
                const idx = i + j;
                if (idx >= 0 && idx < path.length) {
                    // Use triangular weighting (points closer have more influence)
                    const weight = 1 - Math.abs(j) / (halfWindow + 1);
                    sumX += path[idx].x * weight;
                    sumY += path[idx].y * weight;
                    count += weight;
                }
            }

            smoothed.push({
                x: sumX / count,
                y: sumY / count
            });
        }

        return smoothed;
    };

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

    const getPointAlongPath = (progress, path) => {
        if (!path || path.length < 2) {
            return path[0] || { x: 0, y: 0 };
        }

        let pathTotalLength = calculatePathLength(path);
        if (pathTotalLength === 0) {
            return path[0];
        }

        let targetDistance = progress * pathTotalLength;
        let accumulatedLength = 0;

        for (let i = 0; i < path.length - 1; i++) {
            const segmentLength = dist(path[i], path[i + 1]);
            if (accumulatedLength + segmentLength >= targetDistance || i === path.length - 2) {
                // If segmentLength is 0, t calculation fails, return start point of segment
                if (segmentLength === 0) {
                    return path[i];
                }
                // Ensure progress doesn't exceed 1 due to float precision
                const clampedTarget = Math.min(targetDistance, pathTotalLength);
                const t = (clampedTarget - accumulatedLength) / segmentLength;
                // Clamp t between 0 and 1
                const clampedT = Math.max(0, Math.min(1, t));
                return {
                    x: path[i].x + clampedT * (path[i + 1].x - path[i].x),
                    y: path[i].y + clampedT * (path[i + 1].y - path[i].y)
                };
            }
            accumulatedLength += segmentLength;
        }
        // Fallback: return the last point if progress is 1 or more
        return path[path.length - 1];
    };

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

    const updateHighScore = (courseId, newScore) => {
        try {
            let savedCourses = JSON.parse(localStorage.getItem('savedCourses') || '[]');
            const courseIndex = savedCourses.findIndex(course => course.id === courseId);

            if (courseIndex !== -1) {
                // Update the existing course with new highscore
                savedCourses[courseIndex].highScore = newScore;
                savedCourses[courseIndex].highScorePlayer2Path = gameStates.currentSessionBestPlayer2Path;
                localStorage.setItem('savedCourses', JSON.stringify(savedCourses));
                console.log(`Automatically updated highscore for course ${courseId}`);

                // If sidebar is open, refresh it to show updated scores
                if (savedCoursesSidebar.classList.contains('visible')) {
                    populateSavedCoursesSidebar();
                }
            }
        } catch (error) {
            console.error("Error updating highscore:", error);
        }
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
            getProgressAlongPath(currentPosition, gameStates.player1Path) * gameStates.player1TotalLength :
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
            if (!isPointWithinPath(pos, gameStates.player1Path, threshold)) {
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

            const currentProgress = getProgressAlongPath(pos, gameStates.player1Path);
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
                const finalProgress = getProgressAlongPath(lastPos, gameStates.player1Path);
                if (finalProgress >= 0.95) {
                    gameStates.gameState = GAME_STATES.CAR_ANIMATING;
                    statusDiv.textContent = 'Pelaaja 2: Polku valmis! Odota autoa...';
                    playSound('success');
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

    const saveCourseNow = () => {
        if (gameStates.gameState !== GAME_STATES.P1_DRAWING && gameStates.gameState !== GAME_STATES.SHOWING_SCORE) {
            console.warn("Attempted to save course outside of valid phases.");
            return;
        }

        const saveButton = gameStates.gameState === GAME_STATES.P1_DRAWING ?
            document.getElementById('saveCourseButton') :
            document.getElementById('victorySaveButton');

        // Handle P1 drawing phase saving as before
        if (gameStates.gameState === GAME_STATES.P1_DRAWING) {
            if (!gameStates.player1Path || gameStates.player1Path.length < 2) {
                alert("Rataa ei voi tallentaa, koska polku on liian lyhyt!");
                return;
            }

            // Use the current P1 path for hashing and saving
            const coursePathToSave = [...gameStates.player1Path]; // Create a copy
            const courseId = hashPath(coursePathToSave);
            const courseName = `Rata ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;

            const newCourseData = {
                id: courseId,
                name: courseName,
                player1Path: coursePathToSave,
                highScore: 0, // No high score yet
                highScorePlayer2Path: [] // No P2 path yet
            };

            try {
                let savedCourses = JSON.parse(localStorage.getItem('savedCourses') || '[]');
                const existingCourseIndex = savedCourses.findIndex(course => course.id === courseId);

                if (existingCourseIndex !== -1) {
                    // Course with this exact path already exists
                    alert("Tämä rata on jo tallennettu.");
                    saveButton.textContent = 'Jo tallennettu';
                    setTimeout(() => { saveButton.textContent = 'Tallenna rata'; }, 1500);
                } else {
                    // --- Add new course ---
                    savedCourses.push(newCourseData);
                    localStorage.setItem('savedCourses', JSON.stringify(savedCourses));
                    console.log(`P1 course saved: ${newCourseData.name}`, newCourseData);

                    // Provide feedback on the button
                    saveButton.textContent = 'Tallennettu!';
                    saveButton.disabled = true;
                    setTimeout(() => {
                        saveButton.textContent = 'Tallenna rata';
                        saveButton.disabled = false;
                    }, 1500);

                    // If the sidebar is open, refresh it
                    if (savedCoursesSidebar.classList.contains('visible')) {
                        populateSavedCoursesSidebar();
                    }
                }
            } catch (error) {
                console.error("Error saving P1 course to localStorage:", error);
                alert("Radan tallentamisessa tapahtui virhe.");
            }
        }
        // Handle victory screen saving (only for new courses)
        else if (gameStates.gameState === GAME_STATES.SHOWING_SCORE) {
            if (!gameStates.smoothedPath || gameStates.smoothedPath.length < 2) {
                console.error("Cannot save: No valid Player 1 path exists.");
                alert("Rataa ei voi tallentaa, koska Pelaaja 1:n polkua ei ole piirretty kunnolla.");
                return;
            }

            try {
                let savedCourses = JSON.parse(localStorage.getItem('savedCourses') || '[]');

                // Only handle saving new courses - highscores are updated automatically
                if (!window.currentLoadedCourseId) {
                    const courseId = hashPath(gameStates.smoothedPath);
                    const courseName = `Rata ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
                    const newCourseData = {
                        id: courseId,
                        name: courseName,
                        player1Path: gameStates.smoothedPath,
                        highScore: gameStates.currentSessionHighScore,
                        highScorePlayer2Path: gameStates.currentSessionBestPlayer2Path
                    };

                    const existingCourseIndex = savedCourses.findIndex(course => course.id === courseId);
                    if (existingCourseIndex === -1) {
                        savedCourses.push(newCourseData);
                        localStorage.setItem('savedCourses', JSON.stringify(savedCourses));
                        saveButton.textContent = 'Tallennettu!';
                        saveButton.disabled = true;
                    } else {
                        saveButton.textContent = 'Rata jo tallennettu';
                        saveButton.disabled = true;
                    }

                    // If sidebar is open, refresh it
                    if (savedCoursesSidebar.classList.contains('visible')) {
                        populateSavedCoursesSidebar();
                    }
                }
            } catch (error) {
                console.error("Error saving course:", error);
                alert("Radan tallentamisessa tapahtui virhe.");
                saveButton.textContent = 'Tallennus epäonnistui';
                saveButton.disabled = false;
            }
        }
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

        redrawAllHelper();

        // Clear particles
        gameStates.activeParticles = [];

        // Cancel particle animation if running
        if (gameStates.particleAnimationFrame) {
            cancelAnimationFrame(gameStates.particleAnimationFrame);
            gameStates.particleAnimationFrame = null;
        }
    };

    const openSidebar = () => {
        populateSavedCoursesSidebar(); // Load content when opening
        savedCoursesSidebar.classList.add('visible');
        document.body.classList.add('body-sidebar-open'); // Updated class name
    };

    const closeSidebar = () => {
        savedCoursesSidebar.classList.remove('visible');
        document.body.classList.remove('body-sidebar-open'); // Updated class name
    };

    const showTrashCan = () => {
        trashCan.style.display = 'block';
    };

    const hideTrashCan = () => {
        trashCan.style.display = 'none';
        trashCan.classList.remove('active-drop'); // Remove hover effect
    };

    const getStarRatingHTML = (score) => {
        const maxStars = 5;
        let stars = 0;
        // sourcery skip: use-braces
        if (score >= 90) stars = 5;
        else if (score >= 80) stars = 4;
        else if (score >= 70) stars = 3;
        else if (score >= 60) stars = 2;
        else if (score >= 50) stars = 1;

        let html = '';
        for (let i = 0; i < stars; i++) {
            html += '⭐'; // Full star
        }
        for (let i = stars; i < maxStars; i++) {
            // html += '☆'; // Outline star (optional)
        }
        return html;
    };

    const drawThumbnail = (canvasElement, path) => {
        const thumbCtx = canvasElement.getContext('2d');
        const { width, height } = canvasElement;

        thumbCtx.clearRect(0, 0, width, height);

        if (!path || path.length < 2) {
            return;
        }

        // Find path bounds
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        path.forEach(p => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        });

        const pathWidth = maxX - minX;
        const pathHeight = maxY - minY;

        // Handle cases where path is a point or a straight vertical/horizontal line
        const effectivePathWidth = pathWidth === 0 ? 1 : pathWidth; // Give it minimal width/height if zero
        const effectivePathHeight = pathHeight === 0 ? 1 : pathHeight;

        // Calculate scale to fit within padded area
        const availableWidth = width - 2 * THUMBNAIL_PADDING;
        const availableHeight = height - 2 * THUMBNAIL_PADDING;
        // Ensure available dimensions are positive
        if (availableWidth <= 0 || availableHeight <= 0) {
            return;
        }

        const scale = Math.min(availableWidth / effectivePathWidth, availableHeight / effectivePathHeight);

        // Calculate translation to center the scaled path
        const scaledWidth = effectivePathWidth * scale;
        const scaledHeight = effectivePathHeight * scale;
        const offsetX = THUMBNAIL_PADDING + (availableWidth - scaledWidth) / 2;
        const offsetY = THUMBNAIL_PADDING + (availableHeight - scaledHeight) / 2;
        // Adjust translation based on the original min points and the calculated scale/offset
        const translateX = offsetX - minX * scale;
        const translateY = offsetY - minY * scale;

        // Draw the scaled path
        thumbCtx.strokeStyle = P1_COLOR;
        thumbCtx.lineWidth = 5; // Increased line width to match marker size visually
        thumbCtx.lineCap = 'round';
        thumbCtx.lineJoin = 'round';
        thumbCtx.beginPath();
        thumbCtx.moveTo(path[0].x * scale + translateX, path[0].y * scale + translateY);
        for (let i = 1; i < path.length; i++) {
            thumbCtx.lineTo(path[i].x * scale + translateX, path[i].y * scale + translateY);
        }
        thumbCtx.stroke();

        // Draw start/end markers (size remains 5)
        thumbCtx.fillStyle = START_COLOR;
        thumbCtx.beginPath();
        thumbCtx.arc(path[0].x * scale + translateX, path[0].y * scale + translateY, 5, 0, Math.PI * 2);
        thumbCtx.fill();

        // Ensure there's a distinct end point before drawing the end marker
        if (path.length > 1) {
            thumbCtx.fillStyle = END_COLOR;
            thumbCtx.beginPath();
            thumbCtx.arc(path[path.length - 1].x * scale + translateX, path[path.length - 1].y * scale + translateY, 5, 0, Math.PI * 2);
            thumbCtx.fill();
        }
    };

    // Update the populateSavedCoursesSidebar function to add the touch handler
    const populateSavedCoursesSidebar = () => {
        sidebarContent.innerHTML = '';
        try {
            const savedCourses = JSON.parse(localStorage.getItem('savedCourses') || '[]');
            if (savedCourses.length === 0) {
                sidebarContent.innerHTML = '<p style="text-align: center; color: #666;">Ei tallennettuja ratoja.</p>';
                return;
            }

            savedCourses.forEach(course => {
                if (!course || !course.id || !course.player1Path) {
                    console.warn("Skipping invalid course data:", course);
                    return;
                }

                const container = document.createElement('div');
                container.className = 'thumbnail-container';
                container.draggable = true;
                container.dataset.courseId = course.id;

                // Improved touch handling
                let touchStartTime = 0;
                let touchStartX = 0;
                let touchStartY = 0;
                let isTapping = false;
                let isScrolling = false;

                container.addEventListener('touchstart', (e) => {
                    touchStartTime = Date.now();
                    touchStartX = e.touches[0].clientX;
                    touchStartY = e.touches[0].pageY;
                    isTapping = true;
                    isScrolling = false;
                }, { passive: true });

                container.addEventListener('touchmove', (e) => {
                    if (!isTapping) {
                        return;
                    }

                    const touchCurrentX = e.touches[0].clientX;
                    const touchCurrentY = e.touches[0].pageY;
                    const deltaX = Math.abs(touchCurrentX - touchStartX);
                    const deltaY = Math.abs(touchCurrentY - touchStartY);

                    // If vertical movement is greater, it's probably a scroll
                    if (deltaY > deltaX && deltaY > 10) {
                        isScrolling = true;
                        isTapping = false;
                    }
                    // If horizontal movement is greater, might be trying to drag
                    else if (deltaX > deltaY && deltaX > 10) {
                        isTapping = false;
                        // Could initiate drag here if needed
                    }
                }, { passive: true });

                container.addEventListener('touchend', (e) => {
                    if (isScrolling || !isTapping) {
                        return;
                    }

                    const touchEndTime = Date.now();
                    const touchEndX = e.changedTouches[0].clientX;
                    const touchEndY = e.changedTouches[0].pageY;

                    const touchDuration = touchEndTime - touchStartTime;
                    const touchDistance = Math.sqrt(
                        Math.pow(touchEndX - touchStartX, 2) +
                        Math.pow(touchEndY - touchStartY, 2)
                    );

                    // If it was a quick tap with minimal movement
                    if (touchDuration < 200 && touchDistance < 10) {
                        loadCourse(course);
                    }

                    isTapping = false;
                }, { passive: true });

                // Rest of the container setup...
                const canvasEl = document.createElement('canvas');
                canvasEl.className = 'thumbnail-canvas';
                canvasEl.width = THUMBNAIL_WIDTH;
                canvasEl.height = THUMBNAIL_HEIGHT;

                const starsEl = document.createElement('div');
                starsEl.className = 'thumbnail-stars';
                starsEl.innerHTML = getStarRatingHTML(course.highScore || 0);

                container.appendChild(canvasEl);
                container.appendChild(starsEl);
                sidebarContent.appendChild(container);

                // Draw after appending
                drawThumbnail(canvasEl, course.player1Path);

                // Drag handlers
                container.addEventListener('dragstart', (e) => {
                    e.target.classList.add('dragging');
                    handleThumbnailDragStart(e);
                });

                container.addEventListener('dragend', (e) => {
                    e.target.classList.remove('dragging');
                    handleThumbnailDragEnd(e);
                });
            });

        } catch (error) {
            console.error("Error loading saved courses for sidebar:", error);
            sidebarContent.innerHTML = '<p style="color: red;">Radan lataus epäonnistui.</p>';
        }
    };

    // --- Course Loading/Deleting ---

    const loadCourse = (courseData) => {
        if (!courseData || !courseData.player1Path) {
            console.error("Invalid course data provided for loading.");
            return;
        }
        console.log(`Loading course: ${courseData.name} (ID: ${courseData.id})`);

        // Reset current game state partially (like resetGame but keep sidebar open?)
        // Hide screens first
        document.getElementById('victoryScreen').style.display = 'none';
        document.getElementById('defeatScreen').style.display = 'none';

        // Reset relevant state vars
        gameStates.player1Path = courseData.player1Path; // Use the loaded path
        gameStates.smoothedPath = [...gameStates.player1Path]; // Set smoothedPath as well (assuming raw path is used)
        gameStates.player2Path = [];
        gameStates.isDrawing = false;
        gameStates.lastPlayedProgressMilestone = 0;
        gameStates.startMarker = null; // Will be recalculated
        gameStates.endMarker = null;   // Will be recalculated
        gameStates.progressMarkers = [];
        gameStates.currentActiveSegmentIndex = 0;
        gameStates.maxAllowedPathLength = 0;
        gameStates.currentPathLength = 0;
        gameStates.fuelConsumed = 0;
        gameStates.previousCarPosition = null;
        gameStates.defeatFlagged = false;
        gameStates.carConfig = null;

        // Generate decorations for the loaded path
        const decorationDensity = 5; // Same density as when P1 finishes drawing
        const decorationOffset = P1_WIDTH * 1.5; // Same offset as when P1 finishes

        // First generate all decorations
        let allDecorations = generateDecorationsForPath(gameStates.player1Path, decorationDensity, decorationOffset);

        // Then filter out decorations that are too close to the path
        const minDistanceToPath = P1_WIDTH * 1.2; // Same threshold as used during P1 drawing
        gameStates.decorations = allDecorations.filter(decoration => {
            // Check distance to all path segments
            for (let i = 0; i < gameStates.player1Path.length - 1; i++) {
                const segmentStart = gameStates.player1Path[i];
                const segmentEnd = gameStates.player1Path[i + 1];
                const distance = pointLineSegmentDistance(decoration.position, segmentStart, segmentEnd);
                if (distance < minDistanceToPath) {
                    return false; // Remove decoration if too close to any segment
                }
            }
            return true; // Keep decoration if it's far enough from all segments
        });

        gameStates.tireMarks = [];

        // IMPORTANT: Set the session high score from the loaded course
        gameStates.currentSessionHighScore = courseData.highScore || 0;
        gameStates.currentSessionBestPlayer2Path = courseData.highScorePlayer2Path || [];

        // Update controls visibility
        doneButton.style.display = 'none'; // P1 is done by loading
        saveCourseButton.style.display = 'none'; // Hide P1 save button too
        resetButton.style.display = 'inline-block';

        // Stop any ongoing car animation/sound
        if (gameStates.carAnimationFrame) {
            cancelAnimationFrame(gameStates.carAnimationFrame);
            gameStates.carAnimationFrame = null;
        }
        if (gameStates.engineSound) {
            gameStates.engineSound.stop();
            gameStates.engineSound = null;
        }
        gameStates.carProgress = 0;
        gameStates.carPosition = { x: 0, y: 0 };
        gameStates.carAngle = 0;
        gameStates.carTrail = [];
        gameStates.isScreeching = false;

        // Now, trigger the logic similar to handleP1Done to set up P2 phase
        // This recalculates markers, length, decorations based on the loaded player1Path
        handleP1Done(); // This sets gameState.gameState to 'P2_WAITING' and redraws

        closeSidebar(); // Close sidebar after loading
        statusDiv.textContent = `Ladattu rata: ${courseData.name}. Pelaaja 2: Seuraa polkua.`;

        // Add tracking of loaded course ID
        window.currentLoadedCourseId = courseData.id;
    };

    const deleteCourse = (courseId) => {
        if (!courseId) {
            return;
        }
        console.log(`Attempting to delete course: ${courseId}`);
        try {
            let savedCourses = JSON.parse(localStorage.getItem('savedCourses') || '[]');
            const initialLength = savedCourses.length;
            savedCourses = savedCourses.filter(course => course.id !== courseId);

            if (savedCourses.length < initialLength) {
                localStorage.setItem('savedCourses', JSON.stringify(savedCourses));
                console.log(`Course ${courseId} deleted.`);
                // Refresh the sidebar to remove the thumbnail visually
                populateSavedCoursesSidebar();
                return true; // Indicate success
            } else {
                console.warn(`Course ${courseId} not found for deletion.`);
                return false;
            }
        } catch (error) {
            console.error("Error deleting course:", error);
            alert("Radan poistaminen epäonnistui.");
            return false;
        }
    };

    // --- Drag and Drop Handlers ---

    const handleThumbnailDragStart = (e) => {
        // Check if it's a valid thumbnail container
        if (e.target.classList.contains('thumbnail-container')) {
            gameStates.draggedCourseId = e.target.dataset.courseId;
            e.dataTransfer.setData('text/plain', gameStates.draggedCourseId);
            e.dataTransfer.effectAllowed = 'move'; // Indicate moving is allowed
            showTrashCan(); // Show trashcan when dragging starts
            // Optional: Add a dragging style to the thumbnail
            e.target.style.opacity = '0.5';
        } else {
            e.preventDefault(); // Prevent dragging if not the container
        }
    };

    const handleThumbnailDragEnd = (e) => {
        // Check if it's a valid thumbnail container ending drag
        if (e.target.classList.contains('thumbnail-container')) {
            // Restore appearance
            e.target.style.opacity = '1';
            hideTrashCan(); // Always hide trashcan when drag ends
            gameStates.draggedCourseId = null; // Clear the dragged ID
        }
    };

    const handleCanvasDragOver = (e) => {
        e.preventDefault(); // Necessary to allow dropping
        e.dataTransfer.dropEffect = 'move'; // Indicate dropping is possible
        // Optional: Add visual feedback to canvas (e.g., border)
    };

    const handleCanvasDrop = (e) => {
        e.preventDefault();
        const courseId = e.dataTransfer.getData('text/plain');
        if (courseId) {
            try {
                const savedCourses = JSON.parse(localStorage.getItem('savedCourses') || '[]');
                const courseToLoad = savedCourses.find(c => c.id === courseId);
                if (courseToLoad) {
                    loadCourse(courseToLoad);
                } else {
                    console.error(`Course with ID ${courseId} not found in localStorage.`);
                }
            } catch (error) {
                console.error("Error loading course on drop:", error);
            }
        }
        hideTrashCan();
    };

    const handleTrashDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        trashCan.classList.add('active-drop');
    };

    const handleTrashDragLeave = (e) => {
        trashCan.classList.remove('active-drop');
    };

    const handleTrashDrop = (e) => {
        e.preventDefault();
        const courseId = e.dataTransfer.getData('text/plain');
        if (courseId) {
            // Optional: Add a confirmation dialog
            // if (confirm(`Haluatko varmasti poistaa tämän radan?`)) {
            deleteCourse(courseId);
            // }
        }
        hideTrashCan();
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

        // Initialize previous position on the first frame
        if (gameStates.previousCarPosition === null) {
            gameStates.previousCarPosition = { ...gameStates.carPosition };
            gameStates.previousCarAngle = gameStates.currentCarAngle; // Initialize previous angle too
        }

        // --- Car Movement Calculation ---
        // Calculate curvature, speed etc. based on the path the car is ACTUALLY following (player2Path)
        const currentCurvature = calculateCurvature(gameStates.carProgress, gameStates.player2Path);
        const upcomingProgress = Math.min(1, gameStates.carProgress + CURVE_LOOK_AHEAD);
        const upcomingCurvature = calculateCurvature(upcomingProgress, gameStates.player2Path);
        const targetSpeedMultiplier = getSpeedMultiplier(currentCurvature);
        let targetSpeed = CAR_PIXEL_SPEED * targetSpeedMultiplier;

        // --- (Speed adjustment near finish - might need rethinking if P1/P2 lengths differ significantly) ---
        const distanceToFinish = 1 - gameStates.carProgress;
        if (distanceToFinish < FINISH_PREPARATION_DISTANCE) {
            const finishFactor = distanceToFinish / FINISH_PREPARATION_DISTANCE;
            const minSpeed = CAR_PIXEL_SPEED * MIN_FINISH_SPEED;
            targetSpeed = minSpeed + (targetSpeed - minSpeed) * finishFactor;
        }

        const decelerationRate = getDecelerationRate(currentCurvature, upcomingCurvature);

        if (targetSpeed > gameStates.currentSpeed) {
            const speedDiff = targetSpeed - gameStates.currentSpeed;
            const accelerationRate = ACCELERATION_RATE * (1 + speedDiff / CAR_PIXEL_SPEED);
            gameStates.currentSpeed = Math.min(targetSpeed, gameStates.currentSpeed + CAR_PIXEL_SPEED * accelerationRate);
        } else {
            gameStates.currentSpeed = Math.max(targetSpeed, gameStates.currentSpeed - CAR_PIXEL_SPEED * decelerationRate);
        }

        // Calculate next progress BEFORE updating angles
        const progressIncrement = (gameStates.currentSpeed / gameStates.player1TotalLength);
        const nextProgress = gameStates.carProgress + progressIncrement;

        // --- Calculate Target Steering and Update Wheel Angle ---
        const lookAheadDistance = 0.05; // How far ahead on the path to look for steering target (adjust as needed)
        const targetPoint = getPointAlongPath(Math.min(1, gameStates.carProgress + lookAheadDistance), gameStates.player2Path);
        const angleToTarget = Math.atan2(targetPoint.y - gameStates.carPosition.y, targetPoint.x - gameStates.carPosition.x);

        let steeringAngle = angleToTarget - gameStates.currentCarAngle;
        // Normalize the steering angle difference to [-PI, PI]
        steeringAngle = ((steeringAngle + Math.PI) % (2 * Math.PI)) - Math.PI;

        // Gradually adjust wheel angle towards the required steering angle
        const wheelAngleDiff = steeringAngle - gameStates.currentWheelAngle;
        gameStates.currentWheelAngle += Math.sign(wheelAngleDiff) * Math.min(Math.abs(wheelAngleDiff), WHEEL_TURN_SPEED);
        // Clamp wheel angle
        gameStates.currentWheelAngle = Math.max(-MAX_WHEEL_ANGLE, Math.min(MAX_WHEEL_ANGLE, gameStates.currentWheelAngle));

        // --- Update Car Angle (Heading) based on Physics ---
        let deltaAngle = 0;
        if (gameStates.isSkidding) {
            // Apply rapid rotation based on steering input during skid
            deltaAngle = steeringAngle * SKID_TURN_RATE_MULTIPLIER;
        }
        else if (Math.abs(gameStates.currentWheelAngle) > 0.01 && WHEELBASE > 0) {
            const dt = CAR_ANIMATION_INTERVAL / 1000;
            const speedPixelsPerSecond = gameStates.currentSpeed * (1000 / CAR_ANIMATION_INTERVAL);
            deltaAngle = (speedPixelsPerSecond * Math.tan(gameStates.currentWheelAngle) / WHEELBASE) * dt;
        }
        gameStates.currentCarAngle += deltaAngle;
        gameStates.currentCarAngle = ((gameStates.currentCarAngle + Math.PI) % (2 * Math.PI)) - Math.PI; // Normalize


        // --- Fuel Check ---
        // Get the next position based on path progress
        const nextPos = getPointAlongPath(nextProgress, gameStates.player2Path); // Use nextProgress calculated earlier
        const distanceMoved = dist(gameStates.carPosition, nextPos); // Use distance based on path progression

        // Check if this next move would exceed fuel limit
        if (checkFuelLimit(gameStates.carPosition, distanceMoved, false)) {
            // Stop the car immediately
            if (gameStates.carAnimationFrame) {
                cancelAnimationFrame(gameStates.carAnimationFrame);
                gameStates.carAnimationFrame = null;
            }

            // Stop engine sound
            if (gameStates.engineSound) {
                gameStates.engineSound.stop(); // Call the stop method provided by createV8EngineSound
                gameStates.engineSound = null;
            }

            // Set timeout to show defeat screen after 1 second
            setTimeout(() => {
                gameStates.gameState = GAME_STATES.SHOWING_SCORE;
                drawFailState();
            }, 1000);

            return; // Exit the animation function
        }

        // --- Update Car State ---
        gameStates.previousCarPosition = { ...gameStates.carPosition };
        gameStates.carPosition = nextPos; // Position follows the path precisely
        gameStates.carProgress = nextProgress;
        gameStates.carTrail.push({ ...gameStates.carPosition });
        gameStates.fuelConsumed += distanceMoved; // Fuel consumption based on distance moved along path

        // --- Update Sounds and Tire Marks (Adjust screeching condition) ---

        // Determine if the car should be screeching based on angle change rate and speed
        // Higher threshold for deltaAngle, maybe combine with speed?
        const turnRateThreshold = 0.03; // Radians change per frame threshold (adjust)
        const speedThreshold = CAR_PIXEL_SPEED * 0.5; // Minimum speed to screech
        // Force screeching if skidding, otherwise use normal logic
        const shouldBeScreeching = gameStates.isSkidding || (Math.abs(deltaAngle) > turnRateThreshold && gameStates.currentSpeed > speedThreshold);

        // Check if screeching just started
        if (shouldBeScreeching && !gameStates.isScreeching) {
            playSound('screech');
        }

        // Update the screeching state for the current frame
        gameStates.isScreeching = shouldBeScreeching;

        // Add tire marks if currently screeching
        if (gameStates.isScreeching) {
            // --- Add Tire Marks --- (Keep this logic, uses currentCarAngle which is now updated differently)
            const carWidth = CAR_CONSTANTS?.WIDTH || 15;
            const carLength = CAR_CONSTANTS?.HEIGHT || 25;
            const halfW = carWidth / 2;
            const halfL = carLength / 2;

            const tireOffsets = [
                { x: halfW, y: -halfL }, { x: -halfW, y: -halfL },
                { x: halfW, y: halfL }, { x: -halfW, y: halfL }
            ];

            const calculateTirePositions = (centerPos, angle) => {
                const cosA = Math.cos(angle);
                const sinA = Math.sin(angle);
                return tireOffsets.map(offset => {
                    const rotatedX = offset.x * cosA - offset.y * sinA;
                    const rotatedY = offset.x * sinA + offset.y * cosA;
                    return { x: centerPos.x + rotatedX, y: centerPos.y + rotatedY };
                });
            };

            const currentTirePositions = calculateTirePositions(gameStates.carPosition, gameStates.currentCarAngle);
            if (gameStates.previousCarPosition && gameStates.previousCarAngle !== undefined) {
                const previousTirePositions = calculateTirePositions(gameStates.previousCarPosition, gameStates.previousCarAngle);

                for (let i = 0; i < 4; i++) {
                    if (distSq(previousTirePositions[i], currentTirePositions[i]) > 0.1) {
                        gameStates.tireMarks.push({
                            start: previousTirePositions[i],
                            end: currentTirePositions[i]
                        });
                    }
                }
            }
        }

        // Store current angle as previous for the next frame
        gameStates.previousCarAngle = gameStates.currentCarAngle; // Keep tracking for tire marks

        // --- Engine Sound --- (Keep as is)
        if (!gameStates.engineSound) {
            gameStates.engineSound = playSound('engine');
        } else {
            gameStates.engineSound.updateSpeed(gameStates.currentSpeed, CAR_PIXEL_SPEED);
        }

        // --- Redraw and Continue --- (Keep as is)
        redrawAll();

        // --- Finish Line Check --- (Keep as is)
        // Check only if not already in the finishing delay phase
        if (!gameStates.isFinishing && gameStates.carProgress >= 1) {
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
                gameStates.engineSound.stop(); // Call the stop method provided by createV8EngineSound
                gameStates.engineSound = null;
            }

            // Cancel future animation frames
            if (gameStates.carAnimationFrame) {
                cancelAnimationFrame(gameStates.carAnimationFrame);
                gameStates.carAnimationFrame = null;
            }

            // Perform one final redraw to show the car at the finish line
            redrawAll();
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

    const simpleHash = (str) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = char + (hash << 6) + (hash << 16) - hash;
        }
        // Convert to a positive hexadecimal string prefixed with 'h_'
        return `h_${(hash >>> 0).toString(16)}`;
    };

    const hashPath = (path) => {
        if (!path || path.length === 0) {
            return 'h_empty';
        }
        // Stringify with fixed precision to handle floating point variations
        const pathString = JSON.stringify(path.map(p => ({ x: p.x.toFixed(3), y: p.y.toFixed(3) })));
        return simpleHash(pathString);
    };

    doneButton.style.display = 'none'; // P1 is done by loading
    saveCourseButton.style.display = 'none'; // Hide P1 save button too
    resetButton.style.display = 'inline-block';

    const animateParticles = () => {
        // Clear the canvas and redraw everything
        redrawAll();

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
            redrawAll();
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
