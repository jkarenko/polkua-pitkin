// Car constants
const CAR_WIDTH = 50;
const CAR_HEIGHT = 20;
const CAR_COLOR = '#FF4444';

/**
 * Draws a car at the specified position and angle
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context
 * @param {Object} position - The position of the car {x, y}
 * @param {number} angle - The angle of the car in radians
 * @param {number} wheelAngle - The current wheel angle in radians
 */
export function drawCar(ctx, position, angle, wheelAngle) {
    ctx.save();
    ctx.translate(position.x, position.y);
    ctx.rotate(angle);

    // Draw wheels with rotation
    drawWheels(ctx, wheelAngle);

    // Draw car body
    drawCarBody(ctx);

    // Draw car roof
    drawCarRoof(ctx);

    // Draw windows
    drawWindows(ctx);

    // Draw headlights
    drawHeadlights(ctx);

    ctx.restore();
}

function drawWheels(ctx, wheelAngle) {
    // Front wheels (with rotation)
    ctx.save();
    ctx.translate(CAR_WIDTH / 2 - 10, -CAR_HEIGHT / 2);
    ctx.rotate(wheelAngle);
    ctx.fillStyle = '#000';
    ctx.fillRect(-5, -1, 10, 2);
    ctx.restore();

    ctx.save();
    ctx.translate(CAR_WIDTH / 2 - 10, CAR_HEIGHT / 2);
    ctx.rotate(wheelAngle);
    ctx.fillStyle = '#000';
    ctx.fillRect(-5, -1, 10, 2);
    ctx.restore();

    // Rear wheels (static)
    ctx.fillStyle = '#000';
    ctx.fillRect(-CAR_WIDTH / 2 + 8, -CAR_HEIGHT / 2 - 1, 10, 2);
    ctx.fillRect(-CAR_WIDTH / 2 + 8, CAR_HEIGHT / 2 - 1, 10, 2);
}

function drawCarBody(ctx) {
    ctx.fillStyle = CAR_COLOR;
    ctx.fillRect(-CAR_WIDTH / 2, -CAR_HEIGHT / 2, CAR_WIDTH, CAR_HEIGHT);
}

function drawCarRoof(ctx) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';  // Use black with 15% opacity
    ctx.fillRect(-CAR_WIDTH / 4, -CAR_HEIGHT / 2, CAR_WIDTH / 2, CAR_HEIGHT);
    ctx.globalCompositeOperation = 'source-over';  // Reset to default blend mode
}

function drawWindows(ctx) {
    ctx.fillStyle = '#4a90e2';  // Light blue color for windows

    // Rear windshield
    ctx.beginPath();
    ctx.moveTo(-CAR_WIDTH / 4, -CAR_HEIGHT / 2 + 3);
    ctx.lineTo(-CAR_WIDTH / 4, CAR_HEIGHT / 2 - 3);
    ctx.lineTo(-CAR_WIDTH / 2 + 4, CAR_HEIGHT / 2);
    ctx.lineTo(-CAR_WIDTH / 2 + 4, -CAR_HEIGHT / 2);
    ctx.closePath();
    ctx.fill();

    // Front windshield
    ctx.beginPath();
    ctx.moveTo(CAR_WIDTH / 4, -CAR_HEIGHT / 2);
    ctx.lineTo(CAR_WIDTH / 4, CAR_HEIGHT / 2);
    ctx.lineTo(CAR_WIDTH / 4 - 3, CAR_HEIGHT / 2 - 5);
    ctx.lineTo(CAR_WIDTH / 4 - 3, -CAR_HEIGHT / 2 + 5);
    ctx.closePath();
    ctx.fill();

    // Side windows - Left side
    drawSideWindows(ctx, -1); // Draw left side windows

    // Side windows - Right side
    drawSideWindows(ctx, 1);  // Draw right side windows
}

function drawSideWindows(ctx, side) {
    const yOffset = (CAR_HEIGHT / 2) * side;

    // Front door window
    ctx.beginPath();
    ctx.moveTo(-CAR_WIDTH / 4, yOffset);
    ctx.lineTo(0, yOffset);
    ctx.lineTo(0 - 3, yOffset - 3 * side);
    ctx.lineTo(-CAR_WIDTH / 4 + 3, yOffset - 3 * side);
    ctx.closePath();
    ctx.fill();

    // Back door window
    ctx.beginPath();
    ctx.moveTo(0, yOffset);
    ctx.lineTo(CAR_WIDTH / 4, yOffset);
    ctx.lineTo(CAR_WIDTH / 4 - 3, yOffset - 3 * side);
    ctx.lineTo(0 - 3, yOffset - 3 * side);
    ctx.closePath();
    ctx.fill();
}

function drawHeadlights(ctx) {
    ctx.fillStyle = '#FFF';
    ctx.fillRect(CAR_WIDTH / 2 - 2, -CAR_HEIGHT / 2 + 1, 3, 5);    // Left headlight
    ctx.fillRect(CAR_WIDTH / 2 - 2, CAR_HEIGHT / 2 - 6, 3, 5);     // Right headlight
}

// Export constants that might be needed by other modules
export const CAR_CONSTANTS = {
    WIDTH: CAR_WIDTH,
    HEIGHT: CAR_HEIGHT,
    COLOR: CAR_COLOR
}; 
