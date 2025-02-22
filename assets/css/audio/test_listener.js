const testAudioFiles = [
    "assets/audio/test_audio_1.mp3",
    "assets/audio/test_audio_2.mp3",
    "assets/audio/test_audio_3.mp3",
    "assets/audio/test_audio_4.mp3"
];

let currentIndex = 0;

function sendAudioFile() {
    if (currentIndex >= testAudioFiles.length) {
        console.log("All test files have been sent.");
        return;
    }

    const audioFile = testAudioFiles[currentIndex];

    // Store file in localStorage to simulate sending to transcriber.js
    localStorage.setItem('audioFile', audioFile);
    console.log(`Sent ${audioFile} to transcriber.js`);

    currentIndex++;
}

// Run every 10 seconds
setInterval(sendAudioFile, 10000);