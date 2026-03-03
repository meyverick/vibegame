<script lang="ts">
	/** Version: 1.0.2 - Triggering deployment sync */
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { settings } from '$lib/settings.svelte';

	interface LeaderboardEntry {
		username: string;
		score: number;
		timestamp: number;
		message?: string;
	}

	interface Particle {
		id: number;
		x: number;
		y: number;
		vx: number;
		vy: number;
		size: number;
		life: number;
		effectType: string;
		color?: string;
		emoji?: string;
	}

	let m = $state({ x: 0, y: 0 });
	let charPos = $state({ x: 100, y: 100 });
	let targetPos = $state({ x: 100, y: 100 });
	let isFollowingClick = $state(false);
	let velocity = $state({ x: 0, y: 0 });
	let rotation = $state(0);
	let score = $state(0);
	let isLoopRunning = $state(true);
	let globalBest: LeaderboardEntry | null = $state(null);
	let leaderboardTTL = $state(0);
	let showHighScorePrompt = $state(false);
	let showCustomizer = $state(false);
	let showRichModal = $state(false);
	let showNothingModal = $state(false);
	let newHighScoreUsername = $state('');
	let newHighScoreMessage = $state('');
	let isSubmitting = $state(false);
	let sessionToken = $state('');
	let statusMessage = $state('');

	let lastScores: number[] = $state([]);
	let gameOver = $state(false);
	const deathMessages = [
		'Forgot to pay the gravity bill.',
		'Spilled space coffee on the dashboard.',
		'Quantum sneezing fit.',
		'Ran into a celestial parking ticket.',
		'Physics engine took a lunch break.',
		'Mistook a black hole for a shortcut.',
		'GPS: Recalculating... infinitely.',
		'You are now 100% pasta.'
	];
	let currentDeathMessage = $state(deathMessages[0]);

	let isShaking = $state(false);

	let timeScale = $state(1.0);
	let timeWarpActive = $state(false);
	let personalBest = $state(0);

	let timeWarpBonus = $state({
		x: -100,
		y: -100,
		active: false
	});

	let tower = $state({
		active: false,
		level: 0,
		x: 0,
		y: 0,
		attackTimer: 0
	});

	let towerBonus = $state({
		x: -100,
		y: -100,
		active: false
	});

	let towerLaser = $state({
		active: false,
		x1: 0,
		y1: 0,
		x2: 0,
		y2: 0,
		angle: 0,
		length: 0
	});

	let activeRadioMessage: { username: string; text: string } | null = $state(null);
	let radioCooldown = $state(0);
	let hasShownRadioMessage = $state(false);

	let activeLaser = $state({
		active: false,
		x1: 0,
		y1: 0,
		x2: 0,
		y2: 0,
		angle: 0,
		length: 0
	});

	let pendingTimeouts: ReturnType<typeof setTimeout>[] = [];

	function safeTimeout(fn: () => void, delay: number) {
		const timeout = setTimeout(() => {
			fn();
			pendingTimeouts = pendingTimeouts.filter((t) => t !== timeout);
		}, delay);
		pendingTimeouts.push(timeout);
		return timeout;
	}

	function clearAllTimeouts() {
		pendingTimeouts.forEach(clearTimeout);
		pendingTimeouts = [];
	}

	// Velocity magnitude for logic
	let velocityMagnitude = $derived(Math.sqrt(velocity.x ** 2 + velocity.y ** 2));

	// Sync loop state with global pause for layout animations
	$effect(() => {
		settings.isPaused = !isLoopRunning;
		return () => {
			settings.isPaused = false;
		};
	});

	// The ship should evolve based on the current run's score OR the all-time local best
	let effectiveBest = $derived(Math.max(score, personalBest));

	let playerEmoji = $derived.by(() => {
		if (effectiveBest >= 1500) return '👾';
		if (effectiveBest >= 750) return '🛰️';
		if (effectiveBest >= 250) return '🛸';
		return '🚀';
	});

	let particles: Particle[] = $state([]);
	let zapBonus = $state({
		x: -100,
		y: -100,
		active: false
	});

	let hasShield = $state(false);
	let shieldBonus = $state({
		x: -100,
		y: -100,
		active: false
	});

	let taxCollector = $state({
		x: -100,
		y: -100,
		active: false,
		vx: 0,
		vy: 0
	});

	let taxedPopup = $state({
		active: false,
		x: 0,
		y: 0,
		timer: 0,
		text: 'TAXED!'
	});

	const junkEmojis = ['🚽', '🍌', '🛋️', '📦', '🪑'];

	let planet = $state({
		x: 200,
		y: 300,
		vx: (Math.random() - 0.5) * 2,
		vy: (Math.random() - 0.5) * 2,
		exploded: false
	});

	let meteorites = $state([
		{
			id: Math.random(),
			x: 100,
			y: -150,
			speed: 6 + Math.random() * 8,
			vx: (Math.random() - 0.5) * 4,
			angle: 0,
			type: '☄️'
		}
	]);

	const acceleration = 0.5;
	const friction = 0.98;
	const charSize = 40;
	const planetSize = 80;
	const minPullForce = 0.01;
	const maxPullForce = 0.2;
	const pullRadius = 1536;

	let warp = $state({
		x: 400,
		y: 400,
		vx: 5.0,
		vy: 3.0,
		size: 150,
		angle: 0
	});

	let keys: Record<string, boolean> = $state({
		ArrowUp: false,
		ArrowDown: false,
		ArrowLeft: false,
		ArrowRight: false
	});

	let isAnyKeyPressed = $derived(Object.values(keys).some((k) => k));

	let asteroids = $state(
		Array.from({ length: 5 }, (_, i) => ({
			id: i,
			x: 100 + i * 50,
			y: 100 + i * 50,
			exploded: false
		}))
	);

	let stars = $state(
		Array.from({ length: 1 }, (_, i) => ({
			id: i,
			top: Math.random() * 50 - 20, // Start higher up, some off-screen
			left: Math.random() * 100,
			angle: 30 + Math.random() * 120, // Falling downwards
			delay: Math.random() * 40,
			duration: 3 + Math.random() * 4
		}))
	);

	let color = $derived.by(() => {
		const hue = (m.x + m.y) % 360;
		return `hsla(${hue}, 100%, 50%, 0.15)`;
	});

	function triggerShake() {
		isShaking = true;
		safeTimeout(() => (isShaking = false), 500);
	}

	function unlockSupporter() {
		settings.isSupporter = true;
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('isSupporter', 'true');
		}
	}

	function handleBuyClick() {
		showRichModal = true;
	}

	function redirectToPaypal() {
		unlockSupporter();
		// Ko-fi redirect for the purchase in new tab
		window.open('https://ko-fi.com/meyverick', '_blank');
		showRichModal = false;
	}

	function redirectToDonation() {
		unlockSupporter();
		// Ko-fi redirect for donation in new tab
		window.open('https://ko-fi.com/meyverick', '_blank');
		showNothingModal = false;
	}

	function selectTrailEffect(effect: string) {
		if (effect !== 'classic' && !settings.isSupporter) return;
		settings.trailEffect = effect;
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('trailEffect', effect);
		}
	}

	function selectTrailColor(color: string) {
		if (!settings.isSupporter) return;
		settings.trailColor = color;
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('trailColor', color);
		}
	}

	function addParticles() {
		if (Math.abs(velocity.x) > 1 || Math.abs(velocity.y) > 1) {
			const id = Math.random();
			const effect = settings.trailEffect;

			let newParticle: Particle = {
				id,
				x: charPos.x + charSize / 2,
				y: charPos.y + charSize / 2,
				vx: -velocity.x * 0.2 + (Math.random() - 0.5),
				vy: -velocity.y * 0.2 + (Math.random() - 0.5),
				size: 5 + Math.random() * 10,
				life: 1,
				effectType: effect,
				color: settings.trailColor
			};

			if (effect === 'ghost') {
				newParticle.vx *= 0.1;
				newParticle.vy *= 0.1;
				newParticle.size = charSize;
				newParticle.emoji = playerEmoji;
			} else if (effect === 'plasma') {
				newParticle.size *= 1.5;
			} else if (effect === 'rainbow') {
				// Color handled in CSS via hue-rotate
			}

			particles = [...particles, newParticle];
		}
	}

	async function update() {
		if (!gameOver) {
			if (radioCooldown > 0) {
				radioCooldown -= 1 / 60; // Approximate seconds
			} else if (globalBest && globalBest.message && !activeRadioMessage && !hasShownRadioMessage) {
				// Show message from top player only once per game
				hasShownRadioMessage = true;
				activeRadioMessage = { username: globalBest.username, text: globalBest.message };
				safeTimeout(() => {
					activeRadioMessage = null;
				}, 5000); // Show for 5 seconds
			}

			// Update particles
			particles = particles
				.map((p) => ({
					...p,
					x: p.x + p.vx,
					y: p.y + p.vy,
					life: p.life - 0.05
				}))
				.filter((p) => p.life > 0);

			if (taxedPopup.active) {
				taxedPopup.timer -= 1;
				if (taxedPopup.timer <= 0) taxedPopup.active = false;
			}

			// Tax Collector Spawning (randomly every ~10 seconds)
			if (!taxCollector.active && Math.random() < 0.002) {
				const side = Math.floor(Math.random() * 4);
				if (typeof window !== 'undefined') {
					if (side === 0) {
						taxCollector.x = Math.random() * window.innerWidth;
						taxCollector.y = -50;
					} else if (side === 1) {
						taxCollector.x = window.innerWidth + 50;
						taxCollector.y = Math.random() * window.innerHeight;
					} else if (side === 2) {
						taxCollector.x = Math.random() * window.innerWidth;
						taxCollector.y = window.innerHeight + 50;
					} else {
						taxCollector.x = -50;
						taxCollector.y = Math.random() * window.innerHeight;
					}
					taxCollector.active = true;
				}
			}

			if (taxCollector.active) {
				const dx = charPos.x - taxCollector.x;
				const dy = charPos.y - taxCollector.y;
				const angle = Math.atan2(dy, dx);
				taxCollector.vx += Math.cos(angle) * 0.1 * timeScale;
				taxCollector.vy += Math.sin(angle) * 0.1 * timeScale;
				taxCollector.vx *= 1 - (1 - 0.98) * timeScale;
				taxCollector.vy *= 1 - (1 - 0.98) * timeScale;
				taxCollector.x += taxCollector.vx * timeScale;
				taxCollector.y += taxCollector.vy * timeScale;

				// Despawn if too far away
				if (typeof window !== 'undefined') {
					if (
						taxCollector.x < -200 ||
						taxCollector.x > window.innerWidth + 200 ||
						taxCollector.y < -200 ||
						taxCollector.y > window.innerHeight + 200
					) {
						taxCollector.active = false;
					}
				}
			}

			// Tower Attack logic
			if (tower.active) {
				tower.attackTimer -= 1 * timeScale;
				if (tower.attackTimer <= 0) {
					await towerAttack();
					// Base cooldown is 3s (90 frames at 30fps), reduces per level
					const cooldown = Math.max(15, 90 / (1 + tower.level * 0.5));
					tower.attackTimer = cooldown;
				}
			}

			// Time Warp Spawning (rarely)
			if (!timeWarpBonus.active && !timeWarpActive && Math.random() < 0.001) {
				spawnTimeWarpBonus();
			}

			// Tower Bonus Spawning (rarely)
			if (!towerBonus.active && Math.random() < 0.001) {
				spawnTowerBonus();
			}

			if (Math.abs(velocity.x) > 0.5 || Math.abs(velocity.y) > 0.5) {
				addParticles();
			}

			// Input handling
			const currentAccel = acceleration;

			if (isAnyKeyPressed) {
				isFollowingClick = false;
				if (keys.ArrowUp) velocity.y -= currentAccel;
				if (keys.ArrowDown) velocity.y += currentAccel;
				if (keys.ArrowLeft) velocity.x -= currentAccel;
				if (keys.ArrowRight) velocity.x += currentAccel;
			} else if (isFollowingClick) {
				const dx = targetPos.x - charPos.x;
				const dy = targetPos.y - charPos.y;
				const distance = Math.sqrt(dx * dx + dy * dy);

				if (distance > 10) {
					const angle = Math.atan2(dy, dx);
					velocity.x += Math.cos(angle) * currentAccel;
					velocity.y += Math.sin(angle) * currentAccel;
				} else {
					isFollowingClick = false;
				}
			}

			// Warp Movement & Gravity
			warp.x += warp.vx * timeScale;
			warp.y += warp.vy * timeScale;
			warp.angle += 1 * timeScale;

			if (typeof window !== 'undefined') {
				const margin = 50;
				if (warp.x < margin && warp.vx < 0) warp.vx *= -1;
				if (warp.x > window.innerWidth - margin && warp.vx > 0) warp.vx *= -1;
				if (warp.y < margin && warp.vy < 0) warp.vy *= -1;
				if (warp.y > window.innerHeight - margin && warp.vy > 0) warp.vy *= -1;
			}

			const dxW = warp.x - (charPos.x + charSize / 2);
			const dyW = warp.y - (charPos.y + charSize / 2);
			const distW = Math.sqrt(dxW * dxW + dyW * dyW);

			if (distW < pullRadius) {
				// Linear interpolation between maxPullForce (center) and minPullForce (edge)
				const t = 1 - distW / pullRadius; // 1 at center, 0 at edge
				const pull = (minPullForce + (maxPullForce - minPullForce) * t) * timeScale;

				const angleW = Math.atan2(dyW, dxW);
				velocity.x += Math.cos(angleW) * pull;
				velocity.y += Math.sin(angleW) * pull;
			}

			velocity.x *= friction;
			velocity.y *= friction;

			charPos.x += velocity.x;
			charPos.y += velocity.y;

			// Update planet position
			planet.x += planet.vx * timeScale;
			planet.y += planet.vy * timeScale;

			// Update meteorites position
			meteorites.forEach((m) => {
				m.y += m.speed * timeScale;
				m.x += m.vx * timeScale;
				// The comet emoji (☄️) is drawn at ~135 degrees (pointing down-right)
				// We want its head to point in the direction of velocity (atan2(speed, vx))
				m.angle = (Math.atan2(m.speed, m.vx) * 180) / Math.PI - 135;

				if (
					typeof window !== 'undefined' &&
					(m.y > window.innerHeight + 100 || m.x < -100 || m.x > window.innerWidth + 100)
				) {
					m.y = -150;
					m.x = Math.random() * window.innerWidth;
					m.vx = (Math.random() - 0.5) * 6;
					m.speed = 6 + Math.random() * 8;
					m.type =
						Math.random() < 0.05 ? junkEmojis[Math.floor(Math.random() * junkEmojis.length)] : '☄️';
				}
			});

			// Boundary checks
			if (typeof window !== 'undefined') {
				const margin = 30; // Half of character size roughly
				if (charPos.x < 0) {
					charPos.x = 0;
					velocity.x *= -0.5; // Slight bounce
				} else if (charPos.x > window.innerWidth - margin * 2) {
					charPos.x = window.innerWidth - margin * 2;
					velocity.x *= -0.5;
				}

				if (charPos.y < 0) {
					charPos.y = 0;
					velocity.y *= -0.5;
				} else if (charPos.y > window.innerHeight - margin * 2) {
					charPos.y = window.innerHeight - margin * 2;
					velocity.y *= -0.5;
				}

				// Planet boundary checks
				if (planet.x < 0 || planet.x > window.innerWidth - planetSize) {
					planet.vx *= -1;
				}
				if (planet.y < 0 || planet.y > window.innerHeight - planetSize) {
					planet.vy *= -1;
				}
			}

			// Calculate rotation based on velocity with smoothing
			if (Math.abs(velocity.x) > 0.1 || Math.abs(velocity.y) > 0.1) {
				const targetRotation = (Math.atan2(velocity.y, velocity.x) * 180) / Math.PI + 45; // Adjusted from +90 to +45 to account for 45deg oblique emoji
				// Smoothly interpolate towards the target rotation
				const diff = targetRotation - rotation;
				// Ensure it takes the shortest path
				const normalizedDiff = ((diff + 180) % 360) - 180;
				rotation += normalizedDiff * 0.1;
			}

			await checkCollisions();
		}
	}

	async function fetchLeaderboard() {
		try {
			const res = await fetch('/api/leaderboard');
			const data = await res.json();

			// Always update TTL if provided
			if (data && typeof data.resetIn === 'number') {
				leaderboardTTL = data.resetIn;
			}

			if (data && data.scores && data.scores.length > 0) {
				globalBest = data.scores[0];
			} else {
				globalBest = null;
			}
		} catch (e) {
			console.error('Failed to fetch leaderboard:', e);
		}
	}

	// Format TTL to HH:MM:SS
	let formattedTTL = $derived.by(() => {
		if (leaderboardTTL <= 0) return 'RESETTING...';
		const h = Math.floor(leaderboardTTL / 3600);
		const m = Math.floor((leaderboardTTL % 3600) / 60);
		const s = Math.floor(leaderboardTTL % 60);
		return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
	});

	async function startSession() {
		try {
			const res = await fetch('/api/leaderboard/session');
			const data = await res.json();
			sessionToken = data.token;
		} catch (e) {
			console.error('Failed to start session:', e);
		}
	}

	async function submitHighScore() {
		if (!newHighScoreUsername.trim() || isSubmitting) return;
		isSubmitting = true;
		statusMessage = '';
		try {
			const res = await fetch('/api/leaderboard', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					username: newHighScoreUsername,
					score: score,
					token: sessionToken,
					message: newHighScoreMessage
				})
			});

			const data = await res.json();

			if (res.ok) {
				showHighScorePrompt = false;
				newHighScoreMessage = '';
				await fetchLeaderboard();
			} else {
				statusMessage = data.error || 'Submission failed';
			}
		} catch (e) {
			statusMessage = 'Network error';
			console.error('Failed to submit score:', e);
		} finally {
			isSubmitting = false;
		}
	}

	function spawnPlanet() {
		if (typeof window === 'undefined' || !isLoopRunning) return;
		planet.x = Math.random() * (window.innerWidth - 100) + 50;
		planet.y = Math.random() * (window.innerHeight - 100) + 50;
		planet.vx = (Math.random() - 0.5) * 3;
		planet.vy = (Math.random() - 0.5) * 3;
		planet.exploded = false;
	}

	onMount(() => {
		fetchLeaderboard();
		startSession();

		// Local countdown for the TTL
		const ttlInterval = setInterval(() => {
			if (leaderboardTTL > 0) leaderboardTTL -= 1;
		}, 1000);

		// Load persistent data from localStorage
		if (typeof localStorage !== 'undefined') {
			const storedPB = localStorage.getItem('personalBest');
			if (storedPB) personalBest = parseInt(storedPB, 10);

			const storedSupporter = localStorage.getItem('isSupporter');
			if (storedSupporter === 'true') settings.isSupporter = true;

			const storedTrailColor = localStorage.getItem('trailColor');
			if (storedTrailColor) settings.trailColor = storedTrailColor;

			const storedTrailEffect = localStorage.getItem('trailEffect');
			if (storedTrailEffect) settings.trailEffect = storedTrailEffect;
		}

		const pollInterval = setInterval(() => {
			if (isLoopRunning) fetchLeaderboard();
		}, 10000);
		// Initialize positions based on screen size
		if (typeof window !== 'undefined') {
			charPos = { x: window.innerWidth * 0.2, y: window.innerHeight * 0.2 };
			targetPos = { ...charPos };
			warp.x = window.innerWidth * 0.7;
			warp.y = window.innerHeight * 0.3;

			spawnPlanet();

			asteroids = Array.from({ length: 5 }, (_, i) => ({
				id: i,
				x: Math.random() * (window.innerWidth - 100) + 50,
				y: Math.random() * (window.innerHeight - 100) + 50,
				exploded: false
			}));

			meteorites[0].x = Math.random() * (window.innerWidth - 100) + 50;
			meteorites[0].type = '☄️';
			spawnZapBonus();
			spawnShieldBonus();
			spawnTowerBonus();
		}

		let lastTime = performance.now();
		let frame: number;

		async function loop(currentTime: number) {
			if (!isLoopRunning) return;
			frame = requestAnimationFrame(loop);

			const deltaTime = currentTime - lastTime;
			const interval = 1000 / 30;

			if (deltaTime < interval) return;
			lastTime = currentTime - (deltaTime % interval);

			await update();
		}

		frame = requestAnimationFrame(loop);

		return () => {
			isLoopRunning = false;
			cancelAnimationFrame(frame);
			clearInterval(pollInterval);
			clearInterval(ttlInterval);
			clearAllTimeouts();
		};
	});

	function spawnAsteroid() {
		if (typeof window === 'undefined' || !isLoopRunning) return;
		const id = Math.random();
		// Avoid spawning too close to the character's current position
		let newX, newY, dist;
		do {
			newX = Math.random() * (window.innerWidth - 100) + 50;
			newY = Math.random() * (window.innerHeight - 100) + 50;
			const dx = newX - charPos.x;
			const dy = newY - charPos.y;
			dist = Math.sqrt(dx * dx + dy * dy);
		} while (dist < 200); // Keep 200px distance from player

		asteroids = [
			...asteroids,
			{
				id,
				x: newX,
				y: newY,
				exploded: false
			}
		];
	}

	function spawnZapBonus() {
		if (typeof window === 'undefined' || !isLoopRunning) return;
		zapBonus.x = Math.random() * (window.innerWidth - 100) + 50;
		zapBonus.y = Math.random() * (window.innerHeight - 100) + 50;
		zapBonus.active = true;
	}

	function spawnTimeWarpBonus() {
		if (typeof window === 'undefined' || !isLoopRunning) return;
		timeWarpBonus.x = Math.random() * (window.innerWidth - 100) + 50;
		timeWarpBonus.y = Math.random() * (window.innerHeight - 100) + 50;
		timeWarpBonus.active = true;
	}

	function spawnTowerBonus() {
		if (typeof window === 'undefined' || !isLoopRunning) return;
		towerBonus.x = Math.random() * (window.innerWidth - 100) + 50;
		towerBonus.y = Math.random() * (window.innerHeight - 100) + 50;
		towerBonus.active = true;
	}

	async function towerAttack() {
		if (!tower.active || meteorites.length === 0) return;

		// Target meteorite closest to the player
		let nearest = null;
		let minDist = Infinity;

		for (const m of meteorites) {
			const dx = m.x - charPos.x;
			const dy = m.y - charPos.y;
			const dist = Math.sqrt(dx * dx + dy * dy);
			if (dist < minDist) {
				minDist = dist;
				nearest = m;
			}
		}

		if (nearest) {
			// Fire red laser
			towerLaser.x1 = tower.x + 30;
			towerLaser.y1 = tower.y + 30;
			towerLaser.x2 = nearest.x + 30;
			towerLaser.y2 = nearest.y + 30;

			const dx = towerLaser.x2 - towerLaser.x1;
			const dy = towerLaser.y2 - towerLaser.y1;
			towerLaser.length = Math.sqrt(dx * dx + dy * dy);
			towerLaser.angle = Math.atan2(dy, dx) * (180 / Math.PI);
			towerLaser.active = true;

			safeTimeout(() => {
				towerLaser.active = false;
				if (nearest) {
					nearest.y = typeof window !== 'undefined' ? window.innerHeight + 200 : 1000;
					score += 5; // Passive points are lower
				}
			}, 150);
		}
	}

	function activateTimeWarp() {
		timeScale = 0.25;
		timeWarpActive = true;
		safeTimeout(() => {
			timeScale = 1.0;
			timeWarpActive = false;
		}, 7000);
	}

	function zapMeteorite() {
		if (meteorites.length === 0) return;

		// Target meteorite closest to the player
		let nearest = meteorites[0];
		let minDist = Infinity;

		for (const m of meteorites) {
			const dx = m.x - charPos.x;
			const dy = m.y - charPos.y;
			const dist = Math.sqrt(dx * dx + dy * dy);
			if (dist < minDist) {
				minDist = dist;
				nearest = m;
			}
		}

		const target = nearest;

		// Set laser positions starting from player center to target center
		activeLaser.x1 = charPos.x + charSize / 2;
		activeLaser.y1 = charPos.y + charSize / 2;
		activeLaser.x2 = target.x + 30; // Approx center of 4rem meteorite
		activeLaser.y2 = target.y + 30;

		const dx = activeLaser.x2 - activeLaser.x1;
		const dy = activeLaser.y2 - activeLaser.y1;
		activeLaser.length = Math.sqrt(dx * dx + dy * dy);
		activeLaser.angle = Math.atan2(dy, dx) * (180 / Math.PI);
		activeLaser.active = true;

		// Show laser for 200ms
		safeTimeout(() => {
			activeLaser.active = false;
			// "Destroy" it by forcing a reset
			target.y = typeof window !== 'undefined' ? window.innerHeight + 200 : 1000;
			score += 20;
			triggerShake();
		}, 200);
	}

	function spawnShieldBonus() {
		if (typeof window === 'undefined' || hasShield || shieldBonus.active || !isLoopRunning) return;
		shieldBonus.x = Math.random() * (window.innerWidth - 100) + 50;
		shieldBonus.y = Math.random() * (window.innerHeight - 100) + 50;
		shieldBonus.active = true;
	}

	// Spaghettification effect: stretch based on proximity to warp vortex
	let spaghettiScale = $derived.by(() => {
		const dxW = warp.x - (charPos.x + charSize / 2);
		const dyW = warp.y - (charPos.y + charSize / 2);
		const distW = Math.sqrt(dxW * dxW + dyW * dyW);

		if (distW < 300) {
			const stretch = 1 + (300 - distW) / 50;
			return `scale(${stretch}, ${1 / Math.sqrt(stretch)})`;
		}
		return 'scale(1, 1)';
	});

	async function checkCollisions() {
		if (typeof window === 'undefined' || gameOver) return;

		const charCenterX = charPos.x + charSize / 2;
		const charCenterY = charPos.y + charSize / 2;

		// Check Tax Collector collision
		if (taxCollector.active) {
			const dx = charCenterX - (taxCollector.x + 30);
			const dy = charCenterY - (taxCollector.y + 30);
			const dist = Math.sqrt(dx * dx + dy * dy);
			if (dist < 40) {
				taxCollector.active = false;
				triggerShake();

				if (hasShield) {
					hasShield = false;
					safeTimeout(spawnShieldBonus, 3000);
					taxedPopup.active = true;
					taxedPopup.text = 'BLOCKED!';
					taxedPopup.x = charPos.x;
					taxedPopup.y = charPos.y;
					taxedPopup.timer = 120;
				} else {
					score = Math.floor(score / 2);
					taxedPopup.active = true;
					taxedPopup.text = 'TAXED!';
					taxedPopup.x = charPos.x;
					taxedPopup.y = charPos.y;
					taxedPopup.timer = 120;
				}
			}
		}

		const handleDeath = async () => {
			if (hasShield) {
				hasShield = false;
				triggerShake();
				// Respawn shield after it's been used (with a delay)
				safeTimeout(spawnShieldBonus, 3000);
				return true;
			}
			gameOver = true;
			isLoopRunning = false;
			currentDeathMessage = deathMessages[Math.floor(Math.random() * deathMessages.length)];

			// Update personal best
			if (score > personalBest) {
				personalBest = score;
				if (typeof localStorage !== 'undefined') {
					localStorage.setItem('personalBest', personalBest.toString());
				}
			}

			// Fetch absolute latest leaderboard to ensure we don't use stale polling data
			await fetchLeaderboard();

			// Check for global high score
			if (!globalBest || score > globalBest.score) {
				showHighScorePrompt = true;
			}

			if (lastScores[0] !== score || lastScores.length === 0) {
				lastScores = [score, ...lastScores].slice(0, 3);
			}
			triggerShake();
			return false;
		};

		// Check warp collision (Center kill zone)
		const dxW = charCenterX - warp.x;
		const dyW = charCenterY - warp.y;
		const distW = Math.sqrt(dxW * dxW + dyW * dyW);

		if (distW < 40) {
			await handleDeath();
		}

		// Check planet collision
		if (!planet.exploded) {
			const dx = charCenterX - (planet.x + planetSize / 2);
			const dy = charCenterY - (planet.y + planetSize / 2);
			const distance = Math.sqrt(dx * dx + dy * dy);
			if (distance < (charSize + planetSize) / 2.5) {
				planet.exploded = true;
				// Respawn planet after 5 seconds
				safeTimeout(spawnPlanet, 5000);
				await handleDeath();
			}
		}

		// Check meteorites collision
		for (const m of meteorites) {
			const dx = charCenterX - (m.x + 30); // Approx center of 4rem meteorite
			const dy = charCenterY - (m.y + 30);
			const distance = Math.sqrt(dx * dx + dy * dy);
			if (distance < (charSize + 40) / 2) {
				if (await handleDeath()) {
					// "Destroy" the meteorite by pushing it off-screen so it resets
					m.y = window.innerHeight + 200;
				}
			}
		}

		// Check zap bonus collision
		if (zapBonus.active) {
			const dx = charPos.x - zapBonus.x;
			const dy = charPos.y - zapBonus.y;
			const distance = Math.sqrt(dx * dx + dy * dy);
			if (distance < charSize) {
				zapBonus.active = false;
				zapMeteorite();
				// Respawn bonus elsewhere
				safeTimeout(spawnZapBonus, 2000);
			}
		}

		// Check shield bonus collision
		if (shieldBonus.active) {
			const dx = charPos.x - shieldBonus.x;
			const dy = charPos.y - shieldBonus.y;
			const distance = Math.sqrt(dx * dx + dy * dy);
			if (distance < charSize) {
				shieldBonus.active = false;
				hasShield = true;
				triggerShake();
			}
		}

		// Check time warp bonus collision
		if (timeWarpBonus.active) {
			const dx = charPos.x - timeWarpBonus.x;
			const dy = charPos.y - timeWarpBonus.y;
			const distance = Math.sqrt(dx * dx + dy * dy);
			if (distance < charSize) {
				timeWarpBonus.active = false;
				activateTimeWarp();
				triggerShake();
			}
		}

		// Check tower bonus collision
		if (towerBonus.active) {
			const dx = charPos.x - towerBonus.x;
			const dy = charPos.y - towerBonus.y;
			const distance = Math.sqrt(dx * dx + dy * dy);
			if (distance < charSize) {
				towerBonus.active = false;
				if (!tower.active) {
					tower.active = true;
					if (typeof window !== 'undefined') {
						tower.x = window.innerWidth / 2 - 40; // Centered
						tower.y = window.innerHeight - 90; // Slightly lower
					}
					tower.level = 1;
					tower.attackTimer = 30; // Fast initial attack
				} else {
					tower.level += 1;
				}
				triggerShake();
				// Respawn bonus elsewhere
				safeTimeout(spawnTowerBonus, 15000);
			}
		}

		// Check asteroids collision
		asteroids.forEach((ast) => {
			if (!ast.exploded) {
				// Use center of asteroid for better collision (approx 20px offset for 2.5rem size)
				const dx = charCenterX - (ast.x + 20);
				const dy = charCenterY - (ast.y + 20);
				const distance = Math.sqrt(dx * dx + dy * dy);

				if (distance < (charSize + 30) / 2) {
					ast.exploded = true;
					score += 10;
					triggerShake();

					// Check if we should spawn extra deadly meteorites (every 40 points)
					const targetMeteoriteCount = 1 + Math.floor(score / 40);
					if (meteorites.length < targetMeteoriteCount) {
						meteorites.push({
							id: Math.random(),
							x: Math.random() * (window.innerWidth - 100) + 50,
							y: -200,
							speed: 7 + Math.random() * 10,
							vx: (Math.random() - 0.5) * 6,
							angle: 0,
							type: '☄️'
						});
					}

					// Check if we should spawn an extra asteroid (every 50 points)
					const targetAsteroidCount = 5 + Math.floor(score / 50);

					safeTimeout(() => {
						asteroids = asteroids.filter((a) => a.id !== ast.id);
						// Always spawn at least one to replace the collected one
						spawnAsteroid();

						// If our current count is less than target, spawn more!
						if (asteroids.length < targetAsteroidCount) {
							spawnAsteroid();
						}
					}, 500);
				}
			}
		});
	}

	function restart() {
		isLoopRunning = true;
		charPos = { x: 100, y: 100 };
		velocity = { x: 0, y: 0 };
		score = 0;
		timeScale = 1.0;
		timeWarpActive = false;
		timeWarpBonus.active = false;
		gameOver = false;
		showHighScorePrompt = false;
		newHighScoreMessage = '';
		hasShownRadioMessage = false;
		statusMessage = '';
		startSession();
		hasShield = false;
		shieldBonus.active = false;
		taxCollector.active = false;
		taxedPopup.active = false;
		tower.active = false;
		tower.level = 0;
		towerBonus.active = false;
		towerLaser.active = false;
		spawnZapBonus();
		spawnShieldBonus();
		spawnTowerBonus();
		spawnPlanet();

		if (typeof window !== 'undefined') {
			warp.x = window.innerWidth / 2;
			warp.y = window.innerHeight / 2;
		}

		meteorites = [
			{
				id: Math.random(),
				x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth - 100 : 800) + 50,
				y: -150,
				speed: 6 + Math.random() * 8,
				vx: (Math.random() - 0.5) * 6,
				angle: 0,
				type: '☄️'
			}
		];
	}

	/**
	 * @param {MouseEvent} event
	 */
	function handleMousemove(event: MouseEvent) {
		m.x = event.clientX;
		m.y = event.clientY;
	}

	/**
	 * @param {PointerEvent} event
	 */
	function handlePointerDown(event: PointerEvent) {
		// Prevent click handling if we're clicking the navigation
		if (event.target instanceof HTMLAnchorElement) return;

		targetPos.x = event.clientX - charSize / 2;
		targetPos.y = event.clientY - charSize / 2;
		isFollowingClick = true;
	}

	/**
	 * @param {KeyboardEvent} event
	 */
	function handleKeydown(event: KeyboardEvent) {
		if (event.key in keys) {
			keys[event.key] = true;
		}
	}

	/**
	 * @param {KeyboardEvent} event
	 */
	function handleKeyup(event: KeyboardEvent) {
		if (event.key in keys) {
			keys[event.key] = false;
		}
	}
</script>

<svelte:window
	onmousemove={handleMousemove}
	onpointerdown={handlePointerDown}
	onkeydown={handleKeydown}
	onkeyup={handleKeyup}
/>

<div class="game-container" class:paused={!isLoopRunning}>
	<div
		class="shake-layer"
		class:shake={isShaking && settings.enableShake}
		class:time-warp={timeWarpActive}
	>
		{#each particles as p (p.id)}
			<div
				class="particle"
				class:ghost={p.effectType === 'ghost'}
				class:plasma={p.effectType === 'plasma'}
				class:rainbow={p.effectType === 'rainbow'}
				style="
					left: {p.x}px; 
					top: {p.y}px; 
					width: {p.size}px; 
					height: {p.size}px; 
					opacity: {p.life};
					background: {p.effectType === 'classic'
					? 'radial-gradient(circle, #ff9d00 0%, #ff4400 100%)'
					: p.color};
					--particle-color: {p.color};
				"
			>
				{#if p.effectType === 'ghost'}
					{p.emoji}
				{/if}
			</div>
		{/each}

		{#each asteroids as ast (ast.id)}
			<div class="asteroid" class:exploding={ast.exploded} style="left: {ast.x}px; top: {ast.y}px;">
				{ast.exploded ? '✨' : '⭐'}
			</div>
		{/each}

		<div
			class="warp-vortex"
			style="left: {warp.x}px; top: {warp.y}px; width: {warp.size}px; height: {warp.size}px; transform: translate(-50%, -50%) rotate({warp.angle}deg);"
		>
			<div class="vortex-core">🌀</div>
			<div class="vortex-ring" style="width: 3072px; height: 3072px;"></div>
			<div class="gravity-field" style="width: 3072px; height: 3072px;"></div>
		</div>

		<div
			class="character"
			style="left: {charPos.x}px; top: {charPos.y}px; transform: rotate({rotation}deg) {spaghettiScale}; filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.5));"
		>
			{#if hasShield}
				<div class="shield-effect"></div>
			{/if}
			{playerEmoji}
		</div>

		{#if zapBonus.active}
			<div class="bonus-zap" style="left: {zapBonus.x}px; top: {zapBonus.y}px;">📡</div>
		{/if}

		{#if timeWarpBonus.active}
			<div class="bonus-timewarp" style="left: {timeWarpBonus.x}px; top: {timeWarpBonus.y}px;">
				⏳
			</div>
		{/if}

		{#if shieldBonus.active}
			<div class="bonus-shield" style="left: {shieldBonus.x}px; top: {shieldBonus.y}px;">🛡️</div>
		{/if}

		<div
			class="planet"
			class:exploded={planet.exploded}
			style="left: {planet.x}px; top: {planet.y}px;"
		>
			{planet.exploded ? '🌋' : '🪐'}
		</div>

		{#each meteorites as m (m.id)}
			<div
				class="falling-asteroid"
				style="left: {m.x}px; top: {m.y}px; transform: rotate({m.angle}deg);"
			>
				{m.type || '☄️'}
				{#if m.type && m.type !== '☄️'}
					<div class="junk-label">Celestial Clutter</div>
				{/if}
			</div>
		{/each}

		{#if taxCollector.active}
			<div class="tax-collector" style="left: {taxCollector.x}px; top: {taxCollector.y}px;">🕴️</div>
		{/if}

		{#if taxedPopup.active}
			<div
				class="taxed-popup"
				style="left: {taxedPopup.x}px; top: {taxedPopup.y}px; opacity: {taxedPopup.timer /
					120}; color: {taxedPopup.text === 'BLOCKED!' ? '#10b981' : '#ff4444'};"
			>
				{taxedPopup.text}
			</div>
		{/if}

		{#if activeLaser.active}
			<div
				class="laser-beam"
				style="left: {activeLaser.x1}px; top: {activeLaser.y1}px; width: {activeLaser.length}px; transform: rotate({activeLaser.angle}deg);"
			></div>
		{/if}

		{#if tower.active}
			<div class="defense-tower" style="left: {tower.x}px; top: {tower.y}px;">
				🏰
				<div class="tower-level">LVL {tower.level}</div>
			</div>
		{/if}

		{#if towerBonus.active}
			<div class="bonus-tower" style="left: {towerBonus.x}px; top: {towerBonus.y}px;">🏰</div>
		{/if}

		{#if towerLaser.active}
			<div
				class="tower-laser"
				style="left: {towerLaser.x1}px; top: {towerLaser.y1}px; width: {towerLaser.length}px; transform: rotate({towerLaser.angle}deg);"
			></div>
		{/if}
	</div>

	{#if gameOver}
		<div class="game-over">
			{#if showHighScorePrompt}
				<h1 class="new-record">NEW GALAXY RECORD!</h1>
				<p>Your score of {score} is the best in the universe.</p>
				<div class="input-group">
					<input
						type="text"
						bind:value={newHighScoreUsername}
						placeholder="Pilot Name"
						maxlength="20"
						disabled={isSubmitting}
					/>
					<input
						type="text"
						bind:value={newHighScoreMessage}
						placeholder="Attach radio message (Optional)"
						maxlength="100"
						disabled={isSubmitting}
					/>
					{#if statusMessage}
						<p class="error-text">{statusMessage}</p>
					{/if}
					<button onclick={submitHighScore} disabled={isSubmitting || !newHighScoreUsername.trim()}>
						{isSubmitting ? 'TRANSMITTING...' : 'REGISTER SCORE'}
					</button>
				</div>
			{:else}
				<h1>GAME OVER</h1>
				<p>{currentDeathMessage}</p>

				<div class="unlocks-preview">
					<div class="unlock-item" class:locked={personalBest < 250}>
						<span class="unlock-emoji">🛸</span>
						<span class="unlock-pts">250 pts</span>
					</div>
					<div class="unlock-item" class:locked={personalBest < 750}>
						<span class="unlock-emoji">🛰️</span>
						<span class="unlock-pts">750 pts</span>
					</div>
					<div class="unlock-item" class:locked={personalBest < 1500}>
						<span class="unlock-emoji">👾</span>
						<span class="unlock-pts">1500 pts</span>
					</div>
				</div>

				<div class="actions">
					<button onclick={restart}>Try Again</button>
					<button class="secondary" onclick={() => (showCustomizer = true)}>Customize Ship</button>
				</div>
			{/if}
		</div>
	{/if}

	{#if settings.showBackground}
		<div class="shooting-stars">
			{#each stars as star (star.id)}
				<div
					class="star"
					style="--top: {star.top}%; --left: {star.left}%; --delay: {star.delay}s; --duration: {star.duration}s; --angle: {star.angle}deg;"
				></div>
			{/each}
		</div>
	{/if}

	<div class="score-board">
		<div class="current-score">Score: {score}</div>
		{#if globalBest}
			<div class="global-best">Best: {globalBest.score} ({globalBest.username})</div>
		{/if}
		<div class="reset-timer">Reset in: {formattedTTL}</div>
		{#if lastScores.length > 0}
			<div class="last-tries">
				<div class="last-title">Last tries:</div>
				{#each lastScores as s}
					<div class="past-score">{s}</div>
				{/each}
			</div>
		{/if}
	</div>

	{#if showCustomizer}
		<div class="modal customizer">
			<div class="customizer-header">
				<h2>Ship Customization</h2>
			</div>

			<div class="customizer-content">
				<div class="custom-section">
					<h3>Trail Effect</h3>
					<div class="option-grid">
						<button
							class:active={settings.trailEffect === 'classic'}
							onclick={() => selectTrailEffect('classic')}
						>
							Classic
						</button>
						<button
							class:active={settings.trailEffect === 'plasma'}
							class:premium={!settings.isSupporter}
							onclick={() => selectTrailEffect('plasma')}
						>
							Plasma {!settings.isSupporter ? '🔒' : ''}
						</button>
						<button
							class:active={settings.trailEffect === 'ghost'}
							class:premium={!settings.isSupporter}
							onclick={() => selectTrailEffect('ghost')}
						>
							Ghost {!settings.isSupporter ? '🔒' : ''}
						</button>
						<button
							class:active={settings.trailEffect === 'rainbow'}
							class:premium={!settings.isSupporter}
							onclick={() => selectTrailEffect('rainbow')}
						>
							Rainbow {!settings.isSupporter ? '🔒' : ''}
						</button>
					</div>
				</div>

				<div class="custom-section">
					<h3>Trail Color</h3>
					<div class="color-grid">
						{#each ['#ff9d00', '#00f2ff', '#10b981', '#f43f5e', '#8b5cf6', '#ffffff'] as c}
							<button
								class="color-btn"
								class:active={settings.trailColor === c}
								class:locked={!settings.isSupporter && c !== '#ff9d00'}
								style="background: {c}; --particle-color: {c};"
								onclick={() => selectTrailColor(c)}
								aria-label="Select trail color {c}"
								title="Select trail color {c}"
							></button>
						{/each}
					</div>
				</div>

				{#if !settings.isSupporter}
					<div class="supporter-pitch">
						<p>Unlock all premium trails and colors for $12,000!</p>
						<button class="buy-btn" onclick={handleBuyClick}>Become a Supporter</button>
					</div>
				{:else}
					<div class="supporter-pitch bought">
						<p>You are a Supporter! ✨</p>
						<button class="buy-btn secondary-gold" onclick={() => (showNothingModal = true)}
							>Buy it again!</button
						>
					</div>
				{/if}
			</div>

			<div class="customizer-footer">
				<button class="close-btn" onclick={() => (showCustomizer = false)}>Close</button>
			</div>
		</div>
	{/if}

	{#if showNothingModal}
		<div class="modal rich-confirmation">
			<h2 class="warning-title">⚠️ WASTE ADVISORY</h2>
			<p class="warning-text">You'll get nothing more!</p>
			<div class="rich-actions">
				<button class="buy-btn" onclick={redirectToDonation}>I know that!</button>
				<button class="close-btn" onclick={() => (showNothingModal = false)}
					>Actually, maybe once is enough</button
				>
			</div>
		</div>
	{/if}

	{#if showRichModal}
		<div class="modal rich-confirmation">
			<h2 class="warning-title">⚠️ SYSTEM ADVISORY</h2>
			<p class="warning-text">I don't know if it works, take it at your own risk!</p>
			<div class="rich-actions">
				<button class="buy-btn" onclick={redirectToPaypal}>I know, I'm just too rich!</button>
				<button class="close-btn" onclick={() => (showRichModal = false)}
					>Wait, I'm actually sensible</button
				>
			</div>
		</div>
	{/if}

	{#if activeRadioMessage}
		<div class="radio-transmission">
			<div class="radio-header">INCOMING TRANSMISSION: {activeRadioMessage.username}</div>
			<div class="radio-body">"{activeRadioMessage.text}"</div>
		</div>
	{/if}
</div>

<style>
	:global(body) {
		overflow: hidden;
	}

	.game-container {
		width: 100%;
		height: 100vh;
		position: relative;
		overflow: hidden;
	}

	.game-container.paused * {
		animation-play-state: paused !important;
		transition: none !important;
	}

	.shake-layer {
		width: 100%;
		height: 100%;
		position: absolute;
		top: 0;
		left: 0;
		pointer-events: none;
	}

	.shake-layer.shake {
		animation: shake 0.3s infinite;
	}

	.shake-layer.time-warp {
		filter: sepia(0.5) hue-rotate(90deg) contrast(1.2);
		transition: filter 0.5s ease;
	}

	.particle {
		position: fixed;
		background: radial-gradient(circle, #ff9d00 0%, #ff4400 100%);
		border-radius: 50%;
		pointer-events: none;
		z-index: 18;
		filter: blur(2px);
	}

	.particle.plasma {
		filter: blur(4px) brightness(1.5);
		box-shadow: 0 0 10px var(--particle-color);
	}

	.particle.ghost {
		background: transparent !important;
		font-size: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		filter: none;
	}

	.particle.rainbow {
		animation: rainbow-cycle 1s linear infinite;
	}

	@keyframes rainbow-cycle {
		from {
			filter: hue-rotate(0deg) blur(2px);
		}
		to {
			filter: hue-rotate(360deg) blur(2px);
		}
	}

	.actions {
		display: flex;
		gap: 1rem;
		justify-content: center;
		margin-top: 1rem;
	}

	button.secondary {
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid white;
	}

	button.secondary:hover {
		background: rgba(255, 255, 255, 0.2);
	}

	.customizer {
		min-width: 280px;
		width: 90%;
		max-width: 500px;
		max-height: 85vh;
		display: flex;
		flex-direction: column;
		background: linear-gradient(145deg, rgba(10, 15, 30, 0.98), rgba(20, 25, 45, 0.98));
		border: 1px solid rgba(100, 200, 255, 0.2);
		box-shadow:
			0 30px 60px -15px rgba(0, 0, 0, 0.8),
			0 0 20px rgba(0, 242, 255, 0.1) inset;
		animation: modal-enter 0.5s cubic-bezier(0.2, 1, 0.3, 1);
		border-radius: 1.5rem;
		padding: 0;
		overflow: hidden;
		z-index: 5000;
	}

	.customizer-header {
		padding: 1.5rem 1.5rem 0.5rem;
		flex-shrink: 0;
	}

	.customizer-content {
		padding: 0 1.5rem;
		overflow-y: auto;
		flex-grow: 1;
		scrollbar-width: thin;
		scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
	}

	.customizer-footer {
		padding: 1rem 1.5rem 1.5rem;
		flex-shrink: 0;
		background: rgba(0, 0, 0, 0.2);
		border-top: 1px solid rgba(255, 255, 255, 0.05);
	}

	.customizer-content::-webkit-scrollbar {
		width: 6px;
	}

	.customizer-content::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.2);
		border-radius: 3px;
	}

	.customizer h2 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 800;
		background: linear-gradient(135deg, #ffffff, #00f2ff);
		background-clip: text;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		letter-spacing: 2px;
		text-transform: uppercase;
		text-shadow: 0 0 30px rgba(0, 242, 255, 0.3);
	}

	@media (max-width: 600px) {
		.customizer {
			max-height: 95vh;
			border-radius: 1rem;
		}
		.customizer h2 {
			font-size: 1.2rem;
		}
		.custom-section {
			padding: 1rem;
		}
		.option-grid {
			gap: 0.5rem;
		}
		.color-btn {
			width: 36px;
			height: 36px;
		}
	}

	@keyframes modal-enter {
		from {
			opacity: 0;
			transform: translate(-50%, -40%) scale(0.9);
			filter: blur(10px);
		}
		to {
			opacity: 1;
			transform: translate(-50%, -50%) scale(1);
			filter: blur(0);
		}
	}

	.modal {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 1000;
		backdrop-filter: blur(25px);
		text-align: center;
	}

	.custom-section {
		margin-bottom: 1.5rem;
		text-align: left;
		background: rgba(0, 0, 0, 0.3);
		padding: 1.25rem;
		border-radius: 1rem;
		border: 1px solid rgba(255, 255, 255, 0.05);
	}

	.custom-section h3 {
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 2px;
		color: #94a3b8;
		margin-bottom: 1rem;
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.custom-section h3::before {
		content: '';
		width: 8px;
		height: 8px;
		background: #00f2ff;
		border-radius: 50%;
		box-shadow: 0 0 10px #00f2ff;
	}

	.custom-section h3::after {
		content: '';
		flex: 1;
		height: 1px;
		background: linear-gradient(to right, rgba(0, 242, 255, 0.3), transparent);
	}

	.option-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	.option-grid button {
		margin: 0;
		padding: 1rem 0.5rem;
		font-size: 1rem;
		font-weight: 600;
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid rgba(255, 255, 255, 0.05);
		border-radius: 0.75rem;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		color: #94a3b8;
		position: relative;
		overflow: hidden;
		letter-spacing: 1px;
		text-transform: uppercase;
	}

	.option-grid button:not(.locked):hover {
		background: rgba(0, 242, 255, 0.05);
		border-color: rgba(0, 242, 255, 0.3);
		color: #fff;
		transform: translateY(-2px);
		box-shadow: 0 10px 20px -10px rgba(0, 242, 255, 0.2);
	}

	.option-grid button.active {
		background: rgba(0, 242, 255, 0.1);
		border-color: #00f2ff;
		color: #fff;
		box-shadow:
			0 0 20px rgba(0, 242, 255, 0.2),
			inset 0 0 10px rgba(0, 242, 255, 0.1);
		text-shadow: 0 0 10px rgba(0, 242, 255, 0.5);
	}

	.option-grid button.active::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 4px;
		height: 100%;
		background: #00f2ff;
		box-shadow: 0 0 15px #00f2ff;
	}

	.option-grid button.premium {
		opacity: 0.5;
	}

	.color-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 1.2rem;
		justify-content: center;
		padding: 0.5rem 0;
	}

	.color-btn {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		border: 2px solid rgba(255, 255, 255, 0.1);
		padding: 0;
		margin: 0;
		cursor: pointer;
		transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
		position: relative;
		box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.5);
	}

	.color-btn:not(.locked):hover {
		transform: scale(1.2);
		border-color: rgba(255, 255, 255, 0.8);
		box-shadow: 0 0 15px var(--particle-color);
	}

	.color-btn.active {
		border-color: #fff;
		border-width: 3px;
		transform: scale(1.25);
		box-shadow:
			0 0 25px var(--particle-color),
			inset 0 0 10px rgba(255, 255, 255, 0.5);
	}

	.color-btn.locked {
		opacity: 0.2;
		cursor: not-allowed;
		filter: grayscale(1);
	}

	.color-btn.locked::after {
		content: '🔒';
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		font-size: 1.2rem;
		text-shadow: 0 2px 5px rgba(0, 0, 0, 0.9);
	}

	.supporter-pitch {
		background: linear-gradient(135deg, rgba(255, 215, 0, 0.1), rgba(255, 140, 0, 0.15));
		padding: 1.25rem;
		border-radius: 1rem;
		border: 1px solid rgba(255, 215, 0, 0.3);
		margin-top: 0.5rem;
		margin-bottom: 1.5rem;
		position: relative;
		overflow: hidden;
		box-shadow: 0 10px 30px rgba(255, 215, 0, 0.1);
	}

	.supporter-pitch::before {
		content: '';
		position: absolute;
		top: -50%;
		left: -50%;
		width: 200%;
		height: 200%;
		background: conic-gradient(
			from 0deg,
			transparent 0deg,
			rgba(255, 215, 0, 0.2) 90deg,
			transparent 180deg
		);
		animation: radar-sweep 4s linear infinite;
		pointer-events: none;
	}

	@keyframes radar-sweep {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.supporter-pitch p {
		font-size: 1rem;
		color: #fff;
		margin-bottom: 1.5rem;
		position: relative;
		z-index: 1;
		font-weight: 600;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
		letter-spacing: 1px;
	}

	.buy-btn {
		width: 100%;
		background: linear-gradient(to right, #ffd700, #ff8c00) !important;
		color: #000 !important;
		margin: 0 !important;
		font-weight: 800;
		font-size: 1rem;
		letter-spacing: 2px;
		text-transform: uppercase;
		box-shadow: 0 5px 20px rgba(255, 215, 0, 0.4);
		position: relative;
		z-index: 1;
		transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
		border-radius: 0.75rem;
		padding: 1rem;
	}

	.buy-btn:hover {
		transform: translateY(-3px) scale(1.02);
		box-shadow: 0 10px 30px rgba(255, 215, 0, 0.6);
		background: linear-gradient(to right, #ffdf00, #ff9d00) !important;
	}

	.buy-btn.secondary-gold {
		background: rgba(255, 215, 0, 0.1) !important;
		border: 1px solid #ffd700 !important;
		color: #ffd700 !important;
		box-shadow: none;
	}

	.buy-btn.secondary-gold:hover {
		background: rgba(255, 215, 0, 0.2) !important;
	}

	.close-btn {
		width: 100%;
		background: rgba(255, 255, 255, 0.05) !important;
		border: 1px solid rgba(255, 255, 255, 0.1) !important;
		color: #94a3b8 !important;
		margin: 0 !important;
		border-radius: 0.75rem;
		padding: 0.75rem;
		font-weight: 600;
		letter-spacing: 2px;
		text-transform: uppercase;
		transition: all 0.3s;
		cursor: pointer;
	}

	.close-btn:hover {
		background: rgba(239, 68, 68, 0.1) !important;
		border-color: rgba(239, 68, 68, 0.5) !important;
		color: #ef4444 !important;
		box-shadow: 0 0 20px rgba(239, 68, 68, 0.2);
	}

	.rich-confirmation {
		min-width: 300px;
		max-width: 420px;
		background: linear-gradient(145deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.98));
		border: 2px solid #ef4444;
		box-shadow:
			0 0 40px rgba(239, 68, 68, 0.2),
			0 25px 50px -12px rgba(0, 0, 0, 0.8);
		padding: 2.5rem;
		animation: modal-enter 0.4s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.warning-title {
		color: #ef4444 !important;
		font-size: 1.25rem !important;
		font-weight: 800 !important;
		margin-bottom: 1.5rem !important;
		letter-spacing: 3px !important;
		text-transform: uppercase;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
	}

	.warning-text {
		font-size: 1rem;
		line-height: 1.6;
		color: #cbd5e1;
		margin-bottom: 2.5rem;
		padding: 1rem;
		background: rgba(0, 0, 0, 0.2);
		border-radius: 0.75rem;
		border: 1px solid rgba(255, 255, 255, 0.05);
	}

	.rich-actions {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.rich-actions .buy-btn {
		background: #ef4444 !important;
		box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);
	}

	.rich-actions .buy-btn:hover {
		background: #dc2626 !important;
		box-shadow: 0 6px 20px rgba(239, 68, 68, 0.5);
	}

	.score-board {
		position: fixed;
		top: 1rem;
		right: 1rem;
		text-align: right;
		z-index: 30;
	}

	.current-score {
		font-size: 2.5rem;
		font-weight: bold;
		color: #ffd700;
		text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
	}

	.global-best {
		font-size: 1.2rem;
		color: #10b981;
		font-weight: bold;
		text-transform: uppercase;
		letter-spacing: 1px;
	}

	.reset-timer {
		font-size: 0.7rem;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 1px;
		margin-bottom: 0.5rem;
	}

	.new-record {
		color: #ffd700 !important;
		animation: pulse-gold 2s infinite;
	}

	@keyframes pulse-gold {
		0%,
		100% {
			text-shadow: 0 0 10px #ffd700;
		}
		50% {
			text-shadow: 0 0 30px #ffd700;
		}
	}

	.input-group {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-top: 1.5rem;
	}

	input {
		padding: 0.75rem 1rem;
		font-size: 1.2rem;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.3);
		border-radius: 0.5rem;
		color: white;
		text-align: center;
		outline: none;
		transition: border-color 0.2s;
	}

	input:focus {
		border-color: #ffd700;
	}

	input:disabled {
		opacity: 0.5;
	}

	.error-text {
		color: #ef4444;
		font-size: 0.9rem;
		margin: 0;
	}

	.radio-transmission {
		position: fixed;
		bottom: 10%;
		left: 50%;
		transform: translateX(-50%);
		width: 80%;
		max-width: 600px;
		background: rgba(0, 0, 0, 0.6);
		padding: 1.5rem 2rem;
		border-left: 4px solid #10b981;
		color: white;
		font-family: 'Courier New', Courier, monospace;
		z-index: 500;
		animation: radio-in 0.5s ease-out;
		backdrop-filter: blur(4px);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
	}

	.radio-header {
		font-size: 0.7rem;
		color: #10b981;
		margin-bottom: 0.5rem;
		letter-spacing: 2px;
		font-weight: bold;
	}

	.radio-body {
		font-size: 1.2rem;
		line-height: 1.4;
	}

	@keyframes radio-in {
		from {
			opacity: 0;
			transform: translate(-50%, 20px);
		}
		to {
			opacity: 1;
			transform: translate(-50%, 0);
		}
	}

	.last-tries {
		margin-top: 0.5rem;
		font-size: 1rem;
		color: rgba(255, 255, 255, 0.5);
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.last-title {
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 1px;
		margin-bottom: 2px;
	}

	.past-score {
		opacity: 0.8;
	}

	h1 {
		font-size: 3rem;
		margin-top: 0;
	}

	.character {
		position: fixed;
		font-size: 4rem;
		z-index: 20;
		user-select: none;
		pointer-events: none;
		filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.5));
		transition: filter 0.3s;
	}

	.bonus-zap {
		position: fixed;
		font-size: 3rem;
		z-index: 15;
		user-select: none;
		pointer-events: none;
		animation: pulse-bonus 1s ease-in-out infinite;
		filter: drop-shadow(0 0 10px #6366f1);
	}

	.bonus-timewarp {
		position: fixed;
		font-size: 3rem;
		z-index: 15;
		user-select: none;
		pointer-events: none;
		animation: pulse-bonus 1s ease-in-out infinite;
		filter: drop-shadow(0 0 15px #10b981);
	}

	.bonus-shield {
		position: fixed;
		font-size: 3rem;
		z-index: 15;
		user-select: none;
		pointer-events: none;
		animation: pulse-shield 1.2s ease-in-out infinite;
		filter: drop-shadow(0 0 15px #10b981);
	}

	.shield-effect {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 140%;
		height: 140%;
		transform: translate(-50%, -50%);
		border: 4px solid #10b981;
		border-radius: 50%;
		box-shadow:
			0 0 20px #10b981,
			inset 0 0 20px #10b981;
		opacity: 0.6;
		animation: shield-vibrate 0.2s infinite;
	}

	@keyframes pulse-shield {
		0%,
		100% {
			transform: scale(1);
			filter: drop-shadow(0 0 10px #10b981);
		}
		50% {
			transform: scale(1.3);
			filter: drop-shadow(0 0 25px #10b981);
		}
	}

	@keyframes shield-vibrate {
		0% {
			transform: translate(-50%, -50%) scale(1);
		}
		50% {
			transform: translate(-52%, -48%) scale(1.05);
		}
		100% {
			transform: translate(-50%, -50%) scale(1);
		}
	}

	@keyframes pulse-bonus {
		0%,
		100% {
			transform: scale(1);
			filter: drop-shadow(0 0 10px #00f2ff);
		}
		50% {
			transform: scale(1.3);
			filter: drop-shadow(0 0 20px #00f2ff);
		}
	}

	.asteroid {
		position: fixed;
		font-size: 2.5rem;
		z-index: 15;
		user-select: none;
		pointer-events: none;
		transition: transform 0.2s;
		animation:
			float-star 3s ease-in-out infinite,
			glow-star 2s ease-in-out infinite;
	}

	@keyframes float-star {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-10px);
		}
	}

	@keyframes glow-star {
		0%,
		100% {
			filter: drop-shadow(0 0 5px #ffd700);
		}
		50% {
			filter: drop-shadow(0 0 20px #ffd700);
		}
	}

	.asteroid.exploding {
		animation: explode 0.5s forwards;
	}

	.warp-vortex {
		position: fixed;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10;
		pointer-events: none;
	}

	.vortex-core {
		font-size: 4rem;
		filter: drop-shadow(0 0 20px #6366f1);
		z-index: 2;
	}

	.vortex-ring {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		border: 2px dashed rgba(99, 102, 241, 0.4);
		border-radius: 50%;
	}

	.gravity-field {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		border-radius: 50%;
		background: radial-gradient(circle, rgba(99, 102, 241, 0.1) 0%, transparent 80%);
		border: 1px solid rgba(99, 102, 241, 0.05);
		z-index: 1;
		pointer-events: none;
	}

	@keyframes pulse-ring {
		0% {
			transform: translate(-50%, -50%) scale(0.8);
			opacity: 0.8;
		}
		50% {
			transform: translate(-50%, -50%) scale(1.2);
			opacity: 0.2;
		}
		100% {
			transform: translate(-50%, -50%) scale(0.8);
			opacity: 0.8;
		}
	}

	.planet {
		position: fixed;
		font-size: 6rem;
		z-index: 150;
		user-select: none;
		pointer-events: none;
		filter: drop-shadow(0 0 25px rgba(255, 165, 0, 0.4));
		transition: transform 0.1s;
	}

	.planet.exploded {
		animation: explode 0.5s forwards;
	}

	.falling-asteroid {
		position: fixed;
		font-size: 4rem;
		z-index: 140;
		user-select: none;
		pointer-events: none;
		filter: drop-shadow(0 0 20px rgba(255, 68, 68, 0.6));
	}

	.junk-label {
		position: absolute;
		top: -20px;
		left: 50%;
		transform: translateX(-50%);
		font-size: 0.8rem;
		color: #ff4444;
		white-space: nowrap;
		background: rgba(0, 0, 0, 0.5);
		padding: 2px 6px;
		border-radius: 4px;
	}

	.tax-collector {
		position: fixed;
		font-size: 4rem;
		z-index: 145;
		user-select: none;
		pointer-events: none;
		filter: drop-shadow(0 0 20px rgba(255, 255, 255, 0.4));
		animation: collector-wobble 2s ease-in-out infinite;
	}

	@keyframes collector-wobble {
		0%,
		100% {
			transform: scale(1) rotate(0deg);
		}
		50% {
			transform: scale(1.1) rotate(5deg);
		}
	}

	.taxed-popup {
		position: fixed;
		font-size: 2rem;
		font-weight: bold;
		color: #ff4444;
		z-index: 300;
		pointer-events: none;
		text-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
		animation: taxed-float 2s forwards;
	}

	@keyframes taxed-float {
		0% {
			transform: translate(-50%, 0);
		}
		100% {
			transform: translate(-50%, -100px);
		}
	}

	.laser-beam {
		position: fixed;
		height: 4px;
		background: #00f2ff;
		box-shadow:
			0 0 15px #00f2ff,
			0 0 30px #00f2ff;
		z-index: 100;
		transform-origin: 0 50%;
		pointer-events: none;
		border-radius: 2px;
	}

	.defense-tower {
		position: fixed;
		font-size: 5rem;
		z-index: 15;
		user-select: none;
		pointer-events: none;
		filter: drop-shadow(0 0 15px rgba(239, 68, 68, 0.4));
	}

	.tower-level {
		position: absolute;
		top: -10px;
		left: 50%;
		transform: translateX(-50%);
		font-size: 0.8rem;
		background: #ef4444;
		color: white;
		padding: 2px 6px;
		border-radius: 10px;
		font-weight: bold;
		white-space: nowrap;
	}

	.tower-laser {
		position: fixed;
		height: 2px;
		background: #ef4444;
		box-shadow: 0 0 10px #ef4444;
		z-index: 90;
		transform-origin: 0 50%;
		pointer-events: none;
	}

	.bonus-tower {
		position: fixed;
		font-size: 3rem;
		z-index: 15;
		user-select: none;
		pointer-events: none;
		animation: pulse-bonus 1s ease-in-out infinite;
		filter: drop-shadow(0 0 10px #ef4444);
	}

	.game-over {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: rgba(0, 0, 0, 0.8);
		padding: 3rem;
		border: 2px solid white;
		border-radius: 1rem;
		text-align: center;
		z-index: 5000;
		backdrop-filter: blur(10px);
	}

	.game-over h1 {
		color: #ff4444;
		margin-bottom: 1rem;
	}

	.game-over button {
		background: white;
		color: black;
		border: none;
		padding: 1rem 2rem;
		font-size: 1.2rem;
		cursor: pointer;
		border-radius: 0.5rem;
		margin-top: 1rem;
	}

	.game-over button:hover {
		background: #ddd;
	}

	.unlocks-preview {
		display: flex;
		justify-content: center;
		gap: 1.5rem;
		margin: 1.5rem 0;
		padding: 1rem;
		background: rgba(255, 255, 255, 0.05);
		border-radius: 0.5rem;
	}

	.unlock-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		transition: opacity 0.3s;
	}

	.unlock-item.locked {
		opacity: 0.2;
		filter: grayscale(1);
	}

	.unlock-emoji {
		font-size: 2rem;
	}

	.unlock-pts {
		font-size: 0.7rem;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 1px;
	}

	@keyframes float {
		0%,
		100% {
			transform: translate(-50%, 0) rotate(0deg);
		}
		50% {
			transform: translate(-50%, -15px) rotate(5deg);
		}
	}

	@keyframes explode {
		0% {
			transform: translate(-50%, -50%) scale(1);
			opacity: 1;
		}
		50% {
			transform: translate(-50%, -50%) scale(2);
			opacity: 0.8;
		}
		100% {
			transform: translate(-50%, -50%) scale(3);
			opacity: 0;
		}
	}

	.shooting-stars {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: 100; /* Bring to front */
		pointer-events: none;
		overflow: hidden;
	}

	.star {
		position: absolute;
		top: var(--top);
		left: var(--left);
		width: 5px; /* Slightly larger */
		height: 5px;
		background: #fff;
		border-radius: 50%;
		box-shadow: 0 0 15px 3px rgba(255, 255, 255, 1); /* Brighter glow */
		opacity: 0;
		animation: shooting-star var(--duration) infinite linear;
		animation-delay: var(--delay);
		transform-origin: center;
	}

	.star::after {
		content: '';
		position: absolute;
		top: 50%;
		right: 2px; /* Position relative to star */
		transform: translateY(-50%);
		width: 250px; /* Longer tail */
		height: 3px;
		background: linear-gradient(-90deg, rgba(255, 255, 255, 0.9), transparent);
		transform-origin: right center;
	}

	@keyframes shooting-star {
		0% {
			transform: rotate(var(--angle)) translateX(0) scale(0);
			opacity: 0;
		}
		5% {
			opacity: 1;
			transform: rotate(var(--angle)) translateX(0) scale(1);
		}
		90% {
			opacity: 1;
		}
		100% {
			transform: rotate(var(--angle)) translateX(1800px) scale(0.5);
			opacity: 0;
		}
	}
</style>
