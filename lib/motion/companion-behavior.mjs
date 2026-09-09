/** Event-driven attention, with a supplied clock so every reaction is testable.
 * No DOM, timers, form values, storage or network. Form outcomes outrank play.
 */
export function makeCompanionBehavior(start = 0) {
  let activeAt = start, wakeUntil = start + 1200;
  let beat = "idle", beatUntil = 0, follow = "idle", followUntil = 0;
  let downAt = -1, tappedAt = -1e9, taps = 0;
  let hoverAt = -1, petAt = 0, petDistance = 0;
  let status = "idle", statusAt = start;
  let angryUntil = 0, rejected = 0;
  let choices = 0, typeAt = -1e9, typingSince = 0;
  const react = (name, now, duration, after = "idle", tail = 0) => {
    beat = name; beatUntil = now + duration;
    follow = after; followUntil = beatUntil + tail;
  };
  function activity(now) {
    if (now - activeAt > 24000) wakeUntil = now + 1200;
    activeAt = now;
  }
  return {
    activity,
    hover(on, now) {
      hoverAt = on ? now : -1;
      petDistance = 0;
      if (on) activity(now);
    },
    touch(down, now) {
      activity(now);
      if (down) {
        downAt = now;
        taps = now - tappedAt < 1800 ? Math.min(6, taps + 1) : 1;
        tappedAt = now;
        if (taps === 1) react("surprised", now, 650, "happy", 1300);
        else if (taps === 2) react("playful", now, 1100, "wink", 1200);
        else if (taps === 3) react("laughing", now, 1800, "mischievous", 1100);
        else if (taps === 4) react("starstruck", now, 1900, "wink", 1000);
        else if (taps === 5) react("dizzy", now, 1700, "embarrassed", 1200);
        else react("mischievous", now, 1600, "wink", 900);
      } else {
        if (downAt >= 0 && now - downAt > 1800) react("embarrassed", now, 850, "relieved", 1300);
        else if (downAt >= 0 && now - downAt > 850) react("shy", now, 850, "happy", 1200);
        downAt = -1;
      }
    },
    cancel() { downAt = -1; hoverAt = -1; petDistance = 0; },
    stroke(distance, speed, near, now) {
      activity(now);
      if (hoverAt >= 0) {
        if (now - petAt > 500) petDistance = 0;
        petAt = now;
        petDistance += Math.min(distance, 30);
        if (petDistance > 110) {
          react(speed > 700 ? "laughing" : "affectionate", now, 1800, "smitten", 1300);
          petDistance = 0;
        }
      } else if (near && speed > 1800 && now > beatUntil) {
        react("scared", now, 700, "curious", 1000);
      }
    },
    event(kind, now) {
      activity(now);
      if (kind === "reject") {
        rejected++;
        angryUntil = now + Math.min(2600 + (rejected - 2) * 900, 6000);
        react(rejected === 1 ? "confused" : "angry", now, rejected === 1 ? 2400 : angryUntil - now);
      } else if (kind === "correct") {
        angryUntil = 0;
        react("relieved", now, 1000, "happy", 1200);
      } else if (kind === "choice") {
        choices++;
        react(choices === 1 ? "proud" : choices === 2 ? "hopeful" : choices === 3 ? "eureka" : "determined", now, 1500);
      }
      else if (kind === "advance") react("excited", now, 1300, "listening", 700);
      else if (kind === "back") react("thinking", now, 1000);
      else if (kind === "submit") { angryUntil = 0; beatUntil = followUntil = 0; }
      else if (kind === "return") react("peekaboo", now, 2000, "wink", 1000);
      else if (kind === "milestone") react("eureka", now, 1600, "determined", 1300);
      else if (kind === "type") {
        if (now - typeAt > 1600) typingSince = now;
        typeAt = now;
      }
    },
    read(now, input) {
      if (status !== input.status) {
        status = input.status; statusAt = now;
        if (status === "success") { rejected = 0; angryUntil = 0; }
      }
      const age = now - statusAt;
      if (status === "success") return age < 3200 ? "celebrate" : age < 6200 ? "proud" : "happy";
      // Retry and correction regain attention; an old delivery error must not
      // keep the avatar sad while the visitor is already writing again.
      if (status === "error" && !input.typing) return "sad";
      if (status === "pending") return age < 4200 ? "searching" : age < 10000 ? "hopeful" : "patient";
      if (status === "busy") return age < 5000 ? "working" : "thinking";
      if (now < angryUntil && rejected > 1) return "angry";
      if (downAt >= 0 && now - downAt > 1400) return "squished";
      if (downAt >= 0 && now - downAt > 850) return "scared";
      if (now < beatUntil) return beat;
      if (now < followUntil) return follow;
      if (input.typing) {
        if (input.invalid) return "suspicious";
        const writing = now - typeAt < 1600 ? now - typingSince : 0;
        return writing > 6500 ? "determined" : writing > 2800 ? "focused" : input.longText ? "thinking" : "working";
      }
      if (now < wakeUntil) return "waking";
      if (hoverAt >= 0) {
        if (now - hoverAt > 12000 && (now - hoverAt) % 21000 > 12000) return "mesmerized";
        const held = (now - hoverAt) % 7800;
        return held < 1800 ? "curious" : held < 4200 ? "happy" : held < 5300 ? "shy" : "playful";
      }
      if (input.focused) return input.invalid ? "confused" : now - activeAt > 6500 ? "patient" : "listening";
      if (input.crowded && input.moving) return "shy";
      if (input.moving) return "curious";
      const idle = now - activeAt;
      if (idle > 70000) return "dreaming";
      if (idle > 45000) return "sleeping";
      if (idle > 38000 && idle < 42000) return "sleepy-wink";
      if (idle > 30000) return "drowsy";
      if (idle > 18000) return "bored";
      if (idle > 10000 && idle < 14000) return "searching";
      return "idle";
    },
  };
}
