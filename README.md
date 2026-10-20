# RoomLens AI 🎯👁️‍🗨️
### Real-Time Room Object Finder & Spatial Vision Scanner

**RoomLens AI** is a futuristic web application that turns any smartphone, tablet, or laptop camera into an intelligent room radar. It helps users find misplaced household objects (cell phones, keys, mugs, remotes, backpacks, etc.) and identify everything visible in their environment in real time.

---

## 🌟 Key Features

### 1. 🎯 "Find My Object" Search Mode
- **What are you looking for?**: Enter any item in the search box or tap one of the quick suggestions (`📱 Phone`, `☕ Cup`, `🍾 Bottle`, `💻 Laptop`, `🎒 Backpack`, `🛋️ Chair`, `📖 Book`, `🕹️ Remote`, `✂️ Scissors / Keys`).
- **Voice Search**: Click the 🎙️ **Voice Search** button and speak naturally: *"Find my cup"*, *"Where is my phone?"*, or *"Locate the keys"*.
- **Directional Guidance & Tracking HUD**:
  - Sweeps the room with an animated radar scanner and sonar sound.
  - When the target is spotted, triggers a **Target Locked** sound and visual lock-on reticle.
  - Shows directional pointers: `LOOK LEFT ◀`, `▶ LOOK RIGHT`, `TARGET IN CENTER`.
  - Estimates distance: `Near`, `Medium Distance`, `Very Close`.
  - Speaks out loud using Web Speech: *"I found your cell phone on the right side."*

### 2. 🔍 "Identify Everything" Mode
- Scans all 80 common object classes in real time simultaneously.
- Color-coded neon cyber brackets and labels with confidence percentages.
- **Live Room Inventory Drawer**: Shows item counts, positions, and distance.
- **One-Click Target Lock**: Click on any item in the inventory list to immediately switch into search mode and track it.
- **"Speak Room"**: Reads aloud an AI summary of everything currently visible in the room.

### 3. 🕒 "Last Seen" Memory History
- Automatically logs the timestamp and location where an object was last detected.
- Never wonder where you left your items again — check the history log to see: *"Cell phone last seen 45s ago at Center • Near"*.

### 4. 🖼️ Upload & Sample Demo Rooms
- Upload any photo of your room to detect objects without needing a physical webcam.
- Built-in photo demos for **Work Desk Setup**, **Modern Living Room**, and **Kitchen & Dining**.

### 5. 🔊 Pure Synthesized Web Audio & Voice
- Zero external MP3 files needed: Custom synthesized SFX via Web Audio API (radar ping, target-lock chime, shutter clicks).
- Spoken voice feedback via Web Speech API with debounce protection.

---

## 🚀 How to Run the Website

### Option 1: Double-click launcher (Easiest)
1. Navigate to `Documents\room-object-finder`.
2. Double-click `start-server.bat`.
3. Your browser will automatically open to `http://localhost:8080`.

### Option 2: Run via PowerShell
```powershell
cd C:\Users\amanc\Documents\room-object-finder
jwebserver -p 8080 -d .
```
Then open `http://localhost:8080` in Chrome, Edge, or Firefox.

### Option 3: Access from your Smartphone (To walk around your room!)
1. Ensure your phone is connected to the same Wi-Fi network as your PC.
2. Run `jwebserver -b 0.0.0.0 -p 8080 -d .`
3. On your phone, open `http://<YOUR_PC_IP_ADDRESS>:8080` (e.g. `http://192.168.1.5:8080`).
4. Tap **Start Camera** and use the **Flip Camera** button to use your phone's rear camera while walking around the room!

---

## 🏷️ Detectable Objects (80 Standard Classes)
- **Electronics**: Cell phone, Laptop, TV / Monitor, Mouse, Keyboard, Remote, Microwave, Oven.
- **Household & Furniture**: Chair, Couch, Bed, Dining table, Potted plant, Book, Clock, Vase, Scissors, Hair drier, Toothbrush, Toilet, Sink, Refrigerator.
- **Kitchenware**: Cup, Bottle, Wine glass, Bowl, Fork, Knife, Spoon.
- **Personal Accessories**: Backpack, Handbag, Umbrella, Suitcase, Tie.
- **People & Pets**: Person, Cat, Dog, Bird.
- **Foods**: Banana, Apple, Sandwich, Orange, Broccoli, Carrot, Pizza, Donut, Cake.

---

## 🛠️ Technology Stack
- **Frontend**: HTML5, Modern CSS3 (Glassmorphism & Cyberpunk HUD), ES6 JavaScript.
- **AI / Computer Vision**: [TensorFlow.js](https://www.tensorflow.org/js) + [COCO-SSD](https://github.com/tensorflow/tfjs-models/tree/master/coco-ssd) (WebGL GPU-accelerated client-side inference).
- **Camera Stream**: WebRTC `navigator.mediaDevices.getUserMedia` with front/back camera toggling and torch support.
- **Audio & Speech**: HTML5 Web Audio API synthesizer + Web Speech API (`SpeechRecognition` & `SpeechSynthesis`).
- **Server**: Zero-config Java `jwebserver` (JDK 25) / PowerShell HTTP listener.

