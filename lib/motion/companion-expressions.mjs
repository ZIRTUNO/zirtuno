/**
 * The companion's expression vocabulary. Independently authored, normalized
 * poses for Zirtuno's liquid ring, informed by the 27 semantic eye styles and
 * 23 animation names in Bible Strong Avatar Lab. No upstream engine or data
 * is shipped. Thirteen additional eye styles and eighteen special moods extend
 * that vocabulary to 40 poses and 41 moods. Every eye uses one continuous contour.
 *
 * Width/height are pupil-radius multiples; angles are radians. Colour weights
 * are abstract: contact.css owns the palette. Scores hold poses long enough
 * to read, and the existing springs carry every transition, even interruptions.
 */
const eyes = (leftW, leftH, rightW = leftW, rightH = leftH, extra = {}) => ({
  leftW, leftH, rightW, rightH, ...extra,
});

// Special eye contours remain two apertures in the same liquid body.
// Their shape weights morph continuously from ordinary capsules.
export const SPECIAL_EYE_POSES = Object.freeze({
  "wink-left": eyes(1, .16, .52, 1.04, { arch: -.42, tilt: -.07 }),
  "wink-right": eyes(.52, 1.04, 1, .16, { arch: -.42, tilt: .07 }),
  "heart-eyes": eyes(1.12, 1.12, 1.12, 1.12, { heartL: 1, heartR: 1, eyeY: -.7 }),
  "heart-wink": eyes(1.08, 1.08, 1, .16, { heartL: 1, arch: -.25, tilt: -.09 }),
  "sparkle-eyes": eyes(1.15, 1.15, 1.15, 1.15, { starL: 1, starR: 1 }),
  "diamond-eyes": eyes(.98, 1.15, .98, 1.15, { diamondL: 1, diamondR: 1 }),
  "dizzy-stars": eyes(1.04, 1.04, 1.04, 1.04, { starL: 1, starR: 1, eyeSpin: .85, tilt: .04 }),
  "smiling-arcs": eyes(1.03, .16, 1.03, .16, { arch: -.9, eyeY: -.1 }),
  "bashful-dots": eyes(.42, .42, .42, .42, { eyeY: 3.7, tilt: -.11 }),
  "focused-lids": eyes(.8, .4, .8, .4, { leftAngle: -.12, rightAngle: .12, eyeY: -.4 }),
  "peekaboo-eye": eyes(.45, .95, .98, .14, { eyeX: -2.5, eyeY: 2.5 }),
  "dreamy-arcs": eyes(1, .15, 1, .15, { arch: .85, eyeY: 1.5, tilt: .07 }),
  "compressed-eyes": eyes(.94, .22, .94, .22, { arch: -.2 }),
});

export const EYE_POSES = Object.freeze({
  "upward-side-glance": eyes(.48, .86, .48, .86, { eyeX: 1.8, eyeY: -2.8, tilt: -.09 }),
  "downward-gaze": eyes(.5, 1.05, .5, 1.05, { eyeY: 2.5, tilt: -.08 }),
  "skeptical-right": eyes(.48, 1.02, .98, .18, { rightAngle: -.12, tilt: -.07 }),
  "small-attentive": eyes(.44, .78, .44, .78, { eyeX: 1.3, tilt: .08 }),
  "wide-downward-gaze": eyes(.98, .98, .98, .98, { eyeY: 3.8, eyeX: 1.3 }),
  "surprised-left": eyes(1.02, 1.02, .96, .96, { eyeX: -2.6, tilt: .06 }),
  "sleepy-squint": eyes(.96, .2, .96, .2, { eyeY: 1.5, tilt: .06 }),
  "angry-right": eyes(.48, .92, .48, .92, { leftAngle: -.48, rightAngle: .48, eyeX: 1.8 }),
  "curious-left": eyes(.44, .91, .44, .91, { leftAngle: .35, rightAngle: -.35, eyeX: -2 }),
  "asymmetric-down-right": eyes(.92, .92, .43, .43, { eyeX: 2, eyeY: 2.3 }),
  "attentive-left": eyes(.5, 1.1, .5, 1.1, { eyeX: -1.8, tilt: .035 }),
  "joyful-wide": eyes(.62, 1.24, .62, 1.24, { eyeY: -.7, tilt: -.055 }),
  "eyes-closed": eyes(1.03, .16, 1.03, .16, { arch: .12, eyeY: 1 }),
  "joyful-down-right": eyes(.59, 1.2, .59, 1.2, { eyeY: 2.2, eyeX: 1.6, tilt: .07 }),
  "skeptical-left": eyes(.98, .18, .5, 1.08, { leftAngle: .1, tilt: .085 }),
  "far-right-glance": eyes(.46, .8, .46, .8, { eyeX: 3.8, eyeY: -1.3 }),
  "angry-left": eyes(.43, 1, .43, 1, { leftAngle: -.4, rightAngle: .4, eyeX: -1.6 }),
  "playful-right": eyes(.45, .96, .45, .96, { leftAngle: .4, rightAngle: -.3, tilt: .11 }),
  "asymmetric-up-left": eyes(.87, .87, .43, .43, { eyeX: -1.8, eyeY: -2.4 }),
  "gentle-downward-gaze": eyes(.48, 1.06, .48, 1.06, { eyeY: 2.1, tilt: -.035 }),
  "wide-down-left": eyes(.65, 1.22, .65, 1.22, { eyeX: -2.2, eyeY: 2.5 }),
  "surprised-wide-left": eyes(1.08, 1.08, 1, 1, { eyeX: -1.1, eyeY: -1.4 }),
  "drowsy-closed": eyes(1, .14, 1, .14, { tilt: -.09, eyeY: 2.8, arch: -.1 }),
  "suspicious-right": eyes(.5, 1.03, 1.03, .16, { rightAngle: -.23, eyeX: 1.7, tilt: .09 }),
  "shy-downward": eyes(.4, .6, .42, .63, { eyeY: 4.3, eyeX: 1, tilt: .06 }),
  "angry-brows": eyes(.56, 1.14, .56, 1.14, { leftAngle: -.58, rightAngle: .58 }),
  "uneasy-left": eyes(.45, .94, .45, .94, { leftAngle: .43, rightAngle: -.43, eyeX: -1.5, tilt: -.045 }),
  ...SPECIAL_EYE_POSES,
});
export const EYE_POSE_NAMES = Object.freeze(Object.keys(EYE_POSES));
export const BASE_EYE_POSE_NAMES = Object.freeze(EYE_POSE_NAMES.filter(name => !(name in SPECIAL_EYE_POSES)));
export const SPECIAL_EYE_POSE_NAMES = Object.freeze(Object.keys(SPECIAL_EYE_POSES));

// All scores reuse this same geometry vector. Float is a small vertical bob;
// rock is rotation; tempo clocks both. No additional timer or animation loop.
const score = (params, steps) => ({ params, steps });
export const SPECIAL_MOOD_SCORES = Object.freeze({
  wink: score({ glow: .4, blush: .22, rock: .045, float: .35 }, [["joyful-wide", 280], ["wink-left", 650], ["small-attentive", 350], ["wink-right", 650]]),
  affectionate: score({ blush: .98, glow: .22, pulse: 1.2, swell: 1.05, float: .4, tempo: .8 }, [["heart-eyes", 1350], ["smiling-arcs", 600], ["heart-eyes", 1350]]),
  starstruck: score({ gold: .97, glow: .45, float: .65, rock: .04, swell: 1.03, tempo: 1.6 }, [["sparkle-eyes", 1050], ["surprised-wide-left", 650], ["sparkle-eyes", 1100]]),
  dizzy: score({ cool: .55, glow: .35, rock: .12, float: .4, tempo: 2, gaze: .25 }, [["dizzy-stars", 1300], ["asymmetric-up-left", 600], ["dizzy-stars", 1000]]),
  mischievous: score({ blush: .45, gold: .2, rock: .075, lean: .8, tempo: 1.2 }, [["wink-right", 750], ["angry-right", 550], ["playful-right", 1000]]),
  embarrassed: score({ blush: 1, glow: .15, swell: .94, gaze: .4, rock: .03, sag: .12 }, [["bashful-dots", 1000], ["eyes-closed", 650], ["shy-downward", 1100]]),
  determined: score({ cool: .2, tension: .82, crest: .32, swell: 1.01, lean: .9, pulse: .45, float: .15 }, [["focused-lids", 1400], ["attentive-left", 800], ["angry-left", 700]]),
  relieved: score({ glow: .5, cool: .15, tension: .08, swell: 1.03, pulse: 1.3, float: .25, tempo: .6 }, [["smiling-arcs", 1250], ["gentle-downward-gaze", 700], ["smiling-arcs", 1000]]),
  hopeful: score({ gold: .8, glow: .3, swell: 1.02, lean: .7, float: .2, pulse: 1.1 }, [["upward-side-glance", 1250], ["asymmetric-up-left", 950], ["joyful-wide", 1000]]),
  patient: score({ cool: .3, glow: .15, pulse: 1.1, rock: .012, tempo: .45, gaze: .7 }, [["small-attentive", 2000], ["smiling-arcs", 1300], ["gentle-downward-gaze", 1700]]),
  "sleepy-wink": score({ cool: .6, sag: .18, swell: .96, pulse: 1.3, rock: .025, tempo: .4 }, [["sleepy-squint", 800], ["peekaboo-eye", 850], ["drowsy-closed", 1200]]),
  smitten: score({ blush: 1, glow: .3, float: .35, rock: .035, swell: 1.02 }, [["heart-wink", 950], ["heart-eyes", 1200], ["bashful-dots", 750]]),
  eureka: score({ gold: .98, glow: .55, float: .8, swell: 1.05, tempo: 1.7 }, [["diamond-eyes", 350], ["sparkle-eyes", 950], ["joyful-wide", 700]]),
  squished: score({ cool: .4, tension: .7, bodyX: 1.16, bodyY: .76, swell: .98, gaze: .4, pulse: .4 }, [["compressed-eyes", 800], ["wink-right", 700], ["compressed-eyes", 1000]]),
  peekaboo: score({ blush: .45, glow: .3, float: .3, rock: .035 }, [["eyes-closed", 300], ["peekaboo-eye", 800], ["surprised-left", 650], ["wink-left", 750]]),
  focused: score({ cool: .4, tension: .66, crest: .16, pulse: .4, float: .14, tempo: 1.4 }, [["focused-lids", 1500], ["attentive-left", 850], ["skeptical-left", 750]]),
  dreaming: score({ cool: .72, glow: .3, swell: .97, pulse: 1.4, float: .65, rock: .025, tempo: .35, gaze: .08 }, [["dreamy-arcs", 2900], ["eyes-closed", 1700], ["dreamy-arcs", 2400]]),
  mesmerized: score({ cool: .4, gold: .22, glow: .4, eyeSpin: .38, gaze: .4, float: .25, tempo: .65 }, [["diamond-eyes", 1300], ["sparkle-eyes", 950], ["asymmetric-up-left", 1100]]),
});
export const MOOD_SCORES = Object.freeze({
  sleeping: score({ cool: .7, open: 1, sag: .2, swell: .94, gaze: .08, pulse: 1.7, float: .28, tempo: .4 }, [["eyes-closed", 3300], ["drowsy-closed", 3800]]),
  waking: score({ cool: .25, swell: 1.03, float: .25, pulse: 1.1 }, [["sleepy-squint", 280], ["small-attentive", 400], ["joyful-wide", 560]]),
  idle: score({ tension: .12, pulse: 1, float: .35, rock: .018, tempo: .55 }, [["upward-side-glance", 3700], ["small-attentive", 3100], ["curious-left", 2500]]),
  listening: score({ tension: .35, lean: .9, pulse: .55, float: .16 }, [["attentive-left", 2100], ["downward-gaze", 1900], ["gentle-downward-gaze", 2100]]),
  thinking: score({ cool: .48, tension: .25, pulse: .85, rock: .035, float: .22, tempo: .65 }, [["curious-left", 1400], ["skeptical-left", 1250], ["asymmetric-up-left", 1600], ["playful-right", 1250]]),
  searching: score({ cool: .3, lean: .95, gaze: 1.1, pulse: .6, rock: .025 }, [["far-right-glance", 1100], ["surprised-left", 950], ["asymmetric-up-left", 1250]]),
  working: score({ cool: .32, tension: .7, crest: .2, pulse: .6, rock: .025, float: .32, tempo: 1.7 }, [["attentive-left", 1150], ["angry-right", 850], ["gentle-downward-gaze", 1150]]),
  excited: score({ glow: .55, gold: .22, swell: 1.06, pulse: 1.3, float: .9, rock: .05, tempo: 2 }, [["joyful-wide", 750], ["wide-down-left", 650], ["playful-right", 750]]),
  bored: score({ cool: .32, sag: .2, pulse: .7, gaze: .5, rock: .02, tempo: .45 }, [["sleepy-squint", 2600], ["skeptical-left", 1400], ["drowsy-closed", 2600]]),
  suspicious: score({ gold: .32, chill: .24, tension: .4, crest: .14, pulse: .5 }, [["suspicious-right", 1350], ["skeptical-left", 1350]]),
  angry: score({ warm: .9, chill: .62, tension: .95, crest: .92, swell: .93, lean: 1.2, jitter: .32, pulse: .3, rock: .032, tempo: 2.2 }, [["angry-brows", 1250], ["angry-left", 800], ["angry-right", 800]]),
  drowsy: score({ cool: .55, sag: .15, gaze: .3, pulse: 1.3, float: .15, rock: .03, tempo: .4 }, [["sleepy-squint", 2500], ["drowsy-closed", 3000], ["small-attentive", 650]]),
  happy: score({ glow: .4, gold: .14, tension: .12, swell: 1.06, float: .45, rock: .04, tempo: 1.25 }, [["joyful-down-right", 1700], ["joyful-wide", 1500], ["playful-right", 1000]]),
  curious: score({ glow: .22, tension: .34, swell: 1.08, lean: 1.05, gaze: 1.05, pulse: 1.2, float: .25 }, [["asymmetric-down-right", 1350], ["surprised-left", 1250], ["asymmetric-up-left", 1450]]),
  confused: score({ gold: .42, cool: .15, pulse: .75, rock: .065, tempo: .9 }, [["skeptical-right", 950], ["skeptical-left", 950], ["uneasy-left", 1250]]),
  surprised: score({ glow: .6, tension: .8, swell: .95, gaze: 1.1, float: .45, pulse: 1.2 }, [["surprised-wide-left", 450], ["wide-downward-gaze", 750]]),
  proud: score({ gold: .96, glow: .22, tension: .38, swell: 1.05, sag: -.1, float: .4, rock: .025, tempo: .7 }, [["far-right-glance", 1300], ["upward-side-glance", 1450], ["joyful-wide", 1250]]),
  shy: score({ blush: .97, swell: .93, lean: -.45, gaze: .65, pulse: .8, rock: .025 }, [["shy-downward", 1500], ["upward-side-glance", 700], ["eyes-closed", 800]]),
  sad: score({ cool: .85, chill: .46, sag: .45, swell: .92, pulse: .6, gaze: .5, rock: .015, tempo: .5 }, [["uneasy-left", 1800], ["gentle-downward-gaze", 1600], ["drowsy-closed", 1300]]),
  laughing: score({ gold: .3, glow: .55, arch: -.62, pulse: 1, float: .75, rock: .055, tempo: 3.1 }, [["eyes-closed", 650], ["joyful-wide", 550], ["eyes-closed", 850]]),
  scared: score({ cool: .65, glow: .35, tension: .85, swell: .89, jitter: .35, lean: -.55, pulse: 1.4, rock: .025, tempo: 2.8 }, [["surprised-left", 650], ["surprised-wide-left", 900]]),
  playful: score({ blush: .28, glow: .3, pulse: 1, float: .6, rock: .085, tempo: 1.6 }, [["playful-right", 800], ["skeptical-right", 600], ["wide-down-left", 850], ["asymmetric-down-right", 900]]),
  celebrate: score({ gold: .95, glow: .5, swell: 1.07, pulse: 1.1, float: 1, rock: .09, tempo: 2.1 }, [["joyful-wide", 700], ["playful-right", 600], ["joyful-down-right", 800], ["eyes-closed", 700]]),
  ...SPECIAL_MOOD_SCORES,
});
export const MOOD_NAMES = Object.freeze(Object.keys(MOOD_SCORES));
export const BASE_MOOD_NAMES = Object.freeze(MOOD_NAMES.filter(name => !(name in SPECIAL_MOOD_SCORES)));
export const SPECIAL_MOOD_NAMES = Object.freeze(Object.keys(SPECIAL_MOOD_SCORES));
