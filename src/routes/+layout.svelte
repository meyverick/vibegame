<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import sign from '../images/sign.png';
	import { settings } from '$lib/settings.svelte';

	interface DustParticle {
		id: number;
		x: number;
		y: number;
		vx: number;
		vy: number;
		life: number;
	}

	let { children } = $props();
	let isMenuOpen = $state(false);
	let dustParticles: DustParticle[] = $state([]);

	function toggleMenu() {
		isMenuOpen = !isMenuOpen;
	}

	/** @param {PointerEvent} e */
	function handlePointerMove(e: PointerEvent) {
		if (!settings.showBackground || Math.random() > 0.3) return; // Limit density and respect settings
		const id = Math.random();
		dustParticles = [
			...dustParticles,
			{
				id,
				x: e.clientX,
				y: e.clientY,
				vx: (Math.random() - 0.5) * 2,
				vy: (Math.random() - 0.5) * 2,
				life: 1
			}
		];
		
		// Cleanup old particles periodically or limit count
		if (dustParticles.length > 50) {
			dustParticles = dustParticles.slice(-50);
		}
	}

	// Particle animation loop
	$effect(() => {
		if (!settings.showBackground) {
			dustParticles = [];
			return;
		}
		
		const interval = setInterval(() => {
			dustParticles = dustParticles
				.map(p => ({
					...p,
					x: p.x + p.vx,
					y: p.y + p.vy,
					life: p.life - 0.02
				}))
				.filter(p => p.life > 0);
		}, 16);
		return () => clearInterval(interval);
	});
</script>

<svelte:window onpointermove={handlePointerMove} />

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="galaxy-container">
	{#each dustParticles as p (p.id)}
		<div 
			class="dust" 
			style="left: {p.x}px; top: {p.y}px; opacity: {p.life}; transform: scale({p.life});"
		></div>
	{/each}

	<header>
		<button class="menu-trigger" onclick={toggleMenu} aria-label="Toggle Menu">
			<img src={sign} alt="Signature" class="signature" />
		</button>
		
		{#if isMenuOpen}
			<nav class="dropdown-menu">
				<a href="/" onclick={() => isMenuOpen = false}>home</a>
				<a href="/about" onclick={() => isMenuOpen = false}>about</a>
				<div class="menu-divider"></div>
				<div class="settings-panel">
					<label class="checkbox-label">
						<input type="checkbox" bind:checked={settings.showBackground} />
						<span>Show Background</span>
					</label>
					<label class="checkbox-label">
						<input type="checkbox" bind:checked={settings.enableShake} />
						<span>Enable Screen Shake</span>
					</label>
				</div>
			</nav>
		{/if}
	</header>

	{#if settings.showBackground}
		<div class="stars-layer-1"></div>
		<div class="stars-layer-2"></div>
		<div class="stars-layer-3"></div>
		<div class="nebula"></div>
		<div class="artifacts">
			<div class="artifact planet"></div>
			<div class="artifact spiral"></div>
			<div class="constellation constellation-1"></div>
			<div class="constellation constellation-2"></div>
		</div>
	{/if}

	<div class="vignette"></div>
	<div class="content">
		{@render children()}
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		background-color: #020617;
		color: white;
		min-height: 100vh;
		font-family: system-ui, -apple-system, sans-serif;
		overflow-x: hidden;
	}

	.galaxy-container {
		position: relative;
		min-height: 100vh;
		width: 100%;
		background: radial-gradient(ellipse at bottom, #0d1d31 0%, #0c0d13 100%);
		overflow: hidden;
	}

	header {
		position: fixed;
		top: 1rem;
		left: 1rem;
		z-index: 1000;
	}

	.menu-trigger {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		display: block;
		outline: none;
	}

	.signature {
		max-height: 40px;
		mix-blend-mode: screen;
		transition: transform 0.3s ease;
	}

	.dust {
		position: fixed;
		width: 3px;
		height: 3px;
		background: #fff;
		border-radius: 50%;
		pointer-events: none;
		z-index: 10000;
		box-shadow: 0 0 10px 2px rgba(255,255,255,0.8);
	}

	.menu-trigger:hover .signature {
		transform: scale(1.1);
	}

	.dropdown-menu {
		position: absolute;
		top: 100%;
		left: 0;
		margin-top: 1rem;
		background: rgba(15, 23, 42, 0.8);
		backdrop-filter: blur(8px);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 0.5rem;
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		min-width: 200px;
		box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
	}

	.menu-divider {
		height: 1px;
		background: rgba(255, 255, 255, 0.1);
		margin: 0.5rem 0;
	}

	.settings-panel {
		padding: 0.75rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		color: rgba(255, 255, 255, 0.7);
		font-size: 0.85rem;
	}

	.settings-panel label {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.settings-panel input[type="number"] {
		width: 50px;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid rgba(255, 255, 255, 0.2);
		color: white;
		border-radius: 4px;
		padding: 2px 4px;
		text-align: center;
	}

	.checkbox-label {
		cursor: pointer;
		justify-content: flex-start !important;
		gap: 0.5rem;
	}

	.checkbox-label:hover {
		color: white;
	}

	.dropdown-menu a {
		color: rgba(255, 255, 255, 0.7);
		text-decoration: none;
		padding: 0.75rem 1rem;
		transition: all 0.2s;
		font-weight: 500;
		border-radius: 0.25rem;
	}

	.dropdown-menu a:hover {
		color: white;
		background: rgba(255, 255, 255, 0.1);
	}

	.artifacts {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: 1;
		pointer-events: none;
	}

	.artifact {
		position: absolute;
		opacity: 0.4;
	}

	.planet {
		width: 120px;
		height: 120px;
		background: radial-gradient(circle at 30% 30%, #4f46e5, #1e1b4b);
		border-radius: 50%;
		top: 15%;
		right: 10%;
		box-shadow: 
			inset -10px -10px 20px rgba(0,0,0,0.8),
			0 0 40px rgba(79, 70, 229, 0.2);
		filter: blur(1px);
	}

	.planet::after {
		content: "";
		position: absolute;
		top: 50%;
		left: 50%;
		width: 180%;
		height: 20px;
		border: 4px solid rgba(255, 255, 255, 0.1);
		border-radius: 50%;
		transform: translate(-50%, -50%) rotate(20deg);
	}

	.spiral {
		width: 200px;
		height: 100px;
		background: radial-gradient(ellipse, rgba(219, 39, 119, 0.2), transparent 70%);
		top: 60%;
		left: 5%;
		transform: rotate(-30deg);
		filter: blur(10px);
	}

	.constellation {
		position: absolute;
		opacity: 0.15;
		filter: blur(0.5px);
	}

	/* Simple SVG-like constellation patterns using clip-path or masks could work, 
	   but we'll use a CSS-based point-to-point look */
	.constellation-1 {
		top: 25%;
		left: 15%;
		width: 150px;
		height: 150px;
		background: 
			radial-gradient(2px 2px at 10px 10px, #fff, transparent),
			radial-gradient(2px 2px at 50px 40px, #fff, transparent),
			radial-gradient(2px 2px at 90px 20px, #fff, transparent),
			radial-gradient(2px 2px at 120px 80px, #fff, transparent);
		border-left: 1px dashed rgba(255,255,255,0.2);
		border-top: 1px dashed rgba(255,255,255,0.2);
		transform: rotate(15deg);
	}

	.constellation-2 {
		bottom: 20%;
		right: 20%;
		width: 100px;
		height: 200px;
		background: 
			radial-gradient(2px 2px at 20px 150px, #fff, transparent),
			radial-gradient(2px 2px at 50px 100px, #fff, transparent),
			radial-gradient(2px 2px at 80px 50px, #fff, transparent);
		border-right: 1px dashed rgba(255,255,255,0.2);
		transform: rotate(-10deg);
	}

	.content {
		position: relative;
		z-index: 10;
	}

	/* Nebula effect */
	.nebula {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: 1;
		background: 
			radial-gradient(circle at 20% 30%, rgba(76, 29, 149, 0.4), transparent 50%),
			radial-gradient(circle at 80% 70%, rgba(30, 58, 138, 0.4), transparent 50%),
			radial-gradient(circle at 50% 50%, rgba(88, 28, 135, 0.3), transparent 60%);
		filter: blur(60px);
		opacity: 0.6;
	}

	.vignette {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: 1;
		background: radial-gradient(circle, transparent 40%, rgba(0,0,0,0.4) 100%);
		pointer-events: none;
	}

	/* Stars layers with different speeds */
	.stars-layer-1, .stars-layer-2, .stars-layer-3 {
		position: fixed;
		top: -50%;
		left: -50%;
		width: 200%;
		height: 200%;
		z-index: 2;
		pointer-events: none;
	}

	.stars-layer-1 {
		background-image: 
			radial-gradient(2px 2px at 20px 30px, #eee, rgba(0,0,0,0)),
			radial-gradient(2px 2px at 40px 70px, #fff, rgba(0,0,0,0)),
			radial-gradient(2px 2px at 50px 160px, #ddd, rgba(0,0,0,0)),
			radial-gradient(2px 2px at 90px 40px, #fff, rgba(0,0,0,0)),
			radial-gradient(2px 2px at 130px 80px, #fff, rgba(0,0,0,0));
		background-size: 200px 200px;
		animation: moveStars 120s linear infinite;
		opacity: 0.8;
	}

	.stars-layer-2 {
		background-image: 
			radial-gradient(3px 3px at 100px 150px, #fff, rgba(0,0,0,0)),
			radial-gradient(3px 3px at 200px 50px, #eee, rgba(0,0,0,0)),
			radial-gradient(3px 3px at 300px 250px, #fff, rgba(0,0,0,0));
		background-size: 300px 300px;
		animation: moveStars 180s linear infinite;
		opacity: 0.6;
	}

	.stars-layer-3 {
		background-image: 
			radial-gradient(4px 4px at 50px 50px, #fff, rgba(0,0,0,0)),
			radial-gradient(4px 4px at 150px 250px, #ddd, rgba(0,0,0,0));
		background-size: 400px 400px;
		animation: moveStars 240s linear infinite;
		opacity: 0.4;
	}

	@keyframes moveStars {
		from { transform: translate(0, 0); }
		to { transform: translate(-50%, -50%); }
	}
</style>
