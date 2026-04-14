"use strict";

const _texture_js_textures = {};

function loadTexture(gl, url, func = null) {
    url = IMAGE_LOCATION + url + ".png";

    if (_texture_js_textures[url] !== undefined) {
        if (func) func();
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
            if (TEXTURE_FILTER > 1) gl.generateMipmap(gl.TEXTURE_2D);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, MIN_FILTER(gl, TEXTURE_FILTER));
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, TEXTURE_SMOOTH ? gl.LINEAR : gl.NEAREST);
        //} else {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        //}

        if (func) func();
    };
    image.src = url;

    return texture;
}
