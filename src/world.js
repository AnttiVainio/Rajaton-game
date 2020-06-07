"use strict";

function _world_js_best_collision(c, best, l) {
	if (best[1] === undefined || l < best[1]) return [c, l];
	return best;
}

function Tile(x, y) {
	this.solid = true;
	this.shaft = false;
	this.lamp = false;
	this.branch = false;
	this.arena = false;
	this.door = false;

	this.tile = randInt(0, 1);
	this.flipX = randInt(0, 1) * 2 - 1;
	this.flipY = randInt(0, 1) * 2 - 1;
	this.rot = randInt(0, 3) * Math.PI * 0.5;
	this.color = [rand(0.9, 1), rand(0.9, 1), rand(0.9, 1)];
	this.lighting = 0;

	const r = (x * 2 - 1) * TILESIZE;
	const l = (x * 2 + 1) * TILESIZE;
	const t = (y * 2 - 1) * TILESIZE;
	const b = (y * 2 + 1) * TILESIZE;

	this.collision = function(x1, y1, x2, y2, slide) {
		let best = [];
		if (this.solid) {
			if (x1 <= r && x2 >= r) {
				const y0 = mix(x1, x2, y1, y2, r);
				if (y0 >= t && y0 <= b) best = [[r - 0.0001, slide ? y2 : y0], lengthSquared(x1, y1, r, y0)];
			}
			if (x1 >= l && x2 <= l) {
				const y0 = mix(x1, x2, y1, y2, l);
				if (y0 >= t && y0 <= b) best = _world_js_best_collision([l + 0.0001, slide ? y2 : y0], best, lengthSquared(x1, y1, l, y0));
			}
			if (y1 <= t && y2 >= t) {
				const x0 = mix(y1, y2, x1, x2, t);
				if (x0 >= r && x0 <= l) best = _world_js_best_collision([slide ? x2 : x0, t - 0.0001], best, lengthSquared(x1, y1, x0, t));
			}
			if (y1 >= b && y2 <= b) {
				const x0 = mix(y1, y2, x1, x2, b);
				if (x0 >= r && x0 <= l) best = _world_js_best_collision([slide ? x2 : x0, b + 0.0001], best, lengthSquared(x1, y1, x0, b));
			}
		}
		return best;
	}
}

function Lamp(x, y, box, glow) {
	const SIZE = 0.12;
	const SIZE2 = 0.2;

	const drawx = x * TILESIZE * 2;
	const drawy = y * TILESIZE * 2 + TILESIZE - SIZE * 1.65;
	const drawy2 = y * TILESIZE * 2 + TILESIZE - SIZE;

	this.lightX = () => drawx;
	this.lightY = () => drawy;

	this.draw = function(size, bloom) {
		box.draw(
			toWorldX(drawx), toWorldY(drawy2),
			SIZE * 0.5, SIZE, bloom ? 0.3 : 0.6);
		if (bloom) glow.draw(
			toWorldX(drawx), toWorldY(drawy),
			SIZE2 * size, SIZE2 * size, 0.15);
	}
}

function World(gl, shader, alphaShader, colorShader, textShader, LEVEL, fluid) {
	const TILES = 9;

	let _tile = 1;
	const maxtile = Math.floor(LEVEL < 16 ? LEVEL / 4 : (LEVEL + 3) / 5) + 1;
	if (maxtile > 1) {
		if (maxtile > TILES && !randInt(0, 100)) _tile = TILES + 1;
		else if (maxtile > TILES + 1 && !randInt(0, 200)) _tile = TILES + 2;
		else _tile = randInt(1, Math.min(TILES, maxtile));
	}
	if (LEVEL === 4) _tile = 2;

	const fadeBox = new BoxTex(gl, alphaShader, "fade");
	const lampBox = new BoxTex(gl, alphaShader, "lamp");
	const glowBox = new BoxTex(gl, shader, "particle");
	glowBox.setAdditive();
	const metal1Box = new BoxTex(gl, shader, "metal1");
	const metal2Box = new BoxTex(gl, shader, "metal2");
	const doorBox = new BoxTex(gl, shader, "door");
	const tile1Box = new BoxTex(gl, _tile === TILES + 1 ? alphaShader : shader, `tile${_tile}_1`);
	const tile2Box = new BoxTex(gl, _tile === TILES + 1 ? alphaShader : shader, `tile${_tile}_2`);
	const colorBox = new Box(gl, colorShader);
	const buttonBox = new BoxTex(gl, shader, "button");
	const mouse1Box = new BoxTex(gl, alphaShader, "mouse1");
	const txt = new Text(gl, textShader);

	let ARENA_TIME = 30;
	const FADE_COLOR = 0.7;
	const SIZEX = Math.min(LEVEL <= 2 ? 60 : 65 + (LEVEL < 25 ? LEVEL * 2 : 50 + (LEVEL - 25)), 180);
	const SIZEY = Math.min(LEVEL <= 2 ? 15 : 20 + (LEVEL < 25 ? LEVEL : 25 + Math.floor((LEVEL - 25) / 3)), 60);

	this.setArenaTime = t => ARENA_TIME = t;

	// Unlock lava in level 6
	function fluidType() {
		if (LEVEL < 6) return FLUID_WATER;
		return Math.random() > Math.max(0.55, 0.35 + Math.pow(0.7, Math.sqrt(LEVEL - 2))) ? FLUID_LAVA : FLUID_WATER;
	}

	this.getSizex = () => SIZEX;
	this.getSizey = () => SIZEY;
	fluid.setWorld(this);

	let lightSize = 0;
	const lamps = [];
	const world = [];
	for (let y = 0; y < SIZEY; y++) {
		for (let x = 0; x < SIZEX; x++) world.push(new Tile(x, y));
	}
	const getWorld = (x, y) => world[y * SIZEX + x] || world[0];
	const worldMult = 1 / TILESIZE / 2;
	const getWorldX = x => Math.round(x * worldMult);
	const getWorldY = y => Math.round(y * worldMult);
	let starty, shaftx, shafty;
	let arenax = SIZEX * TILESIZE * 10, arenay; // world positions
	let arenaX1 = 0, arenaX2 = 0; // grid positions
	let arenaTiles = [];

		/* Generate random world */

	// Only one shaft in level 1, quaranteed liquid, no arena, no other fluid, extra lamp at spawn
	{
		let arenaPos = Math.round(rand(0.4, 0.6) * SIZEX);
		const MAXX = SIZEX - 1;
		let X1 = 1;
		let H = randInt(2, 3);
		let Y = LEVEL === 1 ? SIZEY - 1 - H : randInt(1, SIZEY - 1 - H);
		starty = Y + H - 1;
		let vertical = false;

		// Brancing dead end
		const branch = (v1, v2, v3, dx, dy) => {
			if (randInt(0, 2)) {
				const W = randInt(2, 3);
				if (v2 - W - v1 > 1) {
					const L = randInt(W + 1, W * 2 + 2);
					const V = randInt(v1, v2 - W);
					if (dy) {
						for (let x = V; x < V + W; x++) {
							for (let y = v3; y !== clamp(v3 + dy * L, 1, SIZEY - 1); y += dy) {
								getWorld(x, y).solid = false;
								getWorld(x, y).branch = true;
							}
						}
					}
					else {
						for (let x = v3; x !== clamp(v3 + dx * L, 1, SIZEX - 1); x += dx) {
							for (let y = V; y < V + W; y++) {
								getWorld(x, y).solid = false;
								getWorld(x, y).branch = true;
							}
						}
					}
				}
			}
		}

		while (X1 < MAXX) {
			if (vertical) {
				const arena = X1 >= arenaPos;
				if (arena) arenaPos = SIZEX;
				const shaft = LEVEL !== 1 && !arena && !randInt(0, 3);
				const W = LEVEL !== 1 && arena ? randInt(9, 10) : Math.min(X1 - 1, randInt(2, shaft ? randInt(3,4) : randInt(4,5)));
				const H2 = randInt(1, randInt(4,5));

				// create arena
				if (LEVEL !== 1 && arena) {
					const arenaHeight = randInt(6, 7);
					Y = clamp(randInt(Y + H - arenaHeight, Y), 1, SIZEY - 1 - arenaHeight);

					arenax = (X1 + (W - 1) * 0.5) * TILESIZE * 2;
					arenay = (Y + (arenaHeight - 1) * 0.5) * TILESIZE * 2 + TILESIZE;
					arenaX1 = X1 - 1;
					arenaX2 = X1 + W;
					for (let x = X1 - 1; x <= X1 + W; x++) {
						for (let y = Y - 1; y <= Y + arenaHeight; y++) {
							if (x !== X1 - 1 && x !== X1 + W && y !== Y - 1 && y !== Y + arenaHeight)
								getWorld(x, y).solid = false;
							getWorld(x, y).arena = true;
							getWorld(x, y).lighting = 0.1;
						}
					}
					getWorld(X1,         Y + arenaHeight - 1).lamp = true;
					getWorld(X1 + W - 1, Y + arenaHeight - 1).lamp = true;
					lamps.push(new Lamp(X1,         Y + arenaHeight - 1, lampBox, glowBox));
					lamps.push(new Lamp(X1 + W - 1, Y + arenaHeight - 1, lampBox, glowBox));
					// arena solids
					if (randInt(0, 1)) {
						const x = randInt(X1 + 2, X1 + W - 3);
						const y = randInt(Y + 2, Y + arenaHeight - 3);
						getWorld(x, y).solid = true;
						if (randInt(0, 1)) getWorld(x + randInt(0, 1) * 2 - 1, y).solid = true;
						else getWorld(x, y + randInt(0, 1) * 2 - 1).solid = true;
					}
					else {
						for (let i = 0; i < 2; i++) {
							let x = 0;
							let y = 0;
							while (getWorld(x, y).solid) {
								x = randInt(X1 + 1, X1 + W - 2);
								y = randInt(Y + 1, Y + arenaHeight - 2);
							}
							getWorld(x, y).solid = true;
						}
					}
					// arena clock
					if (!getWorld(X1 + W - 3, Y + 1).solid && !getWorld(X1 + W - 2, Y + 1).solid) {
						getWorld(X1 + W - 3, Y + 1).clock1 = true;
						getWorld(X1 + W - 2, Y + 1).clock2 = true;
					}
					else {
						let clock = X1 + 1;
						while (getWorld(clock, Y + 1).solid || getWorld(clock + 1, Y + 1).solid) clock++;
						getWorld(clock    , Y + 1).clock1 = true;
						getWorld(clock + 1, Y + 1).clock2 = true;
					}

					Y = clamp(randInt(Y, Y - H2 + arenaHeight), 1, SIZEY - 1 - arenaHeight);
					X1 += W;
				}
				// create shaft
				else if ((LEVEL === 1 && arena) || shaft) {
					shaftx = X1 - W;
					shafty = Y + H;
					Y = randInt(1, SIZEY - 1 - H2);

					for (let x = X1 - W; x < X1; x++) {
						for (let y = 1; y < SIZEY - 1; y++) {
							getWorld(x, y).solid = false;
							getWorld(x, y).shaft = true;
							getWorld(x, y).lighting = 0.1;
						}
					}
					if (LEVEL === 1 || !randInt(0, 3)) fluid.addEmitter(randInt(X1 - W, X1 - 1), 1, fluidType());

					if (LEVEL !== 1) {
						if (X1 - W > 1) branch(1, SIZEY - 1, X1 - W - 1, -1, 0);
						if (X1 < SIZEX - 1) branch(1, SIZEY - 1, X1, 1, 0);
					}
				}
				// normal path
				else {
					const Y0 = Y;
					let dir;

					if (Y <= 3) dir = true;
					else if (Y >= SIZEY - 3 - H) dir = false;
					else dir = randInt(0, 1);

					if (dir) Y = Math.min(SIZEY - 1 - H2, Y + randInt(W + 1, W * 2 + 3));
					else Y = Math.max(1, Y - randInt(W + 1, W * 2 + 3));

					for (let x = X1 - W; x < X1; x++) {
						for (let y = dir ? Y0 : Y; y < (dir ? Y + H2 : Y0 + H); y++) {
							getWorld(x, y).solid = false;
						}
					}

					if (X1 - W > 1) branch(Y0, Y, X1 - W - 1, -1, 0);
					if (X1 < SIZEX - 1) branch(Y0, Y, X1, 1, 0);
				}

				H = H2;
			}
			// horizontal path
			else {
				// The first horizontal goes to at least 14
				const X2 = Math.max(14, Math.min(MAXX, X1 + randInt(H + 3, H * 2 + 8) + (X1 === 1 ? 4 : 0)));

				for (let x = X1; x < X2; x++) {
					for (let y = Y; y < Y + H; y++) {
						getWorld(x, y).solid = false;
					}
				}

				if (X1 !== 1) {
					if (Y > 1) branch(X1, X2, Y - 1, 0, -1);
					if (Y + H < SIZEY - 1) branch(X1, X2, Y + H, 0, 1);
				}

				X1 = X2;
			}
			vertical = !vertical;
		}

		// Find arena doors
		for (let y = 1; y < SIZEY - 1; y++) {
			let tile = getWorld(arenaX1, y);
			if (!tile.solid) {
				arenaTiles.push(tile);
				tile.door = true;
			}
			tile = getWorld(arenaX2, y);
			if (!tile.solid) {
				arenaTiles.push(tile);
				tile.door = true;
			}
		}

		// Create lamps
		if (LEVEL === 1) {
			lamps.push(new Lamp(1, starty, lampBox, glowBox));
			getWorld(1, starty).lamp = true;
		}
		for (let i = 0; i < Math.round(SIZEX * 0.066); i++) {
			while (true) {
				const x = randInt(1, SIZEX - 2);
				let y = randInt(1, SIZEY - 2);
				while (!getWorld(x, y + 1).solid) y++;

				if (!getWorld(x, y).lamp && !getWorld(x, y).shaft && !getWorld(x, y).arena && !getWorld(x, y).door && !getWorld(x, y).solid && !getWorld(x, y - 1).solid) {
					lamps.push(new Lamp(x, y, lampBox, glowBox));
					getWorld(x, y).lamp = true;
					break;
				}
			}
		}

		// Create fluid emitters
		if (LEVEL !== 1) {
			for (let i = 0; i < Math.round(SIZEX * 0.025); i++) {
				while (true) {
					const x = randInt(1, SIZEX - 2);
					let y = randInt(1, SIZEY - 2);
					while (!getWorld(x, y - 1).solid) y--;

					if (!getWorld(x, y).shaft && !getWorld(x, y).door && !getWorld(x, y).solid && (getWorld(x, y).arena || getWorld(x, y).branch)) {
						fluid.addEmitter(x, y, fluidType(), getWorld(x, y).arena);
						break;
					}
				}
			}
		}

		// Calc fade
		for (let y = 0; y < SIZEY; y++) {
			for (let x = 0; x < SIZEX; x++) {
				const tile = getWorld(x, y);
				if (tile.solid) {
					if (x !== 0 && !getWorld(x - 1, y).solid) tile.fadel = true;
					if (x !== SIZEX - 1 && !getWorld(x + 1, y).solid) tile.fader = true;
					if (y !== 0 && !getWorld(x, y - 1).solid) tile.fadet = true;
					if (y !== SIZEY - 1 && !getWorld(x, y + 1).solid) tile.fadeb = true;
				}
			}
		}
	}

	let arenaTime = -1;

	this.getArena = function(playerx) {
		if (arenaTime < ARENA_TIME) {
			if (!playerx) return arenaTime >= 0 ? arenaTime : false;
			if (arenaTime < 0 && playerx > arenax) {
				arenaTime = 0;
				for (const i in arenaTiles) arenaTiles[i].solid = true;
			}
			if (arenaTime >= 0) return [arenax, arenay];
		}
	}

	let drawExit = true;
	let exity = SIZEY - 2;
	while (getWorld(SIZEX - 2, exity).solid) exity--;

	this.hideExit = () => drawExit = false;
	this.getExit = () => [(SIZEX - 2) * TILESIZE * 2, exity * TILESIZE * 2];
	this.getStart = () => [TILESIZE * 4, starty * TILESIZE * 2];

	this.act = function(delta) {
		lightSize += delta * 1.5;
		if (arenaTime >= 0) arenaTime += delta;
		if (arenaTime > ARENA_TIME && arenaTiles) {
			for (const i in arenaTiles) arenaTiles[i].solid = false;
			arenaTiles = null;
		}
	}

	const drawMult = 0.5 / TILESIZE;

	this.draw = function() {
		const y2 = Math.min(SIZEY, Math.ceil((cameray + 1.15 * INVERSE_ASPECT) * drawMult));
		const x2 = Math.min(SIZEX, Math.ceil((camerax + 1.15) * drawMult));
		for (let y = Math.max(0, Math.floor((cameray - 0.9 * INVERSE_ASPECT) * drawMult)); y < y2; y++) {
			for (let x = Math.max(0, Math.floor((camerax - 0.9) * drawMult)); x < x2; x++) {
				const tile = getWorld(x, y);
				const color = (tile.solid ? 0.9 : 0.3) + tile.lighting * 2;
				const X = toWorldX(x * TILESIZE * 2);
				const Y = toWorldY(y * TILESIZE * 2);
				// door
				if (tile.door && tile.solid) doorBox.draw(X, Y,
					TILESIZE * tile.flipX, TILESIZE * tile.flipY,
					[tile.color[0] * color, tile.color[1] * color, tile.color[2] * color, 0.8]);
				// not door or clock
				else if (!tile.clock1 && !tile.clock2) {
					let sprite = tile.tile ? tile1Box : tile2Box;
					if (tile.arena) sprite = tile.tile ? metal1Box : metal2Box;
					sprite.drawRot(X, Y,
						TILESIZE * tile.flipX, TILESIZE, tile.rot,
						[tile.color[0] * color, tile.color[1] * color, tile.color[2] * color, 0.8]);
				}
				// fade
				const size = TILESIZE * 15 / 16;
				if (tile.fadet || tile.clock1 || tile.clock2) fadeBox.draw(X, Y, size, TILESIZE, FADE_COLOR);
				if (tile.fadeb || tile.clock1 || tile.clock2) fadeBox.draw(X, Y, size, -TILESIZE, FADE_COLOR);
				if (tile.fader || tile.clock1 || tile.clock2) fadeBox.drawRot(X, Y, size, TILESIZE, Math.PI * 0.5, FADE_COLOR);
				if (tile.fadel || tile.clock1 || tile.clock2) fadeBox.drawRot(X, Y, size, TILESIZE, Math.PI * -0.5, FADE_COLOR);
				// clock text
				if (arenaTime >= 0 && arenaTime < ARENA_TIME) {
					if(tile.clock1)     txt.draw(String(Math.floor((ARENA_TIME - arenaTime) / 10)),X, Y + TILESIZE * 0.05, TILESIZE * 0.9, 1.25, [1, 1, 0, 0.4]);
					else if(tile.clock2)txt.draw(String(Math.floor(ARENA_TIME - arenaTime) % 10),  X, Y + TILESIZE * 0.05, TILESIZE * 0.9, 1.25, [1, 1, 0, 0.4]);
				}
			}
		}

		// Lamps and exit
		drawObjects(lamps, null, false);
		const pos = this.getExit();
		if (drawExit) glowBox.draw(toWorldX(pos[0]), toWorldY(pos[1]), PORTALSIZE, PORTALSIZE * 1.3, [0, 1, 0, 1]);

		// Tutorial
		if (LEVEL === 1) {
			buttonBox.draw(toWorldX(TILESIZE * 8)                 , toWorldY(starty * TILESIZE * 2), BUTTONSIZE, BUTTONSIZE, 0.5);
			buttonBox.draw(toWorldX(TILESIZE * 8) + BUTTONSIZE * 2, toWorldY(starty * TILESIZE * 2), BUTTONSIZE, BUTTONSIZE, 0.2);
			buttonBox.draw(toWorldX(TILESIZE * 8) + BUTTONSIZE * 4, toWorldY(starty * TILESIZE * 2), BUTTONSIZE, BUTTONSIZE, 0.5);
			buttonBox.draw(toWorldX(TILESIZE * 8) + BUTTONSIZE * 2, toWorldY(starty * TILESIZE * 2) - BUTTONSIZE * 2, BUTTONSIZE, BUTTONSIZE, 0.5);
			txt.draw("A",  toWorldX(TILESIZE * 8)                 , toWorldY(starty * TILESIZE * 2), BUTTONSIZE, 1, [0, 0, 0, 1]);
			txt.draw("S",  toWorldX(TILESIZE * 8) + BUTTONSIZE * 2, toWorldY(starty * TILESIZE * 2), BUTTONSIZE, 1, [0, 0, 0, 0.4]);
			txt.draw("D",  toWorldX(TILESIZE * 8) + BUTTONSIZE * 4, toWorldY(starty * TILESIZE * 2), BUTTONSIZE, 1, [0, 0, 0, 1]);
			txt.draw("W",  toWorldX(TILESIZE * 8) + BUTTONSIZE * 2, toWorldY(starty * TILESIZE * 2) - BUTTONSIZE * 2, BUTTONSIZE, 1, [0, 0, 0, 1]);

			mouse1Box.draw(toWorldX(TILESIZE * 8) + BUTTONSIZE * 11, toWorldY((starty - 0.25) * TILESIZE * 2), BUTTONSIZE, BUTTONSIZE * 2, 0.7);
			txt.draw("SHOOT", toWorldX(TILESIZE * 8) + BUTTONSIZE * 18, toWorldY((starty - 0.25) * TILESIZE * 2), BUTTONSIZE * 1.5, 1, [1, 1, 1, 0.7]);

			txt.draw("collect liquids for ammo", toWorldX((shaftx - 4) * TILESIZE * 2), toWorldY((shafty - 2) * TILESIZE * 2), BUTTONSIZE, 1, [1, 1, 1, 0.7]);
			txt.draw("collect blood also for health", toWorldX((shaftx - 4) * TILESIZE * 2), toWorldY((shafty - 1) * TILESIZE * 2), BUTTONSIZE, 1, [1, 1, 1, 0.7]);
		}
		else if (LEVEL === 2) {
			mouse1Box.draw(toWorldX(TILESIZE * 8) + BUTTONSIZE * 10, toWorldY((starty - 0.9) * TILESIZE * 2), -BUTTONSIZE, BUTTONSIZE * 2, 0.7);
			txt.draw("shoot only air or blood", toWorldX(TILESIZE * 8) + BUTTONSIZE * 10, toWorldY(starty * TILESIZE * 2), BUTTONSIZE, 0.9, [1, 1, 1, 0.7]);
		}
		else if (LEVEL === 3) {
			buttonBox.draw(toWorldX(TILESIZE * 8)                 , toWorldY(starty * TILESIZE * 2), BUTTONSIZE, BUTTONSIZE, 0.5);
			buttonBox.draw(toWorldX(TILESIZE * 8) + BUTTONSIZE * 3, toWorldY(starty * TILESIZE * 2), BUTTONSIZE, BUTTONSIZE, 0.5);
			buttonBox.draw(toWorldX(TILESIZE * 8) + BUTTONSIZE * 6, toWorldY(starty * TILESIZE * 2), BUTTONSIZE, BUTTONSIZE, 0.5);
			txt.draw("1",  toWorldX(TILESIZE * 8)                 , toWorldY(starty * TILESIZE * 2), BUTTONSIZE, 1, [0, 0, 0, 1]);
			txt.draw("2",  toWorldX(TILESIZE * 8) + BUTTONSIZE * 3, toWorldY(starty * TILESIZE * 2), BUTTONSIZE, 1, [0, 0, 0, 1]);
			txt.draw("3",  toWorldX(TILESIZE * 8) + BUTTONSIZE * 6, toWorldY(starty * TILESIZE * 2), BUTTONSIZE, 1, [0, 0, 0, 1]);
			txt.draw("...",toWorldX(TILESIZE * 8) + BUTTONSIZE * 9, toWorldY(starty * TILESIZE * 2), BUTTONSIZE, 1, [1, 1, 1, 0.7]);
			txt.draw("select weapon", toWorldX(TILESIZE * 8) + BUTTONSIZE * 4.5, toWorldY((starty - 1) * TILESIZE * 2), BUTTONSIZE * 1.2, 1, [1, 1, 1, 0.7]);
		}
		else if (LEVEL === EXTRA_SETTING_UNLOCK) {
			txt.draw("special setting unlocked", toWorldX(TILESIZE * 8) + BUTTONSIZE * 10, toWorldY((starty - 1) * TILESIZE * 2), BUTTONSIZE, 0.9, [1, 1, 1, 0.7]);
			txt.draw("in the settings menu", toWorldX(TILESIZE * 8) + BUTTONSIZE * 10, toWorldY(starty * TILESIZE * 2), BUTTONSIZE, 0.9, [1, 1, 1, 0.7]);
		}
		else {
			txt.draw("LEVEL-" + LEVEL, toWorldX(TILESIZE * 14), toWorldY((starty - 0.5) * TILESIZE * 2), TILESIZE * 2, 1.3, [1, 1, 1, 0.18]);
		}
	}

	this.drawBloom = function() {
		const y2 = Math.min(SIZEY, Math.ceil((cameray + 1.15 * INVERSE_ASPECT) * drawMult));
		const x2 = Math.min(SIZEX, Math.ceil((camerax + 1.15) * drawMult));
		for (let y = Math.max(0, Math.floor((cameray - 0.9 * INVERSE_ASPECT) * drawMult)); y < y2; y++) {
			for (let x = Math.max(0, Math.floor((camerax - 0.9) * drawMult)); x < x2; x++) {
				const tile = getWorld(x, y);
				if (tile.lighting) colorBox.draw(
					toWorldX(x * TILESIZE * 2), toWorldY(y * TILESIZE * 2),
					TILESIZE, TILESIZE, tile.lighting);
			}
		}
		drawObjects(lamps, mix(0.2, 1.8, 0.8, 1.2, clamp(Math.sin(lightSize) + 1, 0.2, 1.8)), true);
	}

	const enemyLocations = [];
	for (let y = 1; y < SIZEY - 1; y++) {
		for (let x = 1; x < SIZEX - 1; x++) {
			if (!getWorld(x, y).solid) enemyLocations.push([x, y]);
		}
	}

	this.enemyLocation = function(pos) {
		const arena = this.getArena();
		while (true) {
			let x, y;
			if (arena) {
				x = randInt(arenaX1 + 1, arenaX2 - 1);
				y = randInt(1, SIZEY - 2);
			}
			else {
				const pos = randInt(0, enemyLocations.length - 1);
				x = enemyLocations[pos][0];
				y = enemyLocations[pos][1];
			}
			const tile = getWorld(x, y);
			if (arena) {
				if (!tile.solid && tile.arena) return [x * TILESIZE * 2, y * TILESIZE * 2];
			}
			else {
				x *= TILESIZE * 2;
				y *= TILESIZE * 2;
				if (Math.abs(x - pos[0]) + Math.abs(y - pos[1]) > (LEVEL === 1 ? 4 : 2)) return [x, y];
			}
		}
	}

	// again will handle corners correctly
	this.collision = function(x1, y1, x2, y2, slide = true, again = true) {
		let best = [];
		for (let y = getWorldY(Math.min(y1, y2)); y <= getWorldY(Math.max(y1, y2)); y++) {
			for (let x = getWorldX(Math.min(x1, x2)); x <= getWorldX(Math.max(x1, x2)); x++) {
				const c = getWorld(x, y).collision(x1, y1, x2, y2, slide);
				if (c.length) best = best[1] === undefined || c[1] < best[1] ? c : best;
			}
		}
		if (again && best[0]) {
			const c = this.collision(x1, y1, best[0][0], best[0][1], slide, false);
			if (c) return c;
		}
		return best[0];
	}

	// again will handle corners correctly
	this.collisionBox = function(x1, y1, x2, y2, sizex, sizey, slide = true, again = true) {
		let best = [];
		for (let x = -1; x <= 1; x += 2) {
			for (let y = -1; y <= 1; y += 2) {
				const x1_2 = x1 + sizex * x;
				const x2_2 = x2 + sizex * x;
				const y1_2 = y1 + sizey * y;
				const y2_2 = y2 + sizey * y;
				const c = this.collision(x1_2, y1_2, x2_2, y2_2, slide);
				if (c) best = _world_js_best_collision([c[0] - sizex * x, c[1] - sizey * y], best, lengthSquared(x1_2, y1_2, c[0], c[1]));
			}
		}
		if (again && best[0]) {
			const c = this.collisionBox(x1, y1, best[0][0], best[0][1], sizex, sizey, slide, false);
			if (c) return c;
		}
		return best[0];
	}

	this.isSolid = (x, y) => getWorld(x, y).solid;

	// Calc lighting
	for (let y = 1; y < SIZEY - 1; y++) {
		for (let x = 1; x < SIZEX - 1; x++) {
			const tile = getWorld(x, y);
			if (!tile.shaft && !tile.arena) {
				for (const l in lamps) {
					const light = Math.min(3 / length(x * TILESIZE * 2, y * TILESIZE * 2, lamps[l].lightX(), lamps[l].lightY()) * 0.018, 0.06);
					if (light > 0.01) {
						if (!this.collision(x * TILESIZE * 2, y * TILESIZE * 2, lamps[l].lightX(), lamps[l].lightY())) {
							tile.lighting += light;
						}
					}
				}
			}
		}
	}

	this.getLighting = function(x, y) {
		return getWorld(getWorldX(x), getWorldY(y)).lighting;
	}
}
