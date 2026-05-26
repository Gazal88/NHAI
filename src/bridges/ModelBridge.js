import { loadTensorflowModel } from 'react-native-fast-tflite';

let blazefaceModel = null;
let livenessModel = null;
let recognitionModel = null;

export const loadModels = async () => {
  try {
    blazefaceModel = await loadTensorflowModel(
      require('../../assets/models/blazeface.tflite')
    );
    console.log('BlazeFace loaded');
  } catch (e) {
    console.log('BlazeFace not found yet:', e.message);
  }

  try {
    livenessModel = await loadTensorflowModel(
      require('../../assets/models/liveness.tflite')
    );
    console.log('Liveness model loaded');
  } catch (e) {
    console.log('Liveness model not found yet:', e.message);
  }

  try {
    recognitionModel = await loadTensorflowModel(
      require('../../assets/models/recognition.tflite')
    );
    console.log('Recognition model loaded');
  } catch (e) {
    console.log('Recognition model not found yet:', e.message);
  }
};

export const runLiveness = async (imageData) => {
  if (!livenessModel) return null;
  const result = await livenessModel.run({ input: imageData });
  return result.output[0];
};

export const runRecognition = async (imageData) => {
  if (!recognitionModel) return null;
  const result = await recognitionModel.run({ input: imageData });
  return Array.from(result.output);
};

export const isModelsReady = () => {
  return livenessModel !== null && recognitionModel !== null;
};