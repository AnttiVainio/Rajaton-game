"use strict";

function mix(x1, x2, y1, y2, x) {
	return (y1 - y2) / (x1 - x2) * (x - x1) + y1;
}

function clamp(v, lo, hi) {
	return v < lo ? lo : (v > hi ? hi : v);
}

// b included
function randInt(a, b) {
	return Math.floor(Math.random() * (b - a + 1) + a);
}

// b not included
function rand(a, b) {
	return Math.random() * (b - a) + a;
}

function randDir() {
	return Math.random() * 2 * Math.PI;
}

function length(x1, y1, x2, y2) {
	if (x2 !== undefined) return Math.sqrt((x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2));
	return Math.sqrt(x1 * x1 + y1 * y1);
}

function getNormal(dx, dy, w = 1) {
	const l = length(dx, dy);
	return [dy / l * w, -dx / l * w];
}

function distanceToLine(x, y, x1, y1, x2, y2) {
	if (x1 === x2) return Math.abs(x - x1);
	const a = (y1 - y2) / (x2 - x1);
	const c = (y2 - y1) * x1 / (x2 - x1) - y1;
	return Math.abs(a * x + y + c) / Math.sqrt(a * a + 1);
}

function distanceToFiniteLine(x, y, x1, y1, x2, y2) {
	const d = distanceToLine(x, y, x1, y1, x2, y2);
	const l = length(x1, y1, x2, y2);
	const l1 = length(x, y, x1, y1);
	const l2 = length(x, y, x2, y2);
	const maxl = length(d, l);
	if (l1 > maxl || l2 > maxl) return Math.min(l1, l2);
	return d;
}

function rotateVector(v, rot) {
	return [
		v[0] * Math.cos(rot) + v[1] * -Math.sin(rot),
		v[0] * Math.sin(rot) + v[1] * Math.cos(rot),
	];
}

// signed distance from r1 to r2 between -PI and PI
function rotationDistance(r1, r2) {
	function modulo(x, y) {
		while(x < 0) x += y;
		return x % y;
	}
	const d1 = modulo(r2, 2 * Math.PI) - modulo(r1, 2 * Math.PI);
	const d2 = 2 * Math.PI - Math.abs(d1);
	return Math.abs(d1) < d2 ? d1 : -d2 * d1 / Math.abs(d1);
}

function RGBFromHSV(h, s, v) {
	const c = v * s;
	const h2 = (((h % 360.0) + 360.0) % 360.0) / 60;
	const x = c * (1 - Math.abs((h2 % 2.0) - 1));
	if (h2 <= 1) return [c, x, 0];
	if (h2 <= 2) return [x, c, 0];
	if (h2 <= 3) return [0, c, x];
	if (h2 <= 4) return [0, x, c];
	if (h2 <= 5) return [x, 0, c];
	if (h2 <= 6) return [c, 0, x];
	return [0, 0, 0];
}

function RGBFromHue(h) {
	return RGBFromHSV(h, 1, 1);
}

	/** Objects **/

function actObjects(o, ...a) {
	for (let i = 0; i < o.length; i++) {
		if (o[i].act(...a)) {
			o.splice(i, 1);
			i--;
		}
	}
}

function drawObjects(o, ...a) {
	for (const i in o) o[i].draw(...a);
}

function drawObjectsBloom(o, ...a) {
	for (const i in o) o[i].drawBloom(...a);
}
