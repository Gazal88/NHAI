"""


Functions:
  - compute_ear(landmarks)          → {leftEAR, rightEAR, meanEAR, isBlinkFrame}
  - compute_head_yaw(landmarks)     → yaw_degrees
  - run_webcam_test()               → live test (requires webcam + mediapipe)
"""

import numpy as np
from typing import Dict, Optional, Tuple


# ─── LANDMARK INDICES (MediaPipe Face Mesh, 468 points) ─────────────────────
# These MUST match exactly what Person 2 uses in TypeScript

LEFT_EYE_INDICES  = [362, 385, 387, 263, 373, 380]
RIGHT_EYE_INDICES = [33, 160, 158, 133, 153, 144]

# 6 keypoints for head pose (PnP algorithm)
# Order: nose tip, chin, left eye corner, right eye corner, left mouth, right mouth
POSE_INDICES = [1, 152, 226, 446, 57, 287]

# 3D model points (approximate face geometry, metres)
FACE_3D_POINTS = np.array([
    [0.0,    0.0,    0.0],     # Nose tip
    [0.0,   -330.0, -65.0],    # Chin
    [-225.0,  170.0, -135.0],  # Left eye corner
    [225.0,   170.0, -135.0],  # Right eye corner
    [-150.0, -150.0, -125.0],  # Left mouth corner
    [150.0,  -150.0, -125.0],  # Right mouth corner
], dtype=np.float64)


# ─── EAR BLINK DETECTION ─────────────────────────────────────────────────────

def euclidean_distance(p1: np.ndarray, p2: np.ndarray) -> float:
    """Euclidean distance between two 3D points."""
    return float(np.linalg.norm(p1 - p2))


def compute_ear_for_eye(landmarks: np.ndarray, indices: list) -> float:
    """
    Eye Aspect Ratio for one eye.

    Formula: EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)

    Landmark ordering (standard):
        p1 = outer corner
        p2 = upper-outer
        p3 = upper-inner
        p4 = inner corner
        p5 = lower-inner
        p6 = lower-outer

    Args:
        landmarks: (468, 3) array of x,y,z coordinates (normalised 0-1)
        indices:   6 landmark indices [p1, p2, p3, p4, p5, p6]

    Returns:
        EAR value (float). Typically 0.2-0.4 open, drops below 0.25 when blinking.
    """
    p = [landmarks[i] for i in indices]   # list of 6 (x,y,z) arrays

    # Vertical distances
    v1 = euclidean_distance(p[1], p[5])   # p2 - p6
    v2 = euclidean_distance(p[2], p[4])   # p3 - p5

    # Horizontal distance
    h = euclidean_distance(p[0], p[3])    # p1 - p4

    ear = (v1 + v2) / (2.0 * h + 1e-9)
    return ear


def compute_ear(
    landmarks_flat: np.ndarray,
    blink_threshold: float = 0.25,
) -> Dict:
    """
    Compute Eye Aspect Ratio from MediaPipe Face Mesh output.

    Args:
        landmarks_flat: Flat float array of length 468*3 (x,y,z per point).
                        This matches exactly what react-native-fast-tflite
                        returns from the face mesh model.
        blink_threshold: EAR below this → blink detected (default 0.25)

    Returns:
        {
          "leftEAR":     float,
          "rightEAR":    float,
          "meanEAR":     float,
          "isBlinkFrame": bool   # True if meanEAR < threshold for this frame
        }

    TypeScript equivalent (Person 2 port):
        function computeEAR(landmarksFlat: Float32Array): EARResult {
          // Reshape to [[x,y,z], ...] then apply same formula
          // Left eye: [362,385,387,263,373,380]
          // Right eye: [33,160,158,133,153,144]
        }
    """
    # Reshape flat (1404,) → (468, 3)
    if landmarks_flat.shape == (1404,):
        landmarks = landmarks_flat.reshape(468, 3)
    elif landmarks_flat.shape == (468, 3):
        landmarks = landmarks_flat
    else:
        raise ValueError(f"Expected (1404,) or (468,3), got {landmarks_flat.shape}")

    left_ear  = compute_ear_for_eye(landmarks, LEFT_EYE_INDICES)
    right_ear = compute_ear_for_eye(landmarks, RIGHT_EYE_INDICES)
    mean_ear  = (left_ear + right_ear) / 2.0

    return {
        "leftEAR":      round(left_ear,  4),
        "rightEAR":     round(right_ear, 4),
        "meanEAR":      round(mean_ear,  4),
        "isBlinkFrame": mean_ear < blink_threshold,
    }


# ─── BLINK DETECTOR (stateful — 2 consecutive frames) ─────────────────────────

class BlinkDetector:
    """
    Stateful blink detector. Requires EAR < threshold for N_CONSECUTIVE frames.
    Prevents single-frame noise triggering a false blink.
    Reset between authentication sessions.
    """
    EAR_THRESHOLD   = 0.25
    N_CONSECUTIVE   = 2      # frames EAR must be below threshold
    COOLDOWN_FRAMES = 10     # frames before next blink can be registered

    def __init__(self):
        self.below_count  = 0
        self.blink_count  = 0
        self.cooldown     = 0

    def update(self, mean_ear: float) -> bool:
        """
        Update with new EAR value.
        Returns True the moment a confirmed blink is registered.
        """
        if self.cooldown > 0:
            self.cooldown -= 1
            return False

        if mean_ear < self.EAR_THRESHOLD:
            self.below_count += 1
        else:
            if self.below_count >= self.N_CONSECUTIVE:
                # EAR rose back up after being low — confirmed blink
                self.blink_count  += 1
                self.cooldown      = self.COOLDOWN_FRAMES
                self.below_count   = 0
                return True
            self.below_count = 0

        return False

    def reset(self):
        self.below_count = 0
        self.blink_count = 0
        self.cooldown    = 0


# ─── HEAD POSE ESTIMATION ─────────────────────────────────────────────────────

def compute_head_yaw(
    landmarks_flat: np.ndarray,
    image_width: int = 640,
    image_height: int = 480,
    yaw_threshold: float = 20.0,
) -> Dict:
    """
    Estimate head yaw (left-right rotation) using PnP algorithm.

    Args:
        landmarks_flat: Flat float array (1404,) or (468,3) from Face Mesh.
                        Landmark coordinates are normalised [0,1] x,y + depth z.
        image_width:    Width of the camera frame in pixels.
        image_height:   Height of the camera frame in pixels.
        yaw_threshold:  Degrees. Head turn detected if |yaw| > this (default 20°).

    Returns:
        {
          "yaw":          float,   # degrees — positive = right, negative = left
          "pitch":        float,   # degrees — positive = down
          "roll":         float,   # degrees
          "isTurnLeft":   bool,    # yaw < -yaw_threshold
          "isTurnRight":  bool,    # yaw > +yaw_threshold
        }

    TypeScript equivalent (Person 2 port):
        Use a JS PnP implementation or compute yaw from landmark ratios
        as a simplified approximation (see note below).
    """
    import cv2  # Only needed at runtime — install: pip install opencv-python

    # Reshape landmarks
    if landmarks_flat.shape == (1404,):
        landmarks = landmarks_flat.reshape(468, 3)
    else:
        landmarks = landmarks_flat

    # Extract the 6 pose keypoints, denormalise to pixel coordinates
    image_points_2d = np.array([
        [landmarks[i][0] * image_width, landmarks[i][1] * image_height]
        for i in POSE_INDICES
    ], dtype=np.float64)

    # Camera matrix (approximate — focal length ≈ image width)
    focal_length = image_width
    cx, cy = image_width / 2, image_height / 2
    camera_matrix = np.array([
        [focal_length, 0,            cx],
        [0,            focal_length, cy],
        [0,            0,            1 ],
    ], dtype=np.float64)

    dist_coeffs = np.zeros((4, 1))  # Assume no lens distortion for simplicity

    success, rotation_vec, translation_vec = cv2.solvePnP(
        FACE_3D_POINTS,
        image_points_2d,
        camera_matrix,
        dist_coeffs,
        flags=cv2.SOLVEPNP_ITERATIVE,
    )

    if not success:
        return {"yaw": 0.0, "pitch": 0.0, "roll": 0.0,
                "isTurnLeft": False, "isTurnRight": False}

    # Convert rotation vector to Euler angles
    rot_matrix, _ = cv2.Rodrigues(rotation_vec)
    proj_matrix   = np.hstack([rot_matrix, translation_vec])
    _, _, _, _, _, _, euler_angles = cv2.decomposeProjectionMatrix(proj_matrix)

    pitch = float(euler_angles[0])
    yaw   = float(euler_angles[1])
    roll  = float(euler_angles[2])

    return {
        "yaw":        round(yaw,   2),
        "pitch":      round(pitch, 2),
        "roll":       round(roll,  2),
        "isTurnLeft":  yaw < -yaw_threshold,
        "isTurnRight": yaw >  yaw_threshold,
    }


# ─── SIMPLIFIED YAW (TypeScript-friendly approximation) ───────────────────────

def compute_yaw_simple(landmarks_flat: np.ndarray) -> Dict:
    """
    Simplified yaw estimation using nose-tip horizontal position.
    No cv2.solvePnP required — easy to port to TypeScript.

    Method: Compare nose tip (landmark 1) horizontal position relative to
    the midpoint between two ear/temple points (landmarks 234 and 454).
    If nose is left of midpoint → head turned right, and vice versa.

    Less accurate than PnP but sufficient for > 20° turns.
    PERSON 2: Use this version for TypeScript — no PnP library needed.
    """
    if landmarks_flat.shape == (1404,):
        landmarks = landmarks_flat.reshape(468, 3)
    else:
        landmarks = landmarks_flat

    nose_x       = landmarks[1][0]      # nose tip x (normalised 0-1)
    left_face_x  = landmarks[234][0]    # left face boundary
    right_face_x = landmarks[454][0]    # right face boundary
    mid_x        = (left_face_x + right_face_x) / 2.0

    # Positive offset → nose right of midpoint → head turned LEFT
    offset = (nose_x - mid_x) / ((right_face_x - left_face_x) / 2.0 + 1e-9)
    yaw_approx = -offset * 45.0  # scale to approximate degrees

    return {
        "yaw_approx_deg": round(yaw_approx, 1),
        "isTurnLeft":  yaw_approx < -20.0,
        "isTurnRight": yaw_approx >  20.0,
    }


# ─── LIVE WEBCAM TEST ─────────────────────────────────────────────────────────

def run_webcam_test():
    """
    Test EAR and head pose on your laptop webcam.
    Requires: pip install mediapipe opencv-python
    Run this to verify algorithms before sharing with Person 2.
    """
    try:
        import cv2
        import mediapipe as mp
    except ImportError:
        print("Install: pip install mediapipe opencv-python")
        return

    mp_face_mesh = mp.solutions.face_mesh
    cap = cv2.VideoCapture(0)
    blink_detector = BlinkDetector()
    blink_total = 0

    print("Webcam test started. Press Q to quit.")
    print("Blink to test EAR. Turn head left/right to test pose.")

    with mp_face_mesh.FaceMesh(
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    ) as face_mesh:

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            h, w = frame.shape[:2]
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = face_mesh.process(rgb)

            if results.multi_face_landmarks:
                lm = results.multi_face_landmarks[0]
                flat = np.array([[l.x, l.y, l.z] for l in lm.landmark],
                                dtype=np.float32).flatten()

                ear_result  = compute_ear(flat)
                yaw_result  = compute_yaw_simple(flat)

                blinked = blink_detector.update(ear_result["meanEAR"])
                if blinked:
                    blink_total += 1

                # Display
                color = (0, 255, 0) if not ear_result["isBlinkFrame"] else (0, 0, 255)
                cv2.putText(frame, f"EAR: {ear_result['meanEAR']:.3f}", (10, 30),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
                cv2.putText(frame, f"Blinks: {blink_total}", (10, 60),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)
                cv2.putText(frame, f"Yaw: {yaw_result['yaw_approx_deg']:.1f}°", (10, 90),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 200, 0), 2)

                turn_txt = ""
                if yaw_result["isTurnLeft"]:  turn_txt = "← TURN LEFT"
                if yaw_result["isTurnRight"]: turn_txt = "→ TURN RIGHT"
                if turn_txt:
                    cv2.putText(frame, turn_txt, (10, 130),
                                cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 200, 255), 2)

            cv2.imshow("Gesture Test — Q to quit", frame)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

    cap.release()
    cv2.destroyAllWindows()
    print(f"\nTotal blinks detected: {blink_total}")


# ─── UNIT TESTS ───────────────────────────────────────────────────────────────

def run_unit_tests():
    print("Running unit tests for EAR and head pose...")

    # Test 1: Open eye (EAR should be ~0.3)
    lm = np.zeros((468, 3), dtype=np.float32)
    # Set left eye landmarks to simulate open eye
    # p1(362) p2(385) p3(387) p4(263) p5(373) p6(380)
    lm[362] = [0.0, 0.5, 0]   # outer corner
    lm[385] = [0.1, 0.6, 0]   # upper outer
    lm[387] = [0.3, 0.6, 0]   # upper inner
    lm[263] = [0.4, 0.5, 0]   # inner corner
    lm[373] = [0.3, 0.4, 0]   # lower inner
    lm[380] = [0.1, 0.4, 0]   # lower outer
    # Same for right eye
    lm[33]  = [0.6, 0.5, 0]
    lm[160] = [0.7, 0.6, 0]
    lm[158] = [0.8, 0.6, 0]
    lm[133] = [0.9, 0.5, 0]
    lm[153] = [0.8, 0.4, 0]
    lm[144] = [0.7, 0.4, 0]

    result = compute_ear(lm.flatten())
    print(f"Test 1 (open eye): EAR={result['meanEAR']:.4f} | isBlinkFrame={result['isBlinkFrame']}")

    # Test 2: Simulated blink (EAR should be < 0.25)
    lm[385] = [0.1, 0.505, 0]  # compress vertical
    lm[387] = [0.3, 0.505, 0]
    lm[380] = [0.1, 0.495, 0]
    lm[373] = [0.3, 0.495, 0]
    lm[160] = [0.7, 0.505, 0]
    lm[158] = [0.8, 0.505, 0]
    lm[153] = [0.8, 0.495, 0]
    lm[144] = [0.7, 0.495, 0]

    result2 = compute_ear(lm.flatten())
    print(f"Test 2 (blink):    EAR={result2['meanEAR']:.4f} | isBlinkFrame={result2['isBlinkFrame']}")

    # Test 3: Simplified yaw
    lm2 = np.zeros((468, 3), dtype=np.float32)
    lm2[1][0]   = 0.5   # nose tip centre → yaw ~0
    lm2[234][0] = 0.2   # left face boundary
    lm2[454][0] = 0.8   # right face boundary
    yaw = compute_yaw_simple(lm2.flatten())
    print(f"Test 3 (centre):   yaw={yaw['yaw_approx_deg']}° | L={yaw['isTurnLeft']} R={yaw['isTurnRight']}")

    lm2[1][0] = 0.65    # nose shifted right → head turned left
    yaw2 = compute_yaw_simple(lm2.flatten())
    print(f"Test 4 (left turn): yaw={yaw2['yaw_approx_deg']}° | L={yaw2['isTurnLeft']} R={yaw2['isTurnRight']}")

    print("\n✅ Unit tests complete.")


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--webcam":
        run_webcam_test()
    else:
        run_unit_tests()
        print("\nTo test with webcam: python gesture_algorithms.py --webcam")
