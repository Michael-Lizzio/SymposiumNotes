document.addEventListener("DOMContentLoaded", () => {
    // ======= CONFIGURABLE VARIABLES =======
    const config = {
      calibrationDuration: 3000,          // (ms) How long to calibrate to determine baseline noise level.
      silenceThresholdMultiplier: 1.5,    // Multiplier for baseline to set the "silence" threshold.
      silenceDuration: 1500,              // (ms) Duration of continuous low volume required to trigger segmentation.
      overlapDuration: 500,               // (ms) Amount of audio from the end of the segment to include in the next one.
      timeslice: 100,                     // (ms) Frequency of MediaRecorder's dataavailable events.
      minSegmentDuration: 1000            // (ms) Ignore segments that are too short.
    };
    
    // ======= STATE VARIABLES =======
    let baselineVolume = 0;
    let calibrating = true;
    let calibrationStartTime = null;
    let calibrationSamples = [];
    
    let recordingStartTime = null;
    let currentSegmentChunks = []; // Array of { blob, timestamp } for the current segment.
    let pendingOverlapChunks = []; // Chunks to prepend to the next segment.
    let segmentCounter = 1;
    let silenceStart = null;       // Timestamp (ms) when silence first detected.

    let segments = []; // Stores finalized audio segments

    
    let mediaRecorder, audioContext, analyser, dataArray;
    
    // ======= DOM ELEMENTS =======
    const startBtn = document.getElementById("startRecord");
    const stopBtn = document.getElementById("stopRecord");
    const segmentsContainer = document.getElementById("segmentsContainer");

    
    // ======= FUNCTIONS =======
    
    // Request microphone access and set up the recorder + analyser
    async function startRecording() {
        console.log("Started recording")
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Setup AudioContext & Analyser for real-time volume measurement
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);
            dataArray = new Uint8Array(analyser.frequencyBinCount);
        
            // Setup MediaRecorder; use timeslice to get frequent small chunks
            mediaRecorder = new MediaRecorder(stream);
            recordingStartTime = performance.now();
            calibrationStartTime = recordingStartTime;
            calibrating = true;
            calibrationSamples = [];
        
            // If any pending overlap exists (from a previous segment), begin with that
            currentSegmentChunks = pendingOverlapChunks.slice();
            pendingOverlapChunks = [];
        
            // On each timeslice, store the audio chunk with a timestamp.
            mediaRecorder.ondataavailable = (e) => {
            const timestamp = performance.now() - recordingStartTime;
            currentSegmentChunks.push({ blob: e.data, timestamp });
            };
        
            // Start the recorder; using config.timeslice ensures ondataavailable fires frequently.
            mediaRecorder.start(config.timeslice);
            
            // Start monitoring the audio volume for silence detection.
            requestAnimationFrame(monitorVolume);
        
            // Disable/enable buttons appropriately.
            startBtn.disabled = true;
            stopBtn.disabled = false;
        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Microphone access is required.");
        }
    }
    
    // Monitor audio volume and perform calibration/segmentation.
    function monitorVolume() {
        console.log("monitorVolume")

        analyser.getByteFrequencyData(dataArray);
        // Calculate an average normalized volume (0 to 1)
        const avg = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
        const normalizedVolume = avg / 255;
        const now = performance.now();
        
        // ----- Calibration Phase -----
        if (calibrating) {
            calibrationSamples.push(normalizedVolume);
            if (now - calibrationStartTime >= config.calibrationDuration) {
            // Set the baseline as the average volume during calibration.
            baselineVolume = calibrationSamples.reduce((a, b) => a + b, 0) / calibrationSamples.length;
            calibrating = false;
            console.log("Calibration complete. Baseline volume:", baselineVolume.toFixed(3));
            }
        } else {
            // ----- Segmentation Logic -----
            // Define a threshold below which we consider the audio to be "silent".
            const silenceThreshold = baselineVolume * config.silenceThresholdMultiplier;
            
            if (normalizedVolume < silenceThreshold) {
            // Volume is low: start (or continue) timing the silence.
            if (silenceStart === null) {
                silenceStart = now;
                console.log("low volume start");
            }
            } else {
            // Audio is above threshold: if we were in silence long enough, finalize the segment.
            if (silenceStart !== null && now - silenceStart >= config.silenceDuration) {
                finalizeSegment();
            }
            silenceStart = null; // Reset silence detection.
            }
        }
        
        // Continue the loop as long as recording is active.
        if (mediaRecorder && mediaRecorder.state === "recording") {
            requestAnimationFrame(monitorVolume);
        }
    }
    
    // Finalize the current segment if it’s long enough.
    function finalizeSegment() {
        console.log("finalizeSegment")
        // Only finalize if the segment is longer than the minimum allowed duration.
        if (currentSegmentChunks.length === 0) return;

        const segmentStartTime = currentSegmentChunks[0].timestamp;
        const segmentEndTime = currentSegmentChunks[currentSegmentChunks.length - 1].timestamp;
        const duration = segmentEndTime - segmentStartTime;
      
        // If duration < threshold, skip
        if (duration < config.minSegmentDuration) {
            console.log("Segment too short; not finalizing.");
            return;
        }
        
        // Determine how many chunks (approximately) correspond to the desired overlap duration.
        const numOverlapChunks = Math.ceil(config.overlapDuration / config.timeslice);
        let finalizedChunks, overlapChunks;
        
        if (currentSegmentChunks.length > numOverlapChunks) {
            finalizedChunks = currentSegmentChunks.slice(0, currentSegmentChunks.length - numOverlapChunks);
            overlapChunks = currentSegmentChunks.slice(currentSegmentChunks.length - numOverlapChunks);
        } else {
            finalizedChunks = currentSegmentChunks.slice();
            overlapChunks = [];
        }
        
        // Create a Blob for the finalized segment.
        const blobs = finalizedChunks.map((item) => item.blob);
        const segmentBlob = new Blob(blobs, { type: mediaRecorder.mimeType });
        segments.push(segmentBlob);
        //  createSegmentDownloadLink(segmentBlob, segmentCounter);
        createSegmentEntry(segmentBlob, segmentCounter);

        console.log(`Segment ${segmentCounter} finalized. Duration: ${(segmentEndTime - segmentStartTime).toFixed(0)} ms`);
        segmentCounter++;
        
        // Save the overlap chunks for the next segment.
        pendingOverlapChunks = overlapChunks.slice();
        // Reset current segment buffer to start with the overlap.
        currentSegmentChunks = pendingOverlapChunks.slice();
    }
    
    // Create a download link for a given audio segment.
    function createSegmentDownloadLink(blob, index) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `segment_${index}.webm`;
        link.innerText = `Download Segment ${index}`;
        link.style.display = "block";
        downloadSegmentsContainer.appendChild(link);
        }
        
        // ======= EVENT LISTENERS =======
        startBtn.addEventListener("click", startRecording);
        
        stopBtn.addEventListener("click", () => {
        // Stop the MediaRecorder and finalize any current segment.
        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop();
            if (currentSegmentChunks.length > 0) {
            finalizeSegment();
            }
        }
        startBtn.disabled = false;
        stopBtn.disabled = true;
    });

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
    
});
