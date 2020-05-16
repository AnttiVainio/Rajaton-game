"use strict";

function Player(gl, shader, colorShader, textShader, LEVEL, menu, inventory, world, fluid, keyboard, mouse) {
	const fadeBox = new BoxTex(gl, shader, "fade1");
	fadeBox.setAdditive();
	const buttonBox = new BoxTex(gl, shader, "button");
	const spaceBox = new BoxTex(gl, shader, "button_space");
	const arrowBox = new BoxTex(gl, shader, "arrow");
	arrowBox.setAdditive();
	const jarBox = new BoxTex(gl, shader, "jar");
	const jarfadeBox = new BoxTex(gl, shader, "jarfade");
	jarfadeBox.setAdditive();
	const glowBox = new BoxTex(gl, shader, "particle");
	glowBox.setAdditive();
	const colorBox = new Box(gl, colorShader);
	const txt = new Text(gl, textShader);

	if (!menu && !inventory) playSong(LEVEL === 1 ? 1 : randInt(1, 2));

	const STATS_PLAYER = STATS.player(LEVEL);

	const ARROW_SIZE = 0.05;
	const SELECT_VOL = 0.6;

	const BLOOD_AIR_PARTICLES = 4;
	const FLUID_AIR_PARTICLES = 1;

	const RECHARGE = STATS_PLAYER.rechargeTime;
	const JETPACK_DRAIN = STATS_PLAYER.jetpackDrain;
	const BLOOD_CONVERSION = STATS_PLAYER.bloodConversion;
	const FLUID_CONVERSION = STATS_PLAYER.fluidConversion;
	const SPECIAL_AMMO = STATS_PLAYER.specialAmmo;
	const HEAL = STATS_PLAYER.heal;

	let minGun, maxGun, gunSelection;
	for (const i in STATS.gun) {
		const gun = STATS.gun[i];
		if (gun.unlock !== undefined) {
			if (minGun === undefined) minGun = Number(i);
			if (gun.unlock <= LEVEL) maxGun = Number(i);
			if (gun.unlock === LEVEL) gunSelection = Number(i);
		}
	}
	if (gunSelection === undefined) gunSelection = inventory ? inventory.gunSelection : maxGun;
	let gun = STATS.gun[gunSelection];
	let gunText = 1;
	let gunSelectLock = false;

	const x = world.getStart()[0];
	const y = world.getStart()[1];
	const human = new Human(gl, shader, colorShader, true, null, null, STATS_PLAYER, gun, world, x, y);
	if (inventory) human.modHealth(inventory.health - STATS_PLAYER.health, Math.max(1, STATS_PLAYER.armor));

	let camerax = x;
	let cameray = y;
	let cameraShakex = 0;
	let cameraShakey = 0;
	let menuCamera = rand(-200, 0);

	let prevHealth = human.getHealth();
	let healthFlash = 0;
	let heal = 0;
	let healFade = 0;
	let recharge = 0;
	let rechargeParticles = 0;
	let rechargeNag = 0;
	let bloodGlow = 0;
	let waterGlow = 0;
	let lavaGlow = 0;
	let air = LEVEL === 1 ? JETPACK_DRAIN * 0.8 : 100;
	let blood = inventory ? inventory.blood : 0;
	let water = inventory ? inventory.water : 35;
	let lava = inventory ? inventory.lava : 0;
	let arenaEntered = false;

	let drainSound = 0;
	const playDrainSound = function() {
		if (drainSound < 0) {
			playSound("drain", 0.2);
			drainSound = 0.3;
		}
	}

	const bullets = [];

	this.getPos = () => human.getPos();
	this.getHealth = () => menu ? 0 : human.getHealth();
	this.getGlobalTimescale = () => !menu && this.getHealth() <= 0 ? 0.2 : 1;
	this.getAccuracy = (tx, ty) => human.getAccuracy(tx, ty);
	this.getTargetOffset = () => human.getTargetOffset();
	this.getBullets = () => bullets;
	this.getExit = () => human.getExit();
	this.getInventory = () => ({gunSelection, health: human.getHealth(), air, blood, water, lava});
	this.stopSounds = () => human.stopSounds();

	let mimicStats;
	this.getMimicStats = () => mimicStats;

	this.quit = function() {
		menu = true;
	}

	this.shakeCamera = function(damage) {
		if (SETTINGS.enableShake) {
			cameraShakex += rand(-1, 1) * (Math.min(15, damage) + 2) * SHAKE_AMOUNT;
			cameraShakey += rand(-1, 1) * (Math.min(15, damage) + 2) * SHAKE_AMOUNT;
		}
	}

	this.getHit = function(bullet) {
		const damage = human.getHit(bullet);
		if (damage) this.shakeCamera(damage);
	}

	function createAirParticle(color) {
		const v = rotateVector([human.getSize() * (color ? 4 : 6), 0], randDir());
		const pos = human.getPos();
		particles.createAir(pos[0] + v[0], pos[1] + v[1], -v[0] * 1.8, -v[1] * 1.8, color);
	}

	this.act = function(delta, mToGamex, mToGamey) {
		bloodGlow -= delta * 0.4;
		waterGlow -= delta * 0.4;
		lavaGlow -= delta * 0.4;
		drainSound -= delta;
		healthFlash *= Math.pow(0.01, delta);
		const newHealth = human.getHealth();
		if (newHealth < prevHealth) healthFlash += prevHealth - newHealth;
		prevHealth = newHealth;

		if (menu) {
			menuCamera += delta;
			updateCamera(
				world.getSizex() * TILESIZE * mix(-1, 1, 0.2, 1.8, Math.cos(menuCamera * 0.17)),
				world.getSizey() * TILESIZE * mix(-1, 1, 0.6, 1.4, Math.sin(menuCamera * 0.23)));
			return;
		}

		const delta2 = delta * human.getTimescale();
		let cameraDelta = delta2;

		let arena = false;

		if (human.isActive()) {
			arena = world.getArena(human.getPos()[0]);

			gunText -= delta * 0.3;

			if (air < 80 && (
				keyboard.has(32) || // space
				keyboard.has(82) || // R
				keyboard.has(13) || // enter
				keyboard.has(16) || // shift
				keyboard.has(17) || // control
				keyboard.has(96) || // num 0
				keyboard.has(45))) {// insert (num 0)
				recharge = RECHARGE;
				rechargeNag = 0;
			}

			if (recharge > 0) {
				human.playAirSound2();
				rechargeParticles += delta2 * 100;
				while (rechargeParticles > 0) {
					rechargeParticles--;
					createAirParticle();
				}
				const shake = Math.round(recharge * 18);
				recharge -= delta2;
				if (shake !== Math.round(recharge * 18)) this.shakeCamera(0);
			}
			else {
				human.stopAirSound2();
				if (air <= 0) rechargeNag += delta;
			}

			let mx, my;
			if (mouse[0]) {
				mx = mToGamex(mouse[0][0]);
				my = mToGamey(mouse[0][1]);
			}

			if (recharge <= 0) {
				if (keyboard.has(81) || keyboard.has(69) || keyboard.has("wheelup") || keyboard.has("wheeldown")) { // Q and E
					if (!gunSelectLock) {
						gunSelectLock = true;
						if (keyboard.has(81) || keyboard.has("wheeldown")) {
							gunSelection--;
							if (gunSelection < minGun) gunSelection = minGun;
							else playSound("select", SELECT_VOL);
						}
						else {
							gunSelection++;
							if (gunSelection > maxGun) gunSelection = maxGun;
							else playSound("select", SELECT_VOL);
						}
					}
					gun = STATS.gun[gunSelection];
					gunText = 1;
					human.setGun(gun);
				}
				else gunSelectLock = false;
				for (let i = 1; i < 10; i++) { // 1 - 9 but not 0
					if (keyboard.has(48 + (i % 10))) {
						const selection = maxGun - minGun >= 9 ? maxGun - 9 + i : i - 1 + minGun;
						if (selection <= maxGun) {
							if (gunText + delta * 0.31 < 1) playSound("select", SELECT_VOL);
							gunSelection = selection;
							gun = STATS.gun[gunSelection];
							gunText = 1;
							human.setGun(gun);
						}
					}
				}

				let up = false;
				if ((keyboard.has(87) || keyboard.has(38)) && air > 0) {
					up = true;
					air -= delta2 * JETPACK_DRAIN;
				}

				const shoot = mouse[0] && (mouse[1] || mouse[2]);
				let shoot_a = 0;
				let shoot_b = 0;
				let shoot_w = 0;
				let shoot_l = 0;
				if (shoot && human.canShoot(delta)) {
					let drain = 100 / gun.ammo;
					let drainMult = 1;
					if (mouse[1]) {
						if (drain > 0 && lava > 0) { shoot_l = lava > drain / SPECIAL_AMMO ? drainMult : lava / drain * SPECIAL_AMMO; lava -= drain / SPECIAL_AMMO; }
						drain *= (1 - shoot_l);
						drainMult *= (1 - shoot_l);
						if (drain > 0 && water > 0) { shoot_w = water > drain / SPECIAL_AMMO ? drainMult : water / drain * SPECIAL_AMMO; water -= drain / SPECIAL_AMMO; }
						drain *= (1 - shoot_w);
						drainMult *= (1 - shoot_w);
					}
					if (water > 0 || lava > 0 || mouse[1]) {
						if (drain > 0 && blood > 0) { shoot_b = blood > drain ? drainMult : blood / drain; blood -= drain; }
						drain *= (1 - shoot_b);
						drainMult *= (1 - shoot_b);
					}
					if (drain > 0 && air > 0) { shoot_a = air > drain ? drainMult : air / drain; air -= drain; }
				}

				if (mimicStats || (mx && my)) {
					mimicStats = [up,
						keyboard.has(68) || keyboard.has(39),
						keyboard.has(65) || keyboard.has(37),
						shoot,
						mx === undefined ? mimicStats[4] : mx - human.getPos()[0],
						my === undefined ? mimicStats[5] : my - human.getPos()[1]];
				}
				if (human.act(delta, bullets, this.shakeCamera, false, mx, my,
					up,
					keyboard.has(68) || keyboard.has(39),
					keyboard.has(65) || keyboard.has(37),
					shoot, shoot_a, shoot_b, shoot_w, shoot_l)) {
					this.shakeCamera(Math.sqrt(5 / gun.shootSpeed * gun.damage * (gun.penetration || 1) * (gun.bullets || 1)) - 1);
				}

				if (arena) {
					if (!arenaEntered) {
						arenaEntered = true;
						const song = randInt(3, 4);
						playSong(song);
						world.setArenaTime(songLength(song));
					}
				}
				else if (arenaEntered) {
					arenaEntered = false;
					particles.bloodCheckWalls();
				}
			}
			else {
				human.act(delta, bullets, this.shakeCamera, true);
				air = Math.min(100, Math.max(0, air) + delta2 * 100 / RECHARGE);
			}

			if (blood < 100) {
				let moreBlood = particles.drainBlood(delta, human.getPos(), human.getSize());
				if (moreBlood > 0) {
					playDrainSound();
					bloodGlow = Math.min(1, Math.max(0, bloodGlow) + moreBlood * BLOOD_CONVERSION * 0.075);
					blood = Math.min(100, blood + BLOOD_CONVERSION * moreBlood);
					moreBlood *= BLOOD_AIR_PARTICLES;
					while (moreBlood-- > 0) createAirParticle([2, 0.4, 0.4]);
				}
			}
			healFade -= delta2;
			if (human.getHealth() < STATS_PLAYER.health && blood > 0) {
				heal += delta2;
				while (heal >= 1) {
					healFade = 1.3;
					heal -= 1;
					human.modHealth(HEAL);
					blood -= HEAL * STATS_PLAYER.bloodToHeal;
				}
			}
			if (water < 100) {
				let moreWater = fluid.drainWater(delta, human.getPos(), human.getSize());
				if (moreWater > 0) {
					playDrainSound();
					waterGlow = Math.min(1, Math.max(0, waterGlow) + moreWater * FLUID_CONVERSION * 0.1);
					water = Math.min(100, water + FLUID_CONVERSION * moreWater);
					moreWater *= FLUID_AIR_PARTICLES;
					while (moreWater-- > 0) createAirParticle([0, 1, 1]);
				}
			}
			if (lava < 100) {
				let moreLava = fluid.drainLava(delta, human.getPos(), human.getSize());
				if (moreLava > 0) {
					playDrainSound();
					lavaGlow = Math.min(1, Math.max(0, lavaGlow) + moreLava * FLUID_CONVERSION * 0.1);
					lava = Math.min(100, lava + FLUID_CONVERSION * moreLava);
					moreLava *= FLUID_AIR_PARTICLES;
					while (moreLava-- > 0) createAirParticle([1.5, 0.75, 0]);
				}
			}
		}
		else if (human.spawning()) human.act(delta, bullets, this.shakeCamera);

		actObjects(bullets, delta, world);

		if (arena) {
			const cameraMult = Math.min(3, world.getArena()) / 3;
			camerax = camerax * (1 - cameraMult) + arena[0] * cameraMult;
			cameray = cameray * (1 - cameraMult) + arena[1] * cameraMult;
			cameraDelta = mix(0, 1, cameraDelta, 0.05, cameraMult);
		}
		if (recharge <= 0) {
			const camera = human.getCamera(cameraDelta, camerax + cameraShakex, cameray + cameraShakey);
			camerax = camera[0];
			cameray = camera[1];
		}
		else {
			const camera = human.getCamera(cameraDelta, camerax, cameray);
			camerax = camera[0] + cameraShakex;
			cameray = camera[1] + cameraShakey;
		}
		updateCamera(camerax, cameray);
		cameraShakex -= cameraShakex * Math.min(1, delta * 40);
		cameraShakey -= cameraShakey * Math.min(1, delta * 40);
	}

	this.draw = function() {
		human.draw();
		drawObjects(bullets);
	}

	this.drawBloom = function() {
		drawObjects(bullets);
		if (human.isActive() && (bloodGlow > 0 || waterGlow > 0 || lavaGlow > 0)) {
			const pos = human.getPos();
			glowBox.draw(toWorldX(pos[0]), toWorldY(pos[1]), human.getSize() * 1.5, human.getSize() * 2,
				[Math.max(0, bloodGlow) * 0.3 + Math.max(0, lavaGlow) * 0.5, Math.max(0, lavaGlow) * 0.25, Math.max(0, waterGlow) * 0.5, 1]);
		}
		human.drawBloom();
	}

	this.drawHud = function() {
		if (this.getHealth() > 0) {
			// Exit arrow
			if (!world.getArena()) {
				const exitPos = world.getExit();
				const p = human.getPos();
				if (p[0] > exitPos[0] * (LEVEL - 1) * 0.1) {
					const exitVec = [exitPos[0] - p[0], exitPos[1] - p[1]];
					const exitLen = length(exitVec[0], exitVec[1]);
					const len = Math.min(0.7, exitLen - 0.2);
					arrowBox.drawRot(toWorldX(p[0] + exitVec[0] / exitLen * len), toWorldY(p[1] + exitVec[1] / exitLen * len), ARROW_SIZE, ARROW_SIZE, Math.atan2(-exitVec[0], exitVec[1]), [0, 1, 1, 0.35]);
				}
			}
			// Red borders
			const health = human.getHealth();
			if (health < STATS_PLAYER.health * 0.6) {
				fadeBox.draw(-0.68, 0, 0.32, 1, [1, 0, 0, mix(STATS_PLAYER.health * 0.6, 0, 0, 1, health)]);
				fadeBox.draw(0.68, 0, -0.32, 1, [1, 0, 0, mix(STATS_PLAYER.health * 0.6, 0, 0, 1, health)]);
			}
			if (healthFlash > 0.01) {
				fadeBox.drawRot(0, -0.7, 0.3, 1, Math.PI * 0.5, [1, 0, 0, Math.min(1, healthFlash * 1.5) * 0.55 - 0.01]);
				fadeBox.drawRot(0, 0.7, 0.3, 1, -Math.PI * 0.5, [1, 0, 0, Math.min(1, healthFlash * 1.5) * 0.55 - 0.01]);
			}
			// Jars
			const JAR_SIZE = 0.85;
			const v = [
				["HEALTH", health, [1, 0, 0, 1]],
				["AIR", air, 0.7],
				["BLOOD", blood, [0.6, 0, 0, 1]],
				["WATER", water, [0, 0, 1, 1]],
				["LAVA", lava, [1, 0.5, 0, 1]],
			];
			let pos = 0;
			for (const i in v) {
				if (i < 2 || v[i][1] > 0) {
					const x = -1 + JAR_SIZE * (0.2 + pos * 0.25);
					pos++;
					// fade
					if (i < 2 && v[i][1] < 50) jarfadeBox.draw(x, 1 / ASPECT - JAR_SIZE * 0.2, JAR_SIZE * 0.22, JAR_SIZE * 0.22,
						[1, 0, 0, mix(50, 0, 0, 1, v[i][1])]);
					if ((Number(i) === 0 || Number(i) === 2) && healFade > 0) jarfadeBox.draw(x, 1 / ASPECT - JAR_SIZE * 0.2, JAR_SIZE * 0.22, JAR_SIZE * 0.22,
						[0, 0.4, 1, healFade]);
					// amount
					if (v[i][1] > 0) colorBox.draw(x, 1 / ASPECT - JAR_SIZE * (0.2 - 0.08 * (1 - v[i][1] / 100)),
						JAR_SIZE * 0.08, JAR_SIZE * 0.08 * v[i][1] / 100, v[i][2]);
					// jar
					jarBox.draw(      x, 1 / ASPECT - JAR_SIZE * 0.20, JAR_SIZE * 0.080, JAR_SIZE * 0.08);
					txt.draw(v[i][0], x, 1 / ASPECT - JAR_SIZE * 0.06, JAR_SIZE * 0.050, JAR_SIZE * 1.00);
				}
			}
			// Texts
			if (human.isActive()) {
				if (rechargeNag > 2) {
					txt.draw("RECHARGE!", 0, -0.15, 0.08, 1.15, 0.5);
					spaceBox.draw(-0.1, 0, BUTTONSIZE * 4, BUTTONSIZE, 0.3);
					buttonBox.draw(0.25, 0, BUTTONSIZE, BUTTONSIZE, 0.3);
					txt.draw("Space", -0.1, 0, BUTTONSIZE, 1, [0, 0, 0, 1]);
					txt.draw("R", 0.25, 0, BUTTONSIZE, 1, [0, 0, 0, 1]);
				}
				else if (recharge <= 0) {
					if      (air < 5)  txt.draw("RECHARGE!", -0.55, 0.50 / ASPECT, 0.07, 1.05);
					else if (air < 20) txt.draw("RECHARGE!", -0.60, 0.55 / ASPECT, 0.06, 1.05, 0.8);
				}
				if (gunText > 0) txt.draw(gun.name, 0, 0, 0.07, 1.15, gunText * 1.2);
				txt.draw(gun.name, 0.55, 0.9 / ASPECT, 0.045, mix(3, 15, 1.1, 0.8, gun.name.length));
				if (minGun !== maxGun) {
					buttonBox.draw(0.18, 0.9 / ASPECT, BUTTONSIZE, BUTTONSIZE, gunSelection === minGun ? 0.2 : 0.5);
					buttonBox.draw(0.92, 0.9 / ASPECT, BUTTONSIZE, BUTTONSIZE, gunSelection === maxGun ? 0.2 : 0.5);
					txt.draw("Q", 0.18, 0.9 / ASPECT, BUTTONSIZE, 1, [0, 0, 0, gunSelection === minGun ? 0.4 : 1]);
					txt.draw("E", 0.92, 0.9 / ASPECT, BUTTONSIZE, 1, [0, 0, 0, gunSelection === maxGun ? 0.4 : 1]);
				}
			}
		}
	}
}
