// Course Manager Module
// This module contains functions for managing saved courses, including saving, loading, and deleting courses
import { hashPath } from './path.js';
import { generateDecorationsForPath } from '../decoration.js';
import { pointLineSegmentDistance } from './path.js';

export class CourseManager {
    constructor(gameStates, canvas, ctx, statusDiv) {
        this.gameStates = gameStates;
        this.canvas = canvas;
        this.ctx = ctx;
        this.statusDiv = statusDiv;

        // UI elements
        this.savedCoursesSidebar = document.getElementById('savedCoursesSidebar');
        this.sidebarContent = document.getElementById('sidebarContent');
        this.closeSidebarButton = document.getElementById('closeSidebarButton');
        this.trashCan = document.getElementById('trashCan');

        // Constants from gameStates
        this.THUMBNAIL_WIDTH = gameStates.THUMBNAIL_WIDTH;
        this.THUMBNAIL_HEIGHT = gameStates.THUMBNAIL_HEIGHT;
        this.THUMBNAIL_PADDING = gameStates.THUMBNAIL_PADDING;
        this.P1_COLOR = gameStates.P1_COLOR;
        this.P2_COLOR = gameStates.P2_COLOR;
        this.START_COLOR = gameStates.START_COLOR;
        this.END_COLOR = gameStates.END_COLOR;

        // Store callback functions and constants for later use
        this.handleP1Done = null;
        this.redrawAllHelper = null;
        this.GAME_STATES = null;
    }

    saveCourseNow(handleP1Done, redrawAllHelper, GAME_STATES) {
        // Store callback functions and constants for later use
        if (handleP1Done) this.handleP1Done = handleP1Done;
        if (redrawAllHelper) this.redrawAllHelper = redrawAllHelper;
        if (GAME_STATES) this.GAME_STATES = GAME_STATES;

        // Use stored GAME_STATES if not provided
        GAME_STATES = GAME_STATES || this.GAME_STATES;

        if (!GAME_STATES || (this.gameStates.gameState !== GAME_STATES.P1_DRAWING && this.gameStates.gameState !== GAME_STATES.SHOWING_SCORE)) {
            console.warn("Attempted to save course outside of valid phases.");
            return;
        }

        const saveButton = this.gameStates.gameState === GAME_STATES.P1_DRAWING ?
            document.getElementById('saveCourseButton') :
            document.getElementById('victorySaveButton');

        // Handle P1 drawing phase saving
        if (this.gameStates.gameState === GAME_STATES.P1_DRAWING) {
            if (!this.gameStates.player1Path || this.gameStates.player1Path.length < 2) {
                alert("Rataa ei voi tallentaa, koska polku on liian lyhyt!");
                return;
            }

            // Use the current P1 path for hashing and saving
            const coursePathToSave = [...this.gameStates.player1Path]; // Create a copy
            const courseId = hashPath(coursePathToSave);
            const courseName = `Rata ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;

            const newCourseData = {
                id: courseId,
                name: courseName,
                player1Path: coursePathToSave,
                highScore: 0, // No high score yet
                highScorePlayer2Path: [] // No P2 path yet
            };

            try {
                let savedCourses = JSON.parse(localStorage.getItem('savedCourses') || '[]');
                const existingCourseIndex = savedCourses.findIndex(course => course.id === courseId);

                if (existingCourseIndex !== -1) {
                    // Course with this exact path already exists
                    alert("Tämä rata on jo tallennettu.");
                    saveButton.textContent = 'Jo tallennettu';
                    setTimeout(() => { saveButton.textContent = 'Tallenna rata'; }, 1500);
                } else {
                    // --- Add new course ---
                    savedCourses.push(newCourseData);
                    localStorage.setItem('savedCourses', JSON.stringify(savedCourses));
                    console.log(`P1 course saved: ${newCourseData.name}`, newCourseData);

                    // Provide feedback on the button
                    saveButton.textContent = 'Tallennettu!';
                    saveButton.disabled = true;
                    setTimeout(() => {
                        saveButton.textContent = 'Tallenna rata';
                        saveButton.disabled = false;
                    }, 1500);

                    // If the sidebar is open, refresh it
                    if (this.savedCoursesSidebar.classList.contains('visible')) {
                        this.populateSavedCoursesSidebar(handleP1Done, redrawAllHelper, GAME_STATES);
                    }
                }
            } catch (error) {
                console.error("Error saving P1 course to localStorage:", error);
                alert("Radan tallentamisessa tapahtui virhe.");
            }
        }
        // Handle victory screen saving (only for new courses)
        else if (this.gameStates.gameState === GAME_STATES.SHOWING_SCORE) {
            if (!this.gameStates.smoothedPath || this.gameStates.smoothedPath.length < 2) {
                console.error("Cannot save: No valid Player 1 path exists.");
                alert("Rataa ei voi tallentaa, koska Pelaaja 1:n polkua ei ole piirretty kunnolla.");
                return;
            }

            try {
                let savedCourses = JSON.parse(localStorage.getItem('savedCourses') || '[]');

                // Only handle saving new courses - highscores are updated automatically
                if (!window.currentLoadedCourseId) {
                    const courseId = hashPath(this.gameStates.smoothedPath);
                    const courseName = `Rata ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
                    const newCourseData = {
                        id: courseId,
                        name: courseName,
                        player1Path: this.gameStates.smoothedPath,
                        highScore: this.gameStates.currentSessionHighScore,
                        highScorePlayer2Path: this.gameStates.currentSessionBestPlayer2Path
                    };

                    const existingCourseIndex = savedCourses.findIndex(course => course.id === courseId);
                    if (existingCourseIndex === -1) {
                        savedCourses.push(newCourseData);
                        localStorage.setItem('savedCourses', JSON.stringify(savedCourses));
                        saveButton.textContent = 'Tallennettu!';
                        saveButton.disabled = true;
                    } else {
                        saveButton.textContent = 'Rata jo tallennettu';
                        saveButton.disabled = true;
                    }

                    // If sidebar is open, refresh it
                    if (this.savedCoursesSidebar.classList.contains('visible')) {
                        this.populateSavedCoursesSidebar(handleP1Done, redrawAllHelper, GAME_STATES);
                    }
                }
            } catch (error) {
                console.error("Error saving course:", error);
                alert("Radan tallentamisessa tapahtui virhe.");
                saveButton.textContent = 'Tallennus epäonnistui';
                saveButton.disabled = false;
            }
        }
    }

    updateHighScore(courseId, newScore) {
        try {
            let savedCourses = JSON.parse(localStorage.getItem('savedCourses') || '[]');
            const courseIndex = savedCourses.findIndex(course => course.id === courseId);

            if (courseIndex !== -1) {
                // Update the existing course with new highscore
                savedCourses[courseIndex].highScore = newScore;
                savedCourses[courseIndex].highScorePlayer2Path = this.gameStates.currentSessionBestPlayer2Path;
                localStorage.setItem('savedCourses', JSON.stringify(savedCourses));
                console.log(`Automatically updated highscore for course ${courseId}`);

                // If sidebar is open, refresh it to show updated scores
                if (this.savedCoursesSidebar.classList.contains('visible')) {
                    this.populateSavedCoursesSidebar(this.handleP1Done, this.redrawAllHelper, this.GAME_STATES);
                }
            }
        } catch (error) {
            console.error("Error updating highscore:", error);
        }
    }

    loadCourse(courseData, handleP1Done, redrawAllHelper, GAME_STATES) {
        // Store callback functions and constants for later use
        if (handleP1Done) this.handleP1Done = handleP1Done;
        if (redrawAllHelper) this.redrawAllHelper = redrawAllHelper;
        if (GAME_STATES) this.GAME_STATES = GAME_STATES;

        // Use stored values if not provided
        handleP1Done = handleP1Done || this.handleP1Done;
        redrawAllHelper = redrawAllHelper || this.redrawAllHelper;
        GAME_STATES = GAME_STATES || this.GAME_STATES;

        if (!courseData || !courseData.player1Path) {
            console.error("Invalid course data provided for loading.");
            return;
        }
        console.log(`Loading course: ${courseData.name} (ID: ${courseData.id})`);

        // Reset current game state partially
        // Hide screens first
        document.getElementById('victoryScreen').style.display = 'none';
        document.getElementById('defeatScreen').style.display = 'none';

        // Reset relevant state vars
        this.gameStates.player1Path = courseData.player1Path; // Use the loaded path
        this.gameStates.smoothedPath = [...this.gameStates.player1Path]; // Set smoothedPath as well
        this.gameStates.player2Path = [];
        this.gameStates.isDrawing = false;
        this.gameStates.lastPlayedProgressMilestone = 0;
        this.gameStates.startMarker = null; // Will be recalculated
        this.gameStates.endMarker = null;   // Will be recalculated
        this.gameStates.progressMarkers = [];
        this.gameStates.currentActiveSegmentIndex = 0;
        this.gameStates.maxAllowedPathLength = 0;
        this.gameStates.currentPathLength = 0;
        this.gameStates.fuelConsumed = 0;
        this.gameStates.previousCarPosition = null;
        this.gameStates.defeatFlagged = false;
        this.gameStates.carConfig = null;

        // Generate decorations for the loaded path
        const decorationDensity = 5; // Same density as when P1 finishes drawing
        const decorationOffset = this.gameStates.P1_WIDTH * 1.5; // Same offset as when P1 finishes

        // First generate all decorations
        let allDecorations = generateDecorationsForPath(this.gameStates.player1Path, decorationDensity, decorationOffset);

        // Then filter out decorations that are too close to the path
        const minDistanceToPath = this.gameStates.P1_WIDTH * 1.2; // Same threshold as used during P1 drawing
        this.gameStates.decorations = allDecorations.filter(decoration => {
            // Check distance to all path segments
            for (let i = 0; i < this.gameStates.player1Path.length - 1; i++) {
                const segmentStart = this.gameStates.player1Path[i];
                const segmentEnd = this.gameStates.player1Path[i + 1];
                const distance = pointLineSegmentDistance(decoration.position, segmentStart, segmentEnd);
                if (distance < minDistanceToPath) {
                    return false; // Remove decoration if too close to any segment
                }
            }
            return true; // Keep decoration if it's far enough from all segments
        });

        this.gameStates.tireMarks = [];

        // IMPORTANT: Set the session high score from the loaded course
        this.gameStates.currentSessionHighScore = courseData.highScore || 0;
        this.gameStates.currentSessionBestPlayer2Path = courseData.highScorePlayer2Path || [];

        // Update controls visibility
        document.getElementById('doneButton').style.display = 'none'; // P1 is done by loading
        document.getElementById('saveCourseButton').style.display = 'none'; // Hide P1 save button too
        document.getElementById('resetButton').style.display = 'inline-block';

        // Stop any ongoing car animation/sound
        if (this.gameStates.carAnimationFrame) {
            cancelAnimationFrame(this.gameStates.carAnimationFrame);
            this.gameStates.carAnimationFrame = null;
        }
        if (this.gameStates.engineSound) {
            this.gameStates.engineSound.stop();
            this.gameStates.engineSound = null;
        }

        // Stop screech sound if playing
        if (this.gameStates.screechSound) {
            this.gameStates.screechSound.stop();
            this.gameStates.screechSound = null;
        }

        this.gameStates.carProgress = 0;
        this.gameStates.carPosition = { x: 0, y: 0 };
        this.gameStates.carAngle = 0;
        this.gameStates.carTrail = [];
        this.gameStates.isScreeching = false;

        // Now, trigger the logic similar to handleP1Done to set up P2 phase
        if (typeof handleP1Done === 'function') {
            handleP1Done(); // This sets gameState.gameState to 'P2_WAITING' and redraws
        } else {
            // Fallback if handleP1Done is not provided or not a function
            console.warn("handleP1Done is not a function, using fallback");
            // Set up P2 phase manually
            // Check if GAME_STATES is null or undefined before using it
            if (GAME_STATES && GAME_STATES.P2_WAITING) {
                this.gameStates.gameState = GAME_STATES.P2_WAITING;
            } else {
                // If GAME_STATES is null, use a hardcoded string as fallback
                console.warn("GAME_STATES is null or missing P2_WAITING, using fallback string");
                this.gameStates.gameState = 'P2_WAITING';
            }
            this.gameStates.isDrawing = false;

            // Calculate path length and other necessary values
            const P1_WIDTH = this.gameStates.P1_WIDTH;
            const markerRadius = P1_WIDTH / 2 * this.gameStates.MARKER_RADIUS_FACTOR;

            if (this.gameStates.player1Path.length >= 2) {
                // Calculate total length
                const calculatePathLength = (path) => {
                    let length = 0;
                    for (let i = 0; i < path.length - 1; i++) {
                        const dx = path[i+1].x - path[i].x;
                        const dy = path[i+1].y - path[i].y;
                        length += Math.sqrt(dx*dx + dy*dy);
                    }
                    return length;
                };

                this.gameStates.player1TotalLength = calculatePathLength(this.gameStates.player1Path);
                this.gameStates.maxAllowedPathLength = this.gameStates.player1TotalLength * this.gameStates.MAX_PATH_LENGTH_FACTOR;

                // Set start and end markers
                this.gameStates.startMarker = { 
                    ...this.gameStates.player1Path[0], 
                    radius: markerRadius, 
                    snapRadius: markerRadius * this.gameStates.START_END_SNAP_RADIUS_FACTOR 
                };

                this.gameStates.endMarker = { 
                    ...this.gameStates.player1Path[this.gameStates.player1Path.length - 1], 
                    radius: markerRadius, 
                    snapRadius: markerRadius * this.gameStates.START_END_SNAP_RADIUS_FACTOR 
                };
            }

            // Redraw if redrawAllHelper is available
            if (typeof redrawAllHelper === 'function') {
                redrawAllHelper();
            }
        }

        this.closeSidebar(); // Close sidebar after loading
        this.statusDiv.textContent = `Ladattu rata: ${courseData.name}. Pelaaja 2: Seuraa polkua.`;

        // Add tracking of loaded course ID
        window.currentLoadedCourseId = courseData.id;
    }

    // Additional methods will be added in subsequent updates

    // UI methods
    openSidebar(handleP1Done, redrawAllHelper, GAME_STATES) {
        // Pass callback functions and constants to populateSavedCoursesSidebar
        this.populateSavedCoursesSidebar(handleP1Done, redrawAllHelper, GAME_STATES); // Load content when opening
        this.savedCoursesSidebar.classList.add('visible');
        document.body.classList.add('body-sidebar-open');
    }

    closeSidebar() {
        this.savedCoursesSidebar.classList.remove('visible');
        document.body.classList.remove('body-sidebar-open');
    }

    deleteCourse(courseId) {
        if (!courseId) {
            return;
        }
        console.log(`Attempting to delete course: ${courseId}`);
        try {
            let savedCourses = JSON.parse(localStorage.getItem('savedCourses') || '[]');
            const initialLength = savedCourses.length;
            savedCourses = savedCourses.filter(course => course.id !== courseId);

            if (savedCourses.length < initialLength) {
                localStorage.setItem('savedCourses', JSON.stringify(savedCourses));
                console.log(`Course ${courseId} deleted.`);
                // Refresh the sidebar to remove the thumbnail visually
                this.populateSavedCoursesSidebar(this.handleP1Done, this.redrawAllHelper, this.GAME_STATES);
                return true; // Indicate success
            } else {
                console.warn(`Course ${courseId} not found for deletion.`);
                return false;
            }
        } catch (error) {
            console.error("Error deleting course:", error);
            alert("Radan poistaminen epäonnistui.");
            return false;
        }
    }

    getStarRatingHTML(score) {
        const maxStars = 5;
        let stars = 0;
        // sourcery skip: use-braces
        if (score >= 90) stars = 5;
        else if (score >= 80) stars = 4;
        else if (score >= 70) stars = 3;
        else if (score >= 60) stars = 2;
        else if (score >= 50) stars = 1;

        let html = '';
        for (let i = 0; i < stars; i++) {
            html += '⭐'; // Full star
        }
        for (let i = stars; i < maxStars; i++) {
            // html += '☆'; // Outline star (optional)
        }
        return html;
    }

    populateSavedCoursesSidebar(handleP1Done, redrawAllHelper, GAME_STATES) {
        // Store callback functions and constants for later use
        if (handleP1Done) this.handleP1Done = handleP1Done;
        if (redrawAllHelper) this.redrawAllHelper = redrawAllHelper;
        if (GAME_STATES) this.GAME_STATES = GAME_STATES;

        // Use stored values if not provided
        handleP1Done = handleP1Done || this.handleP1Done;
        redrawAllHelper = redrawAllHelper || this.redrawAllHelper;
        GAME_STATES = GAME_STATES || this.GAME_STATES;

        this.sidebarContent.innerHTML = '';
        try {
            const savedCourses = JSON.parse(localStorage.getItem('savedCourses') || '[]');
            if (savedCourses.length === 0) {
                this.sidebarContent.innerHTML = '<p style="text-align: center; color: #666;">Ei tallennettuja ratoja.</p>';
                return;
            }

            savedCourses.forEach(course => {
                if (!course || !course.id || !course.player1Path) {
                    console.warn("Skipping invalid course data:", course);
                    return;
                }

                const container = document.createElement('div');
                container.className = 'thumbnail-container';
                container.draggable = true;
                container.dataset.courseId = course.id;

                // Improved touch handling
                let touchStartTime = 0;
                let touchStartX = 0;
                let touchStartY = 0;
                let isTapping = false;
                let isScrolling = false;

                container.addEventListener('touchstart', (e) => {
                    touchStartTime = Date.now();
                    touchStartX = e.touches[0].clientX;
                    touchStartY = e.touches[0].pageY;
                    isTapping = true;
                    isScrolling = false;
                }, { passive: true });

                container.addEventListener('touchmove', (e) => {
                    if (!isTapping) {
                        return;
                    }

                    const touchCurrentX = e.touches[0].clientX;
                    const touchCurrentY = e.touches[0].pageY;
                    const deltaX = Math.abs(touchCurrentX - touchStartX);
                    const deltaY = Math.abs(touchCurrentY - touchStartY);

                    // If vertical movement is greater, it's probably a scroll
                    if (deltaY > deltaX && deltaY > 10) {
                        isScrolling = true;
                        isTapping = false;
                    }
                    // If horizontal movement is greater, might be trying to drag
                    else if (deltaX > deltaY && deltaX > 10) {
                        isTapping = false;
                        // Could initiate drag here if needed
                    }
                }, { passive: true });

                container.addEventListener('touchend', (e) => {
                    if (isScrolling || !isTapping) {
                        return;
                    }

                    const touchEndTime = Date.now();
                    const touchEndX = e.changedTouches[0].clientX;
                    const touchEndY = e.changedTouches[0].pageY;

                    const touchDuration = touchEndTime - touchStartTime;
                    const touchDistance = Math.sqrt(
                        Math.pow(touchEndX - touchStartX, 2) +
                        Math.pow(touchEndY - touchStartY, 2)
                    );

                    // If it was a quick tap with minimal movement
                    if (touchDuration < 200 && touchDistance < 10) {
                        // Use stored values if parameters are null
                        const effectiveHandleP1Done = handleP1Done || this.handleP1Done;
                        const effectiveRedrawAllHelper = redrawAllHelper || this.redrawAllHelper;
                        const effectiveGAME_STATES = GAME_STATES || this.GAME_STATES;

                        this.loadCourse(course, effectiveHandleP1Done, effectiveRedrawAllHelper, effectiveGAME_STATES);
                    }

                    isTapping = false;
                }, { passive: true });

                // Rest of the container setup...
                const canvasEl = document.createElement('canvas');
                canvasEl.className = 'thumbnail-canvas';
                canvasEl.width = this.THUMBNAIL_WIDTH;
                canvasEl.height = this.THUMBNAIL_HEIGHT;

                const starsEl = document.createElement('div');
                starsEl.className = 'thumbnail-stars';
                starsEl.innerHTML = this.getStarRatingHTML(course.highScore || 0);

                container.appendChild(canvasEl);
                container.appendChild(starsEl);
                this.sidebarContent.appendChild(container);

                // Draw after appending
                this.drawThumbnail(canvasEl, course.player1Path);

                // Drag handlers
                container.addEventListener('dragstart', (e) => {
                    e.target.classList.add('dragging');
                    this.handleThumbnailDragStart(e);
                });

                container.addEventListener('dragend', (e) => {
                    e.target.classList.remove('dragging');
                    this.handleThumbnailDragEnd(e);
                });

                // Add click handler for desktop users
                container.addEventListener('click', () => {
                    // Use stored values if parameters are null
                    const effectiveHandleP1Done = handleP1Done || this.handleP1Done;
                    const effectiveRedrawAllHelper = redrawAllHelper || this.redrawAllHelper;
                    const effectiveGAME_STATES = GAME_STATES || this.GAME_STATES;

                    this.loadCourse(course, effectiveHandleP1Done, effectiveRedrawAllHelper, effectiveGAME_STATES);
                });
            });

        } catch (error) {
            console.error("Error loading saved courses for sidebar:", error);
            this.sidebarContent.innerHTML = '<p style="color: red;">Radan lataus epäonnistui.</p>';
        }
    }

    // Drag and drop handlers
    handleThumbnailDragStart(e) {
        // Check if it's a valid thumbnail container
        if (e.target.classList.contains('thumbnail-container')) {
            this.gameStates.draggedCourseId = e.target.dataset.courseId;
            e.dataTransfer.setData('text/plain', this.gameStates.draggedCourseId);
            e.dataTransfer.effectAllowed = 'move'; // Indicate moving is allowed
            this.showTrashCan(); // Show trashcan when dragging starts
            // Optional: Add a dragging style to the thumbnail
            e.target.style.opacity = '0.5';
        } else {
            e.preventDefault(); // Prevent dragging if not the container
        }
    }

    handleThumbnailDragEnd(e) {
        // Check if it's a valid thumbnail container ending drag
        if (e.target.classList.contains('thumbnail-container')) {
            // Restore appearance
            e.target.style.opacity = '1';
            this.hideTrashCan(); // Always hide trashcan when drag ends
            this.gameStates.draggedCourseId = null; // Clear the dragged ID
        }
    }

    handleCanvasDragOver(e) {
        e.preventDefault(); // Necessary to allow dropping
        e.dataTransfer.dropEffect = 'move'; // Indicate dropping is possible
        // Optional: Add visual feedback to canvas (e.g., border)
    }

    handleCanvasDrop(e, handleP1Done, redrawAllHelper, GAME_STATES) {
        e.preventDefault();
        const courseId = e.dataTransfer.getData('text/plain');
        if (courseId) {
            try {
                const savedCourses = JSON.parse(localStorage.getItem('savedCourses') || '[]');
                const courseToLoad = savedCourses.find(c => c.id === courseId);
                if (courseToLoad) {
                    this.loadCourse(courseToLoad, handleP1Done, redrawAllHelper, GAME_STATES);
                } else {
                    console.error(`Course with ID ${courseId} not found in localStorage.`);
                }
            } catch (error) {
                console.error("Error loading course on drop:", error);
            }
        }
        this.hideTrashCan();
    }

    handleTrashDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        this.trashCan.classList.add('active-drop');
    }

    handleTrashDragLeave(e) {
        this.trashCan.classList.remove('active-drop');
    }

    handleTrashDrop(e) {
        e.preventDefault();
        const courseId = e.dataTransfer.getData('text/plain');
        if (courseId) {
            this.deleteCourse(courseId);
        }
        this.hideTrashCan();
    }

    showTrashCan() {
        this.trashCan.style.display = 'block';
    }

    hideTrashCan() {
        this.trashCan.style.display = 'none';
        this.trashCan.classList.remove('active-drop'); // Remove hover effect
    }

    drawThumbnail(canvasElement, path) {
        const thumbCtx = canvasElement.getContext('2d');
        const { width, height } = canvasElement;

        thumbCtx.clearRect(0, 0, width, height);

        if (!path || path.length < 2) {
            return;
        }

        // Find path bounds
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        path.forEach(p => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        });

        const pathWidth = maxX - minX;
        const pathHeight = maxY - minY;

        // Handle cases where path is a point or a straight vertical/horizontal line
        const effectivePathWidth = pathWidth === 0 ? 1 : pathWidth; // Give it minimal width/height if zero
        const effectivePathHeight = pathHeight === 0 ? 1 : pathHeight;

        // Calculate scale to fit within padded area
        const availableWidth = width - 2 * this.THUMBNAIL_PADDING;
        const availableHeight = height - 2 * this.THUMBNAIL_PADDING;
        // Ensure available dimensions are positive
        if (availableWidth <= 0 || availableHeight <= 0) {
            return;
        }

        const scale = Math.min(availableWidth / effectivePathWidth, availableHeight / effectivePathHeight);

        // Calculate translation to center the scaled path
        const scaledWidth = effectivePathWidth * scale;
        const scaledHeight = effectivePathHeight * scale;
        const offsetX = this.THUMBNAIL_PADDING + (availableWidth - scaledWidth) / 2;
        const offsetY = this.THUMBNAIL_PADDING + (availableHeight - scaledHeight) / 2;
        // Adjust translation based on the original min points and the calculated scale/offset
        const translateX = offsetX - minX * scale;
        const translateY = offsetY - minY * scale;

        // Draw the scaled path
        thumbCtx.strokeStyle = this.P1_COLOR;
        thumbCtx.lineWidth = 5; // Increased line width to match marker size visually
        thumbCtx.lineCap = 'round';
        thumbCtx.lineJoin = 'round';
        thumbCtx.beginPath();
        thumbCtx.moveTo(path[0].x * scale + translateX, path[0].y * scale + translateY);
        for (let i = 1; i < path.length; i++) {
            thumbCtx.lineTo(path[i].x * scale + translateX, path[i].y * scale + translateY);
        }
        thumbCtx.stroke();

        // Draw start/end markers (size remains 5)
        thumbCtx.fillStyle = this.START_COLOR;
        thumbCtx.beginPath();
        thumbCtx.arc(path[0].x * scale + translateX, path[0].y * scale + translateY, 5, 0, Math.PI * 2);
        thumbCtx.fill();

        // Ensure there's a distinct end point before drawing the end marker
        if (path.length > 1) {
            thumbCtx.fillStyle = this.END_COLOR;
            thumbCtx.beginPath();
            thumbCtx.arc(path[path.length - 1].x * scale + translateX, path[path.length - 1].y * scale + translateY, 5, 0, Math.PI * 2);
            thumbCtx.fill();
        }
    }
}
