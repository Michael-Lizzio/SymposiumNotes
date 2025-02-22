document.addEventListener("DOMContentLoaded", () => {
    // ======= CONFIGURABLE VARIABLES =======
    const config = {
      calibrationDuration: 3000,                // ms for initial baseline volume calibration
      speechStartThresholdMultiplier: 2,        // multiplier above baseline to consider speech start
      speechStopThresholdMultiplier: 1.2,         // multiplier above baseline to consider speech still ongoing (if below, it's silence)
      speechStartDuration: 3000,                  // ms of sustained loudness above start threshold to confirm speech
      silenceDuration: 1500,                      // ms of sustained silence (below stop threshold) before ending a segment
      minSegmentDuration: 1000,                   // discard very short segments
    };
  
    // ======= AUDIO ANALYSIS STATE =======
    let audioContext, analyser, dataArray;
    let baselineVolume = 0;
    let calibrating = true;
    let calibrationSamples = [];
  
    // ======= RECORDERS =======
    let stream = null;             // Microphone stream
    let segmentRecorder = null;    // Active segment recorder
    let segmentChunks = [];        // Data for current speech segment
  
    // ======= FLAGS & TIMING =======
    let isRecording = false;
    let segmentActive = false;
    let segmentSilenceStart = null;
    let candidateStartTime = null;          // Time when potential speech segment started
    let sustainedSpeechConfirmed = false;   // Flag if speech sustained for required duration
    let recordingStartTime = null;
    let segmentCounter = 1;
  
    // ======= DOM ELEMENTS =======
    const startBtn = document.getElementById("startRecord");
    const stopBtn = document.getElementById("stopRecord");
    const segmentsContainer = document.getElementById("segmentsContainer");
  
    // ─────────────────────────────────────────────────────────
    //  START RECORDING (SETUP MICROPHONE + ANALYZER)
    // ─────────────────────────────────────────────────────────
    async function startRecording() {
      console.log("Requesting microphone...");
      try {
        // 1) Get microphone stream (reuse for all recordings)
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  
        // 2) Setup audio context/analyser for volume detection
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
  
        // 3) Initialize calibration
        recordingStartTime = performance.now();
        calibrating = true;
        calibrationSamples = [];
  
        isRecording = true;
  
        // 4) Begin monitoring volume for auto-cut segments
        requestAnimationFrame(monitorVolume);
  
        // Update UI
        startBtn.disabled = true;
        stopBtn.disabled = false;
        console.log("Recording started!");
      } catch (err) {
        console.error("Error accessing microphone:", err);
        alert("Microphone access is required.");
      }
    }
  
    // ─────────────────────────────────────────────────────────
    //  MONITOR VOLUME (CALIBRATION + SEGMENT DETECTION)
    // ─────────────────────────────────────────────────────────
    function monitorVolume() {
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
      const normalizedVolume = avg / 255;
      const now = performance.now();
  
      if (calibrating) {
        calibrationSamples.push(normalizedVolume);
        if (now - recordingStartTime >= config.calibrationDuration) {
          baselineVolume =
            calibrationSamples.reduce((a, b) => a + b, 0) / calibrationSamples.length;
          calibrating = false;
          console.log("Calibration complete. Baseline volume:", baselineVolume.toFixed(3));
        }
      } else {
        // Define thresholds based on baseline
        const startThreshold = baselineVolume * config.speechStartThresholdMultiplier;
        const stopThreshold = baselineVolume * config.speechStopThresholdMultiplier;
  
        if (!segmentActive) {
          // Not currently recording a segment
          if (normalizedVolume > startThreshold) {
            if (!candidateStartTime) {
              candidateStartTime = now;
              // Start candidate segment recording immediately to not miss any audio
              startSegment();
            } else {
              // Check if candidate speech has been sustained for the required duration
              if (!sustainedSpeechConfirmed && (now - candidateStartTime >= config.speechStartDuration)) {
                sustainedSpeechConfirmed = true;
                console.log("Sustained speech confirmed.");
              }
            }
          } else {
            // Reset candidate if volume falls below the start threshold before confirmation
            candidateStartTime = null;
          }
        } else {
          // Segment is active; check for silence to potentially stop the segment
          if (normalizedVolume < stopThreshold) {
            if (!segmentSilenceStart) {
              segmentSilenceStart = now;
            } else if (now - segmentSilenceStart >= config.silenceDuration) {
              stopSegment();
            }
          } else {
            // Reset silence timer if volume goes back up
            segmentSilenceStart = null;
            // Also check for sustained confirmation if not yet confirmed
            if (!sustainedSpeechConfirmed && candidateStartTime && (now - candidateStartTime >= config.speechStartDuration)) {
              sustainedSpeechConfirmed = true;
              console.log("Sustained speech confirmed.");
            }
          }
        }
      }
  
      if (isRecording) {
        requestAnimationFrame(monitorVolume);
      }
    }
  
    // ─────────────────────────────────────────────────────────
    //  START A NEW SEGMENT RECORDER
    // ─────────────────────────────────────────────────────────
    function startSegment() {
      console.log("Speech detected, starting segment...");
      segmentActive = true;
      segmentSilenceStart = null;
      // Note: candidateStartTime is already set in monitorVolume
      sustainedSpeechConfirmed = false; // Reset confirmation flag
      segmentChunks = [];
      segmentRecorder = new MediaRecorder(stream);
      segmentRecorder.ondataavailable = (event) => {
        segmentChunks.push(event.data);
      };
      segmentRecorder.onstop = () => {
        finalizeSegment();
      };
  
      segmentRecorder.start();
      console.log("Segment recorder started.");
    }
  
    // ─────────────────────────────────────────────────────────
    //  STOP SEGMENT RECORDER
    // ─────────────────────────────────────────────────────────
    function stopSegment() {
      console.log("Silence detected, stopping segment...");
      segmentActive = false;
      if (segmentRecorder && segmentRecorder.state === "recording") {
        segmentRecorder.stop();
      }
    }
  
    // ─────────────────────────────────────────────────────────
    //  FINALIZE SEGMENT (CALLED IN segmentRecorder.onstop)
    // ─────────────────────────────────────────────────────────
    function finalizeSegment() {
      // Discard segment if sustained speech was never confirmed
      if (!sustainedSpeechConfirmed) {
        console.log("Candidate speech was not sustained. Discarding segment.");
        candidateStartTime = null;
        sustainedSpeechConfirmed = false;
        segmentChunks = [];
        return;
      }
  
      // Create blob from recorded data
      const segmentBlob = new Blob(segmentChunks, { type: "audio/webm" });
      // Approximate segment duration (for further filtering if desired)
      const segmentDuration = performance.now() - candidateStartTime;
      if (segmentDuration < config.minSegmentDuration) {
        console.log("Segment too short, discarding.");
        candidateStartTime = null;
        sustainedSpeechConfirmed = false;
        segmentChunks = [];
        return;
      }
  
      console.log("Finalized segment:", segmentBlob.size, "bytes");
      createSegmentEntry(segmentBlob, segmentCounter++);
      // Reset candidate and segment states
      candidateStartTime = null;
      sustainedSpeechConfirmed = false;
      segmentChunks = [];
    }
  
    // ─────────────────────────────────────────────────────────
    //  CREATE UI ENTRY FOR A FINALIZED SEGMENT
    // ─────────────────────────────────────────────────────────
    function createSegmentEntry(blob, index) {
      const url = URL.createObjectURL(blob);
      const container = document.createElement("div");
      container.style.marginBottom = "10px";
  
      const audioElement = document.createElement("audio");
      audioElement.src = url;
      audioElement.controls = true;
  
      const downloadLink = document.createElement("a");
      downloadLink.href = url;
      downloadLink.download = `segment_${index}.webm`;
      downloadLink.innerText = `Download Segment ${index}`;
      downloadLink.style.marginLeft = "10px";
  
      container.appendChild(audioElement);
      container.appendChild(downloadLink);
      segmentsContainer.appendChild(container);
    }
  
    // ─────────────────────────────────────────────────────────
    //  STOP RECORDING (CLEANUP)
    // ─────────────────────────────────────────────────────────
    function stopRecording() {
      if (isRecording) {
        isRecording = false;
        // Stop active segment if recording
        if (segmentActive) {
          stopSegment();
        }
        startBtn.disabled = false;
        stopBtn.disabled = true;
        console.log("Recording stopped completely.");
      }
    }
  
    // ─────────────────────────────────────────────────────────
    //  BUTTON EVENT LISTENERS
    // ─────────────────────────────────────────────────────────
    startBtn.addEventListener("click", startRecording);
    stopBtn.addEventListener("click", stopRecording);
  });
  