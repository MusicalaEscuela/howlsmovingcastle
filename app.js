/* ═══════════════════════════════════════════════════════════════
   Practicador Musicala · app.js
   Musicala · Howl’s Moving Castle
   Audio + partitura + práctica por secciones + mezcladora + metrónomo

   Nota honesta:
   Este reproductor usa síntesis MIDI con Tone.js.
   No son muestras reales de violín/cello. Eso se puede mejorar después con SoundFonts
   o audios exportados por instrumento, pero hoy no abrimos ese portal infernal.
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ═══════════════════════════════════════════════════════════════
   CONFIGURACIÓN DE LA OBRA
═══════════════════════════════════════════════════════════════ */

const WORK_CONFIG = {
  title: 'Howl’s Moving Castle',
  subtitle: 'Ensamble de cuerdas',
  fullName: 'Howl’s Moving Castle · Ensamble de cuerdas',
  composer: 'Joe Hisaishi',
  defaultTempo: 120,
  defaultBeatsPerMeasure: 3,
  defaultTimeSignatureDenominator: 4,
  defaultTotalMeasures: 88,
  autoSoloOnScoreSelect: true,
  visualGuideDefault: true,
  countInDefault: false,
};

const SECTION_LABELS = {
  full: {
    label: 'Obra completa',
    description: 'Recorrido general',
  },
  A: {
    label: 'El castillo despierta',
    description: 'Primera mitad',
  },
  B: {
    label: 'Vuelo sobre las nubes',
    description: 'Segunda mitad',
  },
};

const MIDI_DEBUG = false;

const MIDI_FILE_CANDIDATES = [
  './howls-quartet.mid',
  './howls_quartet.mid',
  './howls-moving-castle.mid',
  './howls_moving_castle.mid',
  "./Howl's moving castle (quartet).mid",
  "./Howl's moving castle (quartet)(1).mid",
  './Howls Moving Castle.mid',
  './Howls%20Moving%20Castle.mid',
  './Howl%27s%20moving%20castle%20(quartet).mid',
  './Howl%27s%20moving%20castle%20(quartet)(1).mid',
];

const SCORE_FILE_CANDIDATES = [
  './howls-quartet.musicxml',
  './howls_quartet.musicxml',
  './howls-moving-castle.musicxml',
  './howls_moving_castle.musicxml',
  "./Howl's moving castle (quartet).musicxml",
  "./Howl's moving castle (quartet)(1).musicxml",
  './Howls Moving Castle.musicxml',
  './Howls%20Moving%20Castle.musicxml',
  './Howl%27s%20moving%20castle%20(quartet).musicxml',
  './Howl%27s%20moving%20castle%20(quartet)(1).musicxml',
  './howls-quartet.xml',
  './howls-quartet.mxl',
];

/* ═══════════════════════════════════════════════════════════════
   CONFIGURACIÓN DE INSTRUMENTOS
═══════════════════════════════════════════════════════════════ */

const QUARTET_PARTS = [
  {
    key: 'violin-1',
    label: 'Violín 1',
    icon: '🎻',
    synthType: 'triangle8',
    volumeDb: 0,
    aliases: [
      'violin 1',
      'violin i',
      'violín 1',
      'violin primero',
      'primer violin',
      'primer violín',
      'vln 1',
      'vln i',
      'vl 1',
      'vl i',
      'first violin',
      '1st violin',
    ],
  },
  {
    key: 'violin-2',
    label: 'Violín 2',
    icon: '🎻',
    synthType: 'triangle6',
    volumeDb: -1,
    aliases: [
      'violin 2',
      'violin ii',
      'violín 2',
      'violin segundo',
      'segundo violin',
      'segundo violín',
      'vln 2',
      'vln ii',
      'vl 2',
      'vl ii',
      'second violin',
      '2nd violin',
    ],
  },
  {
    key: 'violin-3',
    label: 'Violín 3',
    icon: '🎻',
    synthType: 'triangle4',
    volumeDb: -1,
    aliases: [
      'violin 3',
      'violin iii',
      'violín 3',
      'violin tercero',
      'tercer violin',
      'tercer violín',
      'vln 3',
      'vln iii',
      'vl 3',
      'vl iii',
      'third violin',
      '3rd violin',
      'viola',
    ],
  },
  {
    key: 'violin-4',
    label: 'Violín 4',
    icon: '🎻',
    synthType: 'triangle3',
    volumeDb: -1,
    aliases: [
      'violin 4',
      'violin iv',
      'violín 4',
      'violin cuarto',
      'cuarto violin',
      'cuarto violín',
      'vln 4',
      'vln iv',
      'vl 4',
      'vl iv',
      'fourth violin',
      '4th violin',
    ],
  },
  {
    key: 'cello',
    label: 'Violonchelo',
    icon: '🎻',
    synthType: 'sine4',
    volumeDb: -1,
    aliases: [
      'violoncello',
      'violonchelo',
      'cello',
      'vc',
      'vcl',
      'bajo',
      'bass',
      'cello solo',
    ],
  },
];

const PART_BY_KEY = Object.fromEntries(QUARTET_PARTS.map(part => [part.key, part]));
const PART_KEYS = QUARTET_PARTS.map(part => part.key);

/* ═══════════════════════════════════════════════════════════════
   ESTADO GLOBAL
═══════════════════════════════════════════════════════════════ */

const STATE = {
  midi: null,

  bpmBase: WORK_CONFIG.defaultTempo,
  beatsPerMeasure: WORK_CONFIG.defaultBeatsPerMeasure,
  timeSignatureDenominator: WORK_CONFIG.defaultTimeSignatureDenominator,

  transportPpq: 480,
  totalTicks: 0,
  totalDurationSec: 0,
  totalMeasures: WORK_CONFIG.defaultTotalMeasures,

  sections: {
    full: { startMeasure: 1, endMeasure: WORK_CONFIG.defaultTotalMeasures },
    A: { startMeasure: 1, endMeasure: 44 },
    B: { startMeasure: 45, endMeasure: WORK_CONFIG.defaultTotalMeasures },
  },

  isPlaying: false,
  isPaused: false,
  isCountingIn: false,
  countInEnabled: WORK_CONFIG.countInDefault,
  visualGuideEnabled: WORK_CONFIG.visualGuideDefault,

  speedPercent: 100,
  currentSection: 'full',
  loopEnabled: false,

  tracks: [],
  ignoredMidiTracks: 0,

  metronomeEnabled: false,
  metronomeLoop: null,
  metronomeSynth: null,

  osmd: null,
  rawMusicXml: null,
  musicXmlParts: [],
  scoreIsCompressed: false,
  selectedScorePartKey: 'all',

  cursorTimeline: [],
  cursorStepNow: 0,
  lastCursorTick: 0,

  rafId: null,
  countInTimers: [],
};

/* ═══════════════════════════════════════════════════════════════
   DOM
═══════════════════════════════════════════════════════════════ */

const DOM = {
  loadingMsg: () => document.getElementById('loading-msg'),

  infoName: () => document.getElementById('info-name'),
  infoFormat: () => document.getElementById('info-format'),
  infoTempo: () => document.getElementById('info-tempo'),
  infoTimeSig: () => document.getElementById('info-timesig'),
  infoDuration: () => document.getElementById('info-duration'),
  infoTracks: () => document.getElementById('info-tracks'),

  btnPlay: () => document.getElementById('btn-play'),
  btnPause: () => document.getElementById('btn-pause'),
  btnStop: () => document.getElementById('btn-stop'),

  progressBar: () => document.getElementById('progress-bar'),
  progressFill: () => document.getElementById('progress-fill'),
  progressThumb: () => document.getElementById('progress-thumb'),
  currentTime: () => document.getElementById('current-time'),
  currentMeasure: () => document.getElementById('current-measure'),
  totalTime: () => document.getElementById('total-time'),

  speedSlider: () => document.getElementById('speed-slider'),
  speedDisplay: () => document.getElementById('speed-display'),
  speedBpm: () => document.getElementById('speed-bpm'),
  presetBtns: () => document.querySelectorAll('.preset-btn'),

  sectionBtns: () => document.querySelectorAll('.section-btn'),
  loopToggle: () => document.getElementById('loop-toggle'),

  mixerContainer: () => document.getElementById('mixer-container'),

  btnMetronome: () => document.getElementById('btn-metronome'),
  metronomeDots: () => document.getElementById('metronome-beats'),

  countInToggle: () => document.getElementById('count-in-toggle'),
  visualGuideToggle: () => document.getElementById('visual-guide-toggle'),

  scoreStatusDot: () => document.getElementById('score-status-dot'),
  scoreStatusText: () => document.getElementById('score-status-text'),
  scorePlaceholder: () => document.getElementById('score-placeholder'),
  scoreViewHint: () => document.getElementById('score-view-hint'),
  osmdContainer: () => document.getElementById('osmd-container'),
  osmdWrapper: () => document.getElementById('osmd-wrapper'),
  scoreToggleBtn: () => document.getElementById('score-toggle-btn'),
  instrumentViewBtns: () => document.querySelectorAll('.instrument-view-btn'),
};

/* ═══════════════════════════════════════════════════════════════
   UTILIDADES
═══════════════════════════════════════════════════════════════ */

function setText(element, value) {
  if (element) element.textContent = value;
}

function formatTime(seconds) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return `${Math.floor(safe / 60)}:${Math.floor(safe % 60).toString().padStart(2, '0')}`;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[_\-.()[\]/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setLoadingMessage(message) {
  setText(DOM.loadingMsg(), message || '');
}

function setScoreStatus(state, message) {
  const dot = DOM.scoreStatusDot();
  const text = DOM.scoreStatusText();

  if (!dot || !text) return;

  dot.className = `score-status-dot${state ? ` ${state}` : ''}`;
  text.textContent = message || '';
}

async function fetchBuffer(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.arrayBuffer();
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function looksLikeZip(buffer) {
  if (!buffer || buffer.byteLength < 2) return false;

  const view = new Uint8Array(buffer, 0, 2);
  return view[0] === 0x50 && view[1] === 0x4b;
}

function midiToNoteName(midiValue) {
  if (!Number.isFinite(midiValue)) return null;

  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const midi = Math.round(midiValue);
  const octave = Math.floor(midi / 12) - 1;

  return `${names[midi % 12]}${octave}`;
}

function getPpq() {
  return STATE.transportPpq || Tone.Transport.PPQ || 480;
}

function ticksToBaseSeconds(ticks) {
  const ppq = getPpq();
  const beats = Math.max(0, Number(ticks) || 0) / ppq;

  return beats * (60 / STATE.bpmBase);
}

function baseSecondsToTicks(baseSeconds) {
  const ppq = getPpq();
  const beats = Math.max(0, Number(baseSeconds) || 0) * STATE.bpmBase / 60;

  return Math.round(beats * ppq);
}

function ticksToTransportTime(ticks) {
  return `${Math.max(0, Math.round(Number(ticks) || 0))}i`;
}

function getCurrentTransportTicks() {
  return Math.max(0, Math.round(Number(Tone.Transport.ticks) || 0));
}

function getMeasureFromTicks(ticks) {
  const ppq = getPpq();
  const ticksPerMeasure = ppq * STATE.beatsPerMeasure;
  const measure = Math.floor((Math.max(0, ticks) || 0) / ticksPerMeasure) + 1;

  return clamp(measure, 1, STATE.totalMeasures);
}

function getMaxTicksFromTracks(tracks) {
  return tracks.reduce((max, track) => {
    const trackMax = track.notes.reduce((innerMax, note) => {
      return Math.max(
        innerMax,
        Math.round(Number(note.ticks) || 0) + Math.round(Number(note.durationTicks) || 0)
      );
    }, 0);

    return Math.max(max, trackMax);
  }, 0);
}

function safeReleaseAll() {
  STATE.tracks.forEach(track => {
    try {
      track.synth?.releaseAll?.();
    } catch (error) {
      console.warn('[releaseAll]', error);
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   MIDI
═══════════════════════════════════════════════════════════════ */

function parseMidiBuffer(buffer) {
  if (!window.Midi) {
    throw new Error('No pudimos preparar el audio de práctica. Revisa que la librería MIDI esté cargando bien.');
  }

  return new window.Midi(buffer);
}

function getTrackLabel(track, index) {
  const pieces = [
    track.name,
    track.instrument?.name,
    track.instrument?.family,
  ].filter(Boolean);

  return pieces.length ? pieces.join(' ') : `Instrumento ${index + 1}`;
}

function getTrackFirstTick(track) {
  if (!track?.notes?.length) return Infinity;
  return Math.min(...track.notes.map(note => Number(note.ticks) || 0));
}

function getTrackLowestMidi(track) {
  if (!track?.notes?.length) return Infinity;

  const midiValues = track.notes
    .map(note => note.midi)
    .filter(value => Number.isFinite(value));

  if (!midiValues.length) return Infinity;
  return Math.min(...midiValues);
}

function getTrackAverageMidi(track) {
  if (!track?.notes?.length) return Infinity;

  const midiValues = track.notes
    .map(note => note.midi)
    .filter(value => Number.isFinite(value));

  if (!midiValues.length) return Infinity;

  const total = midiValues.reduce((sum, value) => sum + value, 0);
  return total / midiValues.length;
}

function detectPartKeyFromName(name, fallbackIndex = -1) {
  const normalized = normalizeText(name);

  for (const part of QUARTET_PARTS) {
    if (part.aliases.some(alias => normalized.includes(normalizeText(alias)))) {
      return part.key;
    }
  }

  return PART_KEYS[fallbackIndex] || null;
}

function cloneNote(note) {
  const ticks = Math.max(0, Math.round(Number(note.ticks) || 0));
  const durationTicks = Math.max(1, Math.round(Number(note.durationTicks) || 1));
  const velocity = clamp(Number(note.velocity ?? 0.8), 0.05, 1);

  return {
    ticks,
    durationTicks,
    name: note.name || midiToNoteName(note.midi),
    midi: note.midi,
    velocity,
  };
}

function extractEnsembleTracks(midi) {
  const noteTracks = midi.tracks
    .map((track, index) => ({
      track,
      index,
      label: getTrackLabel(track, index),
      firstTick: getTrackFirstTick(track),
      lowestMidi: getTrackLowestMidi(track),
      averageMidi: getTrackAverageMidi(track),
      noteCount: track.notes?.length || 0,
    }))
    .filter(item => item.noteCount > 0)
    .sort((a, b) => {
      if (a.firstTick !== b.firstTick) return a.firstTick - b.firstTick;
      return a.index - b.index;
    });

  if (!noteTracks.length) return [];

  if (MIDI_DEBUG) {
    console.table(
      noteTracks.map((item, orderIndex) => ({
        ordenMusical: orderIndex + 1,
        indiceMidi: item.index,
        nombre: item.label,
        notas: item.noteCount,
        primeraNotaTick: item.firstTick,
        promedioMidi: Math.round(item.averageMidi),
        notaMasGrave: item.lowestMidi,
      }))
    );
  }

  const buckets = new Map();
  const usedTrackIds = new Set();

  function createBucket(partKey) {
    const part = PART_BY_KEY[partKey];
    if (!part) return null;

    if (!buckets.has(partKey)) {
      buckets.set(partKey, {
        key: partKey,
        name: part.label,
        icon: part.icon,
        defaultVolumeDb: part.volumeDb || 0,
        notes: [],
        sourceNames: [],
      });
    }

    return buckets.get(partKey);
  }

  function addTrackToPart(item, partKey) {
    if (!item || !partKey || usedTrackIds.has(item.index)) return false;

    const bucket = createBucket(partKey);
    if (!bucket) return false;

    bucket.notes.push(...item.track.notes.map(cloneNote).filter(note => note.name));
    bucket.sourceNames.push(item.label);
    usedTrackIds.add(item.index);

    return true;
  }

  noteTracks.forEach(item => {
    const explicitKey = detectPartKeyFromName(item.label);
    if (explicitKey) addTrackToPart(item, explicitKey);
  });

  noteTracks
    .filter(item => !usedTrackIds.has(item.index))
    .forEach(item => {
      const missingKey = PART_KEYS.find(key => !buckets.has(key));
      if (missingKey) addTrackToPart(item, missingKey);
    });

  const expectedPartCount = Math.min(PART_KEYS.length, noteTracks.length);

  if (buckets.size < expectedPartCount && noteTracks.length >= expectedPartCount) {
    buckets.clear();
    usedTrackIds.clear();

    noteTracks.slice(0, expectedPartCount).forEach((item, orderIndex) => {
      addTrackToPart(item, PART_KEYS[orderIndex]);
    });
  }

  const result = QUARTET_PARTS
    .map(part => buckets.get(part.key))
    .filter(Boolean)
    .map(track => ({
      ...track,
      notes: track.notes.sort((a, b) => {
        if (a.ticks !== b.ticks) return a.ticks - b.ticks;
        return (a.midi || 0) - (b.midi || 0);
      }),
    }));

  const usedCount = Array.from(usedTrackIds).length;
  STATE.ignoredMidiTracks = Math.max(0, noteTracks.length - usedCount);

  if (MIDI_DEBUG) {
    console.table(
      result.map(track => ({
        instrumento: track.name,
        notas: track.notes.length,
        fuentesMidi: track.sourceNames.join(' | '),
      }))
    );
  }

  return result.slice(0, PART_KEYS.length);
}

function getTimeSignatureFromMidi(midi) {
  const first = midi.header?.timeSignatures?.[0];
  const signature = first?.timeSignature || [
    WORK_CONFIG.defaultBeatsPerMeasure,
    WORK_CONFIG.defaultTimeSignatureDenominator,
  ];

  return {
    numerator: signature[0] || first?.numerator || WORK_CONFIG.defaultBeatsPerMeasure,
    denominator: signature[1] || first?.denominator || WORK_CONFIG.defaultTimeSignatureDenominator,
  };
}

function configureTransport(midi) {
  const sig = getTimeSignatureFromMidi(midi);

  STATE.transportPpq = Number(midi.header?.ppq) || 480;
  STATE.beatsPerMeasure = Number(sig.numerator) || WORK_CONFIG.defaultBeatsPerMeasure;
  STATE.timeSignatureDenominator = Number(sig.denominator) || WORK_CONFIG.defaultTimeSignatureDenominator;
  STATE.bpmBase = Number(midi.header?.tempos?.[0]?.bpm) || WORK_CONFIG.defaultTempo;
  STATE.speedPercent = 100;

  Tone.Transport.stop();
  Tone.Transport.cancel(0);

  Tone.Transport.PPQ = STATE.transportPpq;
  Tone.Transport.bpm.value = STATE.bpmBase;
  Tone.Transport.timeSignature = [
    STATE.beatsPerMeasure,
    STATE.timeSignatureDenominator,
  ];

  Tone.Transport.loop = false;
  Tone.Transport.position = ticksToTransportTime(0);
}

/* ═══════════════════════════════════════════════════════════════
   SYNTHS / TRACKS
═══════════════════════════════════════════════════════════════ */

function createSynth(partKey) {
  const part = PART_BY_KEY[partKey] || QUARTET_PARTS[0];
  const isLow = partKey === 'cello';

  return new Tone.PolySynth(Tone.Synth, {
    oscillator: {
      type: part.synthType || 'triangle8',
    },
    envelope: {
      attack: isLow ? 0.022 : 0.012,
      decay: isLow ? 0.22 : 0.16,
      sustain: isLow ? 0.36 : 0.28,
      release: isLow ? 1.65 : 1.2,
    },
    maxPolyphony: 16,
  });
}

function disposeTracks() {
  STATE.tracks.forEach(track => {
    stopPart(track);

    track.synth?.releaseAll?.();
    track.synth?.dispose?.();
    track.reverb?.dispose?.();
    track.volume?.dispose?.();
  });

  STATE.tracks = [];
}

function buildTracks(midiTracks) {
  disposeTracks();

  STATE.tracks = midiTracks.map(track => {
    const synth = createSynth(track.key);

    const reverb = new Tone.Reverb({
      decay: track.key === 'cello' ? 1.4 : 1.18,
      preDelay: 0.012,
      wet: 0.1,
    });

    const volume = new Tone.Volume(track.defaultVolumeDb || 0);

    synth.connect(reverb);
    reverb.connect(volume);
    volume.toDestination();

    return {
      key: track.key,
      name: track.name,
      icon: track.icon,
      notes: track.notes,
      sourceNames: track.sourceNames || [],
      synth,
      reverb,
      volume,
      part: null,
      muted: false,
      soloed: false,
      volumeDb: track.defaultVolumeDb || 0,
    };
  });
}

function stopPart(track) {
  if (!track?.part) return;

  track.part.stop();
  track.part.dispose();
  track.part = null;
}

function buildPart(track) {
  const events = track.notes.map(note => ({
    time: ticksToTransportTime(note.ticks),
    name: note.name,
    durationTicks: Math.max(1, Math.round(Number(note.durationTicks) || 1)),
    velocity: note.velocity ?? 0.8,
  }));

  const part = new Tone.Part((time, event) => {
    if (track.muted || !event.name) return;

    track.synth.triggerAttackRelease(
      event.name,
      ticksToTransportTime(event.durationTicks),
      time,
      event.velocity ?? 0.8
    );
  }, events);

  part.start(0);
  part.loop = false;

  return part;
}

function scheduleAll() {
  if (!STATE.midi) return;

  STATE.tracks.forEach(track => {
    stopPart(track);
    track.part = buildPart(track);
  });
}

/* ═══════════════════════════════════════════════════════════════
   SECCIONES
═══════════════════════════════════════════════════════════════ */

function rebuildSections(totalMeasures = STATE.totalMeasures) {
  const total = Math.max(1, Number(totalMeasures) || WORK_CONFIG.defaultTotalMeasures);
  const middle = Math.max(1, Math.ceil(total / 2));

  STATE.totalMeasures = total;

  STATE.sections = {
    full: {
      startMeasure: 1,
      endMeasure: total,
    },
    A: {
      startMeasure: 1,
      endMeasure: middle,
    },
    B: {
      startMeasure: Math.min(middle + 1, total),
      endMeasure: total,
    },
  };

  renderSectionLabels();
}

function renderSectionLabels() {
  const map = {
    full: document.querySelector('[data-section="full"]'),
    A: document.querySelector('[data-section="A"]'),
    B: document.querySelector('[data-section="B"]'),
  };

  Object.entries(map).forEach(([key, button]) => {
    if (!button) return;

    const label = button.querySelector('.section-label');
    const description = button.querySelector('.section-description');
    const range = button.querySelector('.section-range');

    if (label && SECTION_LABELS[key]?.label) {
      label.textContent = SECTION_LABELS[key].label;
    }

    if (description && SECTION_LABELS[key]?.description) {
      description.textContent = SECTION_LABELS[key].description;
    }

    if (range && STATE.sections[key]) {
      range.textContent = `Compases ${STATE.sections[key].startMeasure} al ${STATE.sections[key].endMeasure}`;
    }
  });

  const full = document.getElementById('section-range-full');
  const sectionA = document.getElementById('section-range-a');
  const sectionB = document.getElementById('section-range-b');

  if (full) {
    full.textContent = `Compases ${STATE.sections.full.startMeasure} al ${STATE.sections.full.endMeasure}`;
  }

  if (sectionA) {
    sectionA.textContent = `Compases ${STATE.sections.A.startMeasure} al ${STATE.sections.A.endMeasure}`;
  }

  if (sectionB) {
    sectionB.textContent = `Compases ${STATE.sections.B.startMeasure} al ${STATE.sections.B.endMeasure}`;
  }
}

function measureToTicks(measureNumber) {
  const ppq = getPpq();
  const safeMeasure = Math.max(1, Number(measureNumber) || 1);

  return Math.max(0, Math.round((safeMeasure - 1) * STATE.beatsPerMeasure * ppq));
}

function getSectionBounds(sectionKey) {
  const section = STATE.sections[sectionKey] || STATE.sections.full;

  const startTicks = measureToTicks(section.startMeasure);
  const endTicks = sectionKey === 'full'
    ? STATE.totalTicks
    : measureToTicks(section.endMeasure + 1);

  return {
    startTicks,
    endTicks,
    start: ticksToTransportTime(startTicks),
    end: sectionKey === 'full'
      ? null
      : ticksToTransportTime(endTicks),
    startBaseSeconds: ticksToBaseSeconds(startTicks),
    endBaseSeconds: sectionKey === 'full'
      ? STATE.totalDurationSec
      : ticksToBaseSeconds(endTicks),
  };
}

/* ═══════════════════════════════════════════════════════════════
   OSMD / MUSICXML
═══════════════════════════════════════════════════════════════ */

function getOSMDClass() {
  return window.opensheetmusicdisplay?.OpenSheetMusicDisplay
    || window.OpenSheetMusicDisplay
    || null;
}

function ensureOSMD() {
  if (STATE.osmd) return true;

  const OSMD = getOSMDClass();
  const container = DOM.osmdContainer();

  if (!OSMD || !container) {
    setScoreStatus('error', 'No pudimos preparar la partitura. Revisa que la librería de visualización esté cargando bien.');
    return false;
  }

  STATE.osmd = new OSMD(container, {
    backend: 'svg',
    autoResize: false,
    drawTitle: false,
    drawSubtitle: false,
    drawComposer: false,
    drawCredits: false,
    drawingParameters: 'compacttight',
    cursorsOptions: [
      {
        type: 0,
        color: '#6E5C8F',
        alpha: 0.36,
        follow: true,
      },
    ],
  });

  return true;
}

function parseMusicXml(xmlString) {
  const doc = new DOMParser().parseFromString(xmlString, 'application/xml');

  if (doc.querySelector('parsererror')) {
    throw new Error('La partitura no se pudo leer. Revisa que el archivo sea .musicxml o .xml válido.');
  }

  return doc;
}

function serializeMusicXml(doc) {
  return new XMLSerializer().serializeToString(doc);
}

function directChildren(parent, tagName) {
  return Array.from(parent?.children || [])
    .filter(child => child.localName === tagName || child.tagName === tagName);
}

function extractMusicXmlParts(xmlString) {
  try {
    const doc = parseMusicXml(xmlString);

    return Array.from(doc.getElementsByTagName('score-part'))
      .map((node, index) => {
        const name = node.getElementsByTagName('part-name')[0]?.textContent?.trim()
          || node.getElementsByTagName('part-abbreviation')[0]?.textContent?.trim()
          || `Parte ${index + 1}`;

        return {
          id: node.getAttribute('id'),
          name,
          key: detectPartKeyFromName(name, index),
        };
      })
      .filter(part => part.id);
  } catch (error) {
    console.warn('[MusicXML parts]', error);
    return [];
  }
}

function inferMeasuresFromMusicXml(xmlString) {
  try {
    const doc = parseMusicXml(xmlString);
    const firstPart = Array.from(doc.getElementsByTagName('part'))[0];

    return directChildren(firstPart, 'measure').length || null;
  } catch (error) {
    console.warn('[MusicXML measures]', error);
    return null;
  }
}

function resolveMusicXmlPartId(partKey) {
  if (partKey === 'all') return null;

  return STATE.musicXmlParts.find(part => part.key === partKey)?.id
    || STATE.musicXmlParts[PART_KEYS.indexOf(partKey)]?.id
    || null;
}

function filterMusicXmlByPart(xmlString, partId) {
  if (!partId) return xmlString;

  const doc = parseMusicXml(xmlString);
  const partList = Array.from(doc.getElementsByTagName('part-list'))[0];

  if (partList) {
    Array.from(partList.getElementsByTagName('score-part')).forEach(node => {
      if (node.getAttribute('id') !== partId) {
        node.parentNode?.removeChild(node);
      }
    });

    Array.from(partList.getElementsByTagName('part-group')).forEach(node => {
      node.parentNode?.removeChild(node);
    });
  }

  Array.from(doc.getElementsByTagName('part')).forEach(node => {
    if (node.getAttribute('id') !== partId) {
      node.parentNode?.removeChild(node);
    }
  });

  return serializeMusicXml(doc);
}

async function normalizeScoreSource(source) {
  if (typeof source === 'string') {
    if (source.toLowerCase().endsWith('.mxl')) {
      const buffer = await fetchBuffer(source);

      return {
        sourceToLoad: looksLikeZip(buffer) ? new Uint8Array(buffer) : buffer,
        rawXml: null,
        isCompressed: true,
      };
    }

    const rawXml = await fetchText(source);

    return {
      sourceToLoad: rawXml,
      rawXml,
      isCompressed: false,
    };
  }

  if (source instanceof ArrayBuffer) {
    if (looksLikeZip(source)) {
      return {
        sourceToLoad: new Uint8Array(source),
        rawXml: null,
        isCompressed: true,
      };
    }

    const rawXml = new TextDecoder('utf-8').decode(source);

    return {
      sourceToLoad: rawXml,
      rawXml,
      isCompressed: false,
    };
  }

  throw new Error('No reconocimos la fuente de la partitura.');
}

async function loadMusicXML(source) {
  if (!ensureOSMD()) return;

  setScoreStatus('loading', 'Preparando la partitura de práctica...');

  const placeholder = DOM.scorePlaceholder();
  const osmdEl = DOM.osmdContainer();

  if (placeholder) placeholder.style.display = 'none';

  if (osmdEl) {
    osmdEl.style.display = 'block';
    osmdEl.innerHTML = '';
  }

  try {
    const normalized = await normalizeScoreSource(source);

    STATE.rawMusicXml = normalized.rawXml;
    STATE.scoreIsCompressed = normalized.isCompressed;
    STATE.musicXmlParts = normalized.rawXml
      ? extractMusicXmlParts(normalized.rawXml)
      : [];

    if (normalized.rawXml) {
      const measures = inferMeasuresFromMusicXml(normalized.rawXml);
      if (measures) rebuildSections(measures);
    }

    await renderSelectedScorePart(normalized.sourceToLoad);

    refreshInstrumentButtons();

    setScoreStatus(
      'ready',
      STATE.scoreIsCompressed
        ? 'Partitura lista. Para ver cada instrumento por separado, usa un archivo .musicxml o .xml.'
        : 'Partitura lista para practicar.'
    );
  } catch (error) {
    console.error('[OSMD]', error);

    setScoreStatus('error', `No pudimos mostrar la partitura: ${error.message}`);

    if (osmdEl) osmdEl.style.display = 'none';
    if (placeholder) placeholder.style.display = '';

    throw error;
  }
}

async function renderSelectedScorePart(fallbackSource = null) {
  if (!STATE.osmd) return;

  const osmdEl = DOM.osmdContainer();

  if (osmdEl) {
    osmdEl.style.display = 'block';
    osmdEl.innerHTML = '';
  }

  let sourceToLoad = fallbackSource;

  if (STATE.rawMusicXml) {
    const partId = resolveMusicXmlPartId(STATE.selectedScorePartKey);

    if (STATE.selectedScorePartKey !== 'all' && !partId) {
      throw new Error(`no encontramos ${getSelectedPartLabel()} dentro de la partitura.`);
    }

    sourceToLoad = filterMusicXmlByPart(STATE.rawMusicXml, partId);
  }

  if (!sourceToLoad) return;

  await STATE.osmd.load(sourceToLoad);

  STATE.osmd.zoom = STATE.selectedScorePartKey === 'all' ? 0.86 : 1;

  STATE.osmd.render();
  buildCursorTimeline();
  updateVisualGuideState();

  resetCursorToTicks(getCurrentTransportTicks());
  setScoreViewHint();
}

function buildCursorTimeline() {
  STATE.cursorTimeline = [];
  STATE.cursorStepNow = 0;
  STATE.lastCursorTick = 0;

  const cursor = STATE.osmd?.cursor;
  if (!cursor?.iterator) return;

  cursor.reset();

  let steps = 0;

  while (!cursor.iterator.EndReached) {
    const realValue = cursor.iterator.currentTimeStamp?.realValue ?? 0;

    /*
      OSMD expresa el tiempo como fracciones de redonda.
      1 redonda = 4 negras.
      ticks = realValue * 4 * PPQ.
    */
    const ticks = Math.round(realValue * 4 * getPpq());

    STATE.cursorTimeline.push(ticks);

    cursor.next();
    steps++;

    if (steps > 6000) break;
  }

  cursor.reset();
}

function syncCursor(currentTicks = getCurrentTransportTicks()) {
  if (!STATE.visualGuideEnabled) return;
  if (!STATE.osmd || !STATE.cursorTimeline.length) return;

  const safeTicks = Math.max(0, Math.round(Number(currentTicks) || 0));
  const last = STATE.cursorTimeline.length - 1;

  const transportWentBack =
    STATE.lastCursorTick > 0 && safeTicks + 1 < STATE.lastCursorTick;

  const cursorAhead =
    STATE.cursorStepNow > 0 && safeTicks + 1 < STATE.cursorTimeline[STATE.cursorStepNow];

  if (transportWentBack || cursorAhead) {
    STATE.osmd.cursor.reset();
    STATE.cursorStepNow = 0;
  }

  while (
    STATE.cursorStepNow < last
    && STATE.cursorTimeline[STATE.cursorStepNow + 1] <= safeTicks
  ) {
    STATE.cursorStepNow++;
    STATE.osmd.cursor.next();
  }

  STATE.lastCursorTick = safeTicks;
}

function resetCursorToTicks(targetTicks = 0) {
  if (!STATE.osmd || !STATE.cursorTimeline.length) return;

  STATE.osmd.cursor.reset();
  STATE.cursorStepNow = 0;
  STATE.lastCursorTick = 0;

  if (STATE.visualGuideEnabled) {
    STATE.osmd.cursor.show();
    syncCursor(targetTicks);
  } else {
    STATE.osmd.cursor.hide?.();
  }
}

function updateVisualGuideState() {
  if (!STATE.osmd?.cursor) return;

  if (STATE.visualGuideEnabled) {
    STATE.osmd.cursor.show();
    resetCursorToTicks(getCurrentTransportTicks());
  } else {
    STATE.osmd.cursor.hide?.();
  }
}

function getSelectedPartLabel() {
  return STATE.selectedScorePartKey === 'all'
    ? 'todos los instrumentos'
    : PART_BY_KEY[STATE.selectedScorePartKey]?.label || 'el instrumento seleccionado';
}

function setScoreViewHint() {
  const hint = DOM.scoreViewHint();

  if (hint) {
    hint.innerHTML = `Estás viendo: <strong>${escapeHtml(getSelectedPartLabel())}</strong>.`;
  }
}

async function selectScorePart(partKey) {
  STATE.selectedScorePartKey = partKey || 'all';

  refreshInstrumentButtons();
  setScoreViewHint();

  if (STATE.rawMusicXml) {
    setScoreStatus('loading', 'Cambiando la vista de la partitura...');

    try {
      await renderSelectedScorePart();
      setScoreStatus('ready', 'Partitura lista para practicar.');
    } catch (error) {
      setScoreStatus('error', `No pudimos cambiar la vista: ${error.message}`);
    }
  } else if (STATE.scoreIsCompressed && STATE.selectedScorePartKey !== 'all') {
    setScoreStatus('error', 'Para ver instrumentos por separado, usa una partitura .musicxml o .xml sin comprimir.');
  }

  if (WORK_CONFIG.autoSoloOnScoreSelect) {
    applyScoreSelectionToMixer(STATE.selectedScorePartKey);
  }
}

function refreshInstrumentButtons() {
  DOM.instrumentViewBtns().forEach(button => {
    const partKey = button.dataset.part;
    const isActive = partKey === STATE.selectedScorePartKey;

    const isUnavailable =
      partKey !== 'all'
      && (
        STATE.scoreIsCompressed
        || (STATE.rawMusicXml && !resolveMusicXmlPartId(partKey))
      );

    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
    button.disabled = Boolean(isUnavailable);

    if (isUnavailable) {
      button.title = 'Esta parte no está disponible en la partitura cargada.';
    } else {
      button.title = '';
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   CONTEO INICIAL
═══════════════════════════════════════════════════════════════ */

function cancelCountIn() {
  STATE.countInTimers.forEach(timer => clearTimeout(timer));
  STATE.countInTimers = [];
  STATE.isCountingIn = false;
}

function runCountIn() {
  if (!STATE.countInEnabled) return Promise.resolve(true);

  cancelCountIn();

  if (!STATE.metronomeSynth) {
    buildMetronome();
  }

  STATE.isCountingIn = true;
  syncTransportUI();

  const beats = Math.max(1, STATE.beatsPerMeasure);
  const currentBpm = Number(Tone.Transport.bpm.value) || STATE.bpmBase;
  const intervalMs = 60000 / currentBpm;

  return new Promise(resolve => {
    for (let i = 0; i < beats; i++) {
      const timer = setTimeout(() => {
        if (!STATE.isCountingIn) {
          resolve(false);
          return;
        }

        const beat = i % beats;

        setLoadingMessage(`🎬 Conteo inicial: ${i + 1} / ${beats}`);

        try {
          STATE.metronomeSynth.triggerAttackRelease(
            beat === 0 ? 'C2' : 'C3',
            '32n'
          );
        } catch (error) {
          console.warn('[countIn]', error);
        }

        flashMetronomeDot(beat);
      }, i * intervalMs);

      STATE.countInTimers.push(timer);
    }

    const finishTimer = setTimeout(() => {
      if (!STATE.isCountingIn) {
        resolve(false);
        return;
      }

      STATE.isCountingIn = false;
      STATE.countInTimers = [];
      setLoadingMessage('');
      syncTransportUI();
      resolve(true);
    }, beats * intervalMs + 80);

    STATE.countInTimers.push(finishTimer);
  });
}

/* ═══════════════════════════════════════════════════════════════
   REPRODUCCIÓN
═══════════════════════════════════════════════════════════════ */

async function play() {
  await Tone.start();

  if (STATE.isPlaying || STATE.isCountingIn) return;

  if (!STATE.midi) {
    setLoadingMessage('⚠ Todavía no está listo el audio de práctica. Revisa que el archivo esté en la carpeta del proyecto.');
    return;
  }

  const bounds = getSectionBounds(STATE.currentSection);
  const shouldCountIn = !STATE.isPaused && STATE.countInEnabled;

  if (shouldCountIn) {
    const completed = await runCountIn();
    if (!completed) return;
  }

  if (!STATE.isPaused) {
    Tone.Transport.stop();
    Tone.Transport.cancel(0);
    Tone.Transport.position = ticksToTransportTime(0);

    scheduleAll();

    Tone.Transport.loop = Boolean(STATE.loopEnabled && bounds.end);

    if (STATE.loopEnabled && bounds.end) {
      Tone.Transport.loopStart = bounds.start;
      Tone.Transport.loopEnd = bounds.end;
    }

    resetCursorToTicks(bounds.startTicks);

    Tone.Transport.start('+0.08', bounds.start);
  } else {
    Tone.Transport.start();
  }

  if (STATE.metronomeEnabled && STATE.metronomeLoop) {
    STATE.metronomeLoop.start(0);
  }

  STATE.isPlaying = true;
  STATE.isPaused = false;

  startProgressLoop();
  syncTransportUI();
}

function pause() {
  if (!STATE.isPlaying && !STATE.isCountingIn) return;

  cancelCountIn();

  if (STATE.isPlaying) {
    Tone.Transport.pause();

    safeReleaseAll();
    STATE.metronomeLoop?.stop();

    STATE.isPlaying = false;
    STATE.isPaused = true;

    stopProgressLoop();
  }

  syncTransportUI();
}

function stop() {
  cancelCountIn();

  Tone.Transport.stop();
  Tone.Transport.cancel(0);
  Tone.Transport.loop = false;
  Tone.Transport.position = ticksToTransportTime(0);

  STATE.tracks.forEach(track => {
    track.synth?.releaseAll?.();
    stopPart(track);
  });

  STATE.metronomeLoop?.stop();

  resetCursorToTicks(0);

  STATE.isPlaying = false;
  STATE.isPaused = false;

  stopProgressLoop();
  syncTransportUI();
  updateProgressUI(0, 0);
  resetMetronomeDots();
  setLoadingMessage('');
}

/* ═══════════════════════════════════════════════════════════════
   VELOCIDAD
═══════════════════════════════════════════════════════════════ */

function setSpeed(percent) {
  const safePercent = clamp(Number(percent) || 100, 40, 140);

  STATE.speedPercent = safePercent;

  const bpm = Math.round(STATE.bpmBase * safePercent / 100);

  Tone.Transport.bpm.value = bpm;

  setText(DOM.speedDisplay(), `${safePercent}%`);
  setText(DOM.speedBpm(), `${bpm} BPM`);

  DOM.presetBtns().forEach(button => {
    button.classList.toggle('active', Number(button.dataset.speed) === safePercent);
  });
}

/* ═══════════════════════════════════════════════════════════════
   MIXER / INSTRUMENTOS
═══════════════════════════════════════════════════════════════ */

function applyMixerState() {
  const anySolo = STATE.tracks.some(track => track.soloed);

  STATE.tracks.forEach(track => {
    track.volume.volume.value = (
      track.muted || (anySolo && !track.soloed)
    )
      ? -Infinity
      : track.volumeDb;
  });
}

function setTrackMute(index, value) {
  if (!STATE.tracks[index]) return;

  STATE.tracks[index].muted = value;

  applyMixerState();
  refreshMixerVisualState();
}

function setTrackSolo(index, value) {
  STATE.tracks.forEach((track, trackIndex) => {
    track.soloed = trackIndex === index ? value : false;
  });

  applyMixerState();
  refreshMixerVisualState();
}

function setTrackVolume(index, db) {
  if (!STATE.tracks[index]) return;

  STATE.tracks[index].volumeDb = Number(db) || 0;

  applyMixerState();
}

function applyScoreSelectionToMixer(partKey) {
  if (!STATE.tracks.length) return;

  STATE.tracks.forEach(track => {
    track.soloed = partKey !== 'all' && track.key === partKey;
  });

  applyMixerState();
  refreshMixerVisualState();
}

function refreshMixerVisualState() {
  const container = DOM.mixerContainer();
  if (!container) return;

  container.querySelectorAll('.mixer-track').forEach(card => {
    const index = Number(card.dataset.idx);
    const track = STATE.tracks[index];

    if (!track) return;

    card.classList.toggle('is-muted', track.muted);
    card.classList.toggle('is-soloed', track.soloed);

    const mute = card.querySelector('.btn-mute');
    const solo = card.querySelector('.btn-solo');

    if (mute) {
      mute.textContent = track.muted ? '🔇' : '🔊';
      mute.title = track.muted ? 'Volver a escuchar este instrumento' : 'Silenciar este instrumento';
      mute.classList.toggle('active', track.muted);
      mute.setAttribute('aria-pressed', String(track.muted));
    }

    if (solo) {
      solo.textContent = track.soloed ? 'Solo ✓' : 'Solo';
      solo.title = track.soloed ? 'Volver a escuchar todos' : 'Escuchar solo este instrumento';
      solo.classList.toggle('active', track.soloed);
      solo.setAttribute('aria-pressed', String(track.soloed));
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   METRÓNOMO
═══════════════════════════════════════════════════════════════ */

function buildMetronome() {
  STATE.metronomeSynth?.dispose?.();
  STATE.metronomeLoop?.stop?.();
  STATE.metronomeLoop?.dispose?.();

  STATE.metronomeSynth = new Tone.MembraneSynth({
    pitchDecay: 0.008,
    octaves: 4,
    volume: -8,
    envelope: {
      attack: 0.001,
      decay: 0.08,
      sustain: 0,
      release: 0.08,
    },
  }).toDestination();

  let pulse = 0;

  STATE.metronomeLoop = new Tone.Loop(time => {
    const beat = pulse % STATE.beatsPerMeasure;

    STATE.metronomeSynth.triggerAttackRelease(
      beat === 0 ? 'C2' : 'C3',
      '32n',
      time
    );

    pulse++;

    Tone.getDraw().schedule(() => flashMetronomeDot(beat), time);
  }, '4n');
}

function toggleMetronome() {
  STATE.metronomeEnabled = !STATE.metronomeEnabled;

  const button = DOM.btnMetronome();
  if (!button) return;

  if (STATE.metronomeEnabled) {
    if (!STATE.metronomeSynth) buildMetronome();

    if (STATE.isPlaying) STATE.metronomeLoop.start(0);

    button.classList.add('active');
    button.textContent = 'Metrónomo encendido ✓';
    button.setAttribute('aria-pressed', 'true');
  } else {
    STATE.metronomeLoop?.stop();

    button.classList.remove('active');
    button.textContent = 'Metrónomo apagado';
    button.setAttribute('aria-pressed', 'false');

    resetMetronomeDots();
  }
}

function flashMetronomeDot(beat) {
  DOM.metronomeDots()?.querySelectorAll('.metro-dot').forEach((dot, index) => {
    dot.classList.toggle('active', index === beat);
  });

  window.setTimeout(resetMetronomeDots, 90);
}

function resetMetronomeDots() {
  DOM.metronomeDots()?.querySelectorAll('.metro-dot').forEach(dot => {
    dot.classList.remove('active');
  });
}

/* ═══════════════════════════════════════════════════════════════
   PROGRESO / SEEK
═══════════════════════════════════════════════════════════════ */

function startProgressLoop() {
  stopProgressLoop();

  function tick() {
    if (!STATE.isPlaying) return;

    const currentTicks = getCurrentTransportTicks();
    const currentBaseSeconds = ticksToBaseSeconds(currentTicks);

    const progress = STATE.totalDurationSec > 0
      ? clamp(currentBaseSeconds / STATE.totalDurationSec, 0, 1)
      : 0;

    updateProgressUI(progress, currentBaseSeconds);
    syncCursor(currentTicks);

    const bounds = getSectionBounds(STATE.currentSection);
    const stopAt = STATE.currentSection === 'full'
      ? STATE.totalDurationSec
      : bounds.endBaseSeconds;

    if (!Tone.Transport.loop && stopAt > 0 && currentBaseSeconds >= stopAt - 0.025) {
      stop();
      return;
    }

    STATE.rafId = requestAnimationFrame(tick);
  }

  STATE.rafId = requestAnimationFrame(tick);
}

function stopProgressLoop() {
  if (!STATE.rafId) return;

  cancelAnimationFrame(STATE.rafId);
  STATE.rafId = null;
}

function updateProgressUI(progress, currentBaseSeconds) {
  const safeProgress = clamp(Number(progress) || 0, 0, 1);
  const percent = (safeProgress * 100).toFixed(2);

  if (DOM.progressFill()) {
    DOM.progressFill().style.width = `${percent}%`;
  }

  if (DOM.progressThumb()) {
    DOM.progressThumb().style.left = `${percent}%`;
  }

  DOM.progressBar()?.setAttribute('aria-valuenow', percent);

  setText(DOM.currentTime(), formatTime(currentBaseSeconds));

  const measure = getMeasureFromTicks(baseSecondsToTicks(currentBaseSeconds));

  setText(DOM.currentMeasure(), `Compás ${measure}`);
}

function seekToFraction(fraction) {
  if (!STATE.midi || !STATE.totalDurationSec) return;

  cancelCountIn();

  const safeFraction = clamp(Number(fraction) || 0, 0, 1);
  const targetBaseSeconds = safeFraction * STATE.totalDurationSec;
  const targetTicks = baseSecondsToTicks(targetBaseSeconds);
  const position = ticksToTransportTime(targetTicks);
  const shouldResume = STATE.isPlaying || STATE.isPaused;

  Tone.Transport.stop();
  Tone.Transport.cancel(0);

  STATE.tracks.forEach(track => {
    track.synth.releaseAll();
    stopPart(track);
  });

  STATE.isPlaying = false;
  STATE.isPaused = false;

  resetCursorToTicks(targetTicks);

  if (shouldResume) {
    scheduleAll();

    const bounds = getSectionBounds(STATE.currentSection);

    Tone.Transport.loop = Boolean(STATE.loopEnabled && bounds.end);

    if (STATE.loopEnabled && bounds.end) {
      Tone.Transport.loopStart = bounds.start;
      Tone.Transport.loopEnd = bounds.end;
    }

    if (STATE.metronomeEnabled && STATE.metronomeLoop) {
      STATE.metronomeLoop.start(0);
    }

    Tone.Transport.start('+0.08', position);

    STATE.isPlaying = true;

    startProgressLoop();
  } else {
    updateProgressUI(safeFraction, targetBaseSeconds);
  }

  syncTransportUI();
}

/* ═══════════════════════════════════════════════════════════════
   RENDER UI
═══════════════════════════════════════════════════════════════ */

function renderInfoPanel() {
  setText(DOM.infoName(), WORK_CONFIG.fullName);
  setText(DOM.infoFormat(), 'Violín 1, Violín 2, Violín 3, Violín 4 y Violonchelo');
  setText(DOM.infoTempo(), `${Math.round(STATE.bpmBase)} BPM`);
  setText(DOM.infoTimeSig(), `${STATE.beatsPerMeasure}/${STATE.timeSignatureDenominator}`);
  setText(DOM.infoDuration(), formatTime(STATE.totalDurationSec));

  setText(
    DOM.infoTracks(),
    STATE.tracks.length === 1
      ? '1 instrumento listo'
      : `${STATE.tracks.length} instrumentos listos`
  );

  setText(DOM.totalTime(), formatTime(STATE.totalDurationSec));
}

function renderMixer() {
  const container = DOM.mixerContainer();
  if (!container) return;

  container.innerHTML = '';

  if (!STATE.tracks.length) {
    container.innerHTML = '<p class="mixer-placeholder">No encontramos instrumentos para practicar en este archivo.</p>';
    return;
  }

  STATE.tracks.forEach((track, index) => {
    const card = document.createElement('div');
    card.className = 'mixer-track';
    card.dataset.idx = String(index);

    const sourceTitle = track.sourceNames?.length
      ? ` title="${escapeHtml(track.sourceNames.join(' · '))}"`
      : '';

    card.innerHTML = `
      <div class="mixer-track-header">
        <span class="mixer-icon" aria-hidden="true">${track.icon || '🎵'}</span>
        <span class="mixer-name"${sourceTitle}>${escapeHtml(track.name)}</span>
        <div class="mixer-actions">
          <button
            class="btn-mute"
            type="button"
            data-idx="${index}"
            title="Silenciar este instrumento"
            aria-label="Silenciar o activar ${escapeHtml(track.name)}"
            aria-pressed="false"
          >🔊</button>
          <button
            class="btn-solo"
            type="button"
            data-idx="${index}"
            title="Escuchar solo este instrumento"
            aria-label="Escuchar solo ${escapeHtml(track.name)}"
            aria-pressed="false"
          >Solo</button>
        </div>
      </div>
      <div class="mixer-track-volume">
        <label for="track-volume-${index}">Vol.</label>
        <input
          id="track-volume-${index}"
          type="range"
          class="vol-slider"
          min="-30"
          max="6"
          value="${track.volumeDb}"
          step="1"
          data-idx="${index}"
          aria-label="Volumen de ${escapeHtml(track.name)}"
        >
        <span class="vol-display">${track.volumeDb} dB</span>
      </div>
    `;

    container.appendChild(card);
  });

  container.querySelectorAll('.btn-mute').forEach(button => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.idx);
      setTrackMute(index, !STATE.tracks[index]?.muted);
    });
  });

  container.querySelectorAll('.btn-solo').forEach(button => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.idx);
      setTrackSolo(index, !STATE.tracks[index]?.soloed);
    });
  });

  container.querySelectorAll('.vol-slider').forEach(slider => {
    slider.addEventListener('input', () => {
      const index = Number(slider.dataset.idx);
      const db = Number(slider.value);

      setTrackVolume(index, db);

      if (slider.nextElementSibling) {
        slider.nextElementSibling.textContent = `${db} dB`;
      }
    });
  });

  refreshMixerVisualState();
}

function renderMetronomeDots() {
  const container = DOM.metronomeDots();
  if (!container) return;

  container.innerHTML = '';

  for (let i = 0; i < STATE.beatsPerMeasure; i++) {
    const dot = document.createElement('div');
    dot.className = 'metro-dot';
    dot.setAttribute('aria-hidden', 'true');
    container.appendChild(dot);
  }

  const hint = document.querySelector('.metro-hint');

  if (hint) {
    hint.textContent = `Esta obra está en ${STATE.beatsPerMeasure}/${STATE.timeSignatureDenominator}: siente ${STATE.beatsPerMeasure} pulsos por compás.`;
  }
}

function syncTransportUI() {
  if (DOM.btnPlay()) {
    DOM.btnPlay().disabled = STATE.isPlaying || STATE.isCountingIn || !STATE.midi;
    DOM.btnPlay().classList.toggle('active', STATE.isPlaying);
  }

  if (DOM.btnPause()) {
    DOM.btnPause().disabled = !STATE.isPlaying && !STATE.isCountingIn;
    DOM.btnPause().classList.toggle('active', STATE.isPaused);
  }

  if (DOM.btnStop()) {
    DOM.btnStop().disabled = !STATE.isPlaying && !STATE.isPaused && !STATE.isCountingIn;
  }
}

/* ═══════════════════════════════════════════════════════════════
   PROCESAMIENTO MIDI
═══════════════════════════════════════════════════════════════ */

async function processMidiBuffer(buffer) {
  stop();

  setLoadingMessage('⏳ Preparando el audio de práctica...');

  let midi;

  try {
    midi = parseMidiBuffer(buffer);
  } catch (error) {
    console.error('[MIDI]', error);
    setLoadingMessage(`❌ ${error.message}`);
    return false;
  }

  STATE.midi = midi;

  configureTransport(midi);

  setLoadingMessage('⏳ Organizando los instrumentos...');

  const tracks = extractEnsembleTracks(midi);

  if (!tracks.length) {
    setLoadingMessage('⚠ No encontramos instrumentos con notas para practicar.');
    return false;
  }

  STATE.totalTicks = getMaxTicksFromTracks(tracks);
  STATE.totalDurationSec = ticksToBaseSeconds(STATE.totalTicks);

  if (!STATE.totalDurationSec && midi.duration > 0) {
    STATE.totalDurationSec = midi.duration;
  }

  const totalMeasures = Math.max(
    1,
    Math.ceil((STATE.totalTicks / getPpq()) / STATE.beatsPerMeasure)
  );

  rebuildSections(totalMeasures);

  buildTracks(tracks);
  buildMetronome();
  renderMetronomeDots();
  renderInfoPanel();
  renderMixer();
  syncTransportUI();

  if (DOM.speedSlider()) {
    DOM.speedSlider().value = '100';
  }

  setSpeed(100);
  setSection('full', true);
  updateProgressUI(0, 0);
  resetCursorToTicks(0);

  const ignored = STATE.ignoredMidiTracks > 0
    ? ` Encontramos otras ${STATE.ignoredMidiTracks} parte(s), pero dejamos activas las principales para que la práctica sea clara.`
    : '';

  const trackNames = STATE.tracks.map(track => track.name).join(', ');

  setLoadingMessage(`✅ Audio listo: puedes practicar con ${trackNames}.${ignored}`);

  window.setTimeout(() => setLoadingMessage(''), 5600);

  return true;
}

function setSection(sectionKey, noStop = false) {
  STATE.currentSection = sectionKey || 'full';

  if (!noStop && (STATE.isPlaying || STATE.isPaused || STATE.isCountingIn)) {
    stop();
  }

  DOM.sectionBtns().forEach(button => {
    button.classList.toggle('active', button.dataset.section === STATE.currentSection);
  });
}

/* ═══════════════════════════════════════════════════════════════
   EVENTOS
═══════════════════════════════════════════════════════════════ */

function bindEvents() {
  DOM.btnPlay()?.addEventListener('click', play);
  DOM.btnPause()?.addEventListener('click', pause);
  DOM.btnStop()?.addEventListener('click', stop);

  DOM.speedSlider()?.addEventListener('input', event => {
    setSpeed(Number(event.target.value));
  });

  DOM.presetBtns().forEach(button => {
    button.addEventListener('click', () => {
      const speed = Number(button.dataset.speed);

      if (DOM.speedSlider()) {
        DOM.speedSlider().value = String(speed);
      }

      setSpeed(speed);
    });
  });

  DOM.sectionBtns().forEach(button => {
    button.addEventListener('click', () => {
      setSection(button.dataset.section);
    });
  });

  DOM.loopToggle()?.addEventListener('change', event => {
    STATE.loopEnabled = event.target.checked;

    if (STATE.isPlaying || STATE.isPaused || STATE.isCountingIn) {
      stop();
    }
  });

  DOM.countInToggle()?.addEventListener('change', event => {
    STATE.countInEnabled = event.target.checked;
  });

  DOM.visualGuideToggle()?.addEventListener('change', event => {
    STATE.visualGuideEnabled = event.target.checked;
    updateVisualGuideState();
  });

  DOM.btnMetronome()?.addEventListener('click', toggleMetronome);

  bindProgressSeeking();
  bindScoreControls();
  bindKeyboardShortcuts();
  bindVisibilityEvents();
}

function bindProgressSeeking() {
  const progressBar = DOM.progressBar();
  if (!progressBar) return;

  let dragging = false;

  const seekFromClientX = clientX => {
    const rect = progressBar.getBoundingClientRect();
    if (!rect.width) return;

    seekToFraction((clientX - rect.left) / rect.width);
  };

  progressBar.addEventListener('click', event => {
    seekFromClientX(event.clientX);
  });

  progressBar.addEventListener('mousedown', event => {
    dragging = true;
    seekFromClientX(event.clientX);
  });

  document.addEventListener('mousemove', event => {
    if (dragging) seekFromClientX(event.clientX);
  });

  document.addEventListener('mouseup', () => {
    dragging = false;
  });

  progressBar.addEventListener(
    'touchstart',
    event => {
      dragging = true;
      seekFromClientX(event.touches[0].clientX);
    },
    { passive: true }
  );

  document.addEventListener(
    'touchmove',
    event => {
      if (dragging && event.touches?.[0]) {
        seekFromClientX(event.touches[0].clientX);
      }
    },
    { passive: true }
  );

  document.addEventListener('touchend', () => {
    dragging = false;
  });
}

function bindScoreControls() {
  DOM.scoreToggleBtn()?.addEventListener('click', () => {
    const button = DOM.scoreToggleBtn();
    const wrapper = DOM.osmdWrapper();

    if (!button || !wrapper) return;

    const expanded = button.getAttribute('aria-expanded') === 'true';

    button.setAttribute('aria-expanded', String(!expanded));
    wrapper.classList.toggle('collapsed', expanded);

    if (!expanded && STATE.osmd) {
      window.setTimeout(() => {
        STATE.osmd.render();
        updateVisualGuideState();
        resetCursorToTicks(getCurrentTransportTicks());
      }, 70);
    }
  });

  DOM.instrumentViewBtns().forEach(button => {
    button.addEventListener('click', () => {
      if (!button.disabled) {
        selectScorePart(button.dataset.part || 'all');
      }
    });
  });
}

function bindKeyboardShortcuts() {
  document.addEventListener('keydown', event => {
    const activeTag = document.activeElement?.tagName;

    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag)) return;

    if (event.code === 'Space') {
      event.preventDefault();
      STATE.isPlaying ? pause() : play();
    }

    if (event.code === 'Escape' || event.code === 'KeyS') {
      stop();
    }

    if (event.code === 'KeyM') {
      toggleMetronome();
    }

    if (event.code === 'KeyL') {
      const loop = DOM.loopToggle();
      if (loop) {
        loop.checked = !loop.checked;
        STATE.loopEnabled = loop.checked;
      }
    }

    if (event.code === 'KeyC') {
      const count = DOM.countInToggle();
      if (count) {
        count.checked = !count.checked;
        STATE.countInEnabled = count.checked;
      }
    }

    if (event.code === 'KeyV') {
      const visual = DOM.visualGuideToggle();
      if (visual) {
        visual.checked = !visual.checked;
        STATE.visualGuideEnabled = visual.checked;
        updateVisualGuideState();
      }
    }

    const speedByKey = {
      Digit1: 50,
      Digit2: 75,
      Digit3: 100,
      Digit4: 120,
    };

    if (speedByKey[event.code]) {
      if (DOM.speedSlider()) {
        DOM.speedSlider().value = String(speedByKey[event.code]);
      }

      setSpeed(speedByKey[event.code]);
    }
  });
}

function bindVisibilityEvents() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && STATE.isPlaying) {
      pause();
    }
  });

  window.addEventListener('beforeunload', () => {
    cancelCountIn();
    stopProgressLoop();
    safeReleaseAll();
  });
}

/* ═══════════════════════════════════════════════════════════════
   AUTOCARGA
═══════════════════════════════════════════════════════════════ */

async function autoLoadMidi() {
  for (const url of MIDI_FILE_CANDIDATES) {
    try {
      setLoadingMessage('⏳ Preparando el audio de práctica...');
      const loaded = await processMidiBuffer(await fetchBuffer(url));

      if (loaded) return true;
    } catch (_) {
      /*
        Seguimos probando candidatos.
        Los espacios y apóstrofes en rutas siguen siendo una pequeña tragedia técnica,
        como si el navegador se ofendiera por la puntuación.
      */
    }
  }

  setLoadingMessage('⚠ No encontramos el audio de práctica. Revisa que exista howls-quartet.mid en la carpeta del proyecto.');
  syncTransportUI();

  return false;
}

async function autoLoadScore() {
  setScoreStatus('loading', 'Preparando la partitura...');

  for (const url of SCORE_FILE_CANDIDATES) {
    try {
      await loadMusicXML(url);
      return true;
    } catch (_) {
      // Seguimos probando posibles nombres del archivo.
    }
  }

  setScoreStatus('error', 'No encontramos la partitura. Revisa que exista howls-quartet.musicxml en la carpeta del proyecto.');
  return false;
}

/* ═══════════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════════ */

function hydrateInitialUiState() {
  const countInToggle = DOM.countInToggle();
  const visualGuideToggle = DOM.visualGuideToggle();
  const loopToggle = DOM.loopToggle();

  if (countInToggle) {
    countInToggle.checked = WORK_CONFIG.countInDefault;
    STATE.countInEnabled = countInToggle.checked;
  }

  if (visualGuideToggle) {
    visualGuideToggle.checked = WORK_CONFIG.visualGuideDefault;
    STATE.visualGuideEnabled = visualGuideToggle.checked;
  }

  if (loopToggle) {
    STATE.loopEnabled = loopToggle.checked;
  }
}

async function init() {
  hydrateInitialUiState();

  syncTransportUI();
  renderSectionLabels();
  renderMetronomeDots();
  setSpeed(100);
  setScoreViewHint();
  refreshInstrumentButtons();
  bindEvents();

  /*
    Primero cargamos el audio para conocer tempo y PPQ.
    Luego cargamos la partitura para que la guía visual avance con el mismo pulso.
  */
  await autoLoadMidi();
  await autoLoadScore();

  resetCursorToTicks(getCurrentTransportTicks());
  updateVisualGuideState();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}