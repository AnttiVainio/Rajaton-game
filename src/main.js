"use strict";

let aspect, camerax, cameray;

function updateCamera(x, y) {
	camerax = x;
	cameray = y;
}
function toWorldX(v) {
	return v - camerax;
}
function toWorldY(v) {
	return v - cameray;
}
function toGameX(v) {
	return v + camerax;
}
function toGameY(v) {
	return v + cameray;
}
function mouseToWorldX(m) {
	return aspect > ASPECT ? m * aspect / ASPECT : m;
}
function mouseToWorldY(m) {
	return aspect < ASPECT ? m / aspect : m / ASPECT;
}

$(function(){
	let FPS = 60;
	let FPS2 = 60;

	const canvas = $("#glCanvas");
	const _gl = canvas[0].getContext("webgl", { alpha: false });
	const gl = _gl ? _gl : canvas[0].getContext("experimental-webgl", { alpha: false });

	if (!gl) {
		alert("Unable to initialize WebGL. Your browser or machine may not support it.");
		return;
	}

	try {
		const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
		console.log("WebGL vendor:   " + gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL));
		console.log("WebGL renderer: " + gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
	} catch(e) {}

	init_draw_js(gl);

	let results;
	let pause;
	let pauseSpeed = 1;

	let quality = localStorage.getItem("anttivainio_rajaton_quality");
	if (quality === undefined || quality === null) quality = true;
	else quality = quality === "1";
	if (quality !== false && quality !== true) quality = true;

	let showFPS = localStorage.getItem("anttivainio_rajaton_FPS");
	if (showFPS === undefined || showFPS === null) showFPS = false;
	else showFPS = showFPS === "1";
	if (showFPS !== false && showFPS !== true) showFPS = false;

	let enableShake = localStorage.getItem("anttivainio_rajaton_shake");
	if (enableShake === undefined || enableShake === null) enableShake = true;
	else enableShake = enableShake === "1";
	if (enableShake !== false && enableShake !== true) enableShake = true;

	let bloomCount = 0;
	const BLOOM_DIV = 2;
	const bloombuffer1 = new Framebuffer(gl, RESX / BLOOM_DIV, RESY / BLOOM_DIV);
	const bloombuffer2 = new Framebuffer(gl, RESX / BLOOM_DIV, RESY / BLOOM_DIV);
	const mainbuffer = new Framebuffer(gl, RESX, RESY);
	const framebuffer = new Framebuffer(gl, RESX, RESY);
	framebuffer.setCanvas(canvas);

	// Create shaders
	const textureShader = (new Shader(gl, _2DTextureVrt, _2DTextureFrg)
		.addAttribute("a_position", 4, _draw_js_positionBuffer)
		.addAttribute("a_texture", 2, _draw_js_textureBuffer)
		.addUniform("texture1", "int", 0)
		.addUniform("color", "vec4")
	);
	const bloom1Shader = (new Shader(gl, _2DTextureVrt, _Bloom1Frg)
		.addAttribute("a_position", 4, _draw_js_positionBuffer)
		.addAttribute("a_texture", 2, _draw_js_textureBuffer)
		.addUniform("texture1", "int", 0)
		.addUniform("color", "vec4")
	);
	const bloom2Shader = (new Shader(gl, _2DTextureVrt, _Bloom2Frg)
		.addAttribute("a_position", 4, _draw_js_positionBuffer)
		.addAttribute("a_texture", 2, _draw_js_textureBuffer)
		.addUniform("texture1", "int", 0)
		.addUniform("color", "vec4")
	);
	const posterisationShader = (new Shader(gl, _2DTextureVrt, _PosterisationFrg)
		.addAttribute("a_position", 4, _draw_js_positionBuffer)
		.addAttribute("a_texture", 2, _draw_js_textureBuffer)
		.addUniform("texture1", "int", 0)
		.addUniform("color", "vec4")
	);
	const alphaTextureShader = (new Shader(gl, _2DTextureVrt, _2DAlphaTextureFrg)
		.addAttribute("a_position", 4, _draw_js_positionBuffer)
		.addAttribute("a_texture", 2, _draw_js_textureBuffer)
		.addUniform("texture1", "int", 0)
		.addUniform("color", "vec4")
	);
	const textShader = (new Shader(gl, _2DTextureVrt, _2DTextFrg)
		.addAttribute("a_position", 4, _draw_js_positionBuffer)
		.addAttribute("a_texture", 2, _draw_js_textureBuffer)
		.addUniform("texture1", "int", 0)
		.addUniform("color", "vec4")
	);
	const noiseShader = (new Shader(gl, _2DTextureVrt, _NoiseFrg)
		.addAttribute("a_position", 4, _draw_js_positionBuffer)
		.addAttribute("a_texture", 2, _draw_js_textureBuffer)
		.addUniform("color", "vec4")
	);
	const colorShader = (new Shader(gl, _2DColorVrt, _2DColorFrg)
		.addAttribute("a_position", 4, _draw_js_positionBuffer)
		.addUniform("color", "vec4")
	);
	// The last shader init leaves the position buffer bound

	const keyboard = new Set();
	const mouse = [null, null, null];

	const menu = new Menu(gl, alphaTextureShader, colorShader, textShader, mouse);
	const fullscreen = new FramebufferBox(gl, framebuffer, posterisationShader);
	const bloomBox1 = new BoxTex(gl, bloom1Shader);
	bloomBox1.setAdditive();
	const bloomBox2 = new BoxTex(gl, bloom2Shader);
	bloomBox2.setAdditive();
	const textBox = new Text(gl, textShader);
	const noiseBox = new BoxTex(gl, noiseShader);
	const textureBox = new BoxTex(gl, textureShader); // used for drawing framebuffers - should not use texture alpha
	const colorBox = new Box(gl, colorShader);
	const target = new BoxTex(gl, alphaTextureShader, "target");
	target.setAdditive();
	const target2 = new BoxTex(gl, alphaTextureShader, "arrow");
	target2.setAdditive();

	let LEVEL = menu.getLevel() - 1; // 0 = first level

	gl.clearColor(0, 0, 0, 1);
	gl.disable(gl.DEPTH_TEST);
	gl.enable(gl.BLEND);

	let fluid, world, player, enemies;

	function newGame(inventory = null, extraEnemies = null, _menu = false) {
		pause = false;
		results = _menu ? false : true;
		LEVEL++;
		menu.saveLevel(LEVEL);
		fluid = new FluidSystem(gl, colorShader);
		world = new World(gl, textureShader, alphaTextureShader, colorShader, textShader, LEVEL, fluid);
		if (player) player.stopSounds();
		if (enemies) enemies.stopSounds();
		player = new Player(gl, alphaTextureShader, colorShader, textShader, LEVEL, _menu, inventory, world, fluid, keyboard, mouse);
		enemies = _menu ? null :
			new Enemies(gl, alphaTextureShader, colorShader, LEVEL, world, player, extraEnemies ? Math.floor(extraEnemies * ENEMY_RETAIN) : extraEnemies);
		particles = new Particles(gl, textureShader, alphaTextureShader, world);
	}
	newGame(null, 0, true);

	let canvasWidth, canvasHeight, canvasQuality;
	let startTime = performance.now();
	let noise = 0;
	let noiseRand = Math.random();
	let cursorx = 0, cursory = 0;

	function draw(timestamp) {
		const startTime2 = Date.now();
		const tmp1 = canvas.width();
		const tmp2 = canvas.height();
		if (canvasWidth !== tmp1 || canvasHeight !== tmp2 || canvasQuality !== quality) {
			canvasWidth = tmp1;
			canvasHeight = tmp2;
			canvasQuality = quality;

			if (document.fullscreenElement) {
				canvas[0].width = quality ? Math.floor(canvas.width()) :
					(canvas.width() / canvas.height() > ASPECT ? Math.floor(RESY * canvas.width() / canvas.height()) : RESX);
				canvas[0].height = quality ? Math.floor(canvas.height()) :
					(canvas.width() / canvas.height() < ASPECT ? Math.floor(RESX / canvas.width() * canvas.height()) : RESY);
			}
			else {
				canvas[0].width = quality ? Math.floor(canvas.width()) : RESX;
				canvas[0].height = canvas[0].width;
			}

			aspect = canvas[0].width / canvas[0].height;
		}

		let delta = (timestamp - startTime) / 1000;
		if (!delta || delta <= 0) delta = 0.001;
		else if (delta > 0.2) delta = 0.2;
		else FPS = FPS * 0.95 + 0.05 / delta;
		startTime = timestamp;

		if (player.getExit() > 2.5) newGame(player.getInventory(), enemies.countAlive());

		if (player.getHealth() <= 0) pause = false;
		if (pause) pauseSpeed = 0.2;
		const origDelta = delta;
		delta = Math.max(0.001, delta * (pause ? player.getGlobalTimescale() : player.getGlobalTimescale() * Math.min(1, pauseSpeed)));
		pauseSpeed += delta;

		if (!pause || player.getHealth() <= 0) {
			pauseMusic(player.getHealth() <= 0 && results);
			world.act(delta);
			fluid.act(delta);
			player.act(delta, enableShake, m => toGameX(mouseToWorldX(m)), m => toGameY(mouseToWorldY(m)));
			if (enemies) enemies.act(delta);
			particles.act(delta);
		}
		else {
			pauseMusic(true);
			player.stopSounds();
			enemies.stopSounds();
		}

		updateMusic();

			/* Start drawing */

		mainbuffer.use();
		gl.viewport(0, -(RESX - RESY) / 2, RESX, RESX);

		noise += delta;
		if (noise > 0.05) {
			noise -= 0.05;
			noiseRand = Math.random();
		}
		noiseBox.draw(0, 0, 1, 1 / ASPECT, noiseRand);

		world.draw();
		if (enemies) enemies.draw();
		player.draw();
		particles.draw();
		player.drawHud();

		if (showFPS) {
			textBox.draw(Math.round(FPS).toString(), 0.9, -0.9 / ASPECT, 0.07, 1.0);
			textBox.draw(Math.round(FPS2).toString(),0.65, -0.9 / ASPECT, 0.07, 1.0);
		}

		// Menu
		if (songsStatus() === 2) {
			menu.act(origDelta, ASPECT);

			if (player.getHealth() <= 0) {
				if (results) {
					menu.setResults([
						() => results = false,
					]);
				}
				else {
					playSong(0);
					menu.setMain([
						() => quality = !quality,
						() => enableShake = !enableShake,
						() => showFPS = !showFPS,
						level => { LEVEL = level; newGame(); },
					], quality, showFPS, enableShake);
				}
			}
			else if (pause) menu.setPause([
				() => quality = !quality,
				() => enableShake = !enableShake,
				() => showFPS = !showFPS,
				() => pause = false,
				() => { results = false; player.quit(); },
			], quality, showFPS, enableShake);
			else menu.noMenu();

			menu.draw(ASPECT);
		}
		else {
			textBox.draw(songsStatus() ? "Loading music" : "Click to start", 0, -0.45, 0.14, 0.8);
			textBox.draw("F to fullscreen", 0, -0.1, 0.12, 0.8);
			textBox.draw("A game by Antti Vainio", 0, 0.27, 0.075, 0.9);
			textBox.draw("www.anttivainio.net", 0, 0.42, 0.075, 1);
		}

		// Cursor
		if (mouse[0]) {
			const inMenu = player.getHealth() <= 0 || pause;
			const size = inMenu ? 0.05 : 0.04 + player.getAccuracy(toGameX(mouseToWorldX(mouse[0][0])), toGameY(mouseToWorldY(mouse[0][1])));
			const offset = inMenu ? [0, 0] : player.getTargetOffset();
			const X = mouseToWorldX(mouse[0][0]) + offset[0];
			const Y = mouseToWorldY(mouse[0][1]) + offset[1];
			if (X !== cursorx || Y !== cursory) {
				const l = length(X, Y, cursorx, cursory);
				cursorx = X + (cursorx - X) / l * 2 * size;
				cursory = Y + (cursory - Y) / l * 2 * size;
			}
			if (inMenu) {
				const rot = Math.atan2(cursorx - X, Y - cursory);
				target2.drawRot(X + size * Math.sin(rot), Y - size * Math.cos(rot), size, size, rot, 0.8);
			}
			else target.draw(X, Y, size, size, 0.8);
		}

			/* Draw bloom */

		bloomCount += delta * 60;
		if (bloomCount > 0) {
			bloombuffer1.use();
			gl.viewport(0, -(RESX - RESY) / 2 / BLOOM_DIV, RESX / BLOOM_DIV, RESX / BLOOM_DIV);
			gl.clear(gl.COLOR_BUFFER_BIT);

			fluid.draw();
			particles.drawBloom();
			if (enemies) enemies.drawBloom();
			player.drawBloom();
			world.drawBloom();

			bloombuffer2.use();
			bloombuffer1.useTexture(0);
		}

			/* Bloom 2 */

		while (bloomCount > 0) {
			colorBox.draw(0, 0, 1, 1, [0, 0, 0, 1.0 - mix(60, 0, 0.65, 0.85, Math.min(60, player.getHealth()))]);
			bloomBox1.draw(0, 0, 1, 1);
			bloomCount--;
		}

			/* Screen */

		framebuffer.use();
		mainbuffer.useTexture(0);
		textureBox.draw(0, 0, 1, 1);
		bloombuffer2.useTexture(0);
		bloomBox2.draw(0, 0, 1, 1, mix(60, 0, 0.55, 0.7, Math.min(60, player.getHealth())));

		const aspectX = aspect > ASPECT ? ASPECT / aspect : 1;
		const aspectY = aspect < ASPECT ? -aspect / ASPECT : -1;
		framebuffer.drawToCanvas();
		gl.clear(gl.COLOR_BUFFER_BIT);

		// Extra cursor
		if (mouse[0]) {
			const inMenu = player.getHealth() <= 0 || pause;
			const X = mouseToWorldX(mouse[0][0]);
			const Y = mouseToWorldY(mouse[0][1]);
			target.draw(X * aspectX, Y * aspectY * ASPECT, 0.04 * aspectX, 0.04 * aspectY * ASPECT, 0.8, true);
		}

		fullscreen.draw(aspectX, aspectY);

		keyboard.delete("wheelup");
		keyboard.delete("wheeldown");

		FPS2 = Math.min(999, FPS2 * 0.95 + 0.05 * 1000 / (Date.now() - startTime2));

		window.requestAnimationFrame(draw);
	}

	// Detect keyboard events on the canvas
	canvas.contextmenu(function(e) {
		return false;
	});
	canvas.keydown(function(e) {
		e.preventDefault();
		const code = e.keyCode === 0 ? e.which : e.keyCode;
		if (code === 70) { // F
			if (!document.fullscreenElement) canvas[0].requestFullscreen();
			else if (document.exitFullscreen) document.exitFullscreen();
		}
		else if (code === 27 || code === 80) { // ESC - P
			pause = !pause;
		}
		keyboard.add(code);
		if (LOG_KEYBOARD) console.log(keyboard);
	});
	canvas.keyup(function(e) {
		e.preventDefault();
		const code = e.keyCode === 0 ? e.which : e.keyCode;
		keyboard.delete(code);
		if (LOG_KEYBOARD) console.log(keyboard);
	});
	canvas.mousemove(function(e) {
		mouse[0] = [(e.pageX - canvas[0].offsetLeft) / canvas.width() * 2 - 1, (e.pageY - canvas[0].offsetTop) / canvas.height() * 2 - 1];
	});
	canvas.mouseleave(function() {
		if (mouse[1] || mouse[2]) pause = true;
		mouse[0] = null;
		mouse[1] = null;
		mouse[2] = null;
	});
	canvas.mousedown(function(e) {
		e.preventDefault();
		canvas.focus();
		if (e.which == 1 || e.which == 3) {
			const i = (e.which - 1) / 2 + 1;
			mouse[i] = [(e.pageX - canvas[0].offsetLeft) / canvas.width() * 2 - 1, (e.pageY - canvas[0].offsetTop) / canvas.height() * 2 - 1];
		}
	});
	canvas.mouseup(function(e) {
		e.preventDefault();
		if (e.which == 1 || e.which == 3) {
			const i = (e.which - 1) / 2 + 1;
			mouse[i] = null;
		}
	});
	canvas.bind("wheel", function(e) {
		if (canvas.is(":focus")) e.preventDefault();
		if (e.originalEvent.deltaY < 0) keyboard.add("wheelup");
		if (e.originalEvent.deltaY > 0) keyboard.add("wheeldown");
	});

	// Fullscreen toggle
	canvas[0].onfullscreenchange = function() {
		pause = true;
	};
	document.addEventListener("keypress", function(e) {
		if (e.keyCode === 102) { // F
			if (!document.fullscreenElement) {
				canvas[0].requestFullscreen();
				canvas.focus();
			}
			else if (document.exitFullscreen) document.exitFullscreen();
		}
	}, false);

	// Start the drawing "loop"
	draw();

	// Check periodically if the canvas is focused
	function checkFocus() {
		if (canvas.is(":focus")) {
			loadSongs();
		}
		else {
			pause = true;
			keyboard.clear();
			for (let i = 1; i < 3; i++) mouse[i] = null;
		}
		setTimeout(checkFocus, 100);
	}

	checkFocus();
});
