// Input handling functionality extracted from game.js
import { pointLineSegmentDistance, isPointWithinPath, getProgressAlongPath, calculatePathLength } from './core/path.js';
import { generateDecorationsAlongSegment } from './decoration.js';
import { playSound } from './audio.js';
import { drawPath } from './ui/drawPath.js';
import { drawFailState } from './ui/drawFailState.js';

export function createInputHandler(gameStates, canvas, ctx, doneButton, resetButton, statusDiv, 
                                  saveCourseButton, savedCoursesButton, GAME_STATES, redrawAllHelper, 
                                  P1_COLOR, P1_WIDTH, P2_COLOR, P2_WIDTH, smoothPath, createCar, animateCar) {

    // Helper function to get event coordinates
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

    // Handle P1 done button click
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

        // Use the raw P1 path
        gameStates.smoothedPath = gameStates.player1Path;

        // Calculate progress markers
        calculateProgressMarkers(gameStates);

        redrawAllHelper();
    };

    // Calculate progress markers based on the original player1Path length
    const calculateProgressMarkers = (gameStates) => {
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
    };

    // Helper function for distance calculation
    const dist = (p1, p2) => {
        return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
    };

    // Reset player 2's state
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

    // Check fuel limit
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
            return true; // Indicates defeat
        }
        return false; // Indicates no defeat
    };

    // Handle start of drawing (mousedown/touchstart)
    const handleStart = (e) => {
        if (e.touches && e.touches.length > 1) {
            return;
        }
        e.preventDefault();

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

    // Handle drawing movement (mousemove/touchmove)
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
            const currentMilestone = Math.floor(currentProgress / gameStates.PROGRESS_INTERVAL);

            if (currentMilestone > gameStates.lastPlayedProgressMilestone && currentProgress < 1.0) {
                gameStates.lastPlayedProgressMilestone = currentMilestone;
                playSound('chime', currentProgress);
            }
        }
    };

    // Handle end of drawing (mouseup/touchend)
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
                    gameStates.player2Path = smoothPath(gameStates.player2Path, gameStates.SMOOTHING_WINDOW);

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

    return {
        getEventCoords,
        handleP1Done,
        dist,
        resetPlayer2,
        checkFuelLimit,
        handleStart,
        handleMove,
        handleEnd
    };
}
