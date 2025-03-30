// Car Physics Module
// This module contains functions for car movement, physics calculations, and related utilities

// Import any dependencies
import { CAR_CONSTANTS } from '../car.js';

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

// Car physics calculation functions
const calculateCurvature = (progress, path, maxCurvature) => {
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
    return Math.min(maxCurvature, angle / Math.PI);
};

const getSpeedMultiplier = (curvature, maxCurvature) => {
    // Convert curvature (0 to MAX_CURVATURE) to speed multiplier (0.05 to 1.0)
    return 1.0 - (curvature / maxCurvature) * 0.95;
};

const getDecelerationRate = (currentCurvature, upcomingCurvature, baseDecelerationRate, maxDecelerationRate, curveLookAhead, curvePreparationDistance) => {
    // If there's a sharp curve coming up, decelerate more aggressively
    const curveFactor = Math.max(0, upcomingCurvature - currentCurvature);

    // Calculate how close we are to the curve
    const distanceToCurve = curveLookAhead - curvePreparationDistance;
    const preparationFactor = Math.max(0, Math.min(1, distanceToCurve / curvePreparationDistance));

    // Combine curve sharpness with preparation factor
    // Add extra deceleration for very sharp curves (curvature > 0.7)
    const extraSharpCurveFactor = Math.max(0, (upcomingCurvature - 0.7) / 0.2);
    const combinedFactor = (curveFactor + extraSharpCurveFactor) * preparationFactor;

    return baseDecelerationRate + (combinedFactor * (maxDecelerationRate - baseDecelerationRate));
};

const calculateTirePositions = (centerPos, angle, carWidth, carLength) => {
    const halfW = carWidth / 2;
    const halfL = carLength / 2;

    const tireOffsets = [
        { x: halfW, y: -halfL }, { x: -halfW, y: -halfL },
        { x: halfW, y: halfL }, { x: -halfW, y: halfL }
    ];

    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    return tireOffsets.map(offset => {
        const rotatedX = offset.x * cosA - offset.y * sinA;
        const rotatedY = offset.x * sinA + offset.y * cosA;
        return { x: centerPos.x + rotatedX, y: centerPos.y + rotatedY };
    });
};

// Function to update car position and physics
const updateCarPhysics = (carState, path, constants, checkFuelLimit) => {
    // Exit if we are already in the finishing delay or showing score
    if (carState.isFinishing) {
        return false;
    }

    // Initialize previous position on the first frame
    if (carState.previousPosition === null) {
        carState.previousPosition = { ...carState.position };
        carState.previousAngle = carState.currentAngle; // Initialize previous angle too
    }

    // --- Car Movement Calculation ---
    const currentCurvature = calculateCurvature(carState.progress, path, constants.MAX_CURVATURE);
    const upcomingProgress = Math.min(1, carState.progress + constants.CURVE_LOOK_AHEAD);
    const upcomingCurvature = calculateCurvature(upcomingProgress, path, constants.MAX_CURVATURE);
    const targetSpeedMultiplier = getSpeedMultiplier(currentCurvature, constants.MAX_CURVATURE);
    let targetSpeed = constants.PIXEL_SPEED * targetSpeedMultiplier;

    // Speed adjustment near finish
    const distanceToFinish = 1 - carState.progress;
    if (distanceToFinish < constants.FINISH_PREPARATION_DISTANCE) {
        const finishFactor = distanceToFinish / constants.FINISH_PREPARATION_DISTANCE;
        const minSpeed = constants.PIXEL_SPEED * constants.MIN_FINISH_SPEED;
        targetSpeed = minSpeed + (targetSpeed - minSpeed) * finishFactor;
    }

    const decelerationRate = getDecelerationRate(
        currentCurvature, 
        upcomingCurvature, 
        constants.BASE_DECELERATION_RATE, 
        constants.MAX_DECELERATION_RATE, 
        constants.CURVE_LOOK_AHEAD, 
        constants.CURVE_PREPARATION_DISTANCE
    );

    // Update speed
    if (targetSpeed > carState.currentSpeed) {
        const speedDiff = targetSpeed - carState.currentSpeed;
        const accelerationRate = constants.ACCELERATION_RATE * (1 + speedDiff / constants.PIXEL_SPEED);
        carState.currentSpeed = Math.min(targetSpeed, carState.currentSpeed + constants.PIXEL_SPEED * accelerationRate);
    } else {
        carState.currentSpeed = Math.max(targetSpeed, carState.currentSpeed - constants.PIXEL_SPEED * decelerationRate);
    }

    // Calculate next progress
    const progressIncrement = (carState.currentSpeed / carState.pathTotalLength);
    const nextProgress = carState.progress + progressIncrement;

    // Calculate steering
    const lookAheadDistance = 0.05;
    const targetPoint = getPointAlongPath(Math.min(1, carState.progress + lookAheadDistance), path);
    const angleToTarget = Math.atan2(targetPoint.y - carState.position.y, targetPoint.x - carState.position.x);

    let steeringAngle = angleToTarget - carState.currentAngle;
    steeringAngle = ((steeringAngle + Math.PI) % (2 * Math.PI)) - Math.PI;

    // Update wheel angle
    const wheelAngleDiff = steeringAngle - carState.currentWheelAngle;
    carState.currentWheelAngle += Math.sign(wheelAngleDiff) * Math.min(Math.abs(wheelAngleDiff), constants.WHEEL_TURN_SPEED);
    carState.currentWheelAngle = Math.max(-constants.MAX_WHEEL_ANGLE, Math.min(constants.MAX_WHEEL_ANGLE, carState.currentWheelAngle));

    // Update car angle
    let deltaAngle = 0;
    if (carState.isSkidding) {
        deltaAngle = steeringAngle * constants.SKID_TURN_RATE_MULTIPLIER;
    }
    else if (Math.abs(carState.currentWheelAngle) > 0.01 && constants.WHEELBASE > 0) {
        const dt = constants.ANIMATION_INTERVAL / 1000;
        const speedPixelsPerSecond = carState.currentSpeed * (1000 / constants.ANIMATION_INTERVAL);
        deltaAngle = (speedPixelsPerSecond * Math.tan(carState.currentWheelAngle) / constants.WHEELBASE) * dt;
    }
    carState.currentAngle += deltaAngle;
    carState.currentAngle = ((carState.currentAngle + Math.PI) % (2 * Math.PI)) - Math.PI;

    // Get next position and check fuel
    const nextPos = getPointAlongPath(nextProgress, path);
    const distanceMoved = dist(carState.position, nextPos);

    if (checkFuelLimit && checkFuelLimit(carState.position, distanceMoved, false)) {
        return false;
    }

    // Update car state
    carState.previousPosition = { ...carState.position };
    carState.position = nextPos;
    carState.progress = nextProgress;
    if (carState.trail) {
        carState.trail.push({ ...carState.position });
    }
    if (carState.fuelConsumed !== undefined) {
        carState.fuelConsumed += distanceMoved;
    }

    // Add tire marks if needed
    if (carState.tireMarks !== undefined) {
        const carWidth = CAR_CONSTANTS?.WIDTH || 15;
        const carLength = CAR_CONSTANTS?.HEIGHT || 25;

        const currentTirePositions = calculateTirePositions(carState.position, carState.currentAngle, carWidth, carLength);
        if (carState.previousPosition && carState.previousAngle !== undefined) {
            const previousTirePositions = calculateTirePositions(carState.previousPosition, carState.previousAngle, carWidth, carLength);

            for (let i = 0; i < 4; i++) {
                if (distSq(previousTirePositions[i], currentTirePositions[i]) > 0.1) {
                    carState.tireMarks.push({
                        start: previousTirePositions[i],
                        end: currentTirePositions[i]
                    });
                }
            }
        }
    }

    // Store current angle as previous for the next frame
    carState.previousAngle = carState.currentAngle;

    // Check if car has reached the finish line
    if (carState.progress >= 1) {
        return 'finished';
    }

    return true;
};

// Export all functions
export {
    distSq,
    dist,
    pointLineSegmentDistance,
    calculatePathLength,
    getPointAlongPath,
    calculateCurvature,
    getSpeedMultiplier,
    getDecelerationRate,
    calculateTirePositions,
    updateCarPhysics
};