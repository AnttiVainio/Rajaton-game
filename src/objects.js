"use strict";

function RandomTimer(mult) {
	let time = 0;
	let next = Math.random() * mult;
	this.r1 = Math.random();
	this.r2 = Math.random();
	this.r3 = Math.random();
	this.r4 = Math.random();

	this.count = 0;
	this.activated = false;

	this.act = function(delta) {
		this.count = 0;
		time += delta;
		while (time > next) {
			next += Math.random() * mult;
			this.count++;
			this.r1 = Math.random();
			this.r2 = Math.random();
			this.r3 = Math.random();
			this.r4 = Math.random();
		}
		this.activated = this.count !== 0;
		return [this.activated, this.count];
	}
}

function Particle1(x, y, sx, sy, size, size2, color) {
	const SIZE = 0.3;

	const flip = randInt(0, 1) * 2 - 1;
	const rot = Math.atan2(-sx, sy);
	let alpha = 1.7;
	const alphad = rand(4, 12);

	this.act = function(delta) {
		x += sx * delta;
		y += sy * delta;
		alpha -= delta * alphad;
		return alpha <= 0;
	}

	this.draw = function(box) {
		box.drawRot(toWorldX(x), toWorldY(y), size * SIZE * flip, size * SIZE * size2, rot, [color[0], color[1], color[2], alpha]);
	}
}

function Blood(x, y, sx, sy, collectible) {
	const SIZE = collectible ? 0.033 : 0.022;
	const DARK = 0.8;
	const DRAINDIST = 0.3;

	const sizex = (randInt(0, 1) * 2 - 1) * SIZE * rand(0.4, 1.6);
	const sizey = (randInt(0, 1) * 2 - 1) * SIZE * rand(0.4, 1.6);
	let stop = false;
	let fall = 0;
	let dormant = 0;

	this.checkWalls = function(world) {
		if (world.collision(x, y, x + 0.01, y)) return;
		if (world.collision(x, y, x - 0.01, y)) return;
		if (world.collision(x, y, x, y + 0.01)) return;
		if (world.collision(x, y, x, y - 0.01)) return;
		sx = rand(-0.2, 0.2);
		stop = false;
	}

	this.act = function(delta, world) {
		dormant += delta * 0.5;
		if (fall > 0) {
			fall -= delta;
			if (fall <= 0) {
				fall = 0;
				stop = !randInt(0, 2);
			}
		}
		if (!stop) {
			sy += delta * 2;
			const x2 = x + sx * delta;
			const y2 = y + sy * delta;
			const c = world.collision(x, y, x2, y2, false);
			if (c) {
				x = c[0];
				y = c[1];
				sx = 0;
				sy = 0;
				stop = true;
				// randomly kill when hit ground
				if (!collectible && world.collision(x, y, x, y + TILESIZE)) return randInt(0, 4);
				// fall from ceiling and walls
				if (world.collision(x, y, x, y - TILESIZE)) fall = rand(1, 15);
				else if (world.collision(x, y, x - TILESIZE, y)) {
					fall = rand(1, 15);
					sx = 0.1;
				}
				else if (world.collision(x, y, x + TILESIZE, y)) {
					fall = rand(1, 15);
					sx = -0.1;
				}
			}
			else {
				x = x2;
				y = y2;
			}
		}
	}

	this.draw = function(box, bloom) {
		const color = collectible ? clamp(mix(bloom ? 0.75: 0, 1, DARK * 0.5, 1, dormant), 0, 1) : DARK;
		box.draw(toWorldX(x), toWorldY(y), sizex * (stop ? 1 : 1.6), sizey * (stop ? 1 : 1.6), [color, color, color, 1]);
	}

	this.drain = function(delta, pos, size) {
		if (collectible && dormant > 1) {
			const l = length(x, y, pos[0], pos[1]);
			if (l < DRAINDIST && l > 0) {
				stop = false;
				fall = 0;
				sx += (pos[0] - x) / l * (DRAINDIST - l) * delta * 70;
				sy += (pos[1] - y) / l * (DRAINDIST - l) * delta * 70;
			}
			return l < Math.sqrt(sx * sx * delta * delta + sy * sy * delta * delta) + size;
		}
	}
}

// type 0 = gun
function Gib(x, y, sx, sy, type, color, sprite) {
	const SIZE = type ? 0.04 : 0.055;

	const flipX = randInt(0, 1) * 2 - 1;
	const flipY = randInt(0, 1) * 2 - 1;
	const rot = randInt(0, 1) * Math.PI * 0.5;

	let blood = 0;

	this.act = function(delta, world) {
		if (type) {
			blood += delta * 10;
			while (blood > 1) {
				blood--;
				particles.createBlood(x, y, sx, sy, !randInt(0,3));
			}
		}

		sy += delta * 2;
		const x2 = x + sx * delta;
		const y2 = y + sy * delta;
		const ricochet = randInt(0, 2);
		const c = world.collision(x, y, x2, y2, ricochet);
		if (c) {
			playSoundWorld("blood2", c[0], c[1], ricochet ? 0.3 : 0.6, 2);
			if (ricochet) {
				if (c[0] !== x2) {
					x = c[0];
					sx *= -0.6;
				} else x = x2;
				if (c[1] !== y2) {
					y = c[1];
					sy *= -0.6;
				} else y = y2;
			}
			else {
				x = c[0];
				y = c[1];
				if (type) {
					for (let i = 0; i < BLOOD_AMOUNT * 2; i++) particles.createBlood(x, y, -sx * 10, -sy * 10, !randInt(0,3));
				}
				return true;
			}
		}
		else {
			x = x2;
			y = y2;
		}
	}

	this.draw = function(box) {
		(type ? box[type] : box[0][sprite]).drawRot(toWorldX(x), toWorldY(y), SIZE * flipX, SIZE * flipY, rot, type ? color : 1);
	}
}

function Air(x, y, sx, sy, color) {
	const SIZE = 0.017;

	const flipX = randInt(0, 1) * 2 - 1;
	const flipY = randInt(0, 1) * 2 - 1;
	const rot = Math.atan2(-sx, sy);
	let alpha = rand(0.3, 1.5);

	this.act = function(delta) {
		alpha -= delta * 2.5;
		x += sx * delta;
		y += sy * delta;
		return alpha <= 0;
	}

	this.draw = function(box) {
		box.drawRot(toWorldX(x), toWorldY(y), SIZE * flipX, 2 * SIZE * flipY, rot, color ? [...color, alpha] : alpha);
	}
}

function Particle2(x, y) {
	const SIZE = 0.03;

	let sx = rand(-1, 1) * 2;
	let sy = rand(-1, 1) * 2;
	let alpha = rand(0.5, 2);

	this.act = function(delta, world) {
		alpha -= delta;
		const x2 = x + sx * delta * alpha;
		const y2 = y + sy * delta * alpha;
		const c = world.collision(x, y, x2, y2);
		if (c) {
			if (c[0] !== x2) {
				x = c[0];
				sx *= -0.5;
			} else x = x2;
			if (c[1] !== y2) {
				y = c[1];
				sy *= -0.5;
			} else y = y2;
		}
		else {
			x = x2;
			y = y2;
		}
		return alpha <= 0;
	}

	this.draw = function(box) {
		box.draw(toWorldX(x), toWorldY(y), SIZE, SIZE, [0, 1, 0, alpha]);
	}
}

function Particles(gl, shader, alphaShader, world) {
	const particle1 = [];
	const particle1Box = new BoxTex(gl, shader, "bullet");
	particle1Box.setAdditive(true);
	const blood1 = [];
	const blood2 = [];
	const bloodBox = new BoxTex(gl, alphaShader, "blood");
	const gib = [];
	const gibBox = [
		{},
		new BoxTex(gl, alphaShader, "gib1"),
		new BoxTex(gl, alphaShader, "gib2"),
		new BoxTex(gl, alphaShader, "gib3"),
	];
	const air = [];
	const airBox = new BoxTex(gl, alphaShader, "air");
	const particle2 = [];
	const particle2Box = new BoxTex(gl, shader, "particle");
	particle2Box.setAdditive(true);

	this.createParticle1 = function(x, y, sx, sy, size, size2, color) {
		particle1.push(new Particle1(x, y, sx, sy, size, size2, color));
	}

	this.createBlood = function(x, y, sx, sy, collectible) {
		const speed = rand(0.1, 0.6);
		const v = rotateVector([sx * speed, sy * speed], rand(-1, 1) * 1.2);
		(collectible ? blood2 : blood1).push(new Blood(x, y, v[0], v[1], collectible));
	}

	this.bloodCheckWalls = function() {
		for (const i in blood1) blood1[i].checkWalls(world);
		for (const i in blood2) blood2[i].checkWalls(world);
	}

	this.createGibs = function(x, y, speed, color, sprite) {
		if (!gibBox[0][sprite]) gibBox[0][sprite] = new BoxTex(gl, alphaShader, sprite);
		speed = Math.sqrt(speed);
		const light = 0.65;
		const color2 = [color[0] * light, color[1] * light, color[2] * light, color[3]];
		for (let i = 0; i < 5; i++) {
			const rot = randDir();
			gib.push(new Gib(x, y, Math.cos(rot) * speed * rand(0.7, 1.3), Math.sin(rot) * speed * rand(0.7, 1.3), Math.min(3, i), color2, sprite));
		}
	}

	this.createAir = function(x, y, sx, sy, color) {
		air.push(new Air(x, y, sx, sy, color));
	}

	this.createParticle2 = function(x, y) {
		particle2.push(new Particle2(x, y));
	}

	this.drainBlood = function(delta, pos, size) {
		let count = 0;
		for (let i = 0; i < blood2.length; i++) {
			if (blood2[i].drain(delta, pos, size)) {
				blood2.splice(i, 1);
				i--;
				count++;
			}
		}
		return count;
	}

	this.act = function(delta) {
		// Optimization: speed up acting when there are a lot of objects to speed up removal of expired objects
		const amount = particle1.length + gib.length + air.length + particle2.length;
		const deltaMult = Math.max(1, mix(100, 300, 1, 2, amount)) * delta;

		actObjects(particle1, deltaMult);
		actObjects(blood1, deltaMult, world);
		actObjects(blood2, deltaMult, world);
		actObjects(gib, deltaMult, world);
		actObjects(air, deltaMult);
		actObjects(particle2, deltaMult, world);

		if (blood1.length > MAX_BLOOD1) blood1.splice(0, blood1.length - MAX_BLOOD1);
		if (blood2.length > MAX_BLOOD2) blood2.splice(0, blood2.length - MAX_BLOOD2);
	}

	this.draw = function() {
		drawObjects(gib, gibBox);
		drawObjects(particle1, particle1Box);
		drawObjects(blood1, bloodBox, false);
		drawObjects(blood2, bloodBox, false);
		drawObjects(air, airBox);
	}

	this.drawBloom = function() {
		drawObjects(gib, gibBox);
		drawObjects(particle2, particle2Box);
		drawObjects(particle1, particle1Box);
		drawObjects(blood2, bloodBox, true);
		drawObjects(air, airBox);
	}
}

let particles;
