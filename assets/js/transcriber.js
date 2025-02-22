document.addEventListener("DOMContentLoaded", function () {
    // Retrieve audio file name from localStorage
    const audioFileName = localStorage.getItem("pendingAudio");

    if (audioFileName) {
        processAudioFile(audioFileName);
        localStorage.removeItem("pendingAudio"); // Clear it after processing
    }
});

// Function to process the received audio file
function processAudioFile(fileName) {
    // Simulate sending to AI and getting a transcription
    console.log(`Processing file: ${fileName}`);

    // Simulated AI transcription
    setTimeout(() => {
        const fakeTranscription = `Transcribed text for ${fileName}: "This is a sample transcription output."`;

        saveTranscription(fakeTranscription);
    }, 2000); // Simulate 2-second AI processing delay
}

// Function to save transcription and update transcription.html
function saveTranscription(text) {
    let transcriptions = JSON.parse(localStorage.getItem("transcriptions")) || [];
    transcriptions.push(text);
    localStorage.setItem("transcriptions", JSON.stringify(transcriptions));

    // Redirect to transcription page to display results
    window.location.href = "transcription.html";
}
