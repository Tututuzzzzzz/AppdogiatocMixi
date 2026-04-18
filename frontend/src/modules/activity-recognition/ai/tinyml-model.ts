import { loadTensorflowModel, type TensorflowModel } from 'react-native-fast-tflite';

import {
  DEFAULT_PROBABILITIES,
  type BehaviorLabel,
  type BehaviorPrediction,
  type MotionFeatures,
  type MotionSample,
} from '@/src/modules/activity-recognition/types';
import { tinyMlModelAsset } from '@/src/modules/activity-recognition/ai/tinyml-model-asset';

type TinyMlRuntimeStatus = 'disabled' | 'loading' | 'ready' | 'error';
type ChannelToken = 'x' | 'y' | 'z' | 'm';
type NumericTensorType = 'float32' | 'int8' | 'uint8';

const BEHAVIOR_ORDER: BehaviorLabel[] = ['walking', 'running', 'upstairs', 'downstairs', 'sitting', 'standing'];
const FALLBACK_MIN_WINDOW = 8;

const MODEL_URL = process.env.EXPO_PUBLIC_TINYML_MODEL_URL?.trim() ?? '';
const WINDOW_SIZE = readEnvPositiveInteger('EXPO_PUBLIC_TINYML_WINDOW_SIZE', 64);
const INPUT_LAYOUT = readInputLayout();
const INPUT_TYPE = readTensorType('EXPO_PUBLIC_TINYML_INPUT_TYPE', 'int8');
const INPUT_SCALE = readEnvNumber('EXPO_PUBLIC_TINYML_INPUT_SCALE', 1);
const INPUT_ZERO_POINT = readEnvNumber('EXPO_PUBLIC_TINYML_INPUT_ZERO_POINT', 0);
const OUTPUT_TYPE = readTensorType('EXPO_PUBLIC_TINYML_OUTPUT_TYPE', 'float32');
const OUTPUT_SCALE = readEnvNumber('EXPO_PUBLIC_TINYML_OUTPUT_SCALE', 1);
const OUTPUT_ZERO_POINT = readEnvNumber('EXPO_PUBLIC_TINYML_OUTPUT_ZERO_POINT', 0);

let model: TensorflowModel | null = null;
let loadPromise: Promise<void> | null = null;
let runtimeStatus: TinyMlRuntimeStatus = isModelConfigured() ? 'loading' : 'disabled';
let runtimeMessage: string | null = isModelConfigured() ? null : 'TinyML model is not configured.';

function readEnvNumber(name: string, defaultValue: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return defaultValue;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }

  return parsed;
}

function readEnvPositiveInteger(name: string, defaultValue: number): number {
  const parsed = Math.round(readEnvNumber(name, defaultValue));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultValue;
  }

  return parsed;
}

function readTensorType(name: string, defaultValue: NumericTensorType): NumericTensorType {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === 'float32' || raw === 'int8' || raw === 'uint8') {
    return raw;
  }

  return defaultValue;
}

function readInputLayout(): ChannelToken[] {
  const raw = process.env.EXPO_PUBLIC_TINYML_INPUT_LAYOUT?.trim().toLowerCase() ?? 'x,y,z';
  const tokens = raw
    .split(',')
    .map((token) => token.trim())
    .filter((token): token is ChannelToken => token === 'x' || token === 'y' || token === 'z' || token === 'm');

  return tokens.length > 0 ? tokens : ['x', 'y', 'z'];
}

function isModelConfigured(): boolean {
  return tinyMlModelAsset !== null || MODEL_URL.length > 0;
}

function softmax(scores: number[]): number[] {
  if (scores.length === 0) {
    return [];
  }

  const maxScore = Math.max(...scores);
  const shifted = scores.map((value) => Math.exp(value - maxScore));
  const total = shifted.reduce((sum, value) => sum + value, 0);

  if (total <= 0 || !Number.isFinite(total)) {
    const uniform = 1 / scores.length;
    return scores.map(() => uniform);
  }

  return shifted.map((value) => value / total);
}

function toProbabilitiesFromScores(scores: number[]): Record<BehaviorLabel, number> {
  const normalizedScores = softmax(scores);

  return BEHAVIOR_ORDER.reduce<Record<BehaviorLabel, number>>((accumulator, label, index) => {
    accumulator[label] = normalizedScores[index] ?? 0;
    return accumulator;
  }, { ...DEFAULT_PROBABILITIES });
}

function selectChannels(sample: MotionSample): number[] {
  return INPUT_LAYOUT.map((token) => {
    switch (token) {
      case 'x':
        return sample.x;
      case 'y':
        return sample.y;
      case 'z':
        return sample.z;
      case 'm':
        return sample.magnitude;
      default:
        return 0;
    }
  });
}

function createZeroSample(): MotionSample {
  return {
    x: 0,
    y: 0,
    z: 0,
    magnitude: 0,
    timestamp: 0,
  };
}

function toFixedWindow(samples: MotionSample[]): MotionSample[] {
  const clipped = samples.slice(-WINDOW_SIZE);
  if (clipped.length === WINDOW_SIZE) {
    return clipped;
  }

  const missing = WINDOW_SIZE - clipped.length;
  return [...Array.from({ length: missing }, createZeroSample), ...clipped];
}

function quantizeToInt8(value: number): number {
  const quantized = Math.round(value / INPUT_SCALE + INPUT_ZERO_POINT);
  return Math.max(-128, Math.min(127, quantized));
}

function quantizeToUint8(value: number): number {
  const quantized = Math.round(value / INPUT_SCALE + INPUT_ZERO_POINT);
  return Math.max(0, Math.min(255, quantized));
}

function buildInputBuffer(samples: MotionSample[]): ArrayBuffer {
  const window = toFixedWindow(samples);
  const values = window.flatMap(selectChannels);

  if (INPUT_TYPE === 'float32') {
    return new Float32Array(values).buffer;
  }

  if (INPUT_TYPE === 'uint8') {
    return Uint8Array.from(values.map(quantizeToUint8)).buffer;
  }

  return Int8Array.from(values.map(quantizeToInt8)).buffer;
}

function parseOutputScores(output: ArrayBuffer): number[] {
  if (OUTPUT_TYPE === 'float32') {
    return Array.from(new Float32Array(output));
  }

  if (OUTPUT_TYPE === 'uint8') {
    return Array.from(new Uint8Array(output)).map((value) => (value - OUTPUT_ZERO_POINT) * OUTPUT_SCALE);
  }

  return Array.from(new Int8Array(output)).map((value) => (value - OUTPUT_ZERO_POINT) * OUTPUT_SCALE);
}

function ensureRuntimeInitialized(): void {
  if (runtimeStatus === 'loading' && loadPromise === null) {
    void initializeTinyMlModel();
  }
}

function getModelSource(): number | { url: string } | null {
  if (tinyMlModelAsset !== null) {
    return tinyMlModelAsset;
  }

  if (MODEL_URL.length > 0) {
    return { url: MODEL_URL };
  }

  return null;
}

function pickBestLabel(probabilities: Record<BehaviorLabel, number>): BehaviorLabel {
  let bestLabel: BehaviorLabel = 'standing';
  let bestProbability = -1;

  for (const label of BEHAVIOR_ORDER) {
    const probability = probabilities[label] ?? 0;
    if (probability > bestProbability) {
      bestLabel = label;
      bestProbability = probability;
    }
  }

  return bestLabel;
}

export function getTinyMlRuntimeInfo(): { status: TinyMlRuntimeStatus; message: string | null } {
  return {
    status: runtimeStatus,
    message: runtimeMessage,
  };
}

export async function initializeTinyMlModel(): Promise<void> {
  if (!isModelConfigured()) {
    runtimeStatus = 'disabled';
    runtimeMessage = 'TinyML model is not configured.';
    return;
  }

  if (model !== null) {
    runtimeStatus = 'ready';
    runtimeMessage = null;
    return;
  }

  if (loadPromise !== null) {
    return loadPromise;
  }

  runtimeStatus = 'loading';
  runtimeMessage = null;

  loadPromise = (async () => {
    try {
      const source = getModelSource();
      if (source === null) {
        runtimeStatus = 'disabled';
        runtimeMessage = 'TinyML model is not configured.';
        return;
      }

      model = await loadTensorflowModel(source, []);
      runtimeStatus = 'ready';
      runtimeMessage = null;
    } catch (error) {
      runtimeStatus = 'error';
      runtimeMessage = error instanceof Error ? error.message : 'Failed to load TinyML model.';
      model = null;
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
}

export function classifyBehaviorWithTinyMl(
  window: MotionSample[],
  features: MotionFeatures
): BehaviorPrediction | null {
  ensureRuntimeInitialized();

  if (model === null) {
    return null;
  }

  if (window.length < FALLBACK_MIN_WINDOW) {
    return null;
  }

  try {
    const inputBuffer = buildInputBuffer(window);
    const output = model.runSync([inputBuffer]);
    const firstOutput = output[0] ?? null;

    if (!firstOutput) {
      return null;
    }

    const scores = parseOutputScores(firstOutput);
    if (scores.length !== BEHAVIOR_ORDER.length) {
      runtimeStatus = 'error';
      runtimeMessage = `TinyML output size ${scores.length} does not match expected label count ${BEHAVIOR_ORDER.length}.`;
      return null;
    }

    if (scores.length === 0) {
      return null;
    }

    const probabilities = toProbabilitiesFromScores(scores);
    const label = pickBestLabel(probabilities);
    const confidence = probabilities[label] ?? 0;

    return {
      label,
      confidence,
      probabilities,
      features,
    };
  } catch {
    return null;
  }
}
