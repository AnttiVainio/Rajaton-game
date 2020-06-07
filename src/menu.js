"use strict";

const SETTINGS = {
	quality: false,
	showFPS: undefined,
	enableShake: undefined,
	showHud: undefined,
	shaderOption: undefined,
};

function Button(active, _txt, x, y, _size, width, color = [1, 1, 1]) {
	const r = new RandomTimer(0.06);
	let r2 = 0;
	const r3 = new RandomTimer(0.04);

	y *= INVERSE_ASPECT;

	let _hover = false;
	let txt = _txt;
	let size = _size;
	let entry = 2;
	let life = 2;
	let spec = false;
	let specMove = 0;
	let _small = false;
	let _volume = false;

	const rot = rand(-1, 1) * 0.15;

	function sx() {
		return size * (_small ? 1.7 : 12) * INVERSE_ASPECT;
	}
	function sy() {
		return size * 1.2;
	}

	this.special = function(i) {
		spec = true;
		entry += i * 0.5;
		specMove -= i * 0.4;
		return this;
	}

	this.small = function() {
		_small = true;
		return this;
	}

	this.fast = function(fast) {
		if (fast) entry = 0.99;
		return this;
	}

	this.volume = function(v) {
		_volume = v;
		return this;
	}

	this.remove = function() {
		life = 1;
	}

	this.hover = function() {
		const retval = active && _hover && life > 1;
		if (retval) playSound("select", SELECT_VOL);
		return retval;
	}

	this.act = function(delta, mx, my, down) {
		if (r.act(delta)[0]) r2 = (2 - life) * 2;

		if (spec) specMove += delta;

		entry = Math.max(0, entry - delta * 2.5);

		_hover = !spec && life > 1 && mx > x - sx() && mx < x + sx() && my > y - sy() && my < y + sy();
		size = _size * (_hover ? 1.1 : 1) * mix(1, 0, 1, 10, Math.min(1, life)) * mix(2, 0, 4, 1, entry < 1 ? 0 : entry);

		if (_volume && _hover && down) {
			const vol0 = _volume === 1 ? SOUND_VOL : MUSIC_VOL;
			const vol = clamp(Math.round(mix((x - sx()) * 0.85, (x + sx()) * 0.85, 0, 100, mx)), 0, 100);
			if (vol0 !== vol) {
				if (_volume === 1) {
					SOUND_VOL = vol;
					playSound("select", SELECT_VOL);
					localStorage.setItem("anttivainio_rajaton_soundVol", String(SOUND_VOL));
				}
				else {
					setMusicVolume(vol);
					localStorage.setItem("anttivainio_rajaton_musicVol", String(MUSIC_VOL));
				}
			}
		}

		if (life <= 1) life -= delta * 2.5;
		return life <= 0;
	}

	this.draw = function(textBox, box, target, beam, down) {
		down = down && active;
		const downMult = down && _hover && !_volume ? 0.8 : 1;
		const shake = (life <= 1 ? r2 : (_hover ? (down ? (_volume ? 0 : 0.03) : 0.012) : 0)) + (entry < 1 ? entry : 0) * 0.08;
		const X = x + shake * (r.r1 - 0.5) * 2;
		const Y = y + shake * (r.r2 - 0.5) + Math.sin(specMove * 2.5) * 0.04;

		const entryFade = Math.min(1, mix(2, 1, 0, 1, entry));
		const entryRot = rot * (1 - entryFade) * 6;
		const sizex = downMult * sx();
		const _rot = entryRot + (_hover && !(_volume && down) ? rot : mix(1, 0, 0, rot * 4, Math.min(1, life)));

		if (active) box.drawRot(X, Y, sizex, downMult * sy(),
			_rot, [0, 0, 0, (life <= 1 ? 0.3 * life : 0.7) * entryFade]);

		const onlyVol = _volume && down && _hover;
		textBox.drawRot((onlyVol ? "" : txt) + (_volume ? (_volume === 1 ? SOUND_VOL : MUSIC_VOL) : ""),
			X, Y, downMult * size, width * INVERSE_ASPECT * (onlyVol ? 1.5 : 1),
			_rot, [color[0], color[1], color[2], (life <= 1 ? 0.4 * life : 1) * entryFade]);

		if (_volume) {
			const X2 = 0.85 * mix(0, 100, -sizex, sizex, _volume === 1 ? SOUND_VOL : MUSIC_VOL);
			const rot2 = Math.sin(_rot);
			target.draw(X + X2, Y + X2 * rot2, sizex * 0.1, sizex * 0.1, 0.6);
			beam.draw(X - sizex * 0.85, Y - sizex * 0.85 * rot2, X + sizex * 0.85, Y + sizex * 0.85 * rot2, 0.01, [1, 1, 1, 0.2]);
		}
	}
}

function Menu(gl, shader, colorShader, textShader, mouse) {
	/*SETTINGS.quality = localStorage.getItem("anttivainio_rajaton_quality");
	if (SETTINGS.quality === undefined || SETTINGS.quality === null) SETTINGS.quality = true;
	else SETTINGS.quality = SETTINGS.quality === "1";
	if (SETTINGS.quality !== false && SETTINGS.quality !== true) SETTINGS.quality = true;*/

	SETTINGS.showFPS = localStorage.getItem("anttivainio_rajaton_FPS");
	if (SETTINGS.showFPS === undefined || SETTINGS.showFPS === null) SETTINGS.showFPS = false;
	else SETTINGS.showFPS = SETTINGS.showFPS === "1";
	if (SETTINGS.showFPS !== false && SETTINGS.showFPS !== true) SETTINGS.showFPS = false;

	SETTINGS.enableShake = localStorage.getItem("anttivainio_rajaton_shake");
	if (SETTINGS.enableShake === undefined || SETTINGS.enableShake === null) SETTINGS.enableShake = true;
	else SETTINGS.enableShake = SETTINGS.enableShake === "1";
	if (SETTINGS.enableShake !== false && SETTINGS.enableShake !== true) SETTINGS.enableShake = true;

	SETTINGS.showHud = localStorage.getItem("anttivainio_rajaton_hud");
	if (SETTINGS.showHud === undefined || SETTINGS.showHud === null) SETTINGS.showHud = true;
	else SETTINGS.showHud = SETTINGS.showHud === "1";
	if (SETTINGS.showHud !== false && SETTINGS.showHud !== true) SETTINGS.showHud = true;

	SETTINGS.shaderOption = localStorage.getItem("anttivainio_rajaton_shader");
	if (SETTINGS.shaderOption === undefined || SETTINGS.shaderOption === null) SETTINGS.shaderOption = 0;
	else SETTINGS.shaderOption = Number(SETTINGS.shaderOption);
	if (SETTINGS.shaderOption !== 0 && SETTINGS.shaderOption !== 1) SETTINGS.shaderOption = 0;

	SOUND_VOL = localStorage.getItem("anttivainio_rajaton_soundVol");
	if (SOUND_VOL === undefined || SOUND_VOL === null) SOUND_VOL = DEFAULT_SOUND_VOL;
	else SOUND_VOL = Number(SOUND_VOL);
	if (SOUND_VOL < 0 || SOUND_VOL > 100) SOUND_VOL = DEFAULT_SOUND_VOL;

	MUSIC_VOL = localStorage.getItem("anttivainio_rajaton_musicVol");
	if (MUSIC_VOL === undefined || MUSIC_VOL === null) MUSIC_VOL = DEFAULT_MUSIC_VOL;
	else MUSIC_VOL = Number(MUSIC_VOL);
	if (MUSIC_VOL < 0 || MUSIC_VOL > 100) MUSIC_VOL = DEFAULT_MUSIC_VOL;

	const textBox = new Text(gl, textShader);
	const box = new Box(gl, colorShader);
	const targetBox = new BoxTex(gl, shader, "target2");
	targetBox.setAdditive();
	const beam = new Beam(gl, colorShader);
	beam.setAdditive();

	const buttons = [];
	let credits = [];
	let down = false;
	let grace = 0;

	let firstTime = true;
	let state = null;
	let settings = false;
	let difficulty = false;
	let difficultyButtons;
	let callbacks;

	function removeButtons() {
		grace = 0.1;
		for (const i in buttons) buttons[i].remove();
	}

	this.getLevel = function() {
		return Number(localStorage.getItem("anttivainio_rajaton_level")) || 1;
	}

	this.saveLevel = function(level) {
		if (level > this.getLevel()) localStorage.setItem("anttivainio_rajaton_level", String(level));
	}

	this.setSettings = function(s, fast = false) {
		settings = s;
		if (s) {
			removeButtons();
			if (fast) buttons.splice(0, buttons.length);
			const extraSetting = this.getLevel() >= 50;
			const y = extraSetting ? 0.1 : 0;
			buttons.splice(0, 0, new Button(true, "BACK", 0, y + 0.6, 0.07, 1.2).fast(fast));
			buttons.splice(0, 0, new Button(true, "MUSIC VOL: ", 0, y + 0.35, 0.07, 1.2).volume(2).fast(fast));
			buttons.splice(0, 0, new Button(true, "SOUND VOL: ", 0, y + 0.1, 0.07, 1.2).volume(1).fast(fast));
			buttons.splice(0, 0, new Button(true, "FPS: " + (SETTINGS.showFPS ? "SHOW" : "HIDE"), 0, y - 0.15, 0.07, 1.2).fast(fast));
			buttons.splice(0, 0, new Button(true, "HUD: " + (SETTINGS.showHud ? "SHOW" : "HIDE"), 0, y - 0.4, 0.07, 1.2).fast(fast));
			buttons.splice(0, 0, new Button(true, "SHAKE: " + (SETTINGS.enableShake ? "ON" : "OFF"), 0, y - 0.65, 0.07, 1.2).fast(fast));
			buttons.splice(0, 0, new Button(true, SETTINGS.shaderOption ? "BLACK AND WHITE" : "DRAW COLORS", 0, extraSetting ? y - 0.9 : -10, 0.07, 1.2).fast(fast));
		}
		else {
			const fun = state === 1 ? this.setPause : this.setMain;
			state = 0;
			fun(callbacks);
		}
	}

	this.setDifficulty = function(d) {
		difficulty = d;
		if (d) {
			removeButtons();
			credits = [];
			difficultyButtons = [];
			const levels = this.getLevel();
			let pos = 0;
			let i = 0;
			let total = 0;
			while (i < levels) {
				total++;
				if (i === 0) i += 3;
				else i += Math.max(1, 4 - Math.floor(i / 11));
			}
			const X = mix(0, 9, 0.85, 0, Math.min(total - 1, 9));
			const Y = total > 50 ? -0.8 : mix(0, 4, -0.15, -0.55, Math.floor((total - 1) / 10));
			if (total <= 50) buttons.splice(0, 0, new Button(false, "CHOOSE LEVEL", 0, -0.8, 0.095, 1.3));
			i = 0;
			total -= 60;
			while (i < levels) {
				if (total > 0) total--;
				else {
					difficultyButtons.push(i);
					buttons.splice(0, 0, new Button(true, String(i + 1), X + mix(0, 9, -0.85, 0.85, pos % 10), Y + 0.25 * Math.floor(pos / 10), 0.07, 1.0).small());
					pos++;
				}
				if (i === 0) i += 3;
				else i += Math.max(1, 4 - Math.floor(i / 11));
			}
			buttons.splice(0, 0, new Button(true, "BACK", 0, 0.75, 0.095, 1.3));
		}
		else {
			state = 0;
			this.setMain(callbacks);
		}
	}

	this.noMenu = function() {
		if (state != 0) {
			state = 0;
			removeButtons();
			credits = [];
			settings = false;
			difficulty = false;
		}
	}

	this.setPause = function(cb) {
		if (state != 1) {
			state = 1;
			callbacks = cb;
			removeButtons();
			buttons.splice(0, 0, new Button(true, "EXIT TO MENU", 0, 0.35, 0.1, 0.9));
			buttons.splice(0, 0, new Button(true, "SETTINGS", 0, -0.05, 0.1, 1.2));
			buttons.splice(0, 0, new Button(true, "CONTINUE", 0, -0.45, 0.1, 1.2));
		}
	}

	this.setMain = function(cb) {
		if (state != 2) {
			state = 2;
			callbacks = cb;
			removeButtons();

			const NAME = "RAJATON";
			for (const i in NAME)
				buttons.splice(0, 0, new Button(false, NAME[i], mix(0, NAME.length - 1, -0.7, 0.7, i), -0.7, 0.18, 1.2).special(3 + Number(i)));

			const menuButtons = () => {
				buttons.splice(0, 0, new Button(false, "F to fullscreen", 0, 0.6, 0.08, 1.3));
				buttons.splice(0, 0, new Button(true, "SETTINGS", 0, 0.2, 0.1, 1.2));
				buttons.splice(0, 0, new Button(true, "START", 0, -0.2, 0.1, 1.2));
				if (!credits.length) credits = [
					new Button(false, "Game by Antti Vainio", -0.44, 0.92, 0.065, 0.9),
					new Button(false, VERSION, 0.58, 0.935, 0.055, 0.9),
				];
			}
			if (firstTime) {
				firstTime = false;
				setTimeout(menuButtons, 2200);
			}
			else menuButtons();
		}
	}

	this.setResults = function(cb) {
		if (state != 3) {
			state = 3;
			callbacks = cb;
			removeButtons();
			buttons.splice(0, 0, new Button(false, "DEAD", 0, -0.35, 0.14, 1.6));
			setTimeout(() => buttons.splice(0, 0, new Button(true, "CONTINUE", 0, 0.2, 0.1, 1.2)), 3000);
		}
	}

	this.act = function(delta) {
		actObjects(buttons, delta,
			mouse[0] === null ? -1000 : mouseToWorldX(mouse[0][0]),
			mouse[0] === null ? -1000 : mouseToWorldY(mouse[0][1]), down);
		actObjects(credits, delta, -1000, -1000);

		if (!mouse[1]) grace -= delta;
		if (grace >= 0) {
			down = false;
			return;
		}

		const clickDifficulty = d => { difficulty = false; return callbacks[0](d); };
		if (difficulty && difficultyButtons.length <= 1) return clickDifficulty(0);

		if (mouse[1]) down = true;
		else if (down) {
			down = false;
			if (settings) {
				if (buttons[0].hover()) {
					SETTINGS.shaderOption = (SETTINGS.shaderOption + 1) % 2;
					localStorage.setItem("anttivainio_rajaton_shader", SETTINGS.shaderOption.toString());
					return this.setSettings(true, true);
				}
				if (buttons[1].hover()) {
					SETTINGS.enableShake = !SETTINGS.enableShake;
					localStorage.setItem("anttivainio_rajaton_shake", SETTINGS.enableShake ? "1" : "0");
					return this.setSettings(true, true);
				}
				if (buttons[2].hover()) {
					SETTINGS.showHud = !SETTINGS.showHud;
					localStorage.setItem("anttivainio_rajaton_hud", SETTINGS.showHud ? "1" : "0");
					return this.setSettings(true, true);
				}
				if (buttons[3].hover()) {
					SETTINGS.showFPS = !SETTINGS.showFPS;
					localStorage.setItem("anttivainio_rajaton_FPS", SETTINGS.showFPS ? "1" : "0");
					return this.setSettings(true, true);
				}
				if (buttons[6].hover()) return this.setSettings(false);
			}
			else if (difficulty) {
				if (buttons[0].hover()) return this.setDifficulty(false);
				for (const i in difficultyButtons) {
					if (buttons[difficultyButtons.length - i].hover()) return clickDifficulty(difficultyButtons[i]);
				}
			}
			else if (state === 1) { // pause
				if (buttons[0].hover()) return callbacks[0]();
				if (buttons[1].hover()) return this.setSettings(true);
				if (buttons[2].hover()) return callbacks[1]();
			}
			else if (state === 2) { // main
				if (buttons[0].hover()) return this.setDifficulty(true);
				if (buttons[1].hover()) return this.setSettings(true);
			}
			else if (state === 3) { // results
				if (buttons.length && buttons[0].hover()) return callbacks[0]();
			}
		}
	}

	this.draw = function() {
		drawObjects(buttons, textBox, box, targetBox, beam, down);
		drawObjects(credits, textBox, box, targetBox, beam, down);
	}
}
