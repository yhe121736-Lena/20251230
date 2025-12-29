// ============================= 【全局變數與配置】 =============================
let bgm = null;
let jumpSound = null;
let correctSound = null;
let wrongSound = null;
let footstepSound = null;
let victorySound = null;
let rushSound = null;
let shieldSound = null;
let blockSound = null;
let starSound = null;
let amp = null;
const SHOW_DEBUG = false; // 設為 false 隱藏除錯/狀態文字（可改為 true 以顯示）
const BASE_FRAME_DELAY = 6;
const GROUND_Y_RATIO = 0.85;  // ✨ 修正：將地面比例設定為 85%
let GROUND_Y;
let players = {};

// 【攝影機相關新增】
let cameraOffset = { x: 0, y: 0 };
const SCROLL_DEADZONE = 150; // 角色距離畫面邊緣 150 像素時開始捲動
const WORLD_WIDTH = 4000;    // 假設遊戲世界的總寬度為 4000 像素
// ===================================

// 平台資料
let platforms = [];
// 1c 出生點
let spawnX = 80;
let spawnY = null;
let spawnParticles = [];
let spawnBurstTime = 0;
const SPAWN_BURST_DURATION = 1000; // 毫秒

// 【背景新增】
let backgroundImage;
// 暫存需在畫面座標繪製的對話框
let pendingDialogs = [];

// 開始畫面按鈕矩形（由 drawStartScreen 計算並存放以供點擊檢查）
let startButtonRect = { x: 0, y: 0, w: 0, h: 0 };
// 關卡按鈕陣列
let levelButtons = [];
// 開始畫面角色縮圖快取：每個角色選擇 idle 的單張影格
let startThumbs = {};

// 遊戲狀態與計分
let gameStarted = false;
let score = 0;
let showInstructions = true;
// 新增：遊戲結束狀態與訊息
let gameOverMessage = "";

// 音樂開關
let isMuted = false;
const M_KEY = 77;

// 【關卡與提示系統變數】
let currentLevel = 1;
let hintHearts = 3;
const MAX_HEARTS = 3;
let heartParticles = []; // 愛心爆炸粒子
let requiredScore = 0;   // 該關卡需要答對的題數

// 過關機制變數
let maxUnlockedLevel = 1;
let levelComplete = false;
let isGameOver = false;
let failParticles = [];
let retryBtnRect = { x:0, y:0, w:0, h:0 };
let failMenuBtnRect = { x:0, y:0, w:0, h:0 };

let fireworks = []; // 煙火粒子
let nextLevelBtnRect = { x:0, y:0, w:0, h:0 };
let menuBtnRect = { x:0, y:0, w:0, h:0 };

// 新增：干擾性鳥類敵人
let birdEnemies = [];
let shields = []; // 護盾道具
let stars = []; // 無敵星星
let clouds = []; // 新增：雲朵
let lastDamageTime = 0;
const DAMAGE_COOLDOWN = 1500; // 受傷後 1.5 秒無敵

// 選擇題選項按鈕
let optionButtons = [];

// 關卡設定配置
const LEVEL_CONFIG = [
	{ id: 1, musicRate: 1.0, minW: 350, maxW: 550, gapMin: 100, gapMax: 200, goal: 1 },
	{ id: 2, musicRate: 1.1, minW: 300, maxW: 450, gapMin: 120, gapMax: 240, goal: 2 },
	{ id: 3, musicRate: 1.2, minW: 200, maxW: 350, gapMin: 150, gapMax: 280, goal: 3 },
	{ id: 4, musicRate: 1.3, minW: 150, maxW: 250, gapMin: 180, gapMax: 320, goal: 4 },
	{ id: 5, musicRate: 1.5, minW: 100, maxW: 180, gapMin: 200, gapMax: 380, goal: 5 }
];

function startGame(levelIndex = 1) {
	currentLevel = levelIndex;
	const config = LEVEL_CONFIG[currentLevel - 1];

	gameStarted = true;
	showInstructions = false;
	gameOverMessage = "";
	score = 0;
	hintHearts = 3; // 重置愛心
	requiredScore = config.goal;
	levelComplete = false;
	isGameOver = false;
	failParticles = [];
	fireworks = [];
	birdEnemies = []; // 重置敵人
	shields = []; // 重置護盾
	stars = []; // 重置星星
	clouds = []; // 重置雲朵
	lastDamageTime = 0;
	if (players["1c"]) {
		players["1c"].hasShield = false; // 重置玩家護盾狀態
		players["1c"].isInvincible = false; // 重置無敵狀態
		players["1c"].invincibleEndTime = 0;
	}

	// 將主角放到世界最左側（出生點）並重設攝影機
	if (players["1c"]) players["1c"].x = spawnX;

	// 其他 NPC 隨機分布於地圖上（避開出生區與互相重疊），並放置在平台或地面
	for (let k of ['3c','4c','5c','6c']) {
		if (players[k]) placeNPCRandomly(k);
	}

	// 根據關卡重新生成平台
	createPlatforms(config);
	createEnemies(config); // 生成敵人
	createShields(config); // 生成護盾
	createStars(config); // 生成星星
	createClouds(); // 生成雲朵
	// 重新計算所有角色高度（避免卡在舊平台位置）
	for (let k in players) {
		if (players[k]) players[k].y = getPlatformYAt(players[k].x);
	}

	// 設定攝影機中心於主角
	cameraOffset.x = constrain(players["1c"].x - width / 2, 0, WORLD_WIDTH - width);
	// 觸發出生爆發特效
	spawnBurstTime = millis();
	emitSpawnBurst(36);

	// 清除開始畫面的縮圖快取
	startThumbs = {};

	// 設定音樂速度
	if (bgm) {
		bgm.stop();
		bgm.rate(config.musicRate);
		if (!isMuted) {
			bgm.loop();
		}
	}
}

// 物理參數 (共同使用)
const MOVEMENT_SPEED = 5;
const JUMP_FORCE = -22; // 提升跳躍力，讓上平台更容易
const GRAVITY = 1.0; // 稍微降低重力，延長滯空時間

// ====== 對話和題庫變數 ======
let quizTable;
let quizData = [];
let currentQuiz = null;
let quizResult = '';
const T_KEY = 84;
const N_KEY = 78; // N 鍵 (Next) 用於下一題/繼續
const E_KEY = 69; // E 鍵 (End) 用於結束對話 (立即)
// 狀態機：IDLE -> QUESTION -> WAITING_ANSWER -> FEEDBACK (3c 問答專用)
let dialogState = 'IDLE';
// let inputElement; // 不再需要文字輸入框
let currentNPC = null; // 正在互動的 NPC key（'3c','5c','6c'）

// 3c 問答邏輯：追蹤是否答錯一次
let hasAnsweredWrong = false;

// 對話冷卻時間 (毫秒)
const DIALOG_COOLDOWN_MS = 1000;
let dialogCooldownEndTime = 0;

// === 4c (神奇橘子) 對話邏輯 ===
let is4cTalking = false;
const PROXIMITY_RANGE = 120; // 縮短自動停止距離，NPC 更靠近 1c 才會停下
const ORANGE_DIALOG = "我是神奇橘子\n我會跟著你！";
// ===================================

// ****** 角色資料結構：CHARACTERS ******
const CHARACTERS = {
    "1c": {
        displayName: "角色 1",
        controlKeys: { left: 37, right: 39, jump: 38, run: 16, shoot: 32, fallen: 70, smile: 83, dialogTrigger: T_KEY },
        animData: {
            "idle": { path: '1c/idle/all.png', numFrames: 8, frameW: 61, frameH: 70, frames: [] },
            "run": { path: '1c/run/all.png', numFrames: 8, frameW: 61, frameH: 70, frames: [] },
            "walk": { path: '1c/walk/all.png', numFrames: 8, frameW: 61, frameH: 70, frames: [] },
            "stop": { path: '1c/idle/all.png', numFrames: 8, frameW: 61, frameH: 70, frames: [] },
            "shoot": { path: '1c/shoot/all.png', numFrames: 15, frameW: 134, frameH: 97, frames: [] },
            "jump": { path: '1c/ju/all.png', numFrames: 10, frameW: 61, frameH: 63, frames: [] },
            "fallen": { path: '1c/idle/all.png', numFrames: 8, frameW: 61, frameH: 70, frames: [] },
            "smile": { path: '1c/idle/all.png', numFrames: 8, frameW: 61, frameH: 70, frames: [] },
        }
    },
    "3c": {
        displayName: "角色 3c",
        controlKeys: { left: 65, right: 68, jump: 87, run: 82, shoot: -1, fallen: -1, smile: -1 },
        animData: {
            "idle": { path: '3c/stop/all.png', numFrames: 8, frameW: 0, frameH: 0, frames: [] },
            "walk": { path: '3c/walk/all.png', numFrames: 8, frameW: 0, frameH: 0, frames: [] },
            "stop": { path: '3c/stop/all.png', numFrames: 8, frameW: 0, frameH: 0, frames: [] },
            "run": { path: '3c/run/all.png', numFrames: 6, frameW: 0, frameH: 0, frames: [] },
            "jump": { path: '3c/jump/all.png', numFrames: 14, frameW: 0, frameH: 0, frames: [] },
            "fallen": { path: '3c/fallen/all.png', numFrames: 14, frameW: 0, frameH: 0, frames: [] },
            "smile": { path: '3c/smile/all.png', numFrames: 13, frameW: 0, frameH: 0, frames: [] },
            "shoot": { path: '3c/stop/all.png', numFrames: 8, frameW: 0, frameH: 0, frames: [] },
        }
    },
    "4c": {
        displayName: "角色 4c",
        controlKeys: { left: 74, right: 76, run: 75, jump: -1, shoot: -1, fallen: -1, smile: -1 },
        animData: {
            "idle": { path: '4c/idle/all.png', numFrames: 9, frameW: 0, frameH: 0, frames: [] },
            "walk": { path: '4c/walk/all.png', numFrames: 5, frameW: 0, frameH: 0, frames: [] },
            "stop": { path: '4c/idle/all.png', numFrames: 9, frameW: 0, frameH: 0, frames: [] },
            "run": { path: '4c/run/all.png', numFrames: 10, frameW: 0, frameH: 0, frames: [] },
            "jump": { path: '4c/run/all.png', numFrames: 10, frameW: 0, frameH: 0, frames: [] },
        }
    }
	,
	"5c": {
		displayName: "角色 5c",
		// 建議預設按鍵：Q/E 左右, I 跳躍, O 跑
		controlKeys: { left: 81, right: 69, jump: 73, run: 79, shoot: -1, fallen: -1, smile: -1 },
		animData: {
			"idle": { path: '5c/idle/all.svg', numFrames: 1, frameW: 128, frameH: 128, frames: [] },
			"walk": { path: '5c/walk/all.svg', numFrames: 1, frameW: 128, frameH: 128, frames: [] },
			"stop": { path: '5c/stop/all.svg', numFrames: 1, frameW: 128, frameH: 128, frames: [] },
			"run": { path: '5c/run/all.svg', numFrames: 1, frameW: 128, frameH: 128, frames: [] },
			"jump": { path: '5c/jump/all.svg', numFrames: 1, frameW: 128, frameH: 128, frames: [] },
			"fallen": { path: '5c/fallen/all.svg', numFrames: 1, frameW: 128, frameH: 128, frames: [] },
			"smile": { path: '5c/smile/all.svg', numFrames: 1, frameW: 128, frameH: 128, frames: [] }
		}
	},
	"6c": {
		displayName: "角色 6c",
		// 建議預設按鍵：Z/X 左右, C 跳躍, V 跑
		controlKeys: { left: 90, right: 88, jump: 67, run: 86, shoot: -1, fallen: -1, smile: -1 },
		animData: {
			"idle": { path: '6c/idle/all.svg', numFrames: 1, frameW: 128, frameH: 128, frames: [] },
			"walk": { path: '6c/walk/all.svg', numFrames: 1, frameW: 128, frameH: 128, frames: [] },
			"stop": { path: '6c/stop/all.svg', numFrames: 1, frameW: 128, frameH: 128, frames: [] },
			"run": { path: '6c/run/all.svg', numFrames: 1, frameW: 128, frameH: 128, frames: [] },
			"jump": { path: '6c/jump/all.svg', numFrames: 1, frameW: 128, frameH: 128, frames: [] },
			"fallen": { path: '6c/fallen/all.svg', numFrames: 1, frameW: 128, frameH: 128, frames: [] },
			"smile": { path: '6c/smile/all.svg', numFrames: 1, frameW: 128, frameH: 128, frames: [] }
		}
	}
};

// 角色類別 (Character Class)
class Character {
    constructor(key, initialX) {
        this.key = key;
        this.animSet = CHARACTERS[key].animData;
        this.controls = CHARACTERS[key].controlKeys;

        this.x = initialX; // 世界絕對 X 座標
        this.y = GROUND_Y;
        this.yVelocity = 0;

        this.isJumping = false;
        this.isShooting = false;
        this.isFallen = false;

        this.facingRight = (key === "1c");
        this.state = "idle";

        for (let animKey in this.animSet) {
            this.animSet[animKey].frameCounter = floor(random(0, 5));
            this.animSet[animKey].currentFrame = floor(random(0, this.animSet[animKey].numFrames));
        }
		// AI 漫遊屬性（用於 3c / 4c）
		this.aiDirection = 0; // -1: 左, 0: 停, 1: 右
		this.aiTimer = floor(random(500, 3000)); // 毫秒
		this.aiSpeed = MOVEMENT_SPEED * random(0.5, 0.75); // AI 移動速度 (隨機化以避免同步)
		this.stepTimer = 0; // 腳步聲計時器
    }

    getBounds() {
		// 取得目前 state 的動畫物件，若不存在則退回 idle
		let anim = this.animSet[this.state];
		if (!anim) anim = this.animSet["idle"] || {};

		let defaultW = (this.key === "4c") ? 32 : 60;
		let defaultH = (this.key === "4c") ? 32 : 70;

		// 若 frameW/frameH 不存在或為 0，嘗試從 sheet 或 frames[0] 取得尺寸，否則使用預設
		const tryWidth = (anim.frameW && anim.frameW > 0) ? anim.frameW : (anim.sheet && (anim.sheet.width || (anim.sheet.canvas && anim.sheet.canvas.width)) ) || (anim.frames && anim.frames[0] && (anim.frames[0].width || anim.frames[0].naturalWidth));
		const tryHeight = (anim.frameH && anim.frameH > 0) ? anim.frameH : (anim.sheet && (anim.sheet.height || (anim.sheet.canvas && anim.sheet.canvas.height)) ) || (anim.frames && anim.frames[0] && (anim.frames[0].height || anim.frames[0].naturalHeight));

		const w = (tryWidth && tryWidth > 0) ? tryWidth : defaultW;
		const h = (tryHeight && tryHeight > 0) ? tryHeight : defaultH;
        return {
            x: this.x - w / 2,
            y: this.y - h,
            w: w,
            h: h
        };
    }

    display(effectiveDelay) {
		const anim = this.animSet[this.state];

		// 若 animation 物件存在但 frames 尚未填入，而有原始 sheet，將 sheet 當作單張影格補上
		if (anim && anim.frames && anim.frames.length === 0 && anim.sheet) {
			anim.frames.push(anim.sheet);
			if (!anim.frameW || !anim.frameH) {
				anim.frameW = anim.frameW || 128;
				anim.frameH = anim.frameH || 128;
			}
		}

		if (!anim || anim.frames.length === 0) {
		if (this.state !== "idle" && this.animSet["idle"]) {
			this.state = "idle";
			this.animSet["idle"].currentFrame = 0;
			this.animSet["idle"].frameCounter = 0;
		}
		// 若尚未載入動畫影格，繪製簡單佔位方塊以便可視化角色位置
		push();
		translate(round(this.x), this.y - ((anim && anim.frameH) ? anim.frameH/2 : 30));
		rectMode(CENTER);
		noStroke();
		if (this.key === '3c') fill(150,200,255);
		else if (this.key === '4c') fill(255,200,150);
		else if (this.key === '5c') fill(200,255,200);
		else if (this.key === '6c') fill(220,200,255);
		else fill(200);
		const pw = (anim && anim.frameW) ? anim.frameW : 40;
		const ph = (anim && anim.frameH) ? anim.frameH : 60;
		rect(0, 0, pw, ph, 8);
		pop();
		return;
        }

        anim.frameCounter++;
        if (anim.frameCounter >= effectiveDelay) {
            anim.frameCounter = 0;

            if (this.state === "walk" || this.state === "idle" || this.state === "run" || this.state === "stop") {
                anim.currentFrame = (anim.currentFrame + 1) % anim.numFrames;
            } else if (this.state === "jump") {
                if (anim.currentFrame < anim.numFrames - 1) anim.currentFrame++;
            } else if (this.state === "shoot" || this.state === "fallen" || this.state === "smile") {
                anim.currentFrame++;
                if (anim.currentFrame >= anim.numFrames) {
                    if (this.state === "shoot") {
                             this.isShooting = false;
                             this.state = "idle";
                    }
                    anim.currentFrame = anim.numFrames - 1;
                }
            }
        }

	// 選取影格，若 currentFrame 不存在則退回第 0 幀或 sheet
	let img = null;
	if (anim.frames && anim.frames.length > 0) img = anim.frames[anim.currentFrame] || anim.frames[0];
	if (!img && anim.sheet) img = anim.sheet;

	// 計算顯示尺寸：優先使用 anim.frameW/H，若缺失則從 img 取尺寸，最後使用預設
	const defaultW = (this.key === "4c") ? 32 : 60;
	const defaultH = (this.key === "4c") ? 32 : 70;
	let displayW = (anim.frameW && anim.frameW > 0) ? anim.frameW : (img && (img.width || img.naturalWidth)) || defaultW;
	let displayH = (anim.frameH && anim.frameH > 0) ? anim.frameH : (img && (img.height || img.naturalHeight)) || defaultH;

	// 防止 0 或 NaN
	if (!isFinite(displayW) || displayW <= 0) displayW = defaultW;
	if (!isFinite(displayH) || displayH <= 0) displayH = defaultH;

		push();
		// 修正 2-A: 將 X 座標取整數，消除浮點數微動
		translate(round(this.x), this.y);

		// 若僅有單張影格（例如 5c/6c 的 SVG），在 walk 狀態時加入程序性晃動與輕微旋轉
		let bob = 0;
		let wobble = 0;
		if (this.state === 'walk' && anim.frames && anim.frames.length === 1) {
			bob = sin(frameCount * 0.35 + this.x * 0.02) * (displayH * 0.06);
			wobble = sin(frameCount * 0.35 + this.x * 0.02) * 0.06; // 旋轉角度小幅度
		}

		if ((this.key === "3c" || this.key === "4c") && this.state === "fallen") {
				translate(0, -displayH * 0.1 + bob);
		} else {
				translate(0, -displayH / 2 + bob);
		}

        let flip = !this.facingRight;

        if (this.key === "4c") {
             flip = this.facingRight;
        }

		if (flip) {
			scale(-1, 1);
		}

		// 若只有單張影格且在 walk 狀態，套用輕微的左右搖擺（rotate）以模擬擺動手腳
		if (wobble !== 0) rotate(wobble);

		let scaleFactor = (this.key === "4c") ? 1.5 : 1;
		image(img, 0, 0, displayW * scaleFactor, displayH * scaleFactor);

        pop();

        // 修正 2-B: 邊界約束改為針對 WORLD_WIDTH
        const halfSpriteW = (anim.frameW > 0) ? floor(anim.frameW * 0.5) : 50;
        
        // 【關鍵修正】限制角色 X 軸在世界寬度內
        this.x = constrain(this.x, halfSpriteW, WORLD_WIDTH - halfSpriteW);
    }
}

// 輔助函式：動態計算 frameW (用於 3c, 4c)
function extractFramesDynamic(anim) {
    if (!anim.sheet || anim.sheet.width < 10) return;
    anim.frameH = anim.sheet.height;

    // 修正 1: 使用 floor() 確保 frameW 是整數
    anim.frameW = floor(anim.sheet.width / anim.numFrames);

    try { anim.sheet.loadPixels(); } catch (e) { return; }
    const actualNumFrames = Math.floor(anim.sheet.width / anim.frameW);
    anim.numFrames = Math.min(anim.numFrames, actualNumFrames);
    for (let i = 0; i < anim.numFrames; i++) {
          try { anim.frames.push(anim.sheet.get(i * anim.frameW, 0, anim.frameW, anim.frameH)); } catch(e) { return; }
    }
}

// 輔助函式：固定 frameW/frameH (用於 1c)
function extractFramesFixed(anim) {
	if (!anim.sheet) return;

	// 某些 SVG 或向量圖片在 p5 中可能沒有正確的 width 屬性（會是 0），
	// 對於單張影格的情況，我們直接把整張圖當成一個影格使用。
	const sheetWidth = anim.sheet.width || (anim.sheet.canvas && anim.sheet.canvas.width) || 0;
	const sheetHeight = anim.sheet.height || (anim.sheet.canvas && anim.sheet.canvas.height) || 0;

	if (sheetWidth === 0 && anim.numFrames === 1) {
		anim.frames.push(anim.sheet);
		// 若未指定尺寸，使用預設值以避免後續顯示問題
		if (!anim.frameW || !anim.frameH) {
			anim.frameW = anim.frameW || 128;
			anim.frameH = anim.frameH || 128;
		}
		return;
	}

	if (sheetWidth < anim.frameW) return;
	try { anim.sheet.loadPixels(); } catch (e) { return; }
	const actualNumFrames = Math.floor(anim.sheet.width / anim.frameW);
	anim.numFrames = Math.min(anim.numFrames, actualNumFrames);
	for (let i = 0; i < anim.numFrames; i++) {
		try { anim.frames.push(anim.sheet.get(i * anim.frameW, 0, anim.frameW, anim.frameH)); } catch(e) { return; }
	}
}

// ======= 平台系統輔助函式 =======
function createPlatforms(config) {
	platforms = [];
	
	// 如果沒有傳入設定，使用預設（第一關）
	const minW = config ? config.minW : 350;
	const maxW = config ? config.maxW : 550;
	const gapMin = config ? config.gapMin : 100;
	const gapMax = config ? config.gapMax : 200;

	// 起始平台 (固定)
	platforms.push({ x: 420, w: 400, y: GROUND_Y - 120 });

	let currentX = 420 + 200 + random(gapMin, gapMax);
	
	// 隨機生成直到世界盡頭
	while (currentX < WORLD_WIDTH - 200) {
		const w = floor(random(minW, maxW));
		// 高度隨機，但限制在可跳躍範圍內 (地面上方 80 ~ 280 像素)
		const y = GROUND_Y - floor(random(80, 280));
		
		platforms.push({ x: currentX, w: w, y: y });
		
		// 下一個平台的中心點 = 當前中心 + 當前一半寬 + 間隙 + 下一個一半寬(估計)
		currentX += (w / 2) + random(gapMin, gapMax) + (minW / 2);
	}
}

// 在地圖上為 NPC 尋找安全的隨機 X 座標並放置到平台或地面
function placeNPCRandomly(key) {
	if (!players[key]) return;
	const minX = 220; // 避開最左邊出生區
	const maxX = WORLD_WIDTH - 220;
	let tries = 0;
	let candidateX;
	while (tries < 200) {
		candidateX = floor(random(minX, maxX));
		// 與 1c 保持一定距離
		if (players['1c'] && abs(candidateX - players['1c'].x) < 180) { tries++; continue; }
		// 與其他 NPC 保持距離
		let ok = true;
		for (let k of ['3c','4c','5c','6c']) {
			if (k === key) continue;
			if (players[k] && abs(candidateX - players[k].x) < 160) { ok = false; break; }
		}
		if (!ok) { tries++; continue; }
		break;
	}
	if (!candidateX) candidateX = minX + floor(random(0, maxX - minX));
	players[key].x = candidateX;
	players[key].y = getPlatformYAt(candidateX);
}

function getPlatformYAt(x) {
	for (let p of platforms) {
		const half = p.w / 2;
		if (x > p.x - half && x < p.x + half) return p.y;
	}
	return GROUND_Y;
}


// ============================= 【載入】 =============================
function preload() {
    // 載入背景圖片 (假設檔名為 background.png)
    try {
        backgroundImage = loadImage('background.png',
            () => console.log('背景圖片載入成功!'),
            (err) => console.error("[ERROR] 載入 background.png 失敗，將使用純色背景。", err)
        );
    } catch (e) {
        console.error("loadImage function failed or background.png is missing.", e);
    }

    // 載入角色圖
    for (let charKey in CHARACTERS) {
        const charData = CHARACTERS[charKey];
        for (let animKey in charData.animData) {
            let anim = charData.animData[animKey];
            anim.sheet = loadImage(anim.path,
                (img) => {
                    if (charKey === "3c" || charKey === "4c") { extractFramesDynamic(anim); }
                    else { extractFramesFixed(anim); }
                },
                (err) => {
                    console.error(`[ERROR] 載入失敗: ${charKey}/${animKey} - ${anim.path}`, err);
                }
            );
        }
    }
    // 載入 CSV 題庫檔案
    try {
        quizTable = loadTable('questions.csv', 'csv', 'header');
    } catch (e) {
        console.error("載入 questions.csv 失敗:", e);
    }

    // 載入音效 
    try { bgm = loadSound('music.mp3'); } catch (e) { console.warn('loadSound not available', e); }
}

// ============================= 【設定】 =============================
function setup() {
    createCanvas(windowWidth, windowHeight);
    imageMode(CENTER);
    smooth();

	GROUND_Y = height * GROUND_Y_RATIO;

	// 建立平台（需在 GROUND_Y 被計算後）
	createPlatforms(LEVEL_CONFIG[0]); // 預設生成第一關樣式供背景用

	// 【關鍵修正】將初始位置設定在 WORLD_WIDTH 的中央附近
	const initialCenter = WORLD_WIDTH / 2; 

	players["1c"] = new Character("1c", initialCenter - 250);
	players["3c"] = new Character("3c", initialCenter + 50);
	players["4c"] = new Character("4c", initialCenter + 250);
	players["5c"] = new Character("5c", initialCenter + 450);
	players["6c"] = new Character("6c", initialCenter + 650);

	// 調整 1c 起始為 spawnX（左側出生），其他角色保留相對分布
	if (players["1c"]) players["1c"].x = spawnX;
	// 計算 spawnY（平台或地面）
	spawnY = getPlatformYAt(spawnX);
	for (let k of ["3c","4c","5c","6c"]) {
		if (players[k]) players[k].y = getPlatformYAt(players[k].x);
	}

	// 若角色落在平台上，將 y 設為平台高度，否則放在地面
	for (let k in players) {
		if (!players[k]) continue;
		players[k].y = getPlatformYAt(players[k].x);
	}

    // 將 CSV 轉換為 JS 陣列
    if (quizTable && quizTable.getRowCount() > 0) {
        for (let i = 0; i < quizTable.getRowCount(); i++) {
            const row = quizTable.getRow(i);
            quizData.push({
                question: row.getString('題目'),
                answer: row.getString('答案'), // 正確答案的選項，例如 'A'
				// 新增：讀取選項
				options: {
					'A': row.getString('選項A'),
					'B': row.getString('選項B'),
					'C': row.getString('選項C')
				},
                feedback_correct: row.getString('答對回饋'),
                feedback_wrong: row.getString('答錯回饋'),
                hint: row.getString('提示')
            });
        }
    }

    if (bgm && bgm.setVolume) bgm.setVolume(0.6);
    try {
        amp = new p5.Amplitude();
        if (bgm) amp.setInput(bgm);
    } catch (e) {
        amp = null;
    }

	// 延遲列印各角色關鍵動畫載入狀態（協助除錯）：在 setup 後等待一小段時間讓 loadImage callbacks 完成
	setTimeout(() => {
		try {
			if (SHOW_DEBUG && players["6c"]) {
				const a6 = players["6c"].animSet;
				console.log('6c anim frames status:');
				for (let k in a6) {
					const af = a6[k];
					console.log(`  ${k}: frames=${af.frames ? af.frames.length : 0}, frameW=${af.frameW}, frameH=${af.frameH}, path=${af.path}`);
				}
			}
		} catch (e) { if (SHOW_DEBUG) console.warn('debug log failed', e); }
	}, 800);

	// ============================= 【合成音效產生器】 =============================
	// 直接使用程式碼產生音效，無需下載 MP3 檔案
	jumpSound = {
		play: () => {
			let osc = new p5.Oscillator('sine');
			osc.start();
			osc.amp(0);
			osc.amp(0.3, 0.02); // 快速淡入
			osc.freq(200);
			osc.freq(500, 0.15); // 頻率爬升 (跳躍感)
			osc.amp(0, 0.15, 0.1); // 淡出
			setTimeout(() => osc.stop(), 300);
		}
	};

	correctSound = {
		play: () => {
			let osc = new p5.Oscillator('triangle');
			osc.start();
			osc.amp(0);
			osc.amp(0.2, 0.02);
			osc.freq(880); // 高音 A5
			osc.freq(1760, 0.1); // 快速滑向 A6 (叮咚感)
			osc.amp(0, 0.2, 0.2);
			setTimeout(() => osc.stop(), 400);
		}
	};

	wrongSound = {
		play: () => {
			let osc = new p5.Oscillator('sawtooth');
			osc.start();
			osc.amp(0);
			osc.amp(0.2, 0.05);
			osc.freq(150);
			osc.freq(50, 0.4); // 頻率下降 (失敗感)
			osc.amp(0, 0.3, 0.1);
			setTimeout(() => osc.stop(), 500);
		}
	};

	footstepSound = {
		play: () => {
			let osc = new p5.Oscillator('square');
			osc.start();
			osc.amp(0);
			osc.amp(0.05, 0.01); // 音量較小
			osc.freq(120);
			osc.freq(80, 0.06); // 頻率快速下降模擬踏步聲
			osc.amp(0, 0.06, 0.04);
			setTimeout(() => osc.stop(), 100);
		}
	};

	victorySound = {
		play: () => {
			// 勝利音效：C5, E5, G5, C6 (琶音)
			const notes = [523.25, 659.25, 783.99, 1046.50];
			const delays = [0, 150, 300, 450];
			const durations = [150, 150, 150, 800];
			
			for (let i = 0; i < notes.length; i++) {
				setTimeout(() => {
					let osc = new p5.Oscillator('triangle');
					osc.start();
					osc.freq(notes[i]);
					osc.amp(0);
					osc.amp(0.2, 0.05);
					osc.amp(0, 0.1, (durations[i]/1000) - 0.05);
					setTimeout(() => osc.stop(), durations[i]);
				}, delays[i]);
			}
		}
	};

	rushSound = {
		play: () => {
			let osc = new p5.Oscillator('sawtooth');
			osc.start();
			osc.amp(0);
			osc.amp(0.1, 0.05); // 音量適中
			osc.freq(1200); // 高音
			osc.freq(800, 0.4); // 頻率下降 (俯衝感)
			osc.amp(0, 0.1, 0.3);
			setTimeout(() => osc.stop(), 400);
		}
	};

	shieldSound = {
		play: () => {
			let osc = new p5.Oscillator('sine');
			osc.start();
			osc.amp(0);
			osc.amp(0.1, 0.05);
			osc.freq(400);
			osc.freq(800, 0.2); // 上升音效 (獲得感)
			osc.amp(0, 0.1, 0.2);
			setTimeout(() => osc.stop(), 300);
		}
	};

	blockSound = {
		play: () => {
			let osc = new p5.Oscillator('square');
			osc.start();
			osc.amp(0);
			osc.amp(0.1, 0.02);
			osc.freq(150);
			osc.freq(100, 0.1); // 低沉阻擋聲
			osc.amp(0, 0.1, 0.1);
			setTimeout(() => osc.stop(), 200);
		}
	};

	starSound = {
		play: () => {
			let osc = new p5.Oscillator('triangle');
			osc.start();
			osc.amp(0.1);
			let t = 0;
			for(let i=0; i<10; i++) {
				setTimeout(() => osc.freq(random(600, 1200)), t);
				t += 60;
			}
			setTimeout(() => osc.stop(), 600);
		}
	};
}

// ============================= 【繪圖循環】 =============================
function draw() {
    const p1 = players["1c"]; // 鎖定 1c 作為主角 (攝影機追蹤對象)

    // A. 更新攝影機偏移量 (Camera Offset Update)
    
    // 1. 計算世界邊界
    const minCameraX = 0;
    const maxCameraX = WORLD_WIDTH - width;

	// 2. 讓 1c 永遠置中：攝影機直接跟隨 1c，使其在畫面中心
	cameraOffset.x = p1.x - width / 2;
	// 3. 限制攝影機偏移量 (防止捲出世界邊界)
	cameraOffset.x = constrain(cameraOffset.x, minCameraX, maxCameraX);
    
	// B. 繪製背景：先以背景色填滿畫布以避免黑邊，再繪製背景圖片，並根據 cameraOffset.x 平移背景（背景看起來在動）
	background('#FFD2D2');
	if (backgroundImage) {
		const canvasRatio = width / height;
		const imageRatio = backgroundImage.width / backgroundImage.height;
		let drawW, drawH, offsetX, offsetY;

		if (canvasRatio > imageRatio) {
			drawW = width;
			drawH = width / imageRatio;
			offsetX = 0;
			offsetY = (height - drawH) / 2;
		} else {
			drawH = height;
			drawW = height * imageRatio;
			offsetX = (width - drawW) / 2;
			offsetY = 0;
		}

		push();
		imageMode(CORNER);
		// 將背景依 cameraOffset.x 平移並水平平鋪，確保在畫面左右邊緣複製背景以填滿走道
		const drawX = offsetX - cameraOffset.x;
		// 找到一個起始 X，確保從畫面最左側開始平鋪
		let startX = drawX;
		while (startX > 0) startX -= drawW;
		for (let x = startX - drawW; x < width; x += drawW) {
			image(backgroundImage, x, offsetY, drawW, drawH);
		}
		imageMode(CENTER);
		pop();
	}

		// 若遊戲尚未開始，顯示遊戲化的開始畫面
		if (!gameStarted) {
			drawStartScreen();
			return;
		}

	// 若過關，顯示過關畫面 (在 draw 結尾呼叫，這裡僅作狀態檢查參考)
	// 注意：我們希望背景和角色停留在最後一刻，所以繼續執行繪製，但停止更新邏輯

    // C. 應用攝影機平移 (所有後續繪製都會被平移)
    // 【關鍵步驟】將整個畫布向左平移 cameraOffset.x 的距離
    push();
    translate(-cameraOffset.x, 0);

	// 新增：繪製雲朵 (在背景層，平台之前)
	updateAndDrawClouds();

	// D. 繪製平台
	if (platforms && platforms.length > 0) {
		push();
		rectMode(CENTER);
		// 更精緻的 Spawn 特效（在平台繪製前繪出，使平台不遮擋太多）
		if (spawnX !== null && spawnY !== null) {
			drawSpawnEffect(spawnX, spawnY);
		}
		for (let p of platforms) {
			const px = p.x;
			const py = p.y + 8; // 平台矩形稍微往下繪製以看起來是頂部
			const pw = p.w;
			const ph = 18;
			// 平台主體（木板）
			noStroke();
			fill(120, 85, 40);
			rect(px, py + 4, pw, ph, 6);

			// 頂部草地/亮邊，讓平台更明顯
			fill(96, 180, 80);
			rect(px, p.y + 2, min(pw, 160), 10, 4);

			// 顯示平台邊框與陰影
			stroke(40, 25, 10, 200);
			strokeWeight(2);
			noFill();
			rect(px, py + 4, pw, ph, 6);

			// 底部陰影條，增加立體感
			noStroke();
			fill(30, 20, 10, 120);
			rect(px, py + ph / 2 + 6, pw * 0.9, 6, 3);
		}
		pop();
	}

	// D-2. 繪製與更新敵人 (在平台之後，角色之前)
	updateAndDrawEnemies(p1);
	updateAndDrawShields(p1);
	updateAndDrawStars(p1);

	// 更新並繪製愛心爆炸粒子 (在所有角色之上，但在 UI 之下)
	// 由於粒子是畫面座標特效，我們在 pop() 之後繪製，或者在這裡繪製但要注意座標系
	// 這裡選擇在 pop() 之後繪製 UI 類的東西

	// E. 繪製所有角色 (角色仍在其世界絕對座標 this.x 上移動)
    const p3 = players["3c"];
    const p4 = players["4c"];
	const p5 = players["5c"];
	const p6 = players["6c"];

    const effectiveDelay = BASE_FRAME_DELAY;

    // 1. 更新角色邏輯
	if (!levelComplete && !isGameOver) {
		updatePlayer(p1);
		updatePlayer(p3);
		updatePlayer(p4);
		if (p5) updatePlayer(p5);
		if (p6) updatePlayer(p6);

		// 2. 處理 3c 的朝向和狀態
		updatePlayerOrientationForDialog(p3, p1);
	}

    // 3. 繪製角色
	// p1 受傷閃爍效果 (無敵時間內閃爍)
	if (millis() < lastDamageTime + DAMAGE_COOLDOWN) {
		if (frameCount % 10 < 5) p1.display(effectiveDelay);
	} else {
		p1.display(effectiveDelay);
	}

	// 繪製護盾光環 (若玩家擁有護盾)
	if (p1.hasShield) {
		push();
		translate(p1.x, p1.y - 35); // 約在角色中心
		noFill();
		stroke(0, 255, 255, 150 + 50 * sin(frameCount * 0.2)); // 呼吸效果
		strokeWeight(3);
		ellipse(0, 0, 70, 70);
		pop();
	}

	// 繪製無敵光環 (若玩家處於無敵狀態)
	if (p1.isInvincible) {
		if (millis() > p1.invincibleEndTime) {
			p1.isInvincible = false;
		} else {
			push();
			translate(p1.x, p1.y - 35);
			noFill();
			colorMode(HSB, 360, 100, 100);
			stroke((frameCount * 15) % 360, 80, 100); // 彩虹旋轉色
			strokeWeight(4);
			ellipse(0, 0, 75, 75);
			pop();
		}
	}

    p3.display(effectiveDelay);
    p4.display(effectiveDelay);
	if (p5) p5.display(effectiveDelay);
	if (p6) p6.display(effectiveDelay);

    // F. 處理對話 (對話框、輸入框也應被平移)
	if (!levelComplete && !isGameOver) {
		handleOrangeDialog(p1, p4);
		handleQuizDialog(p1, players["3c"], "3c");
		handleQuizDialog(p1, players["5c"], "5c");
		handleQuizDialog(p1, players["6c"], "6c");
	}

    // G. 恢復畫布狀態 (平移結束)
    pop();

	// H-1. 繪製愛心系統與粒子 (UI 層)
	drawHearts();
	drawHeartParticles();

	// H0. 在畫面座標繪製暫存的對話框（使對話框固定在角色上方，與攝影機無關）
	if (pendingDialogs.length > 0) {
		for (let d of pendingDialogs) {
			const screenX = d.x - cameraOffset.x;
			const screenY = d.y; // world y; we'll place dialog above this top
			const boxInfo = drawDialogBox(screenX, screenY, d.text, d.alignment, 'top');

			// 如果是等待回答的問題，繪製選項
			if (d.isQuestion && dialogState === 'WAITING_ANSWER') {
				drawQuizOptions(boxInfo.x, boxInfo.bottomY);
			}
		}
		pendingDialogs.length = 0;
	}

    // H. 顯示提示文字 (此部分不應被平移，所以放在 pop() 之後)
    push();
    noStroke();
    fill(0, 120);
    textAlign(CENTER, TOP);
    textSize(14);
    
    let cooldownText = '';
    const isOnCooldown = millis() < dialogCooldownEndTime;
    if (isOnCooldown) {
        let remaining = ceil((dialogCooldownEndTime - millis()) / 1000);
        cooldownText = ` [冷卻中: ${remaining}s]`;
    }

	let interactionHint = (isColliding(p1, p3) && dialogState === 'IDLE' && !isOnCooldown && !is4cTalking)
											? '按 T 鍵開始對話' : '';

	// 當所有角色都在地面（未跳躍）時，不顯示底部的控制/除錯文字
	const keysToCheck = ["1c","3c","4c","5c","6c"];
	let anyOffGround = false;
	for (let k of keysToCheck) {
		const pl = players[k];
		if (!pl) continue;
		if (pl.isJumping || (pl.y && pl.y < GROUND_Y - 1)) { anyOffGround = true; break; }
	}

	if (SHOW_DEBUG && (anyOffGround || dialogState !== 'IDLE')) {
		let controlText = `1c (←↑→/Shift/Space/F/S/T/N/E) | 3c (W/A/D/R) | 4c (J/L/K) | 5c (Q/I/E/O) | 6c (Z/C/X/V) | 狀態: ${dialogState} | ${interactionHint} ${cooldownText} | 偏移量: ${floor(cameraOffset.x)}`;
		text(controlText, width / 2, 8);
	}

	// 計分顯示（畫面右上）
	push();
	fill(0);
	textAlign(RIGHT, TOP);
	textSize(16);
	text(`關卡 ${currentLevel} | 目標: ${score}/${requiredScore}`, width - 12, 8);

	// 顯示靜音狀態
	if (isMuted) {
		fill(255, 100, 100, 220);
		textSize(14);
		text(`(靜音)`, width - 12, 28);
	}

	pop();
    pop();

	// 若過關，繪製過關畫面
	if (levelComplete) {
		drawLevelCompleteScreen();
	}
	
	// 若失敗，繪製失敗畫面
	if (isGameOver) {
		drawGameOverScreen();
	}
}

// === 處理 4c 的自動對話邏輯 ===
function handleOrangeDialog(p1, p4) {
    const dist_x = abs(p1.x - p4.x);
    const DIALOG_OFFSET = 120;

    if (dist_x < PROXIMITY_RANGE) {
        is4cTalking = true;
		p4.facingRight = (p4.x < p1.x);
		// 4c 提示邏輯修改：顯示提示按鍵
		if (currentQuiz && (dialogState === 'WAITING_ANSWER' || dialogState === 'FEEDBACK')) {
			const hintText = (hintHearts > 0) ? `按 T 消耗愛心獲取提示 (${hintHearts})` : `愛心已用盡...`;
			// 使用角色邊界頂端作為對話框基準，避免蓋住角色
			const b4 = p4.getBounds();
			pendingDialogs.push({ x: p4.x, y: b4.y - 8, text: hintText, alignment: p4.facingRight ? 'RIGHT' : 'LEFT' });
		}
    } else {
        is4cTalking = false;
    }
}

// 處理單一角色的狀態/物理更新 (已整合 4c 可動修正)
function updatePlayer(player) {
    const canMove = (!player.isFallen);
    const controls = player.controls;

    // A. 物理 (跳躍和重力)
	if (player.isJumping) {
		const prevY = player.y;
		player.y += player.yVelocity;
		player.yVelocity += GRAVITY;

		// 檢查是否著陸到任一平台（從上方落下到平台頂端）
		let landed = false;
		if (platforms && platforms.length > 0) {
			for (let pf of platforms) {
				if (prevY < pf.y && player.y >= pf.y) {
					// 橫向重疊檢查
					const halfPl = pf.w / 2;
					if (player.x > pf.x - halfPl && player.x < pf.x + halfPl) {
						player.y = pf.y;
						player.isJumping = false;
						player.yVelocity = 0;
						landed = true;
						break;
					}
				}
			}
		}

		// 若未著陸平台，檢查地面
		if (!landed && player.y >= GROUND_Y) {
			player.y = GROUND_Y;
			player.isJumping = false;
			player.yVelocity = 0;
			if (canMove) {
				player.state = (keyIsDown(controls.left) || keyIsDown(controls.right)) ? "walk" : "idle";
			} else {
				player.state = "idle";
			}
		} else if (landed) {
			if (canMove) {
				player.state = (keyIsDown(controls.left) || keyIsDown(controls.right)) ? "walk" : "idle";
			} else {
				player.state = "idle";
			}
		}
	}

    if (!canMove) {
        if (player.state === "walk" || player.state === "run") player.state = "idle";
        return;
    }

    // B. 水平移動
    let moving = false;

    if (player.key === "4c") {
        if (keyIsDown(controls.left)) {
            player.x -= MOVEMENT_SPEED;
            player.facingRight = false;
            moving = true;
        }
        if (keyIsDown(controls.right)) {
            player.x += MOVEMENT_SPEED;
            player.facingRight = true;
            moving = true;
        }
    } else {
        if (keyIsDown(controls.left)) {
            player.x -= MOVEMENT_SPEED;
            player.facingRight = false;
            moving = true;
        }
        if (keyIsDown(controls.right)) {
            player.x += MOVEMENT_SPEED;
            player.facingRight = true;
            moving = true;
        }
    }

	// D. 自動漫遊 AI（當沒有人操控時）
	if ((player.key === "3c" || player.key === "4c" || player.key === "5c" || player.key === "6c") && !player.isFallen) {
		// 判斷玩家是否正在以鍵盤控制該角色（若有人在按鍵則不使用 AI）
		const humanControlActive = keyIsDown(player.controls.left) || keyIsDown(player.controls.right) || keyIsDown(player.controls.run) || (player.controls.jump && keyIsDown(player.controls.jump));
		const p1 = players["1c"];

		if (!humanControlActive) {
			// --- 4c 特殊邏輯：跟隨玩家 ---
			if (player.key === "4c") {
				const dist = p1.x - player.x;
				const absDist = abs(dist);
				const stopDist = 90; // 跟隨停止距離 (比對話距離 120 小，確保會停在對話範圍內)

				if (absDist > stopDist) {
					// 移動向玩家
					const speed = MOVEMENT_SPEED * 0.95; // 速度稍快以跟上玩家
					if (dist > 0) {
						player.x += speed;
						player.facingRight = true;
					} else {
						player.x -= speed;
						player.facingRight = false;
					}
					moving = true;

					// 跳躍邏輯
					if (!player.isJumping) {
						// 1. 玩家在較高處 (嘗試跳躍跟隨)
						if (p1.y < player.y - 40 && absDist < 250) {
							player.isJumping = true;
							player.yVelocity = JUMP_FORCE;
						}
						// 2. 遇到地形障礙 (沿用部分原有邏輯)
						else if (platforms && platforms.length > 0) {
							const lookAheadX = player.x + (player.facingRight ? 1 : -1) * 100;
							for (let pf of platforms) {
								const half = pf.w / 2;
								if (lookAheadX > pf.x - half && lookAheadX < pf.x + half) {
									if (pf.y < player.y - 10 && pf.y > player.y - 300) {
										player.isJumping = true;
										player.yVelocity = JUMP_FORCE;
										break;
									}
								}
							}
						}
					}
				} else {
					// 距離夠近，停止並面向玩家
					moving = false;
					if (!player.isJumping) player.state = "idle";
					player.facingRight = (p1.x > player.x);
				}
			}
			// --- 其他 NPC (3c, 5c, 6c) 隨機漫遊 ---
			else {
				if (dialogState === 'IDLE' && !is4cTalking) {
					// 進入 AI 控制：每次 aiTimer 到期隨機選擇新的方向
					player.aiTimer -= deltaTime || 16;

					// 確保初始有方向
					if (player.aiDirection === 0) player.aiDirection = (random() < 0.5) ? 1 : -1;

					if (player.aiTimer <= 0) {
						const r = random();
						if (r < 0.5) player.aiDirection = -1;
						else player.aiDirection = 1;
						// 移除 aiDirection = 0 的機率，確保一直移動
						player.aiTimer = floor(random(1000, 3000));
					}

					// 邊界檢查：碰到世界邊緣自動轉向
					if (player.x < 100) player.aiDirection = 1;
					if (player.x > WORLD_WIDTH - 100) player.aiDirection = -1;

					if (player.aiDirection < 0) {
						player.x -= player.aiSpeed;
						player.facingRight = false;
						moving = true;
					} else if (player.aiDirection > 0) {
						player.x += player.aiSpeed;
						player.facingRight = true;
						moving = true;
					}

					// AI 嘗試跳躍
					if (!player.isJumping && player.aiDirection !== 0 && platforms && platforms.length > 0) {
						const lookAheadX = player.x + player.aiDirection * 150;
						for (let pf of platforms) {
							const half = pf.w / 2;
							if (lookAheadX > pf.x - half && lookAheadX < pf.x + half) {
								if (pf.y < player.y - 8 && pf.y > player.y - 320) {
									player.isJumping = true;
									player.yVelocity = JUMP_FORCE;
									break;
								}
							}
						}
						if (!player.isJumping && random() < 0.03) {
							player.isJumping = true;
							player.yVelocity = JUMP_FORCE * 0.9;
						}
					}
				} else {
					player.aiDirection = 0;
				}
			}
		} else {
			player.aiDirection = 0;
		}
	}

	// E. 處理踏空與自動掉落：若目前不在跳躍中，檢查腳下高度是否改變
	if (!player.isJumping) {
		const footY = getPlatformYAt(player.x);
		// 若腳下變低（數值變大），表示踏空，開始掉落
		if (footY > player.y + 1) {
			player.isJumping = true;
			// 從靜止開始下落
			player.yVelocity = 0;
			player.state = 'jump';
		}
		// 若腳下變高，嘗試自動踏上小台階（高度差上限 20px）
		else if (footY < player.y - 1) {
			const diff = player.y - footY;
			// 放寬自動踏階閾值，允許較高的小台階自動踏上
			if (diff <= 30) {
				player.y = footY;
				player.isJumping = false;
				player.yVelocity = 0;
			}
		}
	}

    // C. 狀態轉換
    const is3cInDialog = (player.key === "3c" && dialogState !== 'IDLE');

    if (player.isJumping) {
        player.state = "jump";
    } else if (player.isShooting && player.key === "1c") {
        player.state = "shoot";
    } else if (keyIsDown(controls.run) && moving) {
        player.state = "run";
    } else if (moving) {
        player.state = "walk";
    } else if (player.state !== "smile" && player.state !== "fallen" && !is3cInDialog) {

        if (player.key === "4c" && is4cTalking) {
            player.state = "idle";
        } else {
            player.state = "idle";
        }
    }

    if (player.key === "4c" && player.state !== "idle" && player.state !== "walk" && player.state !== "run" && player.state !== "stop" && !is4cTalking) {
        player.state = "idle";
    }

	// F. 腳步聲處理 (僅針對主角 1c，避免 NPC 太多聲音吵雜)
	if (player.key === "1c" && !player.isJumping && (player.state === "walk" || player.state === "run")) {
		player.stepTimer++;
		const interval = (player.state === "run") ? 12 : 20; // 跑步時聲音頻率較快
		if (player.stepTimer >= interval) {
			player.stepTimer = 0;
			if (footstepSound) footstepSound.play();
		}
	} else {
		player.stepTimer = 15; // 重置計時器，讓下次移動時能較快響起第一聲
	}
}

// 角色轉向邏輯 (3c)
function updatePlayerOrientationForDialog(playerToUpdate, playerReference) {
    if (playerToUpdate.key === "3c") {
        if (dialogState !== 'IDLE') {
            if (playerToUpdate.x < playerReference.x) {
                playerToUpdate.facingRight = true;
            } else if (playerToUpdate.x > playerReference.x) {
                playerToUpdate.facingRight = false;
            }

            if (!playerToUpdate.isJumping &&
                !keyIsDown(playerToUpdate.controls.left) &&
                !keyIsDown(playerToUpdate.controls.right)) {

                if (dialogState === 'FEEDBACK') {
                    playerToUpdate.state = "smile";
                } else {
                    playerToUpdate.state = "idle";
                }
            }
        }
    }
}

// 碰撞偵測函式 (AABB 碰撞)
function isColliding(pA, pB) {
    const rectA = pA.getBounds();
    const rectB = pB.getBounds();

    return (
        rectA.x < rectB.x + rectB.w &&
        rectA.x + rectA.w > rectB.x &&
        rectA.y < rectB.y + rectB.h &&
        rectA.y + rectA.h > rectB.y
    );
}

// 處理 3c 的問答系統
function handleQuizDialog(p1, npc, npcKey) {
	if (!npc) return;

	// 判斷是否接觸
	const isTouching = isColliding(p1, npc);

	// 若互動 NPC 不是目前的 currentNPC 且我們處於對話中，忽略其他 NPC
	if (dialogState !== 'IDLE' && currentNPC && currentNPC !== npcKey) {
		return;
	}

	// 若與 NPC 分離且目前是在與該 NPC 對話，則重置
	if (!isTouching && dialogState !== 'IDLE' && currentNPC === npcKey) {
		if (dialogState === 'QUESTION' || dialogState === 'WAITING_ANSWER' || dialogState === 'FEEDBACK') {
			dialogState = 'IDLE';
			dialogCooldownEndTime = millis() + DIALOG_COOLDOWN_MS;
			currentQuiz = null;
			hasAnsweredWrong = false;
			currentNPC = null;
		}
	}

	let dialogText = "";

	if (dialogState === 'IDLE') {
		const isOnCooldown = millis() < dialogCooldownEndTime;
		if (isTouching && !isOnCooldown) {
			dialogText = "按 T 鍵與我對話！";
			const b = npc.getBounds(); // 取得 NPC 邊界
			pendingDialogs.push({ x: npc.x, y: b.y - 8, text: dialogText, alignment: npc.facingRight ? 'RIGHT' : 'LEFT', isQuestion: false });
		}
		return;
	}

	// 只有當 currentNPC 與此 npcKey 相符時才顯示問題/等待/回饋
	if (currentNPC !== npcKey) return;

	if (currentQuiz) {
		if (dialogState === 'QUESTION') {
			dialogText = currentQuiz.question;
			setTimeout(() => {
				if (dialogState === 'QUESTION') dialogState = 'WAITING_ANSWER';
			}, 500);

		} else if (dialogState === 'WAITING_ANSWER') {
			// 修改提示文字
			dialogText = currentQuiz.question + ` (請點擊選項作答)`;

		} else if (dialogState === 'FEEDBACK') {
			if (hasAnsweredWrong) {
				dialogText = quizResult + ' (按 Enter 繼續)';
			} else {
				dialogText = quizResult + ' (按 Enter 結束對話或 N 鍵下一題)';
			}
		}

		const b = npc.getBounds();
		const isQuestion = (dialogState === 'QUESTION' || dialogState === 'WAITING_ANSWER');
		pendingDialogs.push({ x: npc.x, y: b.y - 8, text: dialogText, alignment: npc.facingRight ? 'RIGHT' : 'LEFT', isQuestion: isQuestion });
	}
}

// 繪製對話框的輔助函式 (在世界座標中繪製)
function drawDialogBox(x, y, textContent, alignment = 'LEFT', anchor = 'center') {
	const padding = 12;
	const maxBoxW = 320;
	push();
	textSize(16);
	const lineHeight = textAscent() + textDescent() + 6;

	// 將文字做簡單換行，根據 maxBoxW 決定每行寬度
	const words = ('' + textContent).split(/\s+/);
	const lines = [];
	let cur = '';
	for (let i = 0; i < words.length; i++) {
		const w = words[i];
		const candidate = cur ? (cur + ' ' + w) : w;
		if (textWidth(candidate) + padding * 2 > maxBoxW) {
			if (cur) lines.push(cur);
			cur = w;
		} else {
			cur = candidate;
		}
	}
	if (cur) lines.push(cur);

	// 計算實際寬度與高度
	let maxLineW = 0;
	for (let l of lines) maxLineW = max(maxLineW, textWidth(l));
	const boxW = constrain(maxLineW + padding * 2, 120, maxBoxW);
	const boxH = lines.length * lineHeight + padding * 2;

	rectMode(CENTER);
	textAlign(CENTER, CENTER);

	let centerY = y;
	if (anchor === 'top') {
		// 將 y 視為角色上邊界，將對話框放在此上方
		centerY = y - boxH / 2 - 6;
	}

	fill(255, 255, 200, 240);
	stroke(0);
	strokeWeight(2);
	rect(x, centerY, boxW, boxH, 10);

	// 箭頭位置（在框底部中間偏左或偏右）
	const triY = centerY + boxH / 2;
	if (alignment === 'LEFT') {
		triangle(x - boxW / 2 + 14, triY, x - 12, triY, x - 22, triY + 10);
	} else {
		triangle(x + boxW / 2 - 14, triY, x + 12, triY, x + 22, triY + 10);
	}

	// 繪製每一行文字（從上到下）
	fill(0);
	const startY = centerY - boxH / 2 + padding + lineHeight / 2;
	for (let i = 0; i < lines.length; i++) {
		text(lines[i], x, startY + i * lineHeight);
	}
	pop();
	// 回傳對話框的資訊，供選項定位
	return { x: x, y: centerY, w: boxW, h: boxH, bottomY: centerY + boxH / 2 };
}

// ============================= 【鍵盤輸入】 =============================
function keyPressed() {
    // 第一次按鍵時，如果沒靜音且音樂沒在放，就開始循環播放
    if (bgm && !bgm.isPlaying() && !levelComplete && !isMuted) {
        try { bgm.loop(); } catch (e) { console.warn("BGM loop failed", e); }
    }

	// 若尚未開始遊戲，按空白開始
	if (!gameStarted && keyCode === 32) {
		// 空白鍵預設開始第一關
		startGame(1);
		return false;
	}
	
	if (isGameOver) return false;

	const p1 = players["1c"];
	const npcKeys = ["3c", "5c", "6c"];
	// 找出第一個存在且與 1c 相碰的 NPC
	let touchingNPC = null;
	for (let k of npcKeys) {
		if (players[k] && isColliding(p1, players[k])) { touchingNPC = k; break; }
	}
	const isOnCooldown = millis() < dialogCooldownEndTime;

    // --- M 鍵靜音/取消靜音 ---
	if (keyCode === M_KEY) {
		isMuted = !isMuted;
		if (isMuted) {
			if (bgm) bgm.stop();
		} else {
			// 取消靜音時，如果不在過關/失敗畫面，就重新播放音樂
			if (bgm && !levelComplete && !isGameOver) {
				bgm.loop();
			}
		}
		return false;
	}


    // --- E 鍵處理結束對話 (立即) ---
	if (keyCode === E_KEY) {
		if (dialogState !== 'IDLE') {
			dialogState = 'IDLE';
			currentQuiz = null;
			hasAnsweredWrong = false;
			dialogCooldownEndTime = millis() + DIALOG_COOLDOWN_MS;
			if (currentNPC && players[currentNPC]) players[currentNPC].state = 'idle';
			currentNPC = null;
			return false;
		}
	}

    // --- N 鍵處理下一題 ---
	if (keyCode === N_KEY) {
		if (dialogState === 'FEEDBACK' && currentQuiz && hasAnsweredWrong === false) {
			if (quizData.length > 0) {
				const randomIndex = floor(random(quizData.length));
				currentQuiz = quizData[randomIndex];

				dialogState = 'QUESTION';
				hasAnsweredWrong = false;
				dialogCooldownEndTime = millis();
			} else {
				dialogState = 'IDLE';
				currentQuiz = null;
				dialogCooldownEndTime = millis() + DIALOG_COOLDOWN_MS;
				currentNPC = null;
			}
			return false;
		}
	}

    // --- T 鍵觸發對話 ---
	if (keyCode === p1.controls.dialogTrigger) {
		// 如果正在與 4c (神奇橘子) 互動，且處於問答狀態
		if (is4cTalking && currentQuiz && (dialogState === 'WAITING_ANSWER' || dialogState === 'FEEDBACK')) {
			if (hintHearts > 0) {
				// 消耗愛心
				hintHearts--;
				// 觸發愛心爆炸特效 (在畫面左上角對應愛心的位置)
				// 愛心位置：x = 20 + i * 35, y = 30
				// 剛剛扣除的是第 hintHearts 顆 (index)
				explodeHeart(20 + hintHearts * 35, 30);

				// 顯示提示
				alert(`神奇橘子提示：${currentQuiz.hint}`);

				// 檢查失敗條件
				if (hintHearts === 0) {
					gameOver("愛心用盡，挑戰失敗！");
				}
			}
			return false;
		} else {
			if (touchingNPC && dialogState === 'IDLE' && !isOnCooldown && quizData.length > 0) {
				const randomIndex = floor(random(quizData.length));
				currentQuiz = quizData[randomIndex];
				dialogState = 'QUESTION';
				hasAnsweredWrong = false;
				p1.state = 'idle';
				currentNPC = touchingNPC;
				return false;
			}
		}
	}

    // --- ENTER 鍵處理對話流程 ---
    if (keyCode === ENTER || keyCode === RETURN || keyCode === 13) {
        if (dialogState === 'FEEDBACK') {
            if (hasAnsweredWrong) {
                // 答錯 -> 按 Enter -> 回到 WAITING_ANSWER (重試)
                dialogState = 'WAITING_ANSWER';
            } else {
                // 答對 (hasAnsweredWrong=false) -> 按 Enter -> 結束對話並冷卻 3 秒
                dialogState = 'IDLE';
                currentQuiz = null;
				dialogCooldownEndTime = millis() + 3000; // 3 秒冷卻
				currentNPC = null;
            }
            return false;
        }
    }

    // --- 角色控制輸入 (保持不變) ---
    // ------------------ 1c 動作 ------------------
    if (!p1.isFallen) {
        if (keyCode === p1.controls.jump && !p1.isJumping) {
            p1.isJumping = true;
            p1.yVelocity = JUMP_FORCE;
            p1.state = "jump";
            p1.animSet["jump"].currentFrame = 0;
            if (p1.isShooting) p1.isShooting = false;
            if (jumpSound) jumpSound.play();
        }
        if (keyCode === p1.controls.shoot && !p1.isShooting) {
            p1.isShooting = true;
            p1.animSet["shoot"].currentFrame = 0;
        }
        if (keyCode === p1.controls.fallen) {
            p1.isFallen = true;
            p1.state = "fallen";
            p1.animSet["fallen"].currentFrame = 0;
        }
        if (keyCode === p1.controls.smile) {
            p1.state = "smile";
            p1.animSet["smile"].currentFrame = 0;
            p1.isShooting = false;
        }
    }

    // ------------------ 3c 動作 ------------------
    if (!p3.isFallen) {
        if (keyCode === p3.controls.jump && !p3.isJumping) {
            p3.isJumping = true;
            p3.yVelocity = JUMP_FORCE;
            p3.state = "jump";
            p3.animSet["jump"].currentFrame = 0;
            if (jumpSound) jumpSound.play();
        }
    }

	// ------------------ 5c 動作 ------------------
	const p5 = players["5c"];
	if (p5 && !p5.isFallen) {
		if (keyCode === p5.controls.jump && !p5.isJumping) {
			p5.isJumping = true;
			p5.yVelocity = JUMP_FORCE;
			p5.state = "jump";
			if (p5.animSet["jump"]) p5.animSet["jump"].currentFrame = 0;
			if (jumpSound) jumpSound.play();
		}
	}

	// ------------------ 6c 動作 ------------------
	const p6 = players["6c"];
	if (p6 && !p6.isFallen) {
		if (keyCode === p6.controls.jump && !p6.isJumping) {
			p6.isJumping = true;
			p6.yVelocity = JUMP_FORCE;
			p6.state = "jump";
			if (p6.animSet["jump"]) p6.animSet["jump"].currentFrame = 0;
			if (jumpSound) jumpSound.play();
		}
	}

    // ------------------ 4c 動作 ------------------
    const p4 = players["4c"];
    if (!p4.isFallen) {
        if (keyCode === p4.controls.jump && !p4.isJumping) {
            p4.isJumping = true;
            p4.yVelocity = JUMP_FORCE;
            p4.state = "jump";
            if(p4.animSet["jump"]) p4.animSet["jump"].currentFrame = 0;
            if (jumpSound) jumpSound.play();
        }
    }

    // ESC 鍵重設倒下狀態
    if (keyCode === ESCAPE || keyCode === 27) {
        if (p1.isFallen) {
            p1.isFallen = false;
            p1.state = "idle";
            if (!p1.isJumping) p1.y = GROUND_Y;
        }
        if (p3.isFallen) {
            p3.isFallen = false;
            p3.state = "idle";
            if (!p3.isJumping) p3.y = GROUND_Y;
        }
        if (p4.isFallen) {
            p4.isFallen = false;
            p4.state = "idle";
            if (!p4.isJumping) p4.y = GROUND_Y;
        }
    }
}

// 遊戲結束處理
function gameOver(reason) {
	isGameOver = true;
	gameOverMessage = reason;
	if (bgm) bgm.rate(0.5); // 音樂變慢呈現悲傷感
	// 顯示游標
	cursor();
	
	// 產生失敗粒子特效 (灰色碎片)
	failParticles = [];
	for(let i=0; i<60; i++) {
		failParticles.push({
			x: random(width),
			y: random(-100, height/2),
			vx: random(-2, 2),
			vy: random(3, 8),
			size: random(5, 15),
			rot: random(TWO_PI),
			vRot: random(-0.1, 0.1)
		});
	}
}

function keyReleased() {
    const p1 = players["1c"];
    const p3 = players["3c"];
    const p4 = players["4c"];

    if (!p1.isJumping && p1.state !== "smile" && !p1.isShooting) {
             if (keyCode === p1.controls.left || keyCode === p1.controls.right || keyCode === p1.controls.run) {
                 if (!keyIsDown(p1.controls.left) && !keyIsDown(p1.controls.right)) {
                     p1.state = "idle";
                 }
             }
    }

    if (!p3.isJumping && p3.state !== "smile") {
             if (keyCode === p3.controls.left || keyCode === p3.controls.right || keyCode === p3.controls.run) {
                 if (!keyIsDown(p3.controls.left) && !keyIsDown(p3.controls.right)) {
                     p3.state = "idle";
                 }
             }
    }

    if (!p4.isJumping) {
        if (p4.state !== "idle" && p4.state !== "jump") {
             if (keyCode === p4.controls.left || keyCode === p4.controls.right || keyCode === p4.controls.run) {
                 if (!keyIsDown(p4.controls.left) && !keyIsDown(p4.controls.right)) {
                     p4.state = "idle";
                 }
             }
        }
    }

	// 5c 狀態回復
	if (players["5c"]) {
		const p5 = players["5c"];
		if (!p5.isJumping) {
			if (keyCode === p5.controls.left || keyCode === p5.controls.right || keyCode === p5.controls.run) {
				if (!keyIsDown(p5.controls.left) && !keyIsDown(p5.controls.right)) {
					p5.state = "idle";
				}
			}
		}
	}

	// 6c 狀態回復
	if (players["6c"]) {
		const p6 = players["6c"];
		if (!p6.isJumping) {
			if (keyCode === p6.controls.left || keyCode === p6.controls.right || keyCode === p6.controls.run) {
				if (!keyIsDown(p6.controls.left) && !keyIsDown(p6.controls.right)) {
					p6.state = "idle";
				}
			}
		}
	}
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    
    // 重新計算地面位置
    GROUND_Y = height * GROUND_Y_RATIO;
	// 重新產生平台以反映新的 GROUND_Y
	if (gameStarted) createPlatforms(LEVEL_CONFIG[currentLevel-1]);
	else createPlatforms(LEVEL_CONFIG[0]);
	// 更新 spawnY
	spawnY = getPlatformYAt(spawnX);
	for (let key in players) {
		if (!players[key].isJumping) players[key].y = getPlatformYAt(players[key].x);
	}
    
    // 窗口大小改變時，重新計算攝影機偏移量的限制
    const maxCameraX = WORLD_WIDTH - width;
    cameraOffset.x = constrain(cameraOffset.x, 0, maxCameraX);
}

// ======== 開始畫面（Game-like UI） ========
function drawStartScreen() {
	push();
	// 背景昏暗色塊 + 漸層
	noStroke();
	for (let i = 0; i < 6; i++) {
		fill(20 + i * 6, 30 + i * 8, 60 + i * 10, 180 - i * 18);
		rect(0, i * (height / 6), width, height / 6);
	}

	// 大標題
	textAlign(CENTER, CENTER);
	fill(255, 240, 200);
	stroke(40, 10, 10, 140);
	strokeWeight(6);
	textSize(56);
	text('冒險平台世界', width / 2, height * 0.20);
	noStroke();
	fill(255, 230, 150);
	textSize(18);
	text('請選擇關卡開始冒險', width / 2, height * 0.28);

	if (gameOverMessage) {
		fill(255, 100, 100);
		textSize(24);
		text(gameOverMessage, width / 2, height * 0.35);
	}

	// 角色縮圖列（若有載入影格則顯示影像，否則顯示彩色圓形）
	const chars = ['1c','3c','4c','5c','6c'];
	const rowY = height * 0.44;
	const spacing = min(120, width / (chars.length + 1));
	let cx = width / 2 - (chars.length - 1) * spacing / 2;
		for (let k of chars) {
		push();
		translate(cx, rowY);
		// 背板
		fill(30, 30, 40, 160);
		rect(0, 0, 88, 110, 10);

		// 繪製角色縮圖
			const anim = CHARACTERS[k] && CHARACTERS[k].animData && CHARACTERS[k].animData.idle;
			// 選取或快取單張 idle 縮圖：若有 frames 優先取 frames 的其中一張
			if (!startThumbs[k]) {
				if (anim && anim.frames && anim.frames.length > 0) {
					const idx = floor(random(anim.frames.length));
					startThumbs[k] = anim.frames[idx];
				} else if (anim && anim.sheet) {
					startThumbs[k] = anim.sheet;
				} else {
					startThumbs[k] = null;
				}
			}

			const thumb = startThumbs[k];
			if (thumb) {
				imageMode(CENTER);
				let img = thumb;
				let w = 64, h = 64;
				try { w = img.width || img.naturalWidth || 64; h = img.height || img.naturalHeight || 64; } catch(e) {}
				image(img, 0, -6, 64, 64);
			} else {
				noStroke();
				if (k === '1c') fill(200); else if (k === '3c') fill(150,200,255); else if (k === '4c') fill(255,200,150); else if (k==='5c') fill(200,255,200); else fill(220,200,255);
				ellipse(0, -6, 48, 48);
			}

		fill(220);
		textSize(12);
		textAlign(CENTER, TOP);
		text(CHARACTERS[k].displayName, 0, 36);
		pop();
		cx += spacing;
	}

	// 繪製 5 個關卡按鈕
	levelButtons = [];
	const btnW = 140, btnH = 50;
	const startY = height * 0.65;
	
	for (let i = 0; i < 5; i++) {
		// 排列：上排 3 個，下排 2 個
		let bx, by;
		if (i < 3) {
			bx = width / 2 + (i - 1) * (btnW + 20);
			by = startY;
		} else {
			bx = width / 2 + (i - 3 - 0.5) * (btnW + 20);
			by = startY + btnH + 20;
		}

		const isLocked = (i + 1) > maxUnlockedLevel;
		const over = mouseX > bx - btnW / 2 && mouseX < bx + btnW / 2 && mouseY > by - btnH / 2 && mouseY < by + btnH / 2;
		
		push();
		rectMode(CENTER);
		if (isLocked) {
			fill(100); stroke(60);
		} else if (over) { fill(255, 200, 80); stroke(255); }
		else { fill(220, 140, 60); stroke(100); }
		strokeWeight(2);
		rect(bx, by, btnW, btnH, 10);
		
		if (isLocked) fill(180); else fill(30);
		noStroke();
		textSize(18);
		textAlign(CENTER, CENTER);
		text(isLocked ? `第 ${i+1} 關 (鎖)` : `第 ${i+1} 關`, bx, by);
		pop();

		levelButtons.push({ x: bx - btnW/2, y: by - btnH/2, w: btnW, h: btnH, level: i + 1, locked: isLocked });
	}

	// 小說明
	fill(220);
	textSize(14);
	textAlign(CENTER, TOP);
	text('方向鍵移動 • 空白跳躍 • T 與 NPC 互動 • 找神奇橘子按 T 獲取提示', width/2, height - 40);

	pop();
}

function mousePressed() {
	// 若尚未開始遊戲，點擊開始按鈕啟動
	if (!gameStarted) {
		const mx = mouseX;
		const my = mouseY;
		for (let btn of levelButtons) {
			if (!btn.locked && mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
				startGame(btn.level);
				return false;
			}
		}
	} else if (levelComplete) {
		const mx = mouseX;
		const my = mouseY;
		// 下一關按鈕
		if (nextLevelBtnRect.w > 0 && mx >= nextLevelBtnRect.x && mx <= nextLevelBtnRect.x + nextLevelBtnRect.w &&
			my >= nextLevelBtnRect.y && my <= nextLevelBtnRect.y + nextLevelBtnRect.h) {
			startGame(currentLevel + 1);
			return false;
		}
		// 回主選單按鈕
		if (menuBtnRect.w > 0 && mx >= menuBtnRect.x && mx <= menuBtnRect.x + menuBtnRect.w &&
			my >= menuBtnRect.y && my <= menuBtnRect.y + menuBtnRect.h) {
			gameStarted = false;
			levelComplete = false;
			if (bgm) {
				bgm.stop();
				bgm.rate(1.0);
				if (!isMuted) {
					bgm.loop();
				}
			}
			return false;
		}
	} else if (isGameOver) {
		// 失敗畫面按鈕處理
		const mx = mouseX;
		const my = mouseY;
		
		// 重來一次
		if (retryBtnRect.w > 0 && mx >= retryBtnRect.x && mx <= retryBtnRect.x + retryBtnRect.w &&
			my >= retryBtnRect.y && my <= retryBtnRect.y + retryBtnRect.h) {
			startGame(currentLevel);
			return false;
		}
		
		// 回主選單
		if (failMenuBtnRect.w > 0 && mx >= failMenuBtnRect.x && mx <= failMenuBtnRect.x + failMenuBtnRect.w &&
			my >= failMenuBtnRect.y && my <= failMenuBtnRect.y + failMenuBtnRect.h) {
			gameStarted = false;
			isGameOver = false;
			gameOverMessage = ""; // 清除訊息以免在主選單重複顯示
			if (bgm) {
				bgm.stop();
				bgm.rate(1.0);
				if (!isMuted) {
					bgm.loop();
				}
			}
			return false;
		}
	} else if (gameStarted && dialogState === 'WAITING_ANSWER') {
		// 遊戲中，檢查是否點擊選項
		for (let btn of optionButtons) {
			if (mouseX >= btn.x && mouseX <= btn.x + btn.w && mouseY >= btn.y && mouseY <= btn.y + btn.h) {
				checkAnswer(btn.option);
				return false; // 阻止事件繼續傳遞
			}
		}
	}
}

// ===== 愛心與粒子系統 =====
function drawHearts() {
	push();
	// 在左上角繪製愛心
	for (let i = 0; i < MAX_HEARTS; i++) {
		const x = 20 + i * 35;
		const y = 30;
		
		push();
		// 將原點移至愛心中心 (大約在頂部凹槽下方 10px 處)，以便進行縮放
		translate(x, y + 10);
		
		if (i < hintHearts) {
			// 實心紅愛心
			if (hintHearts === 1) {
				// 剩下一顆心時：心跳縮放 + 顏色閃爍
				const beat = 1 + 0.15 * sin(frameCount * 0.25);
				scale(beat);
				
				const r = map(sin(frameCount * 0.25), -1, 1, 200, 255);
				fill(r, 0, 0);
				stroke(150, 0, 0);
			} else {
				fill(255, 50, 50);
				stroke(150, 0, 0);
			}
		} else {
			// 空心/灰色愛心 (已消耗)
			fill(50, 50, 50, 100);
			stroke(100);
		}
		strokeWeight(2);
		
		// 繪製愛心形狀 (相對於中心點 0,0)
		beginShape();
		vertex(0, -10);
		bezierVertex(-15, -25, -30, 0, 0, 15);
		bezierVertex(30, 0, 15, -25, 0, -10);
		endShape(CLOSE);
		
		pop();
	}
	pop();
}

function explodeHeart(x, y) {
	// 產生華麗的愛心爆炸粒子
	for (let i = 0; i < 30; i++) {
		heartParticles.push({
			x: x,
			y: y,
			vx: random(-5, 5),
			vy: random(-5, 5),
			size: random(4, 10),
			color: color(255, random(0, 100), random(0, 100)),
			life: 255
		});
	}
}

function drawHeartParticles() {
	for (let i = heartParticles.length - 1; i >= 0; i--) {
		let p = heartParticles[i];
		p.x += p.vx;
		p.y += p.vy;
		p.life -= 5;
		p.size *= 0.95; // 逐漸變小

		if (p.life <= 0) {
			heartParticles.splice(i, 1);
		} else {
			noStroke();
			fill(red(p.color), green(p.color), blue(p.color), p.life);
			ellipse(p.x, p.y, p.size, p.size);
		}
	}
}

// ===== Spawn 特效與粒子系統 =====
function emitSpawnBurst(count) {
	for (let i = 0; i < count; i++) {
		const a = random(TWO_PI);
		const speed = random(1.2, 4.4);
		spawnParticles.push({
			x: spawnX + cos(a) * random(4, 18),
			y: spawnY - 12 + sin(a) * random(2, 10),
			vx: cos(a) * speed * random(0.6, 1.2),
			vy: sin(a) * speed * random(0.6, 1.0) - random(0.4, 2.2),
			life: random(700, 1200),
			age: 0,
			size: random(2.5, 6.5),
			hue: random(30, 60)
		});
	}
}

function updateSpawnParticles(dt) {
	for (let i = spawnParticles.length - 1; i >= 0; i--) {
		const p = spawnParticles[i];
		p.age += dt;
		if (p.age >= p.life) { spawnParticles.splice(i, 1); continue; }
		// 簡單物理
		p.vy += 0.06; // 微重力
		p.x += p.vx;
		p.y += p.vy;
		// 緩慢阻力
		p.vx *= 0.995;
		p.vy *= 0.998;
	}
}

function drawSpawnEffect(x, y) {
	// 更新粒子（dt 以毫秒計）
	updateSpawnParticles(deltaTime || 16);

	push();
	translate(x, y);

	// 底部柔和光暈
	noStroke();
	for (let r = 40; r >= 12; r -= 8) {
		const alpha = map(r, 40, 12, 28, 120);
		fill(255, 220, 120, alpha);
		ellipse(0, -6, r * 2.2, r * 0.6);
	}

	// 環狀脈動
	const pulse = 1 + 0.2 * sin(frameCount * 0.14);
	stroke(255, 220, 120, 200);
	strokeWeight(2.4);
	noFill();
	ellipse(0, -6, 72 * pulse, 28 * pulse);
	stroke(255, 140, 80, 160);
	strokeWeight(1.2);
	ellipse(0, -6, 46 * pulse, 18 * pulse);

	// 上升光點
	noStroke();
	fill(255, 245, 200, 220);
	const bobY = -18 + sin(frameCount * 0.18) * 3;
	ellipse(0, bobY, 6 + 2 * sin(frameCount * 0.12), 6 + 2 * sin(frameCount * 0.12));

	// 粒子
	for (let p of spawnParticles) {
		const lifeRatio = 1 - p.age / p.life;
		push();
		translate(p.x - x, p.y - y);
		fill(255, 220, 140, 200 * lifeRatio);
		noStroke();
		ellipse(0, 0, p.size * lifeRatio, p.size * lifeRatio);
		pop();
	}

	// 文字標示（更柔和）
	fill(255, 245, 210, 220);
	textAlign(CENTER, BOTTOM);
	textSize(12);
	text('出生地', 0, -34);
	pop();

	// 若 burst 在短時間內，持續補充少量粒子以形成爆發感
	if (millis() - spawnBurstTime < SPAWN_BURST_DURATION) {
		if (random() < 0.8) spawnParticles.push({ x: spawnX + random(-18,18), y: spawnY - 12 + random(-6,6), vx: random(-1.6,1.6), vy: random(-3.8,-0.6), life: random(400,1000), age:0, size: random(2,5), hue: random(40,60) });
	} else {
		// 常態呼吸粒子
		if (random() < 0.02) spawnParticles.push({ x: spawnX + random(-12,12), y: spawnY - 12 + random(-4,4), vx: random(-0.6,0.6), vy: random(-1.6,-0.3), life: random(600,1400), age:0, size: random(1.8,3.2), hue: random(40,58) });
	}
}

// ===== 過關畫面 =====
function drawLevelCompleteScreen() {
	push();
	// 半透明背景
	fill(0, 0, 0, 150);
	rectMode(CORNER);
	rect(0, 0, width, height);

	// 煙火特效
	if (random() < 0.05) {
		createFirework(random(100, width - 100), random(50, height / 2));
	}
	updateAndDrawFireworks();

	textAlign(CENTER, CENTER);
	fill(255, 215, 0);
	stroke(0);
	strokeWeight(4);
	textSize(64);
	text("關卡完成！", width / 2, height * 0.3);

	fill(255);
	textSize(24);
	strokeWeight(2);
	text(`得分: ${score} / ${requiredScore}`, width / 2, height * 0.45);

	rectMode(CENTER);
	
	// 下一關按鈕 (若非最後一關)
	if (currentLevel < LEVEL_CONFIG.length) {
		const btnX = width / 2 + 80;
		const btnY = height * 0.6;
		const btnW = 140, btnH = 50;
		const over = mouseX > btnX - btnW/2 && mouseX < btnX + btnW/2 && mouseY > btnY - btnH/2 && mouseY < btnY + btnH/2;
		
		if (over) fill(100, 255, 100); else fill(50, 200, 50);
		stroke(0);
		rect(btnX, btnY, btnW, btnH, 10);
		fill(0); noStroke();
		text("下一關", btnX, btnY);
		nextLevelBtnRect = { x: btnX - btnW/2, y: btnY - btnH/2, w: btnW, h: btnH };
	} else {
		nextLevelBtnRect = { x:0, y:0, w:0, h:0 };
		fill(255, 215, 0); noStroke();
		text("恭喜通關所有關卡！", width/2, height * 0.6);
	}

	// 回主選單按鈕
	const mBtnX = (currentLevel < LEVEL_CONFIG.length) ? width / 2 - 80 : width / 2;
	const mBtnY = (currentLevel < LEVEL_CONFIG.length) ? height * 0.6 : height * 0.7;
	const mBtnW = 140, mBtnH = 50;
	const overM = mouseX > mBtnX - mBtnW/2 && mouseX < mBtnX + mBtnW/2 && mouseY > mBtnY - mBtnH/2 && mouseY < mBtnY + mBtnH/2;
	stroke(0); if (overM) fill(200); else fill(150);
	rect(mBtnX, mBtnY, mBtnW, mBtnH, 10);
	fill(0); noStroke(); text("回主選單", mBtnX, mBtnY);
	menuBtnRect = { x: mBtnX - mBtnW/2, y: mBtnY - mBtnH/2, w: mBtnW, h: mBtnH };
	pop();
}

// ===== 選擇題系統 =====
function drawQuizOptions(dialogX, dialogBottomY) {
	if (!currentQuiz || !currentQuiz.options) return;
	optionButtons = []; // 重置按鈕陣列

	const options = ['A', 'B', 'C'];
	const btnW = 280, btnH = 45, btnGap = 12;
	const startY = dialogBottomY + 20; // 在對話框下方開始繪製

	push();
	rectMode(CENTER);
	textAlign(LEFT, CENTER);
	textSize(16);

	for (let i = 0; i < options.length; i++) {
		const optKey = options[i];
		const optText = currentQuiz.options[optKey];
		if (!optText) continue; // 如果CSV中沒有該選項，則跳過

		const btnX = dialogX;
		const btnY = startY + i * (btnH + btnGap);

		const over = mouseX > btnX - btnW / 2 && mouseX < btnX + btnW / 2 &&
					 mouseY > btnY - btnH / 2 && mouseY < btnY + btnH / 2;

		// 繪製按鈕背景
		stroke(0, 80);
		strokeWeight(2);
		if (over) {
			fill(255, 255, 180); // 滑鼠懸停時的顏色
		} else {
			fill(220, 230, 255); // 預設顏色
		}
		rect(btnX, btnY, btnW, btnH, 8);

		// 繪製選項文字
		noStroke();
		fill(20);
		text(`${optKey}. ${optText}`, btnX - btnW / 2 + 15, btnY);

		// 儲存按鈕資訊以供點擊偵測
		optionButtons.push({
			x: btnX - btnW / 2, y: btnY - btnH / 2,
			w: btnW, h: btnH,
			option: optKey
		});
	}
	pop();
}

function checkAnswer(selectedOption) {
	if (!currentQuiz) return;

	const correctAnswer = currentQuiz.answer.trim();

	if (selectedOption === correctAnswer) {
		quizResult = currentQuiz.feedback_correct;
		hasAnsweredWrong = false;
		score += 1;
		if (correctSound) correctSound.play();
		// 檢查過關
		if (score >= requiredScore) {
			levelComplete = true;
			if (bgm) bgm.stop();
			if (victorySound) victorySound.play();
			if (currentLevel < LEVEL_CONFIG.length) {
				maxUnlockedLevel = max(maxUnlockedLevel, currentLevel + 1);
			}
		}
	} else {
		quizResult = currentQuiz.feedback_wrong;
		hasAnsweredWrong = true;
		if (wrongSound) wrongSound.play();

		// 答錯扣除愛心
		if (hintHearts > 0) {
			hintHearts--;
			explodeHeart(20 + hintHearts * 35, 30);
			if (hintHearts === 0) {
				gameOver("愛心用盡，挑戰失敗！");
			}
		}
	}
	dialogState = 'FEEDBACK';
	optionButtons = []; // 回答後清除選項按鈕
}

// ===== 煙火特效系統 =====
function createFirework(x, y) {
	const pCount = floor(random(30, 60));
	// 隨機亮色
	const r = random(150, 255);
	const g = random(100, 255);
	const b = random(150, 255);
	
	for (let i = 0; i < pCount; i++) {
		const angle = random(TWO_PI);
		const speed = random(2, 7);
		fireworks.push({
			x: x, y: y,
			vx: cos(angle) * speed,
			vy: sin(angle) * speed,
			alpha: 255,
			r: r, g: g, b: b
		});
	}
}

function updateAndDrawFireworks() {
	for (let i = fireworks.length - 1; i >= 0; i--) {
		let f = fireworks[i];
		f.x += f.vx;
		f.y += f.vy;
		f.vx *= 0.95; // 空氣阻力
		f.vy *= 0.95;
		f.vy += 0.15; // 重力
		f.alpha -= 3; // 淡出

		if (f.alpha <= 0) {
			fireworks.splice(i, 1);
		} else {
			noStroke();
			fill(f.r, f.g, f.b, f.alpha);
			ellipse(f.x, f.y, 4, 4);
		}
	}
}

// ===== 敵人系統 (怪鳥) =====
function createEnemies(config) {
    birdEnemies = [];
    const startGenX = 700;
    const endGenX = WORLD_WIDTH - 300;
    const totalDist = endGenX - startGenX;

    // 設定每關的怪鳥數量：第1關1隻，每關增加1隻
    const count = config.id;
    
    const segment = totalDist / count;

    for (let i = 0; i < count; i++) {
        // 在每個區段內隨機位置生成
        const rangeMin = startGenX + i * segment + segment * 0.1;
        const rangeMax = startGenX + (i + 1) * segment - segment * 0.1;
        const x = random(rangeMin, rangeMax);

        // 高度設定：低(逼跳)、中(逼蹲/繞)、高(裝飾/跳躍阻礙)
        const type = floor(random(3));
        let y = GROUND_Y - 50; 
        if (type === 1) y = GROUND_Y - 140;
        if (type === 2) y = GROUND_Y - 220;
        
        birdEnemies.push({
            x: x,
            y: y,
            startY: y,
            w: 40,
            h: 30,
            startX: x,
            range: 180, // 巡邏範圍
            speed: random(2, 4) * (random() > 0.5 ? 1 : -1),
            wingAngle: random(TWO_PI),
            wasRushing: false,
            isStunned: false, // 是否暈眩
            stunTimer: 0,     // 暈眩計時
            vy: 0             // 垂直速度 (用於掉落)
        });
    }
}

function updateAndDrawEnemies(player) {
    for (let i = birdEnemies.length - 1; i >= 0; i--) {
        let bird = birdEnemies[i];
        // 偵測與玩家距離
        let isRushing = false;

        if (bird.isStunned) {
            // 暈眩物理模擬
            bird.vy += 0.4; // 重力
            bird.y += bird.vy;
            
            // 地面碰撞
            if (bird.y > GROUND_Y - 15) {
                bird.y = GROUND_Y - 15;
                bird.vy = 0;
            }
            
            bird.stunTimer--;
            if (bird.stunTimer <= 0) {
                bird.isStunned = false;
                bird.wasRushing = false;
                bird.vy = -2; // 恢復時稍微向上飛起
            }
        } else {
            // 正常飛行邏輯
            const d = dist(player.x, player.y, bird.x, bird.y);
            const detectionRange = 180; // 偵測範圍 (縮短)

            if (d < detectionRange && !levelComplete && !isGameOver) {
                isRushing = true;
                
                // 剛開始衝刺時播放音效
                if (!bird.wasRushing) {
                    if (rushSound) rushSound.play();
                    bird.wasRushing = true;
                }
                // 發現玩家：加速衝向玩家
                const rushSpeed = 6;
                const angle = atan2(player.y - 35 - bird.y, player.x - bird.x); // 瞄準玩家中心
                bird.x += cos(angle) * rushSpeed;
                bird.y += sin(angle) * rushSpeed;

                // 更新面向
                if (player.x > bird.x) bird.speed = abs(bird.speed);
                else bird.speed = -abs(bird.speed);
            } else {
                bird.wasRushing = false;
                // 未發現玩家：維持巡邏
                bird.x += bird.speed;
                if (bird.x > bird.startX + bird.range || bird.x < bird.startX - bird.range) {
                    bird.speed *= -1;
                }
                // 緩慢回到原始高度
                if (bird.startY !== undefined) bird.y = lerp(bird.y, bird.startY, 0.05);
            }
        }
        
        // 繪製
        push();
        translate(bird.x, bird.y);
        
        if (bird.isStunned) {
            rotate(PI); // 暈眩時倒置
        } else {
            // 面向
            if (bird.speed > 0) scale(-1, 1);
        }
        
        // 翅膀動畫
        bird.wingAngle += (isRushing ? 0.6 : 0.2); // 衝刺時翅膀拍動更快
        const wingY = sin(bird.wingAngle) * 8;
        
        noStroke();
        // 身體
        fill(50); // 深灰色/黑色
        ellipse(0, 0, 40, 25);
        
        // 眼睛 (紅色，干擾感)
        if (bird.isStunned) {
            // 暈眩眼 (X)
            stroke(255); strokeWeight(2);
            line(-14, -9, -6, -1);
            line(-14, -1, -6, -9);
            noStroke();
        } else {
            if (isRushing) {
                // 衝刺時閃爍警告 (黃/紅切換)
                if (frameCount % 8 < 4) fill(255, 255, 0); else fill(255, 0, 0);
            } else {
                fill(255, 0, 0);
            }
            ellipse(-10, -5, 8, 8);
            fill(255);
            ellipse(-11, -6, 2, 2);
        }
        // 嘴
        fill(255, 200, 0);
        triangle(-20, 0, -28, -3, -20, 5);
        // 翅膀
        fill(30);
        ellipse(5, -5 + wingY, 25, 15);
        
        pop();
        
        // 碰撞偵測 (簡單矩形)
        if (!isGameOver && !levelComplete && millis() > lastDamageTime + DAMAGE_COOLDOWN && !bird.isStunned) {
            const pBounds = player.getBounds();
            // 鳥的邊界
            const bLeft = bird.x - 20;
            const bRight = bird.x + 20;
            const bTop = bird.y - 15;
            const bBottom = bird.y + 15;
            
            if (pBounds.x < bRight && pBounds.x + pBounds.w > bLeft &&
                pBounds.y < bBottom && pBounds.y + pBounds.h > bTop) {
                
				if (player.isInvincible) {
					// 無敵狀態：直接消滅怪鳥
					birdEnemies.splice(i, 1);
					explodeHeart(bird.x, bird.y); // 借用爆炸特效
					continue;
				} else if (player.hasShield) {
					// 護盾抵擋
					player.hasShield = false;
					lastDamageTime = millis(); // 給予無敵時間
					if (blockSound) blockSound.play();
					
                    // 怪鳥死亡
                    birdEnemies.splice(i, 1);
                    explodeHeart(bird.x, bird.y); // 借用爆炸特效
                    continue;
				} else {
					// 受傷
					hintHearts--;
					explodeHeart(20 + hintHearts * 35, 30);
					lastDamageTime = millis();
					if (wrongSound) wrongSound.play(); // 借用錯誤音效作為受傷回饋
					if (hintHearts <= 0) {
						gameOver("被怪鳥撞擊，挑戰失敗！");
					}
				}
            }
        }
    }
}

// ===== 護盾道具系統 =====
function createShields(config) {
	shields = [];
	// 護盾數量跟鳥數量一樣
	const count = config.id;
	
	// 從第 3 個平台開始放置，避免太靠近起點，並將剩餘平台分區段放置
	const startIndex = 3;
	
	if (platforms.length > startIndex) {
		const availableCount = platforms.length - startIndex;
		const segmentSize = availableCount / count;

		for (let i = 0; i < count; i++) {
			// 計算該區段的索引範圍
			const segStart = startIndex + floor(i * segmentSize);
			const segEnd = startIndex + floor((i + 1) * segmentSize);
			
			// 在該區段內隨機選一個平台 (若區段長度為 0 則取起點)
			let idx = (segEnd > segStart) ? floor(random(segStart, segEnd)) : segStart;
			if (idx >= platforms.length) idx = platforms.length - 1;

			const p = platforms[idx];
			if (p) {
				shields.push({
					x: p.x,
					y: p.y - 40, // 懸浮在平台上方
					w: 30,
					h: 30,
					collected: false
				});
			}
		}
	}
}

function updateAndDrawShields(player) {
	for (let i = shields.length - 1; i >= 0; i--) {
		let s = shields[i];
		if (s.collected) {
			shields.splice(i, 1);
			continue;
		}
		
		// 繪製護盾道具
		push();
		translate(s.x, s.y);
		// 懸浮動畫
		const floatY = sin(frameCount * 0.1) * 5;
		translate(0, floatY);
		
		fill(0, 255, 255, 100);
		stroke(0, 200, 255);
		strokeWeight(2);
		ellipse(0, 0, s.w, s.h);
		
		fill(0, 200, 255);
		noStroke();
		textAlign(CENTER, CENTER);
		textSize(16);
		text("S", 0, 0); // 顯示 S 代表 Shield
		pop();
		
		// 碰撞偵測 (拾取)
		if (dist(player.x, player.y - 35, s.x, s.y) < 40) {
			s.collected = true;
			player.hasShield = true;
			if (shieldSound) shieldSound.play();
		}
	}
}

// ===== 無敵星星道具系統 =====
function createStars(config) {
	stars = [];
	// 每關生成 1 個星星 (稀有道具)
	if (platforms.length > 8) {
		// 隨機選一個較後面的平台
		const idx = floor(random(5, platforms.length));
		const p = platforms[idx];
		stars.push({
			x: p.x,
			y: p.y - 40,
			w: 30,
			h: 30,
			collected: false
		});
	}
}

function updateAndDrawStars(player) {
	for (let i = stars.length - 1; i >= 0; i--) {
		let s = stars[i];
		if (s.collected) {
			stars.splice(i, 1);
			continue;
		}
		
		// 繪製星星
		push();
		translate(s.x, s.y);
		// 旋轉與懸浮
		translate(0, sin(frameCount * 0.1) * 5);
		rotate(frameCount * 0.05);
		
		fill(255, 215, 0); // 金色
		stroke(255, 100, 0);
		strokeWeight(2);
		
		// 繪製五角星
		beginShape();
		for (let a = 0; a < TWO_PI; a += TWO_PI / 5) {
			let sx = cos(a - PI/2) * 15;
			let sy = sin(a - PI/2) * 15;
			vertex(sx, sy);
			sx = cos(a - PI/2 + PI/5) * 7;
			sy = sin(a - PI/2 + PI/5) * 7;
			vertex(sx, sy);
		}
		endShape(CLOSE);
		pop();
		
		// 碰撞偵測
		if (dist(player.x, player.y - 35, s.x, s.y) < 40) {
			s.collected = true;
			player.isInvincible = true;
			player.invincibleEndTime = millis() + 10000; // 10秒無敵
			if (starSound) starSound.play();
		}
	}
}

// ===== 雲朵系統 =====
function createClouds() {
    clouds = [];
    // 分布在整個世界寬度
    for (let i = 0; i < WORLD_WIDTH; i += random(300, 600)) {
        let puffs = [];
        let numPuffs = floor(random(5, 9)); // 增加雲朵的組成部分，讓形狀更豐富
        for (let j = 0; j < numPuffs; j++) {
            puffs.push({
                dx: random(-60, 60),
                dy: random(-25, 25),
                w: random(60, 100),
                h: random(40, 70)
            });
        }
        clouds.push({
            x: i,
            y: random(50, height * 0.35),
            speed: random(0.15, 0.4),
            puffs: puffs
        });
    }
}

function updateAndDrawClouds() {
    push();
    noStroke();
    fill(255, 255, 255, 200); // 讓雲更白一點
    
    for (let c of clouds) {
        // 移動
        c.x += c.speed;
        // 循環 (當雲飄出世界右邊界一段距離後，回到左邊)
        if (c.x > WORLD_WIDTH + 150) {
            c.x = -150;
            c.y = random(50, height * 0.35);
        }
        
        // 繪製
        for (let p of c.puffs) {
            ellipse(c.x + p.dx, c.y + p.dy, p.w, p.h);
        }
    }
    pop();
}

// ===== 失敗畫面 =====
function drawGameOverScreen() {
	// 更新粒子
	for(let p of failParticles) {
		p.x += p.vx;
		p.y += p.vy;
		p.rot += p.vRot;
		if(p.y > height) p.y = -20;
	}

	push();
	// 灰暗背景
	fill(20, 0, 0, 200);
	rectMode(CORNER);
	rect(0, 0, width, height);

	// 繪製粒子 (灰色碎片)
	rectMode(CENTER);
	noStroke();
	fill(100, 100, 100, 150);
	for(let p of failParticles) {
		push();
		translate(p.x, p.y);
		rotate(p.rot);
		rect(0, 0, p.size, p.size);
		pop();
	}

	textAlign(CENTER, CENTER);
	fill(255, 80, 80);
	stroke(50, 0, 0);
	strokeWeight(4);
	textSize(64);
	text("挑戰失敗", width / 2, height * 0.35);

	fill(220);
	textSize(24);
	strokeWeight(2);
	text(gameOverMessage, width / 2, height * 0.48);

	// 按鈕
	const btnW = 160, btnH = 50;
	const retryY = height * 0.65;
	const menuY = height * 0.75;

	// 重來一次按鈕
	const overRetry = mouseX > width/2 - btnW/2 && mouseX < width/2 + btnW/2 && mouseY > retryY - btnH/2 && mouseY < retryY + btnH/2;
	stroke(0);
	if (overRetry) fill(255, 100, 100); else fill(200, 60, 60);
	rect(width/2, retryY, btnW, btnH, 10);
	fill(255); noStroke();
	text("重來一次", width/2, retryY);
	retryBtnRect = { x: width/2 - btnW/2, y: retryY - btnH/2, w: btnW, h: btnH };

	// 回主選單按鈕
	const overMenu = mouseX > width/2 - btnW/2 && mouseX < width/2 + btnW/2 && mouseY > menuY - btnH/2 && mouseY < menuY + btnH/2;
	stroke(0);
	if (overMenu) fill(180); else fill(120);
	rect(width/2, menuY, btnW, btnH, 10);
	fill(255); noStroke();
	text("回主選單", width/2, menuY);
	failMenuBtnRect = { x: width/2 - btnW/2, y: menuY - btnH/2, w: btnW, h: btnH };

	pop();
}