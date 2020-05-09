"use strict";

const MAX_TEXT_TEXTURES = 70;

const _text_js_textures = [];

let _text_js_canvas = null;
let _text_js_ctx;
let _text_js_width;
let _text_js_height;

function useTextTexture(gl, txt) {
	const existing = _text_js_textures.findIndex(i => i[0] === txt);

	if (existing >= 0) {
		const tex = _text_js_textures[existing];
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, tex[1]);
		// Move the texture to the beginning of the list (most recently used)
		if (existing > 0) {
			_text_js_textures.splice(existing, 1);
			_text_js_textures.splice(0, 0, tex);
		}
		return;
	}

	if (_text_js_textures.length >= MAX_TEXT_TEXTURES) {
		// Delete oldest texture
		const removed = _text_js_textures.pop();
		gl.deleteTexture(removed[1]);
		if (LOG_DEBUG) console.log("TEXTS - " + (_text_js_textures.length + 1) + " - ADD " + txt + " - REMOVE " + removed[0]);
	}
	else {
		if (LOG_DEBUG) console.log("TEXTS - " + (_text_js_textures.length + 1) + " - ADD " + txt);
	}

	if (_text_js_canvas === null) {
		_text_js_canvas = $("#offscreenText")[0];
		_text_js_ctx = _text_js_canvas.getContext("2d");
		_text_js_width = _text_js_ctx.canvas.width;
		_text_js_height = _text_js_ctx.canvas.height;
	}

	_text_js_ctx.beginPath();
	_text_js_ctx.rect(0, 0, _text_js_width, _text_js_height);
	_text_js_ctx.fillStyle = "black";
	_text_js_ctx.fill();
	_text_js_ctx.fillStyle = "white";
	_text_js_ctx.font = "bold 29px monospace";
	_text_js_ctx.textAlign = "center";
	_text_js_ctx.textBaseline = "middle";
	_text_js_ctx.fillText(txt, _text_js_width / 2, _text_js_height / 2);

	// Add this new texture to the beginning of the list
	const texture = gl.createTexture();
	_text_js_textures.splice(0, 0, [txt, texture]);

	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, _text_js_canvas);
	gl.generateMipmap(gl.TEXTURE_2D);

	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
}
