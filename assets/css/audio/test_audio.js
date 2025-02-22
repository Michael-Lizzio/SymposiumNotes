const audioFiles = [
    'assets/audio/example1.mp3',
    'assets/audio/example2.mp3',
    'assets/audio/example3.mp3',
    'assets/audio/example4.mp3'
];

let currentIndex = 0;

function sendAudioFile() {
    if (currentIndex < audioFiles.length) {
        const audioFilePath = audioFiles[currentIndex];
        console.log(`Sending file: ${audioFilePath}`);
        
        fetch('assets/js/transcriber.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audioFilePath })
        });
        
        currentIndex++;
    }
}

// Send an audio file every 20 seconds
setInterval(sendAudioFile, 20000);
