document.addEventListener("DOMContentLoaded", function () {
    let mediaRecorder;
    let audioChunks = [];
    let volumeData = []; // Stores volume levels
    let timeStamps = []; // Stores time points
    let startTime;
    let audioContext;
    let analyser;
    let dataArray;

    const startBtn = document.getElementById("startRecord");
    const stopBtn = document.getElementById("stopRecord");
    const audioPlayer = document.getElementById("audioPlayer");
    const downloadLink = document.getElementById("downloadLink");
    const canvas = document.getElementById("volumeChart").getContext("2d");

    // Initialize Chart.js
    const volumeChart = new Chart(canvas, {
        type: "line",
        data: {
            labels: [],
            datasets: [{
                label: "Audio Volume (Amplitude)",
                borderColor: "blue",
                backgroundColor: "rgba(0, 0, 255, 0.1)",
                data: [],
                fill: true
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: { title: { display: true, text: "Time (seconds)" } },
                y: { title: { display: true, text: "Volume Level" }, min: 0, max: 1 }
            }
        }
    });

    // Request microphone access
    async function getMicrophoneAccess() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            return stream;
        } catch (error) {
            console.error("Microphone access denied:", error);
            alert("Please allow microphone access.");
        }
    }

    // Analyze microphone volume levels
    function analyzeAudio(stream) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256; // Resolution of volume analysis

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        dataArray = new Uint8Array(analyser.frequencyBinCount);
    }

    function recordVolume() {
        if (!analyser) return;
        
        analyser.getByteFrequencyData(dataArray);
        let avgVolume = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        let normalizedVolume = avgVolume / 255; // Normalize between 0 and 1

        let currentTime = (Date.now() - startTime) / 1000; // Time in seconds
        volumeData.push(normalizedVolume);
        timeStamps.push(currentTime);

        // Update graph
        volumeChart.data.labels = timeStamps;
        volumeChart.data.datasets[0].data = volumeData;
        volumeChart.update();

        requestAnimationFrame(recordVolume);
    }

    startBtn.addEventListener("click", async () => {
        const stream = await getMicrophoneAccess();
        if (!stream) return;

        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        volumeData = [];
        timeStamps = [];
        startTime = Date.now();

        analyzeAudio(stream);
        recordVolume();

        mediaRecorder.ondataavailable = event => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
            const audioUrl = URL.createObjectURL(audioBlob);
            audioPlayer.src = audioUrl;
            downloadLink.href = audioUrl;
            downloadLink.download = "recording.webm";
            downloadLink.style.display = "block";
            downloadLink.innerText = "Download Recording";
        };

        mediaRecorder.start();
        startBtn.disabled = true;
        stopBtn.disabled = false;
    });

    stopBtn.addEventListener("click", () => {
        mediaRecorder.stop();
        startBtn.disabled = false;
        stopBtn.disabled = true;
    });
});
