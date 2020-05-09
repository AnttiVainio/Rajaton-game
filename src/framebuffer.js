"use strict";

function Framebuffer(gl, width = -1, height = -1, smooth = false) {
	let framebuffer = null;
	let framebufferTexture = null;
	let renderbuffer = null;
	let canvas = null;

	this.setCanvas = function(c) {
		canvas = c;
	}

	this.update = function(width, height) {
		// Delete any old framebuffer stuff
		if (framebuffer !== null) gl.deleteFramebuffer(framebuffer);
		if (framebufferTexture !== null) gl.deleteTexture(framebufferTexture);
		if (renderbuffer !== null) gl.deleteRenderbuffer(renderbuffer);

		// Create the framebuffer
		framebuffer = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
		framebuffer.width = width;
		framebuffer.height = height;

		// Create the texture for the framebuffer
		framebufferTexture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, framebufferTexture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, smooth ? gl.LINEAR : gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, smooth ? gl.LINEAR : gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, framebuffer.width, framebuffer.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, framebufferTexture, 0);

		// Create also the depth buffer for the framebuffer
		renderbuffer = gl.createRenderbuffer();
		gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
		gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, framebuffer.width, framebuffer.height);
		gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuffer);

		if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) alert("Problem while creating framebuffer");
		else console.log("Created new framebuffer " + width + " x " + height);
	}

	// Activate the framebuffer's texture to be used by shaders
	this.useTexture = function(id) {
		gl.activeTexture(gl.TEXTURE0 + id);
		gl.bindTexture(gl.TEXTURE_2D, framebufferTexture);
	}

	// Draw to this framebuffer next
	this.use = function() {
		gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
		gl.viewport(0, 0, framebuffer.width, framebuffer.height);
	}

	// Draw to the visible canvas next
	this.drawToCanvas = function() {
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, canvas[0].width, canvas[0].height);
	}

	if (width > 0 && height > 0) this.update(width, height);
}
