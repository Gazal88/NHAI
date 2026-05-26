# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.
# AGENT.MD — App Dev Lead (Person 2) — Hackathon 7.0

## Project
Offline facial recognition React Native app for field workers.
My role: App — camera, model bridges, SQLite, Supabase sync, UI, demo.
Person 1 (ML) puts model files in /ml/models/tflite/ — I load them.
App name: FaceAuthModule

## Key Library
react-native-fast-tflite — all model inference, works Android + iOS from JS.

## Tech Stack
- React Native (Expo Bare) — SDK 51
- react-native-vision-camera v4
- react-native-fast-tflite
- expo-sqlite, expo-secure-store, expo-location
- @supabase/supabase-js
- @react-native-community/netinfo

## Current Status
Last completed: Project created, all packages installed, emulator set up (Pixel 6 API 37)
Working on: Android build — blocked on Java version conflict
Blocked on: Java 24 installed, need Java 17 (Adoptium Temurin 17)

## Fix Needed Tomorrow (DO THIS FIRST)
1. Download Java 17 from adoptium.net (Temurin 17, Windows x64, .msi)
2. Install it
3. Run: setx JAVA_HOME "C:\Program Files\Eclipse Adoptium\jdk-17.0.x.x-hotspot"
4. Close terminal, reopen
5. cd FaceAuthModule
6. npx expo run:android
7. Wait for emulator to show the app — first build takes 5-10 min

## Session Log
### 24 May 2026
- Installed Node 24, expo-cli, eas-cli globally
- Created FaceAuthModule with Expo Bare template
- Installed all packages: vision-camera, fast-tflite, sqlite, supabase, netinfo
- Created Pixel 6 emulator (API 37, Android 17)
- Build failed: Java version conflict (Java 24 vs required Java 17)
- Fixed gradle-wrapper.properties to use gradle-8.3
- Still failing due to Java version — fix tomorrow first thing