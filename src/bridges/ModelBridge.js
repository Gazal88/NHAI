let loadTensorflowModel = null;
let blazefaceModel = null;
let facemeshModel = null;
let livenessModel = null;
let recognitionModel = null;

const toArray = (output) => {
  if (!output) return [];
  return Array.from(new Float32Array(output));
};

const ensureTflite = () => {
  if (!loadTensorflowModel) {
    ({ loadTensorflowModel } = require('react-native-fast-tflite'));
  }
};

const logModelInfo = (name, model) => {
  console.log(`${name} inputs:`, JSON.stringify(model.inputs));
  console.log(`${name} outputs:`, JSON.stringify(model.outputs));
};

export const loadModels = async () => {
  ensureTflite();

  try {
    blazefaceModel = await loadTensorflowModel(
      require('../../assets/models/blazeface.tflite'),
      []
    );
    console.log('BlazeFace loaded');
    logModelInfo('BlazeFace', blazefaceModel);
  } catch (e) {
    console.log('BlazeFace not found yet:', e.message);
  }

  try {
    facemeshModel = await loadTensorflowModel(
      require('../../assets/models/facemesh.tflite'),
      []
    );
    console.log('FaceMesh loaded');
    logModelInfo('FaceMesh', facemeshModel);
  } catch (e) {
    console.log('FaceMesh not found yet:', e.message);
  }

  try {
    livenessModel = await loadTensorflowModel(
      require('../../assets/models/liveness.tflite'),
      []
    );
    console.log('Liveness model loaded');
    logModelInfo('Liveness', livenessModel);
  } catch (e) {
    console.log('Liveness model not found yet:', e.message);
  }

  try {
    recognitionModel = await loadTensorflowModel(
      require('../../assets/models/mobilefacenet.tflite'),
      []
    );
    console.log('MobileFaceNet recognition model loaded');
    logModelInfo('MobileFaceNet', recognitionModel);
  } catch (e) {
    console.log('MobileFaceNet recognition model not found yet:', e.message);
  }
};

export const runLiveness = async (imageData) => {
  if (!livenessModel) return null;
  const outputs = await livenessModel.run([imageData]);
  const scores = toArray(outputs[0]);
  return scores[0] ?? null;
};

export const runRecognition = async (imageData) => {
  if (!recognitionModel) return null;
  const outputs = await recognitionModel.run([imageData]);
  return toArray(outputs[0]);
};

export const isModelsReady = () => {
  return livenessModel !== null && recognitionModel !== null;
};

export const getModelStatus = () => ({
  blazeface: blazefaceModel !== null,
  facemesh: facemeshModel !== null,
  liveness: livenessModel !== null,
  recognition: recognitionModel !== null,
});
