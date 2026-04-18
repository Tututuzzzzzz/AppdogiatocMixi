// Model: 2Dv2_64_relu_int8.tflite
// Input  : INT8, window=64, layout=x,y,z → shape [1, 1, 64, 3] or [1, 64, 3]
// Output : INT8 (dequantize → softmax → 6 outputs: walking/running/upstairs/downstairs/sitting/standing)
//
// Để tắt model (dùng fallback classifier), đặt lại thành null:
// export const tinyMlModelAsset: number | null = null;
export const tinyMlModelAsset: number | null =
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@/assets/models/2Dv2_64_relu_int8.tflite') as number;
