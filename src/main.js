"use strict";

let aspect, inverse_aspect, camerax, cameray;

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
    return aspect > ASPECT ? m * aspect * INVERSE_ASPECT : m;
}
function mouseToWorldY(m) {
    return aspect < ASPECT ? m * inverse_aspect : m * INVERSE_ASPECT;
}

let canvas;

document.addEventListener("DOMContentLoaded", function(){
    let FPS = 60;
    let FPS2 = 60;

    canvas = document.getElementById("glCanvas");
    const _gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false });
    const gl = _gl ? _gl : canvas.getContext("experimental-webgl", { alpha: false, antialias: false, depth: false });

    if (!gl) {
        alert("Unable to initialize WebGL. Your browser or machine may not support it.");
        return;
    }

    try {
        console.log("WebGL vendor:       " + gl.getParameter(gl.VENDOR));
        console.log("WebGL renderer:     " + gl.getParameter(gl.RENDERER));
        console.log("WebGL version:      " + gl.getParameter(gl.VERSION));
        console.log("WebGL GLSL version: " + gl.getParameter(gl.SHADING_LANGUAGE_VERSION));
    } catch(e) {}

    initDrawJS(gl);

    let results;
    let pause;
    let pauseSpeed = 1;

    let bloomCount = 0;
    const BLOOM_DIV = 2;
    const bloombuffer1 = new Framebuffer(gl, RESX / BLOOM_DIV, RESY / BLOOM_DIV);
    const bloombuffer2 = new Framebuffer(gl, RESX / BLOOM_DIV, RESY / BLOOM_DIV);
    const mainbuffer = new Framebuffer(gl, RESX, RESY);
    const framebuffer = new Framebuffer(gl, RESX, RESY);

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
    const blackAndWhiteShader = (new Shader(gl, _2DTextureVrt, _BlackAndWhiteFrg)
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
    const keyboardDown = new Set();
    const mouse = [null, null, null];

    const menu = new Menu(gl, alphaTextureShader, colorShader, textShader, mouse);
    const fullscreen = new FramebufferBox(gl, framebuffer, posterisationShader);
    const bloomBox1 = new BoxTex(gl, bloom1Shader).setAdditive();
    const bloomBox2 = new BoxTex(gl, bloom2Shader).setAdditive();
    const textBox = new Text(gl, textShader);
    const noiseBox = new BoxTex(gl, noiseShader);
    const textureBox = new BoxTex(gl, textureShader); // used for drawing framebuffers - should not use texture alpha
    const colorBox = new Box(gl, colorShader);
    const target = new BoxTex(gl, alphaTextureShader, "target").setAdditive();
    const target2 = new BoxTex(gl, alphaTextureShader, "arrow").setAdditive();

    let LEVEL = menu.getLevel() - 1; // 0 = first level

    gl.clearColor(0, 0, 0, 1);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);

    let fluid, world, player, enemies;

    function newGame(inventory = null, extraEnemies = null, _menu = false) {
        pause = false;
        results = _menu ? false : true;
        // Effective level basically increases by 2 after every arena level
        const EFFECTIVE_LEVEL_PREV = LEVEL + Math.max(0, Math.floor((LEVEL - 1) / 2));
        LEVEL++;
        const EFFECTIVE_LEVEL = LEVEL + Math.max(0, Math.floor((LEVEL - 1) / 2));
        menu.saveLevel(LEVEL);
        fluid = new FluidSystem(gl, colorShader);
        world = new World(gl, textureShader, alphaTextureShader, colorShader, textShader, EFFECTIVE_LEVEL_PREV, LEVEL, EFFECTIVE_LEVEL, fluid);
        if (player) player.stopSounds();
        if (enemies) enemies.stopSounds();
        player = new Player(gl, alphaTextureShader, colorShader, textShader, EFFECTIVE_LEVEL_PREV, LEVEL, EFFECTIVE_LEVEL, _menu, inventory, world, fluid, keyboard, mouse);
        enemies = _menu ? null :
            new Enemies(gl, alphaTextureShader, colorShader, EFFECTIVE_LEVEL, world, player, extraEnemies ? Math.floor(extraEnemies * ENEMY_RETAIN) : extraEnemies);
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
        const tmp1 = canvas.clientWidth;
        const tmp2 = canvas.clientHeight;
        if (canvasWidth !== tmp1 || canvasHeight !== tmp2 || canvasQuality !== SETTINGS.quality) {
            canvasWidth = tmp1;
            canvasHeight = tmp2;
            canvasQuality = SETTINGS.quality;

            // If the game is displayed inside an iframe it should act as if it's fullscreen
            if (document.fullscreenElement || window.self !== window.top) {
                canvas.width = SETTINGS.quality ? Math.floor(canvas.clientWidth) :
                    (canvas.clientWidth / canvas.clientHeight > ASPECT ? Math.floor(RESY * canvas.clientWidth / canvas.clientHeight) : RESX);
                canvas.height = SETTINGS.quality ? Math.floor(canvas.clientHeight) :
                    (canvas.clientWidth / canvas.clientHeight < ASPECT ? Math.floor(RESX / canvas.clientWidth * canvas.clientHeight) : RESY);
            }
            else {
                canvas.width = SETTINGS.quality ? Math.floor(canvas.clientWidth) : RESX;
                canvas.height = canvas.width;
            }

            aspect = canvas.width / canvas.height;
            inverse_aspect = canvas.height / canvas.width;
        }

        let delta = (timestamp - startTime) * 0.001;
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
            player.act(delta, m => toGameX(mouseToWorldX(m)), m => toGameY(mouseToWorldY(m)));
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
        gl.viewport(0, (RESY - RESX) / 2, RESX, RESX);

        noise += delta;
        if (noise > 0.05) {
            noise -= 0.05;
            noiseRand = Math.random();
        }
        noiseBox.draw(0, 0, 1, INVERSE_ASPECT, noiseRand);

        world.draw();
        if (enemies) enemies.draw();
        player.draw();
        particles.draw();
        if (SETTINGS.showHud) player.drawHud();

        if (SETTINGS.showFPS) {
            textBox.draw(Math.round(FPS).toString(), 0.9, -0.9 * INVERSE_ASPECT, 0.07, 1.0);
            textBox.draw(Math.round(FPS2).toString(),0.65, -0.9 * INVERSE_ASPECT, 0.07, 1.0);
        }

        // Menu
        if (songsStatus() === 2) {
            menu.act(origDelta);

            if (player.getHealth() <= 0) {
                if (results) {
                    menu.setResults([
                        () => results = false,
                    ]);
                }
                else {
                    playSong(0);
                    menu.setMain([
                        level => { LEVEL = level; newGame(); },
                    ]);
                }
            }
            else if (pause) menu.setPause([
                () => pause = false,
                () => { results = false; player.quit(); },
            ]);
            else menu.noMenu();

            menu.draw();
        }
        else {
            // Check if the game is running standalone or displayed inside an iframe
            const isStandalone = window.self === window.top;
            textBox.draw(songsStatus() ? "Loading music" : "Click to start", 0, isStandalone ? -0.45 : -0.2, 0.14, 0.8);
            if (isStandalone) { // The fullscreen key doesn't work inside an iframe until the canvas is focused
                textBox.draw(FULLSCREEN_KEY.slice(-1) + " to fullscreen", 0, -0.1, 0.12, 0.8);
            }
            textBox.draw("A game by Antti Vainio", 0, isStandalone ? 0.3 : 0.1, 0.075, 0.9);
        }

        // Cursor
        if (mouse[0]) {
            const inMenu = player.getHealth() <= 0 || pause;
            const size = inMenu ? 0.05 : 0.04 + player.getAccuracy(toGameX(mouseToWorldX(mouse[0][0])), toGameY(mouseToWorldY(mouse[0][1])));
            const offset = inMenu ? [0, 0] : player.getTargetOffset();
            const X = mouseToWorldX(mouse[0][0]) + offset[0];
            const Y = mouseToWorldY(mouse[0][1]) + offset[1];
            if (X !== cursorx || Y !== cursory) {
                const l = 2 * size / length(X, Y, cursorx, cursory);
                cursorx = X + (cursorx - X) * l;
                cursory = Y + (cursory - Y) * l;
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
            gl.viewport(0, (RESY - RESX) / 2 / BLOOM_DIV, RESX / BLOOM_DIV, RESX / BLOOM_DIV);
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

        const aspectX = aspect > ASPECT ? ASPECT * inverse_aspect : 1;
        const aspectY = aspect < ASPECT ? -aspect * INVERSE_ASPECT : -1;
        framebuffer.drawToCanvas();
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Extra cursor
        if (mouse[0]) {
            const X = mouseToWorldX(mouse[0][0]);
            const Y = mouseToWorldY(mouse[0][1]);
            target.draw(X * aspectX, Y * aspectY * ASPECT, 0.04 * aspectX, 0.04 * aspectY * ASPECT, 0.8, true);
        }

        fullscreen.setShader([posterisationShader, blackAndWhiteShader][SETTINGS.shaderOption]);
        fullscreen.draw(aspectX, aspectY);

        // Draw minimap
        if (DEBUG_MINIMAP && keyboard.has("Tab")) {
            const wl = world.getWorldList();
            const sx = world.getSizex();
            const sy = world.getSizey();
            colorBox.draw(0, 0, 0.005 * sx, 0.005 * sy);
            colorBox.draw(0, 0, 0.005 * (sx - 3), 0.005 * (sy - 3), [0,0,0,1]);
            for (let x = 1; x < sx - 1; x++) {
                let solid, shaft, arena;
                for (let y = 1; y < sy - 1; y++) {
                    const w = wl[y * sx + x] || wl[0];
                    for (let t = 0; t < 3; t++) {
                        const test = [w.solid, w.shaft, w.arena][t];
                        if (test && ![solid, shaft, arena][t]) {
                            switch (t) {
                                case 0: solid = y; break;
                                case 1: shaft = y; break;
                                case 2: arena = y; break;
                            }
                        }
                        const test2 = [solid, shaft, arena][t];
                        if ((!test || y === sy - 2) && test2) {
                            const y2 = test ? y : y - 1;
                            colorBox.draw((x - sx * 0.5) * 0.01, ((y2 + test2) * 0.5 - sy * 0.5) * -0.01, 0.005, 0.005 * (y2 - test2 + 1), [1, [0,1,0,1], [1,0,0,1]][t]);
                        }
                        if (!test) {
                            switch (t) {
                                case 0: solid = undefined; break;
                                case 1: shaft = undefined; break;
                                case 2: arena = undefined; break;
                            }
                        }
                    }
                    if (w.lamp)  colorBox.draw((x - sx * 0.5) * 0.01, (y - sy * 0.5) * -0.01, 0.005, 0.005, [0.5, 0.5, 0.5, 1]);
                    if (w.water) colorBox.draw((x - sx * 0.5) * 0.01, (y - sy * 0.5) * -0.01, 0.005, 0.005, [0, 0, 1, 1]);
                    if (w.lava)  colorBox.draw((x - sx * 0.5) * 0.01, (y - sy * 0.5) * -0.01, 0.005, 0.005, [1, 1, 0, 1]);
                }
            }
        }

        if (keyboardDown.has(SCREENSHOT_KEY)) {
            try {
                canvas.toBlob(async blob => {
                    if (!blob) return;
                    const data = [new ClipboardItem({ [blob.type]: blob })];
                    await navigator.clipboard.write(data);
                    console.log("Screenshot taken", blob.type);
                }, 'image/png');
            }
            catch (err) {
                console.error("Screenshot failed:", err);
            }
        }

        keyboard.delete("wheelup");
        keyboard.delete("wheeldown");
        keyboardDown.clear();

        FPS2 = Math.min(999, FPS2 * 0.95 + 0.05 * 1000 / (Date.now() - startTime2));

        window.requestAnimationFrame(draw);
    }

    // Detect keyboard events on the canvas
    canvas.addEventListener("contextmenu", function(e) {
        e.preventDefault();
        return false;
    });

    canvas.addEventListener("keydown", function(e) {
        e.preventDefault();
        if (e.code === FULLSCREEN_KEY) {
            if (!document.fullscreenElement) canvas.requestFullscreen();
            else if (document.exitFullscreen) document.exitFullscreen();
        }
        else if (e.code === "Escape" || e.code === PAUSE_KEY) {
            pause = !pause;
        }
        keyboard.add(e.code);
        keyboardDown.add(e.code);
        if (LOG_KEYBOARD) console.log(keyboard);
    });

    canvas.addEventListener("keyup", function(e) {
        e.preventDefault();
        keyboard.delete(e.code);
        if (LOG_KEYBOARD) console.log(keyboard);
    });

    document.addEventListener("mousemove", function(e) {
        const rect = canvas.getBoundingClientRect();
        mouse[0] = [(e.clientX - rect.left) / canvas.clientWidth * 2 - 1, (e.clientY - rect.top) / canvas.clientHeight * 2 - 1];
    });

    canvas.addEventListener("mousedown", function(e) {
        e.preventDefault();
        canvas.focus();
        if (e.button === 0 || e.button === 2) {
            const i = e.button / 2 + 1;
            mouse[i] = [(e.pageX - canvas.offsetLeft) / canvas.clientWidth * 2 - 1, (e.pageY - canvas.offsetTop) / canvas.clientHeight * 2 - 1];
        }
        keyboard.add("mouse" + e.button);
        keyboardDown.add("mouse" + e.button);
    });

    canvas.addEventListener("mouseup", function(e) {
        e.preventDefault();
        if (e.button === 0 || e.button === 2) {
            const i = e.button / 2 + 1;
            mouse[i] = null;
        }
        keyboard.delete("mouse" + e.button);
    });

    canvas.addEventListener("wheel", function(e) {
        if (canvas === document.activeElement) e.preventDefault();
        if (e.deltaY < 0) keyboard.add("wheelup");
        if (e.deltaY > 0) keyboard.add("wheeldown");
    });

    // Fullscreen toggle
    canvas.onfullscreenchange = function() {
        pause = true;
    };

    document.addEventListener("keypress", function(e) {
        if (e.code === FULLSCREEN_KEY) {
            if (!document.fullscreenElement) {
                canvas.requestFullscreen();
                canvas.focus();
            }
            else if (document.exitFullscreen) document.exitFullscreen();
        }
    }, false);

    function fullPause() {
        pause = true;
        keyboard.clear();
        for (let i = 1; i < 3; i++) mouse[i] = null;
    }

    // Window loses focus
    window.addEventListener("blur", function() {
        fullPause();
    });

    // Page/tab becomes hidden
    document.addEventListener("visibilitychange", function() {
        if (document.hidden) fullPause();
    });

    // Start the drawing "loop"
    window.requestAnimationFrame(draw);

    // Check periodically if the canvas is focused
    function checkFocus() {
        if (canvas === document.activeElement) {
            loadSongs();
        }
        else {
            fullPause();
        }
        setTimeout(checkFocus, 100);
    }

    checkFocus();
});
