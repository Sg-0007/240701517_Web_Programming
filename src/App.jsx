import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

/* ------------------------------------------------------------------ */
/* Constants and built-in exercise library                             */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "fittrack:data";
// Address of api.php. With `php -S localhost:8000` use the value below.
// With XAMPP, use something like "http://localhost/fittrack/api.php".
const API_URL = "http://localhost:8000/api.php";
const AUTH_KEY = "fittrack:auth";
const dataKey = (username) =>
  `${STORAGE_KEY}:${String(username).toLowerCase()}`;

// Calls api.php?action=... and sends the login token (if any) in a header.
function apiCall(action, token, options = {}) {
  return fetch(`${API_URL}?action=${action}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "X-Auth-Token": token } : {}),
    },
  });
}

function loadAuth() {
  try {
    const a = JSON.parse(window.localStorage.getItem(AUTH_KEY) || "null");
    if (
      a &&
      typeof a.token === "string" &&
      /^[a-f0-9]{64}$/.test(a.token) &&
      typeof a.username === "string" &&
      a.username
    )
      return a;
  } catch {
    /* ignore */
  }
  return null;
}
const SCHEMA_VERSION = 1;

const MUSCLES = [
  "Chest",
  "Back",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Legs",
  "Glutes",
  "Core",
  "Full body",
];
const EQUIPMENT = [
  "Barbell",
  "Dumbbell",
  "Machine",
  "Cable",
  "Bodyweight",
  "Kettlebell",
  "Resistance band",
  "Other",
];

const ex = (id, name, muscleGroup, equipment, instructions) => ({
  id: `b-${id}`,
  name,
  muscleGroup,
  equipment,
  instructions,
  builtIn: true,
});

const BUILT_IN = [
  // Chest
  ex(
    "bench-press",
    "Barbell bench press",
    "Chest",
    "Barbell",
    "Lie on a flat bench with feet planted. Lower the bar to mid-chest with elbows about 45 degrees from your torso, then press it back up until your arms are straight.",
  ),
  ex(
    "incline-db-press",
    "Incline dumbbell press",
    "Chest",
    "Dumbbell",
    "Set a bench to a 30 degree incline. Press the dumbbells up from shoulder level, then lower them slowly until you feel a stretch across your upper chest.",
  ),
  ex(
    "push-up",
    "Push-up",
    "Chest",
    "Bodyweight",
    "Start in a high plank with hands under your shoulders. Lower your chest to just above the floor while keeping your body in a straight line, then push back up.",
  ),
  ex(
    "cable-fly",
    "Cable fly",
    "Chest",
    "Cable",
    "Set both pulleys at chest height and step forward. With a slight bend in your elbows, bring your hands together in front of your chest, then return slowly.",
  ),
  ex(
    "machine-chest-press",
    "Machine chest press",
    "Chest",
    "Machine",
    "Adjust the seat so the handles line up with mid-chest. Press forward until your arms are almost straight, then return under control without letting the weights rest.",
  ),
  // Back
  ex(
    "pull-up",
    "Pull-up",
    "Back",
    "Bodyweight",
    "Hang from a bar with an overhand grip slightly wider than your shoulders. Pull your chest toward the bar by driving your elbows down, then lower to a full hang.",
  ),
  ex(
    "barbell-row",
    "Barbell row",
    "Back",
    "Barbell",
    "Hinge at the hips with a flat back and the bar below your knees. Row the bar to your lower ribs, squeeze your shoulder blades, then lower with control.",
  ),
  ex(
    "lat-pulldown",
    "Lat pulldown",
    "Back",
    "Cable",
    "Sit with your thighs secured under the pads. Pull the bar to your upper chest while leaning back slightly, then let it rise until your arms are fully extended.",
  ),
  ex(
    "seated-cable-row",
    "Seated cable row",
    "Back",
    "Cable",
    "Sit tall with a slight bend in your knees. Pull the handle to your stomach, keep your chest up, pause, and then extend your arms without rounding forward.",
  ),
  ex(
    "one-arm-db-row",
    "One-arm dumbbell row",
    "Back",
    "Dumbbell",
    "Support yourself with one hand and knee on a bench. Row the dumbbell toward your hip, keeping your elbow close, then lower it until your arm is straight.",
  ),
  // Shoulders
  ex(
    "overhead-press",
    "Overhead press",
    "Shoulders",
    "Barbell",
    "Stand with the bar at collarbone height. Brace your core, press the bar overhead until your arms lock out, and bring it back to your shoulders.",
  ),
  ex(
    "lateral-raise",
    "Dumbbell lateral raise",
    "Shoulders",
    "Dumbbell",
    "Stand with a dumbbell in each hand at your sides. Raise your arms out to shoulder height with a soft bend in the elbows, then lower slowly.",
  ),
  ex(
    "face-pull",
    "Face pull",
    "Shoulders",
    "Cable",
    "Set a rope attachment at upper-chest height. Pull the rope toward your face, flaring your elbows out, and squeeze your rear shoulders before returning.",
  ),
  ex(
    "arnold-press",
    "Arnold press",
    "Shoulders",
    "Dumbbell",
    "Start with dumbbells in front of your chest, palms facing you. Rotate your palms outward as you press overhead, then reverse the motion on the way down.",
  ),
  ex(
    "machine-shoulder-press",
    "Machine shoulder press",
    "Shoulders",
    "Machine",
    "Adjust the seat so the handles start at shoulder height. Press upward until your arms are nearly straight, then lower under control.",
  ),
  // Biceps
  ex(
    "barbell-curl",
    "Barbell curl",
    "Biceps",
    "Barbell",
    "Stand holding the bar with an underhand grip. Curl it to shoulder height without swinging your torso, then lower it slowly.",
  ),
  ex(
    "hammer-curl",
    "Dumbbell hammer curl",
    "Biceps",
    "Dumbbell",
    "Hold dumbbells with palms facing each other. Curl them up while keeping your elbows pinned at your sides, then lower with control.",
  ),
  ex(
    "cable-curl",
    "Cable curl",
    "Biceps",
    "Cable",
    "Face a low pulley with a straight or EZ bar. Curl the bar toward your shoulders, squeeze at the top, and lower until your arms are straight.",
  ),
  ex(
    "incline-db-curl",
    "Incline dumbbell curl",
    "Biceps",
    "Dumbbell",
    "Sit back on an incline bench with your arms hanging down. Curl both dumbbells up without moving your upper arms, then lower fully to stretch the biceps.",
  ),
  ex(
    "band-curl",
    "Resistance band curl",
    "Biceps",
    "Resistance band",
    "Stand on the middle of the band and hold the ends with palms up. Curl your hands toward your shoulders, then lower slowly to keep tension.",
  ),
  // Triceps
  ex(
    "triceps-pushdown",
    "Triceps pushdown",
    "Triceps",
    "Cable",
    "Stand at a high pulley with elbows tucked at your sides. Push the handle down until your arms are straight, then let it rise without moving your elbows.",
  ),
  ex(
    "skull-crusher",
    "Skull crusher",
    "Triceps",
    "Barbell",
    "Lie on a bench holding an EZ bar over your chest. Bend your elbows to lower the bar toward your forehead, then extend your arms back up.",
  ),
  ex(
    "bench-dip",
    "Bench dip",
    "Triceps",
    "Bodyweight",
    "Place your hands on a bench behind you with legs extended. Bend your elbows to lower your hips toward the floor, then press back up.",
  ),
  ex(
    "overhead-db-extension",
    "Overhead dumbbell extension",
    "Triceps",
    "Dumbbell",
    "Hold one dumbbell with both hands overhead. Lower it behind your head by bending your elbows, then extend your arms to return.",
  ),
  ex(
    "close-grip-bench",
    "Close-grip bench press",
    "Triceps",
    "Barbell",
    "Lie on a bench and grip the bar about shoulder-width apart. Lower it to your lower chest with elbows close to your body, then press up.",
  ),
  // Legs
  ex(
    "back-squat",
    "Back squat",
    "Legs",
    "Barbell",
    "Rest the bar across your upper back and stand with feet shoulder-width apart. Sit down and back until your thighs are at least parallel to the floor, then drive up through your heels.",
  ),
  ex(
    "romanian-deadlift",
    "Romanian deadlift",
    "Legs",
    "Barbell",
    "Hold the bar at hip level with a slight knee bend. Push your hips back while sliding the bar down your thighs, then squeeze your hamstrings to stand tall.",
  ),
  ex(
    "leg-press",
    "Leg press",
    "Legs",
    "Machine",
    "Place your feet shoulder-width apart on the platform. Lower the sled until your knees reach about 90 degrees, then press away without locking your knees.",
  ),
  ex(
    "walking-lunge",
    "Walking lunge",
    "Legs",
    "Dumbbell",
    "Hold a dumbbell in each hand. Step forward and lower your back knee toward the floor, then push through your front foot to step into the next lunge.",
  ),
  ex(
    "leg-curl",
    "Seated leg curl",
    "Legs",
    "Machine",
    "Adjust the pad above your heels. Curl your legs down and back as far as you can, then return slowly until your legs are straight.",
  ),
  ex(
    "calf-raise",
    "Standing calf raise",
    "Legs",
    "Machine",
    "Place the balls of your feet on the platform. Rise onto your toes as high as you can, pause, then lower your heels below the platform for a full stretch.",
  ),
  // Glutes
  ex(
    "hip-thrust",
    "Barbell hip thrust",
    "Glutes",
    "Barbell",
    "Rest your upper back on a bench with the bar across your hips. Drive your hips up until your body forms a straight line, squeeze your glutes, then lower.",
  ),
  ex(
    "glute-bridge",
    "Glute bridge",
    "Glutes",
    "Bodyweight",
    "Lie on your back with knees bent and feet flat. Push through your heels to lift your hips, squeeze at the top, then lower with control.",
  ),
  ex(
    "kettlebell-swing",
    "Kettlebell swing",
    "Glutes",
    "Kettlebell",
    "Hinge at the hips and swing the kettlebell between your legs. Snap your hips forward to float it to chest height, then guide it back.",
  ),
  ex(
    "cable-kickback",
    "Cable kickback",
    "Glutes",
    "Cable",
    "Attach an ankle strap to a low pulley. Keep your torso steady and kick your leg straight back, squeeze, then return slowly.",
  ),
  ex(
    "bulgarian-split-squat",
    "Bulgarian split squat",
    "Glutes",
    "Dumbbell",
    "Rest your rear foot on a bench behind you. Lower your back knee toward the floor, then drive up through your front heel.",
  ),
  // Core
  ex(
    "plank",
    "Plank",
    "Core",
    "Bodyweight",
    "Support yourself on your forearms and toes with your body in a straight line. Brace your abs and hold without letting your hips sag.",
  ),
  ex(
    "hanging-knee-raise",
    "Hanging knee raise",
    "Core",
    "Bodyweight",
    "Hang from a bar with straight arms. Lift your knees toward your chest by curling your pelvis, then lower slowly without swinging.",
  ),
  ex(
    "cable-crunch",
    "Cable crunch",
    "Core",
    "Cable",
    "Kneel below a high pulley holding the rope by your head. Crunch your ribs toward your hips, then return to the start with control.",
  ),
  ex(
    "russian-twist",
    "Russian twist",
    "Core",
    "Dumbbell",
    "Sit with knees bent and torso leaning back slightly, holding a dumbbell. Rotate your torso to tap the weight beside each hip.",
  ),
  ex(
    "dead-bug",
    "Dead bug",
    "Core",
    "Bodyweight",
    "Lie on your back with arms up and knees bent at 90 degrees. Lower the opposite arm and leg toward the floor while keeping your lower back flat, then switch sides.",
  ),
];

const BUILT_IN_IDS = new Set(BUILT_IN.map((e) => e.id));

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const LB_PER_KG = 2.20462;
const round1 = (n) => Math.round(n * 10) / 10;
function conv(value, from, to) {
  if (value === "" || value == null || Number.isNaN(Number(value)))
    return value;
  const n = Number(value);
  if (from === to) return n;
  return round1(from === "kg" ? n * LB_PER_KG : n / LB_PER_KG);
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const fmtNum = (n) =>
  Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 });
const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
function fmtDuration(sec) {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min`;
  if (m > 0) return `${m} min`;
  return `${s} s`;
}
const mmss = (sec) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  return d;
}
const intIn = (s, min, max) => {
  const t = String(s).trim();
  if (!/^\d+$/.test(t)) return null;
  const n = parseInt(t, 10);
  return n >= min && n <= max ? n : null;
};
const decIn = (s, min, max) => {
  const t = String(s).trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};
const describedBy = (id, hint, error) =>
  [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(" ") ||
  undefined;

function entryVolume(entry, unit) {
  let total = 0;
  for (const e of entry.exercises)
    for (const s of e.sets) total += conv(s.weight, entry.unit, unit) * s.reps;
  return total;
}
const entrySets = (entry) =>
  entry.exercises.reduce((n, e) => n + e.sets.length, 0);

function lastPerformance(history, exerciseId, unit) {
  for (const h of history) {
    const found = h.exercises.find((e) => e.exerciseId === exerciseId);
    if (found && found.sets.length) {
      const top = found.sets.reduce((a, b) =>
        b.weight > a.weight || (b.weight === a.weight && b.reps > a.reps)
          ? b
          : a,
      );
      return { weight: conv(top.weight, h.unit, unit), reps: top.reps };
    }
  }
  return null;
}

function personalBests(history, unit) {
  const map = new Map();
  for (const h of history)
    for (const e of h.exercises)
      for (const s of e.sets) {
        const w = conv(s.weight, h.unit, unit);
        if (!(w > 0)) continue;
        const cur = map.get(e.exerciseId);
        if (!cur || w > cur.weight || (w === cur.weight && s.reps > cur.reps))
          map.set(e.exerciseId, {
            exerciseId: e.exerciseId,
            name: e.name,
            weight: w,
            reps: s.reps,
            date: h.date,
          });
      }
  return [...map.values()].sort(
    (a, b) => Date.parse(b.date) - Date.parse(a.date),
  );
}

function buildSession(workout, unit, getExercise, history) {
  return {
    id: uid(),
    workoutId: workout.id,
    workoutName: workout.name,
    startedAt: new Date().toISOString(),
    unit,
    exercises: workout.exercises.map((we) => {
      const e = getExercise(we.exerciseId);
      const planned =
        we.weight === "" ? "" : conv(we.weight, workout.unit, unit);
      const last = lastPerformance(history, we.exerciseId, unit);
      const w = planned !== "" ? planned : last ? last.weight : "";
      return {
        exerciseId: we.exerciseId,
        name: e ? e.name : "Exercise",
        muscleGroup: e ? e.muscleGroup : "",
        restSec: we.restSec,
        sets: Array.from({ length: we.sets }, () => ({
          weight: w === "" ? "" : String(w),
          reps: String(we.reps),
          done: false,
        })),
      };
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Storage: load, validate, migrate                                    */
/* ------------------------------------------------------------------ */

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const cleanStr = (v, max) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
const numIn = (v, min, max, fallback) => {
  const n =
    typeof v === "number"
      ? v
      : typeof v === "string" && v.trim() !== ""
        ? Number(v)
        : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const validDate = (v) => typeof v === "string" && !Number.isNaN(Date.parse(v));
const validUnit = (u) => (u === "lb" ? "lb" : "kg");

const emptyData = () => ({
  version: SCHEMA_VERSION,
  unit: "kg",
  customExercises: [],
  workouts: [],
  history: [],
  activeSession: null,
});

function cleanExercise(e) {
  if (!isObj(e) || typeof e.id !== "string" || !e.id || BUILT_IN_IDS.has(e.id))
    return null;
  const name = cleanStr(e.name, 60);
  if (!name) return null;
  return {
    id: e.id,
    name,
    muscleGroup: MUSCLES.includes(e.muscleGroup) ? e.muscleGroup : "Full body",
    equipment: EQUIPMENT.includes(e.equipment) ? e.equipment : "Other",
    instructions: cleanStr(e.instructions, 600),
  };
}

function cleanWorkout(w, validIds) {
  if (!isObj(w) || typeof w.id !== "string" || !w.id) return null;
  const name = cleanStr(w.name, 60);
  if (!name) return null;
  const exercises = (Array.isArray(w.exercises) ? w.exercises : [])
    .filter((x) => isObj(x) && validIds.has(x.exerciseId))
    .map((x) => ({
      exerciseId: x.exerciseId,
      sets: Math.round(numIn(x.sets, 1, 20, 3)),
      reps: Math.round(numIn(x.reps, 1, 100, 10)),
      restSec: Math.round(numIn(x.restSec, 0, 600, 60)),
      weight:
        x.weight === "" || x.weight == null ? "" : numIn(x.weight, 0, 2000, ""),
    }));
  return { id: w.id, name, unit: validUnit(w.unit), exercises };
}

function cleanHistoryEntry(h) {
  if (!isObj(h) || typeof h.id !== "string" || !h.id || !validDate(h.date))
    return null;
  const exercises = (Array.isArray(h.exercises) ? h.exercises : [])
    .filter((e) => isObj(e) && typeof e.exerciseId === "string")
    .map((e) => ({
      exerciseId: e.exerciseId,
      name: cleanStr(e.name, 60) || "Exercise",
      sets: (Array.isArray(e.sets) ? e.sets : [])
        .filter(isObj)
        .map((s) => ({
          weight: numIn(s.weight, 0, 2000, 0),
          reps: Math.round(numIn(s.reps, 0, 1000, 0)),
        })),
    }))
    .filter((e) => e.sets.length > 0);
  if (!exercises.length) return null;
  return {
    id: h.id,
    workoutName: cleanStr(h.workoutName, 60) || "Workout",
    date: h.date,
    durationSec: Math.round(numIn(h.durationSec, 0, 172800, 0)),
    unit: validUnit(h.unit),
    exercises,
  };
}

function cleanSession(s) {
  if (!isObj(s) || typeof s.id !== "string" || !validDate(s.startedAt))
    return null;
  const exercises = (Array.isArray(s.exercises) ? s.exercises : [])
    .filter(
      (e) =>
        isObj(e) &&
        typeof e.exerciseId === "string" &&
        Array.isArray(e.sets) &&
        e.sets.length,
    )
    .map((e) => ({
      exerciseId: e.exerciseId,
      name: cleanStr(e.name, 60) || "Exercise",
      muscleGroup: cleanStr(e.muscleGroup, 30),
      restSec: Math.round(numIn(e.restSec, 0, 600, 60)),
      sets: e.sets.filter(isObj).map((x) => ({
        weight: x.weight == null ? "" : String(x.weight).slice(0, 8),
        reps: x.reps == null ? "" : String(x.reps).slice(0, 5),
        done: x.done === true,
      })),
    }))
    .filter((e) => e.sets.length);
  if (!exercises.length) return null;
  return {
    id: s.id,
    workoutId: typeof s.workoutId === "string" ? s.workoutId : "",
    workoutName: cleanStr(s.workoutName, 60) || "Workout",
    startedAt: s.startedAt,
    unit: validUnit(s.unit),
    exercises,
  };
}

function dedupe(list) {
  const seen = new Set();
  return list.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
}

// Cleans any saved object (from localStorage or the server). Unusable parts are dropped.
function sanitizeData(p) {
  if (!isObj(p)) throw new Error("Unexpected shape");
  const customExercises = dedupe(
    (Array.isArray(p.customExercises) ? p.customExercises : [])
      .map(cleanExercise)
      .filter(Boolean),
  );
  const validIds = new Set([
    ...BUILT_IN_IDS,
    ...customExercises.map((e) => e.id),
  ]);
  return {
    version: SCHEMA_VERSION,
    unit: validUnit(p.unit),
    customExercises,
    workouts: dedupe(
      (Array.isArray(p.workouts) ? p.workouts : [])
        .map((w) => cleanWorkout(w, validIds))
        .filter(Boolean),
    ),
    history: dedupe(
      (Array.isArray(p.history) ? p.history : [])
        .map(cleanHistoryEntry)
        .filter(Boolean),
    ),
    activeSession: cleanSession(p.activeSession),
  };
}

function loadData(username) {
  let raw = null;
  try {
    raw = window.localStorage.getItem(dataKey(username));
    if (!raw) return emptyData();
    return sanitizeData(JSON.parse(raw));
  } catch {
    // Keep a copy of unreadable data instead of silently overwriting it.
    try {
      if (raw) window.localStorage.setItem(`${dataKey(username)}:backup`, raw);
    } catch {
      /* ignore */
    }
    return emptyData();
  }
}

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

function reducer(state, a) {
  switch (a.type) {
    case "saveExercise": {
      const exists = state.customExercises.some((e) => e.id === a.exercise.id);
      return {
        ...state,
        customExercises: exists
          ? state.customExercises.map((e) =>
              e.id === a.exercise.id ? a.exercise : e,
            )
          : [...state.customExercises, a.exercise],
      };
    }
    case "deleteExercise":
      return {
        ...state,
        customExercises: state.customExercises.filter((e) => e.id !== a.id),
        workouts: state.workouts.map((w) => ({
          ...w,
          exercises: w.exercises.filter((x) => x.exerciseId !== a.id),
        })),
      };
    case "saveWorkout": {
      const exists = state.workouts.some((w) => w.id === a.workout.id);
      return {
        ...state,
        workouts: exists
          ? state.workouts.map((w) => (w.id === a.workout.id ? a.workout : w))
          : [...state.workouts, a.workout],
      };
    }
    case "deleteWorkout":
      return {
        ...state,
        workouts: state.workouts.filter((w) => w.id !== a.id),
      };
    case "startSession":
    case "updateSession":
      return { ...state, activeSession: a.session };
    case "discardSession":
      return { ...state, activeSession: null };
    case "finishSession":
      return {
        ...state,
        activeSession: null,
        history: [a.entry, ...state.history],
      };
    case "deleteHistory":
      return { ...state, history: state.history.filter((h) => h.id !== a.id) };
    case "setUnit":
      return { ...state, unit: validUnit(a.unit) };
    case "replace":
      return a.data;
    default:
      return state;
  }
}

const Ctx = createContext(null);
const useApp = () => useContext(Ctx);

function useNow(ms = 1000, enabled = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return undefined;
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms, enabled]);
  return now;
}

/* ------------------------------------------------------------------ */
/* Shared UI components                                                */
/* ------------------------------------------------------------------ */

function Logo({ size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="1" y="11" width="4" height="10" rx="1" fill="currentColor" />
      <rect x="6" y="7" width="4" height="18" rx="1.5" fill="currentColor" />
      <rect x="10" y="15" width="12" height="2" fill="currentColor" />
      <rect x="22" y="7" width="4" height="18" rx="1.5" fill="currentColor" />
      <rect x="27" y="11" width="4" height="10" rx="1" fill="currentColor" />
    </svg>
  );
}

function PageHeader({ title, subtitle, actions }) {
  const { navCount } = useApp();
  const ref = useRef(null);
  useEffect(() => {
    document.title = `${title} - FitTrack`;
    if (navCount > 0 && ref.current) ref.current.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);
  return (
    <div className="page-head">
      <div>
        <h1 ref={ref} tabIndex={-1}>
          {title}
        </h1>
        {subtitle && <p className="sub">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

function EmptyState({ title, children, action }) {
  return (
    <div className="empty">
      <Logo size={40} />
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}

function Field({ id, label, error, hint, children }) {
  return (
    <div className={`field${error ? " has-error" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && (
        <p className="hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="error" id={`${id}-err`}>
          {error}
        </p>
      )}
    </div>
  );
}

function Dialog({ title, onClose, children, wide }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    const prev = document.activeElement;
    if (d && !d.open) d.showModal();
    return () => {
      try {
        if (d && d.open) d.close();
      } catch {
        /* ignore */
      }
      if (prev && prev.isConnected && typeof prev.focus === "function")
        prev.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog${wide ? " wide" : ""}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="dialog-body">
        <div className="dialog-head">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Exercise form + picker                                              */
/* ------------------------------------------------------------------ */

function ExerciseForm({ exercise, onClose }) {
  const { dispatch, allExercises, notify } = useApp();
  const editing = Boolean(exercise);
  const [name, setName] = useState(exercise?.name || "");
  const [muscleGroup, setMuscle] = useState(
    exercise?.muscleGroup || MUSCLES[0],
  );
  const [equipment, setEquipment] = useState(
    exercise?.equipment || EQUIPMENT[0],
  );
  const [instructions, setInstructions] = useState(
    exercise?.instructions || "",
  );
  const [errors, setErrors] = useState({});
  const [attempt, setAttempt] = useState(0);
  const formRef = useRef(null);

  useEffect(() => {
    if (attempt > 0)
      formRef.current?.querySelector('[aria-invalid="true"]')?.focus();
  }, [attempt]);

  function submit(e) {
    e.preventDefault();
    const errs = {};
    const n = name.trim();
    if (n.length < 2) errs.name = "Enter a name with at least 2 characters.";
    else if (
      allExercises.some(
        (x) =>
          x.id !== exercise?.id && x.name.toLowerCase() === n.toLowerCase(),
      )
    )
      errs.name =
        "An exercise with this name already exists. Choose a different name.";
    if (instructions.length > 600)
      errs.instructions =
        "Shorten the instructions to 600 characters or fewer.";
    setErrors(errs);
    if (Object.keys(errs).length) {
      setAttempt((a) => a + 1);
      return;
    }
    dispatch({
      type: "saveExercise",
      exercise: {
        id: exercise?.id || uid(),
        name: n,
        muscleGroup,
        equipment,
        instructions: instructions.trim(),
      },
    });
    notify(editing ? "Exercise updated" : "Exercise added");
    onClose();
  }

  return (
    <Dialog
      title={editing ? "Edit exercise" : "Add exercise"}
      onClose={onClose}
    >
      <form ref={formRef} onSubmit={submit} noValidate className="stack">
        <Field id="ex-name" label="Exercise name" error={errors.name}>
          <input
            id="ex-name"
            type="text"
            value={name}
            maxLength={60}
            required
            autoComplete="off"
            aria-required="true"
            aria-invalid={errors.name ? "true" : undefined}
            aria-describedby={describedBy("ex-name", false, errors.name)}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <div className="two-col">
          <Field id="ex-muscle" label="Muscle group">
            <select
              id="ex-muscle"
              value={muscleGroup}
              onChange={(e) => setMuscle(e.target.value)}
            >
              {MUSCLES.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Field id="ex-equip" label="Equipment">
            <select
              id="ex-equip"
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
            >
              {EQUIPMENT.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field
          id="ex-instr"
          label="Instructions (optional)"
          hint={`${instructions.length} of 600 characters`}
          error={errors.instructions}
        >
          <textarea
            id="ex-instr"
            value={instructions}
            rows={5}
            aria-invalid={errors.instructions ? "true" : undefined}
            aria-describedby={describedBy(
              "ex-instr",
              true,
              errors.instructions,
            )}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </Field>
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            {editing ? "Save changes" : "Add exercise"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function filterExercises(list, { q, muscle, equipment }) {
  const needle = q.trim().toLowerCase();
  return list.filter(
    (e) =>
      (muscle === "All" || e.muscleGroup === muscle) &&
      (equipment === "All" || e.equipment === equipment) &&
      (!needle ||
        `${e.name} ${e.equipment} ${e.muscleGroup}`
          .toLowerCase()
          .includes(needle)),
  );
}

function groupByMuscle(list) {
  return MUSCLES.map((m) => [
    m,
    list
      .filter((e) => e.muscleGroup === m)
      .sort((a, b) => a.name.localeCompare(b.name)),
  ]).filter(([, items]) => items.length > 0);
}

function ExercisePicker({ existingIds, onAdd, onClose }) {
  const { allExercises } = useApp();
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState("All");
  const [picked, setPicked] = useState(() => new Set());
  const groups = groupByMuscle(
    filterExercises(allExercises, { q, muscle, equipment: "All" }),
  );

  const toggle = (id) =>
    setPicked((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  return (
    <Dialog title="Add exercises" onClose={onClose} wide>
      <div className="two-col">
        <Field id="pick-q" label="Search exercises">
          <input
            id="pick-q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoComplete="off"
          />
        </Field>
        <Field id="pick-m" label="Muscle group">
          <select
            id="pick-m"
            value={muscle}
            onChange={(e) => setMuscle(e.target.value)}
          >
            <option>All</option>
            {MUSCLES.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="picker-list">
        {groups.length === 0 && (
          <p className="muted">No exercises match your search.</p>
        )}
        {groups.map(([m, items]) => (
          <fieldset key={m} className="picker-group">
            <legend>{m}</legend>
            {items.map((e) => {
              const already = existingIds.has(e.id);
              return (
                <label
                  key={e.id}
                  className={`picker-item${already ? " is-disabled" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={already || picked.has(e.id)}
                    disabled={already}
                    onChange={() => toggle(e.id)}
                  />
                  <span>
                    {e.name}
                    <span className="muted">
                      {" "}
                      ({e.equipment}
                      {already ? ", already added" : ""})
                    </span>
                  </span>
                </label>
              );
            })}
          </fieldset>
        ))}
      </div>
      <div className="dialog-actions">
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={picked.size === 0}
          onClick={() => {
            onAdd([...picked]);
            onClose();
          }}
        >
          {picked.size
            ? `Add ${plural(picked.size, "exercise")}`
            : "Add exercises"}
        </button>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Pages                                                               */
/* ------------------------------------------------------------------ */

function Dashboard() {
  const { state, historySorted, navigate, openStart, resume } = useApp();
  const unit = state.unit;
  const today = new Date();
  const ws = startOfWeek(today);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(ws);
    d.setDate(ws.getDate() + i);
    return d;
  });
  const countOn = (d) =>
    historySorted.filter(
      (h) => new Date(h.date).toDateString() === d.toDateString(),
    ).length;
  const weekEntries = historySorted.filter(
    (h) => Date.parse(h.date) >= ws.getTime(),
  );
  const weekVolume = weekEntries.reduce((n, h) => n + entryVolume(h, unit), 0);
  const s = state.activeSession;
  const total = s ? s.exercises.reduce((n, e) => n + e.sets.length, 0) : 0;
  const done = s
    ? s.exercises.reduce((n, e) => n + e.sets.filter((x) => x.done).length, 0)
    : 0;

  return (
    <>
      <PageHeader
        title="Today's training"
        subtitle={today.toLocaleDateString(undefined, {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      />

      <section className="hero" aria-labelledby="hero-title">
        {s ? (
          <>
            <h2 id="hero-title">Workout in progress: {s.workoutName}</h2>
            <p className="muted">
              {done} of {plural(total, "set")} done. Pick up right where you
              left off.
            </p>
            <div className="hero-actions">
              <button className="btn btn-primary btn-lg" onClick={resume}>
                Resume workout
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="hero-title">
              {state.workouts.length
                ? "What are we training?"
                : "Build your first workout"}
            </h2>
            <p className="muted">
              {state.workouts.length
                ? "Choose a saved workout and log every set as you go."
                : "Pick exercises from the library, set your sets and reps, then start logging."}
            </p>
            <div className="hero-actions">
              <button className="btn btn-primary btn-lg" onClick={openStart}>
                Start workout
              </button>
              <button
                className="btn btn-lg"
                onClick={() => navigate("builder")}
              >
                Create workout
              </button>
            </div>
          </>
        )}
      </section>

      <section aria-labelledby="week-title" className="section">
        <h2 id="week-title">This week</h2>
        <ol className="week" aria-label="Workouts this week">
          {days.map((d) => {
            const c = countOn(d);
            const isToday = d.toDateString() === today.toDateString();
            return (
              <li
                key={d.toISOString()}
                className={`day${c ? " has" : ""}${isToday ? " today" : ""}`}
                aria-label={`${d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}: ${
                  c ? plural(c, "workout") : "no workout"
                }${isToday ? " (today)" : ""}`}
              >
                <span className="dow" aria-hidden="true">
                  {d.toLocaleDateString(undefined, { weekday: "short" })}
                </span>
                <span className="num" aria-hidden="true">
                  {d.getDate()}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="stats-title" className="section">
        <h2 id="stats-title">Progress summary</h2>
        <div className="stats">
          <div className="stat">
            <span className="val">{weekEntries.length}</span>
            <span className="lbl">Workouts this week</span>
          </div>
          <div className="stat">
            <span className="val">{historySorted.length}</span>
            <span className="lbl">Workouts logged in total</span>
          </div>
          <div className="stat">
            <span className="val">{fmtNum(Math.round(weekVolume))}</span>
            <span className="lbl">{unit} lifted this week</span>
          </div>
        </div>
      </section>

      <section aria-labelledby="recent-title" className="section">
        <div className="row-between">
          <h2 id="recent-title">Recent workouts</h2>
          {historySorted.length > 0 && (
            <button
              className="btn btn-ghost"
              onClick={() => navigate("history")}
            >
              View all history
            </button>
          )}
        </div>
        {historySorted.length === 0 ? (
          <EmptyState
            title="No workouts logged yet"
            action={
              <button className="btn btn-primary" onClick={openStart}>
                Start workout
              </button>
            }
          >
            Finish your first session and it will show up here.
          </EmptyState>
        ) : (
          <ul className="plain-list">
            {historySorted.slice(0, 3).map((h) => (
              <li key={h.id} className="list-row">
                <div>
                  <strong>{h.workoutName}</strong>
                  <div className="muted">{fmtDate(h.date)}</div>
                </div>
                <div className="muted right">
                  {plural(entrySets(h), "set")},{" "}
                  {fmtNum(Math.round(entryVolume(h, unit)))} {unit}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function ExerciseCard({ exercise, selected, onToggle, onEdit, onDelete }) {
  return (
    <li className="ex-card">
      <div className="ex-top">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Select ${exercise.name}`}
        />
        <div>
          <h3>{exercise.name}</h3>
          <div className="badges">
            <span className="badge">{exercise.equipment}</span>
            {!exercise.builtIn && (
              <span className="badge badge-accent">Custom</span>
            )}
          </div>
        </div>
      </div>
      {!exercise.builtIn && (
        <div className="card-actions">
          <button
            className="btn btn-sm"
            onClick={onEdit}
            aria-label={`Edit ${exercise.name}`}
          >
            Edit
          </button>
          <button
            className="btn btn-sm btn-danger"
            onClick={onDelete}
            aria-label={`Delete ${exercise.name}`}
          >
            Delete
          </button>
        </div>
      )}
    </li>
  );
}

function ExercisesPage() {
  const { state, allExercises, dispatch, navigate, notify, askConfirm } =
    useApp();
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState("All");
  const [equipment, setEquipment] = useState("All");
  const [selected, setSelected] = useState(() => new Set());
  const [form, setForm] = useState(null); // null | "new" | exercise

  const groups = groupByMuscle(
    filterExercises(allExercises, { q, muscle, equipment }),
  );
  const toggle = (id) =>
    setSelected((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  function remove(e) {
    const used = state.workouts.filter((w) =>
      w.exercises.some((x) => x.exerciseId === e.id),
    ).length;
    askConfirm({
      title: `Delete "${e.name}"?`,
      message: used
        ? `This exercise will also be removed from ${plural(used, "saved workout")}. Your workout history keeps its record.`
        : "This can't be undone.",
      confirmLabel: "Delete exercise",
      danger: true,
      onConfirm: () => {
        dispatch({ type: "deleteExercise", id: e.id });
        setSelected((p) => {
          const n = new Set(p);
          n.delete(e.id);
          return n;
        });
        notify("Exercise deleted");
      },
    });
  }

  return (
    <>
      <PageHeader
        title="Exercise library"
        subtitle={`${allExercises.length} exercises, including ${plural(state.customExercises.length, "custom exercise")}.`}
        actions={
          <button className="btn btn-primary" onClick={() => setForm("new")}>
            Add exercise
          </button>
        }
      />

      <div className="filters" role="search" aria-label="Filter exercises">
        <Field id="f-q" label="Search">
          <input
            id="f-q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoComplete="off"
            placeholder="Name or equipment"
          />
        </Field>
        <Field id="f-m" label="Muscle group">
          <select
            id="f-m"
            value={muscle}
            onChange={(e) => setMuscle(e.target.value)}
          >
            <option>All</option>
            {MUSCLES.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
        <Field id="f-e" label="Equipment">
          <select
            id="f-e"
            value={equipment}
            onChange={(e) => setEquipment(e.target.value)}
          >
            <option>All</option>
            {EQUIPMENT.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          title="No exercises match"
          action={
            <button
              className="btn"
              onClick={() => {
                setQ("");
                setMuscle("All");
                setEquipment("All");
              }}
            >
              Clear filters
            </button>
          }
        >
          Try a different search, or add your own exercise.
        </EmptyState>
      ) : (
        groups.map(([m, items]) => (
          <section key={m} className="section" aria-labelledby={`g-${m}`}>
            <h2 id={`g-${m}`}>
              {m} <span className="count">{items.length}</span>
            </h2>
            <ul className="grid plain-list">
              {items.map((e) => (
                <ExerciseCard
                  key={e.id}
                  exercise={e}
                  selected={selected.has(e.id)}
                  onToggle={() => toggle(e.id)}
                  onEdit={() => setForm(e)}
                  onDelete={() => remove(e)}
                />
              ))}
            </ul>
          </section>
        ))
      )}

      {selected.size > 0 && (
        <div
          className="selection-bar"
          role="region"
          aria-label="Selected exercises"
        >
          <span>{plural(selected.size, "exercise")} selected</span>
          <div className="selection-actions">
            <button
              className="btn btn-ghost"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </button>
            <button
              className="btn btn-primary"
              onClick={() => navigate("builder", { preset: [...selected] })}
            >
              Create workout
            </button>
          </div>
        </div>
      )}

      {form && (
        <ExerciseForm
          exercise={form === "new" ? null : form}
          onClose={() => setForm(null)}
        />
      )}
    </>
  );
}

function WorkoutsPage() {
  const {
    state,
    dispatch,
    navigate,
    getExercise,
    startWorkout,
    notify,
    askConfirm,
  } = useApp();

  function remove(w) {
    askConfirm({
      title: `Delete "${w.name}"?`,
      message: "Past sessions of this workout stay in your history.",
      confirmLabel: "Delete workout",
      danger: true,
      onConfirm: () => {
        dispatch({ type: "deleteWorkout", id: w.id });
        notify("Workout deleted");
      },
    });
  }

  return (
    <>
      <PageHeader
        title="Workouts"
        subtitle="Your saved routines."
        actions={
          <button
            className="btn btn-primary"
            onClick={() => navigate("builder")}
          >
            Create workout
          </button>
        }
      />
      {state.workouts.length === 0 ? (
        <EmptyState
          title="No saved workouts yet"
          action={
            <button
              className="btn btn-primary"
              onClick={() => navigate("builder")}
            >
              Create workout
            </button>
          }
        >
          Build a routine from the exercise library and it will be saved here.
        </EmptyState>
      ) : (
        <ul className="grid plain-list">
          {state.workouts.map((w) => {
            const sets = w.exercises.reduce((n, x) => n + x.sets, 0);
            return (
              <li key={w.id} className="card workout-card">
                <h2>{w.name}</h2>
                <p className="muted">
                  {plural(w.exercises.length, "exercise")},{" "}
                  {plural(sets, "set")}
                </p>
                <ul className="mini-list">
                  {w.exercises.slice(0, 6).map((x, i) => (
                    <li key={`${x.exerciseId}-${i}`}>
                      {getExercise(x.exerciseId)?.name || "Exercise"}{" "}
                      <span className="muted">
                        {x.sets} x {x.reps}
                      </span>
                    </li>
                  ))}
                  {w.exercises.length > 6 && (
                    <li className="muted">and {w.exercises.length - 6} more</li>
                  )}
                  {w.exercises.length === 0 && (
                    <li className="muted">
                      No exercises. Edit this workout to add some.
                    </li>
                  )}
                </ul>
                <div className="card-actions">
                  <button
                    className="btn btn-primary"
                    disabled={w.exercises.length === 0}
                    onClick={() => startWorkout(w)}
                    aria-label={`Start ${w.name}`}
                  >
                    Start workout
                  </button>
                  <button
                    className="btn"
                    onClick={() => navigate("builder", { id: w.id })}
                    aria-label={`Edit ${w.name}`}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => remove(w)}
                    aria-label={`Delete ${w.name}`}
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function WorkoutBuilder({ id, preset }) {
  const { state, dispatch, navigate, getExercise, notify } = useApp();
  const existing = id ? state.workouts.find((w) => w.id === id) : null;
  const unit = state.unit;

  const [name, setName] = useState(existing?.name || "");
  const [items, setItems] = useState(() => {
    if (existing)
      return existing.exercises.map((x) => ({
        key: uid(),
        exerciseId: x.exerciseId,
        sets: String(x.sets),
        reps: String(x.reps),
        restSec: String(x.restSec),
        weight:
          x.weight === "" ? "" : String(conv(x.weight, existing.unit, unit)),
      }));
    return (preset || []).map((exerciseId) => ({
      key: uid(),
      exerciseId,
      sets: "3",
      reps: "10",
      restSec: "60",
      weight: "",
    }));
  });
  const [errors, setErrors] = useState({ rows: {} });
  const [attempt, setAttempt] = useState(0);
  const [picker, setPicker] = useState(false);
  const formRef = useRef(null);

  useEffect(() => {
    if (attempt > 0)
      formRef.current
        ?.querySelector('[aria-invalid="true"], .list-error')
        ?.focus();
  }, [attempt]);

  if (id && !existing)
    return (
      <>
        <PageHeader title="Workout not found" />
        <EmptyState
          title="This workout no longer exists"
          action={
            <button
              className="btn btn-primary"
              onClick={() => navigate("workouts")}
            >
              Back to workouts
            </button>
          }
        >
          It may have been deleted.
        </EmptyState>
      </>
    );

  const patch = (key, p) =>
    setItems((list) =>
      list.map((it) => (it.key === key ? { ...it, ...p } : it)),
    );
  const move = (i, dir) =>
    setItems((list) => {
      const n = [...list];
      [n[i], n[i + dir]] = [n[i + dir], n[i]];
      return n;
    });
  const addExercises = (ids) =>
    setItems((list) => [
      ...list,
      ...ids.map((exerciseId) => ({
        key: uid(),
        exerciseId,
        sets: "3",
        reps: "10",
        restSec: "60",
        weight: "",
      })),
    ]);

  function submit(e) {
    e.preventDefault();
    const errs = { rows: {} };
    const n = name.trim();
    if (n.length < 2)
      errs.name = "Enter a workout name with at least 2 characters.";
    if (items.length === 0)
      errs.list = "Add at least one exercise to save this workout.";
    const clean = [];
    items.forEach((it) => {
      const r = {};
      const sets = intIn(it.sets, 1, 20);
      const reps = intIn(it.reps, 1, 100);
      const rest = intIn(it.restSec, 0, 600);
      const weight = it.weight.trim() === "" ? "" : decIn(it.weight, 0, 2000);
      if (sets === null) r.sets = "Enter 1 to 20.";
      if (reps === null) r.reps = "Enter 1 to 100.";
      if (rest === null) r.restSec = "Enter 0 to 600.";
      if (weight === null) r.weight = "Enter 0 or more.";
      if (Object.keys(r).length) errs.rows[it.key] = r;
      else
        clean.push({
          exerciseId: it.exerciseId,
          sets,
          reps,
          restSec: rest,
          weight,
        });
    });
    setErrors(errs);
    if (errs.name || errs.list || Object.keys(errs.rows).length) {
      setAttempt((a) => a + 1);
      return;
    }
    dispatch({
      type: "saveWorkout",
      workout: { id: existing?.id || uid(), name: n, unit, exercises: clean },
    });
    notify(existing ? "Workout updated" : "Workout saved");
    navigate("workouts");
  }

  return (
    <>
      <PageHeader
        title={existing ? "Edit workout" : "Create workout"}
        subtitle="Choose exercises and set your targets."
      />
      <form ref={formRef} onSubmit={submit} noValidate className="stack">
        <Field id="w-name" label="Workout name" error={errors.name}>
          <input
            id="w-name"
            type="text"
            value={name}
            maxLength={60}
            required
            aria-required="true"
            autoComplete="off"
            placeholder="Push day"
            aria-invalid={errors.name ? "true" : undefined}
            aria-describedby={describedBy("w-name", false, errors.name)}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <section aria-labelledby="w-ex-title" className="stack">
          <div className="row-between">
            <h2 id="w-ex-title">Exercises ({items.length})</h2>
            <button
              type="button"
              className="btn"
              onClick={() => setPicker(true)}
            >
              Add exercises
            </button>
          </div>
          {errors.list && (
            <p className="error list-error" role="alert" tabIndex={-1}>
              {errors.list}
            </p>
          )}
          {items.length === 0 ? (
            <EmptyState title="No exercises added yet">
              Use "Add exercises" to pick from the library.
            </EmptyState>
          ) : (
            <ol className="plain-list stack">
              {items.map((it, i) => {
                const e = getExercise(it.exerciseId);
                const er = errors.rows[it.key] || {};
                const nm = e ? e.name : "Exercise";
                return (
                  <li key={it.key} className="card build-row">
                    <div className="row-between">
                      <div>
                        <h3>{nm}</h3>
                        <span className="muted">
                          {e ? `${e.muscleGroup}, ${e.equipment}` : ""}
                        </span>
                      </div>
                      <div className="row-tools">
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={i === 0}
                          onClick={() => move(i, -1)}
                          aria-label={`Move ${nm} up`}
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={i === items.length - 1}
                          onClick={() => move(i, 1)}
                          aria-label={`Move ${nm} down`}
                        >
                          Down
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() =>
                            setItems((l) => l.filter((x) => x.key !== it.key))
                          }
                          aria-label={`Remove ${nm}`}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <div className="four-col">
                      {[
                        ["sets", "Sets", "numeric"],
                        ["reps", "Reps", "numeric"],
                        ["restSec", "Rest (sec)", "numeric"],
                        ["weight", `Weight (${unit}), optional`, "decimal"],
                      ].map(([field, label, mode]) => (
                        <Field
                          key={field}
                          id={`${it.key}-${field}`}
                          label={label}
                          error={er[field]}
                        >
                          <input
                            id={`${it.key}-${field}`}
                            type="number"
                            inputMode={mode}
                            min="0"
                            step={field === "weight" ? "any" : "1"}
                            value={it[field]}
                            aria-invalid={er[field] ? "true" : undefined}
                            aria-describedby={describedBy(
                              `${it.key}-${field}`,
                              false,
                              er[field],
                            )}
                            onChange={(ev) =>
                              patch(it.key, { [field]: ev.target.value })
                            }
                          />
                        </Field>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <div className="form-actions">
          <button
            type="button"
            className="btn"
            onClick={() => navigate("workouts")}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            {existing ? "Save changes" : "Save workout"}
          </button>
        </div>
      </form>
      {picker && (
        <ExercisePicker
          existingIds={new Set(items.map((i) => i.exerciseId))}
          onAdd={addExercises}
          onClose={() => setPicker(false)}
        />
      )}
    </>
  );
}

function SessionPage() {
  const { state, dispatch, notify, navigate, askConfirm, historySorted } =
    useApp();
  const s = state.activeSession;
  useNow(1000, Boolean(s));
  const [rest, setRest] = useState(null); // { until, name }

  if (!s)
    return (
      <>
        <PageHeader title="Workout session" />
        <EmptyState
          title="No workout in progress"
          action={
            <button
              className="btn btn-primary"
              onClick={() => navigate("workouts")}
            >
              Choose a workout
            </button>
          }
        >
          Pick a saved workout to start logging your sets.
        </EmptyState>
      </>
    );

  const save = (next) => dispatch({ type: "updateSession", session: next });
  const patchSet = (ei, si, p) =>
    save({
      ...s,
      exercises: s.exercises.map((e, i) =>
        i !== ei
          ? e
          : {
              ...e,
              sets: e.sets.map((x, j) => (j !== si ? x : { ...x, ...p })),
            },
      ),
    });
  const setAll = (ei, done) =>
    save({
      ...s,
      exercises: s.exercises.map((e, i) =>
        i !== ei ? e : { ...e, sets: e.sets.map((x) => ({ ...x, done })) },
      ),
    });

  function toggleDone(ei, si, done) {
    patchSet(ei, si, { done });
    const e = s.exercises[ei];
    if (done && e.restSec > 0)
      setRest({ until: Date.now() + e.restSec * 1000, name: e.name });
  }
  function addSet(ei) {
    save({
      ...s,
      exercises: s.exercises.map((e, i) => {
        if (i !== ei) return e;
        const last = e.sets[e.sets.length - 1];
        return {
          ...e,
          sets: [
            ...e.sets,
            { weight: last.weight, reps: last.reps, done: false },
          ],
        };
      }),
    });
  }
  function removeSet(ei, si) {
    save({
      ...s,
      exercises: s.exercises.map((e, i) =>
        i !== ei ? e : { ...e, sets: e.sets.filter((_, j) => j !== si) },
      ),
    });
  }

  const total = s.exercises.reduce((n, e) => n + e.sets.length, 0);
  const done = s.exercises.reduce(
    (n, e) => n + e.sets.filter((x) => x.done).length,
    0,
  );
  const elapsed = Math.floor((Date.now() - Date.parse(s.startedAt)) / 1000);
  const remaining = rest
    ? Math.max(0, Math.ceil((rest.until - Date.now()) / 1000))
    : 0;

  function doFinish() {
    const entry = {
      id: uid(),
      workoutName: s.workoutName,
      date: new Date().toISOString(),
      durationSec: elapsed,
      unit: s.unit,
      exercises: s.exercises
        .map((e) => ({
          exerciseId: e.exerciseId,
          name: e.name,
          sets: e.sets
            .filter((x) => x.done)
            .map((x) => ({
              weight: Math.max(0, parseFloat(x.weight) || 0),
              reps: Math.max(0, parseInt(x.reps, 10) || 0),
            })),
        }))
        .filter((e) => e.sets.length),
    };
    dispatch({ type: "finishSession", entry });
    notify("Workout saved to history");
    navigate("history", { highlight: entry.id });
  }
  function finish() {
    if (done === 0) {
      notify("Mark at least one set as done before finishing.", "error");
      return;
    }
    if (done < total)
      askConfirm({
        title: "Finish with unfinished sets?",
        message: `${plural(total - done, "set")} not marked done will not be saved.`,
        confirmLabel: "Finish and save",
        onConfirm: doFinish,
      });
    else doFinish();
  }
  function discard() {
    askConfirm({
      title: "Discard this workout?",
      message: "Everything you logged in this session will be lost.",
      confirmLabel: "Discard workout",
      danger: true,
      onConfirm: () => {
        dispatch({ type: "discardSession" });
        notify("Workout discarded");
        navigate("dashboard");
      },
    });
  }

  return (
    <>
      <PageHeader
        title={s.workoutName}
        subtitle={`Started at ${fmtTime(s.startedAt)}, elapsed ${mmss(elapsed)}`}
        actions={
          <>
            <button className="btn btn-danger" onClick={discard}>
              Discard
            </button>
            <button className="btn btn-primary" onClick={finish}>
              Finish workout
            </button>
          </>
        }
      />

      <div className="progress-wrap">
        <div className="row-between">
          <span>
            <strong>{done}</strong> of {plural(total, "set")} done
          </span>
          <span className="muted">Weights in {s.unit}</span>
        </div>
        <div
          className="track"
          role="progressbar"
          aria-label="Workout progress"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
        >
          <div
            className="fill"
            style={{ width: `${total ? (done / total) * 100 : 0}%` }}
          />
        </div>
      </div>

      {rest && (
        <div className="rest" role="group" aria-label="Rest timer">
          <span className="sr-only" role="status">
            {remaining === 0 ? "Rest finished." : "Rest timer started."}
          </span>
          <div>
            <div className="muted">
              {remaining === 0 ? "Rest finished" : `Rest after ${rest.name}`}
            </div>
            <div className="rest-time">
              {remaining === 0 ? "Go" : mmss(remaining)}
            </div>
          </div>
          <button className="btn btn-sm" onClick={() => setRest(null)}>
            {remaining === 0 ? "Dismiss" : "Skip rest"}
          </button>
        </div>
      )}

      <div className="stack">
        {s.exercises.map((e, ei) => {
          const allDone = e.sets.every((x) => x.done);
          const last = lastPerformance(historySorted, e.exerciseId, s.unit);
          return (
            <section
              key={`${e.exerciseId}-${ei}`}
              className={`card session-ex${allDone ? " is-complete" : ""}`}
              aria-labelledby={`se-${ei}`}
            >
              <div className="row-between">
                <div>
                  <h2 id={`se-${ei}`}>{e.name}</h2>
                  <span className="muted">
                    {e.muscleGroup}
                    {last
                      ? `${e.muscleGroup ? ", " : ""}last time: ${fmtNum(last.weight)} ${s.unit} x ${last.reps}`
                      : ""}
                  </span>
                </div>
                {allDone ? (
                  <div className="row-tools">
                    <span className="badge badge-accent">Complete</span>
                    <button
                      className="btn btn-sm"
                      onClick={() => setAll(ei, false)}
                      aria-label={`Reopen ${e.name}`}
                    >
                      Reopen
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn btn-sm"
                    onClick={() => setAll(ei, true)}
                    aria-label={`Mark all sets of ${e.name} done`}
                  >
                    Complete exercise
                  </button>
                )}
              </div>
              <div className="sets">
                <div className="set-row set-head" aria-hidden="true">
                  <span>Set</span>
                  <span>Weight ({s.unit})</span>
                  <span>Reps</span>
                  <span>Done</span>
                  <span />
                </div>
                {e.sets.map((x, si) => (
                  <div
                    className={`set-row${x.done ? " is-done" : ""}`}
                    key={si}
                  >
                    <span className="set-n">{si + 1}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={x.weight}
                      aria-label={`${e.name}, set ${si + 1}, weight in ${s.unit}`}
                      onChange={(ev) =>
                        patchSet(ei, si, { weight: ev.target.value })
                      }
                    />
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      step="1"
                      value={x.reps}
                      aria-label={`${e.name}, set ${si + 1}, reps`}
                      onChange={(ev) =>
                        patchSet(ei, si, { reps: ev.target.value })
                      }
                    />
                    <label className="done-box">
                      <input
                        type="checkbox"
                        checked={x.done}
                        onChange={(ev) => toggleDone(ei, si, ev.target.checked)}
                      />
                      <span className="sr-only">{`${e.name}, set ${si + 1} done`}</span>
                    </label>
                    <button
                      className="icon-btn"
                      disabled={e.sets.length === 1}
                      onClick={() => removeSet(ei, si)}
                      aria-label={`Remove set ${si + 1} of ${e.name}`}
                    >
                      <span aria-hidden="true">&times;</span>
                    </button>
                  </div>
                ))}
              </div>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => addSet(ei)}
              >
                Add set
              </button>
            </section>
          );
        })}
      </div>

      <div className="form-actions">
        <button className="btn btn-primary btn-lg" onClick={finish}>
          Finish workout
        </button>
      </div>
    </>
  );
}

function HistoryPage({ highlight }) {
  const {
    state,
    historySorted,
    dispatch,
    notify,
    askConfirm,
    navigate,
    openStart,
  } = useApp();
  const unit = state.unit;
  const now = new Date();
  const ws = startOfWeek(now);

  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = new Date(ws);
    start.setDate(ws.getDate() - 7 * (7 - i));
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    const count = historySorted.filter((h) => {
      const t = Date.parse(h.date);
      return t >= start.getTime() && t < end.getTime();
    }).length;
    return { start, count };
  });
  const maxWeek = Math.max(1, ...weeks.map((w) => w.count));
  const weekEntries = historySorted.filter(
    (h) => Date.parse(h.date) >= ws.getTime(),
  );
  const totalVolume = historySorted.reduce(
    (n, h) => n + entryVolume(h, unit),
    0,
  );
  const totalTime = historySorted.reduce((n, h) => n + h.durationSec, 0);
  const bests = personalBests(historySorted, unit).slice(0, 6);

  function remove(h) {
    askConfirm({
      title: "Delete this workout record?",
      message: `${h.workoutName} on ${fmtDate(h.date)} will be removed from your history.`,
      confirmLabel: "Delete record",
      danger: true,
      onConfirm: () => {
        dispatch({ type: "deleteHistory", id: h.id });
        notify("History entry deleted");
      },
    });
  }

  return (
    <>
      <PageHeader
        title="Workout history"
        subtitle="Every session you've logged, newest first."
      />
      {historySorted.length === 0 ? (
        <EmptyState
          title="No history yet"
          action={
            <button className="btn btn-primary" onClick={openStart}>
              Start workout
            </button>
          }
        >
          Completed workouts are saved here with the weight and reps for every
          set.
        </EmptyState>
      ) : (
        <>
          <section aria-labelledby="sum-title" className="section">
            <h2 id="sum-title">Summary</h2>
            <div className="stats">
              <div className="stat">
                <span className="val">{historySorted.length}</span>
                <span className="lbl">Total workouts</span>
              </div>
              <div className="stat">
                <span className="val">{weekEntries.length}</span>
                <span className="lbl">This week</span>
              </div>
              <div className="stat">
                <span className="val">{fmtNum(Math.round(totalVolume))}</span>
                <span className="lbl">{unit} lifted in total</span>
              </div>
              <div className="stat">
                <span className="val">{fmtDuration(totalTime)}</span>
                <span className="lbl">Time training</span>
              </div>
            </div>
          </section>

          <section aria-labelledby="weekly-title" className="section">
            <h2 id="weekly-title">Workouts per week</h2>
            <div
              className="bars"
              role="img"
              aria-label={`Workouts per week over the last 8 weeks, oldest first: ${weeks.map((w) => w.count).join(", ")}.`}
            >
              {weeks.map((w, i) => (
                <div className="bar-col" key={i}>
                  <span className="bar-val">{w.count}</span>
                  <div className="bar-track">
                    <div
                      className="bar"
                      style={{
                        height: `${Math.max(4, (w.count / maxWeek) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="bar-lbl">
                    {w.start.toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
              ))}
            </div>
            <p className="hint">Each bar starts on the Monday shown.</p>
          </section>

          {bests.length > 0 && (
            <section aria-labelledby="pb-title" className="section">
              <h2 id="pb-title">Heaviest sets</h2>
              <ul className="plain-list">
                {bests.map((b) => (
                  <li key={b.exerciseId} className="list-row">
                    <strong>{b.name}</strong>
                    <span className="muted right">
                      {fmtNum(b.weight)} {unit} x {b.reps}, {fmtDate(b.date)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="log-title" className="section">
            <h2 id="log-title">Sessions</h2>
            <ul className="plain-list stack">
              {historySorted.map((h) => (
                <li key={h.id}>
                  <details
                    className="card history-item"
                    open={h.id === highlight}
                  >
                    <summary>
                      <span className="hs-main">
                        <strong>{h.workoutName}</strong>
                        <span className="muted">
                          {fmtDate(h.date)} at {fmtTime(h.date)}
                        </span>
                      </span>
                      <span className="muted hs-meta">
                        {fmtDuration(h.durationSec)},{" "}
                        {plural(entrySets(h), "set")},{" "}
                        {fmtNum(Math.round(entryVolume(h, unit)))} {unit}
                      </span>
                    </summary>
                    <div className="hist-body">
                      {h.exercises.map((e, i) => (
                        <div key={`${e.exerciseId}-${i}`}>
                          <h3>{e.name}</h3>
                          <ul className="chips">
                            {e.sets.map((x, j) => (
                              <li key={j}>
                                {fmtNum(x.weight)} {h.unit} x {x.reps}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => remove(h)}
                        aria-label={`Delete ${h.workoutName} on ${fmtDate(h.date)}`}
                      >
                        Delete record
                      </button>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* App shell                                                           */
/* ------------------------------------------------------------------ */

const TABS = [
  ["dashboard", "Home"],
  ["exercises", "Exercises"],
  ["workouts", "Workouts"],
  ["history", "History"],
];
const TAB_FOR = {
  dashboard: "dashboard",
  exercises: "exercises",
  workouts: "workouts",
  builder: "workouts",
  history: "history",
};

function Tracker({ auth, onLogout }) {
  const [state, dispatch] = useReducer(reducer, auth.username, loadData);
  const [route, setRoute] = useState({ page: "dashboard" });
  const [navCount, setNavCount] = useState(0);
  const [toasts, setToasts] = useState([]);
  const [confirm, setConfirm] = useState(null);
  const [startOpen, setStartOpen] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [sync, setSync] = useState("connecting"); // connecting | synced | saving | offline
  const [serverReady, setServerReady] = useState(false);
  const lastSent = useRef("");

  // Always keep a copy in localStorage (offline fallback).
  useEffect(() => {
    try {
      window.localStorage.setItem(
        dataKey(auth.username),
        JSON.stringify(state),
      );
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }, [state]);

  // On start: ask the PHP server for saved data. If it has some, use it.
  useEffect(() => {
    let cancelled = false;
    apiCall("data", auth.token)
      .then((r) => {
        if (r.status === 401) {
          onLogout("Your session expired. Please log in again.");
          throw new Error("expired");
        }
        if (!r.ok) throw new Error("Server error");
        return r.json();
      })
      .then((body) => {
        if (cancelled) return;
        if (body && body.data) {
          const data = sanitizeData(body.data);
          lastSent.current = JSON.stringify(data);
          dispatch({ type: "replace", data });
        }
        setServerReady(true);
        setSync("synced");
      })
      .catch((err) => {
        if (!cancelled && err.message !== "expired") setSync("offline"); // keep working from localStorage
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // After the first successful load: send every change to the server (debounced).
  useEffect(() => {
    if (!serverReady) return undefined;
    const json = JSON.stringify(state);
    if (json === lastSent.current) return undefined;
    setSync("saving");
    const t = setTimeout(() => {
      apiCall("data", auth.token, { method: "POST", body: json })
        .then((r) => {
          if (r.status === 401) {
            onLogout("Your session expired. Please log in again.");
            throw new Error("expired");
          }
          if (!r.ok) throw new Error("Server error");
          lastSent.current = json;
          setSync("synced");
        })
        .catch((err) => {
          if (err.message !== "expired") setSync("offline");
        });
    }, 600);
    return () => clearTimeout(t);
  }, [state, serverReady]);

  const allExercises = useMemo(
    () => [...BUILT_IN, ...state.customExercises],
    [state.customExercises],
  );
  const exerciseMap = useMemo(
    () => new Map(allExercises.map((e) => [e.id, e])),
    [allExercises],
  );
  const getExercise = useCallback((id) => exerciseMap.get(id), [exerciseMap]);
  const historySorted = useMemo(
    () =>
      [...state.history].sort(
        (a, b) => Date.parse(b.date) - Date.parse(a.date),
      ),
    [state.history],
  );

  const navigate = useCallback((page, params = {}) => {
    setRoute({ page, ...params });
    setNavCount((c) => c + 1);
    window.scrollTo(0, 0);
  }, []);

  const notify = useCallback((message, kind = "success") => {
    const id = uid();
    setToasts((t) => [...t.slice(-2), { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const askConfirm = useCallback((opts) => setConfirm(opts), []);

  const resume = useCallback(() => navigate("session"), [navigate]);

  const startWorkout = useCallback(
    (workout) => {
      if (state.activeSession) {
        notify(
          "Finish or discard your current workout before starting another.",
          "error",
        );
        navigate("session");
        return;
      }
      if (!workout.exercises.length) {
        notify("Add exercises to this workout before starting it.", "error");
        return;
      }
      dispatch({
        type: "startSession",
        session: buildSession(workout, state.unit, getExercise, historySorted),
      });
      setStartOpen(false);
      navigate("session");
    },
    [
      state.activeSession,
      state.unit,
      getExercise,
      historySorted,
      navigate,
      notify,
    ],
  );

  const openStart = useCallback(() => {
    if (state.activeSession) navigate("session");
    else setStartOpen(true);
  }, [state.activeSession, navigate]);

  const ctx = {
    state,
    dispatch,
    allExercises,
    getExercise,
    historySorted,
    navigate,
    navCount,
    notify,
    askConfirm,
    startWorkout,
    openStart,
    resume,
  };
  const activeTab = TAB_FOR[route.page];

  let page;
  switch (route.page) {
    case "exercises":
      page = <ExercisesPage />;
      break;
    case "workouts":
      page = <WorkoutsPage />;
      break;
    case "builder":
      page = (
        <WorkoutBuilder
          key={route.id || `new-${navCount}`}
          id={route.id}
          preset={route.preset}
        />
      );
      break;
    case "session":
      page = <SessionPage />;
      break;
    case "history":
      page = <HistoryPage highlight={route.highlight} />;
      break;
    default:
      page = <Dashboard />;
  }

  return (
    <Ctx.Provider value={ctx}>
      <style>{CSS}</style>
      <div className="ft">
        <a className="skip" href="#main">
          Skip to main content
        </a>
        <header className="topbar">
          <div className="topbar-in">
            <button
              className="brand"
              onClick={() => navigate("dashboard")}
              aria-label="FitTrack home"
            >
              <Logo />
              <span>FitTrack</span>
            </button>
            <nav className="nav" aria-label="Main">
              {TABS.map(([key, label]) => (
                <button
                  key={key}
                  className="nav-btn"
                  aria-current={activeTab === key ? "page" : undefined}
                  onClick={() => navigate(key)}
                >
                  {label}
                </button>
              ))}
            </nav>
            <div className="top-actions">
              <div className="unit" role="group" aria-label="Weight unit">
                {["kg", "lb"].map((u) => (
                  <button
                    key={u}
                    aria-pressed={state.unit === u}
                    onClick={() => dispatch({ type: "setUnit", unit: u })}
                  >
                    {u}
                  </button>
                ))}
              </div>
              <button className="btn btn-primary" onClick={openStart}>
                {state.activeSession ? "Resume workout" : "Start workout"}
              </button>
            </div>
            <div className="account">
              <span className="who" title={`Signed in as ${auth.username}`}>
                {auth.username}
              </span>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => onLogout()}
              >
                Log out
              </button>
            </div>
          </div>
        </header>

        <div className={`syncbar sync-${sync}`} role="status">
          {sync === "connecting" && "Connecting to server..."}
          {sync === "synced" && "Saved to server"}
          {sync === "saving" && "Saving to server..."}
          {sync === "offline" &&
            "Server not reachable. Changes are saved in this browser only."}
        </div>

        {saveError && (
          <div className="banner" role="alert">
            FitTrack can't save to this browser (storage is full or blocked).
            Your changes will be lost when you close this tab.
          </div>
        )}

        <main id="main" className="main">
          {page}
        </main>

        <div className="toasts" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast-${t.kind}`}>
              {t.message}
            </div>
          ))}
        </div>

        {confirm && (
          <Dialog title={confirm.title} onClose={() => setConfirm(null)}>
            <p>{confirm.message}</p>
            <div className="dialog-actions">
              <button className="btn" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button
                className={`btn ${confirm.danger ? "btn-danger-solid" : "btn-primary"}`}
                onClick={() => {
                  const f = confirm.onConfirm;
                  setConfirm(null);
                  f();
                }}
              >
                {confirm.confirmLabel}
              </button>
            </div>
          </Dialog>
        )}

        {startOpen && (
          <Dialog title="Start a workout" onClose={() => setStartOpen(false)}>
            {state.workouts.length === 0 ? (
              <>
                <p>
                  You don't have any saved workouts yet. Create one first, then
                  start it.
                </p>
                <div className="dialog-actions">
                  <button className="btn" onClick={() => setStartOpen(false)}>
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setStartOpen(false);
                      navigate("builder");
                    }}
                  >
                    Create workout
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="muted">Choose a workout to begin.</p>
                <ul className="plain-list stack">
                  {state.workouts.map((w) => (
                    <li key={w.id}>
                      <button
                        className="pick-workout"
                        disabled={w.exercises.length === 0}
                        onClick={() => startWorkout(w)}
                      >
                        <strong>{w.name}</strong>
                        <span className="muted">
                          {w.exercises.length
                            ? plural(w.exercises.length, "exercise")
                            : "No exercises yet"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Dialog>
        )}
      </div>
    </Ctx.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* Login / register screen and top-level App                           */
/* ------------------------------------------------------------------ */

function AuthScreen({ onAuth, notice }) {
  const [mode, setMode] = useState("login"); // login | register
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const formRef = useRef(null);
  const register = mode === "register";

  useEffect(() => {
    document.title = `${register ? "Create account" : "Log in"} - FitTrack`;
  }, [register]);

  useEffect(() => {
    if (attempt > 0)
      formRef.current?.querySelector('[aria-invalid="true"]')?.focus();
  }, [attempt]);

  function switchMode(next) {
    setMode(next);
    setErrors({});
    setPassword("");
    setConfirm("");
  }

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    const u = username.trim();
    if (register) {
      if (!/^[A-Za-z0-9_.-]{3,30}$/.test(u))
        errs.username =
          "Use 3 to 30 letters, numbers, dots, dashes or underscores.";
      if (password.length < 8) errs.password = "Use at least 8 characters.";
      else if (password.length > 72)
        errs.password = "Use 72 characters or fewer.";
      if (confirm !== password) errs.confirm = "The passwords don't match.";
    } else {
      if (!u) errs.username = "Enter your username.";
      if (!password) errs.password = "Enter your password.";
    }
    setErrors(errs);
    if (Object.keys(errs).length) {
      setAttempt((a) => a + 1);
      return;
    }
    setBusy(true);
    try {
      const r = await apiCall(mode, null, {
        method: "POST",
        body: JSON.stringify({ username: u, password }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok || !body.token) {
        setErrors({
          form:
            body.error ||
            `The server answered with an error (HTTP ${r.status}). Open ${API_URL}?action=health in your browser to check the backend setup.`,
        });
        return;
      }
      onAuth({ token: body.token, username: body.username });
    } catch {
      setErrors({
        form: `Can't reach the server at ${API_URL}. Start the PHP backend (run php -S localhost:8000 inside the backend folder), then try again.`,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ft">
      <style>{CSS}</style>
      <main className="auth">
        <div className="auth-card">
          <div className="auth-brand">
            <Logo size={34} />
            <span>FitTrack</span>
          </div>
          <h1>{register ? "Create your account" : "Log in"}</h1>
          <p className="sub">
            {register
              ? "Save your workouts and history to your own account."
              : "Welcome back. Log in to see your workouts."}
          </p>
          {notice && (
            <p className="banner-inline" role="status">
              {notice}
            </p>
          )}
          <form ref={formRef} onSubmit={submit} noValidate className="stack">
            <Field
              id="au-user"
              label="Username"
              error={errors.username}
              hint={
                register
                  ? "3 to 30 letters, numbers, dots, dashes or underscores."
                  : undefined
              }
            >
              <input
                id="au-user"
                type="text"
                value={username}
                maxLength={30}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                aria-required="true"
                aria-invalid={errors.username ? "true" : undefined}
                aria-describedby={describedBy(
                  "au-user",
                  register,
                  errors.username,
                )}
                onChange={(e) => setUsername(e.target.value)}
              />
            </Field>
            <Field
              id="au-pass"
              label="Password"
              error={errors.password}
              hint={register ? "At least 8 characters." : undefined}
            >
              <input
                id="au-pass"
                type={show ? "text" : "password"}
                value={password}
                maxLength={72}
                autoComplete={register ? "new-password" : "current-password"}
                aria-required="true"
                aria-invalid={errors.password ? "true" : undefined}
                aria-describedby={describedBy(
                  "au-pass",
                  register,
                  errors.password,
                )}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {register && (
              <Field
                id="au-confirm"
                label="Confirm password"
                error={errors.confirm}
              >
                <input
                  id="au-confirm"
                  type={show ? "text" : "password"}
                  value={confirm}
                  maxLength={72}
                  autoComplete="new-password"
                  aria-required="true"
                  aria-invalid={errors.confirm ? "true" : undefined}
                  aria-describedby={describedBy(
                    "au-confirm",
                    false,
                    errors.confirm,
                  )}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </Field>
            )}
            <label className="show-pass">
              <input
                type="checkbox"
                checked={show}
                onChange={(e) => setShow(e.target.checked)}
              />
              <span>Show password</span>
            </label>
            {errors.form && (
              <p className="error" role="alert">
                {errors.form}
              </p>
            )}
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={busy}
            >
              {busy ? "Please wait..." : register ? "Create account" : "Log in"}
            </button>
          </form>
          <p className="auth-switch">
            {register ? "Already have an account?" : "New to FitTrack?"}{" "}
            <button
              type="button"
              className="link-btn"
              onClick={() => switchMode(register ? "login" : "register")}
            >
              {register ? "Log in" : "Create an account"}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const [auth, setAuth] = useState(loadAuth);
  const [notice, setNotice] = useState("");

  const handleAuth = (a) => {
    try {
      window.localStorage.setItem(AUTH_KEY, JSON.stringify(a));
    } catch {
      /* ignore */
    }
    setNotice("");
    setAuth(a);
  };

  const logout = useCallback(
    async (message) => {
      const token = auth?.token;
      try {
        window.localStorage.removeItem(AUTH_KEY);
      } catch {
        /* ignore */
      }
      setNotice(typeof message === "string" ? message : "");
      setAuth(null);
      if (token) {
        try {
          await apiCall("logout", token, { method: "POST" });
        } catch {
          /* server unreachable: the token simply expires later */
        }
      }
    },
    [auth],
  );

  if (!auth) return <AuthScreen onAuth={handleAuth} notice={notice} />;
  return <Tracker key={auth.username} auth={auth} onLogout={logout} />;
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Barlow:wght@400;500;600&display=swap');

:root { color-scheme: dark; }
html, body { margin: 0; background: #0e1012; }
.ft {
  --bg: #0e1012; --surface: #161a1e; --surface2: #1f242a; --line: #2c333b; --edge: #66717d;
  --text: #f3f5f6; --muted: #a9b3bd; --accent: #c6f432; --accent-hover: #d8ff5e; --accent-ink: #11160a;
  --danger: #ff8f85; --danger-bg: #3a1c1a;
  --font-d: 'Barlow Condensed', 'Arial Narrow', 'Roboto Condensed', 'Helvetica Neue', Arial, sans-serif;
  --font: 'Barlow', 'Segoe UI', system-ui, -apple-system, Roboto, Arial, sans-serif;
  min-height: 100vh; background: var(--bg); color: var(--text);
  font: 400 1rem/1.5 var(--font); -webkit-text-size-adjust: 100%;
}
.ft *, .ft *::before, .ft *::after { box-sizing: border-box; }
.ft h1, .ft h2, .ft h3 { font-family: var(--font-d); font-weight: 700; margin: 0; line-height: 1.1; letter-spacing: 0.005em; }
.ft h1 { font-size: clamp(2.3rem, 6vw, 3.6rem); font-weight: 800; outline: none; }
.ft h2 { font-size: 1.75rem; }
.ft h3 { font-size: 1.3rem; }
.ft p { margin: 0; }
.ft .muted { color: var(--muted); }
.ft .right { text-align: right; }
.ft .count { color: var(--muted); font-size: 1.1rem; margin-left: 4px; font-weight: 600; }
.ft .plain-list, .ft .mini-list { list-style: none; margin: 0; padding: 0; }
.ft .stack { display: grid; gap: 16px; }
.ft .section { margin-top: 36px; display: grid; gap: 14px; }
.ft .row-between { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.ft .row-tools { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.ft .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
.ft :focus-visible, .ft ::backdrop { outline: 3px solid #fff; outline-offset: 2px; }
.ft ::backdrop { outline: none; }

.ft .skip { position: absolute; left: 12px; top: -60px; z-index: 200; background: var(--accent); color: var(--accent-ink); padding: 10px 16px; border-radius: 8px; font-weight: 600; }
.ft .skip:focus { top: 12px; }

/* Buttons */
.ft .btn {
  min-height: 44px; padding: 0 18px; border-radius: 8px; border: 1px solid var(--edge); background: var(--surface2); color: var(--text);
  font: 600 1rem var(--font); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px; text-align: center;
}
.ft .btn:hover { background: #2a3037; }
.ft .btn:disabled { opacity: 0.45; cursor: not-allowed; }
.ft .btn-primary { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.ft .btn-primary:hover { background: var(--accent-hover); border-color: var(--accent-hover); }
.ft .btn-danger { color: var(--danger); border-color: #7a3b36; background: transparent; }
.ft .btn-danger:hover { background: var(--danger-bg); }
.ft .btn-danger-solid { background: var(--danger); border-color: var(--danger); color: #2a0e0b; }
.ft .btn-danger-solid:hover { background: #ffaaa2; }
.ft .btn-ghost { background: transparent; border-color: transparent; }
.ft .btn-ghost:hover { background: var(--surface2); }
.ft .btn-sm { min-height: 40px; padding: 0 14px; font-size: 0.95rem; }
.ft .btn-lg { min-height: 52px; padding: 0 26px; font-size: 1.1rem; }
.ft .icon-btn { width: 44px; height: 44px; border-radius: 8px; border: 1px solid transparent; background: transparent; color: var(--muted); font-size: 1.6rem; line-height: 1; cursor: pointer; }
.ft .icon-btn:hover:not(:disabled) { background: var(--surface2); color: var(--text); }
.ft .icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }

/* Top bar and navigation */
.ft .topbar { position: sticky; top: 0; z-index: 50; background: var(--bg); border-bottom: 1px solid var(--line); }
.ft .topbar-in { max-width: 1080px; margin: 0 auto; padding: 10px 16px; display: flex; align-items: center; gap: 20px; }
.ft .brand { display: inline-flex; align-items: center; gap: 8px; background: none; border: 0; padding: 4px; border-radius: 8px; color: var(--accent); cursor: pointer; }
.ft .brand span { font: 800 1.9rem/1 var(--font-d); color: var(--text); }
.ft .nav { display: flex; gap: 4px; margin-right: auto; }
.ft .nav-btn { min-height: 44px; padding: 0 16px; background: none; border: 0; border-radius: 8px 8px 0 0; color: var(--muted); font: 600 1rem var(--font); cursor: pointer; }
.ft .nav-btn:hover { color: var(--text); background: var(--surface); }
.ft .nav-btn[aria-current="page"] { color: var(--text); box-shadow: inset 0 -3px 0 var(--accent); }
.ft .top-actions { display: flex; gap: 12px; align-items: center; margin-left: auto; }
.ft .unit { display: inline-flex; border: 1px solid var(--edge); border-radius: 8px; overflow: hidden; }
.ft .unit button { min-height: 42px; min-width: 46px; background: transparent; border: 0; color: var(--muted); font: 600 0.95rem var(--font); cursor: pointer; }
.ft .unit button[aria-pressed="true"] { background: var(--text); color: #0e1012; }
.ft .unit button:focus-visible { outline-offset: -3px; }

.ft .syncbar { text-align: center; font-size: 0.9rem; padding: 6px 16px; color: var(--muted); border-bottom: 1px solid var(--line); }
.ft .sync-offline { color: #ffd9a0; }
.ft .account { display: flex; align-items: center; gap: 4px; }
.ft .who { max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); font-weight: 500; }
.ft .auth { min-height: 100vh; display: grid; place-items: center; padding: 24px 16px; }
.ft .auth-card { width: min(440px, 100%); background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 28px; display: grid; gap: 16px; }
.ft .auth-brand { display: flex; align-items: center; gap: 8px; color: var(--accent); }
.ft .auth-brand span { font: 800 1.9rem/1 var(--font-d); color: var(--text); }
.ft .banner-inline { background: var(--danger-bg); border: 1px solid #7a3b36; color: #ffd7d3; border-radius: 8px; padding: 10px 12px; }
.ft .show-pass { display: flex; align-items: center; gap: 10px; min-height: 44px; cursor: pointer; }
.ft .auth-switch { color: var(--muted); }
.ft .link-btn { background: none; border: 0; padding: 8px 2px; min-height: 44px; color: var(--accent); font: 600 1rem var(--font); text-decoration: underline; cursor: pointer; border-radius: 6px; }
.ft .banner { background: var(--danger-bg); color: #ffd7d3; border-bottom: 1px solid #7a3b36; padding: 10px 16px; text-align: center; }

.ft .main { max-width: 1080px; margin: 0 auto; padding: 28px 16px 64px; }
.ft .page-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
.ft .sub { color: var(--muted); margin-top: 8px; }
.ft .page-actions { display: flex; gap: 10px; flex-wrap: wrap; }

/* Cards and grids */
.ft .card { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 18px; }
.ft .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 290px), 1fr)); gap: 14px; }
.ft .hero { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 28px; display: grid; gap: 10px; }
.ft .hero h2 { font-size: clamp(1.9rem, 4vw, 2.6rem); font-weight: 800; }
.ft .hero-actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 12px; }

/* Week strip */
.ft .week { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; }
.ft .day { border: 1px solid var(--line); border-radius: 12px; background: var(--surface); min-height: 92px; display: grid; place-content: center; text-align: center; gap: 0; }
.ft .day .dow { color: var(--muted); font-weight: 600; font-size: 0.9rem; }
.ft .day .num { font: 800 2.4rem/1 var(--font-d); }
.ft .day.has { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.ft .day.has .dow { color: #2d3a0a; }
.ft .day.today { box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--text); }

.ft .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
.ft .stat { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 16px; display: grid; gap: 2px; }
.ft .stat .val { font: 800 2.6rem/1 var(--font-d); }
.ft .stat .lbl { color: var(--muted); }

.ft .list-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px 4px; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
.ft .list-row:first-child { border-top: 1px solid var(--line); }

.ft .empty { text-align: center; padding: 40px 20px; border: 1px dashed var(--edge); border-radius: 14px; display: grid; justify-items: center; gap: 10px; color: var(--muted); }
.ft .empty svg { color: var(--accent); }
.ft .empty h2 { color: var(--text); font-size: 1.6rem; }
.ft .empty .btn { margin-top: 8px; }

/* Forms */
.ft .field { display: grid; gap: 6px; align-content: start; }
.ft .field label { font-weight: 600; }
.ft input:not([type="checkbox"]), .ft select, .ft textarea {
  width: 100%; min-height: 46px; background: #0b0d0f; color: var(--text); border: 1px solid var(--edge); border-radius: 8px; padding: 10px 12px; font: inherit; font-size: 1rem;
}
.ft textarea { resize: vertical; min-height: 110px; }
.ft input:not([type="checkbox"]):focus-visible, .ft select:focus-visible, .ft textarea:focus-visible { border-color: var(--accent); }
.ft .has-error input, .ft .has-error select, .ft .has-error textarea { border-color: var(--danger); }
.ft input[type="checkbox"] { width: 24px; height: 24px; margin: 0; accent-color: var(--accent); cursor: pointer; flex: none; }
.ft .hint { color: var(--muted); font-size: 0.9rem; }
.ft .error { color: var(--danger); font-size: 0.95rem; font-weight: 500; }
.ft .list-error { outline-offset: 4px; }
.ft .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.ft .four-col { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 14px; }
.ft .filters { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 14px; }
.ft .form-actions { display: flex; gap: 12px; justify-content: flex-end; flex-wrap: wrap; margin-top: 24px; }

/* Exercise cards */
.ft .ex-card { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 16px; display: grid; gap: 12px; align-content: start; }
.ft .ex-top { display: flex; gap: 12px; align-items: flex-start; }
.ft .ex-top input { margin-top: 2px; }
.ft .badges { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
.ft .badge { border: 1px solid var(--edge); border-radius: 999px; padding: 1px 10px; font-size: 0.85rem; color: var(--muted); }
.ft .badge-accent { border-color: var(--accent); color: var(--accent); }
.ft details > summary { cursor: pointer; font-weight: 600; min-height: 32px; display: flex; align-items: center; }
.ft .ex-card details p { color: var(--muted); margin-top: 6px; }
.ft .card-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; }

.ft .selection-bar { position: sticky; bottom: 16px; z-index: 20; margin-top: 28px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; background: var(--surface2); border: 1px solid var(--accent); border-radius: 12px; padding: 10px 14px; box-shadow: 0 8px 28px rgba(0,0,0,0.6); }
.ft .selection-actions { display: flex; gap: 8px; }

/* Workouts */
.ft .workout-card { display: grid; gap: 10px; align-content: start; }
.ft .mini-list { display: grid; gap: 4px; }
.ft .mini-list li { padding: 2px 0; }
.ft .build-row h3 { margin-bottom: 2px; }

/* Picker */
.ft .picker-list { max-height: 48vh; overflow-y: auto; margin: 14px 0; display: grid; gap: 14px; padding-right: 4px; }
.ft .picker-group { border: 0; padding: 0; margin: 0; display: grid; gap: 2px; }
.ft .picker-group legend { font: 700 1.2rem var(--font-d); padding: 0 0 4px; }
.ft .picker-item { display: flex; gap: 12px; align-items: center; min-height: 44px; padding: 4px 6px; border-radius: 8px; cursor: pointer; }
.ft .picker-item:hover { background: var(--surface2); }
.ft .picker-item.is-disabled { opacity: 0.6; cursor: default; }

/* Session */
.ft .progress-wrap { display: grid; gap: 8px; margin-bottom: 18px; }
.ft .track { height: 10px; background: var(--surface2); border-radius: 999px; overflow: hidden; border: 1px solid var(--line); }
.ft .fill { height: 100%; background: var(--accent); transition: width 0.25s ease; }
.ft .rest { position: sticky; top: 72px; z-index: 30; display: flex; justify-content: space-between; align-items: center; gap: 12px; background: var(--surface2); border: 1px solid var(--accent); border-radius: 12px; padding: 10px 16px; margin-bottom: 18px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); }
.ft .rest-time { font: 800 2.4rem/1 var(--font-d); color: var(--accent); }
.ft .session-ex { display: grid; gap: 12px; }
.ft .session-ex.is-complete { border-color: #55691c; }
.ft .sets { display: grid; gap: 8px; }
.ft .set-row { display: grid; grid-template-columns: 2.2rem 1fr 1fr 3.4rem 2.75rem; gap: 8px; align-items: center; }
.ft .set-head { color: var(--muted); font-size: 0.9rem; font-weight: 600; }
.ft .set-n { font: 700 1.4rem var(--font-d); color: var(--muted); text-align: center; }
.ft .set-row.is-done input[type="number"] { border-color: #55691c; }
.ft .done-box { display: grid; place-items: center; min-height: 46px; cursor: pointer; }
.ft .done-box input { width: 30px; height: 30px; }

/* History */
.ft .bars { display: grid; grid-template-columns: repeat(8, 1fr); gap: 8px; align-items: end; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 16px 12px 12px; }
.ft .bar-col { display: grid; gap: 6px; justify-items: center; }
.ft .bar-val { font: 700 1.1rem var(--font-d); }
.ft .bar-track { height: 110px; width: 100%; max-width: 44px; display: flex; align-items: flex-end; background: var(--surface2); border-radius: 6px; overflow: hidden; }
.ft .bar { width: 100%; background: var(--accent); }
.ft .bar-lbl { font-size: 0.78rem; color: var(--muted); text-align: center; }
.ft .history-item { padding: 0; }
.ft .history-item summary { padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; gap: 8px 16px; flex-wrap: wrap; min-height: 56px; }
.ft .hs-main { display: grid; }
.ft .hist-body { padding: 4px 18px 18px; display: grid; gap: 14px; border-top: 1px solid var(--line); padding-top: 14px; }
.ft .hist-body h3 { margin-bottom: 6px; font-size: 1.2rem; }
.ft .chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.ft .chips li { background: var(--surface2); border: 1px solid var(--line); border-radius: 8px; padding: 2px 10px; }
.ft .hist-body > .btn { justify-self: start; }

/* Dialog */
.ft .dialog { background: var(--surface); color: var(--text); border: 1px solid var(--edge); border-radius: 16px; padding: 0; width: min(520px, calc(100% - 24px)); max-height: calc(100% - 24px); }
.ft .dialog.wide { width: min(640px, calc(100% - 24px)); }
.ft .dialog::backdrop { background: rgba(0, 0, 0, 0.72); }
.ft .dialog-body { padding: 20px; display: grid; gap: 14px; }
.ft .dialog-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.ft .dialog-actions { display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; margin-top: 4px; }
.ft .pick-workout { width: 100%; min-height: 56px; text-align: left; display: flex; justify-content: space-between; align-items: center; gap: 12px; background: var(--surface2); color: var(--text); border: 1px solid var(--edge); border-radius: 10px; padding: 10px 16px; font: 500 1rem var(--font); cursor: pointer; }
.ft .pick-workout:hover:not(:disabled) { border-color: var(--accent); }
.ft .pick-workout:disabled { opacity: 0.5; cursor: not-allowed; }

/* Toasts */
.ft .toasts { position: fixed; z-index: 150; left: 50%; bottom: 24px; transform: translateX(-50%); display: grid; gap: 8px; width: min(440px, calc(100% - 24px)); pointer-events: none; }
.ft .toast { background: var(--text); color: #0e1012; border-radius: 10px; padding: 12px 16px; font-weight: 600; box-shadow: 0 8px 24px rgba(0,0,0,0.5); border-left: 6px solid var(--accent); }
.ft .toast-error { border-left-color: #d9362b; }

/* Tablet and phone */
@media (max-width: 860px) {
  .ft .filters { grid-template-columns: 1fr 1fr; }
  .ft .filters > :first-child { grid-column: 1 / -1; }
  .ft .four-col { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 720px) {
  .ft .topbar-in { gap: 10px; padding: 8px 12px; flex-wrap: wrap; }
  .ft .brand { order: 1; margin-right: auto; }
  .ft .account { order: 2; }
  .ft .top-actions { order: 3; flex: 1 1 100%; justify-content: space-between; margin-left: 0; }
  .ft .top-actions .btn-primary { flex: 1; }
  .ft .brand span { font-size: 1.6rem; }
  .ft .nav {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 60; margin: 0; gap: 0;
    display: grid; grid-template-columns: repeat(4, 1fr);
    background: var(--surface); border-top: 1px solid var(--line); padding-bottom: env(safe-area-inset-bottom, 0px);
  }
  .ft .nav-btn { min-height: 60px; border-radius: 0; font-size: 0.95rem; padding: 0 4px; }
  .ft .nav-btn[aria-current="page"] { box-shadow: inset 0 3px 0 var(--accent); }
  .ft .main { padding: 20px 14px calc(96px + env(safe-area-inset-bottom, 0px)); }
  .ft .toasts { bottom: calc(80px + env(safe-area-inset-bottom, 0px)); }
  .ft .selection-bar { bottom: calc(76px + env(safe-area-inset-bottom, 0px)); }
  .ft .hero { padding: 20px; }
  .ft .hero-actions .btn { flex: 1 1 100%; }
  .ft .rest { top: 66px; }
  .ft .day { min-height: 76px; border-radius: 10px; }
  .ft .day .num { font-size: 1.8rem; }
  .ft .day .dow { font-size: 0.78rem; }
  .ft .week { gap: 5px; }
  .ft .two-col { grid-template-columns: 1fr; }
  .ft .bars { gap: 4px; padding: 14px 8px 10px; }
  .ft .page-actions .btn { flex: 1 1 auto; }
}
@media (max-width: 400px) {
  .ft .top-actions { gap: 8px; }
  .ft .top-actions .btn { padding: 0 12px; font-size: 0.95rem; }
  .ft .unit button { min-width: 40px; }
  .ft .set-row { grid-template-columns: 1.6rem 1fr 1fr 3rem 2.4rem; gap: 6px; }
}
@media (prefers-reduced-motion: reduce) {
  .ft * { transition: none !important; animation: none !important; scroll-behavior: auto !important; }
}
`;
