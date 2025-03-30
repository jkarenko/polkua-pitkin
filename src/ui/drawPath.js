export const drawPath = (ctx, path, color, width, isDrawing = false, P1_COLOR) => {
    if (path.length < 1) {
        return;
    }

    if (!isDrawing) {
        // Draw the outline (black path with slightly larger width) only for completed paths
        ctx.strokeStyle = 'black';
        ctx.lineWidth = width + 4; // 2 pixels wider on each side
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) {
            ctx.lineTo(path[i].x, path[i].y);
        }
        ctx.stroke();
    }

    // Draw the main colored path
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
    }
    ctx.stroke();

    // Draw the dashed guide line for Player 1's path on top of the main path
    if (!isDrawing && color === P1_COLOR) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]); // Create dashed line pattern
        ctx.lineCap = 'butt';
        ctx.lineJoin = 'miter';
        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) {
            ctx.lineTo(path[i].x, path[i].y);
        }
        ctx.stroke();
        ctx.setLineDash([]); // Reset dash pattern
    }
};
