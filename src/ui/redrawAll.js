// Function to redraw all elements on the canvas
export const redrawAll = (
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
) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw base P1 path elements (always behind everything else)
    if (gameStates.startMarker && gameStates.endMarker) {
        drawPath(ctx, gameStates.player1Path, P1_COLOR, P1_WIDTH, false, P1_COLOR);
        drawCircle(ctx, gameStates.startMarker, gameStates.startMarker.radius, START_COLOR);
        drawCircle(ctx, gameStates.endMarker, gameStates.endMarker.radius, END_COLOR);
        gameStates.progressMarkers.slice(1, -1).forEach(marker => {
            drawDirectionalMarker(ctx, marker.point, marker.direction, 'rgba(0, 0, 0, 0.3)', P1_WIDTH);
        });
    } else if (gameStates.player1Path.length > 0) {
        drawPath(ctx, gameStates.player1Path, P1_COLOR, P1_WIDTH, gameStates.gameState === GAME_STATES.P1_DRAWING, P1_COLOR);
    }

    // 2. Draw the car trail if animating or finished (behind decorations and car)
    // Draw the trail even when finished/showing score
    if ((gameStates.gameState === GAME_STATES.CAR_ANIMATING || gameStates.gameState === GAME_STATES.SHOWING_SCORE || gameStates.gameState.isFinishing) && gameStates.carTrail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(gameStates.carTrail[0].x, gameStates.carTrail[0].y);
        for (let i = 1; i < gameStates.carTrail.length; i++) {
            ctx.lineTo(gameStates.carTrail[i].x, gameStates.carTrail[i].y);
        }
        ctx.strokeStyle = 'rgba(255, 68, 68, 0.5)'; // Red trail color
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
    }

    // 2.5 Draw Tire Marks (after trail, before decorations/car)
    // Draw tire marks even when finished/showing score
    if (gameStates.gameState === GAME_STATES.CAR_ANIMATING || gameStates.gameState === GAME_STATES.SHOWING_SCORE || gameStates.gameState.isFinishing) {
        ctx.strokeStyle = 'rgba(40, 40, 40, 0.7)'; // Dark semi-transparent color for lines
        ctx.lineWidth = 3; // Width of the tire mark lines
        ctx.lineCap = 'round'; // Make line ends rounded
        gameStates.tireMarks.forEach(mark => {
            if (mark.start && mark.end) { // Ensure we have both points
                ctx.beginPath();
                ctx.moveTo(mark.start.x, mark.start.y);
                ctx.lineTo(mark.end.x, mark.end.y);
                ctx.stroke();
            }
        });
    }

    // 3. Create a list of drawable items (decorations, P2 path, car)
    let drawableItems = [...gameStates.decorations]; // Start with decorations

    // Add ONLY the Car sprite wrapper if animating OR finished/showing score
    if ((gameStates.gameState === GAME_STATES.CAR_ANIMATING || gameStates.gameState === GAME_STATES.SHOWING_SCORE || gameStates.gameState.isFinishing) && gameStates.carPosition) {
        drawableItems.push({
            getLowestY: () => {
                const carHeight = CAR_CONSTANTS?.HEIGHT || 20;
                return gameStates.carPosition.y + carHeight / 2;
            },
            draw: (context) => {
                // Only draw the car sprite here
                drawCar(context, gameStates.carPosition, gameStates.currentCarAngle, gameStates.currentWheelAngle, gameStates.carConfig || { color: '#FF4444' });
            }
        });
    }

    // 4. Sort all drawable items by their lowest Y coordinate
    drawableItems = drawableItems.filter(item => item && typeof item.getLowestY === 'function' && typeof item.draw === 'function');
    drawableItems.sort((a, b) => a.getLowestY() - b.getLowestY());

    // 5. Draw the sorted items (decorations, car)
    drawableItems.forEach(item => item.draw(ctx));

    // 6. Draw UI elements last (on top of everything)
    drawFuelGauge(ctx, canvas, gameStates.gameState, gameStates.fuelConsumed, gameStates.currentPathLength, gameStates.maxAllowedPathLength, gameStates.defeatFlagged, GAME_STATES, MAX_PATH_LENGTH_FACTOR);
};