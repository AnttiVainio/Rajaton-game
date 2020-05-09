"use strict";

const MIN_WORLD_VOLUME_LEVEL = 0.2;
const MIN_VOLUME_LEVEL = 0.085;

let SOUND_VOL = DEFAULT_SOUND_VOL;
let MUSIC_VOL = DEFAULT_MUSIC_VOL;

let _sound_js_loaded = false;
let _sound_js_ready = false;
let _sound_js_paused = false;

let _sound_js_menu;
let _sound_js_song1;
let _sound_js_song2;
let _sound_js_action1;
let _sound_js_action2;

let _sound_js_songsLoaded = 0;
let _sound_js_current;
let _sound_js_next = 0;
let _sound_js_playing;

const _sound_js_crossFade = [9.99, 0.187, 0.1, 0.187, 0.1];

// For arena length
function songLength(id) {
	if (id === 3) return 32.1;
	if (id === 4) return 36.4;
}

function _sound_js_getSong(id) {
	return [
		_sound_js_menu,
		_sound_js_song1,
		_sound_js_song2,
		_sound_js_action1,
		_sound_js_action2,
	][id];
}

function songsStatus() {
	if (_sound_js_ready) return 2;
	if (_sound_js_loaded) return 1;
	else return 0;
}

function _sound_js_doneLoading() {
	return () => {
		_sound_js_songsLoaded++;
		if (_sound_js_songsLoaded === 3) {
			_sound_js_ready = true;
			playSong(0);
		}
	};
}

function loadSongs() {
	if (!_sound_js_loaded) {
		_sound_js_loaded = true;
		_sound_js_menu = new Audio(SOUND_LOCATION + "menu.ogg");
		_sound_js_menu.loop = true;
		_sound_js_menu.addEventListener("canplaythrough", _sound_js_doneLoading());
		_sound_js_song1 = new Audio(SOUND_LOCATION + "song1.ogg");
		_sound_js_song1.addEventListener("canplaythrough", _sound_js_doneLoading());
		_sound_js_song2 = new Audio(SOUND_LOCATION + "song2.ogg");
		_sound_js_song2.addEventListener("canplaythrough", _sound_js_doneLoading());
		_sound_js_action1 = new Audio(SOUND_LOCATION + "action1.ogg");
		_sound_js_action2 = new Audio(SOUND_LOCATION + "action2.ogg");
	}
}

function _sound_js_setMusicVolume() {
	if (_sound_js_playing) _sound_js_playing.volume = MUSIC_VOL * 0.0099 * (_sound_js_current >= 3 ? 0.35 : 0.28);
}

function playSong(id) {
	if (_sound_js_ready) {
		if (id !== _sound_js_current) {
			if (_sound_js_playing) _sound_js_playing.pause();
			_sound_js_current = id;
			_sound_js_next = [0, 2, 1, 2, 1][id];
			_sound_js_playing = _sound_js_getSong(id).cloneNode();
			_sound_js_setMusicVolume();
			_sound_js_playing.play();
			_sound_js_paused = false;
		}
		else pauseMusic(false);
	}
}

function setMusicVolume(volume) {
	MUSIC_VOL = volume;
	_sound_js_setMusicVolume();
}

function updateMusic() {
	if (!_sound_js_paused && _sound_js_next && _sound_js_playing && _sound_js_playing.currentTime > _sound_js_playing.duration - _sound_js_crossFade[_sound_js_current]) {
		playSong(_sound_js_next);
	}
}

function pauseMusic(pause) {
	if (pause) {
		if(!_sound_js_paused) {
			_sound_js_paused = true;
			_sound_js_playing.pause();
		}
	}
	else {
		if(_sound_js_paused) {
			_sound_js_paused = false;
			_sound_js_playing.play();
		}
	}
}



const _sound_js_sounds = {};
const _sound_js_limiter = {};

function _sound_js_getSound(url, volume, playbackRate) {
	if (!(volume > 0 && volume <= 1)) volume = MIN_VOLUME_LEVEL;
	playbackRate = Math.min(playbackRate, 2.9);
	url = SOUND_LOCATION + url + ".ogg";

	if (_sound_js_sounds[url] === undefined) {
		_sound_js_sounds[url] = new Audio(url);
	}

	const sound = _sound_js_sounds[url].cloneNode();
	sound.volume = volume * SOUND_VOL * 0.0099;
	sound.playbackRate = playbackRate;
	return sound;
}

function _sound_js_getWorldVolume(x, y, volume) {
	const vol = (1 - length(toWorldX(x), toWorldY(y)) * 0.5);
	return vol < MIN_WORLD_VOLUME_LEVEL ? 0 : volume * vol;
}


function playSound(url, volume = 1, playbackRate = 1) {
	if (volume < MIN_VOLUME_LEVEL) return;
	const now = Date.now();
	if (now < (_sound_js_limiter[url] || 0) + 25) return;
	_sound_js_getSound(url, volume, playbackRate).play();
	_sound_js_limiter[url] = now;
}

function playSoundWorld(url, x, y, volume = 1, playbackRate = 1) {
	playSound(url, _sound_js_getWorldVolume(x, y, volume), playbackRate);
}

function playSoundWorldDuration(url, x, y, duration, volume = 1, playbackRate = 1) {
	volume = _sound_js_getWorldVolume(x, y, volume);
	if (volume < MIN_VOLUME_LEVEL) return null;
	const sound = _sound_js_getSound(url, volume, playbackRate);
	sound.loop = true;
	sound.play();
	if (duration) setTimeout(() => sound.pause(), duration);
	return sound;
}

function setWorldVolume(sound, x, y, volume) {
	sound.volume = Math.max(MIN_VOLUME_LEVEL * 0.5, _sound_js_getWorldVolume(x, y, volume)) * SOUND_VOL * 0.0099;
}
