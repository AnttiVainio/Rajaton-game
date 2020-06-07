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

function lengthSquared(x1, y1, x2, y2) {
	if (x2 !== undefined) return (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2);
	return x1 * x1 + y1 * y1;
}

function getNormal(dx, dy, w = 1) {
	const l = w / length(dx, dy);
	return [dy * l, -dx * l];
}

function distanceToLineSquared(x, y, x1, y1, x2, y2) {
	if (x2 - x1 === 0) return (x - x1) * (x - x1);
	const div = 1 / (x2 - x1);
	const a = (y1 - y2) * div;
	const c = (y2 - y1) * x1 * div - y1;
	return (a * x + y + c) * (a * x + y + c) / (a * a + 1);
}

function distanceToFiniteLineSquared(x, y, x1, y1, x2, y2) {
	const d = distanceToLineSquared(x, y, x1, y1, x2, y2);
	const l = lengthSquared(x1, y1, x2, y2);
	const l1 = lengthSquared(x, y, x1, y1);
	const l2 = lengthSquared(x, y, x2, y2);
	const maxl = d + l;
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
