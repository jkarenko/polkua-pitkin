// Helper function for random numbers
function random(min, max) {
    return Math.random() * (max - min) + min;
}

// --- Decoration Generators ---

function createTree(position) {
    const trunkHeight = random(15, 30);
    const trunkWidth = random(3, 6);
    const canopyRadius = random(10, 20);
    const canopyColor = `rgb(${random(0, 50)}, ${random(100, 200)}, ${random(0, 50)})`; // Shades of green

    return {
        type: 'tree',
        position: { ...position },
        trunkHeight,
        trunkWidth,
        canopyRadius,
        trunkColor: '#8B4513', // Brown
        canopyColor,
        getLowestY: function () {
            // The lowest point is the base of the trunk
            return this.position.y;
        },
        draw: function (ctx) {
            // Draw trunk
            ctx.fillStyle = this.trunkColor;
            ctx.fillRect(
                this.position.x - this.trunkWidth / 2,
                this.position.y - this.trunkHeight,
                this.trunkWidth,
                this.trunkHeight
            );
            // Draw canopy
            ctx.fillStyle = this.canopyColor;
            ctx.beginPath();
            ctx.arc(
                this.position.x,
                this.position.y - this.trunkHeight - this.canopyRadius * 0.5, // Canopy slightly overlaps trunk
                this.canopyRadius,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }
    };
}

function createBush(position) {
    const radius = random(5, 15);
    const color = `rgb(${random(0, 50)}, ${random(80, 180)}, ${random(0, 50)})`; // Darker greens
    const shapePoints = [];
    const numPoints = 5;
    let maxY = position.y;
    for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        const r = radius * random(0.8, 1.2);
        const x = position.x + r * Math.cos(angle);
        const y = position.y + r * Math.sin(angle);
        shapePoints.push({ x, y });
        maxY = Math.max(maxY, y);
    }

    return {
        type: 'bush',
        position: { ...position },
        radius,
        color,
        shapePoints,
        calculatedMaxY: maxY,
        getLowestY: function () {
            return this.calculatedMaxY;
        },
        draw: function (ctx) {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.moveTo(this.shapePoints[0].x, this.shapePoints[0].y);
            for (let i = 1; i < this.shapePoints.length; i++) {
                ctx.lineTo(this.shapePoints[i].x, this.shapePoints[i].y);
            }
            ctx.closePath();
            ctx.fill();
        }
    };
}

function createRock(position) {
    const size = random(5, 12);
    const color = `rgb(${random(100, 150)}, ${random(100, 150)}, ${random(100, 150)})`; // Shades of gray

    // Generate random vertices for a polygonal rock shape
    const vertices = [];
    const numVertices = Math.floor(random(5, 8));
    for (let i = 0; i < numVertices; i++) {
        const angle = (i / numVertices) * Math.PI * 2 + random(-0.2, 0.2);
        const radius = size * random(0.7, 1.1);
        vertices.push({
            x: position.x + radius * Math.cos(angle),
            y: position.y + radius * Math.sin(angle)
        });
    }
    // Ensure the base is somewhat flat
    vertices.sort((a, b) => a.y - b.y);
    vertices[vertices.length - 1].y = Math.max(vertices[vertices.length - 1].y, position.y + size * 0.3);
    if (vertices.length > 1) {
        vertices[vertices.length - 2].y = Math.max(vertices[vertices.length - 2].y, position.y + size * 0.2);
    }
    vertices.sort((a, b) => Math.atan2(a.y - position.y, a.x - position.x) - Math.atan2(b.y - position.y, b.x - position.x));

    let maxY = position.y;
    vertices.forEach(v => maxY = Math.max(maxY, v.y));

    return {
        type: 'rock',
        position: { ...position },
        size,
        color,
        vertices,
        calculatedMaxY: maxY,
        getLowestY: function () {
            return this.calculatedMaxY;
        },
        draw: function (ctx) {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
            for (let i = 1; i < this.vertices.length; i++) {
                ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
            }
            ctx.closePath();
            ctx.fill();
        }
    };
}

function createHouse(position) {
    const width = random(30, 60);
    const height = random(25, 40);
    const roofHeight = height * random(0.5, 0.8);
    const bodyColor = `hsl(${random(0, 360)}, 50%, 70%)`; // Random pastel color
    const roofColor = `rgb(${random(100, 150)}, ${random(50, 80)}, ${random(20, 50)})`; // Shades of brown/red
    const doorHeight = height * 0.5;

    return {
        type: 'house',
        position: { ...position }, // Position is the bottom-center
        width,
        height,
        roofHeight,
        bodyColor,
        roofColor,
        doorHeight,
        getLowestY: function () {
            // The lowest point is the base of the house body/door
            return this.position.y;
        },
        draw: function (ctx) {
            const x = this.position.x - this.width / 2;
            const y = this.position.y - this.height; // Base Y position

            // Draw body
            ctx.fillStyle = this.bodyColor;
            ctx.fillRect(x, y, this.width, this.height);

            // Draw roof
            ctx.fillStyle = this.roofColor;
            ctx.beginPath();
            ctx.moveTo(x - 5, y); // Left overhang
            ctx.lineTo(x + this.width / 2, y - this.roofHeight); // Peak
            ctx.lineTo(x + this.width + 5, y); // Right overhang
            ctx.closePath();
            ctx.fill();

            // Optional: Draw a simple door
            ctx.fillStyle = '#654321'; // Dark brown
            ctx.fillRect(
                this.position.x - this.width / 2,
                this.position.y - this.doorHeight,
                this.width,
                this.doorHeight
            );
        }
    };
}

function createPerson(position) {
    const headRadius = 5;
    const bodyHeight = 15;
    const bodyWidth = 6;
    const legHeight = 10;
    const shirtColor = `hsl(${random(0, 360)}, 70%, 60%)`;
    const pantsColor = `hsl(${random(180, 260)}, 50%, 40%)`; // Blues/Grays

    return {
        type: 'person',
        position: { ...position }, // Position is the feet center
        headRadius,
        bodyHeight,
        bodyWidth,
        legHeight,
        shirtColor,
        pantsColor,
        skinColor: '#F5D6BA', // Simple skin tone
        getLowestY: function () {
            // The lowest point is the bottom of the feet
            return this.position.y;
        },
        draw: function (ctx) {
            const headY = this.position.y - this.legHeight - this.bodyHeight - this.headRadius;
            const bodyY = this.position.y - this.legHeight - this.bodyHeight;
            const legY = this.position.y - this.legHeight;

            // Draw legs
            ctx.fillStyle = this.pantsColor;
            ctx.fillRect(this.position.x - this.bodyWidth / 2, legY, this.bodyWidth / 2 - 0.5, this.legHeight); // Left leg
            ctx.fillRect(this.position.x + 0.5, legY, this.bodyWidth / 2 - 0.5, this.legHeight); // Right leg

            // Draw body
            ctx.fillStyle = this.shirtColor;
            ctx.fillRect(this.position.x - this.bodyWidth / 2, bodyY, this.bodyWidth, this.bodyHeight);

            // Draw head
            ctx.fillStyle = this.skinColor;
            ctx.beginPath();
            ctx.arc(this.position.x, headY, this.headRadius, 0, Math.PI * 2);
            ctx.fill();
        }
    };
}


// --- Main Generator Function ---

const decorationTypes = [
    { generator: createTree, weight: 5 },
    { generator: createBush, weight: 4 },
    { generator: createRock, weight: 3 },
    { generator: createHouse, weight: 1 },
    { generator: createPerson, weight: 1 },
];

const totalWeight = decorationTypes.reduce((sum, type) => sum + type.weight, 0);

/**
 * Generates a random roadside decoration object at the given position.
 * @param {object} position - The {x, y} coordinates for the decoration's base.
 * @returns {object} A decoration object with type, position, and a draw method.
 */
export function generateRandomDecoration(position) {
    let randomWeight = random(0, totalWeight);
    for (const type of decorationTypes) {
        if (randomWeight < type.weight) {
            return type.generator(position);
        }
        randomWeight -= type.weight;
    }
    // Fallback to tree if something goes wrong
    return createTree(position);
}

/**
 * Generates an array of decorations along a path segment.
 * @param {object} p1 - Start point of the segment {x, y}.
 * @param {object} p2 - End point of the segment {x, y}.
 * @param {number} density - Average number of decorations per 100 pixels.
 * @param {number} offsetDistance - Distance to offset decorations from the path.
 * @returns {Array<object>} An array of decoration objects.
 */
export function generateDecorationsAlongSegment(p1, p2, density, offsetDistance) {
    const decorations = [];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const segmentLength = Math.sqrt(dx * dx + dy * dy);
    const numDecorations = Math.floor(segmentLength * (density / 100) * random(0.8, 1.2)); // Add some randomness

    const normX = dx / segmentLength;
    const normY = dy / segmentLength;

    // Perpendicular vector (rotated 90 degrees)
    const perpX_left = -normY;
    const perpY_left = normX;
    const perpX_right = normY;
    const perpY_right = -normX;

    for (let i = 0; i < numDecorations; i++) {
        const t = random(0.1, 0.9); // Position along the segment (avoid ends)
        const pathX = p1.x + t * dx;
        const pathY = p1.y + t * dy;

        const side = Math.random() < 0.5 ? 'left' : 'right';
        const actualOffset = offsetDistance * random(0.8, 2.0); // Vary offset distance

        let decorationX, decorationY;
        if (side === 'left') {
            decorationX = pathX + perpX_left * actualOffset;
            decorationY = pathY + perpY_left * actualOffset;
        } else {
            decorationX = pathX + perpX_right * actualOffset;
            decorationY = pathY + perpY_right * actualOffset;
        }

        decorations.push(generateRandomDecoration({ x: decorationX, y: decorationY }));
    }

    return decorations;
}

/**
 * Generates decorations along an entire path.
 * @param {Array<object>} path - Array of {x, y} points.
 * @param {number} density - Average number of decorations per 100 pixels.
 * @param {number} offsetDistance - Distance to offset decorations from the path.
 * @returns {Array<object>} An array of decoration objects.
 */
export function generateDecorationsForPath(path, density, offsetDistance) {
    let allDecorations = [];
    for (let i = 0; i < path.length - 1; i++) {
        const segmentDecorations = generateDecorationsAlongSegment(
            path[i],
            path[i + 1],
            density,
            offsetDistance
        );
        allDecorations = allDecorations.concat(segmentDecorations);
    }
    return allDecorations;
} 
