"use strict";

/*
 * _draw_js_positionBuffer should be bound after all operations
 */

let _draw_js_positionBuffer;
let _draw_js_textureBuffer;

function init_draw_js(gl) {
	// These are the texture coordinates used for everything
	const textureCoords = [
		0, 0,
		1, 0,
		0, 1,
		1, 1,
	];
	_draw_js_textureBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, _draw_js_textureBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoords), gl.STATIC_DRAW);

	_draw_js_positionBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, _draw_js_positionBuffer);
}

let _draw_js_additive;

function setBlend(gl, additive) {
	if (_draw_js_additive !== additive) {
		_draw_js_additive = additive;
		if (additive) gl.blendFunc(gl.ONE, gl.ONE);
		else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
	}
}

function additiveColor(c) {
	return [c[0] * c[3], c[1] * c[3], c[2] * c[3], 1];
}

function pixelatePositions(positions) {
	const x = positions[0];
	const y = positions[1];
	positions[0] = Math.round(positions[0] * RESX / 2) / RESX * 2;
	positions[1] = Math.round(positions[1] * RESX / 2) / RESX * 2;
	for (let i = 4; i < positions.length; i += 4) {
		positions[i  ] = Math.round((positions[i  ] - x) * RESX / 2) / RESX * 2 + positions[0];
		positions[i+1] = Math.round((positions[i+1] - y) * RESX / 2) / RESX * 2 + positions[1];
	}
	return positions;
}

const XBOUND = 1;
const YBOUND = 1 / ASPECT;

function checkPosition(x, y, sx, sy) {
	return x > -XBOUND - sx && x < XBOUND + sx && y > -YBOUND - sy && y < YBOUND + sy;
}
function checkFluidPosition(x, y) {
	return x > -XBOUND && x < XBOUND && y > -YBOUND && y < YBOUND;
}

function Beam(gl, shader) {
	let additive = false;

	this.setAdditive = function(a = true) {
		additive = a;
	}

	this.draw = function(x1, y1, x2, y2, width, color, n = undefined) {
		if (checkPosition((x1 + x2) * 0.5, (y1 + y2) * 0.5, Math.abs(x2 - x1) * 0.5, Math.abs(y2 - y1) * 0.5)) {
			if (!n) n = getNormal(x2 - x1, y2 - y1, width);

			let positions = [
				x1 - n[0], y1 - n[1], 1, 1,
				x1 + n[0], y1 + n[1], 1, 1,
				x2 - n[0], y2 - n[1], 1, 1,
				x2 + n[0], y2 + n[1], 1, 1,
			];
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pixelatePositions(positions)), gl.DYNAMIC_DRAW);

			shader.use();
			shader.setUniform("color", additive ? additiveColor(color) : color);
			setBlend(gl, additive);
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		}
	}
}

function getDrawCoordinates(x, y, sizex, sizey, rot = undefined) {
	if (rot === undefined) return [
		x - sizex, y - sizey, 1, 1,
		x + sizex, y - sizey, 1, 1,
		x - sizex, y + sizey, 1, 1,
		x + sizex, y + sizey, 1, 1,
	];
	const s = Math.sin(rot);
	const c = Math.cos(rot);
	return [
		x - sizex * c + sizey * s, y - sizex * s - sizey * c, 1, 1,
		x + sizex * c + sizey * s, y + sizex * s - sizey * c, 1, 1,
		x - sizex * c - sizey * s, y - sizex * s + sizey * c, 1, 1,
		x + sizex * c - sizey * s, y + sizex * s + sizey * c, 1, 1,
	];
}

function BoxTex(gl, shader, tex = null, fun = null) {
	let texture = tex ? loadTexture(gl, tex, fun) : null;

	this.setTexture = function(t, f = null) {
		texture = t ? loadTexture(gl, t, f) : null;
	}

	let additive = false;

	this.setAdditive = function(a = true) { additive = a; }

	function _draw(positions, color) {
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pixelatePositions(positions)), gl.DYNAMIC_DRAW);

		if (texture) {
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, texture);
		}

		shader.use();
		shader.setUniform("color", additive ? additiveColor(color) : color);
		setBlend(gl, additive);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	}

	this.draw = function(x, y, sizex, sizey, alphaOrColor = 1.0, force = false) {
		if (force || checkPosition(x, y, Math.abs(sizex), Math.abs(sizey)))
			_draw(getDrawCoordinates(x, y, sizex, sizey), typeof alphaOrColor === "object" ? alphaOrColor : [1.0, 1.0, 1.0, alphaOrColor]);
	}

	this.drawRot = function(x, y, sizex, sizey, rot, alphaOrColor = 1.0, force = false) {
		const size = Math.max(Math.abs(sizex), Math.abs(sizey));
		if (force || checkPosition(x, y, size, size))
			_draw(getDrawCoordinates(x, y, sizex, sizey, rot), typeof alphaOrColor === "object" ? alphaOrColor : [1.0, 1.0, 1.0, alphaOrColor]);
	}
}

function Box(gl, shader) {
	let additive = false;

	this.setAdditive = function(a = true) { additive = a; }

	function _draw(positions, color) {
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pixelatePositions(positions)), gl.DYNAMIC_DRAW);

		shader.use();
		shader.setUniform("color", additive ? additiveColor(color) : color);
		setBlend(gl, additive);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	}

	// optimized for faster drawing
	const fluidSize = 2.5 / RESX;
	this.drawFluid = function(x, y) {
		if (checkFluidPosition(x, y)) {
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(getDrawCoordinates(x, y, fluidSize, fluidSize)), gl.DYNAMIC_DRAW);
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		}
	}
	this.drawFluid1 = function(x, y, color) {
		shader.use();
		shader.setUniform("color", color);
		setBlend(gl, additive);
		this.drawFluid(x, y);
	}

	this.draw = function(x, y, sizex, sizey, alphaOrColor = 1.0) {
		if (checkPosition(x, y, Math.abs(sizex), Math.abs(sizey)))
			_draw(getDrawCoordinates(x, y, sizex, sizey), typeof alphaOrColor === "object" ? alphaOrColor : [1.0, 1.0, 1.0, alphaOrColor]);
	}

	this.drawRot = function(x, y, sizex, sizey, rot, alphaOrColor = 1.0) {
		const size = Math.max(Math.abs(sizex), Math.abs(sizey));
		if (checkPosition(x, y, size, size))
			_draw(getDrawCoordinates(x, y, sizex, sizey, rot), typeof alphaOrColor === "object" ? alphaOrColor : [1.0, 1.0, 1.0, alphaOrColor]);
	}
}

function Text(gl, shader) {
	const box = new BoxTex(gl, shader);

	this.setAdditive = function(a = true) { box.setAdditive(a); }

	this.draw = function(txt, x, y, sizey, widthMult, alphaOrColor = 1.0) {
		if (checkPosition(x, y, Math.abs(sizey * 16 * widthMult), Math.abs(sizey))) {
			useTextTexture(gl, txt);
			box.draw(x, y, sizey * 16 * widthMult, sizey, alphaOrColor);
		}
	}

	this.drawRot = function(txt, x, y, sizey, widthMult, rot, alphaOrColor = 1.0) {
		const size = Math.max(Math.abs(sizey * 16 * widthMult), Math.abs(sizey));
		if (checkPosition(x, y, size, size)) {
			useTextTexture(gl, txt);
			box.drawRot(x, y, sizey * 16 * widthMult, sizey, rot, alphaOrColor);
		}
	}
}

function FramebufferBox(gl, framebuffer, framebufferShader) {
	const box = new BoxTex(gl, framebufferShader);

	this.draw = function(sx = 1, sy = -1, x = 0, y = 0) {
		framebuffer.drawToCanvas();
		framebuffer.useTexture(0);
		box.draw(x, y, sx, sy);
	}
}
