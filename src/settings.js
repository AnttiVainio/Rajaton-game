"use strict";

const VERSION = "v0.9.1-2020-05-16";

const IMAGE_LOCATION = "/game_images/";
const SOUND_LOCATION = "/game_sounds/";

const ERROR_TEXTURE = false;

const LOG_KEYBOARD = false;
const LOG_DEBUG = false;
const LOG_GUNS = false;

const RESX = 320;
const RESY = 240;
const ASPECT = RESX / RESY;

const EXTRA_SETTING_UNLOCK = 50;

const DEFAULT_SOUND_VOL = 100;
const DEFAULT_MUSIC_VOL = 70;

const TILESIZE = 0.09;
const PORTALSIZE = 0.12;
const BUTTONSIZE = 0.05;

const SELECT_VOL = 0.6;

const BLOOD_AMOUNT = 3;
const MAX_BLOOD1 = 400;
const MAX_BLOOD2 = 150;

const ENEMY_RETAIN = 0.5;

const SHAKE_AMOUNT = 0.008;

const MAX_ARMOR_DAMAGE = 8;

// The first level is 1 (not 0)
const STATS = {
	player: i => ({
		player: true,
		health: 100,
		armor: Math.pow(1 + (i - 8) * 0.03, 1.5),
		moveSpeed: 2 + i * 0.005,
		moveSpeedY: 1.3 + i * 0.002,
		rechargeTime: 1.1 - i * 0.005,
		jetpackDrain: 18.5 - i * 0.12,
		bloodConversion: Math.min(1.05, 0.85 + i * 0.03),
		fluidConversion: 0.3,
		specialAmmo: 2.5 + i * 0.022,
		heal: 3.5 + i * 0.15,
		bloodToHeal: Math.max(1.15, 2.3 - i * 0.05),
	}),
	enemy: i => ({
		health: 7.5 + i * 1.5,
		armor: 1,
		moveSpeed: 0.6 + i * 0.018,
		moveSpeedY: 0.6 + i * 0.01,
		reaction: Math.min(4, 20 / (i * 0.4 + 3)),
		proximity: Math.min(0.2, 0.1 + i * 0.004),
		chase: 6,
		spawnRate: i <= 2 ? 0 : 0.15 + 0.0028 * i,
		arenaRate: i <= 2 ? 0.3 : 0.4 + 0.002 * i,
		initial: i <= 2 ? 4 + i : 2 + i * 0.2,
		air: Math.max(0.27, 1 - i * 0.03),
		blood: i <= 4 ? 0 : (1 - Math.pow(0.8, Math.sqrt(i - 4))) * 0.25,
		water: i <= 11 ? 0 : (1 - Math.pow(0.86, Math.sqrt(i - 11))) * 0.22,
		lava: i <= 20 ? 0 : (1 - Math.pow(0.92, Math.sqrt(i - 20))) * 0.19,
	}),
	gun: [
		{
			name: "Pistol",
			sprite: "gun2",
			sound: ["shot1", 1],
			size: 0.02,
			damage: 3,
			moveAccuracy: 3,
			accuracy: 0.2,
			recoil: 0.1,
			bulletSpeed: 3,
			shootSpeed: 2.7,
			enemyUnlock: 1,
		},
		{
			name: "Crappy revolver",
			sprite: "gun2",
			sound: ["shot2", 1],
			size: 0.03,
			damage: 7,
			moveAccuracy: 0.1,
			accuracy: 1.2,
			recoil: 0.3,
			bulletSpeed: 5,
			shootSpeed: 1.2,
			enemyUnlock: 2,
		},
		{
			name: "1 SMG",
			sprite: "gun1",
			sound: ["shot1", 0.8],
			ammo: 40,
			size: 0.02,
			damage: 1,
			moveAccuracy: 4.5,
			accuracy: 0.06,
			recoil: 0.1,
			bulletSpeed: 4,
			shootSpeed: 10,
			unlock: 1,
			enemyUnlock: 3,
		},
		{
			name: "2 Revolver",
			sprite: "gun2",
			sound: ["shot2", 1],
			ammo: 6,
			size: 0.03,
			damage: 4,
			penetration: 3,
			moveAccuracy: 0.1,
			accuracy: 1.4,
			recoil: 0.6,
			bulletSpeed: 5,
			shootSpeed: 0.9,
			unlock: 3,
			enemyUnlock: 3 + 1,
		},
		{
			name: "3 Shotgun",
			sprite: "gun3",
			sound: ["shot3", 1],
			ammo: 8,
			size: 0.015,
			damage: 2,
			bullets: 6,
			moveAccuracy: 7,
			accuracy: 0.07,
			recoil: 0.8,
			bulletSpeed: 3.5,
			shootSpeed: 1.4,
			unlock: 5,
			enemyUnlock: 8,//5 + 2,
		},
		{
			name: "4 Assault rifle",
			sprite: "gun1",
			sound: ["shot1", 0.8],
			ammo: 40,
			size: 0.022,
			damage: 2.8,
			moveAccuracy: 8,
			accuracy: 0.04,
			recoil: 0.2,
			bulletSpeed: 4.5,
			shootSpeed: 8,
			unlock: 8,
			enemyUnlock: 8 + 3,
		},
		{
			name: "5 Sniper",
			sprite: "gun4",
			sound: ["shot2", 1],
			ammo: 4,
			size: 0.04,
			damage: 3,
			penetration: 10,
			moveAccuracy: 0.1,
			accuracy: 2.5,
			recoil: 1,
			bulletSpeed: 7,
			shootSpeed: 0.8,
			unlock: 11,
			enemyUnlock: 18,//11 + 4,
		},
		{
			name: "6 Double shotgun",
			sprite: "gun3",
			sound: ["shot3", 1],
			ammo: 4,
			size: 0.02,
			damage: 3.7,
			bullets: 12,
			moveAccuracy: 10,
			accuracy: 0.055,
			recoil: 1.2,
			bulletSpeed: 3.3,
			shootSpeed: 0.55,
			unlock: 14,
			enemyUnlock: 19,//14 + 4,
		},
		{
			name: "7 Machine gun",
			sprite: "gun1",
			sound: ["shot1", 0.8],
			ammo: 40,
			size: 0.03,
			damage: 2.3,
			penetration: 2,
			moveAccuracy: 4.5,
			accuracy: 0.1,
			recoil: 0.2,
			bulletSpeed: 4.5,
			shootSpeed: 7,
			unlock: 18,
			enemyUnlock: 18 + 5,
		},
		{
			name: "8 Railgun",
			sprite: "gun4",
			sound: ["shot2", 1],
			ammo: 3.8,
			size: 0.05,
			damage: 2.1,
			penetration: 26,
			moveAccuracy: 0.1,
			accuracy: 2,
			recoil: 0.8,
			bulletSpeed: 12,
			shootSpeed: 0.45,
			unlock: 22,
			enemyUnlock: 31,//22 + 5,
		},
		{
			name: "9 Auto shotgun",
			sprite: "gun3",
			sound: ["shot2", 1],
			ammo: 12,
			size: 0.018,
			damage: 3.2,
			bullets: 6,
			moveAccuracy: 12,
			accuracy: 0.05,
			recoil: 0.45,
			bulletSpeed: 3.2,
			shootSpeed: 2,
			unlock: 26,
			enemyUnlock: 26 + 6,
		},
		{
			name: "10 Minigun",
			sprite: "gun5",
			sound: ["shot2", 0.85],
			ammo: 65,
			size: 0.023,
			damage: 2.4,
			bullets: 2,
			moveAccuracy: 30,
			accuracy: 0.024,
			recoil: 0.11,
			bulletSpeed: 4,
			shootSpeed: 12,
			unlock: 31,
			enemyUnlock: 31 + 7,
		},
		{
			name: "11 Double railgun",
			sprite: "gun4",
			sound: ["shot2", 1],
			ammo: 2.9,
			size: 0.05,
			damage: 2.1,
			bullets: 2,
			penetration: 26,
			moveAccuracy: 0.5,
			accuracy: 0.4,
			recoil: 1,
			bulletSpeed: 9,
			shootSpeed: 0.4,
			unlock: 36,
			enemyUnlock: 47,//36 + 8,
		},
		{
			name: "12 Bullet sprayer",
			sprite: "gun5",
			sound: ["shot1", 0.7],
			ammo: 95,
			size: 0.016,
			damage: 1.38,
			bullets: 3,
			moveAccuracy: 50,
			accuracy: 0.025,
			recoil: 0.11,
			bulletSpeed: 3,
			shootSpeed: 17,
			unlock: 41,
			enemyUnlock: 41 + 9,
		},
		{
			name: "13 Coilgun",
			sprite: "gun4",
			sound: ["shot2", 1],
			ammo: 10,
			size: 0.04,
			damage: 40,
			moveAccuracy: 0.2,
			accuracy: 0.02,
			recoil: 0.02,
			bulletSpeed: 8,
			shootSpeed: 2,
			unlock: 47,
			enemyUnlock: 47 + 10,
		},
		{
			name: "14 Redeemer",
			sprite: "gun6",
			sound: ["shot3", 1],
			ignoreOwnSpeed: true,
			noRicochet: true,
			ammo: 0.65,
			size: 0.07,
			damage: 400,
			penetration: 1000,
			moveAccuracy: 0.1,
			accuracy: 0.01,
			recoil: 0.01,
			bulletSpeed: 0.7,
			shootSpeed: 0.9,
			unlock: 60,
			enemyUnlock: 999999,
		},
	],
};

if (LOG_GUNS) {
	console.log("GUN - dps - dmg per clip");
	for (const i in STATS.gun) {
		const gun = STATS.gun[i];
		const damage = gun.damage * (gun.penetration || 1) * (gun.bullets || 1);
		const r = v => String(Math.round(v * 10)).padStart(5);
		console.log(gun.name.padEnd(17) + r(damage * gun.shootSpeed) + r(damage * gun.ammo));
	}
}
