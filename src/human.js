"use strict";

function Human(gl, shader, colorShader, spawnEffect, color, visorColor, stats, gun, world, x, y, enemyId = -1) {
	const box = new BoxTex(gl, shader, "player0");
	const visor = new BoxTex(gl, shader, "visor");
	const gunBox = {};
	const glowBox = new BoxTex(gl, shader, "particle");
	glowBox.setAdditive();
	const frostBox = new BoxTex(gl, shader, "frost");
	frostBox.setAdditive();
	const beam = new Beam(gl, colorShader);
	beam.setAdditive();

	const SIZE = 0.08;
	const OWNSPEEDMULT = 0.3;

	const SPAWN_VOL = 0.3;
	const AIR1_VOL = 0.09;
	const AIR2_VOL = 0.13;

	let special = 0;
	let mimic = false;
	if (!stats.player) {
		if (!randInt(0, 30)) special = 1;
		if (special) {
			color = [0, 0, 0, 1];
			visorColor = [1.5, 1.5, 1.5, 1];
		}
		if (!randInt(0, 40)) special = 2;
		if (special === 2) {
			color = [3, 3, 3, 1];
			visorColor = [1.5, 0, 0, 1];
		}
		if (!special && !randInt(0, 80)) mimic = true;
	}
	if (mimic || stats.player) {
		color = [0.3, 0.5, 0.1, 1];
		visorColor = [0.1, 0.3, 1, 1];
	}
	this.spec = () => special;

	let sx = 0;
	let sy = 0;
	let knockbackx = 0;
	let knockbacky = 0;
	let speed = 0;
	let anim = 0;
	let inAir = true;
	let moveFlip = randInt(0, 1);
	let cooldown = 0;
	let accuracy = 0;
	let recoil = 0;
	let frost = 0;
	let frostParticles = 0;
	let burn = 0;
	let burnParticles = 0;
	let targetOffset = [0, 0];
	let mousex;
	let mousey;
	let airParticles = 0;
	let spawn = spawnEffect ? (stats.player ? 1 : 1.5) : -1;
	const maxSpawn = spawn;
	let exit = -1;

	// stats
	let health = stats.health * [1, 0.7, 1.3][special] * (mimic ? 1.6 : 1);
	const maxHealth = health;
	const armor = stats.armor;
	const moveSpeed = stats.moveSpeed * [1, 3, 0.9][special];
	const moveSpeedY = stats.moveSpeedY * [1, 3, 0.9][special];
	// gun stats
	let ACCURACY;
	let RECOIL;
	let MOVE_ACCURACY;
	let bulletSpeed;
	let shootSpeed;

	// sounds
	const soundVolume = stats.player ? 1 : 0.6;
	const soundVolumeTele = stats.player ? 1 : 0.8;
	let spawnSound;
	let airSound;
	let airSound2;
	this.stopSpawnSound = function() {
		if (spawnSound) {
			spawnSound.pause();
			spawnSound = null;
		}
	}
	this.stopAirSound = function() {
		if (airSound) {
			airSound.pause();
			airSound = null;
		}
	}
	this.stopAirSound2 = function() {
		if (airSound2) {
			airSound2.pause();
			airSound2 = null;
		}
	}
	this.playAirSound2 = function() {
		if (!airSound2) airSound2 = playSoundWorldDuration("noise1", camerax, cameray, 0, AIR2_VOL, 2);
	}
	this.stopSounds = function() {
		this.stopSpawnSound();
		this.stopAirSound();
		this.stopAirSound2();
	}

	this.setGun = function(g) {
		gun = g;
		ACCURACY = gun.accuracy * (stats.player ? 1 : ((gun.bullets || 1) >= 3 ? 1.5 : 3));
		RECOIL = gun.recoil * (stats.player ? 1 : 0.2);
		MOVE_ACCURACY = gun.moveAccuracy;
		bulletSpeed = gun.bulletSpeed * (stats.player ? 1 : 0.65);
		shootSpeed = stats.player ? gun.shootSpeed : Math.min(13, gun.shootSpeed);
		if (!gunBox[gun.sprite]) gunBox[gun.sprite] = new BoxTex(gl, shader, gun.sprite);
	}
	this.setGun(gun);

	this.getSize = () => SIZE;
	this.getFlip = () => mousex === undefined || mousey === undefined ? moveFlip : mousex < x;
	this.getPos = () => [x, y];
	this.getHealth = () => health;
	this.modHealth = (h, _armor) => health = Math.min(maxHealth, health + (h < 0 ? h / (_armor || armor) : h));
	this.isActive = () => {
		const retval = health > 0 && spawn < 0 && exit < 0;
		if (!retval) {
			this.stopAirSound();
			this.stopAirSound2();
		}
		return retval;
	};
	this.spawning = () => spawn >= 0 || exit >= 0;
	this.getAccuracy = (tx, ty) => length(x, y, tx, ty) * accuracy * ACCURACY * 0.3;
	this.getTargetOffset = () => targetOffset;
	this.getExit = () => exit;
	this.getTimescale = () => Math.max(0.65, 1 - frost * 0.15);

	this.knockback = function(d) {
		if (d) {
			const l = length(d[0], d[1]);
			const mult = Math.sqrt(l) / l * (stats.player ? 0.05 : 0.2);
			knockbackx += d[0] * mult;
			knockbacky += d[1] * mult;
		}
	}

	this.canShoot = function(delta) {
		return cooldown - delta * this.getTimescale() <= 0;
	}

	function createGibs(speed) {
		particles.createGibs(x, y, speed, color, gun.sprite);
	}

	this.getHit = function(bullet) {
		if (!this.isActive()) return 0;

		const bloodSound = (dmg, vol) => dmg > 0 ? playSoundWorld("blood1", x, y, vol * (stats.player ? 0.7 : 0.9),
			Math.max(1, (1 + 2 * Math.pow(1.1, -dmg)))) : 0;
		let totalDamage = 0;
		const bulletSpeed = bullet.getSpeed();
		// saving grace for player
		const canDie = !stats.player || health <= 1;

		while (true) {
			const damage = bullet.getHit(x, y, SIZE, enemyId);
			if (damage[0] <= 0) {
				if (totalDamage) {
					bloodSound(totalDamage, 0.5);
					this.knockback(bulletSpeed);
				}
				return totalDamage;
			}
			totalDamage += damage[0];

			const amount = damage[0] * BLOOD_AMOUNT * (stats.player ? 1 : 10 / maxHealth) + rand(0, 0.5);
			for (let j = 0; j < amount; j++) {
				particles.createBlood(x, y, bulletSpeed[0], bulletSpeed[1], stats.player ? false : !randInt(0,3));
			}
			const armor2 = mix(-1, MAX_ARMOR_DAMAGE, 1, armor, Math.min(MAX_ARMOR_DAMAGE, bullet.getTotalDamage()));
			frost += damage[1] / armor2;
			burn += damage[2] / armor2;
			this.modHealth(-damage[0], armor2);

			if (health <= 0) {
				bloodSound(totalDamage, 1);
				this.knockback(bulletSpeed);
				if (canDie) createGibs(length(bulletSpeed[0], bulletSpeed[1]));
				else {
					bullet.remove();
					health = 1;
					frost = 0;
					burn = 0;
				}
				sx *= 0.5;
				sy *= 0.5;
				return totalDamage;
			}
		}
	}

	function movement(right, left, delta2) {
		if (right) { // D - RIGHT
			speed = Math.min(1, speed + delta2 * 4);
			sx += delta2 * 2;
			moveFlip = false;
			anim = (anim + delta2 * 15) % 4;
		}
		if (left) { // A - LEFT
			speed = Math.min(1, speed + delta2 * 4);
			sx -= delta2 * 2;
			moveFlip = true;
			anim = (anim + delta2 * 15) % 4;
		}

		sy += 2.5 * delta2; // gravity

		sx = clamp(sx, -0.6, 0.6);
		sy = clamp(sy, -1, 1);
		const ownspeedx = sx * speed * moveSpeed + knockbackx;
		const ownspeedy = sy * moveSpeedY + knockbacky;
		const x2 = x + ownspeedx * delta2;
		const y2 = y + ownspeedy * delta2;

		// collision with world
		const c = world.collisionBox(x, y, x2, y2, SIZE * 0.5, SIZE);
		inAir = true;
		if (c) {
			x = c[0];
			y = c[1];
			if (sy > 0 && (
				world.collision(x + SIZE * 0.5, y + SIZE, x + SIZE * 0.5, y + SIZE + 0.002) ||
				world.collision(x - SIZE * 0.5, y + SIZE, x - SIZE * 0.5, y + SIZE + 0.002))) {
					sy = 0; // reset gravity
					inAir = false;
				}
		}
		else {
			x = x2;
			y = y2;
		}

		return [ownspeedx, ownspeedy];
	}

	this.act = function(delta, bullets, shakeFun, recharging, mx, my, up, right, left, shoot, air, blood, water, lava, mimicStats) {
		this.isActive(); // stop air sound

		if (mimic && mimicStats) {
			up = mimicStats[0];
			right = mimicStats[2];
			left = mimicStats[1];
			shoot = mimicStats[3];
			mx = x - mimicStats[4];
			my = y + mimicStats[5];
		}

		if (health <= 0) {
			sx *= Math.pow(0.5, delta);
			sy *= Math.pow(0.5, delta);
		}

		if (exit >= 0) {
			exit += delta;
			return;
		}

		const portalParticles = () => {
			playSoundWorld("tele", x, y, soundVolumeTele * 0.45, 0.5);
			this.stopSpawnSound();
			for (let i = 0; i < (stats.player ? 50 : 15); i++) particles.createParticle2(x, y);
			if (shakeFun) {
				for (let i = 0; i < 4; i++) shakeFun(10);
			}
		};

		// spawn
		if (spawn >= 0) {
			const spawnVolume = (1 - spawn * 0.7) * SPAWN_VOL;
			if (!spawnSound) spawnSound = playSoundWorldDuration("noise2", x, y, 0, soundVolumeTele * spawnVolume);
			else setWorldVolume(spawnSound, x, y, spawnVolume);
			const shake = Math.round(spawn * 10);
			spawn -= delta * 0.5;
			if (shakeFun && shake !== Math.round(spawn * 10)) shakeFun(0);
			if (spawn < 0) portalParticles();
		}

		// exit
		if (stats.player) {
			const exitPos = world.getExit();
			if (lengthSquared(x, y, exitPos[0], exitPos[1]) < PORTALSIZE * PORTALSIZE) {
				exit = 0;
				sx = 0;
				sy = 0;
				speed = 0;
				portalParticles();
				world.hideExit();
				return;
			}
		}

		shoot = shoot && (air || blood || water || lava);
		const delta2 = delta * this.getTimescale();

		if (mx !== undefined && my !== undefined) {
			if (mousex !== undefined && mousey !== undefined) accuracy += length(mx, my, mousex, mousey) * MOVE_ACCURACY;
			mousex = mx;
			mousey = my;
		}
		cooldown -= delta2;
		accuracy *= Math.pow(0.015, delta2);
		recoil *= Math.pow(0.2, delta2);
		knockbackx *= Math.pow(0.01, delta2);
		knockbacky *= Math.pow(0.01, delta2);

		if (this.isActive()) {
			frost = Math.max(0, frost - delta * 8);
			frostParticles += frost * delta * 10;
			while (frostParticles > 0) {
				frostParticles--;
				particles.createAir(x + rand(-1, 1) * SIZE, y + rand(-1, 1) * SIZE, rand(-0.2, 0.2), rand(-0.2, 0.2), [0, 1, 1]);
			}
			const burn0 = burn;
			burn = Math.max(0, burn - delta * 5 * armor);
			burnParticles += burn * delta * 10;
			while (burnParticles > 0) {
				burnParticles--;
				particles.createAir(x + rand(-1, 1) * SIZE, y + rand(-1, 1) * SIZE, rand(-0.2, 0.2), -rand(0.1, 0.7), [1, 0.5, 0]);
			}
			this.modHealth(burn - burn0);
			if (health <= 0) createGibs(1);

			if (recharging) {
				if (cooldown < 0) cooldown = 0;
				const _targetOffset = mousex && mousey ? [mousex - x, mousey - y] : null;
				movement(false, false, delta2 * 0.4);
				if (_targetOffset) {
					mousex = x + _targetOffset[0];
					mousey = y + _targetOffset[1];
				}
				return;
			}

			speed *= Math.pow(0.01, delta2);

			if (up) {
				if (stats.player && !airSound) airSound = playSoundWorldDuration("noise1", camerax, cameray, 0, AIR1_VOL);
				sy -= delta2 * (sy > 0 ? 8 : 4); // W - UP
				airParticles += delta2 * 40;
				while (airParticles > 0) {
					airParticles--;
					particles.createAir(x + rand(-1, 1) * SIZE * 0.5, y + SIZE * 0.7, rand(-0.2, 0.2), rand(0.1, 0.7));
				}
			}
			else this.stopAirSound();

			const ownspeed = movement(right, left, delta2);

			let v, rec;

			if (mx !== undefined && my != undefined) {
				const x1 = mx - x;
				const y1 = my - y;
				const l = 1 / length(x1, y1);
				v = [x1 * l, y1 * l];
				const rot = Math.atan2(v[0], v[1]);
				rec = (rot < 0 ? mix(0, Math.PI, recoil, 0, Math.abs(rot * 2 + Math.PI)) : mix(0, Math.PI, -recoil, 0, Math.abs(rot * 2 - Math.PI))) * RECOIL;
				const target = rotateVector([x1, y1], rec);
				targetOffset = [target[0] - x1, target[1] - y1];
			}

			let retval = false;

			// shooting 1
			if (cooldown <= 0 && shoot) {
				for (let b = 0; b < (gun.bullets || 1); b++) {
					const ownspeedx2 = gun.ignoreOwnSpeed ? 0 : ownspeed[0] * OWNSPEEDMULT;
					const ownspeedy2 = gun.ignoreOwnSpeed ? 0 : ownspeed[1] * OWNSPEEDMULT;
					const v1 = rotateVector(v, rand(-accuracy, accuracy) * ACCURACY + rec);
					const bs = rand(0.7, 1.3) * bulletSpeed;
					const bullet = new Bullet(gl, shader, x, y,
						v1[0] * bs + ownspeedx2, v1[1] * bs + ownspeedy2, gun, air, blood, water, lava, enemyId);
					bullets.push(bullet);

					if (b === 0) playSoundWorld(gun.sound[0], x, y, gun.sound[1] * soundVolume,
						Math.max(0.5, (0.4 + 3 * Math.pow(1.1, -bullet.getDamage() * (gun.penetration || 1) * (gun.bullets || 1))) * (stats.player ? 1 : 0.7)));

					for (let i = 0; i < 8; i++) {
						const v2 = rotateVector(v1, rand(-1, 1) * 0.9);
						const s = rand(1, 3);
						particles.createParticle1(x, y,
							v2[0] * s + ownspeedx2, v2[1] * s + ownspeedy2, gun.size, bullet.getSpeedMult(), bullet.getColor());
					}

					accuracy += 1;
				}
				recoil += 1;
				cooldown += 1 / shootSpeed;
				retval = true;
			}
			if (cooldown < 0) cooldown = 0;

			return retval;
		}
	}

	this.draw = function() {
		if (this.isActive()) {
			const flip = this.getFlip();
			const c = 0.35 + world.getLighting(x, y) * 7;
			const sprite = inAir ? 1 : Math.floor(anim);
			box.setTexture("player" + (sprite === 3 ? 1 : sprite));
			box.draw(toWorldX(x), toWorldY(y), SIZE * 0.9 * (flip ? -1 : 1), SIZE * 1.1,
				[
					c * (mix(0, 5, color[0], 0, Math.max(burn, frost)) + burn * 0.2),
					c *  mix(0, 5, color[1], 0, Math.max(burn, frost)),
					c * (mix(0, 5, color[2], 0, Math.max(burn, frost)) + frost * 0.2),
					color[3],
				]);
			visor.draw(toWorldX(x), toWorldY(y), SIZE * 0.9 * (flip ? -1 : 1), SIZE * 1.1, visorColor);
			// gun
			const targetOffset = this.getTargetOffset();
			const rot = mousex === undefined || mousey === undefined ? 0 :
				Math.atan2(x - mousex - targetOffset[0], mousey + targetOffset[1] - y) + Math.PI * (flip ? -0.5 : 0.5);
			gunBox[gun.sprite].drawRot(toWorldX(x + SIZE * (flip ? -0.2 : 0.2)), toWorldY(y - SIZE * 0.1), SIZE * 0.8 * (flip ? -1 : 1), SIZE * 0.8, rot);
		}
	}

	this.drawBloom = function() {
		if (this.isActive()) {
			visor.draw(toWorldX(x), toWorldY(y), SIZE * 0.8 * (this.getFlip() ? -1 : 1), SIZE * 1.1, visorColor);
			if (frost > 0) frostBox.draw(toWorldX(x), toWorldY(y),
				PORTALSIZE * (0.6 + frost * 0.02), PORTALSIZE * (0.9 + frost * 0.03),
				[0, 1, 1, Math.min(0.35, frost * 0.035)]);
			// laser
			const targetOffset = this.getTargetOffset();
			const rot = mousex === undefined || mousey === undefined ? 0 :
				Math.atan2(x - mousex - targetOffset[0], mousey + targetOffset[1] - y) + Math.PI * 0.5;
			const x1 = toWorldX(x + SIZE * (this.getFlip() ? -0.2 : 0.2)) + Math.cos(rot) * SIZE;
			const y1 = toWorldY(y - SIZE * 0.1) + Math.sin(rot) * SIZE;
			const len = stats.player ? 0.4 : (special === 2 ? 1.5 : 0.7);
			beam.draw(x1, y1, x1 + Math.cos(rot) * len, y1 + Math.sin(rot) * len, 0.0037, [(0.05 + world.getLighting(x, y)) * (stats.player ? 2 : 4), 0, 0, 1]);
		}
		if (spawn >= 0) {
			glowBox.draw(toWorldX(x), toWorldY(y), PORTALSIZE, PORTALSIZE * 1.3, [0, 1, 0, mix(maxSpawn, 0, 0, 0.5, spawn)]);
		}
	}

	this.getCamera = function(delta, camerax, cameray) {
		return [
			camerax + (x + 0.5 * sx * speed * moveSpeed - camerax) * Math.min(1, delta * 1.5),
			cameray + (y + 0.5 * sy * moveSpeedY - cameray) * Math.min(1, delta * 1.5),
		];
	}
}
