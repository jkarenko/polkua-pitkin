// Emoji particle system for effects
const PARTICLE_COUNT = 20; // Number of particles per explosion
const PARTICLE_LIFETIME = 5000; // How long particles live in milliseconds
const PARTICLE_SPEED = 2; // Base speed of particles
const PARTICLE_SPREAD = Math.PI * 2; // Full circle spread
const PARTICLE_SIZE = 40; // Size of emoji particles
const GRAVITY = 0.05; // Gravity effect on particles
const FRICTION = 0.99; // Air resistance effect

/**
 * Represents a single emoji particle
 */
class EmojiParticle {
    constructor(x, y, emoji, angle, speed) {
        this.x = x;
        this.y = y;
        this.emoji = emoji;
        this.angle = angle;
        this.speed = speed;
        this.velocityX = Math.cos(angle) * speed;
        this.velocityY = Math.sin(angle) * speed;
        this.life = PARTICLE_LIFETIME;
        this.rotation = Math.random() * Math.PI * 2; // Random initial rotation
        this.rotationSpeed = (Math.random() - 0.5) * 0.2; // Random rotation speed
    }

    update() {
        // Update position
        this.x += this.velocityX;
        this.y += this.velocityY;

        // Apply gravity
        this.velocityY += GRAVITY;

        // Apply friction
        this.velocityX *= FRICTION;
        this.velocityY *= FRICTION;

        // Update rotation
        this.rotation += this.rotationSpeed;

        // Decrease life
        this.life -= 16; // Assuming 60fps (1000ms/60 ≈ 16.67ms per frame)

        return this.life > 0;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.font = `${PARTICLE_SIZE}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.emoji, 0, 0);
        ctx.restore();
    }
}

/**
 * Creates an explosion of emoji particles at the specified coordinates
 * @param {number} x - X coordinate of explosion origin
 * @param {number} y - Y coordinate of explosion origin
 * @returns {Array<EmojiParticle>} Array of new particles
 */
export function createEmojiExplosion(x, y) {
    const EMOJI_PARTICLES = ['😀', '⭐', '🎈', '❤️', '💯', '✅', '👍'];
    const particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const angle = (PARTICLE_SPREAD / PARTICLE_COUNT) * i;
        const speed = PARTICLE_SPEED * (1.5 + Math.random() * 0.4); // Slight random variation in speed
        const emoji = EMOJI_PARTICLES[Math.floor(Math.random() * EMOJI_PARTICLES.length)];
        particles.push(new EmojiParticle(x, y, emoji, angle, speed));
    }
    return particles;
}

/**
 * Updates and draws all particles in the array
 * @param {CanvasRenderingContext2D} ctx - The canvas context to draw to
 * @param {Array<EmojiParticle>} particles - Array of particles to update and draw
 */
export function updateAndDrawParticles(ctx, particles) {
    // Update and draw each particle
    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        if (!particle.update()) {
            // Remove dead particles
            particles.splice(i, 1);
        } else {
            particle.draw(ctx);
        }
    }
}

/**
 * Creates a victory celebration effect with multiple explosions
 * @param {number} x - X coordinate of celebration origin
 * @param {number} y - Y coordinate of celebration origin
 * @returns {Array<EmojiParticle>} Array of new particles
 */
export function createVictoryCelebration(x, y) {
    const particles = [];
    // Create multiple explosions in a circular pattern
    for (let i = 0; i < 5; i++) {
        const angle = (Math.PI * 2 / 5) * i;
        const radius = 30; // Distance from center
        const explosionX = x + Math.cos(angle) * radius;
        const explosionY = y + Math.sin(angle) * radius;
        particles.push(...createEmojiExplosion(explosionX, explosionY));
    }
    return particles;
}

/**
 * Creates a crash effect with debris particles
 * @param {number} x - X coordinate of crash origin
 * @param {number} y - Y coordinate of crash origin
 * @returns {Array<EmojiParticle>} Array of new particles
 */
export function createCrashEffect(x, y) {
    const particles = [];
    // Create a more concentrated explosion with specific crash-related emojis
    const CRASH_EMOJIS = ['💥', '💫', '💨', '🚗', '⚠️'];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const angle = (PARTICLE_SPREAD / PARTICLE_COUNT) * i;
        const speed = PARTICLE_SPEED * 1.5; // Faster particles for crash effect
        const emoji = CRASH_EMOJIS[Math.floor(Math.random() * CRASH_EMOJIS.length)];
        particles.push(new EmojiParticle(x, y, emoji, angle, speed));
    }
    return particles;
}

/**
 * Creates an out of fuel effect with particles spraying upward
 * @param {number} x - X coordinate of effect origin
 * @param {number} y - Y coordinate of effect origin
 * @returns {Array<EmojiParticle>} Array of new particles
 */
export function createOutOfFuelEffect(x, y) {
    const particles = [];
    const FUEL_EMOJIS = ['💀', '⚡', '💩', '😡', '🤬', '💢', '💥'];
    const SPRAY_ANGLE = Math.PI / 2; // 90 degrees
    const SPRAY_START = -Math.PI / 4; // Start at -45 degrees from vertical

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const emoji = FUEL_EMOJIS[Math.floor(Math.random() * FUEL_EMOJIS.length)];
        const particle = new EmojiParticle(x, y, emoji, 0, 0); // Create with zero initial velocity

        // Calculate random spread within 90-degree arc
        const spreadAngle = SPRAY_START + (Math.random() * SPRAY_ANGLE);
        const speed = PARTICLE_SPEED * (1.2 + Math.random() * 0.6);

        // Set velocities directly for upward movement
        particle.velocityX = Math.sin(spreadAngle) * speed;
        particle.velocityY = -Math.cos(spreadAngle) * speed; // Negative for upward movement

        particles.push(particle);
    }
    return particles;
} 
