"use strict";

function Bullet(gl, shader, x, y, dx, dy, gun, air, blood, water, lava, enemyId1 = -1) {
	const COLOR = [air * 0.5 + blood + lava, air * 0.5 + water + lava * 0.5, air * 0.5 + water, 0.8];
	if (!gl) return [COLOR[0], COLOR[1], COLOR[2], 1];

	const box = new BoxTex(gl, shader, "bullet");
	box.setAdditive();

	const SIZE = gun.size;
	const SPEED = Math.max(0.75, air + blood + water * 0.75 + lava * 1.25);
	const DAMAGE = gun.damage * (air * 0.75 + blood + water * 1.2 + lava * 1.1);
	dx *= SPEED;
	dy *= SPEED;

	const flip = randInt(0, 1);
	let x0 = x;
	let x1 = x;
	let y0 = y;
	let y1 = y;
	let penetration = gun.penetration || 1;

	this.getColor = () => COLOR;

	// For blood
	this.getSpeed = () => [dx * DAMAGE, dy * DAMAGE];
	// For bullet length (size)
	this.getSpeedMult = () => SPEED * 4;

	this.getDamage = () => DAMAGE;
	this.getTotalDamage = () => DAMAGE * (gun.penetration || 1);

	this.remove = () => penetration = 0;

	this.getHit = function(x, y, len, enemyId2 = -1) {
		if (enemyId1 === enemyId2) return [0, 0, 0];
		if (penetration > 0 && distanceToFiniteLine(x, y, x0, y0, x1, y1) < (len + SIZE)) {
			penetration--;
			return [DAMAGE, gun.damage * water, gun.damage * lava];
		}
		return [0, 0, 0];
	}

	this.act = function(delta, world) {
		x0 = x1;
		y0 = y1;
		const x2 = x1 + dx * delta;
		const y2 = y1 + dy * delta;
		const ricochet = !gun.noRicochet && penetration > 0 && randInt(0, 1);
		const c = world.collision(x1, y1, x2, y2, ricochet);
		if (c || penetration <= 0) {
			if (c) {
				if (ricochet) {
					if (c[0] !== x2) {
						x1 = c[0];
						dx *= -0.9;
					} else x1 = x2;
					if (c[1] !== y2) {
						y1 = c[1];
						dy *= -0.9;
					} else y1 = y2;
				}
				else {
					x1 = c[0];
					y1 = c[1];
				}
				playSoundWorld("hit1", x1, y1, ricochet ? 0.8 : 0.5, ricochet ? 2.5 : 1.6);
			}
			for (let i = 0; i < 10; i++) {
				const s = rand(0.5, 1.5);
				const rot = randDir();
				particles.createParticle1(x1, y1, Math.cos(rot) * s, Math.sin(rot) * s, SIZE, this.getSpeedMult(), COLOR);
			}
			return !ricochet;
		}
		else {
			x1 = x2;
			y1 = y2;
		}
	}

	this.draw = function() {
		box.drawRot(toWorldX(x1), toWorldY(y1), SIZE * (flip * 2 - 1), SIZE * this.getSpeedMult(), Math.atan2(-dx, dy), COLOR);
	}
}
