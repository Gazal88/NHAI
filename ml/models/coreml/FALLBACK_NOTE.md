# CoreML Conversion — Fallback Note
    
## Status: Not required

coremltools requires Mac OS to run. Windows does not support CoreML runtime.

## Solution (from PRD Section 10)
react-native-fast-tflite runs TFLite models natively on iOS.
No CoreML conversion needed for the hackathon prototype.

## For Person 2
Use the .tflite files from ml/models/tflite/ for both Android AND iOS.
react-native-fast-tflite handles both platforms from the same files.

## Brief Compliance
PRD states CoreML is best-effort (Days 11-12).
TFLite fallback is documented and valid.
