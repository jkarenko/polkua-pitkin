// Path Module
// This module contains functions for path calculations, distance measurements, and related utilities

// Utility functions for distance calculations
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

// Path calculation functions
const calculatePathLength = (path) => {
    let length = 0;
    for (let i = 0; i < path.length - 1; i++) {
        length += dist(path[i], path[i + 1]);
    }
    return length;
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

const isPointWithinPath = (point, path, threshold, gameState = null, GAME_STATES = null) => {
    if (path.length < 2) {
        return true;
    } // Path is just a point or empty

    // For Player 1's drawing phase, use the original behavior
    if (gameState === null || GAME_STATES === null || gameState === GAME_STATES.P1_DRAWING) {
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
    const currentActiveSegmentIndex = gameState.currentActiveSegmentIndex || 0;
    const endIdx = Math.min(currentActiveSegmentIndex + lookAheadSegments, path.length - 1);

    let minDistance = Infinity;
    for (let i = startIdx; i <= endIdx; i++) {
        if (i < path.length - 1) {
            minDistance = Math.min(minDistance, pointLineSegmentDistance(point, path[i], path[i + 1]));
        }
    }

    // If we're near the end of the current segment, advance to the next one
    if (currentActiveSegmentIndex < path.length - 1) {
        const currentSegmentEnd = path[currentActiveSegmentIndex + 1];
        if (dist(point, currentSegmentEnd) <= threshold * 1.5) {
            gameState.currentActiveSegmentIndex++;
        }
    }

    return minDistance <= threshold;
};

const getProgressAlongPath = (point, path, player1TotalLength = null, gameState = null, GAME_STATES = null) => {
    if (path.length < 2 || (player1TotalLength !== null && player1TotalLength === 0)) {
        return 0;
    }

    if (gameState === null || GAME_STATES === null || gameState === GAME_STATES.P1_DRAWING) {
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

        return player1TotalLength !== null ? lengthUpToProjection / player1TotalLength : lengthUpToProjection / accumulatedLength;
    }

    // For Player 2's drawing phase, calculate progress based on current active segment
    let accumulatedLength = 0;
    let currentSegmentProgress = 0;
    const currentActiveSegmentIndex = gameState.currentActiveSegmentIndex || 0;

    // Calculate length up to current active segment
    for (let i = 0; i < currentActiveSegmentIndex; i++) {
        accumulatedLength += dist(path[i], path[i + 1]);
    }

    // Calculate progress within current segment
    if (currentActiveSegmentIndex < path.length - 1) {
        const currentStart = path[currentActiveSegmentIndex];
        const currentEnd = path[currentActiveSegmentIndex + 1];
        const segmentLength = dist(currentStart, currentEnd);
        const l2 = distSq(currentStart, currentEnd);

        if (l2 !== 0) {
            const t = ((point.x - currentStart.x) * (currentEnd.x - currentStart.x) +
                (point.y - currentStart.y) * (currentEnd.y - currentStart.y)) / l2;
            currentSegmentProgress = Math.max(0, Math.min(1, t)) * segmentLength;
        }
    }

    return (accumulatedLength + currentSegmentProgress) / player1TotalLength;
};

const smoothPath = (path, smoothingWindow = 5) => {
    if (path.length < 3) {
        return path;
    }

    const smoothed = [];
    const halfWindow = Math.floor(smoothingWindow / 2);

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

// Export all functions
export {
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
};