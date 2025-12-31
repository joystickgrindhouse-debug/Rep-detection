import { Pose } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';

const CONFIG = {
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
    modelComplexity: 1, 
    visibilityThreshold: 0.2, // Extremely low threshold to maintain tracking
};

const STATE = {
    isCameraRunning: false,
    currentExercise: 'pushup',
    reps: 0,
    movementState: 'IDLE',
    lastFeedback: 'Get Ready',
    startTime: null, 
    landmarks: null,
};

const videoElement = document.getElementsByClassName('input_video')[0];
const canvasElement = document.getElementsByClassName('output_canvas')[0];
const canvasCtx = canvasElement.getContext('2d');
const repDisplay = document.getElementById('rep-count');
const stateDisplay = document.getElementById('feedback-state');
const messageDisplay = document.getElementById('feedback-message');
const exerciseSelector = document.getElementById('exercise-selector');
const startBtn = document.getElementById('start-btn');
const loadingOverlay = document.getElementById('loading-overlay');
const cameraStatus = document.getElementById('camera-status');

function calculateAngle(a, b, c) {
    if (!a || !b || !c) return -1;
    if (a.visibility < CONFIG.visibilityThreshold || 
        b.visibility < CONFIG.visibilityThreshold || 
        c.visibility < CONFIG.visibilityThreshold) {
        return -1; 
    }
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return angle;
}

function calculateDistance(a, b) {
    if (!a || !b) return 0;
    return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}

function updateUI() {
    if (repDisplay) repDisplay.innerText = Math.floor(STATE.reps);
}

function updateFeedbackUI() {
    if (!stateDisplay || !messageDisplay) return;
    stateDisplay.innerText = STATE.movementState;
    messageDisplay.innerText = STATE.lastFeedback;
    const colorMap = {
        'UP': '#00ff88', 'STAND': '#00ff88', 'OPEN': '#00ff88',
        'DOWN': '#ff4444', 'PLANK': '#ff4444', 'CLOSED': '#ff4444'
    };
    stateDisplay.style.color = colorMap[STATE.movementState] || '#ffffff';
}

class BaseExercise {
    constructor() {
        this.state = 'UP';
        this.reset();
    }
    reset() {
        this.state = 'UP';
        this.counter = 0;
    }
    get(landmarks, index) {
        return landmarks[index];
    }
}

class PushUp extends BaseExercise {
    update(landmarks) {
        const leftShoulder = this.get(landmarks, 11);
        const leftElbow = this.get(landmarks, 13);
        const leftWrist = this.get(landmarks, 15);
        
        const rightShoulder = this.get(landmarks, 12);
        const rightElbow = this.get(landmarks, 14);
        const rightWrist = this.get(landmarks, 16);

        const leftAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
        const rightAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);
        
        let angle = -1;
        if (leftAngle !== -1 && rightAngle !== -1) {
            angle = Math.max(leftAngle, rightAngle); 
        } else {
            angle = leftAngle !== -1 ? leftAngle : rightAngle;
        }

        if (angle === -1) return { feedback: 'Align side to camera' };
        
        // Final broad thresholds for guaranteed detection
        if (angle > 140) { // Up position (Extension) - Very forgiving
            if (this.state === 'DOWN') {
                this.state = 'UP';
                return { repIncrement: 1, state: 'UP', feedback: 'Good rep!' };
            }
            return { state: 'UP', feedback: 'Go down' };
        } 
        if (angle < 110) { // Down position (Compression) - Very forgiving
            this.state = 'DOWN';
            return { state: 'DOWN', feedback: 'Push up!' };
        }
        return { state: this.state, feedback: 'Keep going' };
    }
}

class Squats extends BaseExercise {
    update(landmarks) {
        const leftHip = this.get(landmarks, 23);
        const leftKnee = this.get(landmarks, 25);
        const leftAnkle = this.get(landmarks, 27);
        const rightHip = this.get(landmarks, 24);
        const rightKnee = this.get(landmarks, 26);
        const rightAnkle = this.get(landmarks, 28);

        const leftAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
        const rightAngle = calculateAngle(rightHip, rightKnee, rightAnkle);

        let angle = -1;
        if (leftAngle !== -1 && rightAngle !== -1) {
            angle = Math.min(leftAngle, rightAngle); 
        } else {
            angle = leftAngle !== -1 ? leftAngle : rightAngle;
        }

        if (angle === -1) return { feedback: 'Legs out of view' };
        if (angle > 145) {
            if (this.state === 'DOWN') {
                this.state = 'UP';
                return { repIncrement: 1, state: 'UP', feedback: 'Good!' };
            }
            return { state: 'UP', feedback: 'Squat down' };
        }
        if (angle < 110) {
            this.state = 'DOWN';
            return { state: 'DOWN', feedback: 'Drive up!' };
        }
        return { state: this.state, feedback: 'Lower' };
    }
}

class Plank extends BaseExercise {
    constructor() { super(); this.startTime = null; }
    reset() { this.startTime = null; }
    update(landmarks) {
        const shoulder = this.get(landmarks, 11);
        const hip = this.get(landmarks, 23);
        const ankle = this.get(landmarks, 27);
        const hipAngle = calculateAngle(shoulder, hip, ankle);
        if (hipAngle === -1) return { feedback: 'Body out of view' };
        if (hipAngle > 165) {
            if (!this.startTime) this.startTime = Date.now();
            const seconds = Math.floor((Date.now() - this.startTime) / 1000);
            STATE.reps = seconds;
            return { state: 'HOLD', feedback: 'Hold it!' };
        } else {
            this.startTime = null;
            return { state: 'FORM', feedback: 'Lower hips' };
        }
    }
}

class JumpingJacks extends BaseExercise {
    update(landmarks) {
        const leftHand = this.get(landmarks, 15);
        const rightHand = this.get(landmarks, 16);
        const leftAnkle = this.get(landmarks, 27);
        const rightAnkle = this.get(landmarks, 28);
        const nose = this.get(landmarks, 0);
        if (leftHand.visibility < CONFIG.visibilityThreshold || rightHand.visibility < CONFIG.visibilityThreshold) {
            return { feedback: 'Hands in view' };
        }
        const handsUp = leftHand.y < nose.y && rightHand.y < nose.y;
        const feetWide = calculateDistance(leftAnkle, rightAnkle) > 0.4;
        if (handsUp && feetWide) {
            this.state = 'UP';
            return { state: 'OPEN', feedback: 'Back in' };
        }
        if (!handsUp && !feetWide) {
            if (this.state === 'UP') {
                this.state = 'DOWN';
                return { repIncrement: 1, state: 'CLOSED', feedback: 'Nice!' };
            }
            return { state: 'DOWN', feedback: 'Jump!' };
        }
        return { state: this.state, feedback: 'Keep jumping' };
    }
}

class Lunge extends BaseExercise {
    update(landmarks) {
        const lKnee = calculateAngle(this.get(landmarks, 23), this.get(landmarks, 25), this.get(landmarks, 27));
        const rKnee = calculateAngle(this.get(landmarks, 24), this.get(landmarks, 26), this.get(landmarks, 28));
        if (lKnee === -1 || rKnee === -1) return { feedback: 'Show legs' };
        if (lKnee < 115 || rKnee < 115) {
            this.state = 'DOWN';
            return { state: 'DOWN', feedback: 'Up' };
        }
        if (lKnee > 145 && rKnee > 145) {
            if (this.state === 'DOWN') {
                this.state = 'UP';
                return { repIncrement: 1, state: 'UP', feedback: 'Good!' };
            }
        }
        return { state: this.state, feedback: 'Lunge' };
    }
}

class Crunches extends BaseExercise {
    update(landmarks) {
        const shoulder = this.get(landmarks, 11);
        const knee = this.get(landmarks, 25);
        const hip = this.get(landmarks, 23);
        if (shoulder.visibility < CONFIG.visibilityThreshold) return { feedback: 'Torso in view' };
        const dist = calculateDistance(shoulder, knee);
        const ref = calculateDistance(hip, knee);
        if (dist < ref * 1.3) {
            this.state = 'IN';
            return { state: 'CRUNCH', feedback: 'Down' };
        }
        if (dist > ref * 1.5 && this.state === 'IN') {
            this.state = 'OUT';
            return { repIncrement: 1, state: 'OUT', feedback: 'Crunch!' };
        }
        return { state: this.state, feedback: 'Crunch' };
    }
}

class HighKnees extends BaseExercise {
    constructor() { super(); this.lastLeg = null; }
    update(landmarks) {
        const lKnee = this.get(landmarks, 25);
        const lHip = this.get(landmarks, 23);
        const rKnee = this.get(landmarks, 26);
        const rHip = this.get(landmarks, 24);
        const lUp = lKnee.visibility > CONFIG.visibilityThreshold && lKnee.y < lHip.y - 0.08;
        const rUp = rKnee.visibility > CONFIG.visibilityThreshold && rKnee.y < rHip.y - 0.08;
        if (lUp && this.lastLeg !== 'left') {
            this.lastLeg = 'left';
            return { repIncrement: 0.5, state: 'LEFT', feedback: 'Next!' };
        }
        if (rUp && this.lastLeg !== 'right') {
            this.lastLeg = 'right';
            return { repIncrement: 0.5, state: 'RIGHT', feedback: 'Next!' };
        }
        return { state: 'RUN', feedback: 'Knees high' };
    }
}

class Burpees extends BaseExercise {
    constructor() { super(); this.step = 0; }
    reset() { this.step = 0; }
    update(landmarks) {
        const shoulder = this.get(landmarks, 11);
        const ankle = this.get(landmarks, 27);
        const isHorizontal = Math.abs(shoulder.y - ankle.y) < 0.25;
        const isVertical = shoulder.y < this.get(landmarks, 23).y && Math.abs(shoulder.x - ankle.x) < 0.25;
        if (isHorizontal && this.step === 0) {
            this.step = 1;
            return { state: 'PLANK', feedback: 'Up!' };
        }
        if (isVertical && this.step === 1) {
            this.step = 0;
            return { repIncrement: 1, state: 'STAND', feedback: 'Down!' };
        }
        return { state: this.step === 1 ? 'PLANK' : 'STAND', feedback: 'Move!' };
    }
}

class ShoulderTap extends BaseExercise {
    update(landmarks) {
        const lWrist = this.get(landmarks, 15);
        const rWrist = this.get(landmarks, 16);
        const lShoulder = this.get(landmarks, 11);
        const rShoulder = this.get(landmarks, 12);
        const lTap = calculateDistance(lWrist, rShoulder) < 0.25;
        const rTap = calculateDistance(rWrist, lShoulder) < 0.25;
        if ((lTap || rTap) && this.state !== 'TAP') {
            this.state = 'TAP';
            return { repIncrement: 0.5, feedback: 'Tap!' };
        }
        if (!lTap && !rTap) this.state = 'IDLE';
        return { feedback: 'Tap shoulders' };
    }
}

class CalfRaise extends BaseExercise {
    update(landmarks) {
        const ankle = this.get(landmarks, 27);
        if (!this.baseY) this.baseY = ankle.y;
        if (ankle.y < this.baseY - 0.03) {
            this.state = 'UP';
            return { state: 'UP', feedback: 'Down' };
        }
        if (this.state === 'UP' && ankle.y > this.baseY - 0.01) {
            this.state = 'DOWN';
            return { repIncrement: 1, state: 'DOWN', feedback: 'Up' };
        }
        return { feedback: 'Rise' };
    }
}

class RussianTwists extends BaseExercise {
    update(landmarks) {
        const lShoulder = this.get(landmarks, 11);
        const rShoulder = this.get(landmarks, 12);
        if (lShoulder.x > rShoulder.x + 0.05 && this.state !== 'LEFT') {
            this.state = 'LEFT';
            return { repIncrement: 0.5, feedback: 'Right' };
        }
        if (rShoulder.x > lShoulder.x + 0.05 && this.state !== 'RIGHT') {
            this.state = 'RIGHT';
            return { repIncrement: 0.5, feedback: 'Left' };
        }
        return { feedback: 'Twist' };
    }
}

class ExerciseEngine {
    constructor() {
        this.exercises = {
            pushup: new PushUp(),
            plankupdown: new PushUp(),
            pikepushup: new PushUp(),
            shouldertap: new ShoulderTap(),
            lunge: new Lunge(),
            glutebridge: new Squats(),
            calfraise: new CalfRaise(),
            plank: new Plank(),
            highknees: new HighKnees(),
            burpees: new Burpees(),
            mountainclimbers: new HighKnees(),
            jumpingjacks: new JumpingJacks(),
            legraises: new Crunches(),
            russiantwists: new RussianTwists(),
            crunches: new Crunches(),
            squats: new Squats(),
        };
    }
    process(landmarks) {
        const exercise = this.exercises[STATE.currentExercise];
        if (!exercise) return;
        const result = exercise.update(landmarks);
        if (result.repIncrement) {
            STATE.reps += result.repIncrement;
            updateUI();
        }
        STATE.movementState = result.state || STATE.movementState;
        STATE.lastFeedback = result.feedback || STATE.lastFeedback;
        updateFeedbackUI();
    }
    reset() {
        STATE.reps = 0;
        STATE.movementState = 'IDLE';
        STATE.lastFeedback = 'Get Ready';
        updateUI();
        updateFeedbackUI();
        Object.values(this.exercises).forEach(ex => ex.reset());
    }
}

const engine = new ExerciseEngine();
const pose = new Pose({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`});

pose.setOptions({
    modelComplexity: CONFIG.modelComplexity,
    smoothLandmarks: true,
    minDetectionConfidence: CONFIG.minDetectionConfidence,
    minTrackingConfidence: CONFIG.minTrackingConfidence
});

pose.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => {
        if (STATE.isCameraRunning) {
            await pose.send({image: videoElement});
        }
    },
    width: 640,
    height: 480
});

startBtn.addEventListener('click', () => {
    if (!STATE.isCameraRunning) startCamera();
    else stopCamera();
});

exerciseSelector.addEventListener('change', (e) => {
    STATE.currentExercise = e.target.value;
    engine.reset();
    updateUI();
});

function startCamera() {
    loadingOverlay.classList.remove('hidden');
    camera.start().then(() => {
        STATE.isCameraRunning = true;
        loadingOverlay.classList.add('hidden');
        cameraStatus.innerText = "📷 LIVE";
        cameraStatus.classList.add('active');
        startBtn.innerText = "STOP SESSION";
    }).catch(err => {
        console.error(err);
        loadingOverlay.innerHTML = "<p>Camera Error</p>";
    });
}

function stopCamera() {
    STATE.isCameraRunning = false;
    cameraStatus.innerText = "📷 OFF";
    cameraStatus.classList.remove('active');
    startBtn.innerText = "RUN SESSION";
    engine.reset();
}

function onResults(results) {
    if (!results.image) return; 
    
    canvasElement.width = videoElement.videoWidth || 640;
    canvasElement.height = videoElement.videoHeight || 480;
    
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.translate(canvasElement.width, 0);
    canvasCtx.scale(-1, 1);
    
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    
    if (results.poseLandmarks) {
        const connections = [
            [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], 
            [11, 23], [12, 24], [23, 24], 
            [23, 25], [25, 27], [24, 26], [26, 28], 
            [27, 31], [28, 32], [27, 29], [28, 30] 
        ];

        canvasCtx.strokeStyle = '#00FF88';
        canvasCtx.lineWidth = 4;
        canvasCtx.lineCap = 'round';
        canvasCtx.lineJoin = 'round';
        
        connections.forEach(([i, j]) => {
            const p1 = results.poseLandmarks[i];
            const p2 = results.poseLandmarks[j];
            if (p1 && p2 && p1.visibility > 0.1 && p2.visibility > 0.1) {
                canvasCtx.beginPath();
                canvasCtx.moveTo(p1.x * canvasElement.width, p1.y * canvasElement.height);
                canvasCtx.lineTo(p2.x * canvasElement.width, p2.y * canvasElement.height);
                canvasCtx.stroke();
            }
        });
        
        drawLandmarks(canvasCtx, results.poseLandmarks, {
            color: '#FF4444', 
            lineWidth: 1,
            radius: 3
        });

        engine.process(results.poseLandmarks);
    }
    
    canvasCtx.restore();
}

loadingOverlay.classList.add('hidden');
console.log("AI Rep Counter Pro Ready");
