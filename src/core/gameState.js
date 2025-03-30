// Game state enum
export const GAME_STATES = {
    P1_DRAWING: 'P1_DRAWING',
    P2_WAITING: 'P2_WAITING',
    P2_DRAWING: 'P2_DRAWING',
    CAR_ANIMATING: 'CAR_ANIMATING',
    SHOWING_SCORE: 'SHOWING_SCORE'
};

export class GameState {
    constructor() {
        // Visual constants
        this.visualConstants = {
            P1_COLOR: 'lightblue',
            P1_WIDTH: 40,
            P2_COLOR: 'black',
            P2_WIDTH: 3,
            START_COLOR: 'gray',
            END_COLOR: 'green',
            MARKER_RADIUS_FACTOR: 1.4,
            HIT_THRESHOLD_FACTOR: 1.1,
            START_END_SNAP_RADIUS_FACTOR: 1.5
        };

        // Gameplay constants
        this.gameplayConstants = {
            PROGRESS_INTERVAL: 0.10,
            SCORE_THRESHOLD: 20,
            SCORE_POINTS: 100,
            MAX_PATH_LENGTH_FACTOR: 1.20
        };

        // Car constants
        this.carConstants = {
            PIXEL_SPEED: 2,
            ANIMATION_INTERVAL: 16,
            SMOOTHING_WINDOW: 10,
            CURVATURE_WINDOW: 10,
            MAX_CURVATURE: 0.9,
            ACCELERATION_RATE: 0.005,
            BASE_DECELERATION_RATE: 0.8,
            CURVE_LOOK_AHEAD: 0.15,
            MAX_DECELERATION_RATE: 1.2,
            CURVE_PREPARATION_DISTANCE: 0.1,
            FINISH_PREPARATION_DISTANCE: 0.2,
            MIN_FINISH_SPEED: 0.3,
            WHEEL_TURN_SPEED: 0.15,
            MAX_WHEEL_ANGLE: Math.PI / 4,
            WHEELBASE: 20,
            SKID_TURN_RATE_MULTIPLIER: 0.15
        };

        // UI constants
        this.uiConstants = {
            THUMBNAIL_WIDTH: 240,
            THUMBNAIL_HEIGHT: 150,
            THUMBNAIL_PADDING: 10
        };

        // Initialize game state
        this.reset();
    }

    // Helper methods for state management
    reset() {
        this.gameState = GAME_STATES.P1_DRAWING;
        this.player1Path = [];
        this.smoothedPath = [];
        this.player2Path = [];
        this.isDrawing = false;
        this.player1TotalLength = 0;
        this.lastPlayedProgressMilestone = 0;
        this.startMarker = null;
        this.endMarker = null;
        this.progressMarkers = [];
        this.currentActiveSegmentIndex = 0;
        this.maxAllowedPathLength = 0;
        this.currentPathLength = 0;
        this.fuelConsumed = 0;
        this.previousCarPosition = null;
        this.defeatFlagged = false;
        this.decorations = [];
        this.tireMarks = [];
        this.currentSessionHighScore = 0;
        this.currentSessionBestPlayer2Path = [];
        this.draggedCourseId = null;
        this.isFinishing = false;
        this.activeParticles = [];

        // Reset car state
        this.carProgress = 0;
        this.carPosition = { x: 0, y: 0 };
        this.carAngle = 0;
        this.currentWheelAngle = 0;
        this.currentCarAngle = 0;
        this.currentSpeed = 0;
        this.carTrail = [];
        this.carConfig = null;
        this.previousCarAngle = 0;
        this.isScreeching = false;
        this.isSkidding = false;
    }

    resetPlayer2() {
        // Only reset player2-specific properties
        this.player2Path = [];
        this.isDrawing = false;
        this.lastPlayedProgressMilestone = 0;
        this.currentActiveSegmentIndex = 0;
        this.currentPathLength = 0;
        this.gameState = GAME_STATES.P2_WAITING;
    }

    // Getters for commonly used constants
    get P1_WIDTH() { return this.visualConstants.P1_WIDTH; }
    get P1_COLOR() { return this.visualConstants.P1_COLOR; }
    get P2_COLOR() { return this.visualConstants.P2_COLOR; }
    get P2_WIDTH() { return this.visualConstants.P2_WIDTH; }
    get START_COLOR() { return this.visualConstants.START_COLOR; }
    get END_COLOR() { return this.visualConstants.END_COLOR; }
    get MARKER_RADIUS_FACTOR() { return this.visualConstants.MARKER_RADIUS_FACTOR; }
    get HIT_THRESHOLD_FACTOR() { return this.visualConstants.HIT_THRESHOLD_FACTOR; }
    get START_END_SNAP_RADIUS_FACTOR() { return this.visualConstants.START_END_SNAP_RADIUS_FACTOR; }
    get PROGRESS_INTERVAL() { return this.gameplayConstants.PROGRESS_INTERVAL; }
    get SCORE_THRESHOLD() { return this.gameplayConstants.SCORE_THRESHOLD; }
    get SCORE_POINTS() { return this.gameplayConstants.SCORE_POINTS; }
    get MAX_PATH_LENGTH_FACTOR() { return this.gameplayConstants.MAX_PATH_LENGTH_FACTOR; }
    get CAR_PIXEL_SPEED() { return this.carConstants.PIXEL_SPEED; }
    get CAR_ANIMATION_INTERVAL() { return this.carConstants.ANIMATION_INTERVAL; }
    get SMOOTHING_WINDOW() { return this.carConstants.SMOOTHING_WINDOW; }
    get CURVATURE_WINDOW() { return this.carConstants.CURVATURE_WINDOW; }
    get MAX_CURVATURE() { return this.carConstants.MAX_CURVATURE; }
    get ACCELERATION_RATE() { return this.carConstants.ACCELERATION_RATE; }
    get BASE_DECELERATION_RATE() { return this.carConstants.BASE_DECELERATION_RATE; }
    get CURVE_LOOK_AHEAD() { return this.carConstants.CURVE_LOOK_AHEAD; }
    get MAX_DECELERATION_RATE() { return this.carConstants.MAX_DECELERATION_RATE; }
    get CURVE_PREPARATION_DISTANCE() { return this.carConstants.CURVE_PREPARATION_DISTANCE; }
    get FINISH_PREPARATION_DISTANCE() { return this.carConstants.FINISH_PREPARATION_DISTANCE; }
    get MIN_FINISH_SPEED() { return this.carConstants.MIN_FINISH_SPEED; }
    get WHEEL_TURN_SPEED() { return this.carConstants.WHEEL_TURN_SPEED; }
    get MAX_WHEEL_ANGLE() { return this.carConstants.MAX_WHEEL_ANGLE; }
    get WHEELBASE() { return this.carConstants.WHEELBASE; }
    get SKID_TURN_RATE_MULTIPLIER() { return this.carConstants.SKID_TURN_RATE_MULTIPLIER; }
    get THUMBNAIL_WIDTH() { return this.uiConstants.THUMBNAIL_WIDTH; }
    get THUMBNAIL_HEIGHT() { return this.uiConstants.THUMBNAIL_HEIGHT; }
    get THUMBNAIL_PADDING() { return this.uiConstants.THUMBNAIL_PADDING; }
}
