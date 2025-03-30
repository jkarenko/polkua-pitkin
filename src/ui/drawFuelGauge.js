// Function to draw the fuel gauge on the canvas
export const drawFuelGauge = (ctx, canvas, gameState, fuelConsumed, currentPathLength, maxAllowedPathLength, defeatFlagged, GAME_STATES, MAX_PATH_LENGTH_FACTOR) => {
    // Only draw if P2 is drawing or car is animating
    if (gameState !== GAME_STATES.P2_DRAWING && gameState !== GAME_STATES.CAR_ANIMATING) {
        return;
    }

    const gaugeWidth = 200;
    const gaugeHeight = 30;
    const x = canvas.width - gaugeWidth - 20;
    const y = 20;

    ctx.save();

    // Draw background
    ctx.beginPath();
    ctx.roundRect(x, y, gaugeWidth, gaugeHeight, 5);
    ctx.fillStyle = '#ddd';
    ctx.fill();

    // Calculate remaining fuel percentage
    let remainingFuel;
    if (gameState === GAME_STATES.CAR_ANIMATING) {
        // Use actual fuel consumed during animation
        if (defeatFlagged) {
            remainingFuel = Math.max(0, 1 - (fuelConsumed * MAX_PATH_LENGTH_FACTOR / maxAllowedPathLength));
        } else {
            remainingFuel = Math.max(0, 1 - (fuelConsumed / maxAllowedPathLength));
        }
    } else { // gameState === GAME_STATES.P2_DRAWING
        // Use path length drawn so far
        remainingFuel = Math.max(0, 1 - (currentPathLength / maxAllowedPathLength));
    }

    // Draw fuel level
    const gradient = ctx.createLinearGradient(x, y, x + gaugeWidth, y);
    if (remainingFuel > 0.3) {
        gradient.addColorStop(0, '#4CAF50'); gradient.addColorStop(1, '#45a049');
    } else if (remainingFuel > 0.1) {
        gradient.addColorStop(0, '#FFA500'); gradient.addColorStop(1, '#FF8C00');
    } else {
        gradient.addColorStop(0, '#FF4444'); gradient.addColorStop(1, '#CC0000');
    }

    ctx.fillStyle = gradient;
    ctx.beginPath();
    // Ensure fuel bar doesn't go beyond gauge boundaries and handles 0 fuel correctly
    const fuelWidth = Math.max(0, Math.min(gaugeWidth, gaugeWidth * remainingFuel));
    // Need to draw a rectangle from the start, not a rounded one if width is small, or handle corners
    if (fuelWidth > 0) {
        ctx.roundRect(x, y, fuelWidth, gaugeHeight, 5);
        ctx.fill();
    }

    // Draw gauge border using the same path
    ctx.beginPath();
    ctx.roundRect(x, y, gaugeWidth, gaugeHeight, 5);
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw fuel text
    ctx.fillStyle = '#000';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    ctx.fillText(`Polttoaine: ${Math.round(remainingFuel * 100)}%`, x + gaugeWidth / 2, y + gaugeHeight / 2);

    ctx.restore(); // Restores shadow settings etc.
};
