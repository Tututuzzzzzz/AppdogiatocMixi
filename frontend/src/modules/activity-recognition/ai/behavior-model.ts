import {
  DEFAULT_PROBABILITIES,
  type BehaviorLabel,
  type BehaviorPrediction,
  type MotionFeatures,
  type MotionSample,
} from '@/src/modules/activity-recognition/types';
import {
  classifyBehaviorWithTinyMl,
  initializeTinyMlModel,
} from '@/src/modules/activity-recognition/ai/tinyml-model';

const MODEL_CENTROIDS: Record<BehaviorLabel, MotionFeatures> = {
  walking: {
    meanMagnitude: 1.2,
    stdMagnitude: 0.16,
    peakToPeakMagnitude: 0.42,
    meanDeltaMagnitude: 0.14,
    energy: 1.48,
  },
  running: {
    meanMagnitude: 1.58,
    stdMagnitude: 0.31,
    peakToPeakMagnitude: 0.78,
    meanDeltaMagnitude: 0.28,
    energy: 2.64,
  },
  upstairs: {
    meanMagnitude: 1.42,
    stdMagnitude: 0.24,
    peakToPeakMagnitude: 0.58,
    meanDeltaMagnitude: 0.22,
    energy: 2.1,
  },
  downstairs: {
    meanMagnitude: 1.34,
    stdMagnitude: 0.23,
    peakToPeakMagnitude: 0.62,
    meanDeltaMagnitude: 0.21,
    energy: 1.96,
  },
  sitting: {
    meanMagnitude: 1.01,
    stdMagnitude: 0.02,
    peakToPeakMagnitude: 0.05,
    meanDeltaMagnitude: 0.01,
    energy: 1.02,
  },
  standing: {
    meanMagnitude: 1.04,
    stdMagnitude: 0.03,
    peakToPeakMagnitude: 0.08,
    meanDeltaMagnitude: 0.02,
    energy: 1.07,
  },
};

const FEATURE_SCALE: MotionFeatures = {
  meanMagnitude: 0.6,
  stdMagnitude: 0.35,
  peakToPeakMagnitude: 1.2,
  meanDeltaMagnitude: 0.55,
  energy: 3.5,
};

const SMALL_NUMBER = 1e-6;

void initializeTinyMlModel();

export const BEHAVIOR_TEXT: Record<BehaviorLabel, string> = {
  walking: 'Đi bộ',
  running: 'Chạy',
  upstairs: 'Lên cầu thang',
  downstairs: 'Xuống cầu thang',
  sitting: 'Ngồi',
  standing: 'Đứng',
};

export function extractMotionFeatures(window: MotionSample[]): MotionFeatures {
  if (window.length === 0) {
    return {
      meanMagnitude: 0,
      stdMagnitude: 0,
      peakToPeakMagnitude: 0,
      meanDeltaMagnitude: 0,
      energy: 0,
    };
  }

  const magnitudes = window.map((sample) => sample.magnitude);
  const total = magnitudes.reduce((sum, value) => sum + value, 0);
  const meanMagnitude = total / magnitudes.length;

  const variance =
    magnitudes.reduce((sum, value) => {
      const delta = value - meanMagnitude;
      return sum + delta * delta;
    }, 0) / magnitudes.length;

  const stdMagnitude = Math.sqrt(variance);
  const minMagnitude = Math.min(...magnitudes);
  const maxMagnitude = Math.max(...magnitudes);

  const meanDeltaMagnitude =
    magnitudes.slice(1).reduce((sum, value, index) => {
      const previous = magnitudes[index];
      return sum + Math.abs(value - previous);
    }, 0) / Math.max(magnitudes.length - 1, 1);

  const energy =
    magnitudes.reduce((sum, value) => {
      return sum + value * value;
    }, 0) / magnitudes.length;

  return {
    meanMagnitude,
    stdMagnitude,
    peakToPeakMagnitude: maxMagnitude - minMagnitude,
    meanDeltaMagnitude,
    energy,
  };
}

function computeFeatureDistance(features: MotionFeatures, centroid: MotionFeatures): number {
  const meanDelta = (features.meanMagnitude - centroid.meanMagnitude) / FEATURE_SCALE.meanMagnitude;
  const stdDelta = (features.stdMagnitude - centroid.stdMagnitude) / FEATURE_SCALE.stdMagnitude;
  const p2pDelta =
    (features.peakToPeakMagnitude - centroid.peakToPeakMagnitude) / FEATURE_SCALE.peakToPeakMagnitude;
  const motionDelta =
    (features.meanDeltaMagnitude - centroid.meanDeltaMagnitude) / FEATURE_SCALE.meanDeltaMagnitude;
  const energyDelta = (features.energy - centroid.energy) / FEATURE_SCALE.energy;

  return Math.hypot(meanDelta, stdDelta, p2pDelta, motionDelta, energyDelta);
}

export function classifyBehavior(window: MotionSample[]): BehaviorPrediction {
  const features = extractMotionFeatures(window);

  if (window.length < 8) {
    return {
      label: 'standing',
      confidence: 0,
      probabilities: DEFAULT_PROBABILITIES,
      features,
    };
  }

  const tinyMlPrediction = classifyBehaviorWithTinyMl(window, features);
  if (tinyMlPrediction !== null) {
    return tinyMlPrediction;
  }

  const similarities = Object.entries(MODEL_CENTROIDS).reduce(
    (accumulator, [label, centroid]) => {
      const distance = computeFeatureDistance(features, centroid);
      const score = Math.exp(-0.5 * distance * distance);
      return {
        ...accumulator,
        [label]: score,
      };
    },
    DEFAULT_PROBABILITIES
  );

  const similaritySum = Object.values(similarities).reduce((sum, value) => sum + value, 0);

  const probabilities = Object.entries(similarities).reduce(
    (accumulator, [label, score]) => {
      return {
        ...accumulator,
        [label]: score / Math.max(similaritySum, SMALL_NUMBER),
      };
    },
    DEFAULT_PROBABILITIES
  );

  const [bestLabel, bestProbability] = Object.entries(probabilities).reduce(
    (best, [label, probability]) => {
      if (probability > best[1]) {
        return [label, probability];
      }

      return best;
    },
    ['standing', 0]
  );

  return {
    label: bestLabel as BehaviorLabel,
    confidence: bestProbability,
    probabilities,
    features,
  };
}
