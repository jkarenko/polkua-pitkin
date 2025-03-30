// Function to draw a directional marker (arrow) at a specific point
export const drawDirectionalMarker = (ctx, point, direction, color = 'rgba(0, 0, 0, 0.3)', P1_WIDTH = 10) => {
    const arrowLength = 0;
    const arrowWidth = P1_WIDTH * 0.2;

    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(Math.atan2(direction.y, direction.x));

    // Draw arrow head as two lines
    ctx.beginPath();
    ctx.moveTo(arrowLength, 0);
    ctx.lineTo(arrowLength - arrowWidth, -arrowWidth / 2);
    ctx.moveTo(arrowLength, 0);
    ctx.lineTo(arrowLength - arrowWidth, arrowWidth / 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1; // Set a thin line width
    ctx.stroke();

    ctx.restore();
};
