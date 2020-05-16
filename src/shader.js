"use strict";

const _2DTextureVrt = `
	attribute vec4 a_position;
	attribute vec2 a_texture;
	varying vec2 texCoord;
	void main() {
		texCoord = a_texture;
		gl_Position = a_position;
	}
`;

// Ignores texture alpha channel
// Especially good for drawing framebuffers
const _2DTextureFrg = `
	precision mediump float;
	varying vec2 texCoord;
	uniform sampler2D texture1;
	uniform vec4 color;
	void main() {
		gl_FragColor = vec4(texture2D(texture1, texCoord).rgb, 1.0) * color;
	}
`;

const _Bloom1Frg = `
	precision mediump float;
	varying vec2 texCoord;
	uniform sampler2D texture1;
	uniform vec4 color;
	void main() {
		gl_FragColor = vec4(vec3(
			texture2D(texture1, texCoord + vec2(-${2 / RESX}, 0.0)).rgb * 0.125 +
			texture2D(texture1, texCoord + vec2(-${1 / RESX}, 0.0)).rgb * 0.25 +
			texture2D(texture1, texCoord + vec2(         0.0, 0.0)).rgb * 0.25 +
			texture2D(texture1, texCoord + vec2( ${1 / RESX}, 0.0)).rgb * 0.25 +
			texture2D(texture1, texCoord + vec2( ${2 / RESX}, 0.0)).rgb * 0.125),
			1.0) * color;
	}
`;

const _Bloom2Frg = `
	precision mediump float;
	varying vec2 texCoord;
	uniform sampler2D texture1;
	uniform vec4 color;
	void main() {
		gl_FragColor = vec4(vec3(
			texture2D(texture1, texCoord + vec2(0.0, -${2 / RESX})).rgb * 0.125 +
			texture2D(texture1, texCoord + vec2(0.0, -${1 / RESX})).rgb * 0.25 +
			texture2D(texture1, texCoord + vec2(0.0,          0.0)).rgb * 0.25 +
			texture2D(texture1, texCoord + vec2(0.0,  ${1 / RESX})).rgb * 0.25 +
			texture2D(texture1, texCoord + vec2(0.0,  ${2 / RESX})).rgb * 0.125),
			1.0) * color;
	}
`;

const _PosterisationFrg = `
	precision mediump float;
	varying vec2 texCoord;
	uniform sampler2D texture1;
	uniform vec4 color;
	void main() {
		gl_FragColor = vec4(floor(texture2D(texture1, texCoord).rgb * 10.99) / 10.0, 1.0) * color;
	}
`;

const _BlackAndWhiteFrg = `
	precision mediump float;
	varying vec2 texCoord;
	uniform sampler2D texture1;
	uniform vec4 color;
	void main() {
		vec3 br3 = texture2D(texture1, texCoord).rgb * vec3(0.299, 0.587, 0.114);
		float br = br3.r + br3.g + br3.b;
		if (br < 0.25) gl_FragColor = vec4(vec3(0.0), 1.0) * color;
		else if (br > 0.5) gl_FragColor = vec4(1.0) * color;
		else {
			vec3 avg3 = (
				texture2D(texture1, texCoord + vec2(-${5 / RESX}, 0.0)).rgb +
				texture2D(texture1, texCoord + vec2( ${5 / RESX}, 0.0)).rgb +
				texture2D(texture1, texCoord + vec2(0.0, -${5 / RESY})).rgb +
				texture2D(texture1, texCoord + vec2(0.0,  ${5 / RESY})).rgb) *
				vec3(0.299, 0.587, 0.114) * 0.25;
			float avg = avg3.r + avg3.g + avg3.b;
			gl_FragColor = vec4(vec3(br < avg - 0.05 ? 0.0 : (br > avg + 0.05 ? 1.0 :
				(mod(floor(texCoord.t * ${RESY}.0) + floor(texCoord.s * ${RESX}.0), 2.0))
				)), 1.0) * color;
		}
	}
`;

const _2DAlphaTextureFrg = `
	precision mediump float;
	varying vec2 texCoord;
	uniform sampler2D texture1;
	uniform vec4 color;
	void main() {
		gl_FragColor = texture2D(texture1, texCoord) * color;
	}
`;

const _2DTextFrg = `
	precision mediump float;
	varying vec2 texCoord;
	uniform sampler2D texture1;
	uniform vec4 color;
	void main() {
		gl_FragColor = vec4(color.rgb, texture2D(texture1, texCoord).r * color.a);
	}
`;

const _NoiseFrg = `
	precision mediump float;
	varying vec2 texCoord;
	uniform vec4 color;
	void main() {
		float seed = texCoord.s * 10.0 + texCoord.t * 1000.0 + color.a * 10000.0;
		gl_FragColor = vec4(vec3(fract((sin(7.0*seed)+cos(13.0*seed)+fract(seed))*752.37)) * 0.2, 1.0);
	}
`;

// There's a weird bug on Chrome without hardware acceleration that requires these extra a and b variables
const _2DColorVrt = `
	attribute vec4 a_position;
	attribute float a;
	varying float b;
	void main() {
		b = a;
		gl_Position = a_position;
	}
`;

const _2DColorFrg = `
	precision mediump float;
	uniform vec4 color;
	void main() {
		gl_FragColor = color;
	}
`;

// Load the shader from a string containing the source code
function _shader_js_createShader(gl, type, source) {
	const shader = gl.createShader(type);
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		return shader;
	}
	alert(gl.getShaderInfoLog(shader));
	gl.deleteShader(shader);
}

// Link the shader program using the given vertex and fragment shaders
function _shader_js_createProgram(gl, vertexShader, fragmentShader) {
	const program = gl.createProgram();
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);
	if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
		return program;
	}
	alert(gl.getProgramInfoLog(program));
	gl.deleteProgram(program);
}

// Keep track of the currently used shader so that it can be disabled when another shader is activated
let _shader_js_currentShader = null;

function Shader(gl, vertexShaderSource, fragmentShaderSource) {
	const vertexShader = _shader_js_createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
	const fragmentShader = _shader_js_createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
	const program = _shader_js_createProgram(gl, vertexShader, fragmentShader);
	gl.useProgram(program);

	const attributes = {};
	const uniforms = {};

	// This will also disable the previously used shader
	this.use = function() {
		if (_shader_js_currentShader === this) return;
		if (_shader_js_currentShader !== null) _shader_js_currentShader.disable();
		gl.useProgram(program);
		for (const attr in attributes) {
			if (attributes.hasOwnProperty(attr)) gl.enableVertexAttribArray(attributes[attr][0]);
		}
		_shader_js_currentShader = this;
	}

	// Disable the vertex attribute arrays of this shader
	this.disable = function() {
		for (const attr in attributes) {
			if (attributes.hasOwnProperty(attr)) gl.disableVertexAttribArray(attributes[attr][0]);
		}
	}

	// size is the number of coordinates given for each vertex
	this.addAttribute = function(name, size, buffer = undefined) {
		attributes[name] = [gl.getAttribLocation(program, name), size];
		if (buffer !== undefined) this.setAttribute(name, buffer);
		return this;
	}
	this.setAttribute = function(name, buffer) {
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.vertexAttribPointer(attributes[name][0], attributes[name][1], gl.FLOAT, false, 0, 0);
	}

	this.addUniform = function(name, type, value = undefined) {
		uniforms[name] = [gl.getUniformLocation(program, name), type];
		if (value !== undefined) this.setUniform(name, value);
		return this;
	}
	this.setUniform = function(name, value) {
		if (uniforms[name]) {
			switch (uniforms[name][1]) {
				case "int": gl.uniform1i(uniforms[name][0], value); break;
				case "float": gl.uniform1f(uniforms[name][0], value); break;
				case "vec4": gl.uniform4fv(uniforms[name][0], value); break;
				case "mat4": gl.uniformMatrix4fv(uniforms[name][0], false, value); break;
			}
		}
	}
}
