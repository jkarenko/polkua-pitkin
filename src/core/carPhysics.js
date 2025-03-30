// Car Physics Module
// This module contains functions for car movement, physics calculations, and related utilities

// Import any dependencies
import { CAR_CONSTANTS } from '../car.js';
import {
    distSq,
    dist,
    pointLineSegmentDistance,
    calculatePathLength,
    getPointAlongPath
} from './path.js';

// Physics constants for drifting and hand-brake turns
const DRIFT_PHYSICS = {
    DRIFT_THRESHOLD: 0.1,           // Curvature threshold to trigger drift (lowered to make drifting happen in moderate corners)
    HANDBRAKE_THRESHOLD: 0.1,       // Curvature threshold to trigger handbrake turn (lowered to make handbrake turns happen in tighter corners)
    DRIFT_FACTOR: 0.01,              // How much the car drifts (0-1) (increased to make the car drift more)
    HANDBRAKE_FACTOR: 5.0,          // How much the car rotates during handbrake turn (increased to make the car rotate more)
    REAR_SWING_FACTOR: 5.0,         // How much the rear swings out during turns (increased to make the rear swing out more)
    GRIP_RECOVERY_RATE: 0.001,       // How quickly the car regains grip after drifting (lowered to make the car take longer to regain grip)
    MOMENTUM_FACTOR: 500,           // How much momentum affects the car's movement (increased to make momentum have a greater effect)
    LATERAL_FRICTION: 0.05,         // Lateral friction coefficient (lowered to make the car drift more)
    MOMENTUM_DECAY: 0.95            // How quickly momentum decays when not drifting (new parameter)
};

// Utility functions for distance calculations moved to path.js

// Path calculation functions moved to path.js

// Function to detect sharp turns and determine if a hand-brake turn is needed
const detectSharpTurn = (progress, path, maxCurvature, lookAheadDistance) => {
    // Get current curvature
    const currentCurvature = calculateCurvature(progress, path, maxCurvature);

    // Get upcoming curvature - look ahead for the main turn detection
    const upcomingProgress = Math.min(1, progress + lookAheadDistance);
    const upcomingCurvature = calculateCurvature(upcomingProgress, path, maxCurvature);

    // Look even further ahead to detect turns earlier for pre-drift
    const farAheadProgress = Math.min(1, progress + lookAheadDistance * 1.2);
    const farAheadCurvature = calculateCurvature(farAheadProgress, path, maxCurvature);

    // Calculate the change in direction
    const currentPoint = getPointAlongPath(progress, path);
    const nextPoint = getPointAlongPath(Math.min(1, progress + 0.01), path);
    const futurePoint = getPointAlongPath(upcomingProgress, path);
    const farFuturePoint = getPointAlongPath(farAheadProgress, path);

    // Calculate vectors
    const currentVector = { 
        x: nextPoint.x - currentPoint.x, 
        y: nextPoint.y - currentPoint.y 
    };
    const futureVector = { 
        x: futurePoint.x - currentPoint.x, 
        y: futurePoint.y - currentPoint.y 
    };
    const farFutureVector = {
        x: farFuturePoint.x - currentPoint.x,
        y: farFuturePoint.y - currentPoint.y
    };

    // Normalize vectors
    const currentMag = Math.sqrt(currentVector.x * currentVector.x + currentVector.y * currentVector.y);
    const futureMag = Math.sqrt(futureVector.x * futureVector.x + futureVector.y * futureVector.y);
    const farFutureMag = Math.sqrt(farFutureVector.x * farFutureVector.x + farFutureVector.y * farFutureVector.y);

    if (currentMag === 0 || futureMag === 0) {
        return {
            isDrifting: false,
            isHandbrake: false,
            isPreDrift: false,
            curvature: currentCurvature,
            directionChange: 0,
            farDirectionChange: 0
        };
    }

    const normalizedCurrent = {
        x: currentVector.x / currentMag,
        y: currentVector.y / currentMag
    };

    const normalizedFuture = {
        x: futureVector.x / futureMag,
        y: futureVector.y / futureMag
    };

    // Calculate dot product to get the cosine of the angle
    const dotProduct = normalizedCurrent.x * normalizedFuture.x + normalizedCurrent.y * normalizedFuture.y;
    const clampedDot = Math.max(-1, Math.min(1, dotProduct));
    const angleChange = Math.acos(clampedDot);

    // Calculate cross product to determine direction (left or right)
    const crossProduct = normalizedCurrent.x * normalizedFuture.y - normalizedCurrent.y * normalizedFuture.x;
    const directionChange = angleChange * Math.sign(crossProduct);

    // Calculate far ahead direction change for pre-drift detection
    let farDirectionChange = 0;
    if (farFutureMag > 0) {
        const normalizedFarFuture = {
            x: farFutureVector.x / farFutureMag,
            y: farFutureVector.y / farFutureMag
        };

        const farDotProduct = normalizedCurrent.x * normalizedFarFuture.x + normalizedCurrent.y * normalizedFarFuture.y;
        const farClampedDot = Math.max(-1, Math.min(1, farDotProduct));
        const farAngleChange = Math.acos(farClampedDot);

        const farCrossProduct = normalizedCurrent.x * normalizedFarFuture.y - normalizedCurrent.y * normalizedFarFuture.x;
        farDirectionChange = farAngleChange * Math.sign(farCrossProduct);
    }

    // Determine if we should drift or handbrake
    const isDrifting = Math.abs(upcomingCurvature) > DRIFT_PHYSICS.DRIFT_THRESHOLD;
    const isHandbrake = Math.abs(upcomingCurvature) > DRIFT_PHYSICS.HANDBRAKE_THRESHOLD && 
                        Math.abs(directionChange) > Math.PI / 4; // More than 45 degrees

    // Detect pre-drift condition - when we're approaching a turn but not yet drifting
    // Use a lower threshold for pre-drift to start earlier
    const isPreDrift = !isDrifting && !isHandbrake && 
                      Math.abs(farAheadCurvature) > DRIFT_PHYSICS.DRIFT_THRESHOLD * 0.9 &&
                      Math.abs(farDirectionChange) > Math.PI / 6; // More than 30 degrees

    return {
        isDrifting,
        isHandbrake,
        isPreDrift,
        curvature: upcomingCurvature,
        farAheadCurvature,
        directionChange,
        farDirectionChange
    };
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

const calculateTirePositions = (centerPos, angle, carWidth, carLength, driftAngle = 0, preDriftAngle = 0) => {
    const halfW = carWidth / 2;
    const halfL = carLength / 2;

    // Define tire offsets (front-right, front-left, rear-right, rear-left)
    const tireOffsets = [
        { x: halfW, y: -halfL }, { x: -halfW, y: -halfL },
        { x: halfW, y: halfL }, { x: -halfW, y: halfL }
    ];

    // Calculate rotation for the car body
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    // Apply drift angle to rear wheels (index 2 and 3)
    return tireOffsets.map((offset, index) => {
        // For rear wheels, apply drift angle and pre-drift angle
        if (index >= 2) {
            // Combine drift and pre-drift angles
            const combinedAngle = driftAngle + preDriftAngle;

            if (combinedAngle !== 0) {
                // Calculate drift effect - rear wheels are offset based on combined angle
                const driftEffect = Math.abs(combinedAngle) * 0.5; // Scale down the effect
                const driftDir = Math.sign(combinedAngle);

                // Modify the y-offset for rear wheels based on drift
                const driftedOffset = { 
                    x: offset.x + (driftDir * driftEffect * halfW), 
                    y: offset.y 
                };

                // Rotate the drifted position
                const rotatedX = driftedOffset.x * cosA - driftedOffset.y * sinA;
                const rotatedY = driftedOffset.x * sinA + driftedOffset.y * cosA;
                return { x: centerPos.x + rotatedX, y: centerPos.y + rotatedY };
            }
        }

        // Front wheels or rear wheels with no drift
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

        // Initialize drift physics state
        carState.driftState = {
            isDrifting: false,
            isHandbrake: false,
            isPreDrift: false,
            driftAngle: 0,
            preDriftAngle: 0,
            driftMomentum: { x: 0, y: 0 },
            lateralVelocity: 0,
            grip: 1.0
        };
    }

    // --- Car Movement Calculation ---
    // Detect if we're approaching a sharp turn
    const turnInfo = detectSharpTurn(carState.progress, path, constants.MAX_CURVATURE, constants.CURVE_LOOK_AHEAD);

    // Ensure driftState is initialized
    if (!carState.driftState) {
        carState.driftState = {
            isDrifting: false,
            isHandbrake: false,
            isPreDrift: false,
            driftAngle: 0,
            preDriftAngle: 0,
            driftMomentum: { x: 0, y: 0 },
            lateralVelocity: 0,
            grip: 1.0
        };
    }

    // Update drift state based on turn info
    carState.driftState.isDrifting = turnInfo.isDrifting;
    carState.driftState.isHandbrake = turnInfo.isHandbrake;
    carState.driftState.isPreDrift = turnInfo.isPreDrift;

    // Define a threshold for hard braking
    const HARD_BRAKING_THRESHOLD = 0.99; // Lower number breaks harder

    const currentCurvature = calculateCurvature(carState.progress, path, constants.MAX_CURVATURE);
    const upcomingCurvature = turnInfo.curvature;

    // Adjust speed based on curvature and drift state
    let targetSpeedMultiplier = getSpeedMultiplier(currentCurvature, constants.MAX_CURVATURE);

    // Reduce speed more during handbrake turns
    if (carState.driftState.isHandbrake) {
        targetSpeedMultiplier *= 1; // Target speed to slow down to for handbrake turns
    } else if (carState.driftState.isDrifting) {
        targetSpeedMultiplier *= 1; // Target speed to slow down to for drifting
    }

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

    // Update car angle with drift physics
    let deltaAngle = 0;
    const dt = constants.ANIMATION_INTERVAL / 1000;
    const speedPixelsPerSecond = carState.currentSpeed * (1000 / constants.ANIMATION_INTERVAL);

    // Calculate base angle change from wheel angle (normal driving)
    if (Math.abs(carState.currentWheelAngle) > 0.01 && constants.WHEELBASE > 0) {
        deltaAngle = (speedPixelsPerSecond * Math.tan(carState.currentWheelAngle) / constants.WHEELBASE) * dt;
    }

    // Check if the car is braking hard (significant deceleration)
    const isHardBraking = targetSpeed < carState.currentSpeed &&
        decelerationRate > HARD_BRAKING_THRESHOLD &&
        carState.currentSpeed > constants.PIXEL_SPEED * 0.3; // Only count as hard braking if moving fast enough

    // Check if the car is accelerating hard
    const isHardAccelerating = targetSpeed > carState.currentSpeed &&
        (targetSpeed - carState.currentSpeed) / constants.PIXEL_SPEED > 0.2 && // Accelerating at more than 20% of max speed
        carState.currentSpeed > constants.PIXEL_SPEED * 0.4; // Only count if already moving at a decent speed

    // Check if the car is turning sharply (even if not drifting)
    const isSharpTurning = Math.abs(steeringAngle) > Math.PI / 6 && // More than 30 degrees
        carState.currentSpeed > constants.PIXEL_SPEED * 0.5; // Only count if moving at a good speed

    // Set the isSkidding flag for sound effects and visual effects
    carState.isSkidding =
        // carState.driftState.isDrifting ||
        // carState.driftState.isHandbrake ||
        // isHardBraking ||
        // isHardAccelerating ||
        isSharpTurning;


    // Handle drift and handbrake physics
    if (carState.driftState.isHandbrake) {
        // Handbrake turn - rapid rotation with rear swinging out
        const handbrakeAngle = steeringAngle * DRIFT_PHYSICS.HANDBRAKE_FACTOR;
        deltaAngle = handbrakeAngle * dt * 10; // Faster rotation for handbrake

        // Update drift angle for visual effect of rear swinging out
        carState.driftState.driftAngle = steeringAngle * DRIFT_PHYSICS.REAR_SWING_FACTOR;
        // Reset pre-drift angle when in handbrake mode
        carState.driftState.preDriftAngle = 0;

        // Reduce grip during handbrake turn
        carState.driftState.grip = Math.max(0.2, carState.driftState.grip - 0.2);

        // Add lateral velocity for sliding effect - increased for more sideways movement
        carState.driftState.lateralVelocity = speedPixelsPerSecond * 0.7 * Math.sign(-steeringAngle);
    } 
    else if (carState.driftState.isDrifting) {
        // Regular drift - car rotates but maintains some forward momentum
        deltaAngle = steeringAngle * DRIFT_PHYSICS.DRIFT_FACTOR * dt * 5;

        // Gradual drift angle for smoother drifting
        const targetDriftAngle = steeringAngle * DRIFT_PHYSICS.DRIFT_FACTOR;
        carState.driftState.driftAngle += (targetDriftAngle - carState.driftState.driftAngle) * 0.1;
        // Reset pre-drift angle when in drift mode
        carState.driftState.preDriftAngle = 0;

        // Reduce grip during drift
        carState.driftState.grip = Math.max(0.4, carState.driftState.grip - 0.1);

        // Add some lateral velocity - increased for more sideways movement
        carState.driftState.lateralVelocity = speedPixelsPerSecond * 0.5 * Math.sign(-steeringAngle);
    }
    else if (carState.driftState.isPreDrift) {
        // Pre-drift - start swinging the rear before the actual drift
        // Use the far direction change from turnInfo to determine the direction of the upcoming turn
        const preDriftDirection = Math.sign(turnInfo.farDirectionChange);

        // Calculate a target pre-drift angle based on the upcoming turn
        // Use a smaller factor than regular drift to make it subtle
        const preDriftFactor = 0.3; // Reduced to make the rear swing out less during pre-drift
        const targetPreDriftAngle = preDriftDirection * Math.abs(turnInfo.farDirectionChange) * preDriftFactor;

        // Gradually adjust the pre-drift angle towards the target
        carState.driftState.preDriftAngle += (targetPreDriftAngle - carState.driftState.preDriftAngle) * 0.03; // Reduced to make the adjustment slower

        // Apply a small amount of lateral velocity in the direction of the upcoming turn
        carState.driftState.lateralVelocity = speedPixelsPerSecond * 0.1 * preDriftDirection; // Reduced to make the lateral movement less pronounced

        // Slightly reduce grip during pre-drift
        carState.driftState.grip = Math.max(0.7, carState.driftState.grip - 0.05);

        // Regular drift angle decays normally
        carState.driftState.driftAngle *= 0.9;
    }
    else {
        // Normal driving - recover grip and reduce drift angle
        carState.driftState.grip = Math.min(1.0, carState.driftState.grip + DRIFT_PHYSICS.GRIP_RECOVERY_RATE);
        carState.driftState.driftAngle *= 0.9; // Decay drift angle
        carState.driftState.preDriftAngle *= 0.9; // Decay pre-drift angle
        carState.driftState.lateralVelocity *= DRIFT_PHYSICS.LATERAL_FRICTION; // Apply friction to lateral velocity
    }

    // Apply the angle change
    carState.currentAngle += deltaAngle;
    carState.currentAngle = ((carState.currentAngle + Math.PI) % (2 * Math.PI)) - Math.PI;

    // Get next position along path
    const pathNextPos = getPointAlongPath(nextProgress, path);

    // Calculate actual next position with drift physics
    let nextPos = { ...pathNextPos };

    if (carState.driftState.isDrifting || carState.driftState.isHandbrake || Math.abs(carState.driftState.lateralVelocity) > 0.1) {
        // Calculate lateral movement direction (perpendicular to car's forward direction)
        const lateralDirection = {
            x: Math.sin(carState.currentAngle),
            y: -Math.cos(carState.currentAngle)
        };

        // Apply lateral velocity to position
        const lateralOffset = carState.driftState.lateralVelocity * dt;
        nextPos.x += lateralDirection.x * lateralOffset;
        nextPos.y += lateralDirection.y * lateralOffset;

        // Apply momentum from previous frame
        nextPos.x += carState.driftState.driftMomentum.x * DRIFT_PHYSICS.MOMENTUM_FACTOR;
        nextPos.y += carState.driftState.driftMomentum.y * DRIFT_PHYSICS.MOMENTUM_FACTOR;

        // Update momentum
        carState.driftState.driftMomentum = {
            x: (nextPos.x - pathNextPos.x) * DRIFT_PHYSICS.MOMENTUM_FACTOR,
            y: (nextPos.y - pathNextPos.y) * DRIFT_PHYSICS.MOMENTUM_FACTOR
        };

        // Blend between drift position and path position based on grip
        // Modified to favor drift position more for enhanced sideways movement
        const blendFactor = Math.pow(carState.driftState.grip, 1.5); // Apply non-linear scaling to grip
        nextPos.x = nextPos.x * (1 - blendFactor) + pathNextPos.x * blendFactor;
        nextPos.y = nextPos.y * (1 - blendFactor) + pathNextPos.y * blendFactor;
    } else {
        // Gradually decay momentum when not drifting instead of resetting it
        carState.driftState.driftMomentum = { 
            x: carState.driftState.driftMomentum.x * DRIFT_PHYSICS.MOMENTUM_DECAY, 
            y: carState.driftState.driftMomentum.y * DRIFT_PHYSICS.MOMENTUM_DECAY 
        };
    }

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

    // Add tire marks if needed - only when drifting or braking hard
    if (carState.tireMarks !== undefined && carState.isSkidding) {
        const carWidth = CAR_CONSTANTS?.WIDTH || 15;
        const carLength = CAR_CONSTANTS?.HEIGHT || 25;

        // Get drift angle from drift state - don't use pre-drift angle for skid marks
        const driftAngle = carState.driftState?.driftAngle || 0;
        // Don't use pre-drift angle for skid marks, as they should only appear during actual skidding

        // Calculate tire positions with drift angle only (no pre-drift angle)
        const currentTirePositions = calculateTirePositions(
            carState.position, 
            carState.currentAngle, 
            carWidth, 
            carLength, 
            driftAngle,
            0  // Set pre-drift angle to 0 for skid marks
        );

        if (carState.previousPosition && carState.previousAngle !== undefined) {
            // Previous drift angle (or 0 if not available) - don't use pre-drift angle
            const prevDriftAngle = carState.driftState?.driftAngle || 0;
            // Don't use previous pre-drift angle for skid marks

            const previousTirePositions = calculateTirePositions(
                carState.previousPosition, 
                carState.previousAngle, 
                carWidth, 
                carLength, 
                prevDriftAngle,
                0  // Set previous pre-drift angle to 0 for skid marks
            );

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

// Export all functions and constants
export {
    calculateCurvature,
    getSpeedMultiplier,
    getDecelerationRate,
    calculateTirePositions,
    detectSharpTurn,
    updateCarPhysics,
    DRIFT_PHYSICS
};
