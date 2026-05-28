<script lang="ts">
	import { onMount } from 'svelte';
	import { settings } from '$lib/settings.svelte';

	let m = $state({ x: 0, y: 0 });
	let rocket = $state({ x: 0, y: 0, vx: 0, vy: 0 });
	let isGameOver = $state(false);
	let animationFrame: number;

	let globalBest = $state<{ username: string; score: number } | null>(null);
	let leaderboardTTL = $state(0);

	/** @param {PointerEvent} e */
	function handlePointerMove(e: PointerEvent) {
		m.x = e.clientX;
		m.y = e.clientY;
	}

	async function fetchLeaderboard() {
		try {
			const res = await fetch('/api/leaderboard');
			const data = await res.json();
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
		if (leaderboardTTL <= 0) return '24:00:00';
		const h = Math.floor(leaderboardTTL / 3600);
		const m = Math.floor((leaderboardTTL % 3600) / 60);
		const s = Math.floor(leaderboardTTL % 60);
		return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
	});

	function resetGame() {
		isGameOver = false;
		rocket.x = m.x || (typeof window !== 'undefined' ? window.innerWidth / 2 : 0);
		rocket.y = m.y || (typeof window !== 'undefined' ? window.innerHeight / 2 : 0);
		rocket.vx = 0;
		rocket.vy = 0;
	}

	onMount(() => {
		fetchLeaderboard();
		resetGame();

		const ttlInterval = setInterval(() => {
			if (leaderboardTTL > 0) leaderboardTTL -= 1;
		}, 1000);

		let lastTime = performance.now();
		const fpsLimit = 60;
		const interval = 1000 / fpsLimit;

		function tick(currentTime: number) {
			animationFrame = requestAnimationFrame(tick);

			const deltaTime = currentTime - lastTime;
			const interval = 1000 / 30;

			if (deltaTime < interval) {
				return;
			}

			lastTime = currentTime - (deltaTime % interval);

			if (isGameOver) {
				return;
			}

			// Engine force towards mouse
			const engineDx = m.x - rocket.x;
			const engineDy = m.y - rocket.y;
			const engineDist = Math.sqrt(engineDx * engineDx + engineDy * engineDy);
			const engineForce = Math.min(1, engineDist / 100);
			const engineAngle = Math.atan2(engineDy, engineDx);

			rocket.vx += Math.cos(engineAngle) * engineForce;
			rocket.vy += Math.sin(engineAngle) * engineForce;

			// Friction
			rocket.vx *= 0.95;
			rocket.vy *= 0.95;

			rocket.x += rocket.vx;
			rocket.y += rocket.vy;
		}

		animationFrame = requestAnimationFrame(tick);

		return () => {
			if (animationFrame) cancelAnimationFrame(animationFrame);
			clearInterval(ttlInterval);
		};
	});

	let rocketAngle = $derived(Math.atan2(rocket.vy, rocket.vx) * (180 / Math.PI) + 90);
</script>

<svelte:window onpointermove={handlePointerMove} />

<main class:game-over={isGameOver}>
	<div class="leaderboard-preview">
		{#if globalBest}
			<span class="best-label">TOP PILOT:</span>
			<span class="best-value">{globalBest.username} ({globalBest.score})</span>
		{:else}
			<span class="best-label">NO RECORDS YET</span>
		{/if}
		<div class="reset-info">Reset in: {formattedTTL}</div>
	</div>

	<div
		class="rocket"
		style="left: {rocket.x}px; top: {rocket.y}px; transform: translate(-50%, -50%) rotate({rocketAngle}deg);"
	>
		🚀
	</div>

	{#if isGameOver}
		<div class="modal">
			<h1>SPAGHETTIFIED</h1>
			<p>you were pulled into the singularity.</p>
			<button onclick={resetGame}>Try Again</button>
		</div>
	{:else}
		<a href="/about" class="play-link">ENTER MISSION SECTOR ➔</a>
	{/if}
</main>

<style>
	main {
		padding: 2rem;
		text-align: center;
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		background: #020617;
		color: #f8fafc;
	}

	.leaderboard-preview {
		position: fixed;
		top: 1rem;
		right: 1rem;
		background: rgba(255, 255, 255, 0.05);
		padding: 0.75rem 1.25rem;
		border-radius: 1rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
		backdrop-filter: blur(5px);
		z-index: 50;
		text-align: right;
	}

	.reset-info {
		font-size: 0.6rem;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 1px;
		margin-top: 0.25rem;
	}

	.best-label {
		font-size: 0.7rem;
		color: #94a3b8;
		margin-right: 0.5rem;
		letter-spacing: 1px;
	}

	.best-value {
		font-weight: bold;
		color: #10b981;
	}

	.game-over {
		filter: grayscale(0.5) contrast(1.2);
	}

	.rocket {
		position: fixed;
		font-size: 2.5rem;
		z-index: 100;
		pointer-events: none;
		filter: drop-shadow(0 0 10px rgba(239, 68, 68, 0.5));
	}

	.modal {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: rgba(15, 23, 42, 0.9);
		padding: 3rem;
		border-radius: 1rem;
		border: 1px solid #ef4444;
		z-index: 1000;
		backdrop-filter: blur(10px);
		box-shadow: 0 0 50px rgba(239, 68, 68, 0.2);
	}

	h1 {
		position: relative;
		font-size: clamp(2.5rem, 8vw, 4rem);
		margin-bottom: 1rem;
		background: linear-gradient(to bottom right, #fff, #94a3b8);
		background-clip: text;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		text-shadow: 0 0 30px rgba(255, 255, 255, 0.2);
		z-index: 10;
		transition: transform 0.1s ease-out;
		pointer-events: none;
	}

	button,
	.play-link {
		margin-top: 2rem;
		padding: 0.75rem 2rem;
		font-size: 1.25rem;
		background: #ef4444;
		color: white;
		border: none;
		border-radius: 0.5rem;
		cursor: pointer;
		transition: all 0.2s;
		text-decoration: none;
		display: inline-block;
	}

	button:hover,
	.play-link:hover {
		background: #dc2626;
		transform: scale(1.05);
	}

	p {
		font-size: 1.5rem;
		color: #94a3b8;
		z-index: 10;
		pointer-events: none;
	}
</style>
