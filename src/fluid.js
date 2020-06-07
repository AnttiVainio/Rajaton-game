"use strict";

const FLUID_WATER = 0;
const FLUID_LAVA = 1;

const _fluid_js_color = {
	[FLUID_WATER]: [0.25, 0.3, 1, 1],
	[FLUID_LAVA]: [1, 0.25, 0.1, 1],
};

const _fluid_js_POS_MULT = 2 / RESX;
const _fluid_js_POS_MULT2 = 1 / TILESIZE / RESX;

function _fluid_js_gridToDraw(x, y) {
	return [Math.round(x) * _fluid_js_POS_MULT, Math.round(y) * _fluid_js_POS_MULT];
}
function _fluid_js_gridToWorld(x, y) {
	return [Math.round(x * _fluid_js_POS_MULT2), Math.round(y * _fluid_js_POS_MULT2)];
}

function Fluid(x, y, world, grid, width, type) {
	let life = 200;
	let drawx, drawy;

	const getGrid = (x2, y2) => grid[Math.round(y2) * width + Math.round(x2)];
	const setGrid = (x2, y2, v) => grid[Math.round(y2) * width + Math.round(x2)] = v;

	function setPos(x2, y2) {
		setGrid(x, y, false);
		x = x2;
		y = y2;
		setGrid(x, y, true);
		const pos = _fluid_js_gridToDraw(x, y);
		drawx = pos[0];
		drawy = pos[1];
	}

	function checkWorld(x2, y2) {
		const pos = _fluid_js_gridToWorld(x2, y2);
		return !world.isSolid(pos[0], pos[1]);
	}

	if (!getGrid(x, y)) setPos(x, y);
	else life = 0;

	this.getLife = () => life;

	this.drain = function(x2, y2, l) {
		const retval = life > 0 && Math.abs(x - x2) <= l && Math.abs(y - y2) <= l;
		if (retval) life = 0;
		return retval;
	}

	this.act = function() {
		if (life <= 0 || !randInt(0, 500)) {
			setGrid(x, y, false);
			return true;
		}

		let amount = randInt(0, 7);
		if (amount) {
			let side = true;
			if (!getGrid(x, y + amount)) {
				if (checkWorld(x, y + amount)) {
					setPos(x, y + amount);
					side = !randInt(0, 10);
				}
				else life--;
			}
			if (side) {
				side = randInt(0, 1) * 2 - 1;
				if (!getGrid(x + side, y) && checkWorld(x + side, y)) setPos(x + side, y);
				else {
					side *= -1;
					if (!getGrid(x + side, y) && checkWorld(x + side, y)) setPos(x + side, y);
				}
			}
		}

		if (life <= 0) {
			setGrid(x, y, false);
			return true;
		}
	}

	this.draw = function(box) {
		box.drawFluid1(toWorldX(drawx), toWorldY(drawy), _fluid_js_color[type]);
	}

	this.drawFast = function(box) {
		if (randInt(0, 1)) box.drawFluid(toWorldX(drawx), toWorldY(drawy));
	}
}

function FluidSystem(gl, shader) {
	const box = new Box(gl, shader);
	const emitter = [];
	const water = [];
	const lava = [];
	const grid = {};

	const TICK = 10; // ticks per second
	let tick = 300; // initial ticks
	let drainAmount = 0;

	let world, gridw;

	function worldToGrid(x, y) {
		return [x * TILESIZE * RESX, y * TILESIZE * RESX];
	}

	this.setWorld = function(_world) {
		world = _world;
		const size = worldToGrid(world.getSizex(), 0);
		gridw = size[0];
	}

	this.addEmitter = function(x, y, type, small = false) {
		const x1 = rand(-0.35, 0.35) + x;
		const x2 = rand(-0.35, 0.35) + x;
		const pos1 = worldToGrid(small ? (x1 + x2) / 2 : Math.min(x1, x2), y - 0.4);
		const pos2 = small ? pos1 : worldToGrid(Math.max(x1, x2), y - 0.4);
		let y2 = pos1[1];
		while (_fluid_js_gridToWorld(0, y2 - 1)[1] === y) y2--;
		for (let i = pos1[0]; i <= pos2[0]; i++) emitter.push([i, y2, type, small ? 5 : Math.round(pos2[0] - pos1[0]) + 1]);
	}

	function drain(fluid, delta, x, y, l) {
		drainAmount += delta * 150;
		let retval = 0;
		if (drainAmount > 8) {
			let i = 0;
			while (drainAmount > 1 && i < fluid.length) {
				if (fluid[i].drain(x, y, l)) {
					retval++;
					drainAmount--;
				}
				i++;
			}
			if (drainAmount > 1) drainAmount = -8; // optimization to wait longer
		}
		return retval;
	}

	this.drainWater = (delta, pos, l) => drain(water, delta, pos[0] * HALF_RES, pos[1] * HALF_RES, l * HALF_RES);
	this.drainLava  = (delta, pos, l) => drain(lava,  delta, pos[0] * HALF_RES, pos[1] * HALF_RES, l * HALF_RES);

	this.act = function(delta) {
		tick += delta * TICK;
		while (tick > 0) {
			tick--;

			actObjects(water);
			actObjects(lava);
			for (const i in emitter) {
				if (randInt(0, emitter[i][3]) < 3) {
					const f = new Fluid(emitter[i][0], emitter[i][1], world, grid, gridw, emitter[i][2]);
					if (f.getLife()) {
						if (emitter[i][2] === FLUID_WATER) water.push(f);
						else if (emitter[i][2] === FLUID_LAVA) lava.push(f);
					}
				}
			}
		}
	}

	this.draw = function() {
		if (water.length) {
			water[0].draw(box);
			for (let i = 1; i < water.length; i++) water[i].drawFast(box);
		}
		if (lava.length) {
			lava[0].draw(box);
			for (let i = 1; i < lava.length; i++) lava[i].drawFast(box);
		}
	}
}
