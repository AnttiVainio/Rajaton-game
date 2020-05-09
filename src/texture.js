"use strict";

const _texture_js_textures = {};

/*function isPowerOf2(value) {
	return (value & (value - 1)) === 0;
}*/

function loadTexture(gl, url, fun = null) {
	url = IMAGE_LOCATION + url + ".png";

	if (_texture_js_textures[url] !== undefined) {
		if (fun) fun();
		return _texture_js_textures[url];
	}

	const texture = gl.createTexture();
	_texture_js_textures[url] = texture;
	if (LOG_DEBUG) console.log("TEXTURES - " + Object.keys(_texture_js_textures).length);

	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, texture);

	const pixel = ERROR_TEXTURE ? (
		randInt(0, 1) ? new Uint8Array([255, randInt(0, 255), 0, 255]) : new Uint8Array([0, randInt(0, 255), 255, 255])
	) : new Uint8Array([0, 0, 0, 0]);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixel);

	const image = new Image();
	image.onload = function() {
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

		//if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
			//gl.generateMipmap(gl.TEXTURE_2D);
			//gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		//} else {
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			//gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			//gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			//gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
			//gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		//}

		if (fun) fun();
	};
	image.src = url;

	return texture;
}
