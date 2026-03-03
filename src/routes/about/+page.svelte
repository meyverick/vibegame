<script>
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let m = $state({ x: 0, y: 0 });
	let charPos = $state({ x: 100, y: 100 });
	let targetPos = $state({ x: 100, y: 100 });
	let isFollowingClick = $state(false);
	let velocity = $state({ x: 0, y: 0 });
	let rotation = $state(0);
	let score = $state(0);
	/** @type {any} */
	let globalBest = $state(null);
	let showHighScorePrompt = $state(false);
	let newHighScoreUsername = $state('');
	let isSubmitting = $state(false);
	let sessionToken = $state('');
	let statusMessage = $state('');

	/** @type {number[]} */
	let lastScores = $state([]);
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

	// Velocity magnitude for panic emoji
	let velocityMagnitude = $derived(Math.sqrt(velocity.x ** 2 + velocity.y ** 2));
	let playerEmoji = $derived(velocityMagnitude > 15 ? '😱' : '🚀');

	/** @type {any[]} */
	let particles = $state([]);
	let mobilityBoostLevel = $state(0);
	let mobilityBonus = $state({
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

	let satellite = $state({
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
	const satelliteSize = 60;
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

	/** @type {Record<string, boolean>} */
	let keys = {
		ArrowUp: false,
		ArrowDown: false,
		ArrowLeft: false,
		ArrowRight: false
	};

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
		setTimeout(() => (isShaking = false), 500);
	}

	function addParticles() {
		if (Math.abs(velocity.x) > 1 || Math.abs(velocity.y) > 1) {
			const id = Math.random();
			particles = [
				...particles,
				{
					id,
					x: charPos.x + charSize / 2,
					y: charPos.y + charSize / 2,
					vx: -velocity.x * 0.2 + (Math.random() - 0.5),
					vy: -velocity.y * 0.2 + (Math.random() - 0.5),
					size: 5 + Math.random() * 10,
					life: 1
				}
			];
		}
	}

	function update() {
		if (!gameOver) {
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
					if (side === 0) { taxCollector.x = Math.random() * window.innerWidth; taxCollector.y = -50; }
					else if (side === 1) { taxCollector.x = window.innerWidth + 50; taxCollector.y = Math.random() * window.innerHeight; }
					else if (side === 2) { taxCollector.x = Math.random() * window.innerWidth; taxCollector.y = window.innerHeight + 50; }
					else { taxCollector.x = -50; taxCollector.y = Math.random() * window.innerHeight; }
					taxCollector.active = true;
				}
			}

			if (taxCollector.active) {
				const dx = charPos.x - taxCollector.x;
				const dy = charPos.y - taxCollector.y;
				const angle = Math.atan2(dy, dx);
				taxCollector.vx += Math.cos(angle) * 0.1;
				taxCollector.vy += Math.sin(angle) * 0.1;
				taxCollector.vx *= 0.98;
				taxCollector.vy *= 0.98;
				taxCollector.x += taxCollector.vx;
				taxCollector.y += taxCollector.vy;

				// Despawn if too far away
				if (typeof window !== 'undefined') {
					if (taxCollector.x < -200 || taxCollector.x > window.innerWidth + 200 || taxCollector.y < -200 || taxCollector.y > window.innerHeight + 200) {
						taxCollector.active = false;
					}
				}
			}

			if (Math.abs(velocity.x) > 0.5 || Math.abs(velocity.y) > 0.5) {
				addParticles();
			}

							// Input handling
							const isAnyKeyPressed = Object.values(keys).some(k => k);
							const currentAccel = acceleration * (1 + (mobilityBoostLevel * 0.5));
							
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
			warp.x += warp.vx;
			warp.y += warp.vy;
			warp.angle += 1;

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
				const t = 1 - (distW / pullRadius); // 1 at center, 0 at edge
				const pull = minPullForce + (maxPullForce - minPullForce) * t;
				
				const angleW = Math.atan2(dyW, dxW);
				velocity.x += Math.cos(angleW) * pull;
				velocity.y += Math.sin(angleW) * pull;
			}
					
																velocity.x *= friction;
					
			velocity.y *= friction;

			charPos.x += velocity.x;
			charPos.y += velocity.y;

			// Update satellite position
			satellite.x += satellite.vx;
			satellite.y += satellite.vy;

			// Update meteorites position
			meteorites.forEach(m => {
				m.y += m.speed;
				m.x += m.vx;
				// The comet emoji (☄️) is drawn at ~135 degrees (pointing down-right)
				// We want its head to point in the direction of velocity (atan2(speed, vx))
				m.angle = (Math.atan2(m.speed, m.vx) * 180 / Math.PI) - 135;
				
				if (typeof window !== 'undefined' && (m.y > window.innerHeight + 100 || m.x < -100 || m.x > window.innerWidth + 100)) {
					m.y = -150;
					m.x = Math.random() * window.innerWidth;
					m.vx = (Math.random() - 0.5) * 6;
					m.speed = 6 + Math.random() * 8;
					m.type = Math.random() < 0.05 ? junkEmojis[Math.floor(Math.random() * junkEmojis.length)] : '☄️';
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

				// Satellite boundary checks
				if (satellite.x < 0 || satellite.x > window.innerWidth - 60) {
					satellite.vx *= -1;
				}
				if (satellite.y < 0 || satellite.y > window.innerHeight - 60) {
					satellite.vy *= -1;
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
					
						checkCollisions();
		}
		requestAnimationFrame(update);
	}

	async function fetchLeaderboard() {
		try {
			const res = await fetch('/api/leaderboard');
			const data = await res.json();
			if (data && data.length > 0) {
				globalBest = data[0];
			}
		} catch (e) {
			console.error('Failed to fetch leaderboard:', e);
		}
	}

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
					token: sessionToken
				})
			});
			
			const data = await res.json();
			
			if (res.ok) {
				showHighScorePrompt = false;
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

	onMount(() => {
		fetchLeaderboard();
		startSession();
		const pollInterval = setInterval(fetchLeaderboard, 10000);
		// Initialize positions based on screen size
		if (typeof window !== 'undefined') {
			charPos = { x: window.innerWidth * 0.2, y: window.innerHeight * 0.2 };
			targetPos = { ...charPos };
			warp.x = window.innerWidth * 0.7;
			warp.y = window.innerHeight * 0.3;
			satellite.x = window.innerWidth * 0.5;
			satellite.y = window.innerHeight * 0.5;
			
							asteroids = Array.from({ length: 5 }, (_, i) => ({
							id: i,
							x: Math.random() * (window.innerWidth - 100) + 50,
							y: Math.random() * (window.innerHeight - 100) + 50,
							exploded: false
						}));
			
												meteorites[0].x = Math.random() * (window.innerWidth - 100) + 50;
												meteorites[0].type = '☄️';
												spawnMobilityBonus();
												spawnShieldBonus();
											}
														const frame = requestAnimationFrame(update);
		return () => {
			cancelAnimationFrame(frame);
			clearInterval(pollInterval);
		};
	});

	function spawnAsteroid() {
		if (typeof window === 'undefined') return;
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

		asteroids = [...asteroids, {
			id,
			x: newX,
			y: newY,
			exploded: false
		}];
	}

	function spawnMobilityBonus() {
		if (typeof window === 'undefined') return;
		mobilityBonus.x = Math.random() * (window.innerWidth - 100) + 50;
		mobilityBonus.y = Math.random() * (window.innerHeight - 100) + 50;
		mobilityBonus.active = true;
	}

	function spawnShieldBonus() {
		if (typeof window === 'undefined' || hasShield || shieldBonus.active) return;
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

	function checkCollisions() {
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
					setTimeout(spawnShieldBonus, 3000);
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

		const handleDeath = () => {
			if (hasShield) {
				hasShield = false;
				triggerShake();
				// Respawn shield after it's been used (with a delay)
				setTimeout(spawnShieldBonus, 3000);
				return true;
			}
			gameOver = true;
			currentDeathMessage = deathMessages[Math.floor(Math.random() * deathMessages.length)];
			
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
			handleDeath();
		}

		// Check satellite collision
		if (!satellite.exploded) {
			const dx = charCenterX - (satellite.x + satelliteSize / 2);
			const dy = charCenterY - (satellite.y + satelliteSize / 2);
			const distance = Math.sqrt(dx * dx + dy * dy);
			if (distance < (charSize + satelliteSize) / 2.5) {
				satellite.exploded = true;
				handleDeath();
			}
		}

		// Check meteorites collision
		meteorites.forEach(m => {
			const dx = charCenterX - (m.x + 30); // Approx center of 4rem meteorite
			const dy = charCenterY - (m.y + 30);
			const distance = Math.sqrt(dx * dx + dy * dy);
			if (distance < (charSize + 40) / 2) {
				if (handleDeath()) {
					// "Destroy" the meteorite by pushing it off-screen so it resets
					m.y = window.innerHeight + 200;
				}
			}
		});

		// Check mobility bonus collision
		if (mobilityBonus.active) {
			const dx = charPos.x - mobilityBonus.x;
			const dy = charPos.y - mobilityBonus.y;
			const distance = Math.sqrt(dx * dx + dy * dy);
			if (distance < charSize) {
				mobilityBonus.active = false;
				mobilityBoostLevel += 1;
				triggerShake();
				// Respawn bonus elsewhere
				setTimeout(spawnMobilityBonus, 1000);
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
					
					setTimeout(() => {
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
		charPos = { x: 100, y: 100 };
		velocity = { x: 0, y: 0 };
		score = 0;
		gameOver = false;
		showHighScorePrompt = false;
		statusMessage = '';
		startSession();
		mobilityBoostLevel = 0;
		hasShield = false;
		shieldBonus.active = false;
		taxCollector.active = false;
		taxedPopup.active = false;
		spawnMobilityBonus();
		spawnShieldBonus();
		satellite = {
			x: 400,
			y: 400,
			vx: (Math.random() - 0.5) * 2,
			vy: (Math.random() - 0.5) * 2,
			exploded: false
		};
		meteorites = [{
			id: Math.random(),
			x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth - 100 : 800) + 50,
			y: -150,
			speed: 6 + Math.random() * 8,
			vx: (Math.random() - 0.5) * 6,
			angle: 0,
			type: '☄️'
		}];
	}

	/**
	 * @param {MouseEvent} event
	 */
	function handleMousemove(event) {
		m.x = event.clientX;
		m.y = event.clientY;
	}

	/**
	 * @param {PointerEvent} event
	 */
	function handlePointerDown(event) {
		// Prevent click handling if we're clicking the navigation
		if (event.target instanceof HTMLAnchorElement) return;
		
		targetPos.x = event.clientX - charSize / 2;
		targetPos.y = event.clientY - charSize / 2;
		isFollowingClick = true;
	}

	/**
	 * @param {KeyboardEvent} event
	 */
	function handleKeydown(event) {
		if (event.key in keys) {
			keys[event.key] = true;
		}
	}

	/**
	 * @param {KeyboardEvent} event
	 */
	function handleKeyup(event) {
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

<div class="game-container" class:shake={isShaking}>
	{#each particles as p (p.id)}
		<div
			class="particle"
			style="left: {p.x}px; top: {p.y}px; width: {p.size}px; height: {p.size}px; opacity: {p.life};"
		></div>
	{/each}

	{#each asteroids as ast (ast.id)}
		<div 
			class="asteroid"
			class:exploding={ast.exploded}
			style="left: {ast.x}px; top: {ast.y}px;"
		>
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

	<div class="character" class:hyper={mobilityBoostLevel > 0} style="left: {charPos.x}px; top: {charPos.y}px; transform: rotate({rotation}deg) {spaghettiScale}; filter: drop-shadow(0 0 {10 + mobilityBoostLevel * 5}px #00f2ff) hue-rotate({mobilityBoostLevel * 45}deg);">
		{#if hasShield}
			<div class="shield-effect"></div>
		{/if}
		{playerEmoji}
	</div>

	{#if mobilityBonus.active}
		<div class="bonus-mobility" style="left: {mobilityBonus.x}px; top: {mobilityBonus.y}px; filter: drop-shadow(0 0 {10 + mobilityBoostLevel * 5}px #00f2ff);">
			⚡
		</div>
	{/if}

	{#if shieldBonus.active}
		<div class="bonus-shield" style="left: {shieldBonus.x}px; top: {shieldBonus.y}px;">
			🛡️
		</div>
	{/if}

	<div class="satellite" class:exploded={satellite.exploded} style="left: {satellite.x}px; top: {satellite.y}px;">
		{satellite.exploded ? '💥' : '🛰️'}
	</div>

	{#each meteorites as m (m.id)}
		<div class="falling-asteroid" style="left: {m.x}px; top: {m.y}px; transform: rotate({m.angle}deg);">
			{m.type || '☄️'}
			{#if m.type && m.type !== '☄️'}
				<div class="junk-label">Celestial Clutter</div>
			{/if}
		</div>
	{/each}

	{#if taxCollector.active}
		<div class="tax-collector" style="left: {taxCollector.x}px; top: {taxCollector.y}px;">
			🕴️
		</div>
	{/if}

	{#if taxedPopup.active}
		<div class="taxed-popup" style="left: {taxedPopup.x}px; top: {taxedPopup.y}px; opacity: {taxedPopup.timer / 120}; color: {taxedPopup.text === 'BLOCKED!' ? '#10b981' : '#ff4444'};">
			{taxedPopup.text}
		</div>
	{/if}

	{#if gameOver}
		<div class="game-over">
			{#if showHighScorePrompt}
				<h1 class="new-record">NEW GALAXY RECORD!</h1>
				<p>Your score of {score} is the best in the universe.</p>
				<div class="input-group">
					<input 
						type="text" 
						bind:value={newHighScoreUsername} 
						placeholder="Enter your pilot name"
						maxlength="20"
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
				<button onclick={restart}>Try Again</button>
			{/if}
		</div>
	{/if}

	<div class="shooting-stars">
		{#each stars as star (star.id)}
			<div
				class="star"
				style="--top: {star.top}%; --left: {star.left}%; --delay: {star.delay}s; --duration: {star.duration}s; --angle: {star.angle}deg;"
			></div>
		{/each}
	</div>

	<div class="score-board">
		<div class="current-score">Score: {score}</div>
		{#if globalBest}
			<div class="global-best">Best: {globalBest.score} ({globalBest.username})</div>
		{/if}
		{#if mobilityBoostLevel > 0}
			<div class="boost-level" style="color: #00f2ff;">Boost: x{mobilityBoostLevel}</div>
		{/if}
		{#if lastScores.length > 0}
			<div class="last-tries">
				<div class="last-title">Last tries:</div>
				{#each lastScores as s}
					<div class="past-score">{s}</div>
				{/each}
			</div>
		{/if}
	</div>

	<main>
		<h1>about</h1>
		<p>this is the about page.</p>
	</main>
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
		transition: transform 0.1s;
	}

	.game-container.shake {
		animation: shake 0.3s infinite;
	}

	.particle {
		position: fixed;
		background: radial-gradient(circle, #ff9d00 0%, #ff4400 100%);
		border-radius: 50%;
		pointer-events: none;
		z-index: 18;
		filter: blur(2px);
	}

	@keyframes shake {
		0% { transform: translate(1px, 1px) rotate(0deg); }
		10% { transform: translate(-1px, -2px) rotate(-1deg); }
		20% { transform: translate(-3px, 0px) rotate(1deg); }
		30% { transform: translate(3px, 2px) rotate(0deg); }
		40% { transform: translate(1px, -1px) rotate(1deg); }
		50% { transform: translate(-1px, 2px) rotate(-1deg); }
		60% { transform: translate(-3px, 1px) rotate(0deg); }
		70% { transform: translate(3px, 1px) rotate(-1deg); }
		80% { transform: translate(-1px, -1px) rotate(1deg); }
		90% { transform: translate(1px, 2px) rotate(0deg); }
		100% { transform: translate(1px, -2px) rotate(-1deg); }
	}

	main {
		position: absolute;
		top: 2rem;
		left: 2rem;
		z-index: 10;
		pointer-events: none;
	}

	main h1, main p {
		margin: 0;
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

	.new-record {
		color: #ffd700 !important;
		animation: pulse-gold 2s infinite;
	}

	@keyframes pulse-gold {
		0%, 100% { text-shadow: 0 0 10px #ffd700; }
		50% { text-shadow: 0 0 30px #ffd700; }
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
		font-size: 3rem;
		z-index: 20;
		user-select: none;
		pointer-events: none;
		filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.5));
		transition: filter 0.3s;
	}

	.character.hyper {
		filter: drop-shadow(0 0 15px #00f2ff) hue-rotate(180deg);
	}

	.bonus-mobility {
		position: fixed;
		font-size: 3rem;
		z-index: 15;
		user-select: none;
		pointer-events: none;
		animation: pulse-bonus 1s ease-in-out infinite;
		filter: drop-shadow(0 0 10px #00f2ff);
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
		box-shadow: 0 0 20px #10b981, inset 0 0 20px #10b981;
		opacity: 0.6;
		animation: shield-vibrate 0.2s infinite;
	}

	@keyframes pulse-shield {
		0%, 100% { transform: scale(1); filter: drop-shadow(0 0 10px #10b981); }
		50% { transform: scale(1.3); filter: drop-shadow(0 0 25px #10b981); }
	}

	@keyframes shield-vibrate {
		0% { transform: translate(-50%, -50%) scale(1); }
		50% { transform: translate(-52%, -48%) scale(1.05); }
		100% { transform: translate(-50%, -50%) scale(1); }
	}

	@keyframes pulse-bonus {
		0%, 100% { transform: scale(1); filter: drop-shadow(0 0 10px #00f2ff); }
		50% { transform: scale(1.3); filter: drop-shadow(0 0 20px #00f2ff); }
	}

	.asteroid {
		position: fixed;
		font-size: 2.5rem;
		z-index: 15;
		user-select: none;
		pointer-events: none;
		transition: transform 0.2s;
		animation: float-star 3s ease-in-out infinite, glow-star 2s ease-in-out infinite;
	}

	@keyframes float-star {
		0%, 100% { transform: translateY(0); }
		50% { transform: translateY(-10px); }
	}

	@keyframes glow-star {
		0%, 100% { filter: drop-shadow(0 0 5px #ffd700); }
		50% { filter: drop-shadow(0 0 20px #ffd700); }
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
		0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.8; }
		50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.2; }
		100% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.8; }
	}

	.satellite {
		position: fixed;
		font-size: 5rem;
		z-index: 150;
		user-select: none;
		pointer-events: none;
		filter: drop-shadow(0 0 15px rgba(255, 255, 255, 0.4));
	}

	.satellite.exploded {
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
		0%, 100% { transform: scale(1) rotate(0deg); }
		50% { transform: scale(1.1) rotate(5deg); }
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
		0% { transform: translate(-50%, 0); }
		100% { transform: translate(-50%, -100px); }
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
		z-index: 200;
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

	@keyframes float {
		0%, 100% { transform: translate(-50%, 0) rotate(0deg); }
		50% { transform: translate(-50%, -15px) rotate(5deg); }
	}

	@keyframes explode {
		0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
		50% { transform: translate(-50%, -50%) scale(2); opacity: 0.8; }
		100% { transform: translate(-50%, -50%) scale(3); opacity: 0; }
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
