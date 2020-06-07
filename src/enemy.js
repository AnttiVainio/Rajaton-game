"use strict";

function Enemy(id, gl, shader, colorShader, stats, gun, world, x, y, air, blood, water, lava) {
	const COLOR = new Bullet(null, null, null, null, null, null, null, air, blood, water, lava);
	const human = new Human(gl, shader, colorShader, world.getArena(), COLOR, [...RGBFromHue(rand(0, 360)), 1], STATS.enemy(stats), gun, world, x, y, id);

	const PROXIMITY = Math.pow(human.spec() === 2 ? 10 : STATS.enemy(stats).proximity * (human.spec() ? 3 : 1), 2);
	const REACTION = STATS.enemy(stats).reaction * (human.spec() ? 0.5 : 1);
	const CHASE = STATS.enemy(stats).chase;

	const mrot = randDir();
	let mx = x + Math.cos(mrot);
	let my = y + Math.sin(mrot);
	human.act(0.01, [], null, false, mx, my); // get the aiming right

	let wander = true;
	let shoot = 0;
	let up = 0;
	let right = 0;
	let left = 0;
	let think = REACTION;
	let chase = 0;

	this.stopSounds = () => human.stopSounds();

	let skipped = true;
	const ACT_DIST = 5;
	function skip(pos) {
		skipped = toWorldX(pos[0]) < -ACT_DIST || toWorldX(pos[0]) > ACT_DIST || toWorldY(pos[1]) < -ACT_DIST || toWorldY(pos[1]) > ACT_DIST;
		return skipped;
	}

	this.act = function(delta, bullets, ppos, playerBullets, mimicStats) {
		const pos = human.getPos();
		if (skip(pos)) return;

		const delta2 = delta * human.getTimescale();
		shoot -= delta2;
		up -= delta2;
		right -= delta2;
		left -= delta2;
		think -= delta2;
		chase -= delta2;
		if (chase < 0) wander = true;

		const l = lengthSquared(pos[0], pos[1], ppos[0], ppos[1]);
		if (l < PROXIMITY) think = -0.001;

		if (think < 0) {
			think += REACTION;

			let c = false;
			const chase_proximity = 1.5 + Math.max(0, chase);
			if (l < PROXIMITY || ((chase > 0 || (!human.getFlip() && ppos[0] > pos[0]) || (human.getFlip() && ppos[0] < pos[0])) &&
				l < chase_proximity * chase_proximity)) {

				// check line of sight
				c = world.collision(pos[0], pos[1], ppos[0], ppos[1]);
				if (!c || human.spec() === 2) {
					wander = false;
					if (!c) shoot = rand(0, REACTION * 1.5);
					chase = CHASE;
					mx = ppos[0];
					my = ppos[1];
				}
			}

			if (chase > 0) {
				right = 0;
				left = 0;
				if (mx < pos[0]) left = CHASE;
				else right = CHASE;
				if (my + (c ? 0 : 0.5) < pos[1]) up = CHASE;
				else up = 0;
			}

			if (wander) {
				if (randInt(0, 1)) up = rand(0, REACTION * 1.5);
				else up = 0;
				right = 0;
				left = 0;
				if (randInt(0, 1)) {
					if (randInt(0, 1)) right = rand(0, REACTION * 1.5);
					else left = rand(0, REACTION * 1.5);
				}
			}
		}

		human.act(delta, bullets, null, false, mx, my,
			up > 0,
			right > 0,
			left > 0,
			shoot > 0,
			air, blood, water, lava, mimicStats);

		// bullet collision
		const allBullets = [...bullets, ...playerBullets];
		for (const i in allBullets) {
			const damage = human.getHit(allBullets[i]);
			if (damage) {
				wander = false;
				chase = CHASE;
				mx = ppos[0];
				my = ppos[1];
			}
		}

		return human.getHealth() <= 0;
	}

	this.draw = function() {
		if (!skipped) human.draw();
	}

	this.drawBloom = function() {
		if (!skipped) human.drawBloom();
	}
}

function Enemies(gl, shader, colorShader, LEVEL, world, player, extraInitial) {
	let enemyId = 0;
	const enemies = [];
	const bullets = [];

	let initArena = false;
	let spawn = 0;
	const bulletTypes = [STATS.enemy(LEVEL).air, STATS.enemy(LEVEL).blood, STATS.enemy(LEVEL).water, STATS.enemy(LEVEL).lava];
	console.log("Enemy bullet chances:");
	console.log(bulletTypes);

	let minGun, maxGun;
	for (const i in STATS.gun) {
		const gun = STATS.gun[i];
		if (gun.enemyUnlock !== undefined) {
			if (minGun === undefined) minGun = Number(i);
			if (gun.enemyUnlock <= LEVEL) maxGun = Number(i);
		}
	}
	minGun = Math.max(minGun, maxGun - 7);

	this.countAlive = () => enemies.length;

	this.stopSounds = function() {
		for (const i in enemies) enemies[i].stopSounds();
	}

	function spawnEnemy() {
		const r = rand(0, bulletTypes[0] + bulletTypes[1] + bulletTypes[2] + bulletTypes[3]);
		let a = 0, b = 0, w = 0, l = 0;
		if (r < bulletTypes[0]) a = 1;
		else if (r < bulletTypes[0] + bulletTypes[1]) b = 1;
		else if (r < bulletTypes[0] + bulletTypes[1] + bulletTypes[2]) w = 1;
		else if (r < bulletTypes[0] + bulletTypes[1] + bulletTypes[2] + bulletTypes[3]) l = 1;
		const pos = world.enemyLocation(player.getPos());
		enemies.push(new Enemy(enemyId++, gl, shader, colorShader, LEVEL, STATS.gun[randInt(minGun, maxGun)], world, pos[0], pos[1], a, b, w, l));
	}

	const extra = extraInitial === null ? (LEVEL === 1 ? 0 : STATS.enemy(LEVEL).initial) : extraInitial;
	console.log("Extra enemies: " + extra);
	for (let i = 0; i < STATS.enemy(LEVEL).initial + extra; i++) spawnEnemy();

	this.act = function(delta) {
		if (player.getPos()[0] > world.getStart()[0] * 1.01) {
			if (!initArena) {
				if (world.getArena()) {
					initArena = true;
					spawn = 1;
				}
			}
			spawn += delta * (world.getArena() ? STATS.enemy(LEVEL).arenaRate : STATS.enemy(LEVEL).spawnRate);
			while (spawn > 0) {
				spawn -= 1;
				spawnEnemy();
			}
			actObjects(enemies, delta, bullets, player.getPos(), player.getBullets(), player.getMimicStats());
		}
		actObjects(bullets, delta, world);
		for (const i in bullets) player.getHit(bullets[i]);
	}

	this.draw = function() {
		drawObjects(enemies);
		drawObjects(bullets);
	}

	this.drawBloom = function() {
		drawObjects(bullets);
		drawObjectsBloom(enemies);
	}
}
